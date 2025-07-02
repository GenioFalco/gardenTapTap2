const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Получение сезонных заданий для игрока
router.get('/season', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя не указан' });
    }
    
    // Получаем текущий активный сезон
    const currentSeason = await db.get(`
      SELECT id FROM seasons WHERE is_active = 1 LIMIT 1
    `);
    
    if (!currentSeason) {
      return res.status(404).json({ success: false, error: 'Активный сезон не найден', tasks: [] });
    }
    
    // Получаем все сезонные задания для текущего сезона
    const tasks = await db.all(`
      SELECT 
        st.id, 
        st.description, 
        st.task_type as taskType,
        st.target_value as targetValue,
        st.season_points as seasonPoints,
        st.exp,
        st.coins,
        COALESCE(pdtp.progress, 0) as progress,
        CASE WHEN pdtp.progress >= st.target_value THEN 1 ELSE 0 END as completed,
        COALESCE(pdtp.reward_claimed, 0) as rewardClaimed
      FROM 
        season_tasks st
      LEFT JOIN 
        player_daily_task_progress pdtp ON st.id = pdtp.task_id AND pdtp.user_id = ? AND pdtp.task_category = 'season'
      WHERE 
        st.season_id = ?
    `, [userId, currentSeason.id]);
    
    // Если у игрока нет записей о прогрессе, создаем их
    if (tasks.some(task => task.progress === 0 && !task.completed)) {
      const taskIds = tasks.filter(task => task.progress === 0 && !task.completed).map(task => task.id);
      
      // Для каждого задания без прогресса создаем запись
      for (const taskId of taskIds) {
        await db.run(`
          INSERT OR IGNORE INTO player_daily_task_progress 
          (user_id, task_id, task_category, completed, progress, reward_claimed) 
          VALUES (?, ?, 'season', 0, 0, 0)
        `, [userId, taskId]);
      }
    }
    
    return res.json({ success: true, tasks });
    
  } catch (error) {
    console.error('Ошибка при получении сезонных заданий:', error);
    return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера', tasks: [] });
  }
});

// Получение ежедневных заданий для игрока
router.get('/daily', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя не указан' });
    }
    
    // Текущая дата
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Получаем все активные ежедневные задания
    const tasks = await db.all(`
      SELECT 
        dt.id, 
        dt.description, 
        dt.task_type as taskType,
        dt.target_value as targetValue,
        dt.season_points as seasonPoints,
        dt.exp,
        dt.main_coins as coins,
        COALESCE(pdtp.progress, 0) as progress,
        CASE WHEN pdtp.progress >= dt.target_value THEN 1 ELSE 0 END as completed,
        COALESCE(pdtp.reward_claimed, 0) as rewardClaimed
      FROM 
        daily_tasks dt
      LEFT JOIN 
        player_daily_task_progress pdtp ON dt.id = pdtp.task_id AND pdtp.user_id = ? AND pdtp.task_category = 'daily'
      WHERE 
        dt.activation_date <= ? AND dt.end_activation_date >= ?
    `, [userId, dateString, dateString]);
    
    // Если у игрока нет записей о прогрессе, создаем их
    if (tasks.some(task => task.progress === 0 && !task.completed)) {
      const taskIds = tasks.filter(task => task.progress === 0 && !task.completed).map(task => task.id);
      
      // Для каждого задания без прогресса создаем запись
      for (const taskId of taskIds) {
        await db.run(`
          INSERT OR IGNORE INTO player_daily_task_progress 
          (user_id, task_id, task_category, completed, progress, reward_claimed) 
          VALUES (?, ?, 'daily', 0, 0, 0)
        `, [userId, taskId]);
      }
    }
    
    return res.json({ success: true, tasks });
    
  } catch (error) {
    console.error('Ошибка при получении ежедневных заданий:', error);
    return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера', tasks: [] });
  }
});

// Получение награды за выполненное задание
router.post('/:category/:taskId/claim', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { category, taskId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя не указан' });
    }
    
    if (!['season', 'daily'].includes(category)) {
      return res.status(400).json({ success: false, error: 'Неверная категория задания' });
    }
    
    // Проверяем, выполнено ли задание
    const task = await db.get(`
      SELECT 
        task_id,
        progress,
        completed,
        reward_claimed
      FROM 
        player_daily_task_progress
      WHERE 
        user_id = ? AND task_id = ? AND task_category = ?
    `, [userId, taskId, category]);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Задание не найдено' });
    }
    
    if (task.reward_claimed === 1) {
      return res.status(400).json({ success: false, error: 'Награда уже получена' });
    }
    
    if (task.completed === 0) {
      return res.status(400).json({ success: false, error: 'Задание еще не выполнено' });
    }
    
    // Получаем информацию о награде
    const taskInfo = await db.get(`
      SELECT 
        id,
        season_points as seasonPoints,
        exp,
        ${category === 'season' ? 'coins' : 'main_coins as coins'}
      FROM 
        ${category === 'season' ? 'season_tasks' : 'daily_tasks'}
      WHERE 
        id = ?
    `, [taskId]);
    
    if (!taskInfo) {
      return res.status(404).json({ success: false, error: 'Информация о задании не найдена' });
    }
    
    // Начинаем транзакцию для обновления данных
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Обновляем флаг получения награды
      await db.run(`
        UPDATE player_daily_task_progress
        SET reward_claimed = 1
        WHERE user_id = ? AND task_id = ? AND task_category = ?
      `, [userId, taskId, category]);
      
      // Добавляем опыт игроку
      await db.run(`
        UPDATE player_progress
        SET experience = experience + ?
        WHERE user_id = ?
      `, [taskInfo.exp, userId]);
      
      // Добавляем монеты игроку (основная валюта)
      await db.run(`
        INSERT INTO player_currencies (user_id, currency_id, amount)
        VALUES (?, 1, ?)
        ON CONFLICT(user_id, currency_id) DO UPDATE SET
        amount = amount + ?
      `, [userId, taskInfo.coins, taskInfo.coins]);
      
      // Если это сезонное задание, добавляем очки сезона
      if (category === 'season' && taskInfo.seasonPoints > 0) {
        // Получаем текущий сезон
        const currentSeason = await db.get(`
          SELECT id FROM seasons WHERE is_active = 1 LIMIT 1
        `);
        
        if (currentSeason) {
          // Добавляем очки сезона
          await db.run(`
            INSERT INTO player_season (user_id, season_id, points)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, season_id) DO UPDATE SET
            points = points + ?
          `, [userId, currentSeason.id, taskInfo.seasonPoints, taskInfo.seasonPoints]);
        }
      }
      
      // Завершаем транзакцию
      await db.run('COMMIT');
      
      // Возвращаем информацию о полученной награде
      return res.json({
        success: true,
        rewards: {
          exp: taskInfo.exp,
          coins: taskInfo.coins,
          seasonPoints: category === 'season' ? taskInfo.seasonPoints : 0
        }
      });
      
    } catch (error) {
      // В случае ошибки отменяем транзакцию
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Ошибка при получении награды за задание:', error);
    return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление прогресса заданий игрока после тапов
router.post('/update-progress', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { taskType, progress } = req.body;
    
    if (!userId || !taskType || progress === undefined) {
      return res.status(400).json({ success: false, error: 'Недостаточно данных для обновления' });
    }
    
    // Текущая дата
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Определяем категорию и тип задания для базы данных
    let dailyTaskType = '';
    let seasonTaskType = '';
    
    // Преобразуем типы заданий для совместимости
    if (taskType === 'daily_taps' || taskType === 'taps') {
      dailyTaskType = 'daily_taps';
      seasonTaskType = 'tap'; // Для сезонных заданий используем тип 'tap'
    } 
    else if (taskType === 'daily_resources' || taskType === 'resources') {
      dailyTaskType = 'daily_resources';
      seasonTaskType = 'collect_currency'; // Для сезонных заданий используем тип 'collect_currency'
    } 
    else if (taskType === 'daily_energy' || taskType === 'energy') {
      dailyTaskType = 'daily_energy';
      seasonTaskType = 'spend_energy'; // Для сезонных заданий используем тип 'spend_energy'
    }
    else if (taskType === 'season_taps' || taskType === 'tap') {
      seasonTaskType = 'tap';
    }
    else if (taskType === 'season_resources' || taskType === 'collect_currency') {
      seasonTaskType = 'collect_currency';
    }
    else if (taskType === 'season_energy' || taskType === 'spend_energy') {
      seasonTaskType = 'spend_energy';
    }
    
    // Результаты обновления
    let dailyTasksUpdated = { changes: 0 };
    let seasonTasksUpdated = { changes: 0 };
    
    // 1. Обновляем ежедневные задания, если есть соответствующий тип
    if (dailyTaskType) {
      // Проверяем наличие активных заданий этого типа
      const activeDailyTasks = await db.all(`
        SELECT id FROM daily_tasks 
        WHERE task_type = ? 
        AND activation_date <= ? 
        AND end_activation_date >= ?
      `, [dailyTaskType, dateString, dateString]);
      
      // Если есть активные задания, обновляем или создаем записи о прогрессе
      if (activeDailyTasks.length > 0) {
        for (const task of activeDailyTasks) {
          // Проверяем, есть ли запись о прогрессе
          const progressRecord = await db.get(`
            SELECT * FROM player_daily_task_progress
            WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
          `, [userId, task.id]);
          
          if (!progressRecord) {
            // Если записи нет, создаем ее
            await db.run(`
              INSERT INTO player_daily_task_progress 
              (user_id, task_id, task_category, completed, progress, reward_claimed) 
              VALUES (?, ?, 'daily', 0, ?, 0)
            `, [userId, task.id, progress]);
          } else {
            // Если запись есть, обновляем прогресс
            const taskInfo = await db.get(`
              SELECT target_value FROM daily_tasks WHERE id = ?
            `, [task.id]);
            
            const newProgress = progressRecord.progress + progress;
            const completed = newProgress >= taskInfo.target_value ? 1 : 0;
            
            await db.run(`
              UPDATE player_daily_task_progress
              SET progress = ?, completed = ?
              WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
            `, [newProgress, completed, userId, task.id]);
          }
        }
        
        dailyTasksUpdated.changes = activeDailyTasks.length;
      }
    }
    
    // 2. Обновляем сезонные задания, если есть соответствующий тип
    if (seasonTaskType) {
      // Проверяем наличие активных сезонных заданий этого типа
      const activeSeasonTasks = await db.all(`
        SELECT st.id 
        FROM season_tasks st
        JOIN seasons s ON st.season_id = s.id
        WHERE st.task_type = ? AND s.is_active = 1
      `, [seasonTaskType]);
      
      // Если есть активные задания, обновляем или создаем записи о прогрессе
      if (activeSeasonTasks.length > 0) {
        for (const task of activeSeasonTasks) {
          // Проверяем, есть ли запись о прогрессе
          const progressRecord = await db.get(`
            SELECT * FROM player_daily_task_progress
            WHERE user_id = ? AND task_id = ? AND task_category = 'season'
          `, [userId, task.id]);
          
          if (!progressRecord) {
            // Если записи нет, создаем ее
            await db.run(`
              INSERT INTO player_daily_task_progress 
              (user_id, task_id, task_category, completed, progress, reward_claimed) 
              VALUES (?, ?, 'season', 0, ?, 0)
            `, [userId, task.id, progress]);
          } else {
            // Если запись есть, обновляем прогресс
            const taskInfo = await db.get(`
              SELECT target_value FROM season_tasks WHERE id = ?
            `, [task.id]);
            
            const newProgress = progressRecord.progress + progress;
            const completed = newProgress >= taskInfo.target_value ? 1 : 0;
            
            await db.run(`
              UPDATE player_daily_task_progress
              SET progress = ?, completed = ?
              WHERE user_id = ? AND task_id = ? AND task_category = 'season'
            `, [newProgress, completed, userId, task.id]);
          }
        }
        
        seasonTasksUpdated.changes = activeSeasonTasks.length;
      }
    }
    
    return res.json({
      success: true,
      dailyTasksUpdated: dailyTasksUpdated.changes,
      seasonTasksUpdated: seasonTasksUpdated.changes,
      taskType: taskType
    });
    
  } catch (error) {
    console.error('Ошибка при обновлении прогресса заданий:', error);
    return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router; 