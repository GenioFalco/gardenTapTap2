// Локации в игре
export interface Location {
  id: number;
  name: string;
  background: string;
  resourceName: string;
  characterId: number;
  unlockLevel: number;
  unlockCost: number;
  currencyType: CurrencyType;
}

// Персонаж для локации
export interface Character {
  id: number;
  name: string;
  animationType: 'gif' | 'spritesheet';
  animationPath: string;
  frameCount?: number; // Только для spritesheet
}

// Инструменты для персонажа
export interface Tool {
  id: number;
  name: string;
  characterId: number;
  power: number;
  unlockLevel: number;
  unlockCost: number;
  currencyType: CurrencyType;
  imagePath: string;
}

// Уровни игрока
export interface Level {
  level: number;
  requiredExp: number;
  rewards: Reward[];
}

// Типы наград
export enum RewardType {
  MAIN_CURRENCY = 'main_currency',
  LOCATION_CURRENCY = 'location_currency',
  UNLOCK_TOOL = 'unlock_tool',
  UNLOCK_LOCATION = 'unlock_location',
  TOOL = 'tool',
  LOCATION = 'location',
  CURRENCY = 'currency',
  ENERGY = 'energy'
}

// Типы валют
export enum CurrencyType {
  MAIN = 'garden_coins',
  FOREST = 'logs',
  GARDEN = 'vegetables',
  WINTER = 'snowflakes',
}

// Награды за уровни
export interface Reward {
  id: number;
  levelId: number;
  rewardType: RewardType;
  amount: number;
  targetId?: number; // ID локации или инструмента для разблокировки
}

// Прогресс игрока
export interface PlayerProgress {
  id: number;
  level: number;
  experience: number;
  energy: number;
  maxEnergy: number;
  lastEnergyRefillTime: string;
  currencies: PlayerCurrency[];
  unlockedLocations: number[];
  unlockedTools: number[];
  equippedTools: Record<number, number>; // characterId -> toolId
  nextLevelExperience?: number; // Требуемый опыт для следующего уровня
}

// Валюта игрока
export interface PlayerCurrency {
  currencyType: CurrencyType;
  amount: number;
} 