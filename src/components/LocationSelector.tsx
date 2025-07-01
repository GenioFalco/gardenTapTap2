import React from 'react';
import { Location } from '../types';
import { motion } from 'framer-motion';

interface LocationSelectorProps {
  locations: Location[];
  unlockedLocations: number[];
  activeLocationId: number;
  onSelectLocation: (locationId: number) => void;
  onTap?: () => Promise<void>; // Добавляем обработчик тапа
  activeTab: string;
  onChangeTab: (tab: string) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  unlockedLocations,
  activeLocationId,
  onSelectLocation,
  onTap,
  activeTab,
  onChangeTab,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 px-3 pb-1">
      {/* Основная навигационная панель */}
      <div className="rounded-xl bg-gray-800 bg-opacity-90 backdrop-blur-sm p-2">
        {/* Показываем основную навигационную панель */}
        <div className="flex justify-around items-center py-1">
          {/* Кнопка Тапать */}
          <motion.div 
            className={`nav-button flex flex-col items-center ${activeTab === "tap" ? "text-blue-400" : "text-white"}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              onChangeTab("tap");
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
            onClick={() => onChangeTab("locations")}
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
            className={`nav-button flex flex-col items-center ${activeTab === "friends" ? "text-blue-400" : "text-white"}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChangeTab("friends")}
          >
            <div className={`icon-wrapper p-1.5 ${activeTab === "friends" ? "bg-blue-900" : "bg-gray-700"} rounded-full mb-0.5`}>
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
            className={`nav-button flex flex-col items-center ${activeTab === "exchange" ? "text-blue-400" : "text-white"}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChangeTab("exchange")}
          >
            <div className={`icon-wrapper p-1.5 ${activeTab === "exchange" ? "bg-blue-900" : "bg-gray-700"} rounded-full mb-0.5`}>
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
      </div>
    </div>
  );
};

export default LocationSelector; 