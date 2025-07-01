# Garden Tap Tap

A clicker/idle mobile game where players tap to collect resources, upgrade tools, and progress through levels.

## Local Development

To run the project locally for testing:

1. Install dependencies for both client and server:
   ```
   cd garden-tap-tap
   npm install
   cd server
   npm install
   cd ..
   ```

2. Start the development server:
   ```
   npm run dev
   ```

   This will start both the React app and the backend server concurrently.

3. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Deployment to GitHub Pages

The project is configured for GitHub Pages deployment:

1. Push your changes to the main branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Access your app at your GitHub Pages URL

### Manual Deployment

You can also deploy manually:

1. Build the project:
   ```
   cd garden-tap-tap
   npm run build
   ```

2. Deploy to GitHub Pages:
   ```
   npx gh-pages -d build
   ```

## Switching Between Local and Production

The app uses environment variables to switch between local and production backends:

- Local development uses http://localhost:3001 for the API
- Production deployments use the URL specified in REACT_APP_API_URL environment variable

To test production mode locally:
```
REACT_APP_API_URL=https://your-api-url.com npm start
```

## Особенности

- 🌳 Локации с уникальными ресурсами (начальная локация - лес)
- 🪓 Прокачка инструментов (топор → ручная пила → бензопила)
- 📊 Система уровней с наградами
- 💾 Сохранение прогресса
- 🔋 Система энергии
- 🌐 Интеграция с Telegram WebApp

## Установка и запуск

### Требования

- Node.js 16+
- npm или yarn

### Установка зависимостей

```bash
npm install
```

или

```bash
yarn install
```

### Запуск проекта

```bash
npm start
```

или

```bash
yarn start
```

### Сборка для production

```bash
npm run build
```

или

```bash
yarn build
```

## Структура проекта

- `/src/components/GameScreen.tsx` - главный экран игры
- `/src/components/LocationSelector.tsx` - компонент выбора локации
- `/src/lib/db.ts` - инициализация SQLite и запросы к базе данных
- `/src/types/index.ts` - типы данных и интерфейсы

## Добавление контента

### Добавление локации

1. Добавьте изображение фона в `/public/assets/backgrounds/`
2. Отредактируйте функцию `seedDatabase()` в `/src/lib/db.ts`
3. Добавьте новый тип валюты в `CurrencyType` в `/src/types/index.ts`

### Добавление инструмента

1. Добавьте изображение инструмента в `/public/assets/tools/`
2. Отредактируйте функцию `seedDatabase()` в `/src/lib/db.ts`

## Адаптация для Telegram Mini App

Игра настроена для работы как Telegram Mini App (TMA). Она использует Telegram WebApp SDK для взаимодействия с Telegram.

## Дальнейшие улучшения

- Добавление новых локаций (огород, зима и др.)
- Внедрение внутриигровых событий
- Оптимизация и улучшение визуальной составляющей
- Добавление звуковых эффектов
