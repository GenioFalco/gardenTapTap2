import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import GameScreen from './components/GameScreen';
import LocationSelector from './components/LocationSelector';
import TopPanel from './components/TopPanel';
import * as api from './lib/api';
import { Location, Tool, CurrencyType, PlayerProgress } from './types';

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
          // Проверяем наличие изображений и подставляем нужный путь, если нужно
          background: location.background || '/assets/backgrounds/forest.jpg',
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
        
        // Получаем инструменты для текущей локации с подстановкой изображений
        const locationTools = await api.getToolsByCharacterId(defaultLocation.characterId);
        const toolsWithImages = locationTools.map(tool => {
          const imagePath = tool.imagePath || getToolImagePath(tool.name);
          return { ...tool, imagePath };
        });
        
        setTools(toolsWithImages);
        
        // Получаем количество ресурсов
        const forestResources = await api.getResourceAmount(CurrencyType.FOREST);
        setResourceAmount(forestResources);
        
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
    switch (toolName) {
      case 'Топор':
        return '/assets/tools/axe.png';
      case 'Ручная пила':
        return '/assets/tools/handsaw.png';
      case 'Бензопила':
        return '/assets/tools/chainsaw.png';
      default:
        return '/assets/tools/axe.png';
    }
  };
  
  // При изменении текущей локации подгружаем связанные данные
  useEffect(() => {
    const loadLocationData = async () => {
      if (!currentLocation || !initialized) return;
      
      try {
        // Получаем инструменты для текущей локации с подстановкой изображений
        const locationTools = await api.getToolsByCharacterId(currentLocation.characterId);
        const toolsWithImages = locationTools.map(tool => {
          const imagePath = tool.imagePath || getToolImagePath(tool.name);
          return { ...tool, imagePath };
        });
        
        setTools(toolsWithImages);
        
        // Получаем количество ресурсов
        const resources = await api.getResourceAmount(currentLocation.currencyType);
        setResourceAmount(resources);
        
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
      const newResourceAmount = await api.getResourceAmount(currentLocation.currencyType);
      setResourceAmount(newResourceAmount);
      
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
          background: location.background || '/assets/backgrounds/forest.jpg',
        }));
        
        setLocations(locationsWithPlaceholders);
        
        const locationTools = await api.getToolsByCharacterId(currentLocation.characterId);
        const toolsWithImages = locationTools.map((tool: Tool) => {
          const imagePath = tool.imagePath || getToolImagePath(tool.name);
          return { ...tool, imagePath };
        });
        
        setTools(toolsWithImages);
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
        const newResourceAmount = await api.getResourceAmount(currentLocation?.currencyType as CurrencyType);
        setResourceAmount(newResourceAmount);
        
        // Обновляем список инструментов и прогресс
        const progress = await api.getPlayerProgress();
        setPlayerProgress(progress);
        
        // Проверяем, разблокирован ли инструмент
        if (progress.unlockedTools.includes(toolId)) {
          await api.equipTool(currentLocation?.characterId as number, toolId);
          
          // Получаем обновленный список инструментов
          const locationTools = await api.getToolsByCharacterId(currentLocation?.characterId as number);
          const toolsWithImages = locationTools.map((tool: Tool) => {
            const imagePath = tool.imagePath || getToolImagePath(tool.name);
            return { ...tool, imagePath };
          });
          
          setTools(toolsWithImages);
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
  const handleLocationChange = (locationId: number) => {
    const selectedLocation = locations.find(loc => loc.id === locationId);
    if (selectedLocation) {
      setCurrentLocation(selectedLocation);
      setCurrentLocationId(selectedLocation.id);
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
        locationCurrencyType={currentLocation.currencyType}
        lastEnergyRefillTime={playerProgress.lastEnergyRefillTime}
      />
      
      {/* Игровой экран */}
      <GameScreen
        location={currentLocation}
        tools={tools}
        equippedToolId={playerProgress.equippedTools[currentLocation.characterId] || 0}
        resourceAmount={resourceAmount}
        currencyType={currentLocation.currencyType}
        energy={playerProgress.energy}
        maxEnergy={playerProgress.maxEnergy}
        level={playerProgress.level}
        experience={playerProgress.experience}
        nextLevelExperience={nextLevelExp}
        onTap={handleTap}
        onUpgrade={handleUpgrade}
        characterImageUrl="/assets/characters/lumberjack.gif"
      />
      
      {/* Выбор локации */}
      <LocationSelector
        locations={locations}
        activeLocationId={currentLocationId}
        onSelectLocation={handleLocationChange}
        unlockedLocations={playerProgress.unlockedLocations}
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
