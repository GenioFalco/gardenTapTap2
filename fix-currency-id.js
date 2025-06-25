// Простой скрипт для исправления таблицы player_currencies
try {
  const sqlite3 = require('sqlite3').verbose();
  console.log('SQLite3 загружен успешно');
  
  // Открываем базу данных
  const db = new sqlite3.Database('./garden_tap_tap.db', (err) => {
    if (err) {
      console.error('Ошибка при открытии базы данных:', err);
      return;
    }
    console.log('База данных успешно открыта');
    
    console.log('Начинаем исправление таблицы player_currencies...');

    // Запускаем транзакцию
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Ошибка при начале транзакции:', err);
          db.close();
          return;
        }
        
        // 1. Проверяем структуру таблицы
        db.all('PRAGMA table_info(player_currencies)', (err, columns) => {
          if (err) {
            console.error('Ошибка при получении структуры таблицы:', err);
            db.run('ROLLBACK');
            db.close();
            return;
          }
          
          console.log('Структура таблицы успешно получена:', columns);
          
          const hasCurrencyId = columns.some(col => col.name === 'currency_id');
          const hasCurrencyType = columns.some(col => col.name === 'currency_type');
          
          console.log(`Текущие колонки: currency_id=${hasCurrencyId}, currency_type=${hasCurrencyType}`);
          
          if (hasCurrencyId && !hasCurrencyType) {
            console.log('Таблица уже в правильном формате, только с currency_id');
            db.run('COMMIT');
            db.close();
            return;
          }
          
          // 2. Если нет currency_id, но есть currency_type, просто переименуем колонку
          if (!hasCurrencyId && hasCurrencyType) {
            console.log('Переименовываем currency_type в currency_id...');
            
            // В SQLite нет прямого ALTER COLUMN RENAME, поэтому создаем новую таблицу
            db.run(`
              CREATE TABLE player_currencies_new (
                user_id TEXT NOT NULL,
                currency_id TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, currency_id)
              )
            `, (err) => {
              if (err) {
                console.error('Ошибка при создании новой таблицы:', err);
                db.run('ROLLBACK');
                db.close();
                return;
              }
              
              // Копируем данные, преобразуя currency_type в currency_id
              db.run(`
                INSERT INTO player_currencies_new (user_id, currency_id, amount)
                SELECT user_id, LOWER(currency_type), amount 
                FROM player_currencies
                GROUP BY user_id, LOWER(currency_type)
              `, (err) => {
                if (err) {
                  console.error('Ошибка при копировании данных:', err);
                  db.run('ROLLBACK');
                  db.close();
                  return;
                }
                
                // Удаляем старую таблицу и переименовываем новую
                db.run('DROP TABLE player_currencies', (err) => {
                  if (err) {
                    console.error('Ошибка при удалении старой таблицы:', err);
                    db.run('ROLLBACK');
                    db.close();
                    return;
                  }
                  
                  db.run('ALTER TABLE player_currencies_new RENAME TO player_currencies', (err) => {
                    if (err) {
                      console.error('Ошибка при переименовании новой таблицы:', err);
                      db.run('ROLLBACK');
                      db.close();
                      return;
                    }
                    
                    console.log('✅ Таблица player_currencies успешно обновлена!');
                    console.log('✅ Все дубликаты удалены!');
                    console.log('✅ Теперь используется только поле currency_id');
                    
                    // Завершаем транзакцию
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Ошибка при завершении транзакции:', err);
                        db.run('ROLLBACK');
                      }
                      
                      // Закрываем базу
                      db.close();
                    });
                  });
                });
              });
            });
          }
          // 3. Если есть оба поля, нужно объединить данные
          else if (hasCurrencyId && hasCurrencyType) {
            console.log('Присутствуют оба поля. Объединяем данные и удаляем currency_type...');
            
            // Создаем временную таблицу
            db.run(`
              CREATE TABLE player_currencies_temp (
                user_id TEXT NOT NULL,
                currency_id TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, currency_id)
              )
            `, (err) => {
              if (err) {
                console.error('Ошибка при создании временной таблицы:', err);
                db.run('ROLLBACK');
                db.close();
                return;
              }
              
              // Получаем все записи из текущей таблицы
              db.all('SELECT user_id, currency_id, currency_type, amount FROM player_currencies', (err, rows) => {
                if (err) {
                  console.error('Ошибка при чтении данных:', err);
                  db.run('ROLLBACK');
                  db.close();
                  return;
                }
                
                console.log(`Найдено ${rows.length} записей для обработки`);
                
                // Группируем записи по user_id и currency_id (или currency_type, если currency_id пусто)
                const groupedData = {};
                rows.forEach(row => {
                  // Используем currency_id, если есть, иначе используем currency_type
                  const currencyId = (row.currency_id || '').toLowerCase() || (row.currency_type || '').toLowerCase();
                  if (!currencyId) return; // Пропускаем записи без идентификатора валюты
                  
                  const key = `${row.user_id}_${currencyId}`;
                  if (!groupedData[key]) {
                    groupedData[key] = { 
                      user_id: row.user_id, 
                      currency_id: currencyId, 
                      amount: row.amount 
                    };
                  } else {
                    // Суммируем количество для дублирующихся записей
                    groupedData[key].amount += row.amount;
                  }
                });
                
                // Получаем уникальные записи
                const uniqueRows = Object.values(groupedData);
                console.log(`После обработки осталось ${uniqueRows.length} уникальных записей`);
                
                // Если нет данных для вставки, просто выходим
                if (uniqueRows.length === 0) {
                  db.run('DROP TABLE player_currencies_temp');
                  console.log('Нет данных для обработки!');
                  db.run('COMMIT');
                  db.close();
                  return;
                }
                
                // Подготавливаем оператор вставки
                const stmt = db.prepare('INSERT INTO player_currencies_temp (user_id, currency_id, amount) VALUES (?, ?, ?)');
                
                // Вставляем все уникальные записи
                let insertedCount = 0;
                uniqueRows.forEach(row => {
                  stmt.run(row.user_id, row.currency_id, row.amount, function(err) {
                    if (err) {
                      console.error(`Ошибка при вставке записи ${row.user_id}, ${row.currency_id}:`, err);
                      return;
                    }
                    
                    insertedCount++;
                    if (insertedCount === uniqueRows.length) {
                      stmt.finalize();
                      
                      // Заменяем старую таблицу на новую
                      db.run('DROP TABLE player_currencies', (err) => {
                        if (err) {
                          console.error('Ошибка при удалении старой таблицы:', err);
                          db.run('ROLLBACK');
                          db.close();
                          return;
                        }
                        
                        db.run('ALTER TABLE player_currencies_temp RENAME TO player_currencies', (err) => {
                          if (err) {
                            console.error('Ошибка при переименовании временной таблицы:', err);
                            db.run('ROLLBACK');
                            db.close();
                            return;
                          }
                          
                          console.log('✅ Таблица player_currencies успешно обновлена!');
                          console.log('✅ Все дубликаты удалены!');
                          console.log('✅ Теперь используется только поле currency_id');
                          
                          db.run('COMMIT', (err) => {
                            if (err) {
                              console.error('Ошибка при завершении транзакции:', err);
                              db.run('ROLLBACK');
                            }
                            db.close();
                          });
                        });
                      });
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
} catch (err) {
  console.error('Произошла неожиданная ошибка:', err);
} 