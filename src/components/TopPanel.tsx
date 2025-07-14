import React, { useState, useEffect } from 'react';
import { CurrencyType } from '../types';

interface TopPanelProps {
  userName: string;
  userAvatar?: string;
  level: number;
  experience: number;
  nextLevelExperience: number;
  energy: number;
  maxEnergy: number;
  gardenCoins: number;
  locationCurrency: number;
  locationCurrencyType: CurrencyType;
  lastEnergyRefillTime: string;
  onAvatarClick?: () => void;
}

const TopPanel: React.FC<TopPanelProps> = ({
  userName,
  userAvatar,
  level,
  experience,
  nextLevelExperience,
  energy,
  maxEnergy,
  gardenCoins,
  locationCurrency,
  locationCurrencyType,
  lastEnergyRefillTime,
  onAvatarClick
}) => {
  const [secondsUntilRefill, setSecondsUntilRefill] = useState<number>(60);
  
  // Функция для получения пути к изображению валюты локации
  const getLocationCurrencyIcon = (type: CurrencyType): string => {
    switch (type) {
      case CurrencyType.FOREST:
        return '/assets/currencies/wood.png'; // Дрова для леса
      case CurrencyType.DIRT:
        return '/assets/currencies/dirt.png'; // Грязь
      case CurrencyType.WEED:
        return '/assets/currencies/weed.png'; // Сорняки
      case CurrencyType.MAIN:
        return '/assets/currencies/garden_coin.png'; // Сад-коин
      default:
        return '/assets/currencies/default.png';
    }
  };
  
  // Обновление таймера на основе времени последнего обновления с сервера
  useEffect(() => {
    // Если энергия максимальная, не нужно обновлять таймер
    if (energy >= maxEnergy) return;
    
    // Получаем время последнего обновления энергии
    const lastRefill = new Date(lastEnergyRefillTime).getTime();
    
    // Функция для расчета оставшегося времени до следующего обновления
    const updateRemainingTime = () => {
      const now = new Date().getTime();
      const timeSinceLastRefill = now - lastRefill;
      
      // Если прошло меньше минуты с последнего обновления
      if (timeSinceLastRefill < 60000) {
        // Вычисляем, сколько секунд осталось до полной минуты
        const secondsLeft = Math.ceil((60000 - timeSinceLastRefill) / 1000);
        setSecondsUntilRefill(secondsLeft);
      } else {
        // Если прошла минута или больше, показываем время до следующей полной минуты
        const secondsLeft = 60 - new Date().getSeconds();
        setSecondsUntilRefill(secondsLeft);
      }
    };
    
    // Обновляем время сразу при монтировании компонента
    updateRemainingTime();
    
    // Обновляем время каждую секунду
    const timer = setInterval(updateRemainingTime, 1000);
    
    return () => clearInterval(timer);
  }, [energy, maxEnergy, lastEnergyRefillTime]);

  // Используем дефолтную аватарку, если userAvatar пустой или undefined
  const defaultAvatar = 'https://placehold.co/50x50/png';
  const avatarSrc = userAvatar && userAvatar.trim() !== '' ? userAvatar : defaultAvatar;

  // Форматируем время для отображения
  const formatTime = (seconds: number): string => {
    return `${seconds}с`;
  };

  // Отладочная информация
  console.log(`TopPanel render - energy: ${energy}, maxEnergy: ${maxEnergy}, nextLevel: ${nextLevelExperience}`);

  return (
    <div className="top-panel rounded-xl p-3 mt-2 mx-2">
      {/* Верхняя часть с аватаром, именем, уровнем и прогрессом */}
      <div className="flex items-start mb-2">
        {/* Аватар пользователя */}
        <div 
          className="avatar mr-3 cursor-pointer" 
          onClick={onAvatarClick}
        >
          <img src={avatarSrc} alt="Аватар" className="w-full h-full object-cover" />
        </div>
        
        {/* Правая колонка: имя, уровень и шкала прогресса */}
        <div className="flex flex-col flex-grow">
          {/* Имя и уровень */}
          <div className="flex items-center justify-between mb-1">
            <span 
              className="text-white font-bold text-base cursor-pointer" 
              onClick={onAvatarClick}
            >
              {userName}
            </span>
            <span className="text-white font-medium text-xs bg-yellow-500 rounded-full px-2 py-1">Уровень {level}</span>
          </div>
          
          {/* Шкала прогресса уровня с опытом */}
          <div>
            <div className="text-white text-xs mb-0.5">
              XP: {experience}/{nextLevelExperience}
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill bg-blue-500"
                style={{ width: `${nextLevelExperience ? Math.min((experience / nextLevelExperience) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Разделительная линия */}
      <div className="divider mb-2"></div>
      
      {/* Нижняя часть с энергией и валютами */}
      <div className="flex justify-between items-center">
        {/* Энергия с таймером */}
        <div className="flex items-center">
          <img 
            src="/assets/currencies/energy.png" 
            alt="Энергия" 
            className="w-5 h-5 mr-1" 
          />
          <span className="text-white text-sm">{energy}/{maxEnergy}</span>
          {energy < maxEnergy ? (
            <span className="text-yellow-500 text-xs ml-1">+1 через {formatTime(secondsUntilRefill)}</span>
          ) : (
            <span className="text-yellow-500 text-xs ml-1">MAX</span>
          )}
        </div>
        
        {/* Валюты */}
        <div className="flex space-x-3">
          {/* Сад коины (монета с листочком) */}
          <div className="flex items-center">
            <img 
              src="/assets/currencies/garden_coin.png" 
              alt="Сад-коин" 
              className="w-5 h-5 mr-1" 
            />
            <span className="text-white text-sm">{gardenCoins.toFixed(2)}</span>
          </div>
          
          {/* Валюта локации */}
          <div className="flex items-center">
            <img 
              src={getLocationCurrencyIcon(locationCurrencyType)} 
              alt="Валюта локации" 
              className="w-5 h-5 mr-1" 
            />
            <span className="text-white text-sm">{locationCurrency.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopPanel; 