import React, { useState } from 'react';
import { Location } from '../types';
import { motion } from 'framer-motion';

interface LocationSelectorProps {
  locations: Location[];
  unlockedLocations: number[];
  activeLocationId: number;
  onSelectLocation: (locationId: number) => void;
  onTap?: () => Promise<void>; // Добавляем обработчик тапа
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  unlockedLocations,
  activeLocationId,
  onSelectLocation,
  onTap,
}) => {
  // Активная вкладка (по умолчанию "тапать")
  const [activeTab, setActiveTab] = useState<string>("tap");

  // Переключение на вкладку с локациями и выбор локации
  const handleLocationTab = () => {
    setActiveTab("locations");
  };

  // Выбор конкретной локации
  const selectLocation = (locationId: number) => {
    onSelectLocation(locationId);
    setActiveTab("tap"); // Возвращаемся на вкладку тапать после выбора локации
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 px-3 pb-1">
      {/* Основная навигационная панель */}
      <div className="rounded-xl bg-gray-800 bg-opacity-90 backdrop-blur-sm p-2">
        {activeTab === "locations" ? (
          // Показываем выбор локаций, когда активна вкладка локаций
          <div className="locations-panel py-1">
            <div className="grid grid-cols-2 gap-4">
              {locations.map((location) => {
                const isUnlocked = unlockedLocations.includes(location.id);
                const isActive = location.id === activeLocationId;
                
                return (
                  <motion.div
                    key={location.id}
                    className={`location-card p-2 rounded-lg ${
                      isActive ? 'bg-blue-700' : 'bg-gray-700'
                    } ${!isUnlocked ? 'opacity-50 grayscale' : ''}`}
                    whileTap={{ scale: isUnlocked ? 0.95 : 1 }}
                    onClick={() => isUnlocked && selectLocation(location.id)}
                  >
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 rounded-lg">
                        <span className="text-xs font-medium">{`Уровень ${location.unlockLevel}`}</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-600 mb-1 overflow-hidden">
                        <img 
                          src={location.background} 
                          alt={location.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs font-medium text-white truncate max-w-full">{location.name}</span>
                      <span className="text-xs opacity-75 text-white truncate max-w-full">{location.description}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <button 
              onClick={() => setActiveTab("tap")}
              className="w-full mt-2 py-2 bg-gray-700 rounded-lg text-white text-sm"
            >
              Назад
            </button>
          </div>
        ) : (
          // Показываем основную навигационную панель
          <div className="flex justify-around items-center py-1">
            {/* Кнопка Тапать */}
            <motion.div 
              className={`nav-button flex flex-col items-center ${activeTab === "tap" ? "text-blue-400" : "text-white"}`}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveTab("tap");
                if (onTap) onTap();
              }}
            >
              <div className={`icon-wrapper p-1.5 ${activeTab === "tap" ? "bg-blue-900" : "bg-gray-700"} rounded-full mb-0.5`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 4v16H4V4h16z M4 4l8 8 8-8 M4 20l8-8 8 8" />
                </svg>
              </div>
              <span className="text-xs">Тапать</span>
            </motion.div>
            
            {/* Кнопка Локации */}
            <motion.div 
              className={`nav-button flex flex-col items-center ${activeTab === "locations" ? "text-blue-400" : "text-white"}`}
              whileTap={{ scale: 0.95 }}
              onClick={handleLocationTab}
            >
              <div className={`icon-wrapper p-1.5 ${activeTab === "locations" ? "bg-blue-900" : "bg-gray-700"} rounded-full mb-0.5`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <span className="text-xs">Локации</span>
            </motion.div>
            
            {/* Кнопка Друзья */}
            <motion.div 
              className="nav-button flex flex-col items-center text-white"
              whileTap={{ scale: 0.95 }}
              onClick={() => alert('Функция "Друзья" в разработке')}
            >
              <div className="icon-wrapper p-1.5 bg-gray-700 rounded-full mb-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="text-xs">Друзья</span>
            </motion.div>
            
            {/* Кнопка Обмен */}
            <motion.div 
              className="nav-button flex flex-col items-center text-white"
              whileTap={{ scale: 0.95 }}
              onClick={() => alert('Функция "Обмен" в разработке')}
            >
              <div className="icon-wrapper p-1.5 bg-gray-700 rounded-full mb-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <span className="text-xs">Обмен</span>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationSelector; 