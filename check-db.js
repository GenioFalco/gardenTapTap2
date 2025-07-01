const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.db');

// Получаем список таблиц
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Ошибка при получении списка таблиц:', err);
    return;
  }
  
  console.log('Таблицы в базе данных:');
  console.log(tables.map(t => t.name));
  
  // Проверяем наличие нужных таблиц для профиля
  const requiredTables = ['player_profile', 'ranks', 'seasons', 'player_season', 'achievements', 'player_achievements'];
  const missingTables = requiredTables.filter(table => !tables.some(t => t.name === table));
  
  if (missingTables.length > 0) {
    console.log('\nОтсутствующие таблицы для профиля:');
    console.log(missingTables);
  } else {
    console.log('\nВсе необходимые таблицы для профиля существуют');
  }
  
  db.close();
}); 