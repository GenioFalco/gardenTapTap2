import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Location, Tool, CurrencyType, Currency, Helper } from '../types';
import * as api from '../lib/api';
import OfficeModal from './OfficeModal';
import TaskButton from './TaskButton';
import TasksModal from './TasksModal';

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
  locationId, // Добавляем ID локации для работы с помощниками
  onHelpersChanged, // Добавляем обработчик изменения помощников
  updateResources
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
  onHelpersChanged?: () => void; // Обработчик изменения помощников
  updateResources?: (currencyId?: string | number, newAmount?: number) => Promise<void>; // Функция для обновления ресурсов
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'office'>('tools');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Обработчик изменения помощников
  const handleHelpersChanged = () => {
    // Обновляем информацию о ресурсах после изменения помощников
    if (onHelpersChanged) {
      onHelpersChanged();
    }
  };
  
  // Функция для безопасного преобразования типа валюты в строку
  const getCurrencyTypeString = (currencyType: any): string => {
    if (currencyType === undefined || currencyType === null) return 'ресурсов';
    
    // Карта соответствия ID валют и их названий
    const currencyMap: Record<string, string> = {
      '1': 'main',
      '2': 'forest',
      '3': 'dirt',
              '4': 'weed'
    };
    
    // Если это число или строковое представление числа, пробуем найти в карте
    if (typeof currencyType === 'number' || !isNaN(Number(currencyType))) {
      const currencyString = currencyMap[String(currencyType)];
      return currencyString ? currencyString.toLowerCase() : 'ресурсов';
    }
    
    // Если это строка, просто приводим к нижнему регистру
    if (typeof currencyType === 'string') {
      return currencyType.toLowerCase();
    }
    
    return 'ресурсов';
  };
  
  if (!show) return null;
  
  // Обработчик покупки инструмента с проверкой ресурсов
  const handleBuyTool = async (tool: Tool) => {
    // Проверяем, достаточно ли ресурсов для покупки
    if (tool.unlockCost > locationCurrency) {
      setErrorMessage(`Недостаточно ресурсов: необходимо ${tool.unlockCost} ${getCurrencyTypeString(locationCurrencyType)}`);
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
            className={`flex-1 py-2 text-center ${activeTab === 'office' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('office')}
          >
            Офис
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
                            <span className="font-bold">{locationCurrency.toFixed(2)}/{tool.unlockCost}</span> {getCurrencyTypeString(tool.currencyType)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <OfficeModal
              show={true}
              onClose={() => {}} // Этот onClose не будет использоваться, так как модальное окно встроено в таб
              locationId={locationId}
              locationName={locationName}
              playerLevel={playerLevel}
              locationCurrency={locationCurrency}
              locationCurrencyType={locationCurrencyType}
              onHelpersChanged={handleHelpersChanged}
              embedded={true} // Добавляем флаг, что модальное окно встроено в таб
              updateResources={updateResources}
            />
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
  updateResources?: (currencyId?: string | number, newAmount?: number) => Promise<void>; // Функция для обновления ресурсов
  userId: string; // Добавляем userId для TasksModal
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
  updateResources,
  userId
}) => {
  // Состояние для модального окна
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [characterAppearance, setCharacterAppearance] = useState<{
    imagePath: string | null;
    animationType: string | null;
    animationPath: string | null;
    frameCount: number | null;
  }>({
    imagePath: null,
    animationType: null,
    animationPath: null,
    frameCount: null
  });
  const [currentResourceAmount, setCurrentResourceAmount] = useState(resourceAmount);
  const [currencyInfo, setCurrencyInfo] = useState<Currency | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showNoEnergy, setShowNoEnergy] = useState(false);
  const [showNotEnoughResources, setShowNotEnoughResources] = useState(false);
  // Используем useRef для хранения счетчика анимаций
  const animationQueueRef = useRef<number>(0);
  const [animationQueueDisplay, setAnimationQueueDisplay] = useState<number>(0);
  // Добавляем состояние для эффекта получения ресурсов
  const [resourceGain, setResourceGain] = useState<{show: boolean, amount: number}>({show: false, amount: 0});
  // Флаг для отслеживания, запущен ли процесс анимации
  const isProcessingAnimationRef = useRef<boolean>(false);
  // Ссылки на таймеры для их очистки
  const timersRef = useRef<number[]>([]);
  // Время последней активности анимации
  const lastAnimationTimeRef = useRef<number>(0);
  // Сохраняем статичное изображение персонажа
  const staticImageRef = useRef<string | null>(characterAppearance.imagePath);

  const [activeTab, setActiveTab] = useState<string>("tap");
  const [showTasksModal, setShowTasksModal] = useState(false);

  // Найти текущий и следующий доступный инструмент
  const currentTool = tools.find(tool => tool.id === equippedToolId);
  const nextToolIndex = tools.findIndex(tool => tool.id === equippedToolId) + 1;
  const nextTool = nextToolIndex < tools.length ? tools[nextToolIndex] : null;

  // Обновляем ссылку на статичное изображение при изменении персонажа
  useEffect(() => {
    if (!isAnimating) {
      staticImageRef.current = characterAppearance.imagePath;
    }
  }, [characterAppearance.imagePath, isAnimating]);

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
    // Предварительно загружаем изображение по умолчанию
    const preloadImage = new Image();
    preloadImage.src = characterImageUrl;
    
    // Сначала не показываем никакого изображения, чтобы избежать показа рамки
    setCharacterAppearance({
      imagePath: null,
      animationPath: null,
      animationType: null,
      frameCount: null
    });
    
    // Когда изображение загружено, устанавливаем его
    preloadImage.onload = () => {
      setCharacterAppearance({
        imagePath: characterImageUrl,
        animationPath: null,
        animationType: null,
        frameCount: null
      });
    };
    
    const loadCharacterAppearance = async () => {
      // Проверяем, что characterId определен (поддержка camelCase и snake_case)
      const characterId = location.characterId || (location as any).character_id;
      
      if (!characterId) {
        console.warn('characterId не определен для текущей локации:', location);
        return;
      }
      
      if (!equippedToolId) {
        console.warn('equippedToolId не определен для текущей локации:', location);
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
          
          // Предзагрузка изображения перед установкой
          if (imagePath) {
            const img = new Image();
            img.onload = () => {
              // Устанавливаем внешний вид только после успешной загрузки изображения
          setCharacterAppearance({
            imagePath,
            animationPath,
            animationType,
            frameCount
          });
              
              // Сохраняем статичное изображение для дальнейшего использования
              staticImageRef.current = imagePath;
            };
            img.onerror = () => {
              console.error('Ошибка загрузки изображения персонажа:', imagePath);
              // В случае ошибки загрузки оставляем текущее изображение
            };
            img.src = imagePath;
          }
        } else {
          console.warn('Не найден внешний вид персонажа для данной комбинации character/tool');
        }
      } catch (error) {
        console.error('Ошибка при загрузке внешнего вида персонажа:', error);
      }
    };
    
    // Даем небольшую задержку перед загрузкой, чтобы страница успела отрендериться с изображением по умолчанию
    const loadTimer = setTimeout(() => {
    loadCharacterAppearance();
    }, 100);
    
    return () => {
      clearTimeout(loadTimer);
    };
  }, [location, equippedToolId, characterImageUrl]);

  // Обновляем ресурсы при изменении props
  useEffect(() => {
    setCurrentResourceAmount(resourceAmount);
  }, [resourceAmount]);
  
  // Обработчик изменения помощников
  const handleHelpersChanged = (updatedAmount?: number) => {
    // Если передано обновленное количество ресурсов, обновляем его
    if (updatedAmount !== undefined) {
      console.log(`Обновление количества ресурсов: ${updatedAmount}`);
      if (updateResources) {
        // Используем функцию из родительского компонента для обновления всех ресурсов
        updateResources(location.currencyId || location.currency_id, updatedAmount);
      } else {
        // Запасной вариант, если функция не передана
        loadResourceAmount(updatedAmount);
      }
    } else {
      // Иначе просто перезагружаем ресурсы
      if (updateResources) {
        // Обновляем все ресурсы
        updateResources();
      } else {
        loadResourceAmount();
      }
    }
  };
  
  // Загрузка количества ресурсов
  const loadResourceAmount = async (newAmount?: number) => {
    try {
      if (newAmount !== undefined) {
        // Если передано новое значение, используем его без запроса к API
        setCurrentResourceAmount(newAmount);
      } else {
        // Иначе загружаем с сервера
        const currencyId = currencyType.toLowerCase();
        const amount = await api.getResourceAmount(currencyId);
        setCurrentResourceAmount(amount);
      }
    } catch (error) {
      console.error('Ошибка при загрузке количества ресурсов:', error);
    }
  };

  // Попытка улучшить инструмент (временно не используется)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUpgrade = useCallback(async () => {
    if (!nextTool) return;
    
    const success = await onUpgrade(nextTool.id);
    if (!success) {
      setShowNotEnoughResources(true);
      setTimeout(() => setShowNotEnoughResources(false), 1500);
    }
  }, [nextTool, onUpgrade]);

  // Очистка таймеров при размонтировании компонента
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  // Проверка на зависшие анимации
  useEffect(() => {
    // Если анимация активна, но долго не обновлялась, сбрасываем её
    const checkStuckAnimation = window.setInterval(() => {
      if (isProcessingAnimationRef.current) {
        const now = Date.now();
        // Если прошло больше 5 секунд с последнего обновления анимации
        if (now - lastAnimationTimeRef.current > 5000) {
          console.log("Анимация зависла, сбрасываем");
          // Сбрасываем состояние анимации
          isProcessingAnimationRef.current = false;
          setIsAnimating(false);
          // Очищаем очередь анимаций
          animationQueueRef.current = 0;
          setAnimationQueueDisplay(0);
          // Возвращаем обычное изображение персонажа
          if (characterAppearance.animationPath) {
            setCharacterAppearance(prev => ({
              ...prev,
              imagePath: staticImageRef.current || characterAppearance.imagePath
            }));
          }
        }
      }
    }, 1000);

    timersRef.current.push(checkStuckAnimation);
    return () => {
      window.clearInterval(checkStuckAnimation);
    };
  }, [characterAppearance]);

  // Функция для проигрывания следующей анимации в очереди
  const processNextAnimation = useCallback(() => {
    // Обновляем время последней активности анимации
    lastAnimationTimeRef.current = Date.now();
    
    // Если очередь пуста или уже идет обработка, выходим
    if (animationQueueRef.current <= 0 || !isProcessingAnimationRef.current) {
      isProcessingAnimationRef.current = false;
      setIsAnimating(false);
      return;
    }
    
    // Уменьшаем счетчик
    animationQueueRef.current -= 1;
    setAnimationQueueDisplay(animationQueueRef.current);
    
    // Показываем эффект получения ресурсов
    const gainAmount = currentTool?.locationCoinsPower || 1;
    setResourceGain({show: true, amount: gainAmount});
    const resourceTimer = window.setTimeout(() => setResourceGain({show: false, amount: 0}), 800);
    timersRef.current.push(resourceTimer);
    
    // Устанавливаем флаг анимации
    setIsAnimating(true);
    
    // Определяем длительность анимации
    const animationDuration = 800; // Фиксированная длительность для всех анимаций
    
    // Если у персонажа есть анимация, показываем её
    if (characterAppearance.animationPath) {
      // Используем сохраненное статичное изображение
      const staticImage = staticImageRef.current || characterAppearance.imagePath;
      
      // Показываем анимацию
      setCharacterAppearance(prev => ({
        ...prev,
        imagePath: characterAppearance.animationPath || staticImage
      }));
      
      // Возвращаем обычное изображение после окончания анимации
      const imageTimer = window.setTimeout(() => {
        setCharacterAppearance(prev => ({
          ...prev,
          imagePath: staticImage
        }));
        
        // Проверяем очередь и запускаем следующую анимацию или завершаем процесс
        const nextTimer = window.setTimeout(() => {
          if (animationQueueRef.current > 0) {
            processNextAnimation();
          } else {
            isProcessingAnimationRef.current = false;
            setIsAnimating(false);
          }
        }, 200);
        timersRef.current.push(nextTimer);
      }, animationDuration);
      timersRef.current.push(imageTimer);
    } else {
      // Если нет специальной анимации, просто ждем и проверяем очередь
      const waitTimer = window.setTimeout(() => {
        if (animationQueueRef.current > 0) {
          processNextAnimation();
        } else {
          isProcessingAnimationRef.current = false;
          setIsAnimating(false);
        }
      }, animationDuration);
      timersRef.current.push(waitTimer);
    }
  }, [characterAppearance, currentTool]);

  // Тап по персонажу
  const handleTap = useCallback(async () => {
    if (energy <= 0) {
      setShowNoEnergy(true);
      setTimeout(() => setShowNoEnergy(false), 1500);
      return;
    }
    
    // Ограничиваем максимальное количество анимаций в очереди
    if (animationQueueRef.current >= 10) {
      // Если очередь слишком большая, просто добавляем ресурсы без добавления анимации
      await onTap();
      return;
    }
    
    // Увеличиваем счетчик анимаций
    animationQueueRef.current += 1;
    setAnimationQueueDisplay(animationQueueRef.current);
    
    // Если процесс анимации не запущен, запускаем его
    if (!isProcessingAnimationRef.current) {
      isProcessingAnimationRef.current = true;
      processNextAnimation();
    }
    
    // Сразу вызываем onTap для начисления ресурсов
    await onTap();
    
  }, [energy, onTap, processNextAnimation]);

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
          className={`cursor-pointer relative w-56 h-56 md:w-64 md:h-64 flex items-center justify-center`}
          animate={isAnimating ? { scale: 0.95 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleTap}
          style={{ 
            pointerEvents: energy <= 0 ? 'none' : 'auto',
          }}
        >
          {characterAppearance.imagePath ? (
            <img 
              src={characterAppearance.imagePath} 
              alt=""
              className={`w-full h-full ${isAnimating ? 'animate-pulse' : ''}`}
              style={{ 
                objectFit: 'contain',
                opacity: 1
              }}
            />
          ) : (
            <span className="text-white text-xl animate-pulse">Загрузка...</span>
          )}
          
          {/* Визуальный эффект при тапе */}
          {isAnimating && (
            <motion.div
              className="absolute inset-0 rounded-full bg-white opacity-30"
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
          
          {/* Счетчик тапов в очереди */}
          {animationQueueDisplay > 1 && (
            <div className="absolute top-0 right-0 bg-yellow-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-sm">
              {animationQueueDisplay}
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
        
        {/* Эффект получения ресурсов */}
        {resourceGain.show && (
          <motion.div
            className="absolute text-xl font-bold text-yellow-300"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -50 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            +{resourceGain.amount} {currencyType}
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
        locationCurrency={currentResourceAmount}
        locationName={location.name}
        locationCurrencyType={currencyType as CurrencyType}
        unlockedTools={unlockedTools}
        locationId={location.id}
        onHelpersChanged={handleHelpersChanged}
        updateResources={updateResources}
      />
      
      {/* Добавляем кнопку для открытия окна заданий */}
      <TaskButton onClick={() => setShowTasksModal(true)} activeTab={activeTab} />
      
      {/* Добавляем модальное окно с заданиями */}
      <TasksModal 
        show={showTasksModal} 
        onClose={() => setShowTasksModal(false)}
        userId={userId}
      />
      
    </div>
  );
};

export default GameScreen; 