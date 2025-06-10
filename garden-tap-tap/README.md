# Garden Tap Tap 2

Garden Tap Tap 2 - это простая кликер-игра для Telegram Mini App, построенная на React и TailwindCSS с SQLite для хранения данных.

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
