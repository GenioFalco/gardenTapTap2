// Скрипт для проверки данных в таблице character_appearances
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');
console.log(`Проверяем базу данных по пути: ${dbPath}`);

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено.');

  // Проверяем, существует ли таблица
  db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='character_appearances'`, (err, table) => {
    if (err) {
      console.error('Ошибка при проверке таблицы:', err.message);
      db.close();
      process.exit(1);
    }

    if (!table) {
      console.log('Таблица character_appearances не существует!');
      db.close();
      return;
    }

    console.log('Таблица character_appearances существует.');
    
    // Получаем структуру таблицы
    db.all("PRAGMA table_info(character_appearances)", (err, columns) => {
      if (err) {
        console.error('Ошибка при получении структуры таблицы:', err.message);
        db.close();
        process.exit(1);
      }
      
      console.log('\nСтруктура таблицы character_appearances:');
      columns.forEach(column => {
        console.log(`${column.cid}: ${column.name} (${column.type})`);
      });
      
      // Получаем данные из таблицы character_appearances напрямую
      db.all(`SELECT * FROM character_appearances`, (err, rows) => {
        if (err) {
          console.error('Ошибка при получении данных из таблицы character_appearances:', err.message);
          db.close();
          process.exit(1);
        }
        
        console.log('\nДанные из таблицы character_appearances (без JOIN):');
        if (rows.length === 0) {
          console.log('Таблица character_appearances пуста');
        } else {
          rows.forEach(row => {
            console.log(row);
          });
        }
        
        // Теперь попробуем с JOIN
        db.all(`
          SELECT ca.*, c.name as character_name, t.name as tool_name
          FROM character_appearances ca
          JOIN characters c ON ca.character_id = c.id
          JOIN tools t ON ca.tool_id = t.id
        `, (err, joinRows) => {
          if (err) {
            console.error('Ошибка при JOIN-запросе:', err.message);
          } else {
            console.log('\nДанные из таблицы character_appearances (с JOIN):');
            if (joinRows.length === 0) {
              console.log('Результат JOIN-запроса пуст');
            } else {
              joinRows.forEach(row => {
                console.log(row);
              });
            }
          }
          
          // Закрываем соединение с базой данных
          db.close((err) => {
            if (err) {
              console.error('Ошибка при закрытии базы данных:', err.message);
            } else {
              console.log('\nСоединение с базой данных закрыто.');
            }
          });
        });
      });
    });
  });
}); 