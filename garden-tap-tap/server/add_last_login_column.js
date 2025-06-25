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

  // Проверяем структуру таблицы player_progress
  db.all("PRAGMA table_info(player_progress)", (err, columns) => {
    if (err) {
      console.error('Ошибка при проверке структуры таблицы player_progress:', err.message);
      db.close();
      process.exit(1);
    }

    // Проверяем, есть ли столбец last_login
    const hasLastLogin = columns.some(column => column.name === 'last_login');

    if (!hasLastLogin) {
      console.log('Столбец last_login не найден, создаем новую таблицу с этим столбцом...');

      // Создаем временную таблицу с нужной структурой
      db.run(`
        CREATE TABLE player_progress_new (
          user_id TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 1,
          experience INTEGER NOT NULL DEFAULT 0,
          energy INTEGER NOT NULL DEFAULT 100,
          max_energy INTEGER NOT NULL DEFAULT 100,
          last_energy_refill_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_login TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id)
        )
      `, (err) => {
        if (err) {
          console.error('Ошибка при создании временной таблицы:', err.message);
          db.close();
          process.exit(1);
        }

        // Копируем данные из старой таблицы в новую
        db.run(`
          INSERT INTO player_progress_new (user_id, level, experience, energy, max_energy, last_energy_refill_time)
          SELECT user_id, level, experience, energy, max_energy, last_energy_refill_time FROM player_progress
        `, (err) => {
          if (err) {
            console.error('Ошибка при копировании данных в новую таблицу:', err.message);
            db.close();
            process.exit(1);
          }

          // Удаляем старую таблицу
          db.run('DROP TABLE player_progress', (err) => {
            if (err) {
              console.error('Ошибка при удалении старой таблицы:', err.message);
              db.close();
              process.exit(1);
            }

            // Переименовываем новую таблицу
            db.run('ALTER TABLE player_progress_new RENAME TO player_progress', (err) => {
              if (err) {
                console.error('Ошибка при переименовании новой таблицы:', err.message);
                db.close();
                process.exit(1);
              }

              // Обновляем значения last_login
              db.run('UPDATE player_progress SET last_login = CURRENT_TIMESTAMP', (err) => {
                if (err) {
                  console.error('Ошибка при обновлении значений last_login:', err.message);
                } else {
                  console.log('Значения last_login успешно инициализированы');
                }

                console.log('Миграция успешно завершена');
                db.close();
              });
            });
          });
        });
      });
    } else {
      console.log('Столбец last_login уже существует в таблице player_progress');
      db.close();
    }
  });
}); 