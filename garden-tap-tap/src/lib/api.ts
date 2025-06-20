import { 
  Location, Character, Tool, Level, Reward, PlayerProgress, 
  CurrencyType, RewardType, PlayerCurrency, Currency, CharacterAppearance, Helper 
} from '../types';
import CONFIG from '../config';

// Базовый URL для API
const API_BASE_URL = CONFIG.API_URL || 'http://localhost:3001/api';

// Функция для выполнения fetch-запросов
const fetchApi = async <T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Добавляем заголовки для идентификации пользователя
  // В реальном приложении здесь будет токен авторизации
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': 'test_user',
    ...options.headers
  };
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`API response from ${endpoint}:`, data);
    return data;
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
    throw error;
  }
};

// API функции

// Получить все локации
export const getLocations = async (): Promise<Location[]> => {
  return await fetchApi<Location[]>('/locations');
};

// Получить все доступные игроку локации
export const getUnlockedLocations = async (): Promise<Location[]> => {
  return await fetchApi<Location[]>('/player/locations');
};

// Получить персонажа по ID
export const getCharacterById = async (id: number): Promise<Character> => {
  return await fetchApi<Character>(`/characters/${id}`);
};

// Получить все инструменты для персонажа
export const getToolsByCharacterId = async (characterId: number): Promise<Tool[]> => {
  return await fetchApi<Tool[]>(`/characters/${characterId}/tools`);
};

// Получить разблокированные инструменты игрока для персонажа
export const getUnlockedToolsByCharacterId = async (characterId: number): Promise<Tool[]> => {
  const tools = await fetchApi<Tool[]>(`/player/characters/${characterId}/tools`);
  console.log('Получены инструменты для персонажа:', tools);
  return tools;
};

// Получить экипированный инструмент для персонажа
export const getEquippedTool = async (characterId: number): Promise<Tool | null> => {
  try {
    return await fetchApi<Tool>(`/player/characters/${characterId}/equipped-tool`);
  } catch (error) {
    // Если инструмент не найден, возвращаем null
    return null;
  }
};

// Экипировать инструмент
export const equipTool = async (characterId: number, toolId: number): Promise<void> => {
  await fetchApi<{ success: boolean }>('/player/equip-tool', {
    method: 'POST',
    body: JSON.stringify({ characterId, toolId })
  });
};

// Получить прогресс игрока
export const getPlayerProgress = async (): Promise<PlayerProgress> => {
  // Получаем основной прогресс игрока
  const progress = await fetchApi<PlayerProgress>('/player/progress');
  console.log('Raw player progress from API:', progress);
  
  // Получаем информацию о следующем уровне для расчета требуемого опыта
  const nextLevel = await getLevelInfo(progress.level + 1);
  console.log('Next level info:', nextLevel);
  
  // Обновляем прогресс с требуемым опытом для следующего уровня
  // При этом сохраняем maxEnergy из базы данных, который уже приходит в ответе
  const updatedProgress = {
    ...progress,
    nextLevelExperience: nextLevel.requiredExp // Добавляем требуемый опыт для следующего уровня
  };
  
  console.log('Updated player progress with nextLevelExperience:', updatedProgress);
  return updatedProgress;
};

// Обновить энергию игрока
export const updatePlayerEnergy = async (energy: number): Promise<{ success: boolean; energy: number; maxEnergy: number; lastEnergyRefillTime: string; timeUntilRefill?: number }> => {
  try {
    return await fetchApi<{ success: boolean; energy: number; maxEnergy: number; lastEnergyRefillTime: string; timeUntilRefill?: number }>('/player/update-energy', {
      method: 'POST',
      body: JSON.stringify({ energy })
    });
  } catch (error: any) {
    // Проверяем, не связана ли ошибка с преждевременным восстановлением энергии
    if (error.message && error.message.includes('403')) {
      console.warn('Слишком рано для восстановления энергии');
      
      // Возвращаем текущую энергию без изменений
      const progress = await getPlayerProgress();
      return {
        success: false,
        energy: progress.energy,
        maxEnergy: progress.maxEnergy,
        lastEnergyRefillTime: progress.lastEnergyRefillTime,
        timeUntilRefill: 60000 // 1 минута (приблизительно)
      };
    }
    
    // Другие ошибки просто выбрасываем
    throw error;
  }
};

// Добавить ресурсы игроку
export const addResources = async (currencyType: CurrencyType, amount: number): Promise<void> => {
  // На стороне сервера эта функция используется внутренне,
  // ресурсы добавляются при тапе
};

// Получить количество ресурсов игрока
export const getResourceAmount = async (currencyId: string): Promise<number> => {
  const response = await fetchApi<{ amount: number }>(`/player/resources/${currencyId}`);
  return response.amount;
};

// Потратить ресурсы
export const spendResources = async (currencyId: string, amount: number): Promise<boolean> => {
  // На стороне сервера эта функция используется внутренне
  // при покупке инструментов и локаций
  return true;
};

// Разблокировать инструмент
export const unlockTool = async (toolId: number): Promise<void> => {
  // Реализуется через upgradeTool
};

// Разблокировать локацию
export const unlockLocation = async (locationId: number): Promise<void> => {
  // На сервере нет отдельного метода для этого
};

// Добавить опыт и повысить уровень если нужно
export const addExperience = async (exp: number): Promise<{ levelUp: boolean; level: number; rewards: Reward[] }> => {
  // На стороне сервера эта функция используется внутренне при тапе
  return { levelUp: false, level: 1, rewards: [] };
};

// Получить информацию об уровне
export const getLevelInfo = async (level: number): Promise<Level & { rewards: Reward[] }> => {
  return await fetchApi<Level & { rewards: Reward[] }>(`/levels/${level}`);
};

// Тап по кнопке (основная механика)
export const tap = async (locationId: number): Promise<{ 
  resourcesGained: number; 
  mainCurrencyGained: number;
  experienceGained: number;
  levelUp: boolean;
  level: number;
  rewards: Reward[];
  energyLeft: number;
}> => {
  return await fetchApi<{
    resourcesGained: number;
    mainCurrencyGained: number;
    experienceGained: number;
    levelUp: boolean;
    level: number;
    rewards: Reward[];
    energyLeft: number;
  }>('/player/tap', {
    method: 'POST',
    body: JSON.stringify({ locationId })
  });
};

// Улучшить инструмент (купить новый)
export const upgradeTool = async (toolId: number): Promise<boolean> => {
  try {
    const response = await fetchApi<{ success: boolean }>('/player/upgrade-tool', {
      method: 'POST',
      body: JSON.stringify({ toolId })
    });
    return response.success;
  } catch (error) {
    return false;
  }
};

/**
 * Получить все валюты
 */
export const getCurrencies = async (): Promise<Currency[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/currencies`);
    
    if (!response.ok) {
      throw new Error(`Ошибка при получении валют: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении валют:', error);
    return [];
  }
};

/**
 * Получить валюту по типу
 */
export const getCurrencyByType = async (currencyId: string): Promise<Currency | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/currencies/${currencyId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Ошибка при получении валюты: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при получении валюты с ID ${currencyId}:`, error);
    return null;
  }
};

// Получить внешний вид персонажа с инструментом
export const getCharacterAppearance = async (characterId: number, toolId: number): Promise<CharacterAppearance> => {
  return await fetchApi<CharacterAppearance>(`/characters/${characterId}/appearance/${toolId}`);
};

// Получить информацию об инструменте по ID
export const getToolInfo = async (toolId: number): Promise<{id: number; name: string}> => {
  return await fetchApi<{id: number; name: string}>(`/tools/${toolId}`);
};

// Получить информацию о локации по ID
export const getLocationInfo = async (locationId: number): Promise<{id: number; name: string}> => {
  return await fetchApi<{id: number; name: string}>(`/locations/${locationId}`);
};

// Получить инструменты по уровню разблокировки
export const getToolsByUnlockLevel = async (level: number): Promise<Tool[]> => {
  return await fetchApi<Tool[]>(`/tools/unlock-level/${level}`);
};

// Получить локации по уровню разблокировки
export const getLocationsByUnlockLevel = async (level: number): Promise<Location[]> => {
  return await fetchApi<Location[]>(`/locations/unlock-level/${level}`);
};

// Получить помощников для локации
export const getHelpersByLocationId = async (locationId: number): Promise<Helper[]> => {
  return await fetchApi<Helper[]>(`/player/locations/${locationId}/helpers`);
};

// Получить активных помощников с временем активации
export const getActiveHelpers = async (): Promise<any[]> => {
  return await fetchApi<any[]>(`/player/helpers/active`);
};

// Купить помощника
export const buyHelper = async (helperId: number): Promise<{ success: boolean }> => {
  return await fetchApi<{ success: boolean }>(`/player/helpers/${helperId}/buy`, {
    method: 'POST'
  });
};

// Активировать/деактивировать помощника
export const toggleHelper = async (helperId: number): Promise<{ success: boolean, active: boolean }> => {
  return await fetchApi<{ success: boolean, active: boolean }>(`/player/helpers/${helperId}/toggle`, {
    method: 'POST'
  });
};

// Собрать награду от помощников
export const collectHelpersReward = async (): Promise<{ collected: number, locationId: number | null, currencyType: string | null }> => {
  return await fetchApi<{ collected: number, locationId: number | null, currencyType: string | null }>(`/player/helpers/collect`, {
    method: 'POST'
  });
}; 