const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Функция для добавления новых таблиц для системы помощников
const updateDatabase = async () => {
  return new Promise((resolve, reject) => {
    console.log('Обновление базы данных: добавление системы помощников...');
    
    // Открываем соединение с базой данных
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка при открытии базы данных:', err.message);
        return reject(err);
      }
      
      // Выполняем операции по обновлению схемы
      db.serialize(() => {
        // 1. Создаем таблицу помощников (helpers)
        db.run(`
          CREATE TABLE IF NOT EXISTS helpers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            location_id INTEGER NOT NULL,
            unlock_level INTEGER NOT NULL,
            unlock_cost INTEGER NOT NULL,
            currency_type TEXT NOT NULL,
            income_per_hour REAL NOT NULL,
            image_path TEXT NOT NULL,
            description TEXT NOT NULL,
            FOREIGN KEY (location_id) REFERENCES locations (id)
          )
        `, (err) => {
          if (err) {
            console.error('Ошибка при создании таблицы helpers:', err.message);
            return reject(err);
          }
          console.log('Таблица helpers создана успешно');
          
          // 2. Создаем таблицу разблокированных помощников пользователя
          db.run(`
            CREATE TABLE IF NOT EXISTS player_helpers (
              user_id TEXT NOT NULL,
              helper_id INTEGER NOT NULL,
              PRIMARY KEY (user_id, helper_id),
              FOREIGN KEY (helper_id) REFERENCES helpers (id)
            )
          `, (err) => {
            if (err) {
              console.error('Ошибка при создании таблицы player_helpers:', err.message);
              return reject(err);
            }
            console.log('Таблица player_helpers создана успешно');
            
            // 3. Создаем таблицу активных помощников пользователя
            db.run(`
              CREATE TABLE IF NOT EXISTS player_active_helpers (
                user_id TEXT NOT NULL,
                helper_id INTEGER NOT NULL,
                location_id INTEGER NOT NULL,
                activated_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, helper_id),
                FOREIGN KEY (helper_id) REFERENCES helpers (id),
                FOREIGN KEY (location_id) REFERENCES locations (id)
              )
            `, (err) => {
              if (err) {
                console.error('Ошибка при создании таблицы player_active_helpers:', err.message);
                return reject(err);
              }
              console.log('Таблица player_active_helpers создана успешно');
              
              // 4. Добавляем тестовых помощников
              db.run(`
                INSERT INTO helpers (id, name, location_id, unlock_level, unlock_cost, currency_type, income_per_hour, image_path, description)
                VALUES (1, 'Подмастерье лесоруба', 1, 3, 200, 'forest', 15, '/assets/helpers/apprentice.png', 'Помогает собирать древесину, даже когда вас нет в игре')
              `, (err) => {
                if (err && !err.message.includes('UNIQUE constraint failed')) {
                  console.error('Ошибка при добавлении помощника:', err.message);
                  return reject(err);
                }
                
                console.log('Данные помощников добавлены успешно');
                db.close();
                resolve();
              });
            });
          });
        });
      });
    });
  });
};

// Запускаем обновление
updateDatabase()
  .then(() => {
    console.log('База данных успешно обновлена');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка при обновлении базы данных:', error);
    process.exit(1);
  }); 