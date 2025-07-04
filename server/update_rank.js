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
  console.log('База данных открыта успешно.');
  
  // Начинаем обновление рангов
  updateRanks();
});

// Промисифицированный запрос к БД
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// Промисифицированный запрос к БД (один результат)
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Промисифицированное выполнение SQL
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// Функция обновления рангов
async function updateRanks() {
  try {
    console.log('Запускаем обновление рангов для всех игроков...');
    
    // Получаем все ранги
    const ranks = await query('SELECT * FROM ranks ORDER BY min_points ASC');
    console.log(`Найдено ${ranks.length} рангов:`);
    ranks.forEach(rank => {
      console.log(`- Ранг ${rank.id}: ${rank.name} (от ${rank.min_points} очков)`);
    });
    
    // Получаем текущий активный сезон
    const currentSeason = await get(`
      SELECT id FROM seasons WHERE is_active = 1 
      OR (CURRENT_TIMESTAMP BETWEEN start_date AND end_date)
      ORDER BY start_date DESC LIMIT 1
    `);
    
    if (!currentSeason) {
      console.error('Активный сезон не найден!');
      process.exit(1);
    }
    
    console.log(`Текущий сезон: ID=${currentSeason.id}`);
    
    // Получаем всех игроков
    const players = await query(`
      SELECT DISTINCT user_id FROM player_season 
      WHERE season_id = ?
    `, [currentSeason.id]);
    
    console.log(`Найдено ${players.length} игроков в текущем сезоне`);
    
    for (const player of players) {
      const userId = player.user_id;
      console.log(`\nОбработка игрока ${userId}...`);
      
      // Получаем прогресс игрока в текущем сезоне
      const playerSeason = await get(`
        SELECT points, rank_id, highest_rank_id FROM player_season 
        WHERE user_id = ? AND season_id = ?
      `, [userId, currentSeason.id]);
      
      if (!playerSeason) {
        console.log(`У игрока ${userId} нет записи в сезоне ${currentSeason.id}, пропускаем`);
        continue;
      }
      
      console.log(`Текущие очки: ${playerSeason.points}, текущий ранг: ${playerSeason.rank_id}`);
      
      // Определяем новый ранг на основе очков
      let newRankId = 1; // По умолчанию первый ранг
      for (const rank of ranks) {
        if (playerSeason.points >= rank.min_points) {
          newRankId = rank.id;
        } else {
          break;
        }
      }
      
      const newRank = ranks.find(r => r.id === newRankId);
      console.log(`Новый ранг: ${newRank.name} (ID: ${newRankId})`);
      
      // Если ранг изменился, обновляем запись
      if (newRankId !== playerSeason.rank_id) {
        console.log(`Ранг изменился: ${playerSeason.rank_id} -> ${newRankId}`);
        
        // Обновляем ранг в таблице player_season
        await run(`
          UPDATE player_season 
          SET rank_id = ? 
          WHERE user_id = ? AND season_id = ?
        `, [newRankId, userId, currentSeason.id]);
        
        // Если новый ранг выше, обновляем высший ранг
        if (newRankId > playerSeason.highest_rank_id) {
          console.log(`Обновляем высший ранг: ${playerSeason.highest_rank_id} -> ${newRankId}`);
          
          await run(`
            UPDATE player_season 
            SET highest_rank_id = ? 
            WHERE user_id = ? AND season_id = ?
          `, [newRankId, userId, currentSeason.id]);
          
          // Также обновляем профиль игрока
          await run(`
            UPDATE player_profile 
            SET current_rank_id = ?, highest_rank_id = ? 
            WHERE user_id = ?
          `, [newRankId, newRankId, userId]);
          
          console.log('Профиль игрока обновлен');
        } else {
          // Обновляем только текущий ранг в профиле
          await run(`
            UPDATE player_profile 
            SET current_rank_id = ? 
            WHERE user_id = ?
          `, [newRankId, userId]);
          
          console.log('Текущий ранг в профиле обновлен');
        }
      } else {
        console.log('Ранг не изменился');
      }
    }
    
    console.log('\nОбновление рангов завершено!');
    
    // Выводим итоговую информацию
    console.log('\nТекущие ранги игроков:');
    const playerRanks = await query(`
      SELECT 
        ps.user_id, 
        ps.points, 
        r.name as rank_name, 
        r.id as rank_id,
        r.min_points
      FROM player_season ps
      JOIN ranks r ON ps.rank_id = r.id
      WHERE ps.season_id = ?
      ORDER BY ps.points DESC
    `, [currentSeason.id]);
    
    playerRanks.forEach(pr => {
      console.log(`- Игрок ${pr.user_id}: ${pr.points} очков, ранг: ${pr.rank_name} (ID: ${pr.rank_id}, мин. очков: ${pr.min_points})`);
    });
    
  } catch (error) {
    console.error('Ошибка при обновлении рангов:', error);
  } finally {
    // Закрываем базу данных
    db.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии базы данных:', err.message);
      } else {
        console.log('База данных закрыта.');
      }
      process.exit(0);
    });
  }
} 