const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено.');
  
  // Проверяем инструменты пользователя test_user
  db.all(`
    SELECT pt.user_id, pt.tool_id, t.name, t.unlock_level, t.unlock_cost
    FROM player_tools pt
    JOIN tools t ON pt.tool_id = t.id
    WHERE pt.user_id = ?
  `, ['test_user'], (err, rows) => {
    if (err) {
      console.error('Ошибка при получении инструментов:', err.message);
      return;
    }
    
    console.log('Инструменты пользователя test_user в таблице player_tools:');
    console.log(JSON.stringify(rows, null, 2));
    
    // Проверяем прогресс пользователя
    db.get(`
      SELECT user_id, level, experience, energy, max_energy
      FROM player_progress
      WHERE user_id = ?
    `, ['test_user'], (err, progress) => {
      if (err) {
        console.error('Ошибка при получении прогресса:', err.message);
        return;
      }
      
      console.log('\nПрогресс пользователя test_user:');
      console.log(JSON.stringify(progress, null, 2));
      
      // Получаем все инструменты
      db.all(`
        SELECT id, name, unlock_level, unlock_cost
        FROM tools
        WHERE character_id = 1
      `, [], (err, allTools) => {
        if (err) {
          console.error('Ошибка при получении всех инструментов:', err.message);
          return;
        }
        
        console.log('\nВсе инструменты для персонажа 1:');
        console.log(JSON.stringify(allTools, null, 2));
        
        // Закрываем соединение с базой данных
        db.close();
      });
    });
  });
}); 