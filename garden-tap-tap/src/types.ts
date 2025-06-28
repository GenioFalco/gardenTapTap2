// Перечисление типов валют
export enum CurrencyType {
  MAIN = 'MAIN',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  DESERT = 'DESERT',
  LAKE = 'LAKE'
}

// Интерфейс валюты
export interface Currency {
  id: number;
  name: string;
  currency_type: CurrencyType;
  image_path: string;
}

// Интерфейс локации
export interface Location {
  id: number;
  name: string;
  description?: string;  // Не всегда присутствует
  background: string;
  unlockLevel?: number;  // Может быть не определен
  characterId?: number;  // Может быть получен из character_id
  currencyId?: string;   // Может быть получен из currency_id
  currencyType?: CurrencyType;  // Может быть получен из currency_type
  resourceName?: string;  // Не всегда присутствует
  unlockCost?: number;
  
  // Поля в snake_case для обратной совместимости с сервером
  character_id?: number;
  currency_id?: string;
  currency_type?: string;
}

// Интерфейс инструмента
export interface Tool {
  id: number;
  name: string;
  description: string;
  unlockLevel: number;
  unlockCost: number;
  currencyType?: CurrencyType;  // Старое поле
  currencyId?: string | number; // Новое поле
  characterId: number;
  imagePath?: string;
  main_coins_power: number;      // Сколько садкоинов даёт за тап
  location_coins_power: number;  // Сколько валюты локации даёт за тап
  // Поля в camelCase для совместимости с API
  mainCoinsPower?: number;
  locationCoinsPower?: number;
  // Флаг, указывающий, разблокирован ли инструмент (добавляется сервером)
  is_unlocked?: boolean;
}

// Интерфейс персонажа
export interface Character {
  id: number;
  name: string;
  description: string;
  image: string;
  locationId: number;
  animationType?: string;  // Тип анимации (gif, sprite и т.д.)
  animationPath?: string;  // Путь к анимации
  frameCount?: number;     // Количество кадров для спрайтовой анимации
}

// Интерфейс уровня
export interface Level {
  level: number;
  requiredExp: number;
  maxEnergy: number;
  rewards?: Reward[];  // Награды за достижение уровня
}

// Перечисление типов наград
export enum RewardType {
  TOOL = 'TOOL',
  LOCATION = 'LOCATION',
  CURRENCY = 'CURRENCY',
  ENERGY = 'ENERGY',
  MAIN_CURRENCY = 'MAIN_CURRENCY',
  LOCATION_CURRENCY = 'LOCATION_CURRENCY',
  UNLOCK_TOOL = 'UNLOCK_TOOL',
  UNLOCK_LOCATION = 'UNLOCK_LOCATION'
}

// Интерфейс награды
export interface Reward {
  id: number;
  level: number;
  levelId?: number;       // Для обратной совместимости
  type?: RewardType;      // Для обратной совместимости
  reward_type: RewardType;
  rewardType?: RewardType;  // Для обратной совместимости с API
  currencyId?: string;    
  currencyType?: CurrencyType;  // Для обратной совместимости
  amount?: number;
  target_id?: number;
  targetId?: number;     // Для обратной совместимости с API
}

// Интерфейс валюты игрока
export interface PlayerCurrency {
  currencyId: string;  
  currencyType?: CurrencyType;  // Для обратной совместимости с API
  amount: number;
}

// Интерфейс прогресса игрока
export interface PlayerProgress {
  level: number;
  experience: number;
  energy: number;
  maxEnergy: number;
  lastEnergyRefillTime: string;
  equippedTools: {[key: number]: number};  // key: characterId, value: toolId
  unlockedTools: number[];
  unlockedLocations: number[];
  currencies?: PlayerCurrency[];  // Валюты игрока
}

// Добавляем интерфейс для внешнего вида персонажа
export interface CharacterAppearance {
  id: number;
  characterId: number;
  toolId: number;
  imagePath: string;
  animationType?: string;
  animationPath?: string;
  frameCount?: number | null;
}

// Интерфейс помощника
export interface Helper {
  id: number;
  name: string;
  locationId: number;
  unlockLevel: number;
  unlockCost: number;
  currencyType: CurrencyType;
  imagePath: string;
  isUnlocked?: boolean;  // Куплен ли помощник
  max_level?: number;    // Максимальный уровень помощника
  level?: number;        // Текущий уровень помощника
  
  // Поля для обратной совместимости
  description?: string;  // Убрано в новой версии
  incomePerHour?: number; // Заменено на значение из таблицы helper_levels
}

// Интерфейс уровня помощника
export interface HelperLevel {
  helper_id: number;
  level: number;
  income_per_hour: number;
  upgrade_cost: number;
  currency_type: string;
} 