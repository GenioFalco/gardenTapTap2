-- Добавляем новые столбцы в таблицу player_daily_task_progress
ALTER TABLE player_daily_task_progress ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_daily_task_progress ADD COLUMN reward_claimed INTEGER NOT NULL DEFAULT 0;

-- Обновляем существующие записи - помечаем завершенные задания с progress равным target_value
UPDATE player_daily_task_progress
SET progress = (
  SELECT target_value 
  FROM daily_tasks 
  WHERE id = player_daily_task_progress.task_id
)
WHERE task_category = 'daily' AND completed = 1;

UPDATE player_daily_task_progress
SET progress = (
  SELECT target_value 
  FROM season_tasks 
  WHERE id = player_daily_task_progress.task_id
)
WHERE task_category = 'season' AND completed = 1;

-- Создаем индекс для ускорения поиска по типу задания
CREATE INDEX IF NOT EXISTS idx_player_daily_task_progress_task_category_completed ON player_daily_task_progress (task_category, completed);

-- Добавляем проверку на наличие нужных колонок в таблице daily_tasks
PRAGMA table_info(daily_tasks);

-- Проверяем, что таблица player_daily_task_progress существует и имеет все необходимые поля
PRAGMA table_info(player_daily_task_progress); 