import React, { useState, useEffect } from 'react';
import * as api from '../lib/api';

interface StorageModalProps {
  show: boolean;
  onClose: () => void;
  playerLevel: number;
}

interface StorageCurrency {
  id: string;
  name: string;
  imagePath: string;
  amount: number;
  capacity: number;
  storageLevel: number;
  locationId: number;
  locationName: string;
  percentageFilled: number;
}

interface UpgradeInfo {
  currentLevel: number;
  nextLevel: number;
  currentCapacity: number;
  nextCapacity: number;
  upgradeCost: number;
  currencyType: string;
  canUpgrade: boolean;
}

// Интерфейс для валюты из API
interface ApiCurrency {
  id: string | number;
  name: string;
  image_path?: string;
  imagePath?: string;
  currency_type?: string;
}

const StorageModal: React.FC<StorageModalProps> = ({ show, onClose, playerLevel }) => {
  const [currencies, setCurrencies] = useState<StorageCurrency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeSection, setShowUpgradeSection] = useState(false);
  const [processingCurrencyId, setProcessingCurrencyId] = useState<string | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<Record<string, UpgradeInfo>>({});

  useEffect(() => {
    if (show) {
      loadStorageData();
    }
  }, [show]);

  // Функция для получения информации о хранилище
  const loadStorageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем открытые локации игрока
      const unlockedLocations = await api.getUnlockedLocations();
      console.log('Разблокированные локации:', unlockedLocations);
      
      // Получаем все валюты
      const allCurrencies = await api.getCurrencies() as unknown as ApiCurrency[];
      console.log('Все валюты:', allCurrencies);
      
      // Для каждой локации получаем информацию о хранилище
      const storageData: StorageCurrency[] = [];
      
      for (const location of unlockedLocations) {
        try {
          // Для леса (локация 1) используем валюту "forest"
          if (location.id === 1) {
            const currencyId = '1'; // ID для леса
            
            try {
              // Получаем информацию о хранилище
              const storageInfo = await api.getStorageInfo(location.id, currencyId);
              
              // Получаем текущее количество валюты у игрока
              const amount = await api.getResourceAmount(currencyId);
              
              // Находим валюту в списке всех валют
              const currency = allCurrencies.find(c => String(c.id) === currencyId);
              
              storageData.push({
                id: currencyId,
                name: currency?.name || 'Дерево',
                imagePath: currency?.imagePath || currency?.image_path || '/assets/currencies/wood.png',
                amount: amount,
                capacity: storageInfo.capacity,
                storageLevel: storageInfo.storage_level,
                locationId: location.id,
                locationName: location.name,
                percentageFilled: (amount / storageInfo.capacity) * 100
              });
            } catch (err) {
              console.error('Ошибка при загрузке данных для леса:', err);
            }
          }
          // Для других локаций используем их валюты
          else if (location.currencyType || location.currency_type) {
            const currencyType = (location.currencyType || location.currency_type || '').toLowerCase();
            
            // Карта соответствия типов валют и их ID
            const currencyMap: Record<string, string> = {
              'forest': '1',
              'garden': '2',
              'winter': '3',
              'mountain': '4',
              'main': '5',
              'desert': '6',
              'lake': '7'
            };
            
            const currencyId = currencyMap[currencyType] || currencyType;
            
            try {
              // Получаем информацию о хранилище
              const storageInfo = await api.getStorageInfo(location.id, currencyId);
              
              // Получаем текущее количество валюты у игрока
              const amount = await api.getResourceAmount(currencyId);
              
              // Находим валюту в списке всех валют
              const currency = allCurrencies.find(c => 
                String(c.id) === currencyId || c.currency_type === currencyType
              );
              
              storageData.push({
                id: currencyId,
                name: currency?.name || `Валюта ${currencyType}`,
                imagePath: currency?.imagePath || currency?.image_path || '/assets/currencies/default.png',
                amount: amount,
                capacity: storageInfo.capacity,
                storageLevel: storageInfo.storage_level,
                locationId: location.id,
                locationName: location.name,
                percentageFilled: (amount / storageInfo.capacity) * 100
              });
            } catch (err) {
              console.error(`Ошибка при загрузке данных для валюты ${currencyType}:`, err);
            }
          }
        } catch (err) {
          console.error(`Ошибка при обработке локации ${location.id}:`, err);
        }
      }
      
      setCurrencies(storageData);
    } catch (err) {
      console.error('Ошибка при загрузке данных склада:', err);
      setError('Не удалось загрузить информацию о складе');
    } finally {
      setLoading(false);
    }
  };

  const loadUpgradeInfo = async (currencyId: string, locationId: number) => {
    try {
      const info = await api.getStorageUpgradeInfo(locationId, currencyId);
      if (info) {
        setUpgradeInfo(prev => ({
          ...prev,
          [currencyId]: info
        }));
      }
    } catch (err) {
      console.error(`Ошибка при загрузке информации об улучшении для валюты ${currencyId}:`, err);
    }
  };

  const handleUpgradeStorage = async (currencyId: string, locationId: number) => {
    try {
      setProcessingCurrencyId(currencyId);
      setError(null);
      
      const result = await api.upgradeStorage(locationId, currencyId);
      
      if (result.success) {
        // Обновляем данные после успешного улучшения
        await loadStorageData();
        
        // Обновляем информацию об улучшении
        await loadUpgradeInfo(currencyId, locationId);
      } else {
        setError(result.error || 'Не удалось улучшить хранилище');
      }
    } catch (err: any) {
      console.error('Ошибка при улучшении хранилища:', err);
      setError(err.message || 'Ошибка при улучшении хранилища');
    } finally {
      setProcessingCurrencyId(null);
    }
  };

  const toggleUpgradeSection = async () => {
    const newState = !showUpgradeSection;
    setShowUpgradeSection(newState);
    
    // Если открываем раздел улучшений, загружаем информацию для всех валют
    if (newState) {
      for (const currency of currencies) {
        await loadUpgradeInfo(currency.id, currency.locationId);
      }
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
          className="absolute top-2 right-2 text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Склад</h2>
          <p className="text-gray-400 text-sm">Управление ресурсами и хранилищем</p>
        </div>
        
        {/* Сообщение об ошибке */}
        {error && (
          <div className="bg-red-500 text-white p-2 text-center">
            {error}
          </div>
        )}
        
        {/* Список валют */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center text-white py-4">Загрузка...</div>
          ) : currencies.length === 0 ? (
            <div className="text-center text-white py-4">У вас пока нет ресурсов</div>
          ) : (
            <div className="space-y-3">
              {currencies.map(currency => (
                <div 
                  key={currency.id}
                  className={`p-3 rounded-lg ${
                    currency.percentageFilled >= 100 
                      ? 'bg-red-900 bg-opacity-40' 
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center mb-1">
                    <img 
                      src={currency.imagePath} 
                      alt={currency.name} 
                      className="w-8 h-8 mr-2 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.src = '/assets/currencies/default.png';
                      }}
                    />
                    <div className="flex-1">
                      <div className="text-sm text-white">{currency.name}</div>
                      <div className="text-xs text-gray-300">{currency.locationName}</div>
                    </div>
                    {currency.percentageFilled >= 100 && (
                      <div className="text-yellow-500 text-xl ml-2" title="Хранилище заполнено">
                        ⚠️
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-white mb-1">
                      <span>Уровень: {currency.storageLevel}</span>
                      <span>{Math.floor(currency.amount)} / {currency.capacity}</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          currency.percentageFilled >= 100 
                            ? 'bg-red-500' 
                            : currency.percentageFilled > 80 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, currency.percentageFilled)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Секция улучшения (если открыта) */}
                  {showUpgradeSection && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      {upgradeInfo[currency.id] ? (
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-300">
                            <div>Следующий уровень: {upgradeInfo[currency.id].nextLevel}</div>
                            <div>Новая вместимость: {upgradeInfo[currency.id].nextCapacity}</div>
                            <div>Стоимость: {upgradeInfo[currency.id].upgradeCost} сад-коинов</div>
                          </div>
                          <button
                            onClick={() => handleUpgradeStorage(currency.id, currency.locationId)}
                            disabled={!upgradeInfo[currency.id].canUpgrade || processingCurrencyId === currency.id}
                            className={`px-3 py-1 text-xs rounded ${
                              upgradeInfo[currency.id].canUpgrade && processingCurrencyId !== currency.id
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {processingCurrencyId === currency.id ? 'Улучшение...' : 'Улучшить'}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 text-center">
                          Загрузка информации...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Кнопка для отображения/скрытия секции улучшения */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={toggleUpgradeSection}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showUpgradeSection ? 'Скрыть улучшения' : 'Показать улучшения'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageModal; 