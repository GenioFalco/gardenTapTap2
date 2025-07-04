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
      // Для ежедневных заданий тапы не используются
      seasonTaskType = 'tap';
    } 
    else if (taskType === 'collect_currency' || taskType === 'daily_resources' || taskType === 'resources') {
      dailyTaskType = 'collect_currency';
      seasonTaskType = 'collect_currency';
    } 
    else if (taskType === 'spend_currency') {
      dailyTaskType = 'spend_currency';
      // В сезонных нет типа spend_currency
    }
    else if (taskType === 'spend_location_currency') {
      dailyTaskType = 'spend_location_currency';
      // Новый тип задания - трата ресурсов локации
    }
    else if (taskType === 'spend_energy' || taskType === 'daily_energy' || taskType === 'energy') {
      dailyTaskType = 'spend_energy'; // Добавляем для ежедневных заданий
      seasonTaskType = 'spend_energy';
    }
    else if (taskType === 'upgrade_helper' || taskType === 'upgrade_helpers') {
      dailyTaskType = 'upgrade_helper';
      seasonTaskType = 'upgrade_helpers';
    }
    else if (taskType === 'tap') {
      seasonTaskType = 'tap';
    }
    else if (taskType === 'unlock_tool') {
      seasonTaskType = 'unlock_tool';
    }
    else if (taskType === 'level_up') {
      seasonTaskType = 'level_up';
    }
    else if (taskType === 'unlock_location') {
      seasonTaskType = 'unlock_location';
    }
    else if (taskType === 'complete_dailies') {
      seasonTaskType = 'complete_dailies';
    }
    else if (taskType === 'earn_exp_season') {
      seasonTaskType = 'earn_exp_season';
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
      // Проверка и обновление текущего состояния для типов заданий, требующих проверки
      if (seasonTaskType === 'unlock_tool' || seasonTaskType === 'upgrade_helpers' || 
          seasonTaskType === 'level_up' || seasonTaskType === 'unlock_location') {
        
        let currentProgress = 0;
        
        // Получаем текущее значение в зависимости от типа задания
        if (seasonTaskType === 'unlock_tool') {
          // Получаем количество разблокированных инструментов
          const tools = await db.all(`
            SELECT COUNT(*) as count FROM player_tools WHERE user_id = ?
          `, [userId]);
          currentProgress = tools[0].count || 0;
        }
        else if (seasonTaskType === 'upgrade_helpers') {
          // Получаем общий уровень всех помощников
          const helpers = await db.all(`
            SELECT SUM(level) as total_levels FROM player_helpers WHERE user_id = ?
          `, [userId]);
          currentProgress = helpers[0].total_levels || 0;
        }
        else if (seasonTaskType === 'level_up') {
          // Получаем текущий уровень игрока
          const playerProgress = await db.get(`
            SELECT level FROM player_progress WHERE user_id = ?
          `, [userId]);
          currentProgress = playerProgress ? playerProgress.level : 1;
        }
        else if (seasonTaskType === 'unlock_location') {
          // Получаем количество разблокированных локаций
          const locations = await db.all(`
            SELECT COUNT(*) as count FROM player_locations WHERE user_id = ?
          `, [userId]);
          currentProgress = locations[0].count || 0;
        }
        
        // Теперь обновляем прогресс для соответствующих заданий
        const activeSeasonTasks = await db.all(`
          SELECT st.id, st.target_value
          FROM season_tasks st
          JOIN seasons s ON st.season_id = s.id
          WHERE st.task_type = ? AND s.is_active = 1
        `, [seasonTaskType]);
        
        if (activeSeasonTasks.length > 0) {
          for (const task of activeSeasonTasks) {
            // Проверяем, есть ли запись о прогрессе
            const progressRecord = await db.get(`
              SELECT * FROM player_daily_task_progress
              WHERE user_id = ? AND task_id = ? AND task_category = 'season'
            `, [userId, task.id]);
            
            // Вычисляем, выполнено ли задание
            const completed = currentProgress >= task.target_value ? 1 : 0;
            
            if (!progressRecord) {
              // Если записи нет, создаем ее
              await db.run(`
                INSERT INTO player_daily_task_progress 
                (user_id, task_id, task_category, completed, progress, reward_claimed) 
                VALUES (?, ?, 'season', ?, ?, 0)
              `, [userId, task.id, completed, currentProgress]);
            } else {
              // Если запись есть, обновляем прогресс
              await db.run(`
                UPDATE player_daily_task_progress
                SET progress = ?, completed = ?
                WHERE user_id = ? AND task_id = ? AND task_category = 'season'
              `, [currentProgress, completed, userId, task.id]);
            }
          }
          
          seasonTasksUpdated.changes = activeSeasonTasks.length;
        }
      }
      // Особая обработка для задания по накоплению опыта за сезон
      else if (seasonTaskType === 'earn_exp_season') {
        // Получаем текущий активный сезон
        const currentSeason = await db.get(`
          SELECT id FROM seasons WHERE is_active = 1 LIMIT 1
        `);
        
        if (currentSeason) {
          // Получаем текущий опыт игрока
          const playerExperience = await db.get(`
            SELECT experience FROM player_progress 
            WHERE user_id = ?
          `, [userId]);
          
          const currentExp = playerExperience ? playerExperience.experience : 0;
          
          // Обновляем прогресс для заданий типа earn_exp_season
          const activeSeasonTasks = await db.all(`
            SELECT st.id, st.target_value
            FROM season_tasks st
            WHERE st.task_type = 'earn_exp_season' AND st.season_id = ?
          `, [currentSeason.id]);
          
          if (activeSeasonTasks.length > 0) {
            for (const task of activeSeasonTasks) {
              // Проверяем, есть ли запись о прогрессе
              const progressRecord = await db.get(`
                SELECT * FROM player_daily_task_progress
                WHERE user_id = ? AND task_id = ? AND task_category = 'season'
              `, [userId, task.id]);
              
              // Вычисляем, выполнено ли задание
              const completed = currentExp >= task.target_value ? 1 : 0;
              
              if (!progressRecord) {
                // Если записи нет, создаем ее
                await db.run(`
                  INSERT INTO player_daily_task_progress 
                  (user_id, task_id, task_category, completed, progress, reward_claimed) 
                  VALUES (?, ?, 'season', ?, ?, 0)
                `, [userId, task.id, completed, currentExp]);
              } else {
                // Если запись есть, обновляем прогресс
                await db.run(`
                  UPDATE player_daily_task_progress
                  SET progress = ?, completed = ?
                  WHERE user_id = ? AND task_id = ? AND task_category = 'season'
                `, [currentExp, completed, userId, task.id]);
              }
            }
            
            seasonTasksUpdated.changes = activeSeasonTasks.length;
          }
        }
      }
      // Добавляем специальную обработку для ежедневных заданий upgrade_helper и spend_currency
      else if (dailyTaskType === 'upgrade_helper' || dailyTaskType === 'spend_currency' || dailyTaskType === 'spend_location_currency') {
        let currentProgress = 0;
        
        if (dailyTaskType === 'upgrade_helper') {
          // Получаем общий уровень всех помощников
          const helpers = await db.all(`
            SELECT SUM(level) as total_levels FROM player_helpers WHERE user_id = ?
          `, [userId]);
          currentProgress = helpers[0].total_levels || 0;
        }
        else if (dailyTaskType === 'spend_currency' || dailyTaskType === 'spend_location_currency') {
          // Здесь просто используем переданный прогресс
          currentProgress = progress;
        }
        
        // Обновляем прогресс для ежедневных заданий
        const activeDailyTasks = await db.all(`
          SELECT id, target_value FROM daily_tasks 
          WHERE task_type = ? 
          AND activation_date <= ? 
          AND end_activation_date >= ?
        `, [dailyTaskType, dateString, dateString]);
        
        if (activeDailyTasks.length > 0) {
          for (const task of activeDailyTasks) {
            // Проверяем, есть ли запись о прогрессе
            const progressRecord = await db.get(`
              SELECT * FROM player_daily_task_progress
              WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
            `, [userId, task.id]);
            
            if (dailyTaskType === 'upgrade_helper') {
              // Для улучшения помощников используем абсолютное значение
              const completed = currentProgress >= task.target_value ? 1 : 0;
              
              if (!progressRecord) {
                // Если записи нет, создаем ее
                await db.run(`
                  INSERT INTO player_daily_task_progress 
                  (user_id, task_id, task_category, completed, progress, reward_claimed) 
                  VALUES (?, ?, 'daily', ?, ?, 0)
                `, [userId, task.id, completed, currentProgress]);
              } else {
                // Если запись есть, обновляем прогресс
                await db.run(`
                  UPDATE player_daily_task_progress
                  SET progress = ?, completed = ?
                  WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
                `, [currentProgress, completed, userId, task.id]);
              }
            } else {
              // Для других типов накапливаем прогресс
              let newProgress = progressRecord ? (progressRecord.progress + currentProgress) : currentProgress;
              const completed = newProgress >= task.target_value ? 1 : 0;
              
              if (!progressRecord) {
                // Если записи нет, создаем ее
                await db.run(`
                  INSERT INTO player_daily_task_progress 
                  (user_id, task_id, task_category, completed, progress, reward_claimed) 
                  VALUES (?, ?, 'daily', ?, ?, 0)
                `, [userId, task.id, completed, newProgress]);
              } else {
                // Если запись есть, обновляем прогресс
                await db.run(`
                  UPDATE player_daily_task_progress
                  SET progress = ?, completed = ?
                  WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
                `, [newProgress, completed, userId, task.id]);
              }
            }
          }
          
          dailyTasksUpdated.changes = activeDailyTasks.length;
        }
      }
      // Обычное обновление для стандартных типов
      else {
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

// Маршрут для принудительной проверки и обновления прогресса всех типов заданий
router.post('/check-all-progress', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID пользователя не указан' });
    }
    
    // Получаем необходимые данные о прогрессе игрока
    const playerProgress = await db.get(`
      SELECT level, experience FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    const unlockedTools = await db.all(`
      SELECT COUNT(*) as count FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    const helpers = await db.all(`
      SELECT SUM(level) as total_levels FROM player_helpers WHERE user_id = ?
    `, [userId]);
    
    const unlockedLocations = await db.all(`
      SELECT COUNT(*) as count FROM player_locations WHERE user_id = ?
    `, [userId]);
    
    const completedDailyTasks = await db.all(`
      SELECT COUNT(*) as count FROM player_daily_task_progress 
      WHERE user_id = ? AND task_category = 'daily' AND completed = 1
    `, [userId]);
    
    // Получаем текущий активный сезон
    const currentSeason = await db.get(`
      SELECT id FROM seasons WHERE is_active = 1 LIMIT 1
    `);
    
    if (!currentSeason) {
      return res.status(404).json({ success: false, error: 'Активный сезон не найден' });
    }
    
    // Преобразуем результаты в числа
    const currentLevel = playerProgress ? playerProgress.level : 1;
    const currentExp = playerProgress ? playerProgress.experience : 0;
    const toolsCount = unlockedTools[0].count || 0;
    const helpersLevels = helpers[0].total_levels || 0;
    const locationsCount = unlockedLocations[0].count || 0;
    const dailiesCompleted = completedDailyTasks[0].count || 0;
    
    // Получаем все активные сезонные задания
    const allSeasonTasks = await db.all(`
      SELECT * FROM season_tasks WHERE season_id = ?
    `, [currentSeason.id]);
    
    // Получаем текущую дату
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Получаем все активные ежедневные задания
    const allDailyTasks = await db.all(`
      SELECT * FROM daily_tasks 
      WHERE activation_date <= ? AND end_activation_date >= ?
    `, [dateString, dateString]);
    
    // Начинаем обновлять прогресс всех заданий
    let updatedTasks = 0;
    
    // Обновление для ежедневных заданий
    for (const task of allDailyTasks) {
      let currentProgress = 0;
      let completed = 0;
      
      // Определяем текущий прогресс в зависимости от типа задания
      if (task.task_type === 'upgrade_helper') {
        currentProgress = helpersLevels;
        completed = currentProgress >= task.target_value ? 1 : 0;
      }
      else if (task.task_type === 'spend_currency') {
        // Для spend_currency оставляем текущий прогресс
        const progressRecord = await db.get(`
          SELECT progress FROM player_daily_task_progress
          WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
        `, [userId, task.id]);
        
        currentProgress = progressRecord ? progressRecord.progress : 0;
        completed = currentProgress >= task.target_value ? 1 : 0;
      }
      else if (task.task_type === 'spend_energy') {
        // Для spend_energy оставляем текущий прогресс
        const progressRecord = await db.get(`
          SELECT progress FROM player_daily_task_progress
          WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
        `, [userId, task.id]);
        
        currentProgress = progressRecord ? progressRecord.progress : 0;
        completed = currentProgress >= task.target_value ? 1 : 0;
      }
      else if (task.task_type === 'spend_location_currency') {
        // Для spend_location_currency оставляем текущий прогресс
        const progressRecord = await db.get(`
          SELECT progress FROM player_daily_task_progress
          WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
        `, [userId, task.id]);
        
        currentProgress = progressRecord ? progressRecord.progress : 0;
        completed = currentProgress >= task.target_value ? 1 : 0;
      }
      else if (task.task_type === 'collect_currency') {
        // Для collect_currency оставляем текущий прогресс
        const progressRecord = await db.get(`
          SELECT progress FROM player_daily_task_progress
          WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
        `, [userId, task.id]);
        
        currentProgress = progressRecord ? progressRecord.progress : 0;
        completed = currentProgress >= task.target_value ? 1 : 0;
      }
      
      // Обновляем или создаем запись о прогрессе
      const progressRecord = await db.get(`
        SELECT * FROM player_daily_task_progress
        WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
      `, [userId, task.id]);
      
      if (!progressRecord) {
        await db.run(`
          INSERT INTO player_daily_task_progress 
          (user_id, task_id, task_category, completed, progress, reward_claimed) 
          VALUES (?, ?, 'daily', ?, ?, 0)
        `, [userId, task.id, completed, currentProgress]);
      } else {
        await db.run(`
          UPDATE player_daily_task_progress
          SET progress = ?, completed = ?
          WHERE user_id = ? AND task_id = ? AND task_category = 'daily'
        `, [currentProgress, completed, userId, task.id]);
      }
      
      updatedTasks++;
    }
    
    // Обновление для сезонных заданий
    for (const task of allSeasonTasks) {
      let currentProgress = 0;
      
      // Определяем текущий прогресс в зависимости от типа задания
      switch (task.task_type) {
        case 'unlock_tool':
          currentProgress = toolsCount;
          break;
        case 'upgrade_helpers':
          currentProgress = helpersLevels;
          break;
        case 'level_up':
          currentProgress = currentLevel;
          break;
        case 'unlock_location':
          currentProgress = locationsCount;
          break;
        case 'complete_dailies':
          currentProgress = dailiesCompleted;
          break;
        case 'earn_exp_season':
          // Используем текущий опыт игрока для задания по опыту
          currentProgress = currentExp;
          break;
        // Для остальных типов заданий оставляем текущий прогресс без изменений
        default:
          // Получаем текущий прогресс из БД
          const taskProgress = await db.get(`
            SELECT progress FROM player_daily_task_progress 
            WHERE user_id = ? AND task_id = ? AND task_category = 'season'
          `, [userId, task.id]);
          
          currentProgress = taskProgress ? taskProgress.progress : 0;
          break;
      }
      
      // Вычисляем, выполнено ли задание
      const completed = currentProgress >= task.target_value ? 1 : 0;
      
      // Проверяем, существует ли запись о прогрессе
      const progressRecord = await db.get(`
        SELECT * FROM player_daily_task_progress
        WHERE user_id = ? AND task_id = ? AND task_category = 'season'
      `, [userId, task.id]);
      
      if (!progressRecord) {
        // Если записи нет, создаем ее
        await db.run(`
          INSERT INTO player_daily_task_progress 
          (user_id, task_id, task_category, completed, progress, reward_claimed) 
          VALUES (?, ?, 'season', ?, ?, 0)
        `, [userId, task.id, completed, currentProgress]);
      } else {
        // Если запись есть и прогресс изменился, обновляем ее
        if (progressRecord.progress !== currentProgress || progressRecord.completed !== completed) {
          await db.run(`
            UPDATE player_daily_task_progress
            SET progress = ?, completed = ?
            WHERE user_id = ? AND task_id = ? AND task_category = 'season'
          `, [currentProgress, completed, userId, task.id]);
        }
      }
      
      updatedTasks++;
    }
    
    return res.json({
      success: true,
      updatedTasks: updatedTasks,
      currentState: {
        level: currentLevel,
        experience: currentExp,
        toolsCount: toolsCount,
        helpersLevels: helpersLevels,
        locationsCount: locationsCount,
        dailiesCompleted: dailiesCompleted
      }
    });
    
  } catch (error) {
    console.error('Ошибка при проверке прогресса заданий:', error);
    return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router; 