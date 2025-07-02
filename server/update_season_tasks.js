const { db, initDatabase } = require('./db');

async function updateSeasonTasks() {
  try {
    console.log('Инициализация базы данных...');
    await initDatabase();
    console.log('База данных инициализирована успешно');
    
    // Очищаем таблицу season_tasks
    console.log('Очищаем таблицу season_tasks...');
    await db.run('DELETE FROM season_tasks');
    console.log('Таблица season_tasks очищена');
    
    // Проверяем наличие активного сезона
    console.log('Проверяем наличие активного сезона...');
    const activeSeason = await db.get('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1');
    
    if (!activeSeason) {
      console.log('Активный сезон не найден, создаем новый...');
      
      // Создаем новый сезон
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      const endDate = new Date();
      endDate.setDate(today.getDate() + 90); // 3 месяца
      const endDateString = endDate.toISOString().split('T')[0];
      
      await db.run(`
        INSERT INTO seasons (name, start_date, end_date, is_active)
        VALUES (?, ?, ?, 1)
      `, ['Сезон 1', startDate, endDateString]);
      
      console.log('Новый активный сезон создан');
    }
    
    // Получаем ID активного сезона
    const season = await db.get('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1');
    const seasonId = season.id;
    console.log(`Используем сезон с ID: ${seasonId}`);
    
    // Добавляем новые сезонные задания
    console.log('Добавляем новые сезонные задания...');
    
    const tasks = [
      { id: 1, season_id: seasonId, task_type: 'tap', description: 'Соверши 100 тапов', target_value: 100, season_points: 50, exp: 100, coins: 500 },
      { id: 2, season_id: seasonId, task_type: 'tap', description: 'Соверши 500 тапов', target_value: 500, season_points: 70, exp: 200, coins: 800 },
      { id: 3, season_id: seasonId, task_type: 'tap', description: 'Соверши 1000 тапов', target_value: 1000, season_points: 90, exp: 300, coins: 1000 },
      { id: 4, season_id: seasonId, task_type: 'tap', description: 'Соверши 1000 тапов', target_value: 1000, season_points: 90, exp: 300, coins: 1000 },
      { id: 5, season_id: seasonId, task_type: 'unlock_tool', description: 'Открой 3 инструмента', target_value: 3, season_points: 100, exp: 400, coins: 1200 },
      { id: 6, season_id: seasonId, task_type: 'unlock_tool', description: 'Открой 5 инструментов', target_value: 5, season_points: 120, exp: 500, coins: 1500 },
      { id: 7, season_id: seasonId, task_type: 'upgrade_helpers', description: 'Улучши помощников 10 раз', target_value: 10, season_points: 110, exp: 450, coins: 1300 },
      { id: 8, season_id: seasonId, task_type: 'collect_currency', description: 'Собери 10,000 главной валюты', target_value: 10000, season_points: 100, exp: 400, coins: 1000 },
      { id: 9, season_id: seasonId, task_type: 'collect_currency', description: 'Собери 10,000 главной валюты', target_value: 10000, season_points: 100, exp: 400, coins: 1000 },
      { id: 10, season_id: seasonId, task_type: 'level_up', description: 'Прокачай уровень до 10', target_value: 10, season_points: 130, exp: 500, coins: 1400 },
      { id: 11, season_id: seasonId, task_type: 'level_up', description: 'Прокачай уровень до 25', target_value: 25, season_points: 160, exp: 700, coins: 2000 },
      { id: 12, season_id: seasonId, task_type: 'unlock_location', description: 'Открой 3 локации', target_value: 3, season_points: 140, exp: 600, coins: 1800 },
      { id: 13, season_id: seasonId, task_type: 'spend_energy', description: 'Потрать 500 энергии', target_value: 500, season_points: 90, exp: 300, coins: 900 },
      { id: 14, season_id: seasonId, task_type: 'complete_dailies', description: 'Выполни 7 ежедневных заданий', target_value: 7, season_points: 150, exp: 600, coins: 2000 },
      { id: 15, season_id: seasonId, task_type: 'earn_exp_season', description: 'Заработай 5 000 опыта за сезон', target_value: 5000, season_points: 170, exp: 0, coins: 2500 }
    ];
    
    // Вставляем задания в базу данных
    for (const task of tasks) {
      await db.run(`
        INSERT INTO season_tasks 
        (id, season_id, task_type, description, target_value, season_points, exp, coins)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [task.id, task.season_id, task.task_type, task.description, task.target_value, task.season_points, task.exp, task.coins]);
      
      console.log(`Добавлено задание: ${task.description}`);
    }
    
    console.log('Все сезонные задания успешно добавлены');
    
    // Очищаем прогресс сезонных заданий для тестового пользователя
    console.log('Очищаем прогресс сезонных заданий для тестового пользователя...');
    await db.run("DELETE FROM player_daily_task_progress WHERE user_id = 'test_user' AND task_category = 'season'");
    console.log('Прогресс сезонных заданий очищен');
    
    // Выводим список добавленных заданий
    console.log('\nСписок сезонных заданий:');
    const seasonTasks = await db.all('SELECT * FROM season_tasks');
    console.table(seasonTasks);
    
  } catch (error) {
    console.error('Ошибка при обновлении сезонных заданий:', error);
  } finally {
    process.exit();
  }
}

// Запускаем обновление сезонных заданий
updateSeasonTasks(); 