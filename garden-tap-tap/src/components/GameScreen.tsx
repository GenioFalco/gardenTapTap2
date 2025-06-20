import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Location, Tool, CurrencyType, Currency, Helper } from '../types';
import * as api from '../lib/api';

// Компонент модального окна улучшения инструментов
const UpgradeModal = ({ 
  show, 
  onClose, 
  tools, 
  equippedToolId, 
  playerLevel,
  onBuyTool,
  onActivateTool,
  locationCurrency,
  locationName,
  locationCurrencyType,
  unlockedTools = [], // Массив ID разблокированных инструментов
  locationId // Добавляем ID локации для работы с помощниками
}: { 
  show: boolean; 
  onClose: () => void; 
  tools: Tool[];
  equippedToolId: number;
  playerLevel: number;
  onBuyTool: (toolId: number) => Promise<boolean>;
  onActivateTool: (toolId: number) => Promise<boolean | void>;
  locationCurrency: number;
  locationName: string;
  locationCurrencyType: CurrencyType;
  unlockedTools?: number[]; // Новый пропс для разблокированных инструментов
  locationId: number; // ID локации для работы с помощниками
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'helpers'>('tools');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Состояния для работы с помощниками
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loadingHelpers, setLoadingHelpers] = useState<boolean>(true);
  const [processingHelperId, setProcessingHelperId] = useState<number | null>(null);
  const [recentlyCollected, setRecentlyCollected] = useState<number | null>(null);
  const [accumulatedResources, setAccumulatedResources] = useState<Record<number, number>>({});
  
  // Загрузка помощников при открытии вкладки
  useEffect(() => {
    if (show && activeTab === 'helpers') {
      loadHelpers();
      
      // Запускаем интервал для обновления накопленных ресурсов
      const interval = setInterval(calculateAccumulatedResources, 5000); // Обновляем каждые 5 секунд
      return () => clearInterval(interval);
    }
  }, [show, activeTab, locationId]);

  if (!show) return null;
  
  // Обработчик покупки инструмента с проверкой ресурсов
  const handleBuyTool = async (tool: Tool) => {
    // Проверяем, достаточно ли ресурсов для покупки
    if (tool.unlockCost > locationCurrency) {
      setErrorMessage(`Недостаточно ресурсов: необходимо ${tool.unlockCost} ${locationCurrencyType.toLowerCase()}`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    
    // Пытаемся купить инструмент
    const success = await onBuyTool(tool.id);
    if (!success) {
      setErrorMessage('Не удалось приобрести инструмент');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };
  
  // Функция расчета накопленных ресурсов
  const calculateAccumulatedResources = () => {
    const accumulated: Record<number, number> = {};
    
    helpers.forEach(helper => {
      const isActive = helper.isActive || (helper as any).is_active;
      if (isActive) {
        const activatedTime = (helper as any).activated_time;
        if (activatedTime) {
          try {
            const activationTime = new Date(activatedTime);
            const currentTime = new Date();
            const hoursDiff = (currentTime.getTime() - activationTime.getTime()) / (1000 * 60 * 60);
            const helperIncome = helper.incomePerHour || (helper as any).income_per_hour || 0;
            accumulated[helper.id] = Math.round(helperIncome * hoursDiff * 100) / 100;
            console.log(`Помощник ${helper.id}: накоплено ${accumulated[helper.id]} (${hoursDiff.toFixed(2)} часов)`);
          } catch (error) {
            console.error('Ошибка при расчете накопленных ресурсов:', error);
          }
        } else {
          console.log(`Помощник ${helper.id} активен, но нет времени активации`);
        }
      }
    });
    
    setAccumulatedResources(accumulated);
    console.log('Накопленные ресурсы:', accumulated);
  };
  
  // Функция загрузки помощников
  const loadHelpers = async () => {
    try {
      setLoadingHelpers(true);
      setErrorMessage(null);
      
      // Загружаем помощников для локации
      const loadedHelpers = await api.getHelpersByLocationId(locationId);
      
      // Загружаем активных помощников с временем активации
      const activeHelpers = await api.getActiveHelpers();
      console.log('Активные помощники:', activeHelpers);
      
      // Объединяем данные
      const mergedHelpers = loadedHelpers.map(helper => {
        const activeHelper = activeHelpers.find(ah => ah.id === helper.id);
        if (activeHelper) {
          return {
            ...helper,
            activated_time: activeHelper.activated_time
          };
        }
        return helper;
      });
      
      setHelpers(mergedHelpers);
      
      // Рассчитываем накопленные ресурсы сразу после загрузки
      setTimeout(calculateAccumulatedResources, 100);
    } catch (error) {
      console.error('Ошибка при загрузке помощников:', error);
      setErrorMessage('Не удалось загрузить помощников');
    } finally {
      setLoadingHelpers(false);
    }
  };
  
  // Обработчик покупки помощника
  const handleBuyHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setErrorMessage(null);
      await api.buyHelper(helper.id);
      await loadHelpers();
    } catch (error: any) {
      console.error('Ошибка при покупке помощника:', error);
      setErrorMessage(error.message || 'Ошибка при покупке помощника');
    } finally {
      setProcessingHelperId(null);
    }
  };
  
  // Обработчик активации/деактивации помощника
  const handleToggleHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setErrorMessage(null);
      await api.toggleHelper(helper.id);
      await loadHelpers();
    } catch (error: any) {
      console.error('Ошибка при активации/деактивации помощника:', error);
      setErrorMessage(error.message || 'Ошибка при активации/деактивации помощника');
    } finally {
      setProcessingHelperId(null);
    }
  };
  
  // Обработчик сбора награды от помощников
  const handleCollectReward = async () => {
    try {
      setErrorMessage(null);
      const result = await api.collectHelpersReward();
      
      if (result.collected > 0) {
        // Округляем до целого числа для более наглядного отображения
        const roundedCollected = Math.round(result.collected);
        setRecentlyCollected(roundedCollected);
        
        // Анимация исчезновения через 2 секунды
        setTimeout(() => setRecentlyCollected(null), 2000);
      }
      
      // Сбрасываем накопленные ресурсы
      setAccumulatedResources({});
      
      // Обновляем данные о помощниках
      await loadHelpers();
    } catch (error: any) {
      console.error('Ошибка при сборе награды:', error);
      setErrorMessage(error.message || 'Ошибка при сборе награды');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md relative">
        {/* Крестик для закрытия */}
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Улучшения</h2>
        </div>
        
        {/* Сообщение об ошибке */}
        {errorMessage && (
          <div className="bg-red-500 text-white p-2 text-center">
            {errorMessage}
          </div>
        )}
        
        {/* Табы */}
        <div className="flex border-b border-gray-700">
          <button 
            className={`flex-1 py-2 text-center ${activeTab === 'tools' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('tools')}
          >
            Инструменты
          </button>
          <button 
            className={`flex-1 py-2 text-center ${activeTab === 'helpers' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('helpers')}
          >
            Помощники
          </button>
        </div>
        
        {/* Содержимое табов */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === 'tools' ? (
            <div>
              <h3 className="text-white font-medium mb-4">Доступные инструменты</h3>
              
              {tools.map(tool => {
                const isEquipped = tool.id === equippedToolId;
                const isUnlockable = playerLevel >= tool.unlockLevel;
                
                // Проверяем, является ли инструмент разблокированным:
                // 1. Если он уже экипирован
                // 2. Если он есть в массиве unlockedTools (записи из таблицы player_tools)
                // 3. Если он помечен как разблокированный (is_unlocked)
                // 4. Если его стоимость 0
                const isOwned = isEquipped || 
                               unlockedTools.includes(tool.id) || 
                               (tool as any).is_unlocked === true ||
                               tool.unlockCost === 0;
                
                // Показываем сообщение о недостаточности ресурсов
                const notEnoughResources = tool.unlockCost > locationCurrency;
                
                return (
                  <div 
                    key={tool.id} 
                    className={`mb-4 p-3 rounded-lg ${isEquipped ? 'bg-gray-700' : 'bg-gray-900'}`}
                  >
                    <div className="flex items-center">
                      <img 
                        src={tool.imagePath || '/assets/tools/axe.png'} 
                        alt={tool.name} 
                        className="w-12 h-12 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h4 className="text-white font-medium">{tool.name}</h4>
                          {isEquipped && (
                            <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">
                              Активен
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          <div>+{tool.locationCoinsPower || tool.location_coins_power || 1} валюты локации за тап</div>
                          <div>+{tool.mainCoinsPower || tool.main_coins_power || 0.5} сад-коинов за тап</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      {!isUnlockable ? (
                        <div className="text-sm text-gray-400 text-center border border-gray-700 py-2 rounded">
                          Доступен с {tool.unlockLevel} уровня
                        </div>
                      ) : isOwned ? (
                        !isEquipped && (
                          <button 
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-1 px-4 rounded"
                            onClick={() => onActivateTool(tool.id)}
                          >
                            Активировать
                          </button>
                        )
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1 text-xs">
                            {notEnoughResources && 
                              <span className="text-red-400">Недостаточно ресурсов</span>
                            }
                          </div>
                          <button 
                            className={`w-full py-1 px-4 rounded ${
                              notEnoughResources 
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            }`}
                            onClick={() => handleBuyTool(tool)}
                          >
                            <span className="font-bold">{locationCurrency.toFixed(2)}/{tool.unlockCost}</span> {tool.currencyType.toLowerCase()}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <h3 className="text-white font-medium mb-4">Помощники</h3>
              
              {/* Кнопка сбора наград */}
              <div className="mb-4 relative">
                <button 
                  onClick={handleCollectReward}
                  className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                  Собрать награду от помощников
                </button>
                
                {recentlyCollected !== null && (
                  <motion.div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-xl font-bold text-yellow-300"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -30 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                  >
                    +{recentlyCollected.toFixed(0)} {locationCurrencyType}
                  </motion.div>
                )}
              </div>
              
              {/* Список помощников */}
              {loadingHelpers ? (
                <div className="text-center text-white py-4">Загрузка...</div>
              ) : helpers.length === 0 ? (
                <div className="text-center text-white py-4">Помощников пока нет</div>
              ) : (
                <div>
                  {helpers.map(helper => {
                    const isUnlocked = helper.isUnlocked || (helper as any).is_unlocked;
                    const isActive = helper.isActive || (helper as any).is_active;
                    const canActivate = (helper as any).can_activate;
                    const helperCost = helper.unlockCost || (helper as any).unlock_cost || 0;
                    const notEnoughResources = helperCost > locationCurrency;
                    const isUnlockable = playerLevel >= (helper.unlockLevel || (helper as any).unlock_level || 1);
                    const helperIncome = helper.incomePerHour || (helper as any).income_per_hour || 0;
                    const helperCurrency = helper.currencyType || (helper as any).currency_type || locationCurrencyType;
                    const helperUnlockLevel = helper.unlockLevel || (helper as any).unlock_level || 1;
                    
                    return (
                      <div 
                        key={helper.id} 
                        className={`mb-4 p-3 rounded-lg ${isActive ? 'bg-gray-700' : 'bg-gray-900'}`}
                      >
                        <div className="flex items-center">
                          <img 
                            src={helper.imagePath || '/assets/helpers/apprentice.png'} 
                            alt={helper.name} 
                            className="w-12 h-12 mr-3 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <h4 className="text-white font-medium">{helper.name}</h4>
                              {isActive && (
                                <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded flex items-center">
                                  <span className="mr-1">Активен</span>
                                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              {helper.description}
                            </div>
                            <div className="text-sm text-green-400">
                              {isActive ? (
                                <div className="flex items-center">
                                  <span>+{helperIncome} {helperCurrency} в час</span>
                                  <span className="ml-2 text-yellow-400 animate-pulse">⚡</span>
                                </div>
                              ) : (
                                <span>+{helperIncome} {helperCurrency} в час</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          {!isUnlockable ? (
                            <div className="text-sm text-gray-400 text-center border border-gray-700 py-2 rounded">
                              Доступен с уровня {helperUnlockLevel}
                            </div>
                          ) : isUnlocked ? (
                            <button 
                              className={`w-full ${
                                isActive 
                                  ? 'bg-red-600 hover:bg-red-700' 
                                  : canActivate 
                                    ? 'bg-green-600 hover:bg-green-700' 
                                    : 'bg-gray-600'
                              } text-white py-1 px-4 rounded ${
                                processingHelperId === helper.id ? 'opacity-50 cursor-wait' : ''
                              } ${!canActivate && !isActive ? 'cursor-not-allowed' : ''}`}
                              onClick={() => handleToggleHelper(helper)}
                              disabled={processingHelperId === helper.id || (!canActivate && !isActive)}
                            >
                              {isActive ? 'Деактивировать' : 'Активировать'}
                            </button>
                          ) : (
                            <div>
                              <div className="flex justify-between items-center mb-1 text-xs">
                                {notEnoughResources && 
                                  <span className="text-red-400">Недостаточно ресурсов</span>
                                }
                              </div>
                              <button 
                                className={`w-full py-1 px-4 rounded ${
                                  notEnoughResources 
                                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                } ${
                                  processingHelperId === helper.id ? 'opacity-50 cursor-wait' : ''
                                }`}
                                onClick={() => handleBuyHelper(helper)}
                                disabled={notEnoughResources || processingHelperId === helper.id}
                              >
                                <span className="font-bold">{locationCurrency.toFixed(2)}/{helperCost}</span> {helperCurrency}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface GameScreenProps {
  location: Location;
  tools: Tool[];
  equippedToolId: number;
  resourceAmount: number;
  currencyType: CurrencyType;
  energy: number;
  maxEnergy: number;
  level: number;
  experience: number;
  nextLevelExperience: number;
  onTap: () => Promise<void>;
  onUpgrade: (toolId: number) => Promise<boolean>;
  onActivateTool: (toolId: number) => Promise<boolean | void>;
  characterImageUrl?: string;
  gardenCoins?: number;
  unlockedTools?: number[]; // Добавляем список разблокированных инструментов
}

const GameScreen: React.FC<GameScreenProps> = ({
  location,
  tools,
  equippedToolId,
  resourceAmount,
  currencyType,
  energy,
  maxEnergy,
  level,
  experience,
  nextLevelExperience,
  onTap,
  onUpgrade,
  onActivateTool,
  characterImageUrl = '/assets/characters/lumberjack.png',
  gardenCoins = 0,
  unlockedTools = [], // По умолчанию пустой массив
}) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [characterAppearance, setCharacterAppearance] = useState<{
    imagePath: string | null;
    animationPath: string | null;
    animationType: string | null;
    frameCount: number | null;
  }>({
    imagePath: null,
    animationPath: null,
    animationType: null,
    frameCount: null
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showNoEnergy, setShowNoEnergy] = useState(false);
  const [showNotEnoughResources, setShowNotEnoughResources] = useState(false);
  const [currencyInfo, setCurrencyInfo] = useState<Currency | null>(null);
  
  // Найти текущий и следующий доступный инструмент
  const currentTool = tools.find(tool => tool.id === equippedToolId);
  const nextToolIndex = tools.findIndex(tool => tool.id === equippedToolId) + 1;
  const nextTool = nextToolIndex < tools.length ? tools[nextToolIndex] : null;

  // Загрузка информации о валюте локации
  useEffect(() => {
    const loadCurrencyInfo = async () => {
      try {
        // Используем currencyType, если доступен, иначе currencyId
        const currencyIdentifier = location.currencyType || location.currencyId;
        if (currencyIdentifier) {
          const currency = await api.getCurrencyByType(currencyIdentifier);
          if (currency) {
            setCurrencyInfo(currency);
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке информации о валюте:', error);
      }
    };

    loadCurrencyInfo();
  }, [location.currencyType, location.currencyId]);

  // Загрузка внешнего вида персонажа при изменении инструмента или локации
  useEffect(() => {
    const loadCharacterAppearance = async () => {
      // Проверяем, что characterId определен (поддержка camelCase и snake_case)
      const characterId = location.characterId || (location as any).character_id;
      
      if (!characterId) {
        console.warn('characterId не определен для текущей локации:', location);
        // Используем дефолтное изображение
        setCharacterAppearance({
          imagePath: characterImageUrl,
          animationPath: null,
          animationType: null,
          frameCount: null
        });
        return;
      }
      
      if (!equippedToolId) {
        console.warn('equippedToolId не определен для текущей локации:', location);
        // Используем дефолтное изображение
        setCharacterAppearance({
          imagePath: characterImageUrl,
          animationPath: null,
          animationType: null,
          frameCount: null
        });
        return;
      }
      
      try {
        console.log(`Загрузка внешнего вида персонажа: characterId=${characterId}, toolId=${equippedToolId}`);
        const appearance = await api.getCharacterAppearance(characterId, equippedToolId);
        
        if (appearance) {
          console.log('Получен внешний вид персонажа:', appearance);
          // Используем полученные данные, безопасно обрабатывая отсутствие полей
          const imagePath = appearance.imagePath || characterImageUrl;
          const animationPath = appearance.animationPath || null;
          const animationType = appearance.animationType || null;
          // frameCount может отсутствовать
          const frameCount = appearance.frameCount !== undefined ? appearance.frameCount : null;
          
          setCharacterAppearance({
            imagePath,
            animationPath,
            animationType,
            frameCount
          });
        } else {
          console.warn('Не найден внешний вид персонажа для данной комбинации character/tool');
          // Используем дефолтное изображение
          setCharacterAppearance({
            imagePath: characterImageUrl,
            animationPath: null,
            animationType: null,
            frameCount: null
          });
        }
      } catch (error) {
        console.error('Ошибка при загрузке внешнего вида персонажа:', error);
        // Устанавливаем дефолтное изображение при ошибке
        setCharacterAppearance({
          imagePath: characterImageUrl,
          animationPath: null,
          animationType: null,
          frameCount: null
        });
      }
    };
    
    loadCharacterAppearance();
  }, [location, equippedToolId, characterImageUrl]);

  // Попытка улучшить инструмент
  const handleUpgrade = useCallback(async () => {
    if (!nextTool) return;
    
    const success = await onUpgrade(nextTool.id);
    if (!success) {
      setShowNotEnoughResources(true);
      setTimeout(() => setShowNotEnoughResources(false), 1500);
    }
  }, [nextTool, onUpgrade]);

  // Тап по персонажу
  const handleTap = useCallback(async () => {
    if (energy <= 0) {
      setShowNoEnergy(true);
      setTimeout(() => setShowNoEnergy(false), 1500);
      return;
    }
    
    if (isAnimating) return; // Предотвращаем повторную анимацию
    
    setIsAnimating(true);
    
    // Если есть анимация, временно заменяем изображение на анимацию
    const hasAnimation = characterAppearance.animationPath !== null && characterAppearance.animationType !== null;
    
    if (hasAnimation) {
      const staticImage = characterAppearance.imagePath;
      const animationDuration = characterAppearance.animationType === 'gif' ? 1000 : 500; // GIF дольше, спрайты быстрее
      
      setCharacterAppearance(prev => ({
        ...prev,
        imagePath: characterAppearance.animationPath || staticImage
      }));
      
      // Возвращаем статичное изображение после завершения анимации
      setTimeout(() => {
        setCharacterAppearance(prev => ({
          ...prev,
          imagePath: staticImage
        }));
      }, animationDuration);
    }
    
    await onTap();
    
    // Останавливаем анимацию через небольшое время
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  }, [energy, onTap, isAnimating, characterAppearance]);

  // Клавиатурные сокращения
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleTap();
      if (e.code === 'KeyU') setShowUpgradeModal(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  return (
    <div 
      className="h-screen w-full flex flex-col items-center justify-between py-8 px-4 pt-24"
      style={{
        backgroundImage: `url(${location.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Центральная область с персонажем */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Персонаж (кликабельный) - используем изображение вместо canvas */}
        <motion.div 
          className={`cursor-pointer relative ${isAnimating ? 'animate-bounce-small' : ''}`}
          animate={isAnimating ? { scale: 0.95 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleTap}
        >
          {characterAppearance.imagePath && (
            <img 
              src={characterAppearance.imagePath} 
              alt="Персонаж"
              className="w-56 h-56 md:w-64 md:h-64"
              style={{ 
                pointerEvents: energy <= 0 ? 'none' : 'auto',
                objectFit: 'contain'
              }}
            />
          )}
          {!characterAppearance.imagePath && (
            <div 
              className="w-56 h-56 md:w-64 md:h-64 bg-gray-700 flex items-center justify-center"
              style={{ pointerEvents: energy <= 0 ? 'none' : 'auto' }}
            >
              <span className="text-white text-xl">Персонаж не найден</span>
            </div>
          )}
        </motion.div>

        {/* Всплывающие уведомления */}
        {showNotEnoughResources && (
          <motion.div
            className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 px-4 py-2 rounded-lg text-white text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Недостаточно ресурсов
          </motion.div>
        )}

        {showNoEnergy && (
          <motion.div
            className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-amber-600 px-4 py-2 rounded-lg text-white text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Нет энергии
          </motion.div>
        )}
      </div>

      {/* Нижняя область с инструментами - немного поднята вверх */}
      <div className="w-full max-w-xs fixed bottom-24 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gray-800 bg-opacity-80 rounded-lg p-1.5">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-xs text-white opacity-70">Текущий инструмент</div>
              <div className="font-medium text-sm text-white">{currentTool?.name || 'Нет'}</div>
            </div>
            <div className="font-medium text-right">
              <div className="text-xs text-white opacity-70">Сила тапа</div>
              <div className="flex flex-col">
                <span className="text-white text-sm">{currencyInfo?.name || currencyType}: {currentTool?.locationCoinsPower || currentTool?.location_coins_power || 1}</span>
                <span className="text-yellow-400 text-sm">Сад-коины: {currentTool?.mainCoinsPower || currentTool?.main_coins_power || 0.5}</span>
              </div>
            </div>
          </div>

          <button 
            className="w-full bg-yellow-500 hover:bg-yellow-600 py-1 px-2 rounded text-white text-xs mt-0.5"
            onClick={() => setShowUpgradeModal(true)}
          >
            Улучшить
          </button>
        </div>
      </div>

      {/* Модальное окно улучшения */}
      <UpgradeModal 
        show={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        tools={tools}
        equippedToolId={equippedToolId}
        playerLevel={level}
        onBuyTool={onUpgrade}
        onActivateTool={async (toolId) => {
          const result = await onActivateTool(toolId);
          setShowUpgradeModal(false);
          return result;
        }}
        locationCurrency={resourceAmount}
        locationName={location.name}
        locationCurrencyType={currencyType}
        unlockedTools={unlockedTools}
        locationId={location.id}
      />
    </div>
  );
};

export default GameScreen; 