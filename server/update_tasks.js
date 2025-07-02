const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Проверяем, существует ли файл базы данных
if (!fs.existsSync(dbPath)) {
  console.error('Ошибка: файл базы данных не найден:', dbPath);
  process.exit(1);
}

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('База данных открыта успешно.');
  
  // Начинаем обновление структуры таблицы
  updateTables();
});

// Функция для выполнения запроса к базе данных
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        console.error('Ошибка при выполнении запроса:', query);
        console.error(err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

// Функция для проверки существования столбца в таблице
function columnExists(table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const exists = rows.some(row => row.name === column);
      resolve(exists);
    });
  });
}

// Функция обновления структуры таблицы
async function updateTables() {
  try {
    // Проверяем существование таблицы player_daily_task_progress
    const tableExists = await new Promise((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='player_daily_task_progress'", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ? true : false);
      });
    });
    
    if (!tableExists) {
      console.log('Таблица player_daily_task_progress не существует, создаём...');
      await runQuery(`
        CREATE TABLE IF NOT EXISTS player_daily_task_progress (
          user_id TEXT NOT NULL,
          task_id INTEGER NOT NULL,
          task_category TEXT NOT NULL CHECK("task_category" IN ('season', 'daily')),
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          progress INTEGER NOT NULL DEFAULT 0,
          reward_claimed INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY("user_id","task_id")
        )
      `);
      console.log('Таблица player_daily_task_progress создана.');
    } else {
      console.log('Таблица player_daily_task_progress существует.');
      
      // Проверяем наличие столбца progress
      const progressColumnExists = await columnExists('player_daily_task_progress', 'progress');
      if (!progressColumnExists) {
        console.log('Добавляем столбец progress...');
        await runQuery('ALTER TABLE player_daily_task_progress ADD COLUMN progress INTEGER NOT NULL DEFAULT 0');
        console.log('Столбец progress добавлен.');
      } else {
        console.log('Столбец progress уже существует.');
      }
      
      // Проверяем наличие столбца reward_claimed
      const rewardClaimedColumnExists = await columnExists('player_daily_task_progress', 'reward_claimed');
      if (!rewardClaimedColumnExists) {
        console.log('Добавляем столбец reward_claimed...');
        await runQuery('ALTER TABLE player_daily_task_progress ADD COLUMN reward_claimed INTEGER NOT NULL DEFAULT 0');
        console.log('Столбец reward_claimed добавлен.');
      } else {
        console.log('Столбец reward_claimed уже существует.');
      }
    }
    
    // Обновляем существующие записи - помечаем завершенные задания с progress равным target_value
    console.log('Обновляем прогресс для завершенных заданий...');
    await runQuery(`
      UPDATE player_daily_task_progress
      SET progress = (
        SELECT target_value 
        FROM daily_tasks 
        WHERE id = player_daily_task_progress.task_id
      )
      WHERE task_category = 'daily' AND completed = 1
    `);
    
    await runQuery(`
      UPDATE player_daily_task_progress
      SET progress = (
        SELECT target_value 
        FROM season_tasks 
        WHERE id = player_daily_task_progress.task_id
      )
      WHERE task_category = 'season' AND completed = 1
    `);
    
    // Создаем индекс для ускорения поиска по типу задания
    console.log('Создаём индексы...');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_player_daily_task_progress_task_category_completed ON player_daily_task_progress (task_category, completed)');
    
    console.log('Обновление структуры базы данных завершено успешно!');
    
    // Закрываем базу данных
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err.message);
      } else {
        console.log('База данных закрыта.');
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('Произошла ошибка при обновлении структуры базы данных:', error);
    db.close();
    process.exit(1);
  }
} 