const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'garden_tap_tap.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking player rank data...');

// Проверяем данные в player_season
db.get('SELECT * FROM player_season WHERE user_id = ?', ['test_user'], (err, row) => {
  if (err) {
    console.error('Error in player_season:', err);
  } else {
    console.log('player_season data:', row);
  }
  
  // Проверяем данные в player_profile
  db.get('SELECT * FROM player_profile WHERE user_id = ?', ['test_user'], (err, row) => {
    if (err) {
      console.error('Error in player_profile:', err);
    } else {
      console.log('player_profile data:', row);
    }
    
    // Проверяем данные рангов
    db.all('SELECT * FROM ranks ORDER BY id', (err, rows) => {
      if (err) {
        console.error('Error in ranks:', err);
      } else {
        console.log('ranks data:', rows);
      }
      
      db.close();
    });
  });
}); 