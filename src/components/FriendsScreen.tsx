import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as api from '../lib/api';
import { emit, AppEvent } from '../lib/events';

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

interface ReferralStats {
  sent: number;
  accepted: number;
  totalCoins: number;
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
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralStats, setReferralStats] = useState<ReferralStats>({ sent: 0, accepted: 0, totalCoins: 0 });
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [showApplyCodeForm, setShowApplyCodeForm] = useState(false);
  const [applyCodeInput, setApplyCodeInput] = useState('');
  const [applyCodeLoading, setApplyCodeLoading] = useState(false);
  const [applyCodeMessage, setApplyCodeMessage] = useState('');
  const [applyCodeSuccess, setApplyCodeSuccess] = useState(false);

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
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      setIsLoadingReferral(true);
      
      // Получаем реферальный код пользователя
      const codeResponse = await api.getReferralCode();
      if (codeResponse.success) {
        setReferralCode(codeResponse.code);
      }
      
      // Получаем статистику приглашений
      const statsResponse = await api.getReferralStats();
      if (statsResponse.success) {
        setReferralStats(statsResponse.stats);
      }
      } catch (err) {
        console.error('Ошибка при загрузке реферальных данных:', err);
    } finally {
      setIsLoadingReferral(false);
      }
    };

  const handleInviteFriend = async () => {
    try {
      // Формируем ссылку на приглашение с параметром referral
      const botLink = `https://t.me/share/url?url=https://t.me/testbotmvpBot?start=ref_${referralCode}&text=Присоединяйся к игре Garden Tap Tap! Используй мой код: ${referralCode}`;
      
      // Открываем Telegram для выбора чатов
      window.open(botLink, '_blank');
      
      setIsInviteLoading(true);
      
      // Вызываем API для отправки приглашения
      try {
        const result = await api.sendInvitation();
        if (result.success) {
          setInviteMessage('Приглашение отправлено!');
          
          // Обновляем статистику только счетчик отправленных приглашений
          setReferralStats(prev => ({
            ...prev,
            sent: prev.sent + 1
          }));
        } else {
          setInviteMessage('Ошибка при отправке приглашения');
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
      // Сохраняем ссылку для копирования с реферальным кодом
      const botLink = `https://t.me/testbotmvpBot?start=ref_${referralCode}`;
      
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
  
  const handleCopyCode = async () => {
    try {
      // Копируем код в буфер обмена
      await navigator.clipboard.writeText(referralCode);
      
      // Показываем уведомление об успешном копировании
      setInviteMessage('Код скопирован!');
      setShowInviteSuccess(true);
      
      // Скрываем уведомление через 3 секунды
      setTimeout(() => {
        setShowInviteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Ошибка при копировании кода:', err);
    }
  };
  
  const handleApplyCode = async () => {
    if (!applyCodeInput.trim()) {
      setApplyCodeMessage('Введите код');
      setApplyCodeSuccess(false);
      return;
    }
    
    try {
      setApplyCodeLoading(true);
      const response = await api.applyReferralCode(applyCodeInput.trim());
      
      if (response.success) {
        setApplyCodeMessage(response.message);
        setApplyCodeSuccess(true);
        setApplyCodeInput('');
        
        // Вызываем событие для обновления валюты
        emit(AppEvent.CURRENCY_UPDATED);
        
        // Скрываем форму через 3 секунды
        setTimeout(() => {
          setShowApplyCodeForm(false);
          setApplyCodeMessage('');
        }, 3000);
      } else {
        setApplyCodeMessage(response.message || 'Ошибка при применении кода');
        setApplyCodeSuccess(false);
      }
    } catch (err: any) {
      console.error('Ошибка при применении кода:', err);
      setApplyCodeMessage(err.message || 'Ошибка при применении кода');
      setApplyCodeSuccess(false);
    } finally {
      setApplyCodeLoading(false);
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
    <div className="h-screen w-full pt-36 mt-1 px-4 overflow-y-auto relative pb-24">
      <div className="absolute inset-0 z-0" 
        style={{backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
      
      <div className="flex flex-col items-center relative z-10">
        {/* Панель приглашения друзей */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-gray-900/70 backdrop-blur-sm rounded-lg shadow-xl mb-3 overflow-hidden"
        >
        <div className="p-3">
          <h2 className="text-base font-bold text-white mb-1">Пригласи друзей</h2>
          <p className="text-white/80 text-xs mb-2">Получи 500 монет, когда друг присоединится по твоему коду!</p>
          
          {isLoadingReferral ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-yellow-500"></div>
            </div>
          ) : (
            <>
              {/* Реферальный код */}
              <div className="bg-gray-800/80 rounded-lg p-2 mb-2 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-400">Ваш код:</div>
                  <div className="text-base font-bold text-yellow-400">{referralCode}</div>
                </div>
                <button 
                  onClick={handleCopyCode}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded-lg"
                  title="Скопировать код"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
              
              {/* Статистика приглашений */}
              <div className="grid grid-cols-3 gap-1 mb-2">
                <div className="bg-gray-800/80 rounded-lg p-1.5 text-center">
                  <div className="text-xs text-gray-400">Отправлено</div>
                  <div className="text-sm font-bold text-white">{referralStats.sent}</div>
                </div>
                <div className="bg-gray-800/80 rounded-lg p-1.5 text-center">
                  <div className="text-xs text-gray-400">Принято</div>
                  <div className="text-sm font-bold text-white">{referralStats.accepted}</div>
                </div>
                <div className="bg-gray-800/80 rounded-lg p-1.5 text-center">
                  <div className="text-xs text-gray-400">Монеты</div>
                  <div className="text-sm font-bold text-yellow-400">{referralStats.totalCoins}</div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              {/* Кнопка приглашения через Telegram */}
              <button 
                onClick={handleInviteFriend} 
                disabled={isInviteLoading}
                    className={`bg-yellow-500/90 hover:bg-yellow-600 text-white font-medium py-1 px-3 text-sm rounded-lg shadow-md transition-all duration-200 flex items-center justify-center flex-1 ${isInviteLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isInviteLoading ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                ) : (
                      <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.1 14.9l-3.2-3.2 1.4-1.4 1.8 1.8 5-5 1.4 1.4-6.4 6.4z" />
                  </svg>
                )}
                Пригласить
              </button>
              
              {/* Кнопка копирования ссылки */}
              <button 
                onClick={handleCopyLink}
                    className="bg-gray-700/90 hover:bg-gray-600 text-white p-1.5 rounded-lg shadow-md transition-all duration-200"
                title="Скопировать ссылку"
              >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            
                {/* Кнопка применения реферального кода */}
                {!showApplyCodeForm ? (
                  <button 
                    onClick={() => setShowApplyCodeForm(true)}
                    className="bg-blue-600/90 hover:bg-blue-700 text-white font-medium py-1 px-3 text-sm rounded-lg shadow-md transition-all duration-200 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Ввести код друга
                  </button>
                ) : (
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-1">
                      <input 
                        type="text" 
                        value={applyCodeInput}
                        onChange={(e) => setApplyCodeInput(e.target.value)}
                        placeholder="Введите код друга"
                        className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button 
                        onClick={handleApplyCode}
                        disabled={applyCodeLoading}
                        className={`bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 text-sm rounded-lg shadow-md transition-all duration-200 ${applyCodeLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {applyCodeLoading ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          'OK'
                        )}
                      </button>
                      <button 
                        onClick={() => setShowApplyCodeForm(false)}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-1 rounded-lg shadow-md transition-all duration-200"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
              </div>
                    {applyCodeMessage && (
                      <div className={`text-xs ${applyCodeSuccess ? 'text-green-400' : 'text-red-400'}`}>
                        {applyCodeMessage}
              </div>
                    )}
            </div>
                )}
              </div>
            </>
            )}
            
            {showInviteSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              className="text-green-300 text-xs mt-1"
              >
                {inviteMessage}
              </motion.div>
            )}
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
          <div>
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
                        <div className="text-xs text-yellow-400">{player.achievement.name}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Ранг */}
                  <div className="w-16 text-center">
                    <div className="text-sm font-medium text-white">{player.rank.name}</div>
                  </div>
                  
                  {/* Очки */}
                  <div className="w-16 text-center">
                    <div className="text-sm font-medium text-white">{player.seasonPoints}</div>
                  </div>
                  
                  {/* Уровень */}
                  <div className="w-16 text-center">
                    <div className="text-sm font-medium text-white">Ур. {player.level}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default FriendsScreen; 