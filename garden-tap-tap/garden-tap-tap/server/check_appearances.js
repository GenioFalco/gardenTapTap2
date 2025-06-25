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
      console.log('Таблица character_appearances не существует, создаем...');
      createTable();
    } else {
      console.log('Таблица character_appearances существует, проверяем структуру...');
      checkStructure();
    }
  });
});

// Создание таблицы character_appearances
function createTable() {
  db.run(`
    CREATE TABLE character_appearances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      tool_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      animation_path TEXT,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании таблицы:', err);
      db.close();
      return;
    }
    
    console.log('Таблица character_appearances создана успешно');
    // Добавляем начальные данные
    insertInitialData();
  });
}

// Проверка структуры таблицы
function checkStructure() {
  db.all('PRAGMA table_info(character_appearances)', (err, columns) => {
    if (err) {
      console.error('Ошибка при проверке структуры таблицы:', err);
      db.close();
      return;
    }
    
    console.log('Структура таблицы character_appearances:');
    console.log(JSON.stringify(columns, null, 2));
    
    // Получаем данные из таблицы
    db.all('SELECT * FROM character_appearances', (err, rows) => {
      if (err) {
        console.error('Ошибка при получении данных из таблицы:', err);
        db.close();
        return;
      }
      
      console.log('Данные таблицы character_appearances:');
      console.log(JSON.stringify(rows, null, 2));
      
      if (rows.length === 0) {
        console.log('Таблица пуста, добавляем начальные данные...');
        insertInitialData();
      } else {
        db.close();
      }
    });
  });
}

// Добавление начальных данных
function insertInitialData() {
  // Добавляем записи для лесоруба с разными инструментами
  const appearances = [
    {
      character_id: 1,
      tool_id: 1,
      image_path: '/assets/characters/lumberjack.png',
      animation_path: '/assets/characters/lumberjack_axe.gif'
    },
    {
      character_id: 1,
      tool_id: 2,
      image_path: '/assets/characters/lumberjack.png',
      animation_path: '/assets/characters/lumberjack_handsaw.gif'
    },
    {
      character_id: 1,
      tool_id: 3,
      image_path: '/assets/characters/lumberjack.png',
      animation_path: '/assets/characters/lumberjack_chainsaw.gif'
    }
  ];
  
  // Используем транзакцию для вставки всех записей
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const stmt = db.prepare(`
      INSERT INTO character_appearances (character_id, tool_id, image_path, animation_path)
      VALUES (?, ?, ?, ?)
    `);
    
    appearances.forEach(appearance => {
      stmt.run(
        appearance.character_id,
        appearance.tool_id,
        appearance.image_path,
        appearance.animation_path
      );
    });
    
    stmt.finalize();
    
    db.run('COMMIT', err => {
      if (err) {
        console.error('Ошибка при добавлении данных:', err);
      } else {
        console.log('Начальные данные добавлены успешно');
      }
      
      db.close();
    });
  });
} 