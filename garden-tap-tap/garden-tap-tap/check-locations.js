const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'server/garden_tap_tap.db');
console.log(`Checking database at: ${dbPath}`);

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  
  console.log('Database connection established.');

  // Получаем все локации
  db.all("SELECT * FROM locations", [], (err, rows) => {
    if (err) {
      console.error('Error getting locations:', err.message);
    } else {
      console.log('Locations in database:');
      console.log(JSON.stringify(rows, null, 2));
    }
    
    // Проверяем статический API
    console.log('\nChecking static API file:');
    try {
      const fs = require('fs');
      const apiLocations = JSON.parse(fs.readFileSync('./public/api/locations', 'utf8'));
      console.log(JSON.stringify(apiLocations, null, 2));
    } catch (err) {
      console.error('Error reading static API file:', err);
    }

    // Закрываем соединение
    db.close();
  });
}); 