import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onLoadComplete?: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadComplete }) => {
  const [progress, setProgress] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState<string>('');

  useEffect(() => {
    // Выбираем случайный фон из 4 доступных
    const randomBgNumber = Math.floor(Math.random() * 4) + 1;
    setBackgroundImage(`/assets/loading/loading_bg_${randomBgNumber}.jpg`);
    
    // Имитация загрузки
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 10;
      if (currentProgress > 100) {
        currentProgress = 100;
        clearInterval(interval);
        
        // Небольшая задержка перед завершением загрузки
        setTimeout(() => {
          if (onLoadComplete) {
            onLoadComplete();
          }
        }, 500);
      }
      setProgress(Math.min(currentProgress, 100));
    }, 200);
    
    return () => clearInterval(interval);
  }, [onLoadComplete]);
  
  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#000', // Запасной цвет фона
      }}
    >
      <div className="bg-black bg-opacity-50 p-8 rounded-lg flex flex-col items-center">
        <h1 className="text-4xl font-bold text-white mb-4">ЗАГРУЗКА ИГРЫ</h1>
        <p className="text-xl text-gray-300 mb-6">Запуск приложения</p>
        
        {/* Прогресс-бар */}
        <div className="w-80 h-4 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Процент загрузки */}
        <p className="text-white mt-2">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingScreen; 