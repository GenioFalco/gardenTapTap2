import React, { useState, useEffect, useRef } from 'react';
import * as api from '../lib/api';
import { AppEvent, emit } from '../lib/events';
import { config } from '../config'; // Исправляем импорт config

// Интерфейс для пакетов энергии
interface EnergyPackage {
  id: number;
  name: string;
  energy_amount: number;
  price: number;
}

// Интерфейс для валюты локации
interface LocationCurrency {
  id: string;
  name: string;
  icon: string;
  exchangeRate: number; // Курс обмена на главную валюту
}

// Интерфейс для услуги
interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  currency_id: string;
  status: string;
  image_path: string;
  contact_info: string;
}

// Фиксированные пакеты энергии
const ENERGY_PACKAGES: EnergyPackage[] = [
  { id: 1, name: 'Маленький пакет', energy_amount: 10, price: 50 },
  { id: 2, name: 'Средний пакет', energy_amount: 25, price: 100 },
  { id: 3, name: 'Большой пакет', energy_amount: 50, price: 180 }
];

// Фиксированные валюты локаций (согласно реальным данным в базе)
const LOCATION_CURRENCIES: LocationCurrency[] = [
  { id: 'forest', name: 'Брёвна', icon: '/assets/currencies/wood.png', exchangeRate: 0.5 },
  { id: 'dirt', name: 'Грязь', icon: '/assets/currencies/dirt.png', exchangeRate: 0.3 },
  { id: 'weed', name: 'Сорняки', icon: '/assets/currencies/weed.png', exchangeRate: 0.2 }
];

const ExchangeScreen: React.FC = () => {
  const [coins, setCoins] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(0);
  const [maxEnergy, setMaxEnergy] = useState<number>(100);
  const [buying, setBuying] = useState<boolean>(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  
  // Состояния для обмена валют
  const [selectedCurrency, setSelectedCurrency] = useState<LocationCurrency | null>(null);
  const [exchangeAmount, setExchangeAmount] = useState<string>('');
  const [currencyBalances, setCurrencyBalances] = useState<Record<string, number>>({});
  const [exchanging, setExchanging] = useState<boolean>(false);
  
  // Состояния для услуг
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [contactInfo, setContactInfo] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  
  // Состояние для вертикального слайдера
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number>(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Загрузка данных игрока при монтировании компонента
  useEffect(() => {
    loadPlayerData();
    loadServices();
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
      
      // Загружаем балансы валют локаций
      const balances: Record<string, number> = {};
      for (const currency of LOCATION_CURRENCIES) {
        try {
          const amount = await api.getResourceAmount(currency.id);
          balances[currency.id] = amount;
        } catch (error) {
          console.error(`Ошибка при загрузке баланса валюты ${currency.id}:`, error);
          balances[currency.id] = 0;
        }
      }
      setCurrencyBalances(balances);
      
      // Устанавливаем первую валюту по умолчанию
      if (LOCATION_CURRENCIES.length > 0 && !selectedCurrency) {
        setSelectedCurrency(LOCATION_CURRENCIES[0]);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных игрока:', error);
      showMessage('Не удалось загрузить данные. Попробуйте позже.', 'error');
    }
  };

  // Функция для загрузки доступных услуг
  const loadServices = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/services`, {
        headers: {
          'x-user-id': api.getUserId()
        }
      });
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить список услуг');
      }
      
      const servicesData = await response.json();
      setServices(servicesData);
      
      // Если есть услуги, устанавливаем первую по умолчанию
      if (servicesData.length > 0) {
        setSelectedService(servicesData[0]);
      }
    } catch (error) {
      console.error('Ошибка при загрузке услуг:', error);
      showMessage('Не удалось загрузить список услуг', 'error');
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
      console.log(`Текущая энергия перед покупкой: ${energy}/${maxEnergy}`);
      
      // Отправляем запрос на сервер для покупки энергии через API
      const response = await fetch(`${config.apiUrl}/api/player/buy-energy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': api.getUserId() // Идентификатор пользователя
        },
        body: JSON.stringify({
          energyAmount: pack.energy_amount,
          price: pack.price
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось купить энергию');
      }
      
      const data = await response.json();
      console.log('Ответ сервера:', data);
      console.log(`Энергия после покупки (из ответа сервера): ${data.energy}/${data.maxEnergy}`);
      
      // Обновляем состояние на основе ответа сервера
      setCoins(data.coins);
      setEnergy(data.energy);
      
      // Отправляем событие обновления ресурсов для App.tsx
      emit(AppEvent.RESOURCES_UPDATED, {
        currencyId: 'main',
        amount: data.coins
      });
      
      // Отправляем событие обновления энергии для App.tsx
      console.log(`Отправляем событие обновления энергии: ${data.energy}/${data.maxEnergy}`);
      emit(AppEvent.ENERGY_UPDATED, {
        energy: data.energy,
        maxEnergy: data.maxEnergy,
        lastEnergyRefillTime: data.lastEnergyRefillTime
      });
      
      // Показываем сообщение об успехе
      showMessage(`+${pack.energy_amount} энергии успешно добавлено!`, 'success');
      console.log(`Покупка успешна: монеты=${data.coins}, энергия=${data.energy}/${data.maxEnergy}`);
    } catch (error: any) {
      console.error('Ошибка при покупке энергии:', error);
      showMessage(`Ошибка: ${error.message || 'Что-то пошло не так'}`, 'error');
      
      // Перезагружаем данные игрока
      await loadPlayerData();
    } finally {
      setBuying(false);
    }
  };
  
  // Функция для обмена валюты локации на главную валюту
  const exchangeCurrency = async () => {
    if (!selectedCurrency) {
      showMessage('Выберите валюту для обмена', 'error');
      return;
    }
    
    const amount = parseInt(exchangeAmount);
    if (isNaN(amount) || amount <= 0) {
      showMessage('Введите корректную сумму для обмена', 'error');
      return;
    }
    
    const currencyBalance = currencyBalances[selectedCurrency.id] || 0;
    if (currencyBalance < amount) {
      showMessage(`Недостаточно ${selectedCurrency.name} для обмена`, 'error');
      return;
    }
    
    setExchanging(true);
    try {
      // Рассчитываем сколько монет получит игрок
      const mainCoinsToReceive = Math.floor(amount * selectedCurrency.exchangeRate);
      
      console.log(`Начало обмена: ${amount} ${selectedCurrency.name} на ${mainCoinsToReceive} монет`);
      
      // 1. Сначала тратим ресурсы локации
      const spendResponse = await fetch(`${config.apiUrl}/api/player/resources/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': api.getUserId()
        },
        body: JSON.stringify({
          currencyId: selectedCurrency.id,
          amount: amount
        })
      });
      
      if (!spendResponse.ok) {
        const errorData = await spendResponse.json();
        throw new Error(errorData.error || 'Не удалось потратить ресурсы');
      }
      
      const spendData = await spendResponse.json();
      console.log('Ответ сервера (трата ресурсов):', spendData);
      
      // 2. Затем добавляем монеты
      const addResponse = await fetch(`${config.apiUrl}/api/player/resources/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': api.getUserId()
        },
        body: JSON.stringify({
          currencyId: 'main',
          amount: mainCoinsToReceive
        })
      });
      
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.error || 'Не удалось добавить монеты');
      }
      
      const addData = await addResponse.json();
      console.log('Ответ сервера (добавление монет):', addData);
      
      // Обновляем состояния на основе ответов сервера
      setCurrencyBalances(prev => ({
        ...prev,
        [selectedCurrency.id]: spendData.amount
      }));
      setCoins(addData.amount);
      
      // Отправляем события обновления ресурсов
      emit(AppEvent.RESOURCES_UPDATED, {
        currencyId: 'main',
        amount: addData.amount
      });
      
      emit(AppEvent.RESOURCES_UPDATED, {
        currencyId: selectedCurrency.id,
        amount: spendData.amount
      });
      
      // Сбрасываем поле ввода
      setExchangeAmount('');
      
      // Показываем сообщение об успехе
      showMessage(`Обмен успешно выполнен: +${mainCoinsToReceive} монет`, 'success');
      console.log(`Обмен успешен: ${amount} ${selectedCurrency.name} на ${mainCoinsToReceive} монет`);
    } catch (error: any) {
      console.error('Ошибка при обмене валюты:', error);
      showMessage(`Ошибка: ${error.message || 'Что-то пошло не так'}`, 'error');
      
      // Перезагружаем данные игрока
      await loadPlayerData();
    } finally {
      setExchanging(false);
    }
  };

  // Функция для заказа услуги
  const orderService = async () => {
    if (!selectedService) {
      showMessage('Выберите услугу для заказа', 'error');
      return;
    }
    
    if (!contactInfo.trim()) {
      showMessage('Укажите контактную информацию', 'error');
      return;
    }
    
    if (coins < selectedService.price) {
      showMessage('Недостаточно монет для заказа услуги', 'error');
      return;
    }
    
    setIsOrdering(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/services/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': api.getUserId()
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          contactInfo,
          notes: orderNotes
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось оформить заказ');
      }
      
      const data = await response.json();
      
      // Обновляем баланс монет
      setCoins(data.balance);
      
      // Отправляем событие обновления ресурсов
      emit(AppEvent.RESOURCES_UPDATED, {
        currencyId: 'main',
        amount: data.balance
      });
      
      // Сбрасываем форму
      setContactInfo('');
      setOrderNotes('');
      
      showMessage(`Заказ успешно оформлен! ID заказа: ${data.orderId}`, 'success');
    } catch (error: any) {
      console.error('Ошибка при заказе услуги:', error);
      showMessage(`Ошибка: ${error.message || 'Что-то пошло не так'}`, 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  // Функция для отображения сообщений
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };
  
  // Рассчитываем, сколько монет получит игрок при обмене
  const calculateExchangeResult = () => {
    if (!selectedCurrency || !exchangeAmount || isNaN(parseInt(exchangeAmount))) {
      return 0;
    }
    return Math.floor(parseInt(exchangeAmount) * selectedCurrency.exchangeRate);
  };

  // Функция для смены текущего блока
  const goToBlock = (index: number) => {
    setCurrentBlockIndex(index);
    
    if (sliderRef.current) {
      // Используем фиксированную высоту для скролла вместо динамического расчета
      const blockHeight = 500; // примерная высота блока в пикселях
      sliderRef.current.scrollTo({
        top: index * blockHeight,
        behavior: 'smooth'
      });
    }
  };

  // Массив блоков для слайдера
  const blocks = [
    // Блок покупки энергии
    <div key="energy" className="bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-700 w-full mb-6">
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
              <div className="w-6 h-6 flex items-center justify-center mr-1">
                <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-5 h-5" />
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
                  <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-4 h-4 mr-1" />
                  {pack.price}
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
    </div>,
      
    // Блок обмена валюты локации на главную
    <div key="exchange" className="bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-700 w-full mb-6">
        <div className="bg-gray-800 bg-opacity-90 p-2 border-b border-yellow-500">
          <h2 className="text-lg font-bold text-yellow-400 text-center">Обмен ресурсов на монеты</h2>
        </div>
        
        <div className="p-3">
          {/* Выбор валюты */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">Выберите ресурс для обмена</label>
            <select 
              value={selectedCurrency?.id || ''}
              onChange={(e) => {
                const currency = LOCATION_CURRENCIES.find(c => c.id === e.target.value);
                setSelectedCurrency(currency || null);
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-yellow-500 focus:border-yellow-500"
            >
                              {LOCATION_CURRENCIES.map(currency => (
                  <option key={currency.id} value={currency.id}>
                   {currency.name} - Баланс: {currencyBalances[currency.id] || 0}
                  </option>
                ))}
            </select>
          </div>
          
          {/* Курс обмена */}
          {selectedCurrency && (
            <div className="mb-3 bg-gray-800 p-2 rounded-md border border-gray-700">
                              <div className="text-sm text-gray-300">Курс обмена:</div>
                <div className="flex items-center justify-center">
                  <div className="flex items-center">
                    <span className="text-white font-bold mr-1">1</span>
                    <img src={selectedCurrency.icon} alt={selectedCurrency.name} className="w-4 h-4 mr-1" />
                    <span className="text-white font-bold">{selectedCurrency.name}</span>
                  </div>
                  <span className="text-gray-400 mx-2">→</span>
                  <div className="flex items-center">
                    <span className="text-yellow-400 font-bold mr-1">{selectedCurrency.exchangeRate}</span>
                    <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-4 h-4" />
                  </div>
                </div>
            </div>
          )}
          
          {/* Ввод суммы для обмена */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">Количество для обмена</label>
            <input
              type="number"
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
              placeholder="Введите количество"
              min="1"
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-yellow-500 focus:border-yellow-500"
            />
          </div>
          
          {/* Результат обмена */}
          <div className="mb-3 bg-gray-800 p-2 rounded-md border border-gray-700">
            <div className="text-sm text-gray-300">Вы получите:</div>
            <div className="flex items-center justify-center">
              <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-5 h-5 mr-2" />
              <span className="text-yellow-400 font-bold text-xl">{calculateExchangeResult()}</span>
            </div>
          </div>
          
          {/* Кнопка обмена */}
          <button
            onClick={exchangeCurrency}
            disabled={exchanging || !selectedCurrency || !exchangeAmount || isNaN(parseInt(exchangeAmount)) || parseInt(exchangeAmount) <= 0 || (currencyBalances[selectedCurrency?.id || ''] || 0) < parseInt(exchangeAmount)}
            className={`w-full py-2 px-4 rounded-md text-center font-medium transition ${
              exchanging || !selectedCurrency || !exchangeAmount || isNaN(parseInt(exchangeAmount)) || parseInt(exchangeAmount) <= 0 || (currencyBalances[selectedCurrency?.id || ''] || 0) < parseInt(exchangeAmount)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
            }`}
          >
            {exchanging ? 'Обмен...' : 'Обменять'}
          </button>
      </div>
    </div>,
    
    // Блок заказа услуг за монеты
    <div key="services" className="bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-700 w-full mb-6">
      <div className="bg-gray-800 bg-opacity-90 p-2 border-b border-yellow-500">
        <h2 className="text-lg font-bold text-yellow-400 text-center">Услуги за монеты</h2>
      </div>
      
      <div className="p-3">
        {/* Информация о балансе */}
        <div className="mb-3 bg-gray-800 p-2 rounded-md border border-gray-700 flex items-center justify-center">
          <div className="flex items-center">
            <div className="w-6 h-6 flex items-center justify-center mr-2">
              <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400">Ваш баланс:</div>
              <div className="font-bold text-white">{coins} монет</div>
            </div>
          </div>
        </div>
        
        {/* Выбор услуги */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Выберите услугу</label>
          <select 
            value={selectedService?.id || ''}
            onChange={(e) => {
              const serviceId = parseInt(e.target.value);
              const service = services.find(s => s.id === serviceId);
              setSelectedService(service || null);
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-yellow-500 focus:border-yellow-500"
          >
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} - {service.price} монет
              </option>
            ))}
          </select>
        </div>
        
        {/* Информация об услуге */}
        {selectedService && (
          <div className="mb-3 bg-gray-800 p-3 rounded-md border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-bold text-white">{selectedService.name}</h3>
              <div className="text-yellow-400 font-bold flex items-center">
                <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-4 h-4 mr-1" />
                {selectedService.price}
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-2">{selectedService.description}</p>
          </div>
        )}
        
        {/* Форма заказа */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Контактная информация *</label>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Email, телефон или другой способ связи"
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-yellow-500 focus:border-yellow-500 mb-2"
          />
          
          <label className="block text-sm font-medium text-gray-300 mb-1">Примечание к заказу</label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Дополнительная информация по заказу (необязательно)"
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-white focus:ring-yellow-500 focus:border-yellow-500 h-20"
          />
        </div>
        
        {/* Кнопка заказа */}
        <button
          onClick={orderService}
          disabled={isOrdering || !selectedService || !contactInfo.trim() || coins < (selectedService?.price || 0)}
          className={`w-full py-2 px-4 rounded-md text-center font-medium transition ${
            isOrdering || !selectedService || !contactInfo.trim() || coins < (selectedService?.price || 0)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
          }`}
        >
          {isOrdering ? 'Оформление...' : 'Заказать услугу'}
        </button>
      </div>
    </div>
  ];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center relative z-10">
      {/* Сообщения */}
      {message && (
        <div className={`p-2 rounded-lg mb-2 text-center fixed top-28 left-1/2 transform -translate-x-1/2 z-20 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}
      
      {/* Контейнер для блоков */}
      <div className="w-full">
        <div className="flex flex-col pb-4 space-y-4">
          {blocks}
        </div>
      </div>
    </div>
  );
};

export default ExchangeScreen; 