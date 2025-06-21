/**
 * Конфигурация приложения
 */

// Environment configuration for the application
// This allows switching between local development and production (GitHub Pages)

// Определяем, запущено ли приложение на GitHub Pages
const isGitHubPages = window.location.hostname.includes('github.io');

// Default to development API URL
const apiUrl = isGitHubPages 
  ? '.' // Используем относительные пути для GitHub Pages
  : (process.env.REACT_APP_API_URL || 'http://localhost:3002');

export const config = {
  apiUrl,
  
  // Add other configuration variables as needed
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isGitHubPages
}; 