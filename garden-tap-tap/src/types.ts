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
  currencyType: CurrencyType;
  resourceName?: string;  // Название ресурса, который добывается в локации
  unlockCost?: number;    // Стоимость разблокировки локации
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
  type: RewardType;
  itemId?: number;
  amount?: number;
  level: number;
  levelId?: number;       // Поддержка обратной совместимости
  currencyType?: CurrencyType;
  rewardType?: RewardType; // Поддержка обратной совместимости
  targetId?: number;      // ID цели награды (инструмент, локация и т.д.)
}

// Интерфейс валюты игрока
export interface PlayerCurrency {
  currencyType: CurrencyType;
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