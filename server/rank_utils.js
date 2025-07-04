const { db } = require('./db');

// Функция для обновления ранга игрока и проверки достижений
async function updatePlayerRank(userId, seasonId, points) {
  try {
    // Получаем текущий ранг игрока
    const currentPlayerSeason = await db.get(
      'SELECT rank_id, highest_rank_id FROM player_season WHERE user_id = ? AND season_id = ?',
      [userId, seasonId]
    );
    
    // Если нет записи о сезоне, создаем
    if (!currentPlayerSeason) {
      await db.run(
        'INSERT INTO player_season (user_id, season_id, points, rank_id, highest_rank_id) VALUES (?, ?, ?, 1, 1)',
        [userId, seasonId, points]
      );
      return { rankChanged: false, newRank: { id: 1 } };
    }
    
    // Получаем все ранги
    const ranks = await db.all('SELECT * FROM ranks ORDER BY min_points ASC');
    
    // Определяем новый ранг на основе очков
    let newRankId = 1; // По умолчанию первый ранг
    
    for (const rank of ranks) {
      if (points >= rank.min_points) {
        newRankId = rank.id;
      } else {
        break;
      }
    }
    
    // Получаем информацию о новом ранге
    const newRank = ranks.find(r => r.id === newRankId);
    
    // Если ранг изменился или это новый максимальный ранг
    const rankChanged = currentPlayerSeason.rank_id !== newRankId;
    const newHighestRank = Math.max(newRankId, currentPlayerSeason.highest_rank_id || 1);
    
    // Обновляем ранг в базе
    await db.run(
      'UPDATE player_season SET rank_id = ?, highest_rank_id = ? WHERE user_id = ? AND season_id = ?',
      [newRankId, newHighestRank, userId, seasonId]
    );
    
    // Обновляем профиль игрока
    await db.run(
      'UPDATE player_profile SET current_rank_id = ?, highest_rank_id = ? WHERE user_id = ?',
      [newRankId, newHighestRank, userId]
    );
    
    return { 
      rankChanged, 
      newRank,
      currentRank: currentPlayerSeason ? ranks.find(r => r.id === currentPlayerSeason.rank_id) : null
    };
  } catch (error) {
    console.error(`Ошибка при обновлении ранга: ${error.message}`);
    return { rankChanged: false };
  }
}

module.exports = {
  updatePlayerRank
}; 