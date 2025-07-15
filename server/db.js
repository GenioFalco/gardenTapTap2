const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Константы для типов валют и наград
const CurrencyType = {
  MAIN: 1,   // ID валюты "Монеты"
  FOREST: 2, // ID валюты "Брёвна"
  DIRT: 3,   // ID валюты "Грязь"
  WEED: 4,   // ID валюты "Сорняки"
  FARM: 5    // ID валюты "Зерно"
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
    // Таблица валют
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS currencies (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        image_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) return reject(err);

      // Таблица локаций
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          background TEXT NOT NULL,
          currency_id INTEGER NOT NULL,
          character_id INTEGER NOT NULL,
          unlock_level INTEGER NOT NULL,
          unlock_cost INTEGER NOT NULL,
          FOREIGN KEY (character_id) REFERENCES characters (id),
          FOREIGN KEY (currency_id) REFERENCES currencies (id)
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
              unlock_rank INTEGER NOT NULL DEFAULT 1,
              currency_type TEXT NOT NULL,
              image_path TEXT NOT NULL,
              main_coins_power INTEGER NOT NULL DEFAULT 0,
              location_coins_power INTEGER NOT NULL DEFAULT 0,
              FOREIGN KEY (character_id) REFERENCES characters (id)
            )
          `, (err) => {
            if (err) return reject(err);

            // Таблица помощников
            dbInstance.run(`
              CREATE TABLE IF NOT EXISTS helpers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                location_id INTEGER NOT NULL,
                unlock_level INTEGER NOT NULL,
                unlock_cost INTEGER NOT NULL,
                unlock_rank INTEGER NOT NULL DEFAULT 1,
                currency_id INTEGER NOT NULL,
                max_level INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                FOREIGN KEY (currency_id) REFERENCES currencies (id),
                FOREIGN KEY (location_id) REFERENCES locations (id)
              )
            `, (err) => {
              if (err) return reject(err);

              // Таблица уровней помощников
              dbInstance.run(`
                CREATE TABLE IF NOT EXISTS helper_levels (
                  helper_id INTEGER NOT NULL,
                  level INTEGER NOT NULL,
                  income_per_hour REAL NOT NULL,
                  upgrade_cost INTEGER NOT NULL,
                  currency_id INTEGER NOT NULL,
                  PRIMARY KEY (helper_id, level),
                  FOREIGN KEY (currency_id) REFERENCES currencies (id),
                  FOREIGN KEY (helper_id) REFERENCES helpers (id)
                )
              `, (err) => {
                if (err) return reject(err);

                // Таблица рангов
                dbInstance.run(`
                  CREATE TABLE IF NOT EXISTS ranks (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    min_points INTEGER NOT NULL,
                    image_path TEXT NOT NULL
                  )
                `, (err) => {
                  if (err) return reject(err);

                  // Таблица сезонов
                  dbInstance.run(`
                    CREATE TABLE IF NOT EXISTS seasons (
                      id INTEGER PRIMARY KEY,
                      name TEXT NOT NULL,
                      start_date TIMESTAMP NOT NULL,
                      end_date TIMESTAMP NOT NULL,
                      description TEXT,
                      is_active BOOLEAN DEFAULT FALSE
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
                          currency_id INTEGER,
                          amount INTEGER,
                          target_id INTEGER,
                          FOREIGN KEY (currency_id) REFERENCES currencies (id),
                          FOREIGN KEY (level_id) REFERENCES levels (level)
                        )
                      `, (err) => {
                        if (err) return reject(err);

                        // Таблица достижений
                        dbInstance.run(`
                          CREATE TABLE IF NOT EXISTS achievements (
                            id INTEGER PRIMARY KEY,
                            name TEXT NOT NULL,
                            description TEXT NOT NULL,
                            condition_type TEXT NOT NULL,
                            condition_value INTEGER NOT NULL,
                            image_path TEXT NOT NULL
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
                              last_login TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                              PRIMARY KEY (user_id)
                            )
                          `, (err) => {
                            if (err) return reject(err);

                            // Таблица профиля игрока
                            dbInstance.run(`
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
                              if (err) return reject(err);

                              // Таблица сезонного прогресса игрока
                              dbInstance.run(`
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
                                if (err) return reject(err);

                                // Таблица валют игрока
                                dbInstance.run(`
                                  CREATE TABLE IF NOT EXISTS player_currencies (
                                    user_id TEXT NOT NULL,
                                    currency_id INTEGER NOT NULL,
                                    amount REAL NOT NULL DEFAULT 0,
                                    PRIMARY KEY (user_id, currency_id),
                                    FOREIGN KEY (currency_id) REFERENCES currencies (id)
                                  )
                                `, (err) => {
                                  if (err) return reject(err);

                                  // Таблица инструментов игрока
                                  dbInstance.run(`
                                    CREATE TABLE IF NOT EXISTS player_tools (
                                      user_id TEXT NOT NULL,
                                      tool_id INTEGER NOT NULL,
                                      PRIMARY KEY (user_id, tool_id),
                                      FOREIGN KEY (tool_id) REFERENCES tools (id)
                                    )
                                  `, (err) => {
                                    if (err) return reject(err);

                                    // Таблица помощников игрока
                                    dbInstance.run(`
                                      CREATE TABLE IF NOT EXISTS player_helpers (
                                        user_id TEXT NOT NULL,
                                        helper_id INTEGER NOT NULL,
                                        level INTEGER NOT NULL DEFAULT 1,
                                        PRIMARY KEY (user_id, helper_id),
                                        FOREIGN KEY (helper_id) REFERENCES helpers (id)
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

                                        // Таблица достижений игрока
                                        dbInstance.run(`
                                          CREATE TABLE IF NOT EXISTS player_achievements (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            user_id TEXT NOT NULL,
                                            achievement_id INTEGER NOT NULL,
                                            date_unlocked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                            UNIQUE(user_id, achievement_id)
                                          )
                                        `, (err) => {
                                          if (err) return reject(err);

                                          // Таблица экипированных инструментов
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
                                            
                                            // Таблица накопленной прибыли от помощников
                                            dbInstance.run(`
                                              CREATE TABLE IF NOT EXISTS player_pending_income (
                                                user_id TEXT NOT NULL,
                                                currency_id INTEGER NOT NULL,
                                                amount REAL NOT NULL DEFAULT 0,
                                                PRIMARY KEY (user_id, currency_id),
                                                FOREIGN KEY (currency_id) REFERENCES currencies (id)
                                              )
                                            `, (err) => {
                                              if (err) return reject(err);
                                              
                                              resolve(dbInstance);
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
    dbInstance.get("SELECT COUNT(*) as count FROM currencies", (err, row) => {
      if (err) return reject(err);

      // Если есть хотя бы одна валюта, не заполняем данными
      if (row && row.count > 0) {
        return resolve();
      }

      // Добавляем валюты
      const insertCurrency = dbInstance.prepare(`
        INSERT INTO currencies (id, name, code, image_path)
        VALUES (?, ?, ?, ?)
      `);

      insertCurrency.run(1, 'Брёвна', 'WOOD', '/assets/currencies/wood.png');
      insertCurrency.run(2, 'Грязь', 'DIRT', '/assets/currencies/dirt.png');
      insertCurrency.run(3, 'Сорняки', 'WEED', '/assets/currencies/weed.png');
      insertCurrency.run(4, 'Зерно', 'GRAIN', '/assets/currencies/grain.png');
      insertCurrency.run(5, 'Монеты', 'COINS', '/assets/currencies/coins.png');
      insertCurrency.finalize();

      // Добавляем персонажей
      const insertCharacter = dbInstance.prepare(`
        INSERT INTO characters (id, name, animation_type, animation_path, frame_count)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertCharacter.run(1, 'Лесоруб', 'gif', '/assets/characters/lumberjack.gif', null);
      insertCharacter.run(2, 'Садовник', 'gif', '/assets/characters/gardener.gif', null);
      insertCharacter.run(3, 'Фермер', 'gif', '/assets/characters/farmer.gif', null);
      insertCharacter.finalize();

      // Добавляем ранги
      const insertRank = dbInstance.prepare(`
        INSERT INTO ranks (id, name, min_points, image_path)
        VALUES (?, ?, ?, ?)
      `);

      insertRank.run(1, 'Бронза I', 0, '/assets/ranks/bronze_1.png');
      insertRank.run(2, 'Бронза II', 100, '/assets/ranks/bronze_2.png');
      insertRank.run(3, 'Серебро I', 300, '/assets/ranks/silver_1.png');
      insertRank.run(4, 'Серебро II', 600, '/assets/ranks/silver_2.png');
      insertRank.run(5, 'Золото I', 1000, '/assets/ranks/gold_1.png');
      insertRank.run(6, 'Золото II', 1500, '/assets/ranks/gold_2.png');
      insertRank.run(7, 'Платина', 2200, '/assets/ranks/platinum.png');
      insertRank.run(8, 'Бриллиант', 3000, '/assets/ranks/diamond.png');
      insertRank.run(9, 'Легенда', 5000, '/assets/ranks/legend.png');
      insertRank.finalize();

      // Добавляем сезоны
      const today = new Date();
      const endDate = new Date();
      endDate.setMonth(today.getMonth() + 3); // 3 месяца

      dbInstance.run(`
        INSERT INTO seasons (id, name, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [1, 'Сезон 1', today.toISOString(), endDate.toISOString(), true], (err) => {
        if (err) return reject(err);

        // Добавляем локации
        const insertLocation = dbInstance.prepare(`
          INSERT INTO locations (id, name, background, currency_id, character_id, unlock_level, unlock_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertLocation.run(1, 'Лес', '/assets/backgrounds/forest.jpg', 1, 1, 1, 0);
        insertLocation.run(2, 'Сад', '/assets/backgrounds/garden.jpg', 2, 2, 5, 100);
        insertLocation.run(3, 'Ферма', '/assets/backgrounds/farm.jpg', 4, 3, 10, 500);
        insertLocation.finalize();

        // Добавляем инструменты
        const insertTool = dbInstance.prepare(`
          INSERT INTO tools (id, name, character_id, power, unlock_level, unlock_cost, unlock_rank, currency_type, image_path, main_coins_power, location_coins_power)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Инструменты для лесоруба
        insertTool.run(1, 'Топор', 1, 1, 1, 0, 1, 'WOOD', '/assets/tools/axe.png', 1, 1);
        insertTool.run(2, 'Ручная пила', 1, 3, 5, 300, 3, 'WOOD', '/assets/tools/handsaw.png', 3, 3);
        insertTool.run(3, 'Бензопила', 1, 10, 10, 1000, 4, 'WOOD', '/assets/tools/chainsaw.png', 10, 10);

        // Инструменты для садовника
        insertTool.run(4, 'Лопата', 2, 1, 1, 0, 1, 'DIRT', '/assets/tools/shovel.png', 1, 1);
        insertTool.run(5, 'Грабли', 2, 2, 3, 150, 2, 'DIRT', '/assets/tools/rake.png', 2, 2);
        insertTool.run(6, 'Мешок для мусора', 2, 5, 7, 500, 2, 'DIRT', '/assets/tools/trash_bag.png', 5, 5);

        // Инструменты для фермера
        insertTool.run(7, 'Коса', 3, 1, 1, 0, 1, 'GRAIN', '/assets/tools/scythe.png', 1, 1);
        insertTool.run(8, 'Серп', 3, 3, 5, 200, 2, 'GRAIN', '/assets/tools/sickle.png', 3, 3);
        insertTool.run(9, 'Комбайн', 3, 8, 12, 800, 3, 'GRAIN', '/assets/tools/harvester.png', 8, 8);
        insertTool.finalize();

        // Добавляем помощников
        const insertHelper = dbInstance.prepare(`
          INSERT INTO helpers (id, name, location_id, unlock_level, unlock_cost, unlock_rank, currency_id, max_level, image_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Помощники для леса
        insertHelper.run(1, 'Дровосек', 1, 3, 100, 2, 1, 10, '/assets/helpers/lumberjack_helper.png');
        insertHelper.run(2, 'Лесник', 1, 8, 500, 3, 1, 15, '/assets/helpers/forester.png');

        // Помощники для сада
        insertHelper.run(3, 'Садовник-помощник', 2, 6, 200, 2, 2, 10, '/assets/helpers/garden_helper.png');
        insertHelper.run(4, 'Ландшафтный дизайнер', 2, 12, 800, 4, 2, 15, '/assets/helpers/landscaper.png');

        // Помощники для фермы
        insertHelper.run(5, 'Фермер-помощник', 3, 11, 400, 2, 4, 10, '/assets/helpers/farm_helper.png');
        insertHelper.run(6, 'Агроном', 3, 15, 1000, 5, 4, 15, '/assets/helpers/agronomist.png');
        insertHelper.finalize();

        // Добавляем уровни помощников
        const insertHelperLevel = dbInstance.prepare(`
          INSERT INTO helper_levels (helper_id, level, income_per_hour, upgrade_cost, currency_id)
          VALUES (?, ?, ?, ?, ?)
        `);

        // Уровни для каждого помощника (10 уровней)
        for (let helperId = 1; helperId <= 6; helperId++) {
          const currencyId = helperId <= 2 ? 1 : (helperId <= 4 ? 2 : 4);
          for (let level = 1; level <= 10; level++) {
            const income = Math.floor(10 * level * Math.pow(1.5, level - 1));
            const cost = Math.floor(50 * level * Math.pow(1.8, level - 1));
            insertHelperLevel.run(helperId, level, income, cost, currencyId);
          }
        }
        insertHelperLevel.finalize();

        // Добавляем уровни игрока
        const insertLevel = dbInstance.prepare(`
          INSERT INTO levels (level, required_exp)
          VALUES (?, ?)
        `);

        for (let i = 1; i <= 50; i++) {
          const requiredExp = Math.floor(100 * Math.pow(1.5, i - 1));
          insertLevel.run(i, requiredExp);
        }
        insertLevel.finalize();

        // Добавляем награды за уровни
        const insertReward = dbInstance.prepare(`
          INSERT INTO rewards (id, level_id, reward_type, currency_id, amount, target_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const rewardData = [
          [1, 1, RewardType.MAIN_CURRENCY, 5, 100, null],
          [2, 2, RewardType.MAIN_CURRENCY, 5, 200, null],
          [3, 3, RewardType.MAIN_CURRENCY, 5, 300, null],
          [4, 4, RewardType.MAIN_CURRENCY, 5, 400, null],
          [5, 5, RewardType.UNLOCK_TOOL, null, 0, 2],
          [6, 5, RewardType.UNLOCK_LOCATION, null, 0, 2],
          [7, 6, RewardType.MAIN_CURRENCY, 5, 600, null],
          [8, 7, RewardType.MAIN_CURRENCY, 5, 700, null],
          [9, 8, RewardType.MAIN_CURRENCY, 5, 800, null],
          [10, 9, RewardType.MAIN_CURRENCY, 5, 900, null],
          [11, 10, RewardType.UNLOCK_TOOL, null, 0, 3],
          [12, 10, RewardType.UNLOCK_LOCATION, null, 0, 3],
        ];

        rewardData.forEach(data => {
          insertReward.run(...data);
        });
        insertReward.finalize();

        // Добавляем достижения
        const insertAchievement = dbInstance.prepare(`
          INSERT INTO achievements (id, name, description, condition_type, condition_value, image_path)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const achievementData = [
          [1, 'Первые шаги', 'Сделать первый тап', 'total_taps', 1, '/assets/achievements/first_tap.png'],
          [2, 'Трудяга', 'Сделать 100 тапов', 'total_taps', 100, '/assets/achievements/hard_worker.png'],
          [3, 'Мастер', 'Сделать 1000 тапов', 'total_taps', 1000, '/assets/achievements/master.png'],
          [4, 'Коллекционер', 'Собрать 1000 ресурсов', 'total_resources_gained', 1000, '/assets/achievements/collector.png'],
          [5, 'Богач', 'Накопить 10000 монет', 'total_coins', 10000, '/assets/achievements/rich.png'],
          [6, 'Энергичный', 'Потратить 500 энергии', 'total_energy_spent', 500, '/assets/achievements/energetic.png'],
          [7, 'Постоянный игрок', 'Играть 7 дней подряд', 'consecutive_days', 7, '/assets/achievements/regular_player.png'],
          [8, 'Новичок', 'Достичь 2 уровня', 'level', 2, '/assets/achievements/beginner.png'],
          [9, 'Опытный', 'Достичь 10 уровня', 'level', 10, '/assets/achievements/experienced.png'],
          [10, 'Эксперт', 'Достичь 20 уровня', 'level', 20, '/assets/achievements/expert.png'],
        ];

        achievementData.forEach(data => {
          insertAchievement.run(...data);
        });
        insertAchievement.finalize();

        resolve();
      });
    });
  });
};

// Инициализация реферальной системы
const initReferralSystem = () => {
  return new Promise((resolve, reject) => {
    // Загружаем SQL-скрипт для реферальной системы
    const referralSqlPath = path.join(__dirname, 'referral_system.sql');
    if (fs.existsSync(referralSqlPath)) {
      const referralSql = fs.readFileSync(referralSqlPath, 'utf8');
      
      // Выполняем SQL-скрипт
      dbInstance.exec(referralSql, (err) => {
        if (err) {
          console.error('Ошибка при инициализации реферальной системы:', err);
          return reject(err);
        }
        console.log('Реферальная система инициализирована успешно');
        resolve();
      });
    } else {
      console.warn('Файл SQL для реферальной системы не найден:', referralSqlPath);
      resolve(); // Продолжаем даже если файла нет
    }
  });
};

// Инициализация базы данных
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Создаем директорию, если она не существует
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Создаем подключение к базе данных
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка при подключении к базе данных:', err.message);
        return reject(err);
      }
      console.log('Подключение к базе данных SQLite успешно установлено');

      // Создаем таблицы и заполняем начальными данными
      createTables()
        .then(() => seedDatabase())
        .then(() => initReferralSystem()) // Инициализируем реферальную систему
        .then(() => {
          console.log('База данных инициализирована успешно');
          resolve(db);
        })
        .catch((err) => {
          console.error('Ошибка при инициализации базы данных:', err);
          reject(err);
        });
    });
  });
};

// Экспортируем объекты и функции для работы с базой данных
module.exports = {
  db,
  initDatabase,
  CurrencyType,
  RewardType,
  
  // Получить ID валюты по её типу
  getCurrencyIdByType: async (currencyType) => {
    try {
      // Если передан числовой ID, просто возвращаем его
      if (typeof currencyType === 'number' || !isNaN(Number(currencyType))) {
        return Number(currencyType);
      }
      
      // Карта соответствия типов валют и их ID (согласно реальным данным в базе)
      const currencyMap = {
        'main': 1,     // Монеты
        'forest': 2,   // Брёвна
        'dirt': 3,     // Грязь
        'weed': 4,     // Сорняки
        'farm': 5      // Зерно
      };
      
      // Если это строка, преобразуем к нижнему регистру и ищем в карте
      if (typeof currencyType === 'string') {
        const normalizedType = currencyType.toLowerCase();
        if (currencyMap[normalizedType]) {
          return currencyMap[normalizedType];
        }
        
        // Если не нашли в карте, пробуем найти в базе данных
        const currency = await db.get(`
          SELECT id FROM currencies 
          WHERE LOWER(code) = LOWER(?)
        `, [normalizedType]);
        
        if (currency) {
          return currency.id;
        }
      }
      
      console.warn(`Неизвестный тип валюты: ${currencyType}, используем ID=1 (main)`);
      return 1; // Возвращаем ID основной валюты по умолчанию
    } catch (error) {
      console.error('Ошибка при получении ID валюты:', error);
      return 1; // Возвращаем ID основной валюты по умолчанию в случае ошибки
    }
  },
  
  // Получить или создать валюту игрока
  getOrCreatePlayerCurrency: async (userId, currencyId) => {
    try {
      // Получаем валюту игрока
      const currency = await db.get(`
        SELECT * FROM player_currencies 
        WHERE user_id = ? AND currency_id = ?
      `, [userId, currencyId]);
      
      if (currency) {
        return currency;
      }
      
      // Если валюта не найдена, создаем её
      await db.run(`
        INSERT INTO player_currencies (user_id, currency_id, amount)
        VALUES (?, ?, 0)
      `, [userId, currencyId]);
      
      return { user_id: userId, currency_id: currencyId, amount: 0 };
    } catch (error) {
      console.error('Ошибка при получении/создании валюты игрока:', error);
      throw error;
    }
  }
}; 