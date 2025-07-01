const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Открываем соединение с базой данных
const db = new sqlite3.Database('./garden_tap_tap.db');

// Читаем SQL-скрипт
const sqlScript = fs.readFileSync('./add_new_tables.sql', 'utf8');

// Выполняем SQL-запросы
db.serialize(() => {
  // Начинаем транзакцию
  db.run('BEGIN TRANSACTION');
  
  try {
    // Разбиваем скрипт на отдельные запросы
    const queries = sqlScript.split(';').filter(query => query.trim() !== '');
    
    // Выполняем каждый запрос
    queries.forEach(query => {
      db.run(query, function(err) {
        if (err) {
          console.error(`Ошибка при выполнении запроса: ${query.trim()}`);
          console.error(err);
        } else {
          console.log(`Успешно выполнен запрос: ${query.trim().substring(0, 50)}...`);
        }
      });
    });
    
    // Фиксируем транзакцию
    db.run('COMMIT', function(err) {
      if (err) {
        console.error('Ошибка при фиксации транзакции:', err);
      } else {
        console.log('Транзакция успешно зафиксирована');
      }
    });
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    db.run('ROLLBACK', function(err) {
      if (err) {
        console.error('Ошибка при откате транзакции:', err);
      } else {
        console.log('Транзакция отменена из-за ошибки');
      }
    });
    console.error('Произошла ошибка:', error);
  }
});

// Проверяем, что таблицы созданы
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Ошибка при получении списка таблиц:', err);
  } else {
    console.log('Список таблиц в базе данных:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
  }
  
  // Закрываем соединение с базой данных
  db.close((err) => {
    if (err) {
      console.error('Ошибка при закрытии соединения с базой данных:', err);
    } else {
      console.log('Соединение с базой данных закрыто');
    }
  });
}); 