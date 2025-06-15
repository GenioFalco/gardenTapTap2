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
  description: string;
  background: string;
  unlockLevel: number;
  characterId: number;
  currencyId: string;  // Для использования с базой данных SQLite
  currencyType: CurrencyType;  // Для обратной совместимости с API
  resourceName: string;  // Для обратной совместимости с API
  unlockCost?: number;
}

// Интерфейс инструмента
export interface Tool {
  id: number;
  name: string;
  description: string;
  unlockLevel: number;
  unlockCost: number;
  currencyType: CurrencyType;
  characterId: number;
  imagePath?: string;
  main_coins_power: number;      // Сколько садкоинов даёт за тап
  location_coins_power: number;  // Сколько валюты локации даёт за тап
  // Поля в camelCase для совместимости с API
  mainCoinsPower?: number;
  locationCoinsPower?: number;
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
  equippedTools: Record<number, number>;
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
  frameCount?: number;
} 