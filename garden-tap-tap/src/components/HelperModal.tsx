import React, { useState, useEffect } from 'react';
import { Helper, CurrencyType } from '../types';
import * as api from '../lib/api';

interface HelperModalProps {
  show: boolean;
  onClose: () => void;
  locationId: number;
  locationName: string;
  playerLevel: number;
  locationCurrency: number;
  locationCurrencyType: CurrencyType;
  onHelpersChanged: () => void; // Callback для обновления игрового экрана
}

const HelperModal: React.FC<HelperModalProps> = ({
  show,
  onClose,
  locationId,
  locationName,
  playerLevel,
  locationCurrency,
  locationCurrencyType,
  onHelpersChanged
}) => {
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingHelperId, setProcessingHelperId] = useState<number | null>(null);
  const [recentlyCollected, setRecentlyCollected] = useState<number | null>(null);

  useEffect(() => {
    if (show) {
      loadHelpers();
    }
  }, [show, locationId]);

  const loadHelpers = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedHelpers = await api.getHelpersByLocationId(locationId);
      setHelpers(loadedHelpers);
    } catch (error) {
      console.error('Ошибка при загрузке помощников:', error);
      setError('Не удалось загрузить помощников');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setError(null);
      await api.buyHelper(helper.id);
      await loadHelpers();
      onHelpersChanged(); // Обновляем состояние игрового экрана
    } catch (error: any) {
      console.error('Ошибка при покупке помощника:', error);
      setError(error.message || 'Ошибка при покупке помощника');
    } finally {
      setProcessingHelperId(null);
    }
  };

  const handleToggleHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setError(null);
      await api.toggleHelper(helper.id);
      await loadHelpers();
      onHelpersChanged(); // Обновляем состояние игрового экрана
    } catch (error: any) {
      console.error('Ошибка при активации/деактивации помощника:', error);
      setError(error.message || 'Ошибка при активации/деактивации помощника');
    } finally {
      setProcessingHelperId(null);
    }
  };

  const handleCollectReward = async () => {
    try {
      setError(null);
      const result = await api.collectHelpersReward();
      
      if (result.collected > 0) {
        setRecentlyCollected(result.collected);
        setTimeout(() => setRecentlyCollected(null), 3000);
      }
      
      await loadHelpers();
      onHelpersChanged(); // Обновляем состояние игрового экрана
    } catch (error: any) {
      console.error('Ошибка при сборе награды:', error);
      setError(error.message || 'Ошибка при сборе награды');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md relative">
        {/* Крестик для закрытия */}
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Помощники {locationName}</h2>
        </div>
        
        {/* Сообщение об ошибке */}
        {error && (
          <div className="bg-red-500 text-white p-2 text-center">
            {error}
          </div>
        )}
        
        {/* Кнопка сбора наград */}
        <div className="p-4 border-b border-gray-700">
          <button 
            onClick={handleCollectReward}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Собрать награду от помощников
          </button>
          
          {recentlyCollected !== null && (
            <div className="mt-2 text-center text-green-400">
              Собрано: {recentlyCollected.toFixed(2)} {locationCurrencyType}
            </div>
          )}
        </div>
        
        {/* Список помощников */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center text-white py-4">Загрузка...</div>
          ) : helpers.length === 0 ? (
            <div className="text-center text-white py-4">Помощников пока нет</div>
          ) : (
            <div>
              {helpers.map(helper => {
                const isUnlocked = helper.isUnlocked || (helper as any).is_unlocked;
                const isActive = helper.isActive || (helper as any).is_active;
                const canActivate = (helper as any).can_activate;
                const notEnoughResources = helper.unlockCost > locationCurrency;
                const isUnlockable = playerLevel >= helper.unlockLevel;
                
                return (
                  <div 
                    key={helper.id} 
                    className={`mb-4 p-3 rounded-lg ${isActive ? 'bg-gray-700' : 'bg-gray-900'}`}
                  >
                    <div className="flex items-center">
                      <img 
                        src={helper.imagePath || '/assets/helpers/default.png'} 
                        alt={helper.name} 
                        className="w-12 h-12 mr-3 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h4 className="text-white font-medium">{helper.name}</h4>
                          {isActive && (
                            <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">
                              Активен
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 text-left">
                          {helper.description}
                        </div>
                        <div className="text-sm text-green-400">
                          +{helper.incomePerHour} {helper.currencyType} в час
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      {!isUnlockable ? (
                        <div className="text-sm text-gray-400 text-center border border-gray-700 py-2 rounded">
                          Доступен с {helper.unlockLevel} уровня
                        </div>
                      ) : isUnlocked ? (
                        <button 
                          className={`w-full ${
                            isActive 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : canActivate 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'bg-gray-600'
                          } text-white py-1 px-4 rounded ${
                            processingHelperId === helper.id ? 'opacity-50 cursor-wait' : ''
                          } ${!canActivate && !isActive ? 'cursor-not-allowed' : ''}`}
                          onClick={() => handleToggleHelper(helper)}
                          disabled={processingHelperId === helper.id || (!canActivate && !isActive)}
                        >
                          {isActive ? 'Деактивировать' : 'Активировать'}
                        </button>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1 text-xs">
                            {notEnoughResources && 
                              <span className="text-red-400">Недостаточно ресурсов</span>
                            }
                          </div>
                          <button 
                            className={`w-full py-1 px-4 rounded ${
                              notEnoughResources 
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            } ${
                              processingHelperId === helper.id ? 'opacity-50 cursor-wait' : ''
                            }`}
                            onClick={() => handleBuyHelper(helper)}
                            disabled={notEnoughResources || processingHelperId === helper.id}
                          >
                            <span className="font-bold">{locationCurrency.toFixed(2)}/{helper.unlockCost}</span> {helper.currencyType}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelperModal;
