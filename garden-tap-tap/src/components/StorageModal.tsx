import React, { useState, useEffect } from 'react';
import * as api from '../lib/api';
import { AppEvent, emit } from '../lib/events';

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
  const [processingCurrencyId, setProcessingCurrencyId] = useState<string | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<Record<string, UpgradeInfo>>({});
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<StorageCurrency | null>(null);
  const [paymentCurrencyAmount, setPaymentCurrencyAmount] = useState(0);
  const [paymentCurrencyIcon, setPaymentCurrencyIcon] = useState('');
  const [paymentCurrencyName, setPaymentCurrencyName] = useState('');

  useEffect(() => {
    if (show) {
      loadStorageData();
      
      // Настраиваем автоматическое обновление данных каждые 10 секунд
      const intervalId = setInterval(() => {
        loadStorageData();
        
        // Если открыто окно подтверждения улучшения, обновляем баланс монет
        if (showUpgradeConfirm) {
          api.getResourceAmount('main').then(amount => {
            setPaymentCurrencyAmount(amount);
          }).catch(err => {
            console.error('Ошибка при обновлении баланса монет:', err);
          });
        }
      }, 10000);
      
      // Очищаем интервал при закрытии модального окна
      return () => clearInterval(intervalId);
    }
  }, [show, showUpgradeConfirm]);

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
          // Пропускаем основную валюту (сад-коины)
          if ((location.currencyType as string) === 'main' || (location.currency_type as string) === 'main') {
            continue;
          }
          
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
              
              // Получаем информацию об улучшении склада
              const upgradeInfo = await api.getStorageUpgradeInfo(location.id, currencyId);
              setUpgradeInfo(prev => ({
                ...prev,
                [currencyId]: upgradeInfo
              }));
              
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
            
            // Пропускаем основную валюту
            if (currencyType === 'main') continue;
            
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
              
              // Получаем информацию об улучшении склада
              const upgradeInfo = await api.getStorageUpgradeInfo(location.id, currencyId);
              setUpgradeInfo(prev => ({
                ...prev,
                [currencyId]: upgradeInfo
              }));
              
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

  // Открыть диалог подтверждения улучшения
  const showUpgradeConfirmation = async (currency: StorageCurrency) => {
    setSelectedCurrency(currency);
    setShowUpgradeConfirm(true);
    setError(null);
    
    // Получаем текущее количество ОСНОВНОЙ валюты (монет)
    try {
      // Для улучшения всегда используется основная валюта (монеты) с типом 'main'
      const mainCurrency = await api.getCurrencyByType('main');
      if (mainCurrency && mainCurrency.id) {
        const amount = await api.getResourceAmount('main');
        setPaymentCurrencyAmount(amount);
        setPaymentCurrencyIcon(mainCurrency.image_path || '/assets/currencies/garden_coin.png');
        setPaymentCurrencyName('Монеты');
        console.log('Текущее количество монет:', amount, 'Требуется:', upgradeInfo[currency.id]?.upgradeCost);
      }
    } catch (err) {
      console.error('Ошибка при получении количества монет:', err);
    }
  };

  // Закрыть диалог подтверждения улучшения
  const closeUpgradeConfirmation = () => {
    setShowUpgradeConfirm(false);
    setSelectedCurrency(null);
  };

  // Обработчик улучшения хранилища
  const handleUpgradeStorage = async (currencyId: string, locationId: number) => {
    try {
      // Проверяем, достаточно ли монет
      const info = upgradeInfo[currencyId];
      if (info && paymentCurrencyAmount < info.upgradeCost) {
        setError(`Недостаточно монет (${paymentCurrencyAmount.toFixed(1)}/${info.upgradeCost})`);
        return;
      }
      
      setProcessingCurrencyId(currencyId);
      setError(null);
      
      const result = await api.upgradeStorage(locationId, currencyId);
      
      if (result.success) {
        // Закрываем диалог подтверждения
        setShowUpgradeConfirm(false);
        setSelectedCurrency(null);
        
        // Обновляем данные после успешного улучшения
        await loadStorageData();
        
        // Обновляем баланс монет в реальном времени
        try {
          const amount = await api.getResourceAmount('main');
          setPaymentCurrencyAmount(amount);
          
          // Вызываем событие обновления валюты
          emit(AppEvent.CURRENCY_UPDATED);
        } catch (e) {
          console.error('Ошибка при обновлении баланса монет:', e);
        }
      } else {
        setError(result.error || 'Не удалось улучшить хранилище');
        
        // Если ошибка связана с недостатком ресурсов, обновляем количество монет
        if (result.error && result.error.includes('Недостаточно ресурсов')) {
          // Обновляем количество монет
          const mainCurrency = await api.getCurrencyByType('main');
          if (mainCurrency && mainCurrency.id) {
            const amount = await api.getResourceAmount('main');
            setPaymentCurrencyAmount(amount);
            
            // Вызываем событие обновления валюты
            emit(AppEvent.CURRENCY_UPDATED);
          }
        }
      }
    } catch (err: any) {
      console.error('Ошибка при улучшении хранилища:', err);
      setError(err.message || 'Ошибка при улучшении хранилища');
      
      // Если ошибка связана с недостатком ресурсов, обновляем количество монет
      if (err.message && err.message.includes('Недостаточно ресурсов')) {
        try {
          const mainCurrency = await api.getCurrencyByType('main');
          if (mainCurrency && mainCurrency.id) {
            const amount = await api.getResourceAmount('main');
            setPaymentCurrencyAmount(amount);
            
            // Вызываем событие обновления валюты
            emit(AppEvent.CURRENCY_UPDATED);
          }
        } catch (e) {
          console.error('Ошибка при обновлении количества монет:', e);
        }
      }
    } finally {
      setProcessingCurrencyId(null);
    }
  };

  // Если модальное окно не должно отображаться, возвращаем null
  if (!show) return null;

  // Получить цвет прогресс-бара в зависимости от заполненности
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-red-500'; // Переполнено - красный
    if (percentage >= 90) return 'bg-yellow-500'; // Почти полное - желтый
    if (percentage >= 75) return 'bg-yellow-300'; // Более 75% - светло-желтый
    return 'bg-green-500'; // Меньше 75% - зеленый
  };

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
        <div className="p-3 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-white py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              Загрузка...
            </div>
          ) : currencies.length === 0 ? (
            <div className="text-center text-white py-10">
              <div className="text-5xl mb-4">📦</div>
              <p>У вас пока нет доступных ресурсов для хранения</p>
              <p className="text-sm text-gray-400 mt-2">Откройте новые локации, чтобы получить доступ к ресурсам</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currencies.map(currency => {
                const info = upgradeInfo[currency.id];
                const isMaxLevel = info ? info.currentLevel === info.nextLevel : false;
                
                return (
                  <div 
                    key={currency.id}
                    className={`rounded-lg border ${
                      currency.percentageFilled >= 100 
                        ? 'border-red-500 bg-red-900 bg-opacity-20' 
                        : 'border-gray-600 bg-gray-700'
                    } overflow-hidden shadow-md p-3`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      {/* Уровень хранилища (слева) */}
                      <div className="bg-gray-800 text-white px-2 py-1 rounded-md text-sm font-medium">
                        Ур. {currency.storageLevel}
                      </div>
                      
                      {/* Название и иконка валюты (справа) */}
                      <div className="flex items-center">
                        <span className="text-white mr-2">{currency.name}</span>
                        <img 
                          src={currency.imagePath} 
                          alt="Валюта" 
                          className="w-6 h-6 object-contain" 
                          onError={(e) => { 
                            (e.target as HTMLImageElement).src = '/assets/currencies/default.png'; 
                          }} 
                        />
                      </div>
                    </div>
                    
                    {/* Прогресс-бар и кнопка улучшения */}
                    <div className="flex items-center">
                      <div className="flex-1 mr-3">
                        <div className="text-white text-xs flex justify-between mb-1">
                          <span>{Math.floor(currency.amount * 10) / 10} / {currency.capacity}</span>
                          <span className={currency.percentageFilled >= 100 ? 'text-red-400 font-bold' : ''}>
                            {Math.round(currency.percentageFilled)}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getProgressColor(currency.percentageFilled)}`}
                            style={{ width: `${Math.min(currency.percentageFilled, 100)}%` }}
                          ></div>
                        </div>
                        {currency.percentageFilled >= 100 && (
                          <div className="text-red-400 text-xs mt-1">
                            <span className="mr-1">⚠️</span> Переполнено
                          </div>
                        )}
                      </div>
                      
                      {/* Кнопка улучшения */}
                      {info && !isMaxLevel ? (
                        <button
                          onClick={() => showUpgradeConfirmation(currency)}
                          disabled={processingCurrencyId === currency.id}
                          className={`flex items-center justify-center p-2 rounded-md w-10 h-10 ${
                            processingCurrencyId === currency.id
                              ? 'bg-gray-600 cursor-wait'
                              : 'bg-green-500 hover:bg-green-600'
                          } text-white`}
                        >
                          {processingCurrencyId === currency.id ? (
                            <span className="animate-spin text-lg">⟳</span>
                          ) : (
                            <span className="text-xl">↑</span>
                          )}
                        </button>
                      ) : info && isMaxLevel ? (
                        <div className="bg-gray-600 text-gray-300 p-1 text-xs rounded-md">
                          Макс.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Нижний колонтитул */}
        <div className="border-t border-gray-700 p-3 flex justify-end">
          <button 
            onClick={onClose} 
            className="py-1.5 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
          >
            Закрыть
          </button>
        </div>
      </div>
      
      {/* Модальное окно подтверждения улучшения */}
      {showUpgradeConfirm && selectedCurrency && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 rounded-lg max-w-[220px] w-full p-3 border border-gray-700 shadow-xl relative">
            {/* Крестик для закрытия */}
            <button 
              onClick={closeUpgradeConfirmation}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700"
            >
              ✕
            </button>
            
            <h3 className="text-white text-base font-bold mb-2 text-center">Улучшение</h3>
            
            <div className="text-center mb-3">
              <div className="flex items-center justify-center text-white mb-2">
                <span className="text-lg font-bold">{upgradeInfo[selectedCurrency.id]?.currentLevel}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="text-lg font-bold text-green-500">{upgradeInfo[selectedCurrency.id]?.nextLevel}</span>
              </div>
              
              <div className="text-gray-300 text-xs mb-2">
                Вместимость: <span className="text-white font-bold">{upgradeInfo[selectedCurrency.id]?.nextCapacity}</span>
              </div>
              
              <div className="flex items-center justify-center text-xs mb-1">
                <span className="text-gray-300">Стоимость:</span>
                <span className={`font-bold ml-1 mr-1 ${
                  paymentCurrencyAmount < upgradeInfo[selectedCurrency.id]?.upgradeCost 
                    ? 'text-red-400' 
                    : 'text-white'
                }`}>
                  {paymentCurrencyAmount.toFixed(1)} / {upgradeInfo[selectedCurrency.id]?.upgradeCost}
                </span>
                <img 
                  src={paymentCurrencyIcon} 
                  alt={paymentCurrencyName} 
                  className="w-4 h-4" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/assets/currencies/coin.png";
                  }}
                />
              </div>
              
              {/* Отображение ошибки */}
              {error && (
                <div className="text-red-400 text-xs mt-2">
                  {error.includes('Недостаточно ресурсов') ? 
                    'Недостаточно монет' : 
                    error
                  }
                </div>
              )}
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={() => handleUpgradeStorage(selectedCurrency.id, selectedCurrency.locationId)}
                disabled={processingCurrencyId === selectedCurrency.id || paymentCurrencyAmount < upgradeInfo[selectedCurrency.id]?.upgradeCost}
                className={`py-1.5 px-4 rounded-md text-sm ${
                  processingCurrencyId === selectedCurrency.id || paymentCurrencyAmount < upgradeInfo[selectedCurrency.id]?.upgradeCost
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {processingCurrencyId === selectedCurrency.id ? 'Улучшение...' : 'Прокачать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageModal; 