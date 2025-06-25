const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./garden_tap_tap.db');

// Проверяем структуру таблицы player_currencies
db.all('PRAGMA table_info(player_currencies)', [], (err, rows) => {
  if (err) {
    console.error('Ошибка при проверке структуры таблицы:', err);
    db.close();
    return;
  }
  
  console.log('Структура таблицы player_currencies:');
  console.log(rows);
  
  // Проверяем наличие колонки currency_type
  const hasCurrencyType = rows.some(row => row.name === 'currency_type');
  const hasCurrencyId = rows.some(row => row.name === 'currency_id');
  
  console.log(`Колонка currency_type: ${hasCurrencyType ? 'существует' : 'отсутствует'}`);
  console.log(`Колонка currency_id: ${hasCurrencyId ? 'существует' : 'отсутствует'}`);
  
  // Если нет колонки currency_type, но есть currency_id, добавляем новую колонку
  if (!hasCurrencyType && hasCurrencyId) {
    console.log('Добавляем колонку currency_type...');
    db.run('ALTER TABLE player_currencies ADD COLUMN currency_type TEXT', [], function(err) {
      if (err) {
        console.error('Ошибка при добавлении колонки:', err);
        db.close();
        return;
      }
      
      console.log('Колонка currency_type добавлена успешно');
      
      // Копируем значения из currency_id в currency_type
      db.run('UPDATE player_currencies SET currency_type = currency_id', [], function(err) {
        if (err) {
          console.error('Ошибка при копировании значений:', err);
        } else {
          console.log('Значения скопированы из currency_id в currency_type');
        }
        db.close();
      });
    });
  } else if (!hasCurrencyType && !hasCurrencyId) {
    console.error('Отсутствуют обе колонки: currency_type и currency_id');
    db.close();
  } else {
    console.log('Структура таблицы в порядке');
    db.close();
  }
}); 