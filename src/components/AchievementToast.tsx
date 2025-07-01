import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../lib/api';

interface AchievementToastProps {
  onClose?: () => void;
}

interface AchievementCongratulation {
  id: number;
  achievement_id: number;
  achievement_name: string;
  achievement_description: string;
  image_path: string;
  shown: boolean;
}

const AchievementToast: React.FC<AchievementToastProps> = ({ onClose }) => {
  const [congratulations, setCongratulations] = useState<AchievementCongratulation[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  
  // Загрузка поздравлений при монтировании компонента
  useEffect(() => {
    const fetchCongratulations = async () => {
      try {
        const data = await api.getAchievementCongratulations();
        console.log('Получены поздравления с достижениями:', data);
        
        if (data && data.length > 0) {
          setCongratulations(data);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Ошибка при загрузке поздравлений:', error);
      }
    };
    
    fetchCongratulations();
    
    // Периодически проверяем новые поздравления
    const intervalId = setInterval(fetchCongratulations, 30000); // Каждые 30 секунд
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Отметка поздравления как показанного
  const markAsShown = async (id: number) => {
    try {
      await api.markAchievementCongratulationAsShown(id);
    } catch (error) {
      console.error('Ошибка при отметке поздравления как показанного:', error);
    }
  };
  
  // Обработка закрытия текущего поздравления
  const handleClose = async () => {
    if (congratulations.length > 0) {
      const currentCongratulation = congratulations[currentIndex];
      
      // Анимация скрытия
      setIsVisible(false);
      
      // Ждем завершения анимации
      setTimeout(async () => {
        // Отмечаем как показанное
        await markAsShown(currentCongratulation.id);
        
        // Переходим к следующему поздравлению или закрываем
        if (currentIndex < congratulations.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setIsVisible(true);
        } else {
          // Все поздравления показаны
          setCongratulations([]);
          if (onClose) {
            onClose();
          }
        }
      }, 300); // Время анимации
    }
  };
  
  // Если нет поздравлений, ничего не показываем
  if (congratulations.length === 0) {
    return null;
  }
  
  // Текущее поздравление
  const currentCongratulation = congratulations[currentIndex];
  
  return (
    <AnimatePresence>
      {isVisible && currentCongratulation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-800 rounded-lg w-full max-w-xs text-center relative overflow-hidden m-4"
          >
            {/* Декоративные элементы */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            
            {/* Заголовок */}
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Новое достижение!</h2>
            </div>
            
            {/* Содержимое */}
            <div className="p-6 flex flex-col items-center">
              <div className="w-28 h-28 mb-4 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full opacity-20 animate-pulse"></div>
                <img 
                  src={`/assets/${currentCongratulation.image_path}`} 
                  alt={currentCongratulation.achievement_name}
                  className="w-full h-full object-contain relative z-10"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = '<div class="text-4xl">🏆</div>';
                  }}
                />
              </div>
              <h3 className="text-xl font-bold text-yellow-400 mb-1">
                {currentCongratulation.achievement_name}
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                {currentCongratulation.achievement_description}
              </p>
              
              {/* Кнопка закрытия */}
              <button
                onClick={handleClose}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-full transition-colors"
              >
                Отлично!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementToast; 