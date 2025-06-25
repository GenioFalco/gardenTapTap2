// Скрипт для проверки структуры таблицы characters
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');
console.log(`Проверяем базу данных по пути: ${dbPath}`);

// Проверяем, существует ли файл базы данных
if (!fs.existsSync(dbPath)) {
  console.error(`Ошибка: база данных не найдена по пути ${dbPath}`);
  process.exit(1);
} else {
  console.log('Файл базы данных существует');
}

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено.');
  
  // Получаем список всех таблиц
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Ошибка при получении списка таблиц:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log('Таблицы в базе данных:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
    
    // Получаем информацию о структуре таблицы characters
    db.all("PRAGMA table_info(characters)", (err, rows) => {
      if (err) {
        console.error('Ошибка при получении структуры таблицы characters:', err.message);
        db.close();
        process.exit(1);
      }
      
      console.log('\nСтруктура таблицы characters:');
      if (rows.length === 0) {
        console.log('Таблица characters не содержит столбцов или не существует');
      } else {
        rows.forEach(column => {
          console.log(`${column.cid}: ${column.name} (${column.type})`);
        });
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