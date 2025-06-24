const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к базе данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Проверяем существование базы данных
if (!fs.existsSync(dbPath)) {
  console.error('Ошибка: База данных не найдена по пути:', dbPath);
  process.exit(1);
}

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при подключении к базе данных:', err.message);
    process.exit(1);
  }
  console.log('Подключение к базе данных установлено');
});

// Выполняем миграцию
db.serialize(() => {
  // Включаем поддержку внешних ключей
  db.run('PRAGMA foreign_keys = ON');

  // Создаем таблицу для хранения лимитов хранилища игрока
  db.run(`
    CREATE TABLE IF NOT EXISTS player_storage_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      location_id INTEGER NOT NULL,
      currency_id TEXT NOT NULL,
      storage_level INTEGER NOT NULL DEFAULT 1,
      capacity INTEGER NOT NULL DEFAULT 500,
      UNIQUE(user_id, location_id, currency_id)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании таблицы player_storage_limits:', err.message);
    } else {
      console.log('Таблица player_storage_limits создана или уже существует');
    }
  });

  // Создаем таблицу для уровней улучшения хранилища
  db.run(`
    CREATE TABLE IF NOT EXISTS storage_upgrade_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      upgrade_cost INTEGER NOT NULL,
      currency_type TEXT NOT NULL,
      UNIQUE(location_id, level)
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка при создании таблицы storage_upgrade_levels:', err.message);
    } else {
      console.log('Таблица storage_upgrade_levels создана или уже существует');
    }
  });

  // Добавляем начальные данные для уровней хранилища
  const insertLevels = () => {
    // Получаем список локаций
    db.all('SELECT id FROM locations', [], (err, locations) => {
      if (err) {
        console.error('Ошибка при получении списка локаций:', err.message);
        return;
      }

      // Для каждой локации добавляем уровни хранилища
      locations.forEach(location => {
        const locationId = location.id;
        
        // Проверяем, есть ли уже уровни для этой локации
        db.get('SELECT COUNT(*) as count FROM storage_upgrade_levels WHERE location_id = ?', [locationId], (err, result) => {
          if (err) {
            console.error(`Ошибка при проверке уровней для локации ${locationId}:`, err.message);
            return;
          }

          // Если уровней нет, добавляем их
          if (result.count === 0) {
            console.log(`Добавляем уровни хранилища для локации ${locationId}`);
            
            // Базовые уровни (одинаковые для всех локаций)
            const levels = [
              { level: 1, capacity: 500, upgrade_cost: 100, currency_type: '5' },  // Уровень 1, вместимость 500, стоимость 100 сад-коинов
              { level: 2, capacity: 1000, upgrade_cost: 250, currency_type: '5' }, // Уровень 2
              { level: 3, capacity: 2000, upgrade_cost: 500, currency_type: '5' }, // Уровень 3
              { level: 4, capacity: 3500, upgrade_cost: 1000, currency_type: '5' }, // Уровень 4
              { level: 5, capacity: 5000, upgrade_cost: 2000, currency_type: '5' }, // Уровень 5
              { level: 6, capacity: 7500, upgrade_cost: 3500, currency_type: '5' }, // Уровень 6
              { level: 7, capacity: 10000, upgrade_cost: 5000, currency_type: '5' }, // Уровень 7
              { level: 8, capacity: 15000, upgrade_cost: 7500, currency_type: '5' }, // Уровень 8
              { level: 9, capacity: 25000, upgrade_cost: 10000, currency_type: '5' }, // Уровень 9
              { level: 10, capacity: 50000, upgrade_cost: 15000, currency_type: '5' } // Уровень 10
            ];
            
            // Вставляем уровни для этой локации
            const stmt = db.prepare(`
              INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_type)
              VALUES (?, ?, ?, ?, ?)
            `);
            
            levels.forEach(level => {
              stmt.run(locationId, level.level, level.capacity, level.upgrade_cost, level.currency_type);
            });
            
            stmt.finalize();
            console.log(`Добавлено ${levels.length} уровней хранилища для локации ${locationId}`);
          } else {
            console.log(`Уровни хранилища для локации ${locationId} уже существуют`);
          }
        });
      });
    });
  };

  // Выполняем добавление начальных данных после создания таблиц
  insertLevels();
});

// Закрываем соединение с базой данных после выполнения всех операций
db.close((err) => {
  if (err) {
    console.error('Ошибка при закрытии соединения с базой данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных закрыто');
}); 