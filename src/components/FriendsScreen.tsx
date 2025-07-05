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
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('Ссылка скопирована!');
  const [isInviteLoading, setIsInviteLoading] = useState(false);

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

  const handleInviteFriend = async () => {
    try {
      // Формируем ссылку на приглашение с параметром referral
      const botLink = 'https://t.me/share/url?url=https://t.me/testbotmvpBot&text=Присоединяйся к игре Garden Tap Tap!';
      
      // Открываем Telegram для выбора чатов
      window.open(botLink, '_blank');
      
      setIsInviteLoading(true);
      
      // Вызываем API для начисления монет за приглашение
      try {
        const reward = await api.rewardForInvitation();
        if (reward.success) {
          setInviteMessage(`Приглашение отправлено! +${reward.coinsAdded} монет`);
        } else {
          setInviteMessage('Приглашение отправлено!');
        }
      } catch (apiError) {
        console.error('Ошибка при начислении награды:', apiError);
        setInviteMessage('Приглашение отправлено!');
      }
      
      setIsInviteLoading(false);
      // Показываем уведомление об успехе
      setShowInviteSuccess(true);
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setShowInviteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Ошибка при отправке приглашения:', err);
      setIsInviteLoading(false);
    }
  };
  
  const handleCopyLink = async () => {
    try {
      // Сохраняем ссылку для копирования
      const botLink = 'https://t.me/testbotmvpBot';
      
      // Копируем ссылку в буфер обмена
      await navigator.clipboard.writeText(botLink);
      
      // Показываем уведомление об успешном копировании
      setInviteMessage('Ссылка скопирована!');
      setShowInviteSuccess(true);
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setShowInviteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Ошибка при копировании ссылки:', err);
    }
  };

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
        return 'bg-gray-700/40'; // Обычный фон (светлее)
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
      
      {/* Панель приглашения друзей */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gray-900/70 backdrop-blur-sm rounded-lg shadow-xl mb-4 relative z-10 overflow-hidden"
      >
        <div className="p-4">
          <h2 className="text-lg font-bold text-white mb-2">Пригласи друзей</h2>
          <p className="text-white/80 text-sm mb-3">Получи 100 монет за каждое приглашение друга в игру!</p>
          
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              {/* Кнопка приглашения через Telegram */}
              <button 
                onClick={handleInviteFriend}
                disabled={isInviteLoading}
                className={`bg-yellow-500/90 hover:bg-yellow-600 text-white font-medium py-1.5 px-4 rounded-lg shadow-md transition-all duration-200 flex items-center justify-center flex-1 ${isInviteLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isInviteLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.1 14.9l-3.2-3.2 1.4-1.4 1.8 1.8 5-5 1.4 1.4-6.4 6.4z" />
                  </svg>
                )}
                Пригласить
              </button>
              
              {/* Кнопка копирования ссылки */}
              <button 
                onClick={handleCopyLink}
                className="bg-gray-700/90 hover:bg-gray-600 text-white p-2 rounded-lg shadow-md transition-all duration-200"
                title="Скопировать ссылку"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            
            {showInviteSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-green-300 text-sm mt-2"
              >
                {inviteMessage}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
      
      <div className="w-full max-w-md bg-gray-800/60 backdrop-blur-sm rounded-lg shadow-xl relative z-10 overflow-hidden">
        <div className="bg-gray-800/70 py-4 px-4 border-b border-gray-700/50">
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
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/70 text-gray-400 text-sm">
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
                        // Запасной вариант, если путь из БД неверный
                        const rankInfo = player.rank.name.toLowerCase().split(' ');
                        let rankType = 'bronze';
                        let rankNumber = '1';
                        
                        if (rankInfo.length >= 2) {
                          // Определяем тип ранга (бронза, серебро, золото)
                          if (rankInfo[0].includes('серебро')) {
                            rankType = 'silver';
                          } else if (rankInfo[0].includes('золото')) {
                            rankType = 'gold';
                          }
                          
                          // Извлекаем номер ранга
                          if (rankInfo[1] && !isNaN(parseInt(rankInfo[1]))) {
                            rankNumber = rankInfo[1];
                          }
                        }
                        
                        const fallbackImage = `/assets/ranks/${rankType}_${rankNumber}.png`;
                        console.log(`Используем запасную иконку для ${player.rank.name}: ${fallbackImage}`);
                        (e.target as HTMLImageElement).src = fallbackImage;
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
                    <div className="bg-gray-700/90 border border-blue-400 text-white text-xs rounded-md px-2 py-1 flex items-center">
                      <span className="mr-0.5">ур.</span>
                      <span className="font-bold">{player.level}</span>
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