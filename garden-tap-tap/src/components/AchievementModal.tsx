import React from 'react';

interface AchievementModalProps {
  show: boolean;
  onClose: () => void;
  achievement: {
    id: number;
    name: string;
    description: string;
    imagePath: string;
    rewardValue?: number;
  };
}

const AchievementModal: React.FC<AchievementModalProps> = ({ 
  show, 
  onClose, 
  achievement 
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-xs text-center relative overflow-hidden">
        {/* Декоративные элементы */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400"></div>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Новое достижение!</h2>
        </div>
        
        {/* Содержимое */}
        <div className="p-6 flex flex-col items-center">
          <div className="w-28 h-28 mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full opacity-20 animate-pulse"></div>
            <img 
              src={`/assets/${achievement.imagePath}`} 
              alt={achievement.name} 
              className="w-full h-full object-contain relative z-10"
            />
          </div>
          <h3 className="text-xl font-bold text-blue-400 mb-1">{achievement.name}</h3>
          <p className="text-gray-300 text-sm mb-3">
            {achievement.description}
          </p>
          
          {/* Награда, если есть */}
          {achievement.rewardValue && (
            <div className="bg-gray-700 rounded-lg px-4 py-2 mb-4">
              <span className="text-sm text-gray-300">Награда: </span>
              <span className="text-yellow-400 font-bold">{achievement.rewardValue} монет</span>
            </div>
          )}
          
          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full transition-colors"
          >
            Круто!
          </button>
        </div>
      </div>
    </div>
  );
};

export default AchievementModal; 