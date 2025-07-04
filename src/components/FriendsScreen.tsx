import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as api from '../lib/api';

interface LeaderboardPlayer {
  position: number;
  userId: string;
  username: string;
  avatar: string;
  level: number;
  rank: {
    id: number;
    name: string;
    imagePath: string;
  };
  seasonPoints: number;
  totalPoints: number;
  achievement: {
    id: number;
    name: string;
  } | null;
}

interface FriendsScreenProps {
  background: string;
}

const FriendsScreen: React.FC<FriendsScreenProps> = ({ background }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await api.getLeaderboard(50);
        setLeaderboard(data);
        setError(null);
      } catch (err) {
        console.error('Ошибка при загрузке рейтинга:', err);
        setError('Не удалось загрузить рейтинг игроков');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Функция для определения цвета фона в зависимости от позиции
  const getPositionBackgroundColor = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/60 to-yellow-400/60'; // Золото
      case 2:
        return 'bg-gradient-to-r from-gray-300/60 to-gray-200/60'; // Серебро
      case 3:
        return 'bg-gradient-to-r from-amber-600/60 to-amber-500/60'; // Бронза
      default:
        return 'bg-gray-800/40'; // Обычный фон
    }
  };

  // Функция для определения цвета текста в зависимости от позиции
  const getPositionTextColor = (position: number) => {
    switch (position) {
      case 1:
        return 'text-yellow-500 font-bold'; // Золото
      case 2:
        return 'text-gray-300 font-bold'; // Серебро
      case 3:
        return 'text-amber-600 font-bold'; // Бронза
      default:
        return 'text-white'; // Обычный текст
    }
  };

  return (
    <div className="h-screen w-full pt-36 mt-1 px-4 flex flex-col items-center overflow-hidden relative">
      <div className="absolute inset-0 z-0" 
           style={{backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
      
      <div className="w-full max-w-md bg-gray-900/70 backdrop-blur-sm rounded-lg shadow-xl relative z-10 overflow-hidden">
        <div className="bg-gray-900/80 py-4 px-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-center text-white">Рейтинг игроков</h2>
        </div>
        
        {loading && (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/80 text-white p-3 rounded-md text-center m-4">
            {error}
          </div>
        )}
        
        {!loading && !error && leaderboard.length === 0 && (
          <div className="text-center text-white py-6">
            Пока никто не попал в рейтинг
          </div>
        )}
        
        {!loading && !error && leaderboard.length > 0 && (
          <div className="overflow-y-auto max-h-[calc(100vh-250px)]">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 text-gray-400 text-sm">
              <div className="w-8">#</div>
              <div className="flex-grow">Игрок</div>
              <div className="w-16 text-center">Ранг</div>
              <div className="w-16 text-center">Очки</div>
              <div className="w-16 text-center">Уровень</div>
            </div>
            
            {leaderboard.map((player) => (
              <motion.div
                key={player.userId}
                className={`${getPositionBackgroundColor(player.position)} ${player.position <= 3 ? 'border-l-4 border-yellow-500/80' : ''} mb-2 mx-2 rounded-lg overflow-hidden shadow-md backdrop-blur-sm`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: player.position * 0.05 }}
              >
                <div className="flex items-center p-3">
                  {/* Позиция */}
                  <div className={`w-8 font-bold text-lg ${player.position <= 3 ? getPositionTextColor(player.position) : 'text-white'}`}>
                    {player.position}
                  </div>
                  
                  {/* Информация об игроке */}
                  <div className="flex-grow flex items-center">
                    <div>
                      <div className="font-medium text-white">{player.username}</div>
                      {player.achievement && (
                        <div className="text-xs text-gray-300 truncate max-w-[120px]">
                          {player.achievement.name}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Ранг */}
                  <div className="w-16 flex flex-col items-center">
                    <img 
                      src={player.rank.imagePath} 
                      alt={player.rank.name} 
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/ranks/bronze_1.png';
                      }}
                    />
                    <span className="text-xs text-gray-300 mt-1 truncate max-w-[60px] text-center">{player.rank.name}</span>
                  </div>
                  
                  {/* Очки сезона */}
                  <div className="w-16 text-center">
                    <div className="text-white font-medium text-sm">{player.seasonPoints}</div>
                    <div className="text-xs text-gray-400">сезон</div>
                  </div>
                  
                  {/* Уровень */}
                  <div className="w-16 flex justify-center">
                    <div className="bg-blue-500 text-white text-sm rounded-full w-7 h-7 flex items-center justify-center">
                      {player.level}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsScreen; 