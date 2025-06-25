const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./garden_tap_tap.db');

console.log('=== СТРУКТУРА БАЗЫ ДАННЫХ ===\n');

// Получение списка всех таблиц
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('Ошибка при получении списка таблиц:', err);
    db.close();
    return;
  }

  console.log(`Найдено ${tables.length} таблиц:`);
  console.log(tables.map(t => t.name).join(', ') + '\n');

  // Перебираем каждую таблицу для получения схемы и данных
  let processedTables = 0;

  tables.forEach(table => {
    console.log(`\n=== ТАБЛИЦА: ${table.name} ===\n`);

    // Получаем схему таблицы
    db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
      if (err) {
        console.error(`Ошибка при получении схемы таблицы ${table.name}:`, err);
        checkComplete();
        return;
      }

      // Выводим структуру таблицы
      console.log('СТРУКТУРА:');
      columns.forEach(col => {
        console.log(`  ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
      });
      
      // Получаем примеры данных (первые 5 записей)
      db.all(`SELECT * FROM ${table.name} LIMIT 5`, (err, rows) => {
        if (err) {
          console.log(`Ошибка при получении данных из таблицы ${table.name}:`, err);
        } else {
          console.log('\nПРИМЕРЫ ДАННЫХ:');
          
          if (rows.length === 0) {
            console.log('  (таблица пуста)');
          } else {
            // Считаем количество записей в таблице
            db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
              const totalCount = err ? 'неизвестно' : result.count;
              console.log(`  Всего записей: ${totalCount}`);
              
              // Выводим данные
              rows.forEach((row, idx) => {
                console.log(`  Запись ${idx + 1}:`, JSON.stringify(row));
              });
              
              checkComplete();
            });
            return;
          }
        }
        
        checkComplete();
      });
    });
  });
  
  // Проверяем, все ли таблицы обработаны
  function checkComplete() {
    processedTables++;
    if (processedTables === tables.length * 2) {
      console.log('\n=== АНАЛИЗ ЗАВЕРШЕН ===');
      db.close();
    }
  }
}); 