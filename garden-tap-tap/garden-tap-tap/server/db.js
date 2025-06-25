const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Константы для типов валют и наград
const CurrencyType = {
  MAIN: 'main',
  FOREST: 'forest'
};

const RewardType = {
  MAIN_CURRENCY: 'main_currency',
  LOCATION_CURRENCY: 'location_currency',
  UNLOCK_TOOL: 'unlock_tool',
  UNLOCK_LOCATION: 'unlock_location',
  ENERGY: 'energy'
};

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Объект для работы с базой данных
let dbInstance = null;

// Промисифицированные методы для работы с базой данных
const db = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbInstance.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  },
  
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbInstance.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbInstance.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  
  prepare: (sql) => {
    return dbInstance.prepare(sql);
  }
};

// Создание таблиц
const createTables = () => {
  return new Promise((resolve, reject) => {
    // Таблица локаций
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        background TEXT NOT NULL,
        resource_name TEXT NOT NULL,
        character_id INTEGER NOT NULL,
        unlock_level INTEGER NOT NULL,
        unlock_cost INTEGER NOT NULL,
        currency_type TEXT NOT NULL
      )
    `, (err) => {
      if (err) return reject(err);

      // Таблица персонажей
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS characters (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          animation_type TEXT NOT NULL,
          animation_path TEXT NOT NULL,
          frame_count INTEGER
        )
      `, (err) => {
        if (err) return reject(err);

        // Таблица инструментов
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            character_id INTEGER NOT NULL,
            power INTEGER NOT NULL,
            unlock_level INTEGER NOT NULL,
            unlock_cost INTEGER NOT NULL,
            currency_type TEXT NOT NULL,
            image_path TEXT NOT NULL
          )
        `, (err) => {
          if (err) return reject(err);

          // Таблица уровней
          dbInstance.run(`
            CREATE TABLE IF NOT EXISTS levels (
              level INTEGER PRIMARY KEY,
              required_exp INTEGER NOT NULL
            )
          `, (err) => {
            if (err) return reject(err);

            // Таблица наград
            dbInstance.run(`
              CREATE TABLE IF NOT EXISTS rewards (
                id INTEGER PRIMARY KEY,
                level_id INTEGER NOT NULL,
                reward_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                target_id INTEGER,
                FOREIGN KEY (level_id) REFERENCES levels (level)
              )
            `, (err) => {
              if (err) return reject(err);

              // Таблица прогресса игрока
              dbInstance.run(`
                CREATE TABLE IF NOT EXISTS player_progress (
                  user_id TEXT NOT NULL,
                  level INTEGER NOT NULL DEFAULT 1,
                  experience INTEGER NOT NULL DEFAULT 0,
                  energy INTEGER NOT NULL DEFAULT 100,
                  max_energy INTEGER NOT NULL DEFAULT 100,
                  last_energy_refill_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (user_id)
                )
              `, (err) => {
                if (err) return reject(err);

                // Таблица валют игрока
                dbInstance.run(`
                  CREATE TABLE IF NOT EXISTS player_currencies (
                    user_id TEXT NOT NULL,
                    currency_type TEXT NOT NULL,
                    amount INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, currency_type)
                  )
                `, (err) => {
                  if (err) return reject(err);

                  // Таблица разблокированных локаций
                  dbInstance.run(`
                    CREATE TABLE IF NOT EXISTS player_locations (
                      user_id TEXT NOT NULL,
                      location_id INTEGER NOT NULL,
                      PRIMARY KEY (user_id, location_id),
                      FOREIGN KEY (location_id) REFERENCES locations (id)
                    )
                  `, (err) => {
                    if (err) return reject(err);

                    // Таблица разблокированных инструментов
                    dbInstance.run(`
                      CREATE TABLE IF NOT EXISTS player_tools (
                        user_id TEXT NOT NULL,
                        tool_id INTEGER NOT NULL,
                        PRIMARY KEY (user_id, tool_id),
                        FOREIGN KEY (tool_id) REFERENCES tools (id)
                      )
                    `, (err) => {
                      if (err) return reject(err);

                      // Таблица снаряженных инструментов
                      dbInstance.run(`
                        CREATE TABLE IF NOT EXISTS player_equipped_tools (
                          user_id TEXT NOT NULL,
                          character_id INTEGER NOT NULL,
                          tool_id INTEGER NOT NULL,
                          PRIMARY KEY (user_id, character_id),
                          FOREIGN KEY (character_id) REFERENCES characters (id),
                          FOREIGN KEY (tool_id) REFERENCES tools (id)
                        )
                      `, (err) => {
                        if (err) return reject(err);
                        resolve();
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
  });
};

// Заполнение базы начальными данными
const seedDatabase = () => {
  return new Promise((resolve, reject) => {
    // Проверяем, есть ли уже данные в базе
    dbInstance.get("SELECT COUNT(*) as count FROM locations", (err, row) => {
      if (err) return reject(err);

      // Если есть хотя бы одна локация, не заполняем данными
      if (row && row.count > 0) {
        return resolve();
      }

      // Добавляем персонажей
      dbInstance.run(`
        INSERT INTO characters (id, name, animation_type, animation_path, frame_count)
        VALUES (?, ?, ?, ?, ?)
      `, [1, 'Лесоруб', 'gif', '/assets/characters/lumberjack.gif', null], (err) => {
        if (err) return reject(err);

        // Добавляем инструменты
        const insertTool = dbInstance.prepare(`
          INSERT INTO tools (id, name, character_id, power, unlock_level, unlock_cost, currency_type, image_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertTool.run(1, 'Топор', 1, 1, 1, 0, CurrencyType.FOREST, '/assets/tools/axe.png', (err) => {
          if (err) return reject(err);

          insertTool.run(2, 'Ручная пила', 1, 3, 5, 300, CurrencyType.FOREST, '/assets/tools/handsaw.png', (err) => {
            if (err) return reject(err);

            insertTool.run(3, 'Бензопила', 1, 10, 10, 1000, CurrencyType.FOREST, '/assets/tools/chainsaw.png', (err) => {
              if (err) return reject(err);
              insertTool.finalize();

              // Добавляем локации
              dbInstance.run(`
                INSERT INTO locations (id, name, background, resource_name, character_id, unlock_level, unlock_cost, currency_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [1, 'Лес', '/assets/backgrounds/forest.jpg', 'Брёвна', 1, 1, 0, CurrencyType.MAIN], (err) => {
                if (err) return reject(err);

                // Добавляем уровни (первые 20)
                const insertLevel = dbInstance.prepare(`
                  INSERT INTO levels (level, required_exp)
                  VALUES (?, ?)
                `);

                // Создаем Promise для каждого уровня
                const levelPromises = [];
                for (let i = 1; i <= 20; i++) {
                  const requiredExp = Math.floor(100 * Math.pow(1.5, i - 1));
                  levelPromises.push(
                    new Promise((resolve, reject) => {
                      insertLevel.run(i, requiredExp, (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                    })
                  );
                }

                // Дожидаемся завершения вставки всех уровней
                Promise.all(levelPromises)
                  .then(() => {
                    insertLevel.finalize();

                    // Добавляем награды за уровни
                    const insertReward = dbInstance.prepare(`
                      INSERT INTO rewards (id, level_id, reward_type, amount, target_id)
                      VALUES (?, ?, ?, ?, ?)
                    `);

                    // Создаем Promise для каждой награды
                    const rewardData = [
                      [1, 1, RewardType.MAIN_CURRENCY, 100, null],
                      [2, 2, RewardType.MAIN_CURRENCY, 200, null],
                      [3, 3, RewardType.MAIN_CURRENCY, 300, null],
                      [4, 4, RewardType.MAIN_CURRENCY, 400, null],
                      [5, 5, RewardType.UNLOCK_TOOL, 0, 2], // Разблокировка ручной пилы
                      [6, 6, RewardType.MAIN_CURRENCY, 600, null],
                      [7, 7, RewardType.MAIN_CURRENCY, 700, null],
                      [8, 8, RewardType.MAIN_CURRENCY, 800, null],
                      [9, 9, RewardType.MAIN_CURRENCY, 900, null],
                      [10, 10, RewardType.UNLOCK_TOOL, 0, 3], // Разблокировка бензопилы
                    ];

                    const rewardPromises = rewardData.map(data => {
                      return new Promise((resolve, reject) => {
                        insertReward.run(...data, (err) => {
                          if (err) reject(err);
                          else resolve();
                        });
                      });
                    });

                    // Дожидаемся завершения вставки всех наград
                    Promise.all(rewardPromises)
                      .then(() => {
                        insertReward.finalize();
                        resolve();
                      })
                      .catch(reject);
                  })
                  .catch(reject);
              });
            });
          });
        });
      });
    });
  });
};

// Инициализация базы данных
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Проверяем, существует ли файл базы данных
    const fileExists = fs.existsSync(dbPath);
    
    // Открываем или создаем базу данных
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка при открытии базы данных:', err.message);
        return reject(err);
      }
      
      // Устанавливаем режим для обеспечения целостности данных
      dbInstance.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Ошибка при установке PRAGMA:', err.message);
          return reject(err);
        }
        
        // Создаем таблицы, если нужно
        createTables()
          .then(() => {
            // Заполняем базу начальными данными, если нужно
            return seedDatabase();
          })
          .then(() => {
            console.log('База данных инициализирована успешно');
            resolve();
          })
          .catch((err) => {
            console.error('Ошибка при инициализации базы данных:', err);
            reject(err);
          });
      });
    });
  });
};

// Экспортируем объекты и функции для работы с базой данных
module.exports = {
  db,
  initDatabase,
  CurrencyType,
  RewardType
}; 