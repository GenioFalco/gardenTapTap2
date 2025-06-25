const express = require('express');
const cors = require('cors');
const { db, initDatabase, CurrencyType, RewardType } = require('./db');
const currencyRoutes = require('./routes/currency.routes');

// Инициализируем Express приложение
const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors()); // Разрешаем CORS запросы
app.use(express.json()); // Парсим JSON тело запроса
app.use(express.static('../public')); // Статические файлы

// Middleware для извлечения user_id
app.use((req, res, next) => {
  // Извлекаем user_id из заголовка
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    // Если ID не найден в заголовке, используем тестовый ID
    req.userId = 'test_user';
    console.log('Using test user ID');
  } else {
    // Преобразуем числовые ID (Telegram user IDs) в строки для совместимости с БД
    req.userId = userId.toString();
    
    // Проверим, это числовой ID из Telegram или строка для тестирования
    const isNumericId = /^\d+$/.test(userId);
    
    console.log(`Request from user: ${req.userId}, ID type: ${isNumericId ? 'Telegram numeric ID' : 'String ID'}`);
  }
  
  // Проверяем, существует ли запись пользователя, и создаем, если нет
  ensureUserExists(req.userId).catch(err => {
    console.error(`Error ensuring user exists: ${err.message}`);
  });
  
  next();
});

// Функция для проверки существования пользователя и создания при необходимости
async function ensureUserExists(userId) {
  try {
    // Проверяем, существует ли пользователь в БД
    const user = await db.get('SELECT user_id FROM player_progress WHERE user_id = ?', [userId]);
    
    if (!user) {
      console.log(`Creating new user: ${userId}`);
      
      // Создаем прогресс для нового пользователя с начальными значениями
      await db.run(`
        INSERT INTO player_progress (
          user_id, level, experience, energy, max_energy, last_energy_refill_time
        ) VALUES (?, 1, 0, 10, 10, datetime('now'))
      `, [userId]);
      
      // Добавляем начальные инструменты
      await db.run(`
        INSERT INTO player_tools (user_id, tool_id) VALUES (?, 1)
      `, [userId]);
      
      // Добавляем начальные ресурсы
      await db.run(`
        INSERT INTO player_currencies (user_id, currency_id, amount) 
        VALUES (?, 'main', 0), (?, 'forest', 0)
      `, [userId, userId]);
      
      console.log(`User ${userId} initialized with starting values`);
    }
  } catch (error) {
    console.error(`Error in ensureUserExists: ${error.message}`);
    throw error;
  }
}

// API endpoints

// Маршруты для работы с валютами
app.use('/api/currencies', currencyRoutes);

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

// Получить внешний вид персонажа с инструментом
app.get('/api/characters/:characterId/appearance/:toolId', async (req, res) => {
  try {
    const { characterId, toolId } = req.params;
    
    // Получаем внешний вид персонажа с указанным инструментом из таблицы character_appearances
    const appearance = await db.get(`
      SELECT 
        ca.id, 
        ca.character_id as characterId, 
        ca.tool_id as toolId, 
        ca.image_path as imagePath, 
        ca.animation_type as animationType, 
        ca.animation_path as animationPath
      FROM character_appearances ca
      WHERE ca.character_id = ? AND ca.tool_id = ?
    `, [characterId, toolId]);
    
    if (!appearance) {
      // Если не найден конкретный внешний вид, возвращаем дефолтный для этого персонажа (с любым инструментом)
      const defaultAppearance = await db.get(`
        SELECT 
          ca.id, 
          ca.character_id as characterId, 
          ca.tool_id as toolId, 
          ca.image_path as imagePath, 
          ca.animation_type as animationType, 
          ca.animation_path as animationPath
        FROM character_appearances ca
        WHERE ca.character_id = ? 
        LIMIT 1
      `, [characterId]);
      
      if (!defaultAppearance) {
        // Если в таблице character_appearances нет данных, используем данные из таблицы characters как запасной вариант
        const characterData = await db.get(`
          SELECT 
            id as characterId, 
            null as toolId,
            null as imagePath,
            animation_type as animationType, 
            animation_path as animationPath,
            frame_count as frameCount
          FROM characters 
          WHERE id = ?
        `, [characterId]);
        
        if (!characterData) {
          return res.status(404).json({ error: 'Внешний вид персонажа не найден' });
        }
        
        return res.json(characterData);
      }
      
      return res.json(defaultAppearance);
    }
    
    res.json(appearance);
  } catch (error) {
    console.error('Ошибка при получении внешнего вида персонажа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить инструменты для персонажа
app.get('/api/characters/:id/tools', async (req, res) => {
  try {
    const tools = await db.all(`
      SELECT 
        id, 
        name, 
        character_id as characterId, 
        unlock_level as unlockLevel, 
        unlock_cost as unlockCost, 
        currency_type as currencyType, 
        image_path as imagePath,
        main_coins_power as mainCoinsPower,
        location_coins_power as locationCoinsPower
      FROM tools 
      WHERE character_id = ?
    `, [req.params.id]);
    
    console.log(`API: Получены инструменты для персонажа ${req.params.id}:`, tools);
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
      SELECT * FROM tools WHERE character_id = ?
    `, [characterId]);
    
    // Получаем разблокированные инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    const unlockedToolIds = unlockedTools.map(tool => tool.tool_id);
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Добавляем флаг is_unlocked к инструментам
    const toolsWithUnlockInfo = characterTools.map(tool => {
      return {
        ...tool,
        is_unlocked: unlockedToolIds.includes(tool.id)
      };
    });
    
    res.json(toolsWithUnlockInfo);
  } catch (error) {
    console.error('Ошибка при получении инструментов:', error);
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
    
    // Получаем ТОЛЬКО разблокированные (купленные) инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    // Преобразуем в массив ID инструментов
    const unlockedToolIds = unlockedTools.map(tool => tool.tool_id);
    
    // Получаем экипированные инструменты
    const equippedTools = await db.all(`
      SELECT character_id, tool_id FROM player_equipped_tools WHERE user_id = ?
    `, [userId]);
    
    // Преобразуем в объект для удобства
    const equippedToolsMap = equippedTools.reduce((acc, item) => {
      acc[item.character_id] = item.tool_id;
      return acc;
    }, {});
    
    // Формируем ответ с правильными именами полей для клиента
    const response = {
      id: playerProgress.user_id,
      level: playerProgress.level,
      experience: playerProgress.experience,
      energy: playerProgress.energy,
      maxEnergy: playerProgress.max_energy,
      lastEnergyRefillTime: playerProgress.last_energy_refill_time,
      unlockedLocations: unlockedLocationIds,
      unlockedTools: unlockedToolIds,
      equippedTools: equippedToolsMap,
      currencies: [] // Добавляем пустой массив валют для соответствия интерфейсу
    };
    
    console.log('Sending player progress:', response);
    res.json(response);
  } catch (error) {
    console.error('Ошибка при получении прогресса игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить энергию игрока
app.post('/api/player/update-energy', async (req, res) => {
  try {
    const { userId } = req;
    const { energy } = req.body;
    
    if (energy === undefined) {
      return res.status(400).json({ error: 'Отсутствует параметр energy' });
    }
    
    // Получаем текущий прогресс игрока с максимальной энергией и временем последнего обновления
    const playerProgress = await db.get(`
      SELECT energy, max_energy, last_energy_refill_time FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (!playerProgress) {
      return res.status(404).json({ error: 'Прогресс игрока не найден' });
    }
    
    console.log('Текущий прогресс игрока перед обновлением энергии:', playerProgress);
    
    // Проверяем, прошла ли минута с момента последнего обновления энергии
    const lastRefillTime = new Date(playerProgress.last_energy_refill_time).getTime();
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - lastRefillTime;
    const minutesPassed = Math.floor(timeDifference / (60 * 1000));
    
    console.log(`Время последнего обновления: ${new Date(lastRefillTime).toLocaleTimeString()}`);
    console.log(`Текущее время: ${new Date(currentTime).toLocaleTimeString()}`);
    console.log(`Прошло миллисекунд: ${timeDifference}, минут: ${minutesPassed}`);
    
    // Если запрашивается увеличение энергии, проверяем, прошла ли минута
    if (energy > playerProgress.energy) {
      // Если это восстановление энергии и не прошла минута, возвращаем ошибку
      if (minutesPassed < 1 && timeDifference < 60000) {
        console.log('Попытка восстановить энергию слишком рано, отклонено');
        return res.status(403).json({ 
          error: 'Слишком рано для восстановления энергии',
          timeUntilRefill: 60000 - timeDifference
        });
      }
      
      // Если прошла минута, обновляем время последнего восстановления
      const newRefillTime = new Date().toISOString();
      console.log(`Разрешено обновление энергии, новое время: ${newRefillTime}`);
      
      // Проверяем, что новое значение энергии не превышает максимальное
      const newEnergy = Math.min(energy, playerProgress.max_energy);
      
      // Обновляем энергию и время последнего обновления
      await db.run(`
        UPDATE player_progress
        SET energy = ?, last_energy_refill_time = ?
        WHERE user_id = ?
      `, [newEnergy, newRefillTime, userId]);
      
      console.log(`Энергия обновлена: ${playerProgress.energy} -> ${newEnergy}, максимум: ${playerProgress.max_energy}`);
      
      res.json({ 
        success: true, 
        energy: newEnergy,
        maxEnergy: playerProgress.max_energy,
        lastEnergyRefillTime: newRefillTime
      });
    } else {
      // Если энергия уменьшается (например, при тапе), не проверяем время
      // Проверяем, что новое значение не меньше 0
      const newEnergy = Math.max(0, energy);
      
      // Обновляем только энергию, время последнего восстановления не меняем
      await db.run(`
        UPDATE player_progress
        SET energy = ?
        WHERE user_id = ?
      `, [newEnergy, userId]);
      
      console.log(`Энергия уменьшена: ${playerProgress.energy} -> ${newEnergy}`);
      
      res.json({ 
        success: true, 
        energy: newEnergy,
        maxEnergy: playerProgress.max_energy,
        lastEnergyRefillTime: playerProgress.last_energy_refill_time
      });
    }
  } catch (error) {
    console.error('Ошибка при обновлении энергии игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить количество ресурсов игрока
app.get('/api/player/resources/:currencyType', async (req, res) => {
  try {
    const { userId } = req;
    const { currencyType } = req.params;
    
    // Нормализуем тип валюты к нижнему регистру
    const normalizedType = currencyType.toLowerCase();
    
    // Создаем запись валюты, если её нет
    try {
      await getOrCreatePlayerCurrency(userId, normalizedType);
    } catch (error) {
      console.error(`Ошибка при создании записи валюты ${normalizedType}:`, error);
      // Продолжаем выполнение, чтобы попробовать получить существующую запись
    }
    
    // Получаем ID валюты из таблицы currencies или используем значения по умолчанию
    let currencyId;
    try {
      const currency = await db.get(`
        SELECT id FROM currencies WHERE currency_type = ?
      `, [normalizedType]);
      
      currencyId = currency ? currency.id.toString() : (normalizedType === 'main' ? '5' : '1');
    } catch (error) {
      console.error(`Ошибка при получении ID валюты для типа ${normalizedType}:`, error);
      currencyId = normalizedType === 'main' ? '5' : '1';
    }
    
    // Получаем количество валюты
    const result = await db.get(`
      SELECT amount FROM player_currencies
      WHERE user_id = ? AND currency_id = ?
    `, [userId, currencyId]);
    
    const amount = result ? result.amount : 0;
    res.json({ amount });
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
    
    // Формируем ответ с правильными именами полей для клиента
    const response = {
      level: level.level,
      requiredExp: level.required_exp,
      rewards: rewards.map(reward => ({
        id: reward.id,
        levelId: reward.level_id,
        rewardType: reward.reward_type,
        amount: reward.amount,
        targetId: reward.target_id
      }))
    };
    
    console.log('Sending level info:', response);
    res.json(response);
  } catch (error) {
    console.error('Ошибка при получении информации об уровне:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить информацию о локации по ID
app.get('/api/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    // Получаем информацию о локации
    const location = await db.get(`
      SELECT 
        id, name, background, resource_name as resourceName, 
        character_id as characterId, unlock_level as unlockLevel,
        unlock_cost as unlockCost, currency_type as currencyType
      FROM locations
      WHERE id = ?
    `, [locationId]);
    
    if (!location) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }
    
    res.json(location);
  } catch (error) {
    console.error('Ошибка при получении информации о локации:', error);
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
    const playerProgress = await db.get(`
      SELECT * FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (!playerProgress) {
      return res.status(404).json({ error: 'Прогресс игрока не найден' });
    }
    
    console.log('Текущий прогресс игрока:', playerProgress);
    
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
    
    // Если нет экипированного инструмента, используем базовое значение
    const locationCoinsPower = equipped ? (equipped.location_coins_power || 1) : 1;
    const mainCoinsPower = equipped ? (equipped.main_coins_power || 0.5) : 0.5;
    
    console.log(`Тап с инструментом: ${equipped ? equipped.name : 'базовый'}`);
    console.log(`Сила для валюты локации: ${locationCoinsPower}`);
    console.log(`Сила для основной валюты: ${mainCoinsPower}`);
    
    // Получаем тип валюты локации
    const locationCurrencyType = location.currency_type || 'forest';
    
    // Обновляем валюту локации - получаем или создаем запись и затем обновляем
    const locationCurrency = await getOrCreatePlayerCurrency(userId, locationCurrencyType);
    await db.run(`
      UPDATE player_currencies
      SET amount = amount + ?
      WHERE user_id = ? AND currency_id = ?
    `, [locationCoinsPower, userId, locationCurrency.currency_id]);
    
    console.log(`Добавлено ${locationCoinsPower} валюты ${locationCurrencyType} (ID: ${locationCurrency.currency_id})`);
    
    // Обновляем основную валюту (сад-коины)
    const mainCurrency = await getOrCreatePlayerCurrency(userId, 'main');
    await db.run(`
      UPDATE player_currencies
      SET amount = amount + ?
      WHERE user_id = ? AND currency_id = ?
    `, [mainCoinsPower, userId, mainCurrency.currency_id]);
    
    console.log(`Добавлено ${mainCoinsPower} валюты main (ID: ${mainCurrency.currency_id})`);
    
    // Фиксированный опыт - всегда 1 за тап
    const experienceGained = 1;
    
    // Текущее время для обновления времени последнего изменения энергии
    const currentTime = new Date().toISOString();
    
    // Уменьшаем энергию и обновляем время последнего изменения
    await db.run(`
      UPDATE player_progress
      SET energy = energy - 1, last_energy_refill_time = ?
      WHERE user_id = ?
    `, [currentTime, userId]);
    
    console.log(`Энергия уменьшена на 1, время обновления: ${currentTime}`);
    
    // Обработка опыта и проверка повышения уровня
    const { levelUp, level, rewards } = await addExperience(userId, experienceGained);
    
    // Получаем оставшуюся энергию
    const updatedProgress = await db.get(`
      SELECT energy, max_energy as maxEnergy, last_energy_refill_time as lastEnergyRefillTime 
      FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    console.log('Обновленный прогресс после тапа:', updatedProgress);
    
    res.json({
      resourcesGained: locationCoinsPower,  // Заработано валюты локации
      mainCurrencyGained: mainCoinsPower,  // Заработано сад-коинов
      experienceGained, // Заработано опыта (всегда 1)
      levelUp,
      level,
      rewards,
      energyLeft: updatedProgress.energy,
      maxEnergy: updatedProgress.maxEnergy,
      lastEnergyRefillTime: updatedProgress.lastEnergyRefillTime
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
      WHERE user_id = ? AND (currency_type = ? OR currency_id = ?)
    `, [tool.unlock_cost, userId, tool.currency_type, tool.currency_type]);
    
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

// Получить информацию об инструменте по ID
app.get('/api/tools/:toolId', async (req, res) => {
  try {
    const { toolId } = req.params;
    
    // Получаем информацию об инструменте
    const tool = await db.get(`
      SELECT 
        id, name, character_id as characterId, power,
        unlock_level as unlockLevel, unlock_cost as unlockCost,
        currency_type as currencyType, image_path as imagePath
      FROM tools
      WHERE id = ?
    `, [toolId]);
    
    if (!tool) {
      return res.status(404).json({ error: 'Инструмент не найден' });
    }
    
    res.json(tool);
  } catch (error) {
    console.error('Ошибка при получении информации об инструменте:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение инструментов по уровню разблокировки
app.get('/api/tools/unlock-level/:level', async (req, res) => {
  const level = parseInt(req.params.level);
  
  try {
    const query = 'SELECT * FROM tools WHERE unlock_level = ?';
    const tools = await db.all(query, [level]);
    
    res.json(tools);
  } catch (error) {
    console.error('Ошибка при получении инструментов по уровню:', error);
    res.status(500).json({ error: 'Ошибка при получении инструментов', details: error.message });
  }
});

// Получение локаций по уровню разблокировки
app.get('/api/locations/unlock-level/:level', async (req, res) => {
  const level = parseInt(req.params.level);
  
  try {
    const query = 'SELECT * FROM locations WHERE unlock_level = ?';
    const locations = await db.all(query, [level]);
    
    res.json(locations);
  } catch (error) {
    console.error('Ошибка при получении локаций по уровню:', error);
    res.status(500).json({ error: 'Ошибка при получении локаций', details: error.message });
  }
});

// Получить помощников для локации
app.get('/api/player/locations/:locationId/helpers', async (req, res) => {
  try {
    const { userId } = req;
    const { locationId } = req.params;
    
    // Получаем помощников для локации
    const locationHelpers = await db.all(`
      SELECT * FROM helpers WHERE location_id = ?
    `, [locationId]);
    
    // Получаем купленных помощников
    const unlockedHelpers = await db.all(`
      SELECT helper_id FROM player_helpers WHERE user_id = ?
    `, [userId]);
    
    const unlockedHelperIds = unlockedHelpers.map(helper => helper.helper_id);
    
    // Получаем активных помощников
    const activeHelpers = await db.all(`
      SELECT helper_id, location_id, activated_time FROM player_active_helpers WHERE user_id = ?
    `, [userId]);
    
    const activeHelperIds = activeHelpers.map(helper => helper.helper_id);
    const activeLocationIds = activeHelpers.map(helper => helper.location_id);
    
    // Узнаем, есть ли активные помощники на других локациях
    const hasActiveHelperInOtherLocation = activeHelpers.some(helper => 
      helper.location_id != locationId
    );
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Добавляем флаги к помощникам
    const helpersWithInfo = locationHelpers.map(helper => {
      // Находим запись активного помощника, если есть
      const activeHelper = activeHelpers.find(ah => ah.helper_id === helper.id);
      
      return {
        ...helper,
        is_unlocked: unlockedHelperIds.includes(helper.id),
        is_active: activeHelperIds.includes(helper.id),
        can_activate: !hasActiveHelperInOtherLocation || activeLocationIds.includes(parseInt(locationId)),
        activated_time: activeHelper ? activeHelper.activated_time : null
      };
    });
    
    res.json(helpersWithInfo);
  } catch (error) {
    console.error('Ошибка при получении помощников:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Купить помощника
app.post('/api/player/helpers/:helperId/buy', async (req, res) => {
  try {
    const { userId } = req;
    const { helperId } = req.params;
    
    // Получаем информацию о помощнике
    const helper = await db.get(`
      SELECT * FROM helpers WHERE id = ?
    `, [helperId]);
    
    if (!helper) {
      return res.status(404).json({ error: 'Помощник не найден' });
    }
    
    // Получаем уровень игрока и проверяем, достаточен ли он
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    if (playerProgress.level < helper.unlock_level) {
      return res.status(400).json({ error: 'Недостаточный уровень' });
    }
    
    // Проверяем, не куплен ли уже помощник
    const isAlreadyUnlocked = await db.get(`
      SELECT * FROM player_helpers WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    if (isAlreadyUnlocked) {
      return res.status(400).json({ error: 'Помощник уже куплен' });
    }
    
    // Проверяем наличие ресурсов
    const playerCurrency = await db.get(`
      SELECT amount FROM player_currencies WHERE user_id = ? AND currency_type = ?
    `, [userId, helper.currency_type]);
    
    if (!playerCurrency || playerCurrency.amount < helper.unlock_cost) {
      return res.status(400).json({ error: 'Недостаточно ресурсов' });
    }
    
    // Списываем ресурсы
    await db.run(`
      UPDATE player_currencies
      SET amount = amount - ?
      WHERE user_id = ? AND currency_type = ?
    `, [helper.unlock_cost, userId, helper.currency_type]);
    
    // Добавляем помощника в таблицу купленных
    await db.run(`
      INSERT INTO player_helpers (user_id, helper_id)
      VALUES (?, ?)
    `, [userId, helperId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при покупке помощника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Активировать/деактивировать помощника
app.post('/api/player/helpers/:helperId/toggle', async (req, res) => {
  try {
    const { userId } = req;
    const { helperId } = req.params;
    
    // Получаем информацию о помощнике
    const helper = await db.get(`
      SELECT * FROM helpers WHERE id = ?
    `, [helperId]);
    
    if (!helper) {
      return res.status(404).json({ error: 'Помощник не найден' });
    }
    
    // Проверяем, куплен ли помощник
    const isUnlocked = await db.get(`
      SELECT * FROM player_helpers WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    if (!isUnlocked) {
      return res.status(400).json({ error: 'Помощник не приобретен' });
    }
    
    // Проверяем, активен ли уже помощник
    const isActive = await db.get(`
      SELECT * FROM player_active_helpers WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    if (isActive) {
      // Деактивируем помощника
      await db.run(`
        DELETE FROM player_active_helpers
        WHERE user_id = ? AND helper_id = ?
      `, [userId, helperId]);
      
      return res.json({ success: true, active: false });
    } else {
      // Проверяем наличие активных помощников на других локациях
      const activeHelperInOtherLocation = await db.get(`
        SELECT * FROM player_active_helpers
        WHERE user_id = ? AND location_id != ?
      `, [userId, helper.location_id]);
      
      if (activeHelperInOtherLocation) {
        return res.status(400).json({ 
          error: 'У вас уже активен помощник на другой локации',
          activeHelperId: activeHelperInOtherLocation.helper_id,
          activeLocationId: activeHelperInOtherLocation.location_id
        });
      }
      
      // Активируем помощника
      const now = new Date();
      console.log(`Активация помощника ${helperId}, время: ${now.toISOString()}`);
      
      await db.run(`
        INSERT INTO player_active_helpers (user_id, helper_id, location_id, activated_time)
        VALUES (?, ?, ?, ?)
      `, [userId, helperId, helper.location_id, now.toISOString()]);
      
      return res.json({ success: true, active: true });
    }
  } catch (error) {
    console.error('Ошибка при активации помощника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Собрать награду от помощников
app.post('/api/player/helpers/collect', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем всех активных помощников пользователя
    const activeHelpers = await db.all(`
      SELECT h.*, pah.activated_time, pah.location_id
      FROM player_active_helpers pah
      JOIN helpers h ON pah.helper_id = h.id
      WHERE pah.user_id = ?
    `, [userId]);
    
    if (activeHelpers.length === 0) {
      return res.json({ collected: 0, locationId: null });
    }
    
    // Для каждого помощника рассчитываем полученную валюту
    let totalCollected = 0;
    let locationId = null;
    let currencyType = null;
    
    for (const helper of activeHelpers) {
      // Расчет времени, прошедшего с момента активации
      const activationTime = new Date(helper.activated_time);
      const currentTime = new Date();
      const timeDiffMs = currentTime.getTime() - activationTime.getTime();
      const hoursDiff = timeDiffMs / (1000 * 60 * 60);
      
      console.log(`Помощник ${helper.id}: активирован ${helper.activated_time}, прошло ${hoursDiff.toFixed(2)} часов`);
      
      // Количество собранных ресурсов (округленное до целого числа)
      // Ограничиваем максимальное время накопления 4 часами
      const cappedHoursDiff = Math.min(hoursDiff, 4);
      const collected = Math.round(helper.income_per_hour * cappedHoursDiff);
      console.log(`Помощник ${helper.id}: доход ${helper.income_per_hour} в час, собрано ${collected} за ${cappedHoursDiff.toFixed(2)} часов (реальное время: ${hoursDiff.toFixed(2)} часов)`);
      totalCollected += collected;
      
      locationId = helper.location_id;
      currencyType = helper.currency_type;
      
      // Обновляем время активации помощника на текущее
      const newActivationTime = new Date().toISOString();
      console.log(`Обновление времени активации помощника ${helper.id} на ${newActivationTime}`);
      
      await db.run(`
        UPDATE player_active_helpers
        SET activated_time = ?
        WHERE user_id = ? AND helper_id = ?
      `, [newActivationTime, userId, helper.id]);
    }
    
    // Если есть, что начислять, добавляем валюту игроку
    if (totalCollected > 0) {
      // Проверяем, есть ли уже такая валюта у игрока
      const existingCurrency = await db.get(`
        SELECT * FROM player_currencies
        WHERE user_id = ? AND currency_type = ?
      `, [userId, currencyType]);
      
      if (existingCurrency) {
        // Обновляем существующую валюту
        await db.run(`
          UPDATE player_currencies
          SET amount = amount + ?
          WHERE user_id = ? AND currency_type = ?
        `, [totalCollected, userId, currencyType]);
      } else {
        // Создаем новую запись о валюте
        await db.run(`
          INSERT INTO player_currencies (user_id, currency_type, amount)
          VALUES (?, ?, ?)
        `, [userId, currencyType, totalCollected]);
      }
    }
    
    res.json({ collected: totalCollected, locationId, currencyType });
  } catch (error) {
    console.error('Ошибка при сборе награды от помощников:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить активных помощников с временем активации
app.get('/api/player/helpers/active', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем всех активных помощников пользователя с временем активации
    const activeHelpers = await db.all(`
      SELECT h.*, pah.activated_time, pah.location_id
      FROM player_active_helpers pah
      JOIN helpers h ON pah.helper_id = h.id
      WHERE pah.user_id = ?
    `, [userId]);
    
    res.json(activeHelpers);
  } catch (error) {
    console.error('Ошибка при получении активных помощников:', error);
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
  
  // Создаем запись основной валюты (сад-коины)
  await getOrCreatePlayerCurrency(userId, 'main');
  
  // Создаем запись валюты леса
  await getOrCreatePlayerCurrency(userId, 'forest');
  
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
  
  // Получаем созданный прогресс
  return await db.get(`
    SELECT * FROM player_progress WHERE user_id = ?
  `, [userId]);
}

// Получение или создание валюты игрока
async function getOrCreatePlayerCurrency(userId, currencyType) {
  // Нормализуем тип валюты к нижнему регистру
  const normalizedType = currencyType.toLowerCase();
  
  try {
    // Получаем ID валюты из таблицы currencies
    const currency = await db.get(`
      SELECT id, currency_type FROM currencies 
      WHERE currency_type = ?
    `, [normalizedType]);
    
    // Если валюта найдена, используем её ID
    let currencyId = null;
    if (currency) {
      currencyId = currency.id.toString();
    } else {
      // По умолчанию используем фиксированные ID
      currencyId = normalizedType === 'main' ? '5' : '1';
    }
    
    // Проверяем, есть ли запись о валюте у игрока
    const playerCurrency = await db.get(`
      SELECT * FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, currencyId]);
    
    if (playerCurrency) {
      return playerCurrency;
    }
    
    // Если записи нет, создаем новую
    console.log(`Создаем новую запись валюты ${normalizedType} (ID: ${currencyId}) для пользователя ${userId}`);
    
    await db.run(`
      INSERT INTO player_currencies (user_id, currency_id, currency_type, amount)
      VALUES (?, ?, ?, 0)
    `, [userId, currencyId, normalizedType]);
    
    return {
      user_id: userId,
      currency_id: currencyId,
      currency_type: normalizedType,
      amount: 0
    };
  } catch (error) {
    console.error(`Ошибка при получении/создании валюты ${normalizedType} для пользователя ${userId}:`, error);
    throw error;
  }
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
  console.log(`Обрабатываем награду:`, reward);
  
  switch (reward.reward_type) {
    case RewardType.MAIN_CURRENCY:
      // Добавляем валюту, указанную в currency_id или основную валюту
      const currencyTypeMain = reward.currency_id || 'main';
      const currencyMain = await getOrCreatePlayerCurrency(userId, currencyTypeMain);
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [reward.amount, userId, currencyMain.currency_id]);
      console.log(`Награда: добавлено ${reward.amount} валюты ${currencyTypeMain} (ID: ${currencyMain.currency_id})`);
      break;
      
    case RewardType.LOCATION_CURRENCY:
      // Обрабатываем специфическую валюту локации, если указан currency_id
      if (reward.currency_id) {
        const specificCurrency = await getOrCreatePlayerCurrency(userId, reward.currency_id);
        await db.run(`
          UPDATE player_currencies
          SET amount = amount + ?
          WHERE user_id = ? AND currency_id = ?
        `, [reward.amount, userId, specificCurrency.currency_id]);
        console.log(`Награда: добавлено ${reward.amount} валюты ${reward.currency_id} (ID: ${specificCurrency.currency_id})`);
      } 
      // Если указан target_id, получаем тип валюты из локации
      else if (reward.target_id) {
        const location = await db.get(`
          SELECT * FROM locations WHERE id = ?
        `, [reward.target_id]);
        
        if (location) {
          const locationCurrencyType = location.currency_type || 'forest';
          const locationCurrency = await getOrCreatePlayerCurrency(userId, locationCurrencyType);
          await db.run(`
            UPDATE player_currencies
            SET amount = amount + ?
            WHERE user_id = ? AND currency_id = ?
          `, [reward.amount, userId, locationCurrency.currency_id]);
          console.log(`Награда: добавлено ${reward.amount} валюты ${locationCurrencyType} (ID: ${locationCurrency.currency_id})`);
        }
      }
      // По умолчанию используем forest
      else {
        const defaultCurrency = await getOrCreatePlayerCurrency(userId, 'forest');
        await db.run(`
          UPDATE player_currencies
          SET amount = amount + ?
          WHERE user_id = ? AND currency_id = ?
        `, [reward.amount, userId, defaultCurrency.currency_id]);
        console.log(`Награда: добавлено ${reward.amount} валюты forest (ID: ${defaultCurrency.currency_id})`);
      }
      break;
      
    // Динамическая обработка специальных типов валют
    case 'forest_currency':
    case 'garden_currency':
    case 'winter_currency':
    case 'mountain_currency':
    case 'desert_currency':
    case 'lake_currency':
      // Извлекаем тип валюты из reward_type (например, forest_currency -> forest)
      const specialCurrencyType = reward.reward_type.split('_')[0];
      const specialCurrency = await getOrCreatePlayerCurrency(userId, specialCurrencyType);
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [reward.amount, userId, specialCurrency.currency_id]);
      console.log(`Награда: добавлено ${reward.amount} валюты ${specialCurrencyType} (ID: ${specialCurrency.currency_id})`);
      break;
      
    // Универсальная обработка валют по currency_id
    case 'currency':
      if (reward.currency_id) {
        const currencyFromId = await getOrCreatePlayerCurrency(userId, reward.currency_id);
        await db.run(`
          UPDATE player_currencies
          SET amount = amount + ?
          WHERE user_id = ? AND currency_id = ?
        `, [reward.amount, userId, currencyFromId.currency_id]);
        console.log(`Награда (currency): добавлено ${reward.amount} валюты ${reward.currency_id} (ID: ${currencyFromId.currency_id})`);
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
      
    case RewardType.ENERGY:
      // Увеличиваем максимальную энергию, если указана награда этого типа
      if (reward.amount > 0) {
        await db.run(`
          UPDATE player_progress
          SET max_energy = max_energy + ?
          WHERE user_id = ?
        `, [reward.amount, userId]);
        console.log(`Награда: увеличение максимальной энергии на ${reward.amount}`);
      }
      break;
      
    default:
      console.warn(`Неизвестный тип награды: ${reward.reward_type}`);
      break;
  }
}

// Функция для получения правильного идентификатора валюты
async function getCurrencyIdByType(currencyType) {
  // Нормализуем тип валюты к нижнему регистру
  const normalizedType = currencyType.toLowerCase();
  
  try {
    // Ищем валюту по типу (нужно только для логов)
    const currency = await db.get(`
      SELECT id, currency_type FROM currencies 
      WHERE currency_type = ?
    `, [normalizedType]);
    
    if (currency) {
      console.log(`Найдена валюта с типом ${normalizedType}, ID: ${currency.id}`);
      return {
        type: normalizedType
      };
    }
    
    // Если не нашли, возвращаем тип по умолчанию
    console.warn(`Валюта с типом ${normalizedType} не найдена, используем значение по умолчанию`);
    
    // По умолчанию: main или forest
    if (normalizedType === 'main' || normalizedType === 'forest') {
      return { type: normalizedType };
    }
    
    // Для других типов возвращаем forest
    return { type: 'forest' };
  } catch (error) {
    console.error(`Ошибка при получении типа валюты для типа ${normalizedType}:`, error);
    // По умолчанию возвращаем forest
    return { type: 'forest' };
  }
}

// Асинхронно инициализируем базу данных и запускаем сервер
async function startServer() {
  try {
    await initDatabase();
    
    // Отключаем очистку дубликатов, которая вызывает ошибки
    // await cleanupPlayerCurrencies();
    
    app.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
    });
  } catch (error) {
    console.error('Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Функция для очистки дубликатов в таблице player_currencies
async function cleanupPlayerCurrencies() {
  console.log('Начинаем очистку дубликатов в таблице player_currencies...');
  
  try {
    // 1. Получаем все записи
    const allCurrencies = await db.all('SELECT * FROM player_currencies');
    console.log('Текущие записи в таблице player_currencies:', allCurrencies);
    
    // Создаем карту для объединения дубликатов
    const currencyMap = new Map();
    
    // Объединяем записи с одинаковым user_id и currency_type
    allCurrencies.forEach(currency => {
      const key = `${currency.user_id}_${currency.currency_type}`;
      if (currencyMap.has(key)) {
        // Берем запись с большим количеством
        const existingAmount = currencyMap.get(key).amount;
        if (currency.amount > existingAmount) {
          currencyMap.set(key, currency);
        }
      } else {
        currencyMap.set(key, currency);
      }
    });
    
    // 2. Удаляем все записи из таблицы
    await db.run('DELETE FROM player_currencies');
    console.log('Все записи удалены из таблицы player_currencies');
    
    // 3. Вставляем обратно уникальные записи
    for (const currency of currencyMap.values()) {
      await db.run(`
        INSERT INTO player_currencies (user_id, currency_type, amount)
        VALUES (?, ?, ?)
      `, [currency.user_id, currency.currency_type, currency.amount]);
    }
    
    // 4. Убеждаемся, что у каждого пользователя есть записи для основных валют
    const users = [...new Set(allCurrencies.map(c => c.user_id))];
    
    for (const userId of users) {
      // Создаем основную валюту, если её нет
      await getOrCreatePlayerCurrency(userId, 'main');
      
      // Создаем валюту леса, если её нет
      await getOrCreatePlayerCurrency(userId, 'forest');
    }
    
    // 5. Проверяем результат
    const newCurrencies = await db.all('SELECT * FROM player_currencies');
    console.log('Новые записи в таблице player_currencies после очистки:', newCurrencies);
    
    console.log('Очистка дубликатов в таблице player_currencies завершена успешно');
  } catch (error) {
    console.error('Ошибка при очистке дубликатов:', error);
  }
}

// Запускаем сервер
startServer();