-- Добавление новых таблиц для заданий и прогресса

-- Таблица сезонных заданий
CREATE TABLE IF NOT EXISTS season_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    season_points INTEGER NOT NULL,
    exp INTEGER NOT NULL,
    coins INTEGER NOT NULL,
    FOREIGN KEY(season_id) REFERENCES seasons(id)
);

-- Таблица ежедневных заданий
CREATE TABLE IF NOT EXISTS daily_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    season_points INTEGER NOT NULL,
    exp INTEGER NOT NULL,
    main_coins INTEGER NOT NULL,
    activation_date DATE NOT NULL,
    end_activation_date DATE NOT NULL
);

-- Таблица прогресса игроков по заданиям
CREATE TABLE IF NOT EXISTS player_daily_task_progress (
    user_id TEXT NOT NULL,
    task_id INTEGER NOT NULL,
    task_category TEXT NOT NULL CHECK(task_category IN ('season', 'daily')),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY(user_id, task_id)
);

-- Изменение таблицы player_season, добавление поля для подсчёта тапов за сезон
ALTER TABLE player_season ADD COLUMN taps_total INTEGER NOT NULL DEFAULT 0;

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_season_tasks_season_id ON season_tasks (season_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_activation_date ON daily_tasks (activation_date);
CREATE INDEX IF NOT EXISTS idx_player_daily_task_progress_user_id ON player_daily_task_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_player_daily_task_progress_task_category ON player_daily_task_progress (task_category); 