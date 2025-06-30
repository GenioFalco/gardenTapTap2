import React from 'react';

interface RankUpModalProps {
  show: boolean;
  onClose: () => void;
  rank: {
    id: number;
    name: string;
    imagePath: string;
  };
}

const RankUpModal: React.FC<RankUpModalProps> = ({ show, onClose, rank }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-xs text-center relative overflow-hidden">
        {/* Декоративные элементы */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Поздравляем!</h2>
          <p className="text-yellow-400 text-sm">Вы достигли нового ранга</p>
        </div>
        
        {/* Содержимое */}
        <div className="p-6 flex flex-col items-center">
          <div className="w-32 h-32 mb-4">
            <img 
              src={`/assets/${rank.imagePath}`} 
              alt={rank.name} 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-2xl font-bold text-yellow-400 mb-2">{rank.name}</h3>
          <p className="text-gray-300 text-sm mb-4">
            Продолжайте в том же духе!
          </p>
          
          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-full transition-colors"
          >
            Спасибо!
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankUpModal; 