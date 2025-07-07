import React, { useState, useEffect } from 'react';
import * as api from '../lib/api';
import { AppEvent, emit } from '../lib/events';

// Интерфейс для пакетов энергии
interface EnergyPackage {
  id: number;
  name: string;
  energy_amount: number;
  price: number;
}

// Фиксированные пакеты энергии
const ENERGY_PACKAGES: EnergyPackage[] = [
  { id: 1, name: 'Маленький пакет', energy_amount: 10, price: 50 },
  { id: 2, name: 'Средний пакет', energy_amount: 25, price: 100 },
  { id: 3, name: 'Большой пакет', energy_amount: 50, price: 180 }
];

const ExchangeScreen: React.FC = () => {
  const [coins, setCoins] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(0);
  const [maxEnergy, setMaxEnergy] = useState<number>(100);
  const [buying, setBuying] = useState<boolean>(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Загрузка данных игрока при монтировании компонента
  useEffect(() => {
    loadPlayerData();
  }, []);

  // Функция для загрузки данных игрока
  const loadPlayerData = async () => {
    try {
      // Загружаем количество монет
      const userCoins = await api.getResourceAmount('main');
      console.log('Текущее количество монет:', userCoins);
      setCoins(userCoins);
      
      // Загружаем текущий прогресс игрока для получения энергии
      const progress = await api.getPlayerProgress();
      console.log('Текущий прогресс игрока:', progress);
      setEnergy(progress.energy);
      setMaxEnergy(progress.maxEnergy);
    } catch (error) {
      console.error('Ошибка при загрузке данных игрока:', error);
      showMessage('Не удалось загрузить данные. Попробуйте позже.', 'error');
    }
  };

  // Функция для покупки энергии
  const buyEnergy = async (pack: EnergyPackage) => {
    // Проверяем достаточно ли монет
    if (coins < pack.price) {
      showMessage('Недостаточно монет для покупки', 'error');
      return;
    }
    
    // Проверяем не превысит ли энергия максимум
    if (energy >= maxEnergy) {
      showMessage('У вас уже максимальное количество энергии', 'error');
      return;
    }
    
    setBuying(true);
    try {
      console.log(`Покупка пакета энергии: ${pack.name}, цена: ${pack.price}, энергия: +${pack.energy_amount}`);
      
      // Обновляем локальное состояние монет и энергии
      const newCoins = coins - pack.price;
      const newEnergy = Math.min(energy + pack.energy_amount, maxEnergy);
      
      // Обновляем состояние
      setCoins(newCoins);
      setEnergy(newEnergy);
      
      // Отправляем событие обновления ресурсов для App.tsx
      emit(AppEvent.RESOURCES_UPDATED, {
        currencyId: 'main',
        amount: newCoins
      });
      
      // Отправляем событие обновления энергии для App.tsx
      emit(AppEvent.ENERGY_UPDATED, {
        energy: newEnergy,
        maxEnergy: maxEnergy
      });
      
      // Показываем сообщение об успехе
      showMessage(`+${pack.energy_amount} энергии успешно добавлено!`, 'success');
      console.log(`Покупка успешна: монеты=${newCoins}, энергия=${newEnergy}/${maxEnergy}`);
    } catch (error: any) {
      console.error('Ошибка при покупке энергии:', error);
      showMessage(`Ошибка: ${error.message || 'Что-то пошло не так'}`, 'error');
      
      // Перезагружаем данные игрока
      await loadPlayerData();
    } finally {
      setBuying(false);
    }
  };

  // Функция для отображения сообщений
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="w-full max-w-md">
      {/* Сообщения */}
      {message && (
        <div className={`p-2 rounded-lg mb-2 text-center absolute top-28 left-1/2 transform -translate-x-1/2 z-20 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}
      
      {/* Блок покупки энергии */}
      <div className="bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-800 bg-opacity-90 p-2 border-b border-yellow-500">
          <h2 className="text-lg font-bold text-yellow-400 text-center">Пополнить энергию</h2>
        </div>
        
        <div className="p-3">
          {/* Статус энергии и монет */}
          <div className="flex justify-between mb-3">
            <div className="flex items-center bg-gray-800 p-1.5 rounded-md border border-gray-700">
              <div className="w-6 h-6 flex items-center justify-center bg-yellow-500 text-white rounded-full mr-1">
                ⚡
              </div>
              <div>
                <div className="text-xs text-gray-400">Энергия</div>
                <div className="font-bold text-white">{energy} / {maxEnergy}</div>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-800 p-1.5 rounded-md border border-gray-700">
              <div className="w-6 h-6 flex items-center justify-center bg-yellow-500 text-white rounded-full mr-1">
                🪙
              </div>
              <div>
                <div className="text-xs text-gray-400">Монеты</div>
                <div className="font-bold text-white">{coins}</div>
              </div>
            </div>
          </div>
          
          {/* Пакеты энергии */}
          <div className="grid grid-cols-3 gap-2">
            {ENERGY_PACKAGES.map((pack) => (
              <div key={pack.id} className="border border-gray-700 rounded-lg p-2 hover:shadow-md transition-shadow bg-gray-800 bg-opacity-90">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-yellow-400 text-xl">
                    ⚡
                  </div>
                </div>
                <h3 className="text-sm font-medium text-center text-white">{pack.name}</h3>
                <div className="text-yellow-400 font-bold text-center my-1">+{pack.energy_amount}</div>
                <div className="text-center text-yellow-500 font-bold mb-2 flex items-center justify-center">
                  {pack.price} <span className="ml-1">🪙</span>
                </div>
                <button
                  onClick={() => buyEnergy(pack)}
                  disabled={buying || coins < pack.price || energy >= maxEnergy}
                  className={`w-full py-1 px-2 rounded-md text-center text-sm transition ${
                    buying || coins < pack.price || energy >= maxEnergy
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                  }`}
                >
                  {buying ? 'Покупка...' : 'Купить'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeScreen; 