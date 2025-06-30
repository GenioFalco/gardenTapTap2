import React, { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

// ProfileModal компонент для отображения расширенного профиля игрока

interface ProfileModalProps {
  show: boolean;
  onClose: () => void;
}

interface ProfileData {
  userId: string;
  avatar: string;
  username: string;
  level: number;
  currentRank: {
    id: number;
    name: string;
    imagePath: string;
  };
  highestRank: {
    id: number;
    name: string;
    imagePath: string;
  };
  currentSeason: {
    id: number;
    name: string;
    endDate: string;
    daysLeft: number;
  };
  seasonPoints: number;
  featuredAchievement: {
    id: number;
    name: string;
    description: string;
    imagePath: string;
    dateUnlocked: string;
  } | null;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ show, onClose }) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      loadProfileData();
    }
  }, [show]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Получаем данные профиля
      const profile = await api.getPlayerProfile();
      setProfileData(profile);
    } catch (err: any) {
      console.error('Ошибка при загрузке профиля:', err);
      setError(err.message || 'Не удалось загрузить данные профиля');
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты окончания сезона
  const formatEndDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (e) {
      return 'Дата не указана';
    }
  };

  // Если модальное окно не должно отображаться, возвращаем null
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md relative">
        {/* Крестик для закрытия */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        {/* Заголовок */}
        <div className="p-3 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Профиль игрока</h2>
        </div>
        
        {/* Сообщение об ошибке */}
        {error && (
          <div className="bg-red-500 text-white p-2 text-center">
            {error}
          </div>
        )}
        
        {/* Загрузка */}
        {loading ? (
          <div className="text-center text-white py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            Загрузка профиля...
          </div>
        ) : profileData ? (
          <div className="p-4">
            {/* Основная информация */}
            <div className="flex items-center mb-6">
              <div className="w-20 h-20 rounded-full overflow-hidden mr-4 border-2 border-yellow-500">
                <img 
                  src={profileData.avatar || '/assets/avatars/default.png'} 
                  alt="Аватар" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-white text-xl font-bold">{profileData.username || 'Игрок'}</h3>
                <p className="text-gray-300">Уровень {profileData.level}</p>
              </div>
            </div>
            
            {/* Информация о ранге */}
            <div className="bg-gray-700 rounded-lg p-3 mb-4">
              <h4 className="text-white font-semibold mb-2">Ранг</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 mr-2">
                    <img 
                      src={profileData.currentRank?.imagePath ? `/assets/${profileData.currentRank.imagePath}` : '/assets/ranks/bronze_1.png'} 
                      alt="Ранг" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-white">{profileData.currentRank?.name || 'Новичок'}</span>
                </div>
                <div className="text-gray-300 text-sm">
                  Лучший: {profileData.highestRank?.name || 'Новичок'}
                </div>
              </div>
            </div>
            
            {/* Информация о сезоне */}
            {profileData.currentSeason && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <h4 className="text-white font-semibold mb-2">Текущий сезон</h4>
                <div className="mb-2">
                  <div className="text-yellow-400 text-lg font-medium">{profileData.currentSeason.name}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Очки: {profileData.seasonPoints}</span>
                    <span className="text-gray-300">До конца: {profileData.currentSeason.daysLeft} дн.</span>
                  </div>
                </div>
                <div className="text-gray-400 text-xs">
                  Завершается: {formatEndDate(profileData.currentSeason.endDate)}
                </div>
              </div>
            )}
            
            {/* Последнее достижение */}
            {profileData.featuredAchievement ? (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-semibold mb-2">Последнее достижение</h4>
                <div className="flex items-center">
                  <div className="w-12 h-12 mr-3">
                    <img 
                      src={profileData.featuredAchievement?.imagePath ? `/assets/${profileData.featuredAchievement.imagePath}` : '/assets/achievements/default.png'} 
                      alt="Достижение" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-yellow-400 font-medium">{profileData.featuredAchievement.name}</div>
                    <div className="text-gray-300 text-sm">{profileData.featuredAchievement.description}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-3 text-center">
                <h4 className="text-white font-semibold mb-2">Достижения</h4>
                <p className="text-gray-400">У вас пока нет достижений</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-white py-10">
            <p>Не удалось загрузить данные профиля</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal; 