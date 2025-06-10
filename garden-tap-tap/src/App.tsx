import React, { useEffect, useState } from 'react';
import './App.css';
import GameScreen from './components/GameScreen';
import LocationSelector from './components/LocationSelector';
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
        setNextLevelExp(nextLevel.requiredExp);
        
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
      
      // Активируем приложение
      tg.ready();
    }
  }, []);
  
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
      }
    }
  }
}

export default App;
