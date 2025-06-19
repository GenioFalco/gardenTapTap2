const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'garden_tap_tap.db');

// ID инструмента, который нужно удалить
const toolIdToRemove = 3;
const userId = 'test_user';

// Открываем базу данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка при открытии базы данных:', err.message);
    process.exit(1);
  }
  console.log('Соединение с базой данных установлено.');
  
  // Удаляем инструмент из таблицы player_tools
  db.run(`
    DELETE FROM player_tools 
    WHERE user_id = ? AND tool_id = ?
  `, [userId, toolIdToRemove], function(err) {
    if (err) {
      console.error('Ошибка при удалении инструмента:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log(`Удалено ${this.changes} записей из таблицы player_tools`);
    
    // Проверяем, есть ли этот инструмент в экипированных
    db.get(`
      SELECT 1 FROM player_equipped_tools 
      WHERE user_id = ? AND tool_id = ?
    `, [userId, toolIdToRemove], (err, row) => {
      if (err) {
        console.error('Ошибка при проверке экипированного инструмента:', err.message);
        db.close();
        process.exit(1);
      }
      
      if (row) {
        // Если инструмент экипирован, устанавливаем другой инструмент
        db.get(`
          SELECT character_id FROM player_equipped_tools 
          WHERE user_id = ? AND tool_id = ?
        `, [userId, toolIdToRemove], (err, equippedRow) => {
          if (err || !equippedRow) {
            console.error('Ошибка при получении персонажа:', err ? err.message : 'Не найден персонаж');
            db.close();
            process.exit(1);
          }
          
          // Получаем другой доступный инструмент
          db.get(`
            SELECT pt.tool_id 
            FROM player_tools pt
            JOIN tools t ON pt.tool_id = t.id
            WHERE pt.user_id = ? AND t.character_id = ? AND pt.tool_id != ?
            LIMIT 1
          `, [userId, equippedRow.character_id, toolIdToRemove], (err, availableTool) => {
            if (err) {
              console.error('Ошибка при поиске доступного инструмента:', err.message);
              db.close();
              process.exit(1);
            }
            
            if (availableTool) {
              // Экипируем доступный инструмент
              db.run(`
                UPDATE player_equipped_tools
                SET tool_id = ?
                WHERE user_id = ? AND character_id = ?
              `, [availableTool.tool_id, userId, equippedRow.character_id], function(err) {
                if (err) {
                  console.error('Ошибка при обновлении экипированного инструмента:', err.message);
                } else {
                  console.log(`Инструмент ${availableTool.tool_id} установлен вместо удаленного инструмента ${toolIdToRemove}`);
                }
                
                db.close();
                console.log('Операция завершена.');
              });
            } else {
              console.log('Нет доступных инструментов для замены удаленного.');
              db.close();
              console.log('Операция завершена.');
            }
          });
        });
      } else {
        console.log('Инструмент не был экипирован.');
        db.close();
        console.log('Операция завершена.');
      }
    });
  });
}); 