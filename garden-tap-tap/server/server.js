const express = require('express');
const cors = require('cors');
const { db, initDatabase, CurrencyType, RewardType } = require('./db');

// Инициализируем Express приложение
const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors()); // Разрешаем CORS запросы
app.use(express.json()); // Парсим JSON тело запроса
app.use(express.static('../public')); // Статические файлы

// Middleware для извлечения user_id
app.use((req, res, next) => {
  // Извлекаем user_id из заголовка или используем тестовый id
  const userId = req.headers['x-user-id'] || 'test_user';
  req.userId = userId;
  next();
});

// API endpoints

// Получить все локации
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.all('SELECT * FROM locations');
    res.json(locations);
  } catch (error) {
    console.error('Ошибка при получении локаций:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить разблокированные локации для игрока
app.get('/api/player/locations', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Получаем все разблокированные локации игроком
    const unlockedLocations = await db.all(`
      SELECT location_id FROM player_locations WHERE user_id = ?
    `, [userId]);
    
    const unlockedLocationIds = unlockedLocations.map(loc => loc.location_id);
    
    // Получаем все доступные локации (разблокированные или доступные по уровню)
    const availableLocations = await db.all(`
      SELECT * FROM locations 
      WHERE id IN (${unlockedLocationIds.length > 0 ? unlockedLocationIds.join(',') : 0})
      OR unlock_level <= ?
    `, [playerProgress.level]);
    
    res.json(availableLocations);
  } catch (error) {
    console.error('Ошибка при получении локаций игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить персонажа по ID
app.get('/api/characters/:id', async (req, res) => {
  try {
    const character = await db.get('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Персонаж не найден' });
    }
    res.json(character);
  } catch (error) {
    console.error('Ошибка при получении персонажа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить инструменты для персонажа
app.get('/api/characters/:id/tools', async (req, res) => {
  try {
    const tools = await db.all('SELECT * FROM tools WHERE character_id = ?', [req.params.id]);
    res.json(tools);
  } catch (error) {
    console.error('Ошибка при получении инструментов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить разблокированные инструменты игрока для персонажа
app.get('/api/player/characters/:id/tools', async (req, res) => {
  try {
    const { userId } = req;
    const characterId = req.params.id;
    
    // Получаем инструменты персонажа
    const characterTools = await db.all(`
      SELECT t.* FROM tools t
      WHERE t.character_id = ?
    `, [characterId]);
    
    // Получаем разблокированные инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    const unlockedToolIds = unlockedTools.map(tool => tool.tool_id);
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Фильтруем доступные инструменты (разблокированные или доступные по уровню)
    const availableTools = characterTools.filter(tool => {
      return unlockedToolIds.includes(tool.id) || tool.unlock_level <= playerProgress.level;
    });
    
    res.json(availableTools);
  } catch (error) {
    console.error('Ошибка при получении инструментов игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить экипированный инструмент для персонажа
app.get('/api/player/characters/:id/equipped-tool', async (req, res) => {
  try {
    const { userId } = req;
    const characterId = req.params.id;
    
    // Получаем ID экипированного инструмента
    const equipped = await db.get(`
      SELECT tool_id FROM player_equipped_tools 
      WHERE user_id = ? AND character_id = ?
    `, [userId, characterId]);
    
    if (!equipped) {
      return res.status(404).json({ error: 'Экипированный инструмент не найден' });
    }
    
    // Получаем информацию об инструменте
    const tool = await db.get(`
      SELECT * FROM tools WHERE id = ?
    `, [equipped.tool_id]);
    
    res.json(tool);
  } catch (error) {
    console.error('Ошибка при получении экипированного инструмента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Экипировать инструмент
app.post('/api/player/equip-tool', async (req, res) => {
  try {
    const { userId } = req;
    const { characterId, toolId } = req.body;
    if (!characterId || !toolId) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }
    
    // Проверяем, есть ли такой инструмент у персонажа
    const tool = await db.get(`
      SELECT * FROM tools 
      WHERE id = ? AND character_id = ?
    `, [toolId, characterId]);
    
    if (!tool) {
      return res.status(404).json({ error: 'Инструмент не найден' });
    }
    
    // Проверяем, разблокирован ли инструмент
    const unlocked = await db.get(`
      SELECT 1 FROM player_tools 
      WHERE user_id = ? AND tool_id = ?
    `, [userId, toolId]);
    
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    if (!unlocked && tool.unlock_level > playerProgress.level) {
      return res.status(403).json({ error: 'Инструмент не разблокирован' });
    }
    
    // Обновляем или добавляем экипированный инструмент
    await db.run(`
      INSERT OR REPLACE INTO player_equipped_tools (user_id, character_id, tool_id)
      VALUES (?, ?, ?)
    `, [userId, characterId, toolId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при экипировке инструмента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить прогресс игрока
app.get('/api/player/progress', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем основную информацию о прогрессе
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Получаем разблокированные локации
    const unlockedLocations = await db.all(`
      SELECT location_id FROM player_locations WHERE user_id = ?
    `, [userId]);
    
    // Добавляем локации, доступные по уровню
    const levelUnlockedLocations = await db.all(`
      SELECT id FROM locations WHERE unlock_level <= ?
    `, [playerProgress.level]);
    
    // Объединяем ID локаций
    const unlockedLocationIds = [
      ...new Set([
        ...unlockedLocations.map(loc => loc.location_id),
        ...levelUnlockedLocations.map(loc => loc.id)
      ])
    ];
    
    // Получаем разблокированные инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    // Добавляем инструменты, доступные по уровню
    const levelUnlockedTools = await db.all(`
      SELECT id FROM tools WHERE unlock_level <= ?
    `, [playerProgress.level]);
    
    // Объединяем ID инструментов
    const unlockedToolIds = [
      ...new Set([
        ...unlockedTools.map(tool => tool.tool_id),
        ...levelUnlockedTools.map(tool => tool.id)
      ])
    ];
    
    // Получаем экипированные инструменты
    const equippedTools = await db.all(`
      SELECT character_id, tool_id FROM player_equipped_tools WHERE user_id = ?
    `, [userId]);
    
    // Преобразуем в объект для удобства
    const equippedToolsMap = equippedTools.reduce((acc, item) => {
      acc[item.character_id] = item.tool_id;
      return acc;
    }, {});
    
    // Формируем ответ
    const response = {
      ...playerProgress,
      unlockedLocations: unlockedLocationIds,
      unlockedTools: unlockedToolIds,
      equippedTools: equippedToolsMap
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка при получении прогресса игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить количество ресурсов игрока
app.get('/api/player/resources/:currencyType', async (req, res) => {
  try {
    const { userId } = req;
    const currencyType = req.params.currencyType;
    
    // Получаем или создаем запись о валюте
    await getOrCreatePlayerCurrency(userId, currencyType);
    
    // Получаем количество ресурсов
    const currency = await db.get(`
      SELECT amount FROM player_currencies
      WHERE user_id = ? AND currency_type = ?
    `, [userId, currencyType]);
    
    res.json({ amount: currency.amount });
  } catch (error) {
    console.error('Ошибка при получении количества ресурсов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить информацию об уровне
app.get('/api/levels/:level', async (req, res) => {
  try {
    const levelId = req.params.level;
    
    // Получаем информацию об уровне
    const level = await db.get(`
      SELECT * FROM levels WHERE level = ?
    `, [levelId]);
    
    if (!level) {
      return res.status(404).json({ error: 'Уровень не найден' });
    }
    
    // Получаем награды за уровень
    const rewards = await db.all(`
      SELECT * FROM rewards WHERE level_id = ?
    `, [levelId]);
    
    res.json({
      ...level,
      rewards
    });
  } catch (error) {
    console.error('Ошибка при получении информации об уровне:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Тап (основная механика)
app.post('/api/player/tap', async (req, res) => {
  try {
    const { userId } = req;
    const { locationId } = req.body;
    if (!locationId) {
      return res.status(400).json({ error: 'Отсутствует ID локации' });
    }
    
    // Получаем информацию о локации
    const location = await db.get(`
      SELECT * FROM locations WHERE id = ?
    `, [locationId]);
    
    if (!location) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }
    
    // Получаем прогресс игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Проверяем, есть ли энергия
    if (playerProgress.energy <= 0) {
      return res.status(403).json({ error: 'Недостаточно энергии' });
    }
    
    // Получаем экипированный инструмент
    const equipped = await db.get(`
      SELECT t.* FROM player_equipped_tools et
      JOIN tools t ON et.tool_id = t.id
      WHERE et.user_id = ? AND et.character_id = ?
    `, [userId, location.character_id]);
    
    // Если нет экипированного инструмента, используем базовый
    const toolPower = equipped ? equipped.power : 1;
    
    // Генерируем случайное количество ресурсов (от 50% до 150% от силы инструмента)
    const resourcesGained = Math.floor(toolPower * (0.5 + Math.random()));
    
    // Добавляем ресурсы
    await db.run(`
      INSERT OR REPLACE INTO player_currencies (user_id, currency_type, amount)
      VALUES (?, ?, COALESCE((SELECT amount FROM player_currencies 
        WHERE user_id = ? AND currency_type = ?), 0) + ?)
    `, [userId, location.currency_type, userId, location.currency_type, resourcesGained]);
    
    // Генерируем опыт (равен количеству ресурсов)
    const experienceGained = resourcesGained;
    
    // Уменьшаем энергию
    await db.run(`
      UPDATE player_progress
      SET energy = energy - 1
      WHERE user_id = ?
    `, [userId]);
    
    // Обработка опыта и проверка повышения уровня
    const { levelUp, level, rewards } = await addExperience(userId, experienceGained);
    
    // Получаем оставшуюся энергию
    const updatedProgress = await db.get(`
      SELECT energy FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    res.json({
      resourcesGained,
      experienceGained,
      levelUp,
      level,
      rewards,
      energyLeft: updatedProgress.energy
    });
  } catch (error) {
    console.error('Ошибка при тапе:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Улучшить инструмент
app.post('/api/player/upgrade-tool', async (req, res) => {
  try {
    const { userId } = req;
    const { toolId } = req.body;
    if (!toolId) {
      return res.status(400).json({ error: 'Отсутствует ID инструмента' });
    }
    
    // Получаем информацию об инструменте
    const tool = await db.get(`
      SELECT * FROM tools WHERE id = ?
    `, [toolId]);
    
    if (!tool) {
      return res.status(404).json({ error: 'Инструмент не найден' });
    }
    
    // Проверяем, разблокирован ли уже инструмент
    const alreadyUnlocked = await db.get(`
      SELECT 1 FROM player_tools
      WHERE user_id = ? AND tool_id = ?
    `, [userId, toolId]);
    
    if (alreadyUnlocked) {
      return res.json({ success: true, message: 'Инструмент уже разблокирован' });
    }
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Проверяем уровень
    if (tool.unlock_level > playerProgress.level) {
      return res.status(403).json({ 
        error: 'Недостаточный уровень',
        requiredLevel: tool.unlock_level,
        currentLevel: playerProgress.level
      });
    }
    
    // Получаем количество ресурсов
    const currency = await db.get(`
      SELECT amount FROM player_currencies
      WHERE user_id = ? AND currency_type = ?
    `, [userId, tool.currency_type]);
    
    // Проверяем, достаточно ли ресурсов
    if (!currency || currency.amount < tool.unlock_cost) {
      return res.status(403).json({ 
        error: 'Недостаточно ресурсов',
        required: tool.unlock_cost,
        available: currency ? currency.amount : 0
      });
    }
    
    // Списываем ресурсы
    await db.run(`
      UPDATE player_currencies
      SET amount = amount - ?
      WHERE user_id = ? AND currency_type = ?
    `, [tool.unlock_cost, userId, tool.currency_type]);
    
    // Разблокируем инструмент
    await db.run(`
      INSERT INTO player_tools (user_id, tool_id)
      VALUES (?, ?)
    `, [userId, toolId]);
    
    // Автоматически экипируем новый инструмент
    await db.run(`
      INSERT OR REPLACE INTO player_equipped_tools (user_id, character_id, tool_id)
      VALUES (?, ?, ?)
    `, [userId, tool.character_id, toolId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при улучшении инструмента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вспомогательные функции

// Получение или создание прогресса игрока
async function getOrCreatePlayerProgress(userId) {
  // Проверяем, есть ли запись о прогрессе
  const progress = await db.get(`
    SELECT * FROM player_progress WHERE user_id = ?
  `, [userId]);
  
  if (progress) {
    return progress;
  }
  
  // Создаем запись о прогрессе
  await db.run(`
    INSERT INTO player_progress (user_id, level, experience, energy, max_energy)
    VALUES (?, 1, 0, 100, 100)
  `, [userId]);
  
  // Создаем записи о валютах
  await db.run(`
    INSERT INTO player_currencies (user_id, currency_type, amount)
    VALUES (?, ?, 0)
  `, [userId, CurrencyType.MAIN]);
  
  await db.run(`
    INSERT INTO player_currencies (user_id, currency_type, amount)
    VALUES (?, ?, 0)
  `, [userId, CurrencyType.FOREST]);
  
  // Разблокируем первую локацию
  await db.run(`
    INSERT INTO player_locations (user_id, location_id)
    VALUES (?, 1)
  `, [userId]);
  
  // Разблокируем первый инструмент
  await db.run(`
    INSERT INTO player_tools (user_id, tool_id)
    VALUES (?, 1)
  `, [userId]);
  
  // Экипируем первый инструмент
  await db.run(`
    INSERT INTO player_equipped_tools (user_id, character_id, tool_id)
    VALUES (?, 1, 1)
  `, [userId]);
  
  // Возвращаем созданный прогресс
  return {
    user_id: userId,
    level: 1,
    experience: 0,
    energy: 100,
    max_energy: 100,
    last_energy_refill_time: new Date().toISOString()
  };
}

// Получение или создание валюты игрока
async function getOrCreatePlayerCurrency(userId, currencyType) {
  // Проверяем, есть ли запись о валюте
  const currency = await db.get(`
    SELECT * FROM player_currencies WHERE user_id = ? AND currency_type = ?
  `, [userId, currencyType]);
  
  if (currency) {
    return currency;
  }
  
  // Создаем запись о валюте
  await db.run(`
    INSERT INTO player_currencies (user_id, currency_type, amount)
    VALUES (?, ?, 0)
  `, [userId, currencyType]);
  
  // Возвращаем созданную запись
  return {
    user_id: userId,
    currency_type: currencyType,
    amount: 0
  };
}

// Добавление опыта и проверка повышения уровня
async function addExperience(userId, exp) {
  // Получаем текущий прогресс
  const progress = await db.get(`
    SELECT * FROM player_progress WHERE user_id = ?
  `, [userId]);
  
  // Добавляем опыт
  const newExp = progress.experience + exp;
  
  // Получаем информацию о следующем уровне
  const nextLevel = await db.get(`
    SELECT * FROM levels WHERE level = ?
  `, [progress.level + 1]);
  
  // Проверяем, достаточно ли опыта для повышения уровня
  if (nextLevel && newExp >= nextLevel.required_exp) {
    // Повышаем уровень
    await db.run(`
      UPDATE player_progress
      SET level = level + 1, experience = ?
      WHERE user_id = ?
    `, [newExp - nextLevel.required_exp, userId]);
    
    // Получаем награды за уровень
    const rewards = await db.all(`
      SELECT * FROM rewards WHERE level_id = ?
    `, [progress.level + 1]);
    
    // Обрабатываем награды
    for (const reward of rewards) {
      await processReward(userId, reward);
    }
    
    return {
      levelUp: true,
      level: progress.level + 1,
      rewards
    };
  } else {
    // Просто обновляем опыт
    await db.run(`
      UPDATE player_progress
      SET experience = ?
      WHERE user_id = ?
    `, [newExp, userId]);
    
    return {
      levelUp: false,
      level: progress.level,
      rewards: []
    };
  }
}

// Обработка награды
async function processReward(userId, reward) {
  switch (reward.reward_type) {
    case RewardType.MAIN_CURRENCY:
      // Добавляем основную валюту
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_type = ?
      `, [reward.amount, userId, CurrencyType.MAIN]);
      break;
      
    case RewardType.LOCATION_CURRENCY:
      // Добавляем валюту локации
      const location = await db.get(`
        SELECT * FROM locations WHERE id = ?
      `, [reward.target_id]);
      
      if (location) {
        await db.run(`
          UPDATE player_currencies
          SET amount = amount + ?
          WHERE user_id = ? AND currency_type = ?
        `, [reward.amount, userId, location.currency_type]);
      }
      break;
      
    case RewardType.UNLOCK_TOOL:
      // Разблокируем инструмент
      await db.run(`
        INSERT OR IGNORE INTO player_tools (user_id, tool_id)
        VALUES (?, ?)
      `, [userId, reward.target_id]);
      break;
      
    case RewardType.UNLOCK_LOCATION:
      // Разблокируем локацию
      await db.run(`
        INSERT OR IGNORE INTO player_locations (user_id, location_id)
        VALUES (?, ?)
      `, [userId, reward.target_id]);
      break;
  }
}

// Асинхронно инициализируем базу данных и запускаем сервер
async function startServer() {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
    });
  } catch (error) {
    console.error('Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Запускаем сервер
startServer(); 