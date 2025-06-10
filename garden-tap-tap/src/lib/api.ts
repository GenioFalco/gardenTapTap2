import { 
  Location, Character, Tool, Level, Reward, PlayerProgress, 
  CurrencyType, RewardType, PlayerCurrency 
} from '../types';

// Базовый URL для API
const API_BASE_URL = 'http://localhost:3002/api';

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
    
    return await response.json();
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
  return await fetchApi<Tool[]>(`/player/characters/${characterId}/tools`);
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
  return await fetchApi<PlayerProgress>('/player/progress');
};

// Обновить энергию игрока
export const updatePlayerEnergy = async (energy: number): Promise<void> => {
  // На стороне сервера эта функция не реализована отдельно,
  // так как энергия обновляется автоматически при тапе
};

// Добавить ресурсы игроку
export const addResources = async (currencyType: CurrencyType, amount: number): Promise<void> => {
  // На стороне сервера эта функция используется внутренне,
  // ресурсы добавляются при тапе
};

// Получить количество ресурсов игрока
export const getResourceAmount = async (currencyType: CurrencyType): Promise<number> => {
  const response = await fetchApi<{ amount: number }>(`/player/resources/${currencyType}`);
  return response.amount;
};

// Потратить ресурсы
export const spendResources = async (currencyType: CurrencyType, amount: number): Promise<boolean> => {
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
  experienceGained: number;
  levelUp: boolean;
  level: number;
  rewards: Reward[];
  energyLeft: number;
}> => {
  return await fetchApi<{
    resourcesGained: number;
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