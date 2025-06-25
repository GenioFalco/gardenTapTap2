// Скрипт для удаления столбца power из таблицы tools
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
  
  // SQLite не поддерживает прямое удаление столбцов, поэтому нам нужно:
  // 1. Создать временную таблицу без столбца power
  // 2. Скопировать данные из старой таблицы во временную
  // 3. Удалить старую таблицу
  // 4. Переименовать временную таблицу
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 1. Создаем временную таблицу без столбца power
    db.run(`
      CREATE TABLE tools_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        character_id INTEGER NOT NULL,
        unlock_level INTEGER NOT NULL,
        unlock_cost INTEGER NOT NULL,
        currency_type TEXT NOT NULL,
        image_path TEXT NOT NULL,
        main_coins_power REAL DEFAULT 0,
        location_coins_power REAL DEFAULT 0
      )
    `, (err) => {
      if (err) {
        console.error('Ошибка при создании временной таблицы:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      // 2. Копируем данные из старой таблицы во временную
      db.run(`
        INSERT INTO tools_new (id, name, character_id, unlock_level, unlock_cost, currency_type, image_path, main_coins_power, location_coins_power)
        SELECT id, name, character_id, unlock_level, unlock_cost, currency_type, image_path, main_coins_power, location_coins_power
        FROM tools
      `, (err) => {
        if (err) {
          console.error('Ошибка при копировании данных:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // 3. Удаляем старую таблицу
        db.run(`DROP TABLE tools`, (err) => {
          if (err) {
            console.error('Ошибка при удалении старой таблицы:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          // 4. Переименовываем временную таблицу
          db.run(`ALTER TABLE tools_new RENAME TO tools`, (err) => {
            if (err) {
              console.error('Ошибка при переименовании таблицы:', err.message);
              db.run('ROLLBACK');
              db.close();
              process.exit(1);
            }
            
            console.log('Столбец power успешно удален из таблицы tools');
            
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