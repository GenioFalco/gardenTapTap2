import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Location, Tool, CurrencyType, Currency } from '../types';
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
  locationCurrencyType
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
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'helpers'>('tools');
  const [helperActive, setHelperActive] = useState<boolean>(false);

  // Помощник - заглушка для демонстрации
  const helper = {
    name: `Помощник ${locationName}`,
    unlockLevel: 5,
    cost: 500,
    income: 180,
    currency: locationCurrencyType,
    unlocked: playerLevel >= 5,
    purchased: false
  };

  if (!show) return null;

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
                const isOwned = isEquipped || (isUnlockable && tool.unlockCost === 0); // Упрощение для примера
                
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
                            <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">
                              Активен
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          <div>+{tool.location_coins_power || 1} валюты локации за тап</div>
                          <div>+{tool.main_coins_power || 0.5} сад-коинов за тап</div>
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
                        <button 
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-1 px-4 rounded"
                          onClick={() => onBuyTool(tool.id)}
                        >
                          Купить за {tool.unlockCost} {tool.currencyType}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <h3 className="text-white font-medium mb-4">Помощники</h3>
              
              <div className="mb-4 p-3 rounded-lg bg-gray-900">
                <div className="flex items-center">
                  <div className="w-12 h-12 mr-3 bg-gray-700 rounded-full flex items-center justify-center text-xl">
                    👷
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{helper.name}</h4>
                    <div className="text-sm text-gray-400">
                      +{helper.income} {helper.currency} в час
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  {!helper.unlocked ? (
                    <div className="text-sm text-gray-400 text-center border border-gray-700 py-2 rounded">
                      Доступен с {helper.unlockLevel} уровня
                    </div>
                  ) : !helper.purchased ? (
                    <button 
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-1 px-4 rounded"
                      onClick={() => alert('Помощник пока недоступен!')}
                    >
                      Нанять за {helper.cost} {helper.currency}
                    </button>
                  ) : (
                    <label className="flex items-center justify-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={helperActive}
                        onChange={() => setHelperActive(!helperActive)}
                        className="mr-2" 
                      />
                      <span className="text-white">{helperActive ? 'Активен' : 'Неактивен'}</span>
                    </label>
                  )}
                </div>
              </div>
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
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showNotEnoughResources, setShowNotEnoughResources] = useState(false);
  const [showNoEnergy, setShowNoEnergy] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currencyInfo, setCurrencyInfo] = useState<Currency | null>(null);

  // Найти текущий и следующий доступный инструмент
  const currentTool = tools.find(tool => tool.id === equippedToolId);
  const nextToolIndex = tools.findIndex(tool => tool.id === equippedToolId) + 1;
  const nextTool = nextToolIndex < tools.length ? tools[nextToolIndex] : null;

  // Загрузка информации о валюте локации
  useEffect(() => {
    const loadCurrencyInfo = async () => {
      try {
        const currency = await api.getCurrencyByType(location.currencyId);
        if (currency) {
          setCurrencyInfo(currency);
        }
      } catch (error) {
        console.error('Ошибка при загрузке информации о валюте:', error);
      }
    };

    loadCurrencyInfo();
  }, [location.currencyId]);

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
    
    await onTap();
    
    // Останавливаем анимацию через небольшое время
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  }, [energy, onTap, isAnimating]);

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
          <img 
            src={characterImageUrl} 
            alt="Персонаж"
            className="w-56 h-56 md:w-64 md:h-64"
            style={{ pointerEvents: energy <= 0 ? 'none' : 'auto' }}
          />
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
      <div className="w-full max-w-sm mb-20">
        <div className="bg-gray-800 bg-opacity-80 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-sm text-white opacity-70">Текущий инструмент</div>
              <div className="font-bold text-white">{currentTool?.name || 'Нет'}</div>
            </div>
            <div className="font-medium text-right">
              <div className="text-sm text-white opacity-70">Сила тапа</div>
              <div className="flex flex-col">
                <span className="text-white">{currencyInfo?.name || currencyType}: {currentTool?.location_coins_power || 1}</span>
                <span className="text-yellow-400">Сад-коины: {currentTool?.main_coins_power || 0.5}</span>
              </div>
            </div>
          </div>

          <button 
            className="w-full bg-yellow-500 hover:bg-yellow-600 py-2 px-4 rounded text-black font-medium mt-1"
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
      />
    </div>
  );
};

export default GameScreen; 