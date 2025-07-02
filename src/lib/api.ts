import { 
  Location, Character, Tool, Level, Reward, PlayerProgress, 
  CurrencyType, Currency, CharacterAppearance, Helper, HelperLevel 
  // RewardType, PlayerCurrency - не используются
} from '../types';
import { config } from '../config';

// Базовый URL для API
const API_BASE_URL = `${config.apiUrl}/api`;

// Функция для получения идентификатора пользователя из Telegram WebApp
export const getUserId = (): string => {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user?.id) {
    // Получаем ID пользователя из Telegram WebApp
    return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
  }
  // Для разработки и тестирования
  return 'test_user';
};

// Функция для выполнения fetch-запросов
const fetchApi = async <T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Получаем ID пользователя Telegram для аутентификации
  const userId = getUserId();
  
  // Добавляем заголовки для идентификации пользователя
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...options.headers
  };
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      // Пытаемся получить детальную информацию об ошибке
      let errorDetails = '';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorDetails = `: ${errorData.error}`;
        }
      } catch (e) {
        // Если не удалось распарсить JSON, просто используем статус и текст ошибки
      }
      
      throw new Error(`API error: ${response.status} ${response.statusText}${errorDetails}`);
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
  const response = await fetchApi<{
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
  
  // Обновляем прогресс заданий (тапов)
  try {
    // Обновляем прогресс заданий по тапам
    await fetchApi('/player/tasks/update-progress', {
      method: 'POST',
      body: JSON.stringify({ taskType: 'tap', progress: 1 })
    });
    
    // Также обновляем прогресс по ресурсам, если получены ресурсы
    if (response.resourcesGained > 0) {
      await fetchApi('/player/tasks/update-progress', {
        method: 'POST',
        body: JSON.stringify({ taskType: 'collect_currency', progress: response.resourcesGained })
      });
    }
    
    // Обновляем прогресс по энергии, если была потрачена энергия
    await fetchApi('/player/tasks/update-progress', {
      method: 'POST',
      body: JSON.stringify({ taskType: 'spend_energy', progress: 1 })
    });
  } catch (error) {
    console.error('Не удалось обновить прогресс заданий:', error);
  }
  
  return response;
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

// Получить всех помощников для локации
export const getHelpersByLocationId = async (locationId: number): Promise<Helper[]> => {
  return await fetchApi<Helper[]>(`/helpers/location/${locationId}`);
};

// Получить активных помощников
// Этот метод больше не нужен, так как все купленные помощники активны
// Оставляем для обратной совместимости
export const getActiveHelpers = async (): Promise<any[]> => {
  return await fetchApi<any[]>('/helpers/active');
};

// Купить помощника
export const buyHelper = async (helperId: number): Promise<{ 
  success: boolean;
  updatedCurrency?: {
    currencyId: number;
    currencyType: string;
    amount: number;
  }
}> => {
  return await fetchApi<{ 
    success: boolean;
    updatedCurrency?: {
      currencyId: number;
      currencyType: string;
      amount: number;
    }
  }>(`/player/helpers/${helperId}/buy`, {
    method: 'POST'
  });
};

// Прокачать помощника на следующий уровень
export const upgradeHelper = async (helperId: number): Promise<{ success: boolean, level: number }> => {
  try {
    console.log(`Отправка запроса на улучшение помощника ID: ${helperId}`);
    return await fetchApi<{ success: boolean, level: number }>('/helpers/upgrade', {
      method: 'POST',
      body: JSON.stringify({ helperId })
    });
  } catch (error) {
    console.error(`Ошибка при улучшении помощника ID: ${helperId}`, error);
    throw error; // Прокидываем ошибку дальше для обработки в компоненте
  }
};

// Получить уровни всех помощников
export const getHelpersWithLevels = async (): Promise<HelperLevel[]> => {
  return await fetchApi<HelperLevel[]>('/helpers/levels');
};

// Получить уровень конкретного помощника
export const getHelperLevel = async (helperId: number): Promise<HelperLevel> => {
  return await fetchApi<HelperLevel>(`/helpers/${helperId}/level`);
};

// Этот метод больше не нужен, так как помощники всегда активны после покупки
// Оставляем для обратной совместимости
export const toggleHelper = async (helperId: number): Promise<{ success: boolean, active: boolean }> => {
  return await fetchApi<{ success: boolean, active: boolean }>('/helpers/toggle', {
    method: 'POST',
    body: JSON.stringify({ helperId })
  });
};

// Этот метод больше не нужен, так как ресурсы собираются автоматически
// Оставляем для обратной совместимости
export const collectHelpersReward = async (): Promise<{ collected: number, locationId: number | null, currencyType: string | null }> => {
  return await fetchApi<{ collected: number, locationId: number | null, currencyType: string | null }>('/helpers/collect', {
    method: 'POST'
  });
};

// Получить информацию о хранилище
export const getStorageInfo = async (locationId: number, currencyId: string): Promise<{
  storage_level: number;
  capacity: number;
  current_amount: number;
  percentage_filled: number;
}> => {
  return await fetchApi<{
    storage_level: number;
    capacity: number;
    current_amount: number;
    percentage_filled: number;
  }>(`/player/storage/${locationId}/${currencyId}`);
};

// Получить информацию об улучшении хранилища
export const getStorageUpgradeInfo = async (locationId: number, currencyId: string): Promise<{
  currentLevel: number;
  nextLevel: number;
  currentCapacity: number;
  nextCapacity: number;
  upgradeCost: number;
  currencyType: string;
  canUpgrade: boolean;
}> => {
  return await fetchApi<{
    currentLevel: number;
    nextLevel: number;
    currentCapacity: number;
    nextCapacity: number;
    upgradeCost: number;
    currencyType: string;
    canUpgrade: boolean;
  }>(`/player/storage/${locationId}/${currencyId}/upgrade-info`);
};

// Улучшить хранилище
export const upgradeStorage = async (locationId: number, currencyId: string): Promise<{
  success: boolean;
  error?: string;
  newLevel?: number;
  newCapacity?: number;
}> => {
  return await fetchApi<{
    success: boolean;
    error?: string;
    newLevel?: number;
    newCapacity?: number;
  }>('/player/storage/upgrade', {
    method: 'POST',
    body: JSON.stringify({ locationId, currencyId })
  });
};

// Получить уровни хранилища для локации
export const getStorageLevels = async (locationId: number): Promise<{
  level: number;
  capacity: number;
  upgrade_cost: number;
  currency_type: string;
}[]> => {
  return await fetchApi<{
    level: number;
    capacity: number;
    upgrade_cost: number;
    currency_type: string;
  }[]>(`/storage-levels/${locationId}`);
};

// Получить информацию о накопленной прибыли помощников
export const getHelpersPendingIncome = async (): Promise<any[]> => {
  const response = await fetchApi<any[]>('/player/helpers/pending-income');
  return response;
};

// Собрать накопленную прибыль помощников
export const collectHelpersPendingIncome = async (): Promise<any> => {
  const response = await fetchApi<any>('/player/helpers/collect-income', {
    method: 'POST'
  });
  return response;
};

// Получить профиль игрока
export const getPlayerProfile = async (): Promise<{
  userId: string;
  avatar: string;
  username: string;
  level: number;
  currentRank: {
    id: number;
    name: string;
    imagePath: string;
  };
  highestRank: {
    id: number;
    name: string;
    imagePath: string;
  };
  currentSeason: {
    id: number;
    name: string;
    endDate: string;
    daysLeft: number;
  };
  seasonPoints: number;
  featuredAchievement: {
    id: number;
    name: string;
    description: string;
    imagePath: string;
    dateUnlocked: string;
  } | null;
}> => {
  return await fetchApi('/player/profile');
};

// Обновить ранг игрока
export const updatePlayerRank = async (seasonId: number = 1): Promise<{
  success: boolean;
  rankChanged: boolean;
  newRank?: {
    id: number;
    name: string;
    imagePath: string;
    minPoints: number;
  };
  currentRank?: {
    id: number;
    name: string;
    imagePath: string;
    minPoints: number;
  };
}> => {
  return await fetchApi('/player/update-rank', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ seasonId })
  });
};

// Разблокировать достижение
export const unlockAchievement = async (achievementId: number): Promise<{
  success: boolean;
  alreadyUnlocked: boolean;
  achievement: {
    id: number;
    name: string;
    description: string;
    imagePath: string;
    rewardValue: number;
    dateUnlocked: string;
  };
}> => {
  return await fetchApi('/player/unlock-achievement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ achievementId })
  });
};

// Получить непоказанные поздравления с достижениями
export const getAchievementCongratulations = async (): Promise<{
  id: number;
  achievement_id: number;
  achievement_name: string;
  achievement_description: string;
  image_path: string;
  shown: boolean;
}[]> => {
  return await fetchApi('/player/achievement-congratulations');
};

// Отметить поздравление как показанное
export const markAchievementCongratulationAsShown = async (congratulationId: number): Promise<{ success: boolean }> => {
  return await fetchApi('/player/achievement-congratulations/' + congratulationId + '/shown', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// Получить сезонные задания
export const getSeasonTasks = async (userId: string): Promise<{
  success: boolean;
  tasks: Array<{
    id: number;
    description: string;
    taskType: string;
    targetValue: number;
    seasonPoints: number;
    exp: number;
    coins: number;
    progress: number;
    completed: boolean;
    rewardClaimed: boolean;
  }>;
}> => {
  return await fetchApi<any>('/player/tasks/season');
};

// Получить ежедневные задания
export const getDailyTasks = async (userId: string): Promise<{
  success: boolean;
  tasks: Array<{
    id: number;
    description: string;
    taskType: string;
    targetValue: number;
    seasonPoints: number;
    exp: number;
    coins: number;
    progress: number;
    completed: boolean;
    rewardClaimed: boolean;
  }>;
}> => {
  return await fetchApi<any>('/player/tasks/daily');
};

// Получить награду за выполненное задание
export const claimTaskReward = async (
  userId: string,
  taskId: number,
  taskType: 'season' | 'daily'
): Promise<{
  success: boolean;
  rewards?: {
    exp: number;
    coins: number;
    seasonPoints?: number;
  };
  error?: string;
}> => {
  return await fetchApi<any>(`/player/tasks/${taskType}/${taskId}/claim`, {
    method: 'POST'
  });
}; 