// Скрипт для обновления структуры базы данных
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Проверяем, существует ли файл базы данных
if (!fs.existsSync(dbPath)) {
  console.error(`Ошибка: база данных не найдена по пути ${dbPath}`);
  process.exit(1);
}

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено.');
  
  // Выполняем миграцию в транзакции
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 1. Обновление таблицы rewards - удаляем лишние записи и меняем структуру
    updateRewardsTable(() => {
      // 2. Обновление таблицы player_currencies - изменяем структуру и чистим дубликаты
      updatePlayerCurrenciesTable(() => {
        // 3. Обновление таблицы locations - заменяем resource_name на currency_id
        updateLocationsTable(() => {
          // 4. Очистка таблицы currencies от лишних валют
          cleanupCurrenciesTable(() => {
            // 5. Создание таблицы character_appearances
            createCharacterAppearancesTable(() => {
              // 6. Обновление таблицы player_progress для добавления столбца last_login
              updatePlayerProgressTable(() => {
                // Коммитим изменения
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Ошибка при завершении транзакции:', err.message);
                    db.run('ROLLBACK');
                  } else {
                    console.log('Миграция успешно выполнена!');
                  }
                  
                  // Закрываем соединение с базой данных
                  db.close((err) => {
                    if (err) {
                      console.error('Ошибка при закрытии базы данных:', err.message);
                    } else {
                      console.log('Соединение с базой данных закрыто.');
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Функция для обновления таблицы rewards
function updateRewardsTable(callback) {
  console.log('Обновление таблицы rewards...');
  
  // 1. Создаем временную таблицу с новой структурой
  db.run(`
    CREATE TABLE rewards_new (
      id INTEGER PRIMARY KEY,
      level_id INTEGER NOT NULL,
      reward_type TEXT NOT NULL,
      currency_id TEXT,
      amount INTEGER,
      target_id INTEGER,
      FOREIGN KEY (level_id) REFERENCES levels (level)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании временной таблицы rewards_new:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    // 2. Копируем данные из старой таблицы, оставляя только валюты и специальные награды
    db.run(`
      INSERT INTO rewards_new (id, level_id, reward_type, currency_id, amount, target_id)
      SELECT id, level_id, reward_type, 
             CASE 
               WHEN reward_type = 'main_currency' THEN 'main'
               WHEN reward_type = 'location_currency' THEN 'forest'
               ELSE NULL
             END as currency_id,
             amount, target_id
      FROM rewards
      WHERE reward_type IN ('main_currency', 'location_currency')
    `, (err) => {
      if (err) {
        console.error('Ошибка при копировании данных в rewards_new:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      // 3. Удаляем старую таблицу
      db.run(`DROP TABLE rewards`, (err) => {
        if (err) {
          console.error('Ошибка при удалении старой таблицы rewards:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // 4. Переименовываем временную таблицу
        db.run(`ALTER TABLE rewards_new RENAME TO rewards`, (err) => {
          if (err) {
            console.error('Ошибка при переименовании таблицы rewards_new:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Таблица rewards успешно обновлена.');
          callback();
        });
      });
    });
  });
}

// Функция для обновления таблицы player_currencies
function updatePlayerCurrenciesTable(callback) {
  console.log('Обновление таблицы player_currencies...');
  
  // 1. Создаем временную таблицу с новой структурой
  db.run(`
    CREATE TABLE player_currencies_new (
      user_id TEXT NOT NULL,
      currency_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, currency_id)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании временной таблицы player_currencies_new:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    // 2. Копируем данные из старой таблицы, нормализуя типы валют и удаляя дубликаты
    db.run(`
      INSERT INTO player_currencies_new (user_id, currency_id, amount)
      SELECT user_id, 
             LOWER(currency_type) as currency_id, 
             MAX(amount) as amount
      FROM player_currencies
      WHERE currency_type IS NOT NULL AND currency_type != 'undefined'
      GROUP BY user_id, LOWER(currency_type)
    `, (err) => {
      if (err) {
        console.error('Ошибка при копировании данных в player_currencies_new:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      // 3. Удаляем старую таблицу
      db.run(`DROP TABLE player_currencies`, (err) => {
        if (err) {
          console.error('Ошибка при удалении старой таблицы player_currencies:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // 4. Переименовываем временную таблицу
        db.run(`ALTER TABLE player_currencies_new RENAME TO player_currencies`, (err) => {
          if (err) {
            console.error('Ошибка при переименовании таблицы player_currencies_new:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Таблица player_currencies успешно обновлена.');
          callback();
        });
      });
    });
  });
}

// Функция для обновления таблицы locations
function updateLocationsTable(callback) {
  console.log('Обновление таблицы locations...');
  
  // 1. Создаем временную таблицу с новой структурой
  db.run(`
    CREATE TABLE locations_new (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      background TEXT NOT NULL,
      currency_id TEXT NOT NULL,
      character_id INTEGER NOT NULL,
      unlock_level INTEGER NOT NULL,
      unlock_cost INTEGER NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании временной таблицы locations_new:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    // 2. Копируем данные из старой таблицы, заменяя resource_name на currency_id
    db.run(`
      INSERT INTO locations_new (id, name, background, currency_id, character_id, unlock_level, unlock_cost)
      SELECT id, name, background, LOWER(currency_type) as currency_id, character_id, unlock_level, unlock_cost
      FROM locations
    `, (err) => {
      if (err) {
        console.error('Ошибка при копировании данных в locations_new:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      // 3. Удаляем старую таблицу
      db.run(`DROP TABLE locations`, (err) => {
        if (err) {
          console.error('Ошибка при удалении старой таблицы locations:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // 4. Переименовываем временную таблицу
        db.run(`ALTER TABLE locations_new RENAME TO locations`, (err) => {
          if (err) {
            console.error('Ошибка при переименовании таблицы locations_new:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Таблица locations успешно обновлена.');
          callback();
        });
      });
    });
  });
}

// Функция для очистки таблицы currencies от лишних валют
function cleanupCurrenciesTable(callback) {
  console.log('Очистка таблицы currencies...');
  
  // Оставляем только валюты 'main' и 'forest'
  db.run(`
    DELETE FROM currencies 
    WHERE LOWER(currency_type) NOT IN ('main', 'forest')
  `, function(err) {
    if (err) {
      console.error('Ошибка при очистке таблицы currencies:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    console.log(`Удалено ${this.changes} лишних валют из таблицы currencies.`);
    
    // Проверяем, есть ли валюты 'main' и 'forest'
    db.all(`
      SELECT LOWER(currency_type) as currency_type 
      FROM currencies
    `, (err, rows) => {
      if (err) {
        console.error('Ошибка при проверке валют:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      const existingCurrencies = rows.map(row => row.currency_type);
      const requiredCurrencies = ['main', 'forest'];
      const missingCurrencies = requiredCurrencies.filter(c => !existingCurrencies.includes(c));
      
      if (missingCurrencies.length > 0) {
        console.log(`Добавляем отсутствующие валюты: ${missingCurrencies.join(', ')}`);
        
        // Добавляем отсутствующие валюты
        const insertPromises = [];
        
        if (!existingCurrencies.includes('main')) {
          insertPromises.push(new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO currencies (name, currency_type, image_path)
              VALUES ('Сад-коин', 'main', '/assets/currencies/garden_coin.png')
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }));
        }
        
        if (!existingCurrencies.includes('forest')) {
          insertPromises.push(new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO currencies (name, currency_type, image_path)
              VALUES ('Дерево', 'forest', '/assets/currencies/wood.png')
            `, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }));
        }
        
        Promise.all(insertPromises)
          .then(() => {
            console.log('Все необходимые валюты добавлены.');
            callback();
          })
          .catch((err) => {
            console.error('Ошибка при добавлении валют:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          });
      } else {
        console.log('Все необходимые валюты уже существуют.');
        callback();
      }
    });
  });
}

// Функция для создания таблицы character_appearances
function createCharacterAppearancesTable(callback) {
  console.log('Создание таблицы character_appearances...');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS character_appearances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      tool_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      animation_type TEXT,
      animation_path TEXT,
      FOREIGN KEY (character_id) REFERENCES characters (id),
      FOREIGN KEY (tool_id) REFERENCES tools (id),
      UNIQUE(character_id, tool_id)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании таблицы character_appearances:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    // Получаем данные о персонажах и инструментах
    db.all(`
      SELECT c.id as character_id, c.name as character_name, 
             c.animation_path as image_path, 
             c.animation_type, c.animation_path,
             t.id as tool_id, t.name as tool_name
      FROM characters c
      JOIN tools t ON t.character_id = c.id
    `, (err, rows) => {
      if (err) {
        console.error('Ошибка при получении данных о персонажах и инструментах:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      if (rows.length === 0) {
        console.log('Нет данных для заполнения таблицы character_appearances.');
        callback();
        return;
      }
      
      // Вставляем данные в новую таблицу
      const insertAppearance = db.prepare(`
        INSERT OR IGNORE INTO character_appearances 
        (character_id, tool_id, image_path, animation_type, animation_path)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      let insertCount = 0;
      
      rows.forEach(row => {
        insertAppearance.run(
          row.character_id,
          row.tool_id,
          row.image_path,
          row.animation_type,
          row.animation_path,
          function(err) {
            if (err) {
              console.error(`Ошибка при добавлении внешнего вида для персонажа ${row.character_name} с инструментом ${row.tool_name}:`, err.message);
            } else if (this.changes > 0) {
              insertCount++;
              console.log(`Добавлен внешний вид для персонажа ${row.character_name} с инструментом ${row.tool_name}.`);
            }
          }
        );
      });
      
      insertAppearance.finalize();
      
      console.log(`Добавлено ${insertCount} записей в таблицу character_appearances.`);
      callback();
    });
  });
}

// Функция для обновления таблицы player_progress
function updatePlayerProgressTable(callback) {
  console.log('Обновление таблицы player_progress...');
  
  // Проверяем, есть ли столбец last_login в таблице player_progress
  db.all("PRAGMA table_info(player_progress)", (err, columns) => {
    if (err) {
      console.error('Ошибка при получении информации о таблице player_progress:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    
    // Проверяем, есть ли столбец last_login
    const hasLastLogin = columns.some(column => column.name === 'last_login');
    
    if (!hasLastLogin) {
      console.log('Столбец last_login не найден, добавляем...');
      
      // Добавляем столбец last_login
      db.run(`ALTER TABLE player_progress ADD COLUMN last_login TEXT DEFAULT CURRENT_TIMESTAMP`, (err) => {
        if (err) {
          console.error('Ошибка при добавлении столбца last_login:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        console.log('Столбец last_login успешно добавлен в таблицу player_progress');
        
        // Инициализируем значения last_login текущим временем для существующих записей
        db.run('UPDATE player_progress SET last_login = CURRENT_TIMESTAMP', (err) => {
          if (err) {
            console.error('Ошибка при инициализации значений last_login:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Значения last_login успешно инициализированы');
          callback();
        });
      });
    } else {
      console.log('Столбец last_login уже существует в таблице player_progress');
      callback();
    }
  });
} 