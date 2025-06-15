const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./garden_tap_tap.db');

// Проверяем структуру таблицы locations
db.all('PRAGMA table_info(locations)', [], (err, columns) => {
  if (err) {
    console.error('Ошибка при проверке структуры таблицы locations:', err);
    db.close();
    return;
  }
  
  console.log('Структура таблицы locations:');
  console.log(JSON.stringify(columns, null, 2));
  
  // Получаем все локации
  db.all('SELECT * FROM locations', [], (err, rows) => {
    if (err) {
      console.error('Ошибка при получении локаций:', err);
      db.close();
      return;
    }
    
    console.log('Локации в базе данных:');
    console.log(JSON.stringify(rows, null, 2));
    
    // Проверяем наличие character_id
    const missingCharacterId = rows.filter(row => !row.character_id);
    if (missingCharacterId.length > 0) {
      console.log('Локации без character_id:', missingCharacterId.map(row => row.id));
      
      // Исправляем локации без character_id
      console.log('Обновляем локации без character_id...');
      missingCharacterId.forEach(location => {
        db.run('UPDATE locations SET character_id = ? WHERE id = ?', [1, location.id], function(err) {
          if (err) {
            console.error(`Ошибка при обновлении локации ${location.id}:`, err);
          } else {
            console.log(`Локация ${location.id} обновлена, character_id установлен в 1`);
          }
        });
      });
    } else {
      console.log('Все локации имеют character_id');
    }
    
    // Проверяем наличие currency_type
    const missingCurrencyType = rows.filter(row => !row.currency_type);
    if (missingCurrencyType.length > 0) {
      console.log('Локации без currency_type:', missingCurrencyType.map(row => row.id));
      
      // Исправляем локации без currency_type
      console.log('Обновляем локации без currency_type...');
      missingCurrencyType.forEach(location => {
        db.run('UPDATE locations SET currency_type = ? WHERE id = ?', ['forest', location.id], function(err) {
          if (err) {
            console.error(`Ошибка при обновлении локации ${location.id}:`, err);
          } else {
            console.log(`Локация ${location.id} обновлена, currency_type установлен в 'forest'`);
          }
        });
      });
    }
    
    // Закрываем соединение через 1 секунду, чтобы успеть выполнить обновления
    setTimeout(() => {
      db.close();
    }, 1000);
  });
}); 