const { db, initDatabase } = require('./db');

async function updateDailyTasks() {
  try {
    console.log('Инициализация базы данных...');
    await initDatabase();
    console.log('База данных инициализирована успешно');
    
    // Текущая дата и дата через 30 дней
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);
    const endDateString = endDate.toISOString().split('T')[0];
    
    // Очищаем таблицу daily_tasks
    console.log('Очищаем таблицу daily_tasks...');
    await db.run('DELETE FROM daily_tasks');
    console.log('Таблица daily_tasks очищена');
    
    // Создаем новые ежедневные задания
    console.log('Создаем новые ежедневные задания...');
    
    const tasks = [
      { 
        task_type: 'collect_currency', 
        description: 'Собрать 100 ресурсов', 
        target_value: 100, 
        season_points: 10, 
        exp: 100, 
        main_coins: 50, 
        activation_date: startDate, 
        end_activation_date: endDateString 
      },
      { 
        task_type: 'spend_energy', 
        description: 'Потратить 20 энергии', 
        target_value: 20, 
        season_points: 8, 
        exp: 75, 
        main_coins: 35, 
        activation_date: startDate, 
        end_activation_date: endDateString 
      },
      { 
        task_type: 'upgrade_helper', 
        description: 'Улучшить помощников', 
        target_value: 3, 
        season_points: 15, 
        exp: 150, 
        main_coins: 75, 
        activation_date: startDate, 
        end_activation_date: endDateString 
      }
    ];
    
    // Вставляем задания в базу данных
    for (const task of tasks) {
      await db.run(`
        INSERT INTO daily_tasks 
        (task_type, description, target_value, season_points, exp, main_coins, activation_date, end_activation_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        task.task_type, 
        task.description, 
        task.target_value, 
        task.season_points, 
        task.exp, 
        task.main_coins, 
        task.activation_date, 
        task.end_activation_date
      ]);
      
      console.log(`Добавлено задание: ${task.description}`);
    }
    
    console.log('Все ежедневные задания успешно добавлены');
    
    // Очищаем прогресс ежедневных заданий для тестового пользователя
    console.log('Очищаем прогресс ежедневных заданий для тестового пользователя...');
    await db.run("DELETE FROM player_daily_task_progress WHERE user_id = 'test_user' AND task_category = 'daily'");
    console.log('Прогресс ежедневных заданий очищен');
    
    // Выводим список добавленных заданий
    console.log('\nСписок ежедневных заданий:');
    const dailyTasks = await db.all('SELECT * FROM daily_tasks');
    console.table(dailyTasks);
    
  } catch (error) {
    console.error('Ошибка при обновлении ежедневных заданий:', error);
  } finally {
    process.exit();
  }
}

// Запускаем обновление ежедневных заданий
updateDailyTasks(); 