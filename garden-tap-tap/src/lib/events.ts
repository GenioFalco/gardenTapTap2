// Простая система событий для обновления данных в приложении

type EventCallback = () => void;

// События приложения
export enum AppEvent {
  CURRENCY_UPDATED = 'CURRENCY_UPDATED',
  STORAGE_UPGRADED = 'STORAGE_UPGRADED',
}

// Хранилище обработчиков событий
const eventHandlers: Record<string, EventCallback[]> = {};

/**
 * Подписаться на событие
 * @param event Тип события
 * @param callback Функция обратного вызова
 */
export const subscribe = (event: AppEvent, callback: EventCallback): void => {
  if (!eventHandlers[event]) {
    eventHandlers[event] = [];
  }
  eventHandlers[event].push(callback);
};

/**
 * Отписаться от события
 * @param event Тип события
 * @param callback Функция обратного вызова
 */
export const unsubscribe = (event: AppEvent, callback: EventCallback): void => {
  if (!eventHandlers[event]) return;
  eventHandlers[event] = eventHandlers[event].filter(cb => cb !== callback);
};

/**
 * Вызвать событие
 * @param event Тип события
 */
export const emit = (event: AppEvent): void => {
  if (!eventHandlers[event]) return;
  eventHandlers[event].forEach(callback => {
    try {
      callback();
    } catch (error) {
      console.error(`Ошибка при обработке события ${event}:`, error);
    }
  });
}; 