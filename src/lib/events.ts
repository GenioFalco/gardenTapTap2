// Простая система событий для обновления данных в приложении

type EventCallback<T = any> = (data?: T) => void;

// События приложения
export enum AppEvent {
  CURRENCY_UPDATED = 'CURRENCY_UPDATED',
  STORAGE_UPGRADED = 'STORAGE_UPGRADED',
  RANK_UP = 'RANK_UP',
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  RESOURCES_UPDATED = 'RESOURCES_UPDATED',
  ENERGY_UPDATED = 'ENERGY_UPDATED',
}

// Хранилище обработчиков событий
const eventHandlers: Record<string, EventCallback[]> = {};

/**
 * Подписаться на событие
 * @param event Тип события
 * @param callback Функция обратного вызова
 */
export const subscribe = <T>(event: AppEvent, callback: EventCallback<T>): void => {
  if (!eventHandlers[event]) {
    eventHandlers[event] = [];
  }
  eventHandlers[event].push(callback as EventCallback);
};

/**
 * Отписаться от события
 * @param event Тип события
 * @param callback Функция обратного вызова
 */
export const unsubscribe = <T>(event: AppEvent, callback: EventCallback<T>): void => {
  if (!eventHandlers[event]) return;
  eventHandlers[event] = eventHandlers[event].filter(cb => cb !== callback);
};

/**
 * Вызвать событие
 * @param event Тип события
 * @param data Данные события
 */
export const emit = <T>(event: AppEvent, data?: T): void => {
  if (!eventHandlers[event]) return;
  eventHandlers[event].forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Ошибка при обработке события ${event}:`, error);
    }
  });
}; 