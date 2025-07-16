/**
 * Конфигурация приложения
 */

// Environment configuration for the application
// This allows switching between local development and production

// Определяем, запущено ли приложение в Telegram WebApp
const isTelegramWebApp = !!window.Telegram && !!window.Telegram.WebApp;

// Определяем окружение
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// API URL конфигурация
const apiUrl = isDevelopment
  ? 'http://localhost:3002'  // Для разработки
  : '';  // Для продакшена используем относительные пути (nginx прокси)

// Тема приложения, значение по умолчанию - 'dark'
const theme = isTelegramWebApp 
  ? window.Telegram.WebApp.colorScheme || 'dark'
  : 'dark';

export const config = {
  apiUrl,
  
  // Telegram WebApp specific settings
  isTelegramWebApp,
  theme,
  
  // Add other configuration variables as needed
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Интеграция с Telegram
  telegram: {
    useMainButton: isTelegramWebApp,
    useHapticFeedback: isTelegramWebApp,
    enableSharing: isTelegramWebApp,
    
    // Настройки WebApp
    expand: true,                   // Разворачивать на весь экран
    enableClosingConfirmation: true, // Запрашивать подтверждение при закрытии
    headerColor: '#000000',          // Цвет заголовка
    backgroundColor: '#1e1e1e'       // Цвет фона
  }
}; 