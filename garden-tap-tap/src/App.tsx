import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import GameScreen from './components/GameScreen';
import LocationSelector from './components/LocationSelector';
import TopPanel from './components/TopPanel';
import LevelUpModal from './components/LevelUpModal';
import * as api from './lib/api';
import { Location, Tool, PlayerProgress, CurrencyType, RewardType } from './types';

// Определение типа для совместимости с LevelUpModal
interface ModalReward {
  id: number;
  level_id: number;
  reward_type: string;
  amount: number;
  target_id?: number;
  currency_id?: string;
}

// Функция для преобразования общего типа Reward в ModalReward
const convertToModalReward = (reward: any): ModalReward => {
  return {
    id: reward.id,
    level_id: reward.levelId || reward.level_id,
    reward_type: reward.rewardType || reward.reward_type,
    amount: reward.amount,
    target_id: reward.targetId || reward.target_id,
    currency_id: reward.currencyId || reward.currency_id
  };
};

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
  
  // Состояния для модального окна повышения уровня
  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [levelRewards, setLevelRewards] = useState<any[]>([]);
  
  // Кеши имен инструментов и локаций для отображения в модальном окне
  const [toolNames, setToolNames] = useState<Record<number, string>>({});
  const [locationNames, setLocationNames] = useState<Record<number, string>>({});
  
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
          // Нормализуем поля для поддержки как camelCase, так и snake_case
          characterId: location.characterId || location.character_id || 1, // По умолчанию 1
          currencyType: (location.currencyType || location.currency_type || CurrencyType.FOREST).toUpperCase() as CurrencyType,
          currencyId: (location.currencyId || location.currency_type || 'forest').toLowerCase(),
          // Другие поля с значениями по умолчанию
          description: location.description || 'Без описания',
          unlockLevel: location.unlockLevel || 1,
          resourceName: location.resourceName || 'Ресурсы',
          // Используем путь из базы данных или значение по умолчанию
          background: location.background || '/assets/backgrounds/forest.jpg',
        }));
        
        console.log('Normalized locations:', locationsWithPlaceholders);
        setLocations(locationsWithPlaceholders as Location[]);
        
        // Получаем прогресс игрока
        const progress = await api.getPlayerProgress();
        console.log('Player progress in App.tsx:', progress);
        setPlayerProgress(progress);
        
        // Устанавливаем текущую локацию
        const defaultLocation = locationsWithPlaceholders.find(loc => loc.id === 1) || locationsWithPlaceholders[0];
        console.log('Selected default location:', defaultLocation);
        setCurrentLocation(defaultLocation);
        setCurrentLocationId(defaultLocation.id);
        
        // Проверяем, что characterId определен
        const characterId = defaultLocation.characterId || defaultLocation.character_id;
        if (characterId) {
          // Получаем инструменты для текущей локации с подстановкой изображений
          const locationTools = await api.getToolsByCharacterId(characterId);
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
        const currencyType = defaultLocation.currencyType || CurrencyType.FOREST;
        const currencyId = defaultLocation.currencyId || 'forest';
        const currencyIdentifier = currencyId.toLowerCase();
        
        console.log(`Getting resource amount for currency: ${currencyIdentifier}`);
        if (currencyIdentifier) {
          const resources = await api.getResourceAmount(currencyIdentifier);
          console.log(`Resource amount for ${currencyIdentifier}:`, resources);
          setResourceAmount(resources);
        } else {
          console.warn('Currency ID не определен для локации по умолчанию.');
          setResourceAmount(0);
        }
        
        // Получаем информацию о следующем уровне
        const nextLevel = await api.getLevelInfo(progress.level + 1);
        console.log('Next level info in App.tsx:', nextLevel);
        setNextLevelExp(nextLevel.requiredExp);
        
        // Получаем сад-коины (основная валюта)
        const coins = await api.getResourceAmount(CurrencyType.MAIN.toLowerCase());
        console.log('Garden coins:', coins);
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
        const characterId = currentLocation.characterId || currentLocation.character_id;
        if (characterId) {
          // Получаем инструменты для текущей локации с подстановкой изображений
          const locationTools = await api.getToolsByCharacterId(characterId);
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
        const currencyIdentifier = currentLocation.currencyType || currentLocation.currencyId || 
                                  currentLocation.currency_type || currentLocation.currency_id;
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
  
  // Функция закрытия модального окна
  const handleCloseLevelUpModal = () => {
    setShowLevelUpModal(false);
  };

  // Обработка тапа (основная механика)
  const handleTap = async () => {
    if (!currentLocation || !playerProgress) return;
    
    try {
      // Получаем правильный идентификатор валюты
      const currencyId = currentLocation.currencyId?.toLowerCase() || 'forest';
      
      console.log('Tapping with location:', currentLocation);
      console.log('Currency ID for tap:', currencyId);
      
      // Вызываем функцию тапа
      const tapResult = await api.tap(currentLocation.id);
      console.log('Tap result:', tapResult);
      
      // Обновляем количество ресурсов локации
      const newResourceAmount = await api.getResourceAmount(currencyId);
      console.log(`New resource amount (${currencyId}):`, newResourceAmount);
      setResourceAmount(newResourceAmount);
      
      // Отображаем количество заработанных ресурсов локации
      console.log(`Заработано ${tapResult.resourcesGained} ${currencyId}`);
      
      // Отображаем количество заработанных основных монет
      if (tapResult.mainCurrencyGained) {
        console.log(`Заработано ${tapResult.mainCurrencyGained} сад-коинов`);
        
        // Обновляем сад-коины
        const coins = await api.getResourceAmount('main');
        console.log('Обновлено сад-коинов:', coins);
        setGardenCoins(coins);
      }
      
      // Отображаем заработанный опыт (всегда 1)
      console.log(`Заработано 1 опыта`);
      
      // Обновляем прогресс
      const progress = await api.getPlayerProgress();
      setPlayerProgress(progress);
      
      // Если уровень повысился, обновляем данные о следующем уровне и показываем модальное окно
      if (tapResult.levelUp) {
        const nextLevel = await api.getLevelInfo(progress.level + 1);
        setNextLevelExp(nextLevel.requiredExp);
        
        // Подготовка данных для модального окна
        setCurrentLevel(progress.level);
        
        // Копируем награды из результата тапа и преобразуем их в формат ModalReward
        let allRewards = tapResult.rewards.map(reward => convertToModalReward(reward));
        const newLevel = progress.level;
        
        // Проверяем, есть ли инструменты, доступные на новом уровне
        try {
          const availableTools = await api.getToolsByUnlockLevel(newLevel);
          console.log(`Инструменты, доступные на уровне ${newLevel}:`, availableTools);
          
          // Добавляем инструменты в награды
          if (availableTools && availableTools.length > 0) {
            availableTools.forEach((tool: Tool) => {
              // Проверяем, нет ли уже такой же награды в списке
              const existingReward = allRewards.find(r => 
                r.reward_type === RewardType.UNLOCK_TOOL && r.target_id === tool.id
              );
              
              if (!existingReward) {
                const newReward: ModalReward = {
                  id: Math.random() * 10000, // Генерируем случайный ID для награды
                  level_id: newLevel,
                  reward_type: RewardType.UNLOCK_TOOL,
                  amount: 0,
                  target_id: tool.id
                };
                allRewards.push(newReward);
                
                // Добавляем инструмент в кеш имен
                if (tool.name) {
                  setToolNames(prev => ({
                    ...prev,
                    [tool.id]: tool.name
                  }));
                }
              }
            });
          }
        } catch (error) {
          console.error('Ошибка при проверке доступных инструментов:', error);
        }
        
        // Проверяем, есть ли локации, доступные на новом уровне
        try {
          const availableLocations = await api.getLocationsByUnlockLevel(newLevel);
          console.log(`Локации, доступные на уровне ${newLevel}:`, availableLocations);
          
          // Добавляем локации в награды
          if (availableLocations && availableLocations.length > 0) {
            availableLocations.forEach((location: Location) => {
              // Проверяем, нет ли уже такой же награды в списке
              const existingReward = allRewards.find(r => 
                r.reward_type === RewardType.UNLOCK_LOCATION && r.target_id === location.id
              );
              
              if (!existingReward) {
                const newReward: ModalReward = {
                  id: Math.random() * 10000, // Генерируем случайный ID для награды
                  level_id: newLevel,
                  reward_type: RewardType.UNLOCK_LOCATION,
                  amount: 0,
                  target_id: location.id
                };
                allRewards.push(newReward);
                
                // Добавляем локацию в кеш имен
                if (location.name) {
                  setLocationNames(prev => ({
                    ...prev,
                    [location.id]: location.name
                  }));
                }
              }
            });
          }
        } catch (error) {
          console.error('Ошибка при проверке доступных локаций:', error);
        }
        
        setLevelRewards(allRewards);
        
        // Обновляем кеши имен инструментов и локаций для остальных наград
        const updatedToolNames = {...toolNames};
        const updatedLocationNames = {...locationNames};
        
        // Если в наградах есть инструменты или локации, получаем их имена
        for (const reward of allRewards) {
          if (reward.reward_type === RewardType.UNLOCK_TOOL && reward.target_id) {
            if (!updatedToolNames[reward.target_id]) {
              try {
                const toolInfo = await api.getToolInfo(reward.target_id);
                if (toolInfo && toolInfo.name) {
                  updatedToolNames[reward.target_id] = toolInfo.name;
                }
              } catch (error) {
                console.error(`Не удалось получить информацию об инструменте ${reward.target_id}:`, error);
              }
            }
          }
          
          if (reward.reward_type === RewardType.UNLOCK_LOCATION && reward.target_id) {
            if (!updatedLocationNames[reward.target_id]) {
              try {
                const locationInfo = await api.getLocationInfo(reward.target_id);
                if (locationInfo && locationInfo.name) {
                  updatedLocationNames[reward.target_id] = locationInfo.name;
                }
              } catch (error) {
                console.error(`Не удалось получить информацию о локации ${reward.target_id}:`, error);
              }
            }
          }
        }
        
        // Обновляем кеши
        setToolNames(updatedToolNames);
        setLocationNames(updatedLocationNames);
        
        // Показываем модальное окно
        setShowLevelUpModal(true);
        
        // Могут быть разблокированы новые инструменты или локации
        const allLocations = await api.getLocations();
        const locationsWithPlaceholders = allLocations.map((location: Location) => ({
          ...location,
          background: location.background || '/assets/backgrounds/forest.jpg',
          currencyType: (location.currencyType || location.currency_type || CurrencyType.FOREST).toUpperCase() as CurrencyType,
          currencyId: (location.currencyId || location.currency_type || 'forest').toLowerCase(),
        }));
        
        setLocations(locationsWithPlaceholders);
      }
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
        const currencyIdentifier = currentLocation?.currencyType || currentLocation?.currencyId || 
                                  currentLocation?.currency_type || currentLocation?.currency_id;
        if (currencyIdentifier) {
          const newResourceAmount = await api.getResourceAmount(currencyIdentifier);
          setResourceAmount(newResourceAmount);
        }
        
        // Обновляем прогресс (который содержит equippedTools и unlockedTools)
        const progress = await api.getPlayerProgress();
        setPlayerProgress(progress);
        
        // Обновляем список инструментов для текущей локации
        if (currentLocation?.characterId) {
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
  
  // Обработка изменения локации
  const handleLocationChange = async (locationId: number) => {
    if (locationId === currentLocationId) return;
    
    try {
      // Находим выбранную локацию
      const selectedLocation = locations.find(loc => loc.id === locationId);
      if (!selectedLocation) {
        console.error(`Локация с ID ${locationId} не найдена`);
        return;
      }
      
      console.log('Смена локации на:', selectedLocation);
      
      // Обновляем текущую локацию
      setCurrentLocationId(locationId);
      setCurrentLocation(selectedLocation);
      
      // Нормализуем поля локации
      const normalizedLocation = {
        ...selectedLocation,
        currencyType: (selectedLocation.currencyType || selectedLocation.currency_type || CurrencyType.FOREST).toUpperCase() as CurrencyType,
        currencyId: (selectedLocation.currencyId || selectedLocation.currency_type || 'forest').toLowerCase()
      };
      
      console.log('Нормализованная локация:', normalizedLocation);
      
      // Сначала обновляем прогресс игрока для получения свежих данных
      const progress = await api.getPlayerProgress();
      setPlayerProgress(progress);
      
      // Получаем инструменты для новой локации
      const characterId = selectedLocation.characterId || selectedLocation.character_id;
      if (characterId) {
        // Получаем все доступные инструменты для этой локации
        const locationTools = await api.getToolsByCharacterId(characterId);
        
        // Обрабатываем каждый инструмент - добавляем информацию и совместимость полей
        const toolsWithImages = locationTools.map((tool: Tool) => {
          const imagePath = tool.imagePath || getToolImagePath(tool.name);
          
          return { 
            ...tool, 
            imagePath,
            mainCoinsPower: tool.mainCoinsPower || tool.main_coins_power || 0,
            locationCoinsPower: tool.locationCoinsPower || tool.location_coins_power || 0,
            main_coins_power: tool.main_coins_power || tool.mainCoinsPower || 0,
            location_coins_power: tool.location_coins_power || tool.locationCoinsPower || 0
          };
        });
        
        // Устанавливаем инструменты
        setTools(toolsWithImages as Tool[]);
        
        // Здесь мы НЕ пытаемся автоматически установить инструмент,
        // так как это уже сделано в таблице player_equipped_tools
        // и загружено в progress.equippedTools
        
        // Лог текущего экипированного инструмента для отладки
        if (progress.equippedTools && progress.equippedTools[characterId]) {
          console.log(`Активный инструмент для персонажа ${characterId}: ${progress.equippedTools[characterId]}`);
        } else {
          console.log(`Не найден активный инструмент для персонажа ${characterId} в equippedTools:`, progress.equippedTools);
        }
      } else {
        setTools([]);
      }
      
      // Получаем количество ресурсов для новой локации
      const currencyId = normalizedLocation.currencyId;
      console.log(`Получаем количество ресурсов для ${currencyId}`);
      const resources = await api.getResourceAmount(currencyId);
      console.log(`Количество ресурсов для ${currencyId}:`, resources);
      setResourceAmount(resources);
      
      // Переключаемся на вкладку тапа
      setActiveTab("tap");
    } catch (error) {
      console.error('Ошибка при смене локации:', error);
    }
  };

  // Активация инструмента
  const handleActivateTool = async (toolId: number) => {
    try {
      if (!currentLocation) return false;
      
      // Безопасно получаем ID персонажа из текущей локации
      let characterIdForEquip = 1; // По умолчанию 1
      
      if (typeof currentLocation.characterId === 'number') {
        characterIdForEquip = currentLocation.characterId;
      } else if (typeof currentLocation.character_id === 'number') {
        characterIdForEquip = currentLocation.character_id;
      } else {
        console.warn('characterId не определен для текущей локации:', currentLocation);
        return false;
      }
      
      // Вызываем API с гарантированно числовым ID
      await api.equipTool(characterIdForEquip, toolId);
      
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
  
  // Определяем ID экипированного инструмента для текущей локации
  const characterId: number = Number(currentLocation?.characterId || currentLocation?.character_id || 1);
  // Безопасно получаем ID экипированного инструмента
  let equippedToolId = 0;
  if (playerProgress?.equippedTools && typeof characterId === 'number') {
    equippedToolId = playerProgress.equippedTools[characterId] || 0;
  }
  
  // Функция для получения названия валюты по её типу
  const getCurrencyName = (currencyType: string): string => {
    switch (currencyType.toLowerCase()) {
      case 'forest':
        return 'Дерево';
      case 'garden':
        return 'Овощи';
      case 'winter':
        return 'Снежинки';
      case 'mountain':
        return 'Камень';
      case 'desert':
        return 'Песок';
      case 'lake':
        return 'Вода';
      case 'main':
        return 'Сад-коины';
      default:
        return 'Ресурсы';
    }
  };
  
  // Функция для получения пути к изображению валюты по её типу
  const getCurrencyImage = (currencyType: string): string => {
    switch (currencyType.toLowerCase()) {
      case 'main':
        return '/assets/currencies/garden_coin.png';
      case 'forest':
        return '/assets/currencies/wood.png';
      case 'garden':
        return '/assets/currencies/vegetable.png';
      case 'winter':
        return '/assets/currencies/snowflake.png';
      case 'mountain':
        return '/assets/currencies/stone.png';
      case 'desert':
        return '/assets/currencies/sand.png';
      case 'lake':
        return '/assets/currencies/water.png';
      default:
        return '/assets/currencies/garden_coin.png'; // Используем монету по умолчанию
    }
  };
  
  // Функция для получения эмодзи для валюты
  const getCurrencyEmoji = (currencyType: string): string => {
    switch (currencyType.toLowerCase()) {
      case 'main':
        return '🪙';
      case 'forest':
        return '🪵';
      case 'garden':
        return '🥕';
      case 'winter':
        return '❄️';
      case 'mountain':
        return '🪨';
      case 'desert':
        return '🏜️';
      case 'lake':
        return '💧';
      default:
        return '💎';
    }
  };

  // Определяем тип валюты для текущей локации
  const locationCurrencyType = (currentLocation.currencyType || 
    (currentLocation.currency_type as CurrencyType) || 
    currentLocation.currencyId || 
    currentLocation.currency_id || 
    CurrencyType.FOREST) as CurrencyType;
  
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
        locationCurrencyType={locationCurrencyType}
        lastEnergyRefillTime={playerProgress.lastEnergyRefillTime}
      />
      
      {/* Игровой экран или другие вкладки в зависимости от activeTab */}
      {activeTab === "tap" && <GameScreen
        location={currentLocation}
        tools={tools}
        equippedToolId={equippedToolId}
        resourceAmount={resourceAmount}
        currencyType={locationCurrencyType}
        energy={playerProgress.energy}
        maxEnergy={playerProgress.maxEnergy}
        level={playerProgress.level}
        experience={playerProgress.experience}
        nextLevelExperience={nextLevelExp}
        onTap={handleTap}
        onUpgrade={handleUpgrade}
        gardenCoins={gardenCoins}
        onActivateTool={handleActivateTool}
        unlockedTools={playerProgress.unlockedTools || []}
      />}
      
      {/* Экран локаций */}
      {activeTab === "locations" && (
        <div className="h-screen w-full pt-36 mt-1 px-4 overflow-hidden relative">
          <div className="absolute inset-0 z-0" 
               style={{backgroundImage: `url(${currentLocation.background})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed'}}></div>
          
          {/* Заголовок раздела */}
          <div className="text-center mb-6 relative z-10">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">Доступные локации</h2>
            <p className="text-sm text-white opacity-80">Выберите локацию для сбора ресурсов</p>
          </div>
          
          <div className="grid grid-cols-1 gap-4 pb-24 max-h-[calc(100vh-220px)] overflow-y-auto relative z-10">
            {locations.map((location) => {
              const isUnlocked = playerProgress.unlockedLocations.includes(location.id);
              const isActive = location.id === currentLocationId;
              
              // Определяем цвет градиента в зависимости от типа локации
              let gradientColors = "from-blue-700 to-blue-900";
              const currencyType = String(location.currencyType || '').toUpperCase();
              if (currencyType === "FOREST") gradientColors = "from-green-700 to-green-900";
              if (currencyType === "GARDEN") gradientColors = "from-emerald-700 to-emerald-900";
              if (currencyType === "DESERT") gradientColors = "from-amber-700 to-amber-900";
              if (currencyType === "WINTER") gradientColors = "from-cyan-700 to-cyan-900";
              if (currencyType === "MOUNTAIN") gradientColors = "from-stone-700 to-stone-900";
              if (currencyType === "LAKE") gradientColors = "from-blue-700 to-blue-900";
              
              return (
                <div 
                  key={location.id} 
                  className={`location-card rounded-xl overflow-hidden bg-gray-800 bg-opacity-80 
                    ${!isUnlocked ? 'grayscale' : ''} 
                    ${isActive ? 'ring-2 ring-yellow-400' : ''} 
                    transition-all duration-300 shadow backdrop-blur-sm`}
                >
                                      <div className="flex h-28 relative">
                    {/* Изображение локации */}
                    <div className="w-1/3 h-full overflow-hidden">
                      <img 
                        src={location.background} 
                        alt={location.name}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Индикатор активной локации */}
                      {isActive && (
                        <div className="absolute top-2 left-2 bg-green-600 text-xs px-2 py-1 rounded-full text-white font-medium flex items-center">
                          <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                          Активна
                        </div>
                      )}
                    </div>
                    
                    {/* Информация о локации */}
                                         <div className="w-2/3 p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-white">{location.name}</h3>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        {/* Информация о ресурсах локации */}
                        <div className="flex items-center">
                          {isUnlocked ? (
                            <div className="flex items-center bg-yellow-500 px-2 py-1 rounded shadow-sm">
                              <div className="w-5 h-5 rounded-full bg-white overflow-hidden flex items-center justify-center">
                                <img 
                                  src={getCurrencyImage(String(location.currencyType || '').toLowerCase())} 
                                  alt={location.resourceName || "Ресурс"}
                                  className="w-4 h-4 object-contain"
                                  onError={(e) => {
                                    // Если изображение не загрузилось, заменяем на эмодзи
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const currencyType = String(location.currencyType || '').toLowerCase();
                                    target.parentElement!.innerHTML = getCurrencyEmoji(currencyType);
                                  }}
                                />
                              </div>
                              <span className="text-xs text-white mx-1 font-medium">
                                {getCurrencyName(String(location.currencyType || '').toLowerCase())}:
                              </span>
                              <span className="text-sm font-bold text-white">
                                {location.id === currentLocationId
                                  ? resourceAmount.toFixed(0) 
                                  : '0'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center opacity-60">
                              <div className="w-5 h-5 rounded-full bg-gray-600 overflow-hidden flex items-center justify-center">
                                <img 
                                  src={getCurrencyImage(String(location.currencyType || '').toLowerCase())} 
                                  alt={location.resourceName || "Ресурс"}
                                  className="w-4 h-4 object-contain opacity-70"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const currencyType = String(location.currencyType || '').toLowerCase();
                                    target.parentElement!.innerHTML = getCurrencyEmoji(currencyType);
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 ml-1">
                                {getCurrencyName(String(location.currencyType || '').toLowerCase())}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Кнопка выбора или информация о разблокировке */}
                                                  {isUnlocked ? (
                          <button 
                            className={`px-4 py-1.5 rounded bg-yellow-500 text-white text-sm font-medium
                              hover:bg-yellow-600 transition-all duration-200`}
                            onClick={() => {
                              handleLocationChange(location.id);
                              setActiveTab("tap");
                            }}
                          >
                            {isActive ? 'Играть' : 'Выбрать'}
                          </button>
                        ) : (
                          <div className="bg-gray-700 bg-opacity-70 px-3 py-2 rounded">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <span className="text-white">Уровень {location.unlockLevel || 1}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Полоса прогресса для заблокированных локаций */}
                  {!isUnlocked && (
                    <div className="h-1.5 bg-gray-700 w-full">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ 
                          width: `${Math.min(100, (playerProgress.level / (location.unlockLevel || 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  )}
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
      
      {/* Модальное окно повышения уровня */}
      {showLevelUpModal && (
        <LevelUpModal
          level={currentLevel}
          rewards={levelRewards}
          onClose={handleCloseLevelUpModal}
          toolNames={toolNames}
          locationNames={locationNames}
        />
      )}
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
