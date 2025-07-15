const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Открываем соединение с базой данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при подключении к базе данных:', err.message);
    process.exit(1);
  }
  console.log('Подключение к базе данных установлено');
});

// Создаем недостающие таблицы
const createMissingTables = async () => {
  try {
    console.log('Создание недостающих таблиц...');

    // Создаем таблицу player_tools
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS player_tools (
          user_id TEXT NOT NULL,
          tool_id INTEGER NOT NULL,
          PRIMARY KEY (user_id, tool_id),
          FOREIGN KEY (tool_id) REFERENCES tools (id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица player_tools создана');
          resolve();
        }
      });
    });

    // Создаем таблицу currencies
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS currencies (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          image_path TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица currencies создана');
          resolve();
        }
      });
    });

    // Создаем таблицу ranks
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS ranks (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          min_points INTEGER NOT NULL,
          image_path TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица ranks создана');
          resolve();
        }
      });
    });

    // Создаем таблицу seasons
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS seasons (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          start_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT FALSE
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица seasons создана');
          resolve();
        }
      });
    });

    // Создаем таблицу player_profile
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS player_profile (
          user_id TEXT PRIMARY KEY,
          current_rank_id INTEGER,
          highest_rank_id INTEGER,
          last_rank_id INTEGER,
          featured_achievement_id INTEGER,
          avatar_path TEXT,
          total_points INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (current_rank_id) REFERENCES ranks (id),
          FOREIGN KEY (featured_achievement_id) REFERENCES achievements (id),
          FOREIGN KEY (highest_rank_id) REFERENCES ranks (id),
          FOREIGN KEY (last_rank_id) REFERENCES ranks (id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица player_profile создана');
          resolve();
        }
      });
    });

    // Создаем таблицу player_season
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS player_season (
          user_id TEXT NOT NULL,
          season_id INTEGER NOT NULL,
          points INTEGER NOT NULL DEFAULT 0,
          rank_id INTEGER,
          highest_rank_id INTEGER,
          taps_total INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, season_id),
          FOREIGN KEY (highest_rank_id) REFERENCES ranks (id),
          FOREIGN KEY (rank_id) REFERENCES ranks (id),
          FOREIGN KEY (season_id) REFERENCES seasons (id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Таблица player_season создана');
          resolve();
        }
      });
    });

    // Добавляем колонку unlock_rank в таблицу tools если её нет
    await new Promise((resolve, reject) => {
      db.run(`
        ALTER TABLE tools ADD COLUMN unlock_rank INTEGER NOT NULL DEFAULT 1
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('Колонка unlock_rank добавлена в таблицу tools');
          resolve();
        }
      });
    });

    // Добавляем колонки main_coins_power и location_coins_power в таблицу tools если их нет
    await new Promise((resolve, reject) => {
      db.run(`
        ALTER TABLE tools ADD COLUMN main_coins_power INTEGER NOT NULL DEFAULT 0
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('Колонка main_coins_power добавлена в таблицу tools');
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      db.run(`
        ALTER TABLE tools ADD COLUMN location_coins_power INTEGER NOT NULL DEFAULT 0
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('Колонка location_coins_power добавлена в таблицу tools');
          resolve();
        }
      });
    });

    // Заполняем базовые данные если их нет
    console.log('Заполнение базовых данных...');

    // Добавляем валюты
    await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM currencies", (err, row) => {
        if (err) return reject(err);
        
        if (row.count === 0) {
          const currencies = [
            [1, 'Брёвна', 'WOOD', '/assets/currencies/wood.png'],
            [2, 'Грязь', 'DIRT', '/assets/currencies/dirt.png'],
            [3, 'Сорняки', 'WEED', '/assets/currencies/weed.png'],
            [4, 'Зерно', 'GRAIN', '/assets/currencies/grain.png'],
            [5, 'Монеты', 'COINS', '/assets/currencies/coins.png']
          ];
          
          const stmt = db.prepare("INSERT INTO currencies (id, name, code, image_path) VALUES (?, ?, ?, ?)");
          currencies.forEach(currency => {
            stmt.run(currency);
          });
          stmt.finalize();
          console.log('Валюты добавлены');
        }
        resolve();
      });
    });

    // Добавляем ранги
    await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM ranks", (err, row) => {
        if (err) return reject(err);
        
        if (row.count === 0) {
          const ranks = [
            [1, 'Бронза I', 0, '/assets/ranks/bronze_1.png'],
            [2, 'Бронза II', 100, '/assets/ranks/bronze_2.png'],
            [3, 'Серебро I', 300, '/assets/ranks/silver_1.png'],
            [4, 'Серебро II', 600, '/assets/ranks/silver_2.png'],
            [5, 'Золото I', 1000, '/assets/ranks/gold_1.png'],
            [6, 'Золото II', 1500, '/assets/ranks/gold_2.png'],
            [7, 'Платина', 2200, '/assets/ranks/platinum.png'],
            [8, 'Бриллиант', 3000, '/assets/ranks/diamond.png'],
            [9, 'Легенда', 5000, '/assets/ranks/legend.png']
          ];
          
          const stmt = db.prepare("INSERT INTO ranks (id, name, min_points, image_path) VALUES (?, ?, ?, ?)");
          ranks.forEach(rank => {
            stmt.run(rank);
          });
          stmt.finalize();
          console.log('Ранги добавлены');
        }
        resolve();
      });
    });

    // Добавляем сезон
    await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM seasons", (err, row) => {
        if (err) return reject(err);
        
        if (row.count === 0) {
          const today = new Date();
          const endDate = new Date();
          endDate.setMonth(today.getMonth() + 3);
          
          db.run("INSERT INTO seasons (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)", 
            [1, 'Сезон 1', today.toISOString(), endDate.toISOString(), true], (err) => {
            if (err) return reject(err);
            console.log('Сезон добавлен');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    // Обновляем данные инструментов с unlock_rank
    await new Promise((resolve, reject) => {
      const toolUpdates = [
        [1, 1, 1, 1], // Топор - ранг 1
        [3, 3, 3, 3], // Ручная пила - ранг 3  
        [4, 10, 10, 10], // Бензопила - ранг 4
        [2, 5, 5, 5], // Мешок для мусора - ранг 2
      ];
      
      const stmt = db.prepare("UPDATE tools SET unlock_rank = ?, main_coins_power = ?, location_coins_power = ? WHERE id = ?");
      toolUpdates.forEach(([rank, mainPower, locationPower, id]) => {
        stmt.run(rank, mainPower, locationPower, id);
      });
      stmt.finalize();
      console.log('Данные инструментов обновлены');
      resolve();
    });

    console.log('Все недостающие таблицы созданы и заполнены!');
    
  } catch (error) {
    console.error('Ошибка при создании таблиц:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err);
      } else {
        console.log('База данных закрыта');
      }
      process.exit(0);
    });
  }
};

// Запускаем создание таблиц
createMissingTables(); 