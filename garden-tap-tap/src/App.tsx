import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import GameScreen from './components/GameScreen';
import LocationSelector from './components/LocationSelector';
import TopPanel from './components/TopPanel';
import * as api from './lib/api';
import { Location, Tool, PlayerProgress, CurrencyType } from './types';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number>(1);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress | null>(null);
  const [resourceAmount, setResourceAmount] = useState<number>(0);
  const [nextLevelExp, setNextLevelExp] = useState<number>(0);
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [gardenCoins, setGardenCoins] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("tap");
  
  // Генерация случайного имени пользователя, если не удалось получить из Telegram
  const generateRandomUserName = () => {
    return `user${Math.floor(Math.random() * 100000)}`;
  };
  
  // Инициализация приложения и загрузка начальных данных
  useEffect(() => {
    const initApp = async () => {
      try {
        // Получаем все локации
        const allLocations = await api.getLocations();
        const locationsWithPlaceholders = allLocations.map(location => ({
          ...location,
          // Используем путь из базы данных или значение по умолчанию
          background: location.background || '/assets/backgrounds/default.jpg',
        }));
        
        setLocations(locationsWithPlaceholders);
        
        // Получаем прогресс игрока
        const progress = await api.getPlayerProgress();
        console.log('Player progress in App.tsx:', progress);
        setPlayerProgress(progress);
        
        // Устанавливаем текущую локацию
        const defaultLocation = locationsWithPlaceholders.find(loc => loc.id === 1) || locationsWithPlaceholders[0];
        setCurrentLocation(defaultLocation);
        setCurrentLocationId(defaultLocation.id);
        
        // Проверяем, что characterId определен
        if (defaultLocation.characterId) {
          // Получаем инструменты для текущей локации с подстановкой изображений
          const locationTools = await api.getToolsByCharacterId(defaultLocation.characterId);
          console.log('Получены инструменты для локации:', locationTools);
          
          const toolsWithImages = locationTools.map((tool: Tool) => {
            // Используем imagePath из API, если он есть, иначе генерируем путь на основе имени
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            
            // Обеспечиваем совместимость полей в разных форматах
            return { 
              ...tool, 
              imagePath,
              // Если поля в camelCase отсутствуют, но есть в snake_case, копируем их
              mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
              locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
              // Убедимся, что обязательные поля всегда определены
              main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
              location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
            };
          });
          
          setTools(toolsWithImages as Tool[]);
        } else {
          console.warn('characterId не определен для локации по умолчанию:', defaultLocation);
          setTools([]);
        }
        
        // Получаем количество ресурсов для локации
        const currencyIdentifier = defaultLocation.currencyType || defaultLocation.currencyId;
        if (currencyIdentifier) {
          const resources = await api.getResourceAmount(currencyIdentifier);
          setResourceAmount(resources);
        } else {
          setResourceAmount(0);
        }
        
        // Получаем информацию о следующем уровне
        const nextLevel = await api.getLevelInfo(progress.level + 1);
        console.log('Next level info in App.tsx:', nextLevel);
        setNextLevelExp(nextLevel.requiredExp);
        
        // Получаем сад-коины (основная валюта)
        const coins = await api.getResourceAmount(CurrencyType.MAIN);
        setGardenCoins(coins);
        
        setInitialized(true);
      } catch (error) {
        console.error('Ошибка при инициализации:', error);
      }
    };
    
    initApp();
  }, []);
  
  // Функция для получения пути к изображению инструмента
  const getToolImagePath = (toolName: string): string => {
    // Преобразуем имя инструмента в нижний регистр и удаляем пробелы для формирования имени файла
    const fileName = toolName.toLowerCase().replace(/\s+/g, '_');
    return `/assets/tools/${fileName}.png`;
  };
  
  // При изменении текущей локации подгружаем связанные данные
  useEffect(() => {
    const loadLocationData = async () => {
      if (!currentLocation || !initialized) return;
      
      try {
        // Проверяем, что characterId определен
        if (currentLocation.characterId) {
          // Получаем инструменты для текущей локации с подстановкой изображений
          const locationTools = await api.getToolsByCharacterId(currentLocation.characterId);
          const toolsWithImages = locationTools.map((tool: Tool) => {
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            
            // Обеспечиваем совместимость полей в разных форматах
            return { 
              ...tool, 
              imagePath,
              // Если поля в camelCase отсутствуют, но есть в snake_case, копируем их
              mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
              locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
              // Убедимся, что обязательные поля всегда определены
              main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
              location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
            };
          });
          
          setTools(toolsWithImages as Tool[]);
        } else {
          console.warn('characterId не определен для текущей локации:', currentLocation);
          setTools([]);
        }
        
        // Проверяем, что currencyType или currencyId определены
        const currencyIdentifier = currentLocation.currencyType || currentLocation.currencyId;
        if (currencyIdentifier) {
          // Получаем количество ресурсов
          const resources = await api.getResourceAmount(currencyIdentifier);
          setResourceAmount(resources);
        } else {
          console.warn('currencyType и currencyId не определены для текущей локации:', currentLocation);
          setResourceAmount(0);
        }
        
        // Получаем сад-коины при смене локации
        const coins = await api.getResourceAmount(CurrencyType.MAIN);
        setGardenCoins(coins);
      } catch (error) {
        console.error('Ошибка при загрузке данных локации:', error);
      }
    };
    
    loadLocationData();
  }, [currentLocation, initialized]);
  
  // Инициализация Telegram WebApp SDK
  useEffect(() => {
    // Проверяем, находимся ли мы в Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Инициализируем WebApp
      tg.expand(); // Разворачиваем на весь экран
      tg.enableClosingConfirmation(); // Просим подтвердить закрытие
      
      // Устанавливаем цвет темы (опционально)
      tg.setHeaderColor('#000000');
      tg.setBackgroundColor('#1e1e1e');
      
      // Получаем данные пользователя
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setUserName(user.username || `${user.first_name} ${user.last_name || ''}`);
        if (user.photo_url) {
          setUserAvatar(user.photo_url);
        }
      } else {
        // Если не удалось получить данные из Telegram, генерируем случайное имя
        setUserName(generateRandomUserName());
      }
      
      // Активируем приложение
      tg.ready();
    } else {
      // Для разработки вне Telegram
      setUserName(generateRandomUserName());
    }
  }, []);
  
  // Функция для обновления энергии, которая будет передаваться в API
  const updateEnergy = useCallback(async (newEnergy: number) => {
    if (playerProgress) {
      try {
        console.log(`Updating energy: ${playerProgress.energy} -> ${newEnergy}, maxEnergy: ${playerProgress.maxEnergy}`);
        
        // Вызываем API для обновления энергии на сервере
        const result = await api.updatePlayerEnergy(newEnergy);
        console.log('Energy update result:', result);
        
        // Обновляем локальное состояние с учетом значений из базы данных
        setPlayerProgress(prev => {
          if (!prev) return prev;
          
          const updated = {
            ...prev,
            energy: result.energy,
            maxEnergy: result.maxEnergy
          };
          
          console.log('Updated player progress:', updated);
          return updated;
        });
        
        // Возвращаем результат для использования в других функциях
        return result;
      } catch (error) {
        console.error('Ошибка при обновлении энергии:', error);
        throw error;
      }
    }
    
    // Если playerProgress не определен, возвращаем пустой результат
    return {
      success: false,
      energy: 0,
      maxEnergy: 0,
      lastEnergyRefillTime: new Date().toISOString()
    };
  }, [playerProgress]);
  
  // Восстановление энергии при старте и каждую минуту
  useEffect(() => {
    if (!playerProgress) return;
    
    // Получаем время последнего обновления энергии из базы данных
    const lastRefillTime = new Date(playerProgress.lastEnergyRefillTime).getTime();
    const currentTime = new Date().getTime();
    
    // Вычисляем, сколько полных минут прошло с момента последнего обновления
    const minutesPassed = Math.floor((currentTime - lastRefillTime) / (60 * 1000));
    
    console.log(`Последнее обновление энергии: ${new Date(lastRefillTime).toLocaleTimeString()}`);
    console.log(`Прошло минут с последнего обновления: ${minutesPassed}`);
    console.log(`Текущая энергия: ${playerProgress.energy}, максимальная: ${playerProgress.maxEnergy}`);
    
    // Если прошло время с момента последнего обновления и энергия не максимальная
    if (minutesPassed > 0 && playerProgress.energy < playerProgress.maxEnergy) {
      // Рассчитываем новое значение энергии (но не больше максимальной)
      const newEnergy = Math.min(
        playerProgress.energy + minutesPassed,
        playerProgress.maxEnergy
      );
      
      console.log(`Восстановление энергии при запуске: ${playerProgress.energy} -> ${newEnergy}`);
      
      // Обновляем энергию на сервере через API
      updateEnergy(newEnergy);
    }
    
    // Рассчитываем, сколько миллисекунд осталось до следующего обновления энергии
    // Если не прошла минута с последнего обновления, ждем до истечения минуты
    // Иначе ждем до следующей полной минуты
    let msUntilNextRefill;
    
    if (minutesPassed === 0) {
      // Если с момента последнего обновления не прошло ни одной полной минуты,
      // вычисляем, сколько осталось до полной минуты
      msUntilNextRefill = 60 * 1000 - (currentTime - lastRefillTime);
    } else {
      // Если прошла хотя бы одна минута, ждем до начала следующей минуты
      const now = new Date();
      msUntilNextRefill = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    }
    
    console.log(`Миллисекунд до следующего обновления энергии: ${msUntilNextRefill}`);
    
    // Создаем таймер, который сработает в нужное время
    const initialRefillTimer = setTimeout(async () => {
      console.log(`Таймер восстановления энергии сработал в ${new Date().toLocaleTimeString()}`);
      
      try {
        // Получаем актуальный прогресс перед обновлением
        const currentProgress = await api.getPlayerProgress();
        
        // Обновляем энергию, если она не максимальная
        if (currentProgress.energy < currentProgress.maxEnergy) {
          console.log(`Попытка восстановить энергию: ${currentProgress.energy} -> ${currentProgress.energy + 1}`);
          const result = await updateEnergy(currentProgress.energy + 1);
          
          if (!result.success) {
            console.warn('Не удалось восстановить энергию, возможно, слишком рано');
            // Пересчитываем время до следующего восстановления
            if (result.timeUntilRefill) {
              msUntilNextRefill = result.timeUntilRefill;
              console.log(`Новое время до следующего восстановления: ${msUntilNextRefill}мс`);
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при восстановлении энергии:', error);
      }
      
      // Настраиваем регулярный таймер для восстановления энергии каждую минуту
      const minuteRefillTimer = setInterval(async () => {
        console.log(`Регулярный таймер восстановления сработал в ${new Date().toLocaleTimeString()}`);
        
        try {
          // Получаем актуальный прогресс перед обновлением
          const currentProgress = await api.getPlayerProgress();
          
          if (currentProgress.energy < currentProgress.maxEnergy) {
            console.log(`Попытка восстановить энергию: ${currentProgress.energy} -> ${currentProgress.energy + 1}`);
            await updateEnergy(currentProgress.energy + 1);
          }
        } catch (error) {
          console.error('Ошибка при восстановлении энергии:', error);
        }
      }, 60 * 1000); // Каждую минуту
      
      return () => clearInterval(minuteRefillTimer);
    }, msUntilNextRefill);
    
    return () => clearTimeout(initialRefillTimer);
  }, [playerProgress, updateEnergy]);
  
  // Обработка тапа (основная механика)
  const handleTap = async () => {
    if (!currentLocation || !playerProgress) return;
    
    try {
      // Вызываем функцию тапа
      const tapResult = await api.tap(currentLocation.id);
      
      // Обновляем данные на интерфейсе
      const currencyIdentifier = currentLocation.currencyType || currentLocation.currencyId;
      if (currencyIdentifier) {
        const newResourceAmount = await api.getResourceAmount(currencyIdentifier);
        setResourceAmount(newResourceAmount);
      }
      
      // Обновляем прогресс
      const progress = await api.getPlayerProgress();
      setPlayerProgress(progress);
      
      // Если уровень повысился, обновляем данные о следующем уровне
      if (tapResult.levelUp) {
        const nextLevel = await api.getLevelInfo(progress.level + 1);
        setNextLevelExp(nextLevel.requiredExp);
        
        // Могут быть разблокированы новые инструменты или локации
        const allLocations = await api.getLocations();
        const locationsWithPlaceholders = allLocations.map((location: Location) => ({
          ...location,
          background: location.background || '/assets/backgrounds/default.jpg',
        }));
        
        setLocations(locationsWithPlaceholders);
        
        if (currentLocation.characterId) {
          const locationTools = await api.getToolsByCharacterId(currentLocation.characterId);
          const toolsWithImages = locationTools.map((tool: Tool) => {
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            
            // Обеспечиваем совместимость полей в разных форматах
            return { 
              ...tool, 
              imagePath,
              // Если поля в camelCase отсутствуют, но есть в snake_case, копируем их
              mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
              locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
              // Убедимся, что обязательные поля всегда определены
              main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
              location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
            };
          });
          
          setTools(toolsWithImages as Tool[]);
        }
      }
      
      // Обновляем сад-коины
      const coins = await api.getResourceAmount(CurrencyType.MAIN);
      setGardenCoins(coins);
    } catch (error) {
      console.error('Ошибка при тапе:', error);
    }
  };
  
  // Улучшение инструмента
  const handleUpgrade = async (toolId: number): Promise<boolean> => {
    try {
      // Вызываем функцию улучшения
      const success = await api.upgradeTool(toolId);
      
      if (success) {
        // Обновляем количество ресурсов
        const currencyIdentifier = currentLocation?.currencyType || currentLocation?.currencyId;
        if (currencyIdentifier) {
          const newResourceAmount = await api.getResourceAmount(currencyIdentifier);
          setResourceAmount(newResourceAmount);
        }
        
        // Обновляем список инструментов и прогресс
        const progress = await api.getPlayerProgress();
        setPlayerProgress(progress);
        
        // Проверяем, разблокирован ли инструмент
        if (currentLocation?.characterId && progress.unlockedTools.includes(toolId)) {
          await api.equipTool(currentLocation.characterId, toolId);
          
          // Получаем обновленный список инструментов
          const locationTools = await api.getToolsByCharacterId(currentLocation.characterId);
          const toolsWithImages = locationTools.map((tool: Tool) => {
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            
            // Обеспечиваем совместимость полей в разных форматах
            return { 
              ...tool, 
              imagePath,
              // Если поля в camelCase отсутствуют, но есть в snake_case, копируем их
              mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
              locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
              // Убедимся, что обязательные поля всегда определены
              main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
              location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
            };
          });
          
          setTools(toolsWithImages as Tool[]);
        }
        
        // Обновляем сад-коины
        const coins = await api.getResourceAmount(CurrencyType.MAIN);
        setGardenCoins(coins);
      }
      
      return success;
    } catch (error) {
      console.error('Ошибка при улучшении инструмента:', error);
      return false;
    }
  };
  
  // Обработка смены локации
  const handleLocationChange = async (locationId: number) => {
    const selectedLocation = locations.find(loc => loc.id === locationId);
    if (selectedLocation) {
      setCurrentLocation(selectedLocation);
      setCurrentLocationId(selectedLocation.id);
      
      try {
        // Проверяем, что characterId определен
        if (selectedLocation.characterId) {
          // Получаем инструменты для новой локации
          const locationTools = await api.getToolsByCharacterId(selectedLocation.characterId);
          const toolsWithImages = locationTools.map(tool => {
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            
            // Обеспечиваем совместимость полей в разных форматах
            return { 
              ...tool, 
              imagePath,
              // Если поля в camelCase отсутствуют, но есть в snake_case, копируем их
              mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
              locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
              // Убедимся, что обязательные поля всегда определены
              main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
              location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
            };
          });
          
          setTools(toolsWithImages as Tool[]);
        } else {
          console.warn('characterId не определен для выбранной локации:', selectedLocation);
          setTools([]);
        }
        
        // Проверяем, что currencyType или currencyId определены
        const currencyIdentifier = selectedLocation.currencyType || selectedLocation.currencyId;
        if (currencyIdentifier) {
          // Получаем количество ресурсов для новой локации
          const resources = await api.getResourceAmount(currencyIdentifier);
          setResourceAmount(resources);
        } else {
          console.warn('currencyType и currencyId не определены для выбранной локации:', selectedLocation);
          setResourceAmount(0);
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных для новой локации:', error);
      }
    }
  };

  // Активация инструмента
  const handleActivateTool = async (toolId: number) => {
    try {
      if (!currentLocation) return false;
      if (!currentLocation.characterId) {
        console.warn('characterId не определен для текущей локации:', currentLocation);
        return false;
      }
      
      await api.equipTool(currentLocation.characterId, toolId);
      
      // Обновляем прогресс после активации
      const progress = await api.getPlayerProgress();
      setPlayerProgress(progress);
      
      return true;
    } catch (error) {
      console.error('Ошибка при активации инструмента:', error);
      return false;
    }
  };
  
  if (!initialized || !playerProgress || !currentLocation) {
    return <div className="loading">Загрузка...</div>;
  }
  
  return (
    <div className="App">
      {/* Верхняя панель */}
      <TopPanel
        userName={userName}
        userAvatar={userAvatar}
        level={playerProgress.level}
        experience={playerProgress.experience}
        nextLevelExperience={nextLevelExp}
        energy={playerProgress.energy}
        maxEnergy={playerProgress.maxEnergy}
        gardenCoins={gardenCoins}
        locationCurrency={resourceAmount}
        locationCurrencyType={(currentLocation.currencyType || currentLocation.currencyId || CurrencyType.FOREST) as CurrencyType}
        lastEnergyRefillTime={playerProgress.lastEnergyRefillTime}
      />
      
      {/* Игровой экран или другие вкладки в зависимости от activeTab */}
      {activeTab === "tap" && <GameScreen
        location={currentLocation}
        tools={tools}
        equippedToolId={currentLocation.characterId ? (playerProgress.equippedTools[currentLocation.characterId] || 0) : 0}
        resourceAmount={resourceAmount}
        currencyType={(currentLocation.currencyType || currentLocation.currencyId || CurrencyType.FOREST) as CurrencyType}
        energy={playerProgress.energy}
        maxEnergy={playerProgress.maxEnergy}
        level={playerProgress.level}
        experience={playerProgress.experience}
        nextLevelExperience={nextLevelExp}
        onTap={handleTap}
        onUpgrade={handleUpgrade}
        characterImageUrl={currentLocation.characterId ? `/assets/characters/${currentLocation.characterId}.gif` : '/assets/characters/lumberjack.gif'}
        gardenCoins={gardenCoins}
        onActivateTool={handleActivateTool}
      />}
      
      {/* Экран локаций */}
      {activeTab === "locations" && (
        <div className="h-screen w-full pt-36 mt-1 px-4 overflow-hidden relative">
          <div className="absolute inset-0 z-0" 
               style={{backgroundImage: `url(${currentLocation.background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
          <div className="grid grid-cols-1 gap-4 pb-20 max-h-[calc(100vh-180px)] overflow-y-auto relative z-10">
            {locations.map((location) => {
              const isUnlocked = playerProgress.unlockedLocations.includes(location.id);
              const isActive = location.id === currentLocationId;
              
              return (
                <div 
                  key={location.id} 
                  className={`location-card p-4 rounded-lg ${
                    isActive ? 'bg-blue-700' : 'bg-gray-700'
                  } ${!isUnlocked ? 'opacity-50 grayscale' : ''} relative overflow-hidden bg-opacity-80`}
                >
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 rounded-lg">
                      <span className="text-sm font-medium">{`Доступно с уровня ${location.unlockLevel}`}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-full bg-gray-600 mr-4 overflow-hidden">
                      <img 
                        src={location.background} 
                        alt={location.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{location.name}</h3>
                      <p className="text-sm text-white opacity-75">{location.description}</p>
                    </div>
                    {isUnlocked && (
                      <button 
                        className={`ml-4 px-4 py-2 rounded bg-yellow-500 text-white transform transition-transform hover:scale-105 active:scale-95`}
                        onClick={() => {
                          handleLocationChange(location.id);
                          setActiveTab("tap");
                        }}
                      >
                        {isActive ? 'Активна' : 'Выбрать'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Экран друзей */}
      {activeTab === "friends" && (
        <div className="h-screen w-full pt-36 mt-1 px-4 flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 z-0" 
               style={{backgroundImage: `url(${currentLocation.background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
          <div className="text-center p-8 bg-gray-800 bg-opacity-80 rounded-lg relative z-10">
            <h2 className="text-xl font-bold text-white mb-4">Друзья</h2>
            <p className="text-white">Функция "Друзья" находится в разработке.</p>
          </div>
        </div>
      )}
      
      {/* Экран обмена */}
      {activeTab === "exchange" && (
        <div className="h-screen w-full pt-36 mt-1 px-4 flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 z-0" 
               style={{backgroundImage: `url(${currentLocation.background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
          <div className="text-center p-8 bg-gray-800 bg-opacity-80 rounded-lg relative z-10">
            <h2 className="text-xl font-bold text-white mb-4">Обмен</h2>
            <p className="text-white">Функция "Обмен" находится в разработке.</p>
          </div>
        </div>
      )}
      
      {/* Выбор локации */}
      <LocationSelector
        locations={locations}
        activeLocationId={currentLocationId}
        onSelectLocation={handleLocationChange}
        unlockedLocations={playerProgress.unlockedLocations}
        onTap={handleTap}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />
    </div>
  );
}

// Для TypeScript определяем интерфейс Window с Telegram WebApp API
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          }
        }
      }
    }
  }
}

export default App;
