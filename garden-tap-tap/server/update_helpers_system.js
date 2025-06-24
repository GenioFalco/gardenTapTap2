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
    
    // 1. Добавляем столбец level в таблицу player_helpers
    db.run(`ALTER TABLE player_helpers ADD COLUMN level INTEGER NOT NULL DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Ошибка при добавлении столбца level в player_helpers:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      console.log('Столбец level успешно добавлен в таблицу player_helpers.');
      
      // 2. Удаляем таблицу player_active_helpers
      db.run(`DROP TABLE IF EXISTS player_active_helpers`, (err) => {
        if (err) {
          console.error('Ошибка при удалении таблицы player_active_helpers:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        console.log('Таблица player_active_helpers успешно удалена.');
        
        // 3. Создаем новую таблицу helper_levels
        db.run(`
          CREATE TABLE IF NOT EXISTS helper_levels (
            helper_id INTEGER NOT NULL,
            level INTEGER NOT NULL,
            income_per_hour REAL NOT NULL,
            upgrade_cost INTEGER NOT NULL,
            currency_type TEXT NOT NULL,
            PRIMARY KEY (helper_id, level),
            FOREIGN KEY (helper_id) REFERENCES helpers (id)
          )
        `, (err) => {
          if (err) {
            console.error('Ошибка при создании таблицы helper_levels:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Таблица helper_levels успешно создана.');
          
          // 4. Создаем временную таблицу helpers_new с новой структурой
          db.run(`
            CREATE TABLE helpers_new (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              location_id INTEGER NOT NULL,
              unlock_level INTEGER NOT NULL,
              unlock_cost INTEGER NOT NULL,
              currency_type TEXT NOT NULL,
              max_level INTEGER NOT NULL,
              image_path TEXT NOT NULL
            )
          `, (err) => {
            if (err) {
              console.error('Ошибка при создании временной таблицы helpers_new:', err.message);
              db.run('ROLLBACK');
              db.close();
              process.exit(1);
            }
            
            // Получаем данные из старой таблицы helpers
            db.all(`SELECT * FROM helpers`, [], (err, helpers) => {
              if (err) {
                console.error('Ошибка при получении данных из таблицы helpers:', err.message);
                db.run('ROLLBACK');
                db.close();
                process.exit(1);
              }
              
              // Вставляем данные в новую таблицу, устанавливая max_level
              const insertHelper = db.prepare(`
                INSERT INTO helpers_new (id, name, location_id, unlock_level, unlock_cost, currency_type, max_level, image_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `);
              
              const insertHelperLevel = db.prepare(`
                INSERT INTO helper_levels (helper_id, level, income_per_hour, upgrade_cost, currency_type)
                VALUES (?, ?, ?, ?, ?)
              `);
              
              // Добавляем базовые данные о помощниках
              let completedHelpers = 0;
              const totalHelpers = helpers.length;
              
              if (totalHelpers === 0) {
                console.log('Таблица helpers пуста, нет данных для переноса.');
                finishMigration();
              } else {
                helpers.forEach(helper => {
                  // Устанавливаем максимальный уровень 5 для всех помощников
                  const max_level = 5;
                  
                  // Вставляем помощника в новую таблицу
                  insertHelper.run(
                    helper.id,
                    helper.name,
                    helper.location_id,
                    helper.unlock_level,
                    helper.unlock_cost,
                    helper.currency_type,
                    max_level,
                    helper.image_path,
                    function(err) {
                      if (err) {
                        console.error(`Ошибка при добавлении помощника ${helper.name} в новую таблицу:`, err.message);
                      }
                      
                      // Добавляем информацию о уровнях помощника
                      // Берем базовый доход из старой таблицы и увеличиваем его с каждым уровнем
                      for (let level = 1; level <= max_level; level++) {
                        // Доход увеличивается на 50% с каждым уровнем
                        const income_per_hour = helper.income_per_hour * (1 + (level - 1) * 0.5);
                        
                        // Стоимость улучшения растет с каждым уровнем
                        const upgrade_cost = Math.floor(helper.unlock_cost * Math.pow(2, level - 1));
                        
                        insertHelperLevel.run(
                          helper.id,
                          level,
                          income_per_hour,
                          upgrade_cost,
                          helper.currency_type,
                          function(err) {
                            if (err) {
                              console.error(`Ошибка при добавлении уровня ${level} для помощника ${helper.name}:`, err.message);
                            }
                          }
                        );
                      }
                      
                      completedHelpers++;
                      if (completedHelpers === totalHelpers) {
                        insertHelper.finalize();
                        insertHelperLevel.finalize();
                        finishMigration();
                      }
                    }
                  );
                });
              }
              
              function finishMigration() {
                // Удаляем старую таблицу и переименовываем новую
                db.run(`DROP TABLE helpers`, (err) => {
                  if (err) {
                    console.error('Ошибка при удалении старой таблицы helpers:', err.message);
                    db.run('ROLLBACK');
                    db.close();
                    process.exit(1);
                  }
                  
                  db.run(`ALTER TABLE helpers_new RENAME TO helpers`, (err) => {
                    if (err) {
                      console.error('Ошибка при переименовании таблицы helpers_new:', err.message);
                      db.run('ROLLBACK');
                      db.close();
                      process.exit(1);
                    }
                    
                    console.log('Таблица helpers успешно обновлена.');
                    
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
              }
            });
          });
        });
      });
    });
  });
}); 