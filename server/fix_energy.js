const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к базе данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Открываем соединение с базой данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при подключении к базе данных:', err.message);
    process.exit(1);
  }
  console.log('Подключение к базе данных SQLite успешно установлено');
});

// Функция для исправления энергии
async function fixEnergy() {
  return new Promise((resolve, reject) => {
    // Обновляем энергию для всех игроков
    db.run(`
      UPDATE player_progress
      SET energy = 100, max_energy = 100
      WHERE energy < 100 OR max_energy < 100
    `, function(err) {
      if (err) {
        console.error('Ошибка при обновлении энергии:', err.message);
        reject(err);
        return;
      }
      
      console.log(`Обновлено записей: ${this.changes}`);
      resolve(this.changes);
    });
  });
}

// Запускаем исправление и закрываем соединение
fixEnergy()
  .then((changes) => {
    console.log(`Успешно обновлена энергия для ${changes} игроков`);
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err.message);
      }
      console.log('Соединение с базой данных закрыто');
    });
  })
  .catch((err) => {
    console.error('Произошла ошибка:', err);
    db.close();
  }); 