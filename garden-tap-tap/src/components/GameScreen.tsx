import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Location, Tool, CurrencyType } from '../types';

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
  characterImageUrl?: string;
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
  characterImageUrl = '/assets/characters/lumberjack.png',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showNotEnoughResources, setShowNotEnoughResources] = useState(false);
  const [showNoEnergy, setShowNoEnergy] = useState(false);

  // Найти текущий и следующий доступный инструмент
  const currentTool = tools.find(tool => tool.id === equippedToolId);
  const nextToolIndex = tools.findIndex(tool => tool.id === equippedToolId) + 1;
  const nextTool = nextToolIndex < tools.length ? tools[nextToolIndex] : null;

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
    
    // Останавливаем анимацию через определенное время
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, [energy, onTap, isAnimating]);

  // Клавиатурные сокращения
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleTap();
      if (e.code === 'KeyU') handleUpgrade();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap, handleUpgrade]);

  return (
    <div 
      className="h-screen w-full flex flex-col items-center justify-between py-8 px-4"
      style={{
        backgroundImage: `url(${location.background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Верхний HUD */}
      <div className="w-full flex flex-col items-center">
        <div className="bg-gray-800 bg-opacity-80 rounded-lg p-3 w-full max-w-sm flex justify-between items-center">
          <div>
            <span className="text-sm font-medium">{location.resourceName}: </span>
            <span className="text-lg font-bold">{resourceAmount}</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm mr-2">Энергия: {energy}/{maxEnergy}</span>
            <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500"
                style={{ width: `${(energy / maxEnergy) * 100}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-2 bg-gray-800 bg-opacity-80 rounded-lg p-2 w-full max-w-sm">
          <div className="flex justify-between items-center">
            <span className="text-sm">Уровень {level}</span>
            <span className="text-xs">{experience}/{nextLevelExperience} XP</span>
          </div>
          <div className="w-full h-1 bg-gray-600 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-blue-500"
              style={{ width: `${(experience / nextLevelExperience) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Центральная область с персонажем */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Персонаж (кликабельный) - используем изображение вместо canvas */}
        <motion.div 
          className={`cursor-pointer ${isAnimating ? 'animate-bounce-small' : ''}`}
          animate={isAnimating ? { scale: 0.95 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleTap}
        >
          <img 
            src={characterImageUrl} 
            alt="Персонаж"
            className="w-32 h-32 md:w-40 md:h-40"
            style={{ pointerEvents: energy <= 0 ? 'none' : 'auto' }}
          />
          <div className="text-white font-semibold text-sm mt-2">
            Нажми для рубки!
          </div>
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

      {/* Нижняя область с инструментами */}
      <div className="w-full max-w-sm">
        <div className="mb-4 bg-gray-800 bg-opacity-80 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-sm opacity-70">Текущий инструмент</div>
              <div className="font-bold">{currentTool?.name || 'Нет'}</div>
            </div>
            <div className="font-medium text-right">
              <div className="text-sm opacity-70">Сила тапа</div>
              <div>{currentTool?.power || 0} / тап</div>
            </div>
          </div>

          {nextTool ? (
            <button 
              className="upgrade-button" 
              onClick={handleUpgrade}
            >
              <span>Улучшить до: {nextTool.name}</span>
              <span>{nextTool.unlockCost} {nextTool.currencyType}</span>
            </button>
          ) : (
            <div className="text-center py-2 text-sm opacity-70">
              Максимальный уровень инструмента
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameScreen; 