import Dexie from 'dexie';
import { 
  Location, Character, Tool, Level, Reward, PlayerProgress, 
  CurrencyType, RewardType, PlayerCurrency 
} from '../types';

// Определение структуры базы данных Dexie
class GardenTapTapDB extends Dexie {
  locations: Dexie.Table<Location, number>;
  characters: Dexie.Table<Character, number>;
  tools: Dexie.Table<Tool, number>;
  levels: Dexie.Table<{level: number, requiredExp: number}, number>;
  rewards: Dexie.Table<Reward, number>;
  playerProgress: Dexie.Table<Omit<PlayerProgress, 'currencies' | 'unlockedLocations' | 'unlockedTools' | 'equippedTools'>, number>;
  playerCurrencies: Dexie.Table<PlayerCurrency, string>;
  playerLocations: Dexie.Table<{locationId: number}, number>;
  playerTools: Dexie.Table<{toolId: number}, number>;
  playerEquippedTools: Dexie.Table<{characterId: number, toolId: number}, number>;

  constructor() {
    super('GardenTapTapDB');
    
    // Определяем схему базы данных
    this.version(1).stores({
      locations: 'id, name, background, resourceName, characterId, unlockLevel, unlockCost, currencyType',
      characters: 'id, name, animationType, animationPath, frameCount',
      tools: 'id, name, description, characterId, main_coins_power, location_coins_power, unlockLevel, unlockCost, currencyType, imagePath',
      levels: 'level, requiredExp',
      rewards: 'id, levelId, rewardType, amount, targetId',
      playerProgress: 'id, level, experience, energy, maxEnergy, lastEnergyRefillTime',
      playerCurrencies: 'currencyType, amount',
      playerLocations: 'locationId',
      playerTools: 'toolId',
      playerEquippedTools: 'characterId, toolId',
    });
    
    // Типизация таблиц
    this.locations = this.table('locations');
    this.characters = this.table('characters');
    this.tools = this.table('tools');
    this.levels = this.table('levels');
    this.rewards = this.table('rewards');
    this.playerProgress = this.table('playerProgress');
    this.playerCurrencies = this.table('playerCurrencies');
    this.playerLocations = this.table('playerLocations');
    this.playerTools = this.table('playerTools');
    this.playerEquippedTools = this.table('playerEquippedTools');
  }
}

// Создаем экземпляр базы данных
const db = new GardenTapTapDB();

// Проверка и инициализация базы данных
let isInitialized = false;

// Инициализация базы данных
export const initDatabase = async (): Promise<void> => {
  if (isInitialized) return;
  
  try {
    // Проверяем, есть ли данные в базе
    const locationsCount = await db.locations.count();
    
    if (locationsCount === 0) {
      // Заполняем начальными данными
      await seedDatabase();
    }
    
    isInitialized = true;
    console.log('База данных инициализирована успешно');
  } catch (error) {
    console.error('Ошибка при инициализации базы данных:', error);
  }
};

// Заполнение базы начальными данными
const seedDatabase = async (): Promise<void> => {
  // Транзакция для атомарности операций
  await db.transaction('rw', 
    [db.locations, db.characters, db.tools, db.levels, db.rewards, 
     db.playerProgress, db.playerCurrencies, db.playerLocations, 
     db.playerTools, db.playerEquippedTools], 
    async () => {
      // Добавляем персонажей
      await db.characters.add({
        id: 1,
        name: 'Лесоруб',
        description: 'Опытный работник, занимающийся вырубкой леса.',
        image: '/assets/characters/lumberjack.png',
        locationId: 1,
        animationType: 'gif',
        animationPath: '/assets/characters/lumberjack.gif',
        frameCount: undefined
      });
      
      // Добавляем инструменты
      await db.tools.bulkAdd([
        {
          id: 1,
          name: 'Топор',
          description: 'Базовый инструмент лесоруба. Эффективен при рубке небольших деревьев.',
          characterId: 1,
          main_coins_power: 0.5,
          location_coins_power: 1,
          unlockLevel: 1,
          unlockCost: 0,
          currencyType: CurrencyType.FOREST,
          imagePath: '/assets/tools/axe.png'
        },
        {
          id: 2,
          name: 'Ручная пила',
          description: 'Позволяет работать быстрее и эффективнее. Отлично подходит для средних деревьев.',
          characterId: 1,
          main_coins_power: 1.5,
          location_coins_power: 3,
          unlockLevel: 5,
          unlockCost: 300,
          currencyType: CurrencyType.FOREST,
          imagePath: '/assets/tools/handsaw.png'
        },
        {
          id: 3,
          name: 'Бензопила',
          description: 'Профессиональный инструмент. Значительно ускоряет работу с любым лесом.',
          characterId: 1,
          main_coins_power: 5,
          location_coins_power: 10,
          unlockLevel: 10,
          unlockCost: 1000,
          currencyType: CurrencyType.FOREST,
          imagePath: '/assets/tools/chainsaw.png'
        }
      ]);
      
      // Добавляем локации
      await db.locations.add({
        id: 1,
        name: 'Лес',
        description: 'Густой лес, богатый ценной древесиной.',
        background: '/assets/backgrounds/forest.jpg',
        resourceName: 'Брёвна',
        characterId: 1,
        unlockLevel: 1,
        unlockCost: 0,
        currencyType: CurrencyType.MAIN,
        currencyId: 'forest'
      });
      
      // Добавляем уровни (первые 20)
      const levels = [];
      for (let i = 1; i <= 20; i++) {
        // Формула для требуемого опыта: опыт растет экспоненциально
        const requiredExp = Math.floor(100 * Math.pow(1.5, i - 1));
        levels.push({ level: i, requiredExp });
      }
      await db.levels.bulkAdd(levels);
      
      // Добавляем награды за уровни
      await db.rewards.bulkAdd([
        { id: 1, level: 1, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 100, targetId: undefined, levelId: 1, reward_type: RewardType.MAIN_CURRENCY },
        { id: 2, level: 2, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 200, targetId: undefined, levelId: 2, reward_type: RewardType.MAIN_CURRENCY },
        { id: 3, level: 3, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 300, targetId: undefined, levelId: 3, reward_type: RewardType.MAIN_CURRENCY },
        { id: 4, level: 4, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 400, targetId: undefined, levelId: 4, reward_type: RewardType.MAIN_CURRENCY },
        { id: 5, level: 5, type: RewardType.TOOL, rewardType: RewardType.UNLOCK_TOOL, amount: 0, targetId: 2, levelId: 5, reward_type: RewardType.UNLOCK_TOOL }, // Разблокировка ручной пилы
        { id: 6, level: 6, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 600, targetId: undefined, levelId: 6, reward_type: RewardType.MAIN_CURRENCY },
        { id: 7, level: 7, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 700, targetId: undefined, levelId: 7, reward_type: RewardType.MAIN_CURRENCY },
        { id: 8, level: 8, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 800, targetId: undefined, levelId: 8, reward_type: RewardType.MAIN_CURRENCY },
        { id: 9, level: 9, type: RewardType.CURRENCY, rewardType: RewardType.MAIN_CURRENCY, currencyType: CurrencyType.MAIN, amount: 900, targetId: undefined, levelId: 9, reward_type: RewardType.MAIN_CURRENCY },
        { id: 10, level: 10, type: RewardType.TOOL, rewardType: RewardType.UNLOCK_TOOL, amount: 0, targetId: 3, levelId: 10, reward_type: RewardType.UNLOCK_TOOL }, // Разблокировка бензопилы
      ]);
      
      // Инициализация прогресса игрока
      await db.playerProgress.add({
        level: 1,
        experience: 0,
        energy: 100,
        maxEnergy: 100,
        lastEnergyRefillTime: new Date().toISOString()
      });
      
      // Инициализация валют игрока
      await db.playerCurrencies.bulkAdd([
        { currencyType: CurrencyType.MAIN, amount: 0, currencyId: 'main' },
        { currencyType: CurrencyType.FOREST, amount: 0, currencyId: 'forest' },
      ]);
      
      // Разблокируем первую локацию и инструмент
      await db.playerLocations.add({ locationId: 1 });
      await db.playerTools.add({ toolId: 1 });
      
      // Экипируем первый инструмент
      await db.playerEquippedTools.add({ characterId: 1, toolId: 1 });
  });
};

// Получить все локации
export const getLocations = async (): Promise<Location[]> => {
  return await db.locations.toArray();
};

// Получить все доступные игроку локации
export const getUnlockedLocations = async (): Promise<Location[]> => {
  const unlockedIds = await db.playerLocations.toArray();
  const locationIds = unlockedIds.map(item => item.locationId);
  
  return await db.locations
    .where('id')
    .anyOf(locationIds)
    .toArray();
};

// Получить персонажа по ID
export const getCharacterById = async (id: number): Promise<Character> => {
  return await db.characters.get(id) as Character;
};

// Получить все инструменты для персонажа
export const getToolsByCharacterId = async (characterId: number): Promise<Tool[]> => {
  return await db.tools
    .where('characterId')
    .equals(characterId)
    .toArray();
};

// Получить доступные игроку инструменты для персонажа
export const getUnlockedToolsByCharacterId = async (characterId: number): Promise<Tool[]> => {
  const unlockedTools = await db.playerTools.toArray();
  const toolIds = unlockedTools.map(item => item.toolId);
  
  return await db.tools
    .where('id')
    .anyOf(toolIds)
    .and(tool => tool.characterId === characterId)
    .toArray();
};

// Получить экипированный инструмент для персонажа
export const getEquippedTool = async (characterId: number): Promise<Tool | null> => {
  if (!characterId || typeof characterId !== 'number') {
    console.warn('getEquippedTool вызван с недопустимым characterId:', characterId);
    return null;
  }

  const equipped = await db.playerEquippedTools
    .where('characterId')
    .equals(characterId)
    .first();
  
  if (!equipped) return null;
  
  return await db.tools.get(equipped.toolId) as Tool;
};

// Экипировать инструмент
export const equipTool = async (characterId: number, toolId: number): Promise<void> => {
  // Удаляем текущий экипированный инструмент, если есть
  await db.playerEquippedTools
    .where('characterId')
    .equals(characterId)
    .delete();
  
  // Добавляем новый
  await db.playerEquippedTools.add({ characterId, toolId });
};

// Получить прогресс игрока
export const getPlayerProgress = async (): Promise<PlayerProgress> => {
  const progress = await db.playerProgress.get(1) as Omit<PlayerProgress, 'currencies' | 'unlockedLocations' | 'unlockedTools' | 'equippedTools'>;
  
  // Получаем валюты игрока
  const currencies = await db.playerCurrencies.toArray();
  
  // Получаем разблокированные локации
  const unlockedLocations = await db.playerLocations.toArray();
  const locationIds = unlockedLocations.map(item => item.locationId);
  
  // Получаем разблокированные инструменты
  const unlockedTools = await db.playerTools.toArray();
  const toolIds = unlockedTools.map(item => item.toolId);
  
  // Получаем экипированные инструменты
  const equippedToolsArray = await db.playerEquippedTools.toArray();
  const equippedTools: Record<number, number> = {};
  
  equippedToolsArray.forEach(item => {
    equippedTools[item.characterId] = item.toolId;
  });
  
  return {
    ...progress,
    currencies,
    unlockedLocations: locationIds,
    unlockedTools: toolIds,
    equippedTools
  };
};

// Обновить энергию игрока
export const updatePlayerEnergy = async (energy: number): Promise<void> => {
  await db.playerProgress.update(1, {
    energy,
    lastEnergyRefillTime: new Date().toISOString()
  });
};

// Добавить ресурсы игроку
export const addResources = async (currencyIdentifier: CurrencyType | string | number, amount: number): Promise<void> => {
  try {
    // Если идентификатор валюты не определен, используем тип по умолчанию
    if (!currencyIdentifier) {
      console.warn('addResources вызван с неопределенным идентификатором валюты, используем FOREST');
      currencyIdentifier = CurrencyType.FOREST;
    }

    const currency = await db.playerCurrencies
      .where('currencyType')
      .equals(currencyIdentifier)
      .first();
    
    if (currency) {
      // Обновляем существующую запись
      currency.amount += amount;
      await db.playerCurrencies.put(currency);
    } else {
      // Создаем новую запись
      // Преобразуем идентификатор валюты в строку для currencyId
      const currencyId = String(currencyIdentifier).toLowerCase();
      
      // Если currencyIdentifier не является значением CurrencyType, используем FOREST
      const currencyTypeValue = typeof currencyIdentifier === 'string' && 
                              Object.values(CurrencyType).includes(currencyIdentifier as CurrencyType) 
                              ? currencyIdentifier as CurrencyType 
                              : CurrencyType.FOREST;
      
      await db.playerCurrencies.add({
        currencyType: currencyTypeValue,
        amount,
        currencyId
      });
    }
  } catch (error) {
    console.error('Ошибка при добавлении ресурсов:', error);
  }
};

// Получить количество ресурсов игрока
export const getResourceAmount = async (currencyIdentifier: CurrencyType | string | number): Promise<number> => {
  try {
    // Если тип валюты не определен, используем тип по умолчанию
    if (!currencyIdentifier) {
      console.warn('getResourceAmount вызван с неопределенным типом валюты, используем FOREST');
      currencyIdentifier = CurrencyType.FOREST;
    }

    const currency = await db.playerCurrencies
      .where('currencyType')
      .equals(currencyIdentifier)
      .first();
    
    return currency ? currency.amount : 0;
  } catch (error) {
    console.error('Ошибка при получении количества ресурсов:', error);
    return 0;
  }
};

// Потратить ресурсы
export const spendResources = async (currencyIdentifier: CurrencyType | string | number, amount: number): Promise<boolean> => {
  try {
    // Получаем текущее количество ресурсов
    const currentAmount = await getResourceAmount(currencyIdentifier);
    
    // Проверяем, достаточно ли ресурсов
    if (currentAmount < amount) {
      return false;
    }
    
    // Списываем ресурсы
    await db.transaction('rw', db.playerCurrencies, async () => {
      const currency = await db.playerCurrencies
        .where('currencyType')
        .equals(currencyIdentifier)
        .first();
      
      if (currency) {
        currency.amount -= amount;
        await db.playerCurrencies.put(currency);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Ошибка при списании ресурсов:', error);
    return false;
  }
};

// Разблокировать инструмент
export const unlockTool = async (toolId: number): Promise<void> => {
  // Проверяем, разблокирован ли уже
  const exists = await db.playerTools
    .where('toolId')
    .equals(toolId)
    .count();
  
  if (exists === 0) {
    await db.playerTools.add({ toolId });
  }
};

// Разблокировать локацию
export const unlockLocation = async (locationId: number): Promise<void> => {
  // Проверяем, разблокирована ли уже
  const exists = await db.playerLocations
    .where('locationId')
    .equals(locationId)
    .count();
  
  if (exists === 0) {
    await db.playerLocations.add({ locationId });
  }
};

// Добавить опыт и повысить уровень если нужно
export const addExperience = async (exp: number): Promise<{ levelUp: boolean; level: number; rewards: Reward[] }> => {
  // Получаем текущий прогресс
  const progress = await db.playerProgress.get(1) as { level: number; experience: number };
  
  // Получаем информацию о текущем уровне
  const currentLevel = await db.levels
    .where('level')
    .equals(progress.level)
    .first() as { level: number; requiredExp: number };
  
  // Обновляем опыт
  let newExp = progress.experience + exp;
  let newLevel = progress.level;
  let levelUp = false;
  let rewards: Reward[] = [];
  
  // Проверяем, нужно ли повысить уровень
  while (true) {
    // Получаем следующий уровень
    const nextLevel = await db.levels
      .where('level')
      .equals(newLevel + 1)
      .first();
    
    // Если следующего уровня нет или опыта недостаточно - выходим из цикла
    if (!nextLevel || newExp < currentLevel.requiredExp) break;
    
    // Повышаем уровень
    newLevel++;
    levelUp = true;
    
    // Получаем награды за новый уровень
    const levelRewards = await db.rewards
      .where('levelId')
      .equals(newLevel)
      .toArray();
    
    rewards = [...rewards, ...levelRewards];
    
    // Применяем награды
    for (const reward of levelRewards) {
      switch (reward.reward_type || reward.rewardType) {
        case RewardType.MAIN_CURRENCY:
          if (reward.amount !== undefined) {
            await addResources(CurrencyType.MAIN, reward.amount);
          }
          break;
        case RewardType.LOCATION_CURRENCY:
          // Здесь должна быть логика определения типа валюты локации
          break;
        case RewardType.UNLOCK_TOOL:
          if (reward.target_id || reward.targetId) await unlockTool(reward.target_id || reward.targetId as number);
          break;
        case RewardType.UNLOCK_LOCATION:
          if (reward.target_id || reward.targetId) await unlockLocation(reward.target_id || reward.targetId as number);
          break;
      }
    }
  }
  
  // Обновляем прогресс игрока в базе
  await db.playerProgress.update(1, {
    level: newLevel,
    experience: newExp
  });
  
  return { levelUp, level: newLevel, rewards };
};

// Получить информацию об уровне
export const getLevelInfo = async (level: number): Promise<Level> => {
  const levelInfo = await db.levels
    .where('level')
    .equals(level)
    .first() as { level: number; requiredExp: number };
  
  const rewards = await db.rewards
    .where('levelId')
    .equals(level)
    .toArray();
  
  // Базовая формула для максимальной энергии: 100 + 2 * (level - 1)
  const maxEnergy = 100 + 2 * (level - 1);
  
  return { ...levelInfo, rewards, maxEnergy };
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
  // Получаем прогресс игрока
  const progress = await getPlayerProgress();
  
  // Проверяем, есть ли энергия
  if (progress.energy <= 0) {
    return { 
      resourcesGained: 0, 
      experienceGained: 0, 
      levelUp: false, 
      level: progress.level, 
      rewards: [],
      energyLeft: 0
    };
  }
  
  // Получаем локацию
  const location = await db.locations.get(locationId);
  if (!location) {
    throw new Error(`Локация с ID ${locationId} не найдена`);
  }
  
  // Безопасно получаем ID персонажа
  const characterId = location.characterId || location.character_id;
  if (typeof characterId !== 'number') {
    throw new Error(`Для локации ${locationId} не определен персонаж`);
  }
  
  // Получаем экипированный инструмент
  const tool = await getEquippedTool(characterId);
  if (!tool) {
    throw new Error(`Не найден экипированный инструмент для персонажа ${characterId}`);
  }
  
  // Рассчитываем полученные ресурсы (сила инструмента для локации)
  const resourcesGained = tool.location_coins_power;
  
  // Рассчитываем полученный опыт (пока равен ресурсам)
  const experienceGained = resourcesGained;
  
  // Безопасно определяем тип валюты
  const currencyType = location.currencyType || location.currency_type as CurrencyType || CurrencyType.FOREST;
  
  // Добавляем ресурсы
  await addResources(currencyType, resourcesGained);
  
  // Добавляем опыт и проверяем повышение уровня
  const levelResult = await addExperience(experienceGained);
  
  // Уменьшаем энергию
  const newEnergy = Math.max(0, progress.energy - 1);
  await updatePlayerEnergy(newEnergy);
  
  return {
    resourcesGained,
    experienceGained,
    levelUp: levelResult.levelUp,
    level: levelResult.level,
    rewards: levelResult.rewards,
    energyLeft: newEnergy
  };
};

// Улучшить инструмент (купить новый)
export const upgradeTool = async (toolId: number): Promise<boolean> => {
  // Получаем инструмент
  const tool = await db.tools.get(toolId);
  if (!tool) {
    console.warn(`Инструмент с ID ${toolId} не найден`);
    return false;
  }
  
  // Проверяем наличие необходимых полей
  const currencyIdentifier = tool.currencyId || tool.currencyType || CurrencyType.FOREST;
  const cost = tool.unlockCost || 0;
  
  // Проверяем, достаточно ли ресурсов
  if (!(await spendResources(currencyIdentifier, cost))) {
    return false;
  }
  
  // Разблокируем инструмент
  await unlockTool(toolId);
  
  return true;
}; 