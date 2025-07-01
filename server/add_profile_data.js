const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

console.log(`Используется база данных по пути: ${dbPath}`);

// Проверяем, существует ли файл базы данных
if (!fs.existsSync(dbPath)) {
  console.error(`База данных не найдена по пути: ${dbPath}`);
  process.exit(1);
} else {
  console.log('База данных найдена');
}

// Открываем соединение с базой данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено');
});

// Проверяем наличие таблиц
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Ошибка при получении списка таблиц:', err.message);
    db.close();
    process.exit(1);
  }
  
  console.log('Таблицы в базе данных:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });
  
  // Начинаем транзакцию
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    console.log('Добавление данных для профиля игрока...');

    // Проверяем, есть ли уже записи в таблице ranks
    db.get('SELECT COUNT(*) as count FROM ranks', (err, row) => {
      if (err) {
        console.error('Ошибка при проверке таблицы ranks:', err.message);
        db.run('ROLLBACK');
        db.close();
        return;
      }

      console.log(`В таблице ranks найдено записей: ${row ? row.count : 'ошибка'}`);

      // Если таблица ranks пуста, добавляем данные
      if (row && row.count === 0) {
        console.log('Добавление рангов...');
        
        // Добавляем ранги
        const ranksStmt = db.prepare(`
          INSERT INTO ranks (id, name, min_points, image_path) VALUES (?, ?, ?, ?)
        `);
        
        ranksStmt.run(1, 'Бронза I', 0, 'ranks/bronze_1.png');
        ranksStmt.run(2, 'Бронза II', 100, 'ranks/bronze_2.png');
        ranksStmt.run(3, 'Серебро I', 300, 'ranks/silver_1.png');
        ranksStmt.run(4, 'Серебро II', 600, 'ranks/silver_2.png');
        ranksStmt.run(5, 'Золото I', 1000, 'ranks/gold_1.png');
        ranksStmt.run(6, 'Золото II', 1500, 'ranks/gold_2.png');
        ranksStmt.run(7, 'Платина', 2200, 'ranks/platinum.png');
        ranksStmt.run(8, 'Бриллиант', 3000, 'ranks/diamond.png');
        ranksStmt.run(9, 'Легенда', 5000, 'ranks/legend.png');
        
        ranksStmt.finalize();
        console.log('Ранги добавлены');
      } else {
        console.log('Таблица ranks уже содержит данные, пропускаем...');
      }
    });

    // Проверяем, есть ли уже записи в таблице seasons
    db.get('SELECT COUNT(*) as count FROM seasons', (err, row) => {
      if (err) {
        console.error('Ошибка при проверке таблицы seasons:', err.message);
        return;
      }

      console.log(`В таблице seasons найдено записей: ${row ? row.count : 'ошибка'}`);

      // Если таблица seasons пуста, добавляем данные
      if (row && row.count === 0) {
        console.log('Добавление сезонов...');
        
        // Добавляем сезон
        db.run(`
          INSERT INTO seasons (id, name, start_date, end_date, description, is_active) 
          VALUES (1, 'Летний сезон', '2025-06-01', '2025-07-31', 'Жара, валка, прокачка!', 1)
        `, (err) => {
          if (err) {
            console.error('Ошибка при добавлении сезона:', err.message);
          } else {
            console.log('Сезон добавлен');
          }
        });
      } else {
        console.log('Таблица seasons уже содержит данные, пропускаем...');
      }
    });

    // Проверяем, есть ли уже записи в таблице achievements
    db.get('SELECT COUNT(*) as count FROM achievements', (err, row) => {
      if (err) {
        console.error('Ошибка при проверке таблицы achievements:', err.message);
        return;
      }

      console.log(`В таблице achievements найдено записей: ${row ? row.count : 'ошибка'}`);

      // Если таблица achievements пуста, добавляем данные
      if (row && row.count === 0) {
        console.log('Добавление достижений...');
        
        // Добавляем достижения
        const achievementsStmt = db.prepare(`
          INSERT INTO achievements (id, name, description, condition_type, condition_value, reward_type, reward_value, image_path) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        achievementsStmt.run(1, 'Первый шаг', 'Заработай первую монету', 'coins_collected', 1, 'coins', 10, 'achievements/first_coin.png');
        achievementsStmt.run(2, 'Лесоруб', 'Собери 100 монет', 'coins_collected', 100, 'coins', 50, 'achievements/lumberjack.png');
        achievementsStmt.run(3, 'Про', 'Открой 3 инструмента', 'tools_unlocked', 3, 'coins', 100, 'achievements/pro.png');
        achievementsStmt.run(4, 'Мастер ранга', 'Достигни ранга Золото I', 'rank_reached', 5, 'coins', 150, 'achievements/rank_master.png');
        achievementsStmt.run(5, 'Сезонный ветеран', 'Участвуй в 3 сезонах', 'seasons_participated', 3, 'coins', 200, 'achievements/veteran.png');
        
        achievementsStmt.finalize();
        console.log('Достижения добавлены');
      } else {
        console.log('Таблица achievements уже содержит данные, пропускаем...');
      }
    });

    // Завершаем транзакцию
    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Ошибка при завершении транзакции:', err.message);
        db.run('ROLLBACK');
      } else {
        console.log('Данные для профиля успешно добавлены в базу данных');
      }
      
      // Закрываем соединение с базой данных через 2 секунды,
      // чтобы дать время завершиться всем асинхронным операциям
      setTimeout(() => {
        db.close((err) => {
          if (err) {
            console.error('Ошибка при закрытии базы данных:', err.message);
          } else {
            console.log('Соединение с базой данных закрыто');
          }
        });
      }, 2000);
    });
  });
}); 