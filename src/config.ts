/**
 * Конфигурация приложения
 */

// Environment configuration for the application
// This allows switching between local development and production (GitHub Pages)

// Определяем, запущено ли приложение в Telegram WebApp
const isTelegramWebApp = !!window.Telegram && !!window.Telegram.WebApp;

// Определяем, запущено ли приложение на GitHub Pages
const isGitHubPages = window.location.hostname.includes('github.io');
const isProduction = process.env.NODE_ENV === 'production';

// Default to development API URL
const apiUrl = isProduction || isGitHubPages
  ? '' // Используем относительные пути в продакшене
  : (process.env.REACT_APP_API_URL || 'http://localhost:3002');

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
  isGitHubPages,

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