// Скрипт для обновления таблицы tools - добавление полей main_coins_power и location_coins_power
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
    
    // Проверяем, существует ли колонка main_coins_power
    db.get("PRAGMA table_info(tools)", (err, rows) => {
      if (err) {
        console.error('Ошибка при проверке структуры таблицы:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      // Добавляем колонки, если их еще нет
      console.log('Добавление новых колонок в таблицу tools...');
      
      // Добавляем колонку main_coins_power
      db.run('ALTER TABLE tools ADD COLUMN main_coins_power REAL DEFAULT 0', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Ошибка при добавлении колонки main_coins_power:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        
        // Добавляем колонку location_coins_power
        db.run('ALTER TABLE tools ADD COLUMN location_coins_power REAL DEFAULT 0', (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Ошибка при добавлении колонки location_coins_power:', err.message);
            db.run('ROLLBACK');
            db.close();
            process.exit(1);
          }
          
          console.log('Колонки успешно добавлены.');
          
          // Обновляем значения для существующих инструментов
          console.log('Обновляем значения силы тапа для существующих инструментов...');
          
          // Топор (ID 1): 1 дерево, 0.5 сад-коинов
          db.run('UPDATE tools SET location_coins_power = 1, main_coins_power = 0.5 WHERE id = 1', function(err) {
            if (err) {
              console.error('Ошибка при обновлении инструмента с ID 1:', err.message);
            } else {
              console.log(`Обновлено строк для инструмента с ID 1: ${this.changes}`);
            }
            
            // Ручная пила (ID 2): 3 дерева, 1.5 сад-коинов
            db.run('UPDATE tools SET location_coins_power = 3, main_coins_power = 1.5 WHERE id = 2', function(err) {
              if (err) {
                console.error('Ошибка при обновлении инструмента с ID 2:', err.message);
              } else {
                console.log(`Обновлено строк для инструмента с ID 2: ${this.changes}`);
              }
              
              // Бензопила (ID 3): 10 дерева, 5 сад-коинов
              db.run('UPDATE tools SET location_coins_power = 10, main_coins_power = 5 WHERE id = 3', function(err) {
                if (err) {
                  console.error('Ошибка при обновлении инструмента с ID 3:', err.message);
                  db.run('ROLLBACK');
                } else {
                  console.log(`Обновлено строк для инструмента с ID 3: ${this.changes}`);
                  
                  // Создаем таблицу валют, если она не существует
                  db.run(`
                    CREATE TABLE IF NOT EXISTS currencies (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      name TEXT NOT NULL,
                      currency_type TEXT NOT NULL,
                      image_path TEXT,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                  `, function(err) {
                    if (err) {
                      console.error('Ошибка при создании таблицы currencies:', err.message);
                      db.run('ROLLBACK');
                    } else {
                      console.log('Таблица currencies создана или уже существует.');
                      
                      // Добавляем базовые валюты
                      const currencies = [
                        ['Дерево', 'forest', '/assets/currencies/wood.png'],
                        ['Камень', 'mountain', '/assets/currencies/stone.png'],
                        ['Песок', 'desert', '/assets/currencies/sand.png'],
                        ['Вода', 'lake', '/assets/currencies/water.png'],
                        ['Сад-коин', 'main', '/assets/currencies/garden_coin.png']
                      ];
                      
                      const insertCurrency = db.prepare(`
                        INSERT OR IGNORE INTO currencies (name, currency_type, image_path)
                        VALUES (?, ?, ?)
                      `);
                      
                      currencies.forEach(currency => {
                        insertCurrency.run(currency, function(err) {
                          if (err) {
                            console.error(`Ошибка при добавлении валюты ${currency[0]}:`, err.message);
                          } else {
                            console.log(`Валюта ${currency[0]} добавлена или уже существует.`);
                          }
                        });
                      });
                      
                      insertCurrency.finalize();
                      
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
                    }
                  });
                }
              });
            });
          });
        });
      });
    });
  });
}); 