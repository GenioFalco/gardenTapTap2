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
      
      // Создаем запись в player_profile
      await db.run(`
        INSERT INTO player_profile (user_id, current_rank_id, highest_rank_id, total_points)
        VALUES (?, 1, 1, 0)
      `, [userId]);
      
      console.log(`User ${userId} initialized with starting values`);
    }
    
    // Обновляем историю входов
    await updateLoginHistory(userId);
    
    // Проверяем и выдаем достижения
    await checkAndGrantAchievements(userId);
    
    // Обновляем профиль с последним достижением
    await updateProfileWithLatestAchievement(userId);
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
    const { userId } = req;
    const characterId = req.params.id;
    
    console.log(`Получение инструментов для персонажа ${characterId} пользователя ${userId}`);
    
    // Получаем инструменты персонажа
    const characterTools = await db.all(`
      SELECT 
        t.id, 
        t.name, 
        t.character_id, 
        t.power,
        t.unlock_level, 
        t.unlock_cost, 
        t.currency_id,
        t.image_path,
        t.main_coins_power,
        t.location_coins_power,
        c.code as currency_type
      FROM tools t
      LEFT JOIN currencies c ON t.currency_id = c.id
      WHERE t.character_id = ?
    `, [characterId]);
    
    // Получаем разблокированные инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    const unlockedToolIds = unlockedTools.map(tool => tool.tool_id);
    console.log(`Разблокированные инструменты: ${JSON.stringify(unlockedToolIds)}`);
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Получаем текущий экипированный инструмент
    const equippedTool = await db.get(`
      SELECT tool_id FROM player_equipped_tools 
      WHERE user_id = ? AND character_id = ?
    `, [userId, characterId]);
    
    const equippedToolId = equippedTool ? equippedTool.tool_id : null;
    console.log(`Экипированный инструмент: ${equippedToolId}`);
    
    // Получаем информацию о валютах игрока
    const playerCurrencies = await db.all(`
      SELECT currency_id, amount FROM player_currencies WHERE user_id = ?
    `, [userId]);
    
    const currencyMap = {};
    playerCurrencies.forEach(currency => {
      currencyMap[currency.currency_id] = parseFloat(currency.amount);
    });
    
    console.log(`Валюты игрока: ${JSON.stringify(currencyMap)}`);
    
    // Добавляем информацию о разблокировке и экипировке к инструментам
    const toolsWithInfo = characterTools.map(tool => {
      const isUnlocked = unlockedToolIds.includes(tool.id);
      const isEquipped = equippedToolId === tool.id;
      const canEquip = isUnlocked && !isEquipped;
      const hasEnoughResources = currencyMap[tool.currency_id] >= parseFloat(tool.unlock_cost);
      const canUnlock = !isUnlocked && playerProgress.level >= tool.unlock_level && hasEnoughResources;
      
      return {
        id: tool.id,
        name: tool.name,
        characterId: tool.character_id,
        power: tool.power,
        unlockLevel: tool.unlock_level,
        unlockCost: tool.unlock_cost,
        currencyId: tool.currency_id,
        currencyType: tool.currency_type,
        imagePath: tool.image_path,
        mainCoinsPower: tool.main_coins_power,
        locationCoinsPower: tool.location_coins_power,
        is_unlocked: isUnlocked,
        is_equipped: isEquipped,
        can_equip: canEquip,
        can_unlock: canUnlock
      };
    });
    
    console.log(`Отправка инструментов с информацией: ${JSON.stringify(toolsWithInfo)}`);
    res.json(toolsWithInfo);
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
      SELECT 
        t.*, 
        c.code as currency_type 
      FROM tools t
      LEFT JOIN currencies c ON t.currency_id = c.id
      WHERE t.id = ?
    `, [equipped.tool_id]);
    
    if (!tool) {
      return res.status(404).json({ error: 'Инструмент не найден' });
    }
    
    // Преобразуем имена полей для клиента
    const formattedTool = {
      id: tool.id,
      name: tool.name,
      characterId: tool.character_id,
      power: tool.power,
      unlockLevel: tool.unlock_level,
      unlockCost: tool.unlock_cost,
      currencyId: tool.currency_id,
      currencyType: tool.currency_type, // Добавляем тип валюты для совместимости
      imagePath: tool.image_path,
      main_coins_power: tool.main_coins_power,
      location_coins_power: tool.location_coins_power
    };
    
    res.json(formattedTool);
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
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Проверяем, разблокирован ли инструмент или доступен по уровню
    const unlocked = await db.get(`
      SELECT 1 FROM player_tools 
      WHERE user_id = ? AND tool_id = ?
    `, [userId, toolId]);
    
    // Инструмент можно экипировать, если он разблокирован или если уровень игрока достаточен
    const canEquip = unlocked || (tool.unlock_level <= playerProgress.level);
    
    if (!canEquip) {
      return res.status(403).json({ 
        error: 'Инструмент недоступен',
        message: `Требуется уровень ${tool.unlock_level} или разблокировка инструмента`
      });
    }
    
    // Если инструмент не разблокирован, но доступен по уровню, разблокируем его автоматически
    if (!unlocked && tool.unlock_level <= playerProgress.level) {
      await db.run(`
        INSERT INTO player_tools (user_id, tool_id)
        VALUES (?, ?)
      `, [userId, toolId]);
      console.log(`Автоматически разблокирован инструмент ${toolId} для пользователя ${userId}`);
    }
    
    // Обновляем или добавляем экипированный инструмент
    await db.run(`
      INSERT OR REPLACE INTO player_equipped_tools (user_id, character_id, tool_id)
      VALUES (?, ?, ?)
    `, [userId, characterId, toolId]);
    
    // Возвращаем подробную информацию об экипированном инструменте
    const equippedToolInfo = {
      id: tool.id,
      name: tool.name,
      characterId: tool.character_id,
      power: tool.power,
      mainCoinsPower: parseFloat(tool.main_coins_power) || 0.5,
      locationCoinsPower: parseFloat(tool.location_coins_power) || 1,
      is_equipped: true
    };
    
    res.json({ 
      success: true, 
      message: 'Инструмент успешно экипирован',
      tool: equippedToolInfo
    });
  } catch (error) {
    console.error('Ошибка при экипировке инструмента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить прогресс игрока
app.get('/api/player/progress', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем прогресс игрока
    console.log(`Получение прогресса для пользователя ${userId}`);
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    if (!playerProgress) {
      return res.status(404).json({ error: 'Прогресс игрока не найден' });
    }
    
    console.log(`Найден прогресс для пользователя ${userId}`);
    
    // Получаем разблокированные локации
    const unlockedLocations = await db.all(`
      SELECT location_id FROM player_locations WHERE user_id = ?
    `, [userId]);
    
    // Получаем разблокированные инструменты
    const unlockedTools = await db.all(`
      SELECT tool_id FROM player_tools WHERE user_id = ?
    `, [userId]);
    
    // Получаем экипированные инструменты
    const equippedTools = await db.all(`
      SELECT character_id, tool_id FROM player_equipped_tools WHERE user_id = ?
    `, [userId]);
    
    // Формируем объект с экипированными инструментами по персонажам
    const equippedToolsMap = {};
    equippedTools.forEach(item => {
      equippedToolsMap[item.character_id] = item.tool_id;
    });
    
    // Формируем ответ
    const response = {
      id: playerProgress.user_id,
      level: playerProgress.level,
      experience: playerProgress.experience,
      energy: playerProgress.energy,
      maxEnergy: playerProgress.max_energy,
      lastEnergyRefillTime: playerProgress.last_energy_refill_time,
      unlockedLocations: unlockedLocations.map(item => item.location_id),
      unlockedTools: unlockedTools.map(item => item.tool_id),
      equippedTools: equippedToolsMap,
      currencies: []
    };
    
    console.log('Sending player progress:', response);
    
    // Сначала рассчитываем и начисляем доход от помощников
    // Обновляем время последнего входа при получении прогресса
    try {
      await calculateHelperIncome(userId, true);
    } catch (error) {
      console.error('Ошибка при расчете дохода от помощников:', error);
      // Продолжаем выполнение, не прерывая загрузку прогресса
    }
    
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
    let { currencyType } = req.params;
    
    console.log(`Получение ресурсов для пользователя ${userId}, тип валюты: ${currencyType}`);
    
    // Определяем, является ли currencyType числом (ID) или строкой (код)
    let currencyId;
    
    if (!isNaN(currencyType)) {
      // Если это число, используем его как ID
      currencyId = parseInt(currencyType);
      console.log(`Использование числового ID валюты: ${currencyId}`);
    } else {
      // Иначе ищем ID по коду валюты
      const currency = await db.get(`
        SELECT id FROM currencies WHERE code = ? COLLATE NOCASE
      `, [currencyType]);
      
      if (!currency) {
        console.log(`Валюта с кодом ${currencyType} не найдена`);
        return res.status(404).json({ error: 'Валюта не найдена' });
      }
      
      currencyId = currency.id;
      console.log(`Найден ID валюты по коду: ${currencyId}`);
    }
    
    // Получаем или создаем запись о валюте игрока
    await getOrCreatePlayerCurrency(userId, currencyId);
    
    // Получаем текущее количество ресурсов
    const result = await db.get(`
      SELECT amount FROM player_currencies
      WHERE user_id = ? AND currency_id = ?
    `, [userId, currencyId]);
    
    const amount = result ? parseFloat(result.amount) : 0;
    console.log(`Количество ресурсов: ${amount}`);
    
    res.json({ amount });
  } catch (error) {
    console.error('Ошибка при получении ресурсов игрока:', error);
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
        unlock_cost as unlockCost, currency_id as currencyId
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
      return res.status(400).json({ error: 'Отсутствует параметр locationId' });
    }
    
    // Получаем прогресс игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Проверяем, достаточно ли энергии
    if (playerProgress.energy <= 0) {
      return res.status(403).json({ error: 'Недостаточно энергии' });
    }
    
    // Получаем информацию о локации
    const location = await db.get('SELECT * FROM locations WHERE id = ?', [locationId]);
    if (!location) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }
    
    // Получаем экипированный инструмент
    const equippedTool = await db.get(`
      SELECT t.* FROM tools t
      JOIN player_equipped_tools pet ON t.id = pet.tool_id
      WHERE pet.user_id = ? AND pet.character_id = ?
    `, [userId, location.character_id]);
    
    // Если инструмент не экипирован, используем базовые значения
    const toolPower = equippedTool ? equippedTool.power : 1;
    const mainCoinsPower = equippedTool ? equippedTool.main_coins_power : 0.5;
    const locationCoinsPower = equippedTool ? equippedTool.location_coins_power : 1;
    
    // Рассчитываем полученные ресурсы
    const resourcesGained = Math.round(toolPower * locationCoinsPower);
    const mainCurrencyGained = Math.round(toolPower * mainCoinsPower);
    
    // Добавляем ресурсы локации
    await db.run(`
      INSERT OR REPLACE INTO player_currencies (user_id, currency_id, amount)
      VALUES (?, ?, COALESCE((SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?), 0) + ?)
    `, [userId, location.currency_id, userId, location.currency_id, resourcesGained]);
    
    // Добавляем основную валюту
    await db.run(`
      INSERT OR REPLACE INTO player_currencies (user_id, currency_id, amount)
      VALUES (?, ?, COALESCE((SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?), 0) + ?)
    `, [userId, 1, userId, 1, mainCurrencyGained]); // Предполагаем, что ID основной валюты = 1
    
    // Уменьшаем энергию
    const newEnergy = Math.max(0, playerProgress.energy - 1);
    await db.run('UPDATE player_progress SET energy = ? WHERE user_id = ?', [newEnergy, userId]);
    
    // Добавляем опыт (1-3 единицы за тап)
    const expGained = Math.floor(Math.random() * 3) + 1;
    const levelResult = await addExperience(userId, expGained);
    
    // Обновляем статистику тапов
    await updateTapStats(userId, resourcesGained, 1);
    
    // Отправляем результат
    res.json({
      resourcesGained,
      mainCurrencyGained,
      experienceGained: expGained,
      levelUp: levelResult.levelUp,
      level: levelResult.level,
      rewards: levelResult.rewards,
      energyLeft: newEnergy
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
    
    console.log(`Попытка улучшения инструмента: userId=${userId}, toolId=${toolId}`);
    
    if (!toolId) {
      return res.status(400).json({ error: 'Отсутствует ID инструмента' });
    }
    
    // Получаем информацию об инструменте
    const tool = await db.get(`
      SELECT 
        id, name, character_id as characterId, power,
        unlock_level as unlockLevel, unlock_cost as unlockCost,
        currency_id as currencyId, image_path as imagePath
      FROM tools
      WHERE id = ?
    `, [toolId]);
    
    if (!tool) {
      console.log(`Инструмент с ID ${toolId} не найден`);
      return res.status(404).json({ error: 'Инструмент не найден' });
    }
    
    console.log(`Информация об инструменте: ${JSON.stringify(tool)}`);
    
    // Проверяем, разблокирован ли уже инструмент
    const alreadyUnlocked = await db.get(`
      SELECT 1 FROM player_tools
      WHERE user_id = ? AND tool_id = ?
    `, [userId, toolId]);
    
    if (alreadyUnlocked) {
      console.log(`Инструмент ${toolId} уже разблокирован для пользователя ${userId}`);
      return res.json({ success: true, message: 'Инструмент уже разблокирован' });
    }
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Проверяем уровень
    if (tool.unlockLevel > playerProgress.level) {
      console.log(`Недостаточный уровень: требуется ${tool.unlockLevel}, текущий ${playerProgress.level}`);
      return res.status(403).json({ 
        error: 'Недостаточный уровень',
        requiredLevel: tool.unlockLevel,
        currentLevel: playerProgress.level
      });
    }
    
    // Получаем количество ресурсов
    const currency = await db.get(`
      SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?
    `, [userId, tool.currencyId]);
    
    console.log(`Проверка ресурсов: требуется ${tool.unlockCost}, доступно ${currency ? currency.amount : 0}`);
    
    // Проверяем, достаточно ли ресурсов
    if (!currency || parseFloat(currency.amount) < parseFloat(tool.unlockCost)) {
      console.log(`Недостаточно ресурсов: требуется ${tool.unlockCost}, доступно ${currency ? currency.amount : 0}`);
      return res.status(403).json({ 
        error: 'Недостаточно ресурсов',
        required: tool.unlockCost,
        available: currency ? currency.amount : 0
      });
    }
    
    // Списываем ресурсы
    const unlockCost = parseFloat(tool.unlockCost);
    await db.run(`
      UPDATE player_currencies
      SET amount = amount - ?
      WHERE user_id = ? AND currency_id = ?
    `, [unlockCost, userId, tool.currencyId]);
    
    console.log(`Списано ${unlockCost} ресурсов с типом ${tool.currencyId}`);
    
    // Разблокируем инструмент
    await db.run(`
      INSERT INTO player_tools (user_id, tool_id)
      VALUES (?, ?)
    `, [userId, toolId]);
    
    console.log(`Инструмент ${toolId} разблокирован для пользователя ${userId}`);
    
    // Автоматически экипируем новый инструмент
    await db.run(`
      INSERT OR REPLACE INTO player_equipped_tools (user_id, character_id, tool_id)
      VALUES (?, ?, ?)
    `, [userId, tool.characterId, toolId]);
    
    console.log(`Инструмент ${toolId} экипирован для персонажа ${tool.characterId}`);
    
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
        t.id, 
        t.name, 
        t.character_id as characterId, 
        t.power,
        t.unlock_level as unlockLevel, 
        t.unlock_cost as unlockCost,
        t.currency_id as currencyId, 
        t.image_path as imagePath,
        c.code as currencyType
      FROM tools t
      LEFT JOIN currencies c ON t.currency_id = c.id
      WHERE t.id = ?
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

// Получить помощников для локации (без привязки к игроку)
app.get('/api/helpers/location/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { userId } = req;
    
    console.log(`Получение всех помощников для локации ${locationId}`);
    
    // Получаем помощников для локации
    const locationHelpers = await db.all(`
      SELECT 
        h.*,
        c.code as currency_type
      FROM helpers h
      JOIN currencies c ON h.currency_id = c.id
      WHERE h.location_id = ?
    `, [locationId]);
    
    // Получаем купленных помощников
    const unlockedHelpers = await db.all(`
      SELECT helper_id, level FROM player_helpers WHERE user_id = ?
    `, [userId]);
    
    // Создаем карту разблокированных помощников и их уровней
    const unlockedHelperMap = {};
    unlockedHelpers.forEach(h => {
      unlockedHelperMap[h.helper_id] = h.level || 1;
    });
    
    console.log(`Разблокированные помощники: ${JSON.stringify(unlockedHelperMap)}`);
    
    // Получаем уровень игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    console.log(`Уровень игрока: ${playerProgress.level}`);
    
    // Получаем информацию о валютах игрока
    const playerCurrencies = await db.all(`
      SELECT currency_id, amount FROM player_currencies WHERE user_id = ?
    `, [userId]);
    
    const currencyMap = {};
    playerCurrencies.forEach(currency => {
      currencyMap[currency.currency_id] = parseFloat(currency.amount);
    });
    
    // Форматируем помощников для клиента
    const formattedHelpers = await Promise.all(locationHelpers.map(async (helper) => {
      // Проверяем, разблокирован ли помощник
      const isUnlocked = helper.id in unlockedHelperMap;
      
      // Уровень помощника (0 если не разблокирован)
      const level = isUnlocked ? unlockedHelperMap[helper.id] : 0;
      
      // Проверяем, достаточно ли у игрока ресурсов для покупки
      const hasEnoughResources = currencyMap[helper.currency_id] >= helper.unlock_cost;
      
      // Проверяем, достаточно ли у игрока уровня для покупки
      const hasRequiredLevel = playerProgress.level >= helper.unlock_level;
      
      // Определяем, может ли игрок купить помощника
      const canBuy = !isUnlocked && hasRequiredLevel && hasEnoughResources;
      
      // Получаем доход в час для текущего или первого уровня
      let incomePerHour = 0;
      
      // Если помощник куплен, берем доход для его текущего уровня
      // Если не куплен, берем доход для первого уровня (чтобы показать, сколько будет приносить)
      const levelToCheck = isUnlocked ? level : 1;
      
      // Получаем информацию о доходе для уровня
      const levelData = await db.get(`
        SELECT income_per_hour FROM helper_levels
        WHERE helper_id = ? AND level = ?
      `, [helper.id, levelToCheck]);
      
      if (levelData) {
        incomePerHour = parseFloat(levelData.income_per_hour);
      }
      
      console.log(`Помощник ${helper.id}: уровень ${levelToCheck}, доход ${incomePerHour}/ч`);
      
      // Форматируем помощника для клиента
      return {
        id: helper.id,
        name: helper.name,
        locationId: helper.location_id,
        unlockLevel: helper.unlock_level,
        unlockCost: helper.unlock_cost,
        currencyId: helper.currency_id,
        currencyType: helper.currency_type,
        maxLevel: helper.max_level,
        imagePath: helper.image_path,
        isUnlocked: isUnlocked,
        level: level,
        incomePerHour: incomePerHour,
        hasRequiredLevel: hasRequiredLevel,
        canBuy: canBuy,
        playerLevel: playerProgress.level
      };
    }));
    
    console.log(`Отправка помощников: ${JSON.stringify(formattedHelpers)}`);
    res.json(formattedHelpers);
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
    
    console.log(`Попытка покупки помощника ${helperId} пользователем ${userId}`);
    
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
      SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?
    `, [userId, helper.currency_id]);
    
    if (!playerCurrency || playerCurrency.amount < helper.unlock_cost) {
      return res.status(400).json({ 
        error: `Недостаточно ресурсов. Необходимо ${helper.unlock_cost} ${helper.currency_id}` 
      });
    }
    
    // Списываем ресурсы
    await db.run(`
      UPDATE player_currencies SET amount = amount - ? WHERE user_id = ? AND currency_id = ?
    `, [helper.unlock_cost, userId, helper.currency_id]);
    
    // Добавляем помощника в таблицу купленных с уровнем 1
    await db.run(`
      INSERT INTO player_helpers (user_id, helper_id, level)
      VALUES (?, ?, 1)
    `, [userId, helperId]);
    
    // Получаем обновленное количество ресурсов
    const updatedCurrency = await db.get(`
      SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?
    `, [userId, helper.currency_id]);
    
    const updatedAmount = updatedCurrency ? parseFloat(updatedCurrency.amount) : 0;
    
    console.log(`Помощник ${helperId} успешно куплен. Обновленное количество ресурсов: ${updatedAmount}`);
    
    // Получаем информацию о валюте для отображения
    const currencyInfo = await db.get(`
      SELECT code FROM currencies WHERE id = ?
    `, [helper.currency_id]);
    
    // Возвращаем успех и обновленное количество ресурсов
    res.json({ 
      success: true, 
      updatedCurrency: {
        currencyId: helper.currency_id,
        currencyType: currencyInfo ? currencyInfo.code : null,
        amount: updatedAmount
      }
    });
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
    
    // Получаем активных помощников пользователя
    const activeHelpers = await db.all(`
      SELECT h.*, pah.activated_time, pah.location_id
      FROM player_active_helpers pah
      JOIN helpers h ON pah.helper_id = h.id
      WHERE pah.user_id = ?
    `, [userId]);
    
    if (activeHelpers.length === 0) {
      return res.json({ collected: [] });
    }
    
    let totalCollected = 0;
    let currencyId = null;
    let locationId = null;
    
    // Для каждого активного помощника рассчитываем доход
    for (const helper of activeHelpers) {
      // Расчет времени, прошедшего с момента активации
      const activationTime = new Date(helper.activated_time);
      const currentTime = new Date();
      const timeDiffMs = currentTime.getTime() - activationTime.getTime();
      
      // Вычисляем точное время в минутах с момента активации
      const minutesDiff = timeDiffMs / (1000 * 60);
      
      // Если прошло меньше 1 минуты, пропускаем этого помощника
      if (minutesDiff < 1) {
        console.log(`Помощник ${helper.id}: активирован ${helper.activated_time}, прошло всего ${minutesDiff.toFixed(2)} минут, пропускаем`);
        continue;
      }
      
      console.log(`Помощник ${helper.id}: активирован ${helper.activated_time}, прошло ${minutesDiff.toFixed(2)} минут`);
      
      // Получаем доход в час для текущего уровня помощника
      const helperLevel = await db.get(`
        SELECT level FROM player_helpers
        WHERE user_id = ? AND helper_id = ?
      `, [userId, helper.id]);
      
      if (!helperLevel) {
        console.log(`Помощник ${helper.id} не найден в таблице player_helpers, пропускаем`);
        continue;
      }
      
      // Получаем доход в час для текущего уровня
      const levelData = await db.get(`
        SELECT income_per_hour FROM helper_levels
        WHERE helper_id = ? AND level = ?
      `, [helper.id, helperLevel.level]);
      
      if (!levelData) {
        console.log(`Данные об уровне ${helperLevel.level} для помощника ${helper.id} не найдены, пропускаем`);
        continue;
      }
      
      // Получаем доход в час и переводим в доход в минуту
      const hourlyIncome = parseFloat(levelData.income_per_hour);
      const minuteIncome = hourlyIncome / 60;
      
      // Количество собранных ресурсов (округленное до двух знаков после запятой)
      const collected = Math.round(minuteIncome * minutesDiff * 100) / 100;
      
      // Получаем информацию о валюте для отображения в логе
      const currencyInfo = await db.get(`
        SELECT name FROM currencies WHERE id = ?
      `, [helper.currency_id]);
      
      const currencyName = currencyInfo ? currencyInfo.name : `валюты ${helper.currency_id}`;
      
      console.log(`Помощник ${helper.id}: доход ${hourlyIncome} в час (${minuteIncome.toFixed(4)} в минуту), собрано ${collected} ${currencyName} за ${minutesDiff.toFixed(2)} минут`);
      
      totalCollected += collected;
      
      locationId = helper.location_id;
      currencyId = helper.currency_id;
      
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
      // Получаем информацию о валюте для отображения в логе
      const currencyInfo = await db.get(`
        SELECT name FROM currencies WHERE id = ?
      `, [currencyId]);
      
      const currencyName = currencyInfo ? currencyInfo.name : `валюты ${currencyId}`;
      
      // Проверяем, есть ли уже такая валюта у игрока
      const existingCurrency = await db.get(`
        SELECT * FROM player_currencies
        WHERE user_id = ? AND currency_id = ?
      `, [userId, currencyId]);
      
      if (existingCurrency) {
        // Обновляем существующую валюту
        await db.run(`
          UPDATE player_currencies SET amount = amount + ? WHERE user_id = ? AND currency_id = ?
        `, [totalCollected, userId, currencyId]);
        
        console.log(`Добавлено ${totalCollected} ${currencyName} игроку ${userId}`);
      } else {
        // Создаем новую запись о валюте
        await db.run(`
          INSERT INTO player_currencies (user_id, currency_id, amount) VALUES (?, ?, ?)
        `, [userId, currencyId, totalCollected]);
        
        console.log(`Создана новая валюта ${currencyName} с количеством ${totalCollected} для игрока ${userId}`);
      }
    }
    
    res.json({ 
      collected: totalCollected,
      currency_id: currencyId,
      location_id: locationId
    });
  } catch (error) {
    console.error('Ошибка при сборе ресурсов от помощников:', error);
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

// API для получения помощников по ID локации
app.get('/api/helpers/location/:locationId', async (req, res) => {
  try {
    const locationId = parseInt(req.params.locationId);
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не указан идентификатор пользователя' });
    }
    
    // Получаем всех помощников для указанной локации
    const helpers = await db.all(`
      SELECT h.*, 
             CASE WHEN ph.helper_id IS NOT NULL THEN 1 ELSE 0 END as is_unlocked,
             ph.level as level
      FROM helpers h
      LEFT JOIN player_helpers ph ON h.id = ph.helper_id AND ph.user_id = ?
      WHERE h.location_id = ?
      ORDER BY h.unlock_level ASC
    `, [userId, locationId]);
    
    res.json(helpers);
  } catch (error) {
    console.error('Ошибка при получении помощников:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для получения уровней всех помощников
app.get('/api/helpers/levels', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не указан идентификатор пользователя' });
    }
    
    // Получаем уровни всех помощников, которые есть у пользователя
    const ownedHelpers = await db.all(`
      SELECT helper_id, level FROM player_helpers WHERE user_id = ?
    `, [userId]);
    
    // Получаем информацию о уровнях для всех помощников пользователя
    const helperLevels = [];
    
    for (const helper of ownedHelpers) {
      const levels = await db.all(`
        SELECT * FROM helper_levels 
        WHERE helper_id = ? AND level <= ?
        ORDER BY level ASC
      `, [helper.helper_id, helper.level + 1]); // Получаем текущий уровень и следующий
      
      helperLevels.push(...levels);
    }
    
    res.json(helperLevels);
  } catch (error) {
    console.error('Ошибка при получении уровней помощников:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для получения уровня конкретного помощника
app.get('/api/helpers/:helperId/level', async (req, res) => {
  try {
    const helperId = parseInt(req.params.helperId);
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не указан идентификатор пользователя' });
    }
    
    // Получаем текущий уровень помощника
    const helperData = await db.get(`
      SELECT helper_id, level FROM player_helpers 
      WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    if (!helperData) {
      return res.status(404).json({ error: 'Помощник не найден или не куплен' });
    }
    
    // Получаем информацию о текущем уровне
    const currentLevel = await db.get(`
      SELECT * FROM helper_levels 
      WHERE helper_id = ? AND level = ?
    `, [helperId, helperData.level]);
    
    // Получаем информацию о следующем уровне (если не максимальный)
    const helper = await db.get(`SELECT max_level FROM helpers WHERE id = ?`, [helperId]);
    
    if (helperData.level < helper.max_level) {
      const nextLevel = await db.get(`
        SELECT * FROM helper_levels 
        WHERE helper_id = ? AND level = ?
      `, [helperId, helperData.level + 1]);
      
      res.json({
        current_level: currentLevel,
        next_level: nextLevel,
        is_max_level: false
      });
    } else {
      res.json({
        current_level: currentLevel,
        next_level: null,
        is_max_level: true
      });
    }
  } catch (error) {
    console.error('Ошибка при получении уровня помощника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для покупки помощника
app.post('/api/helpers/buy', async (req, res) => {
  try {
    const { helperId } = req.body;
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не указан идентификатор пользователя' });
    }
    
    // Получаем информацию о помощнике
    const helper = await db.get(`SELECT * FROM helpers WHERE id = ?`, [helperId]);
    
    if (!helper) {
      return res.status(404).json({ error: 'Помощник не найден' });
    }
    
    // Проверяем, разблокирован ли уже помощник
    const isUnlocked = await db.get(`
      SELECT 1 FROM player_helpers 
      WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    if (isUnlocked) {
      return res.status(400).json({ error: 'Помощник уже куплен' });
    }
    
    // Получаем уровень игрока
    const playerProgress = await db.get(`
      SELECT level FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (!playerProgress) {
      return res.status(404).json({ error: 'Прогресс игрока не найден' });
    }
    
    // Проверяем, достиг ли игрок необходимого уровня
    if (playerProgress.level < helper.unlock_level) {
      return res.status(400).json({ 
        error: `Необходим уровень ${helper.unlock_level} для покупки этого помощника` 
      });
    }
    
    // Получаем количество валюты игрока
    const playerCurrency = await db.get(`
      SELECT amount FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, helper.currency_id]);
    
    if (!playerCurrency || playerCurrency.amount < helper.unlock_cost) {
      return res.status(400).json({ 
        error: `Недостаточно ресурсов. Необходимо ${helper.unlock_cost} ${helper.currency_id}` 
      });
    }
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Списываем ресурсы
      await db.run(`
        UPDATE player_currencies 
        SET amount = amount - ? 
        WHERE user_id = ? AND currency_id = ?
      `, [helper.unlock_cost, userId, helper.currency_id]);
      
      // Добавляем помощника игроку
      await db.run(`
        INSERT INTO player_helpers (user_id, helper_id, level) 
        VALUES (?, ?, 1)
      `, [userId, helperId]);
      
      // Фиксируем транзакцию
      await db.run('COMMIT');
      
      res.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при покупке помощника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для улучшения помощника
app.post('/api/helpers/upgrade', async (req, res) => {
  try {
    const { helperId } = req.body;
    const userId = req.headers['x-user-id'];
    
    console.log(`Запрос на улучшение помощника: helperId=${helperId}, userId=${userId}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не указан идентификатор пользователя' });
    }
    
    if (!helperId) {
      return res.status(400).json({ error: 'Не указан ID помощника' });
    }
    
    // Получаем текущий уровень помощника
    const helperData = await db.get(`
      SELECT helper_id, level FROM player_helpers 
      WHERE user_id = ? AND helper_id = ?
    `, [userId, helperId]);
    
    console.log('Данные помощника:', helperData);
    
    if (!helperData) {
      return res.status(404).json({ error: 'Помощник не найден или не куплен' });
    }
    
    // Получаем информацию о помощнике
    const helper = await db.get(`SELECT id, max_level, currency_id FROM helpers WHERE id = ?`, [helperId]);
    
    console.log('Информация о помощнике:', helper);
    
    // Проверяем, не достигнут ли максимальный уровень
    if (helperData.level >= helper.max_level) {
      return res.status(400).json({ error: 'Достигнут максимальный уровень помощника' });
    }
    
    // Получаем информацию о следующем уровне
    const nextLevel = await db.get(`
      SELECT * FROM helper_levels 
      WHERE helper_id = ? AND level = ?
    `, [helperId, helperData.level + 1]);
    
    console.log('Информация о следующем уровне:', nextLevel);
    
    if (!nextLevel) {
      return res.status(404).json({ error: 'Информация о следующем уровне не найдена' });
    }
    
    // Получаем валюту игрока используя нашу улучшенную функцию
    const playerCurrency = await getOrCreatePlayerCurrency(userId, helper.currency_id);
    
    console.log('Валюта игрока:', playerCurrency, 'Требуется:', nextLevel.upgrade_cost);
    
    if (!playerCurrency || playerCurrency.amount < nextLevel.upgrade_cost) {
      return res.status(400).json({ 
        error: `Недостаточно ресурсов. Необходимо ${nextLevel.upgrade_cost} ${helper.currency_id}` 
      });
    }
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Списываем ресурсы
      await db.run(`
        UPDATE player_currencies 
        SET amount = amount - ? 
        WHERE user_id = ? AND currency_id = ?
      `, [nextLevel.upgrade_cost, userId, playerCurrency.currency_id]);
      
      // Увеличиваем уровень помощника
      await db.run(`
        UPDATE player_helpers 
        SET level = level + 1 
        WHERE user_id = ? AND helper_id = ?
      `, [userId, helperId]);
      
      // Фиксируем транзакцию
      await db.run('COMMIT');
      
      const newLevel = helperData.level + 1;
      console.log(`Помощник успешно улучшен. Новый уровень: ${newLevel}`);
      
      res.json({ success: true, level: newLevel });
    } catch (error) {
      console.error('Ошибка в транзакции:', error);
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при улучшении помощника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Расчет прибыли от помощников - запускается периодически или при входе игрока
async function calculateHelperIncome(userId, updateLastLogin = false) {
  try {
    console.log(`Начинаем расчет дохода от помощников для пользователя ${userId}`);
    
    // Получаем всех помощников игрока с их уровнями
    const helpers = await db.all(`
      SELECT h.id, h.location_id, h.currency_id, ph.level
      FROM player_helpers ph
      JOIN helpers h ON ph.helper_id = h.id
      WHERE ph.user_id = ?
    `, [userId]);
    
    if (helpers.length === 0) {
      console.log(`У пользователя ${userId} нет помощников, пропускаем расчет дохода`);
      return {};
    }
    
    console.log(`Найдено ${helpers.length} помощников для пользователя ${userId}`);
    
    let totalIncome = {};
    
    // Проверяем, когда в последний раз игрок заходил в игру
    const lastLoginTime = await db.get(`
      SELECT last_login FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (!lastLoginTime || !lastLoginTime.last_login) {
      console.log('Первый вход игрока, пропускаем начисление дохода');
      
      // Обновляем время последнего входа игрока только если указан флаг
      if (updateLastLogin) {
        await db.run(`
          UPDATE player_progress SET last_login = datetime('now') WHERE user_id = ?
        `, [userId]);
        console.log(`Обновлено время последнего входа для пользователя ${userId} (первый вход)`);
      }
      
      return {};
    }
    
    // Получаем время последнего входа и текущее время в одинаковом формате
    // Используем SQLite для получения времени в том же формате
    const timeData = await db.get(`
      SELECT 
        datetime('${lastLoginTime.last_login}') as last_login_time,
        datetime('now') as current_time,
        (julianday('now') - julianday('${lastLoginTime.last_login}')) * 24 * 60 as minutes_diff
    `);
    
    const minutesDiff = parseFloat(timeData.minutes_diff);
    
    // Если прошло меньше 1 минуты, пропускаем расчет и не обновляем время
    if (minutesDiff < 1) {
      console.log(`Прошло всего ${minutesDiff.toFixed(2)} минут с последнего входа, пропускаем расчет`);
      return {};
    }
    
    console.log(`Прошло ${minutesDiff.toFixed(2)} минут с последнего входа (с ${timeData.last_login_time} до ${timeData.current_time})`);
    
    // Для каждого помощника получаем доход на его текущем уровне
    for (const helper of helpers) {
      const levelData = await db.get(`
        SELECT income_per_hour FROM helper_levels
        WHERE helper_id = ? AND level = ?
      `, [helper.id, helper.level]);
      
      if (levelData) {
        // Получаем доход в час и переводим в доход в минуту
        const hourlyIncome = parseFloat(levelData.income_per_hour);
        const minuteIncome = hourlyIncome / 60;
        
        // Рассчитываем накопленный доход за прошедшие минуты
        const income = minuteIncome * minutesDiff;
        
        console.log(`Помощник ${helper.id} (уровень ${helper.level}): доход ${hourlyIncome} в час (${minuteIncome.toFixed(4)} в минуту), накоплено ${income.toFixed(2)} за ${minutesDiff.toFixed(2)} минут`);
        
        // Добавляем доход к общему для этого типа валюты
        if (!totalIncome[helper.currency_id]) {
          totalIncome[helper.currency_id] = 0;
        }
        
        totalIncome[helper.currency_id] += income;
      }
    }
    
    // Проверяем, есть ли доход для накопления
    const hasIncome = Object.keys(totalIncome).length > 0;
    
    // Обновляем время последнего входа игрока только если указан флаг
    if (updateLastLogin) {
      await db.run(`
        UPDATE player_progress SET last_login = datetime('now') WHERE user_id = ?
      `, [userId]);
      console.log(`Обновлено время последнего входа для пользователя ${userId}`);
    }
    
    // Если нет дохода, просто возвращаем пустой объект
    if (!hasIncome) {
      console.log(`Нет дохода для накопления для пользователя ${userId}`);
      return {};
    }
    
    // Накапливаем доход в таблице player_pending_income
    for (const [currencyId, amount] of Object.entries(totalIncome)) {
      if (amount > 0) {
        // Округляем до двух знаков после запятой
        const roundedAmount = Math.round(amount * 100) / 100;
        
        // Получаем информацию о валюте для отображения в логе
        const currencyInfo = await db.get(`
          SELECT name FROM currencies WHERE id = ?
        `, [currencyId]);
        
        const currencyName = currencyInfo ? currencyInfo.name : `валюты ${currencyId}`;
        
        console.log(`Накапливаем доход от помощников: ${roundedAmount} ${currencyName}`);
        
        // Проверяем, есть ли уже накопленный доход для этой валюты
        const hasPendingIncome = await db.get(`
          SELECT 1 FROM player_pending_income WHERE user_id = ? AND currency_id = ?
        `, [userId, currencyId]);
        
        if (hasPendingIncome) {
          await db.run(`
            UPDATE player_pending_income 
            SET amount = amount + ? 
            WHERE user_id = ? AND currency_id = ?
          `, [roundedAmount, userId, currencyId]);
        } else {
          await db.run(`
            INSERT INTO player_pending_income (user_id, currency_id, amount)
            VALUES (?, ?, ?)
          `, [userId, currencyId, roundedAmount]);
        }
      }
    }
    
    console.log(`Завершен расчет дохода от помощников для пользователя ${userId}`);
    return totalIncome;
  } catch (error) {
    console.error('Ошибка при расчете дохода от помощников:', error);
    throw error;
  }
}

// Вспомогательные функции

// Получение или создание прогресса игрока
async function getOrCreatePlayerProgress(userId) {
  try {
    console.log(`Получение прогресса для пользователя ${userId}`);
    
    // Проверяем, есть ли запись о прогрессе
    const progress = await db.get(`
      SELECT * FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (progress) {
      console.log(`Найден прогресс для пользователя ${userId}`);
      return progress;
    }
    
    console.log(`Прогресс для пользователя ${userId} не найден, создаем новый`);
    
    // Создаем запись о прогрессе, используя SQLite datetime функцию
    await db.run(`
      INSERT INTO player_progress 
        (user_id, level, experience, energy, max_energy, last_energy_refill_time, last_login)
      VALUES (?, 1, 0, 100, 100, datetime('now'), datetime('now'))
    `, [userId]);
    
    // Создаем запись основной валюты (сад-коины)
    await getOrCreatePlayerCurrency(userId, '5');
    
    // Создаем запись валюты леса
    await getOrCreatePlayerCurrency(userId, '1');
    
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
    
    console.log(`Создан новый прогресс для пользователя ${userId}`);
    
    // Получаем созданный прогресс
    return await db.get(`
      SELECT * FROM player_progress WHERE user_id = ?
    `, [userId]);
  } catch (error) {
    console.error(`Ошибка при получении/создании прогресса игрока ${userId}:`, error);
    throw error;
  }
}

// Получение или создание валюты игрока
async function getOrCreatePlayerCurrency(userId, currencyId) {
  try {
    // Проверяем, есть ли запись о валюте
    const currency = await db.get(`
      SELECT * FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, currencyId]);
    
    if (currency) {
      return { 
        user_id: currency.user_id, 
        currency_id: currency.currency_id, 
        amount: currency.amount 
      };
    }
    
    // Если валюты нет, создаем её
    await db.run(`
      INSERT INTO player_currencies (user_id, currency_id, amount)
      VALUES (?, ?, 0)
    `, [userId, currencyId]);
    
    return { user_id: userId, currency_id: currencyId, amount: 0 };
  } catch (error) {
    console.error(`Ошибка при получении/создании валюты для пользователя ${userId}, валюта ${currencyId}:`, error);
    throw error;
  }
}

// Добавление опыта и проверка повышения уровня
async function addExperience(userId, exp) {
  try {
    // Получаем текущий прогресс игрока
    const playerProgress = await getOrCreatePlayerProgress(userId);
    const currentLevel = playerProgress.level;
    const currentExp = playerProgress.experience;
    
    // Добавляем опыт
    const newExp = currentExp + exp;
    
    // Получаем информацию о текущем уровне
    const currentLevelInfo = await db.get('SELECT required_exp FROM levels WHERE level = ?', [currentLevel + 1]);
    
    // Если информация о следующем уровне не найдена, просто добавляем опыт без повышения уровня
    if (!currentLevelInfo) {
      await db.run('UPDATE player_progress SET experience = ? WHERE user_id = ?', [newExp, userId]);
      return { levelUp: false, level: currentLevel, rewards: [] };
    }
    
    // Проверяем, достаточно ли опыта для повышения уровня
    const requiredExp = currentLevelInfo.required_exp;
    
    if (newExp >= requiredExp) {
      // Повышаем уровень
      const newLevel = currentLevel + 1;
      
      // Обновляем уровень и опыт
      await db.run(
        'UPDATE player_progress SET level = ?, experience = ? WHERE user_id = ?',
        [newLevel, newExp - requiredExp, userId]
      );
      
      // Получаем награды за новый уровень
      const rewards = await db.all(
        'SELECT * FROM rewards WHERE level_id = ?',
        [newLevel]
      );
      
      // Обрабатываем каждую награду
      for (const reward of rewards) {
        await processReward(userId, reward);
      }
      
      // Проверяем и выдаем достижения после повышения уровня
      await checkAndGrantAchievements(userId);
      
      return { levelUp: true, level: newLevel, rewards };
    } else {
      // Просто обновляем опыт
      await db.run('UPDATE player_progress SET experience = ? WHERE user_id = ?', [newExp, userId]);
      return { levelUp: false, level: currentLevel, rewards: [] };
    }
  } catch (error) {
    console.error(`Ошибка при добавлении опыта: ${error.message}`);
    throw error;
  }
}

// Обработка награды
async function processReward(userId, reward) {
  switch(reward.reward_type) {
    case RewardType.MAIN_CURRENCY:
      // Добавляем основную валюту (сад-коины)
      const mainCurrency = await getOrCreatePlayerCurrency(userId, '5'); // 5 - ID основной валюты (сад-коины)
      
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [reward.amount, userId, mainCurrency.currency_id]);
      console.log(`Награда: добавлено ${reward.amount} основной валюты (сад-коины)`);
      break;
      
    case RewardType.LOCATION_CURRENCY:
      // Добавляем валюту текущей локации
      // Если нет информации о конкретной локации, используем лес (ID: 1)
      const defaultCurrency = await getOrCreatePlayerCurrency(userId, '1');
      
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [reward.amount, userId, defaultCurrency.currency_id]);
      console.log(`Награда: добавлено ${reward.amount} валюты локации (брёвна)`);
      break;
      
    // Динамическая обработка специальных типов валют
    case 'forest_currency':
    case 'garden_currency':
    case 'winter_currency':
    case 'mountain_currency':
    case 'desert_currency':
    case 'lake_currency':
      // Получаем ID валюты по её коду
      const currencyId = reward.currency_id || (await getCurrencyIdByType(reward.reward_type.split('_')[0])).id;
      const specialCurrency = await getOrCreatePlayerCurrency(userId, currencyId);
      
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [reward.amount, userId, specialCurrency.currency_id]);
      console.log(`Награда: добавлено ${reward.amount} валюты с ID ${currencyId}`);
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
        console.log(`Награда: добавлено ${reward.amount} валюты ${reward.currency_id}`);
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
  try {
    // Нормализуем тип валюты к нижнему регистру
    const normalizedType = currencyType.toLowerCase();
    
    // Ищем валюту по коду
    const currency = await db.get(`
      SELECT id FROM currencies 
      WHERE LOWER(code) = LOWER(?)
    `, [normalizedType]);
    
    if (currency) {
      console.log(`Найдена валюта с кодом ${normalizedType}, ID: ${currency.id}`);
      return { id: currency.id };
    }
    
    // Если не нашли по коду, используем значения по умолчанию
    console.warn(`Валюта с кодом ${normalizedType} не найдена, используем значение по умолчанию`);
    
    // По умолчанию: 5 для main (сад-коины) или 1 для forest (брёвна)
    if (normalizedType === 'main') {
      return { id: '5' };
    } else {
      return { id: '1' }; // По умолчанию валюта леса (брёвна)
    }
  } catch (error) {
    console.error(`Ошибка при получении ID валюты для кода ${currencyType}:`, error);
    // По умолчанию возвращаем ID валюты леса
    return { id: '1' };
  }
}

// Асинхронно инициализируем базу данных и запускаем сервер
async function startServer() {
  try {
    // Инициализируем базу данных
    await initDatabase();
    
    // Создаем дополнительные таблицы для системы достижений
    await ensureLoginHistoryTable();
    await ensurePlayerStatsTable();
    await ensureNotificationsTable();
    await ensureAchievementCongratulationsTable();
    
    // Запускаем сервер
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

// Добавляем API-эндпоинт для получения достижений игрока
app.get('/api/player/achievements', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем все достижения игрока с информацией о них
    const achievements = await db.all(`
      SELECT 
        a.id, a.name, a.description, a.condition_type, a.condition_value, a.image_path,
        pa.date_unlocked
      FROM achievements a
      JOIN player_achievements pa ON a.id = pa.achievement_id
      WHERE pa.user_id = ?
      ORDER BY pa.date_unlocked DESC
    `, [userId]);
    
    res.json(achievements);
  } catch (error) {
    console.error('Ошибка при получении достижений игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавляем API-эндпоинт для получения всех доступных достижений
app.get('/api/achievements', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем все достижения
    const achievements = await db.all('SELECT * FROM achievements');
    
    // Получаем достижения, уже полученные игроком
    const userAchievements = await db.all(
      'SELECT achievement_id, date_unlocked FROM player_achievements WHERE user_id = ?',
      [userId]
    );
    
    // Создаем карту полученных достижений для быстрого поиска
    const unlockedMap = new Map();
    userAchievements.forEach(ua => {
      unlockedMap.set(ua.achievement_id, ua.date_unlocked);
    });
    
    // Добавляем информацию о разблокировке к каждому достижению
    const achievementsWithStatus = achievements.map(achievement => ({
      ...achievement,
      unlocked: unlockedMap.has(achievement.id),
      date_unlocked: unlockedMap.get(achievement.id) || null
    }));
    
    res.json(achievementsWithStatus);
  } catch (error) {
    console.error('Ошибка при получении списка достижений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавляем API-эндпоинт для ручной проверки достижений
app.post('/api/check-achievements', async (req, res) => {
  try {
    const { userId } = req;
    
    // Запускаем проверку достижений
    const result = await checkAndGrantAchievements(userId);
    
    // Получаем обновленный список достижений игрока
    const achievements = await db.all(`
      SELECT 
        a.id, a.name, a.description, a.condition_type, a.condition_value, a.image_path,
        pa.date_unlocked
      FROM achievements a
      JOIN player_achievements pa ON a.id = pa.achievement_id
      WHERE pa.user_id = ?
      ORDER BY pa.date_unlocked DESC
    `, [userId]);
    
    res.json({
      success: result,
      achievements
    });
  } catch (error) {
    console.error('Ошибка при проверке достижений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для обновления ранга игрока
app.post('/api/player/update-rank', async (req, res) => {
  try {
    const { userId } = req;
    const { seasonId = 1, points } = req.body;
    
    if (points === undefined) {
      return res.status(400).json({ error: 'Не указаны очки (points)' });
    }
    
    // Обновляем ранг и проверяем достижения
    const result = await updatePlayerRank(userId, seasonId, points);
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка при обновлении ранга:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для получения уведомлений о достижениях
app.get('/api/player/notifications', async (req, res) => {
  try {
    const { userId } = req;
    const { limit = 10, offset = 0, type } = req.query;
    
    // Базовый запрос
    let query = `
      SELECT * FROM player_notifications 
      WHERE user_id = ?
    `;
    
    const params = [userId];
    
    // Если указан тип, добавляем фильтр
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    // Добавляем сортировку и пагинацию
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Выполняем запрос
    const notifications = await db.all(query, params);
    
    // Получаем общее количество уведомлений
    let countQuery = 'SELECT COUNT(*) as total FROM player_notifications WHERE user_id = ?';
    const countParams = [userId];
    
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    
    const countResult = await db.get(countQuery, countParams);
    const total = countResult ? countResult.total : 0;
    
    res.json({
      notifications,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для отметки уведомлений как прочитанных
app.post('/api/player/notifications/read', async (req, res) => {
  try {
    const { userId } = req;
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'Не указаны ID уведомлений' });
    }
    
    // Отмечаем уведомления как прочитанные
    await db.run(`
      UPDATE player_notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND id IN (${notificationIds.map(() => '?').join(',')})
    `, [userId, ...notificationIds]);
    
    res.json({ success: true, count: notificationIds.length });
  } catch (error) {
    console.error('Ошибка при отметке уведомлений как прочитанных:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для получения последних полученных достижений
app.get('/api/player/recent-achievements', async (req, res) => {
  try {
    const { userId } = req;
    const { limit = 5 } = req.query;
    
    // Получаем последние полученные достижения
    const achievements = await db.all(`
      SELECT 
        a.id, a.name, a.description, a.condition_type, a.condition_value, a.image_path,
        pa.date_unlocked
      FROM achievements a
      JOIN player_achievements pa ON a.id = pa.achievement_id
      WHERE pa.user_id = ?
      ORDER BY pa.date_unlocked DESC
      LIMIT ?
    `, [userId, parseInt(limit)]);
    
    res.json(achievements);
  } catch (error) {
    console.error('Ошибка при получении последних достижений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для получения непрочитанных уведомлений о достижениях
app.get('/api/player/achievement-notifications', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем непрочитанные уведомления о достижениях
    const notifications = await db.all(`
      SELECT * FROM player_notifications
      WHERE user_id = ? AND type = 'achievement' AND is_read = 0
      ORDER BY created_at DESC
    `, [userId]);
    
    res.json(notifications);
  } catch (error) {
    console.error('Ошибка при получении уведомлений о достижениях:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для получения непоказанных поздравлений с достижениями
app.get('/api/player/achievement-congratulations', async (req, res) => {
  try {
    const { userId } = req;
    
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='achievement_congratulations'"
    );
    
    if (!tableExists) {
      await ensureAchievementCongratulationsTable();
      return res.json([]);
    }
    
    // Получаем непоказанные поздравления
    const congratulations = await db.all(`
      SELECT * FROM achievement_congratulations
      WHERE user_id = ? AND is_shown = 0
      ORDER BY created_at DESC
    `, [userId]);
    
    res.json(congratulations);
  } catch (error) {
    console.error('Ошибка при получении поздравлений с достижениями:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для отметки поздравления как показанного
app.post('/api/player/achievement-congratulations/:id/shown', async (req, res) => {
  try {
    const { userId } = req;
    const { id } = req.params;
    
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='achievement_congratulations'"
    );
    
    if (!tableExists) {
      return res.status(404).json({ error: 'Таблица поздравлений не существует' });
    }
    
    // Отмечаем поздравление как показанное
    await db.run(`
      UPDATE achievement_congratulations
      SET is_shown = 1, shown_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при отметке поздравления как показанного:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API-эндпоинт для обновления профиля с последним достижением
app.post('/api/player/update-profile-achievement', async (req, res) => {
  try {
    const { userId } = req;
    
    // Обновляем профиль с последним достижением
    const result = await updateProfileWithLatestAchievement(userId);
    
    if (result) {
      // Получаем обновленный профиль
      const profile = await db.get(`
        SELECT 
          p.user_id, 
          p.featured_achievement_id,
          a.name as achievement_name,
          a.description as achievement_description,
          a.image_path as achievement_image
        FROM player_profile p
        LEFT JOIN achievements a ON p.featured_achievement_id = a.id
        WHERE p.user_id = ?
      `, [userId]);
      
      res.json({ 
        success: true, 
        profile 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Не удалось обновить профиль или у пользователя нет достижений' 
      });
    }
  } catch (error) {
    console.error('Ошибка при обновлении профиля с последним достижением:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Функция для очистки дубликатов в таблице player_currencies
async function cleanupPlayerCurrencies() {
  console.log('Начинаем очистку дубликатов в таблице player_currencies...');
  
  try {
    // 1. Получаем все записи
    const allCurrencies = await db.all('SELECT * FROM player_currencies');
    console.log('Текущие записи в таблице player_currencies:', allCurrencies);
    
    // Создаем карту для объединения дубликатов
    const currencyMap = new Map();
    
    // Объединяем записи с одинаковым user_id и currency_id
    allCurrencies.forEach(currency => {
      const key = `${currency.user_id}_${currency.currency_id}`;
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
        INSERT INTO player_currencies (user_id, currency_id, amount) VALUES (?, ?, ?)
      `, [currency.user_id, currency.currency_id, currency.amount]);
    }
    
    // 4. Убеждаемся, что у каждого пользователя есть записи для основных валют
    const users = [...new Set(allCurrencies.map(c => c.user_id))];
    
    for (const userId of users) {
      // Создаем основную валюту (сад-коины), если её нет
      await getOrCreatePlayerCurrency(userId, '5');
      
      // Создаем валюту леса (брёвна), если её нет
      await getOrCreatePlayerCurrency(userId, '1');
    }
    
    console.log('Очистка дубликатов в таблице player_currencies завершена успешно');
  } catch (error) {
    console.error('Ошибка при очистке дубликатов в таблице player_currencies:', error);
  }
}

// Инициализируем базу данных при запуске сервера
initDatabase().then(async () => {
  console.log('База данных инициализирована');
  
  // Проверяем наличие столбца last_login в player_progress
  try {
    const tableInfo = await db.all("PRAGMA table_info(player_progress)");
    
    // Проверяем, есть ли столбец last_login
    const hasLastLogin = tableInfo.some(column => column.name === 'last_login');
    
    if (!hasLastLogin) {
      console.log('Столбец last_login отсутствует в таблице player_progress');
      console.log('Пожалуйста, запустите скрипт server/add_last_login_column.js для обновления структуры базы данных');
    } else {
      console.log('Столбец last_login найден в таблице player_progress');
    }
    
    // Создаем таблицу для уровней улучшения хранилища, если её нет
    await db.run(`
      CREATE TABLE IF NOT EXISTS storage_upgrade_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        upgrade_cost REAL NOT NULL,
        currency_id INTEGER NOT NULL,
        UNIQUE(location_id, level)
      )
    `);
    
    // Проверяем, есть ли записи в таблице
    const storageUpgradeLevels = await db.get(`SELECT COUNT(*) as count FROM storage_upgrade_levels`);
    if (storageUpgradeLevels.count === 0) {
      console.log('Добавляем начальные данные для уровней хранилища...');
      
      // Добавляем уровни для локации 1 (Лес)
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (1, 1, 500, 0, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (1, 2, 1000, 100, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (1, 3, 2000, 250, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (1, 4, 5000, 500, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (1, 5, 10000, 1000, 1)`);
      
      // Добавляем уровни для локации 2 (Ферма)
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (2, 1, 500, 0, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (2, 2, 1000, 150, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (2, 3, 2000, 300, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (2, 4, 5000, 600, 1)`);
      await db.run(`INSERT INTO storage_upgrade_levels (location_id, level, capacity, upgrade_cost, currency_id) VALUES (2, 5, 10000, 1200, 1)`);
      
      console.log('Начальные данные для уровней хранилища добавлены');
    }
    
    // Создаем таблицу для хранения лимитов хранилищ игрока
    await db.run(`
      CREATE TABLE IF NOT EXISTS player_storage_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        location_id INTEGER NOT NULL,
        currency_id INTEGER NOT NULL,
        storage_level INTEGER NOT NULL DEFAULT 1,
        capacity INTEGER NOT NULL DEFAULT 500,
        UNIQUE(user_id, location_id, currency_id)
      )
    `);
    
  } catch (error) {
    console.error('Ошибка при проверке структуры таблицы player_progress или создании таблиц хранилища:', error);
  }
  
  // Запускаем сервер после инициализации базы данных
  startServer();
}).catch(err => {
  console.error('Ошибка при инициализации базы данных:', err);
});

// Функция для получения идентификатора пользователя из запроса
function getUserId(req) {
  // Проверяем, есть ли идентификатор в заголовке
  if (req.headers && req.headers['x-user-id']) {
    console.log(`Using user ID from header: ${req.headers['x-user-id']}`);
    return req.headers['x-user-id'];
  }
  
  // Если нет в заголовке, проверяем параметры запроса
  if (req.query && req.query.userId) {
    console.log(`Using user ID from query: ${req.query.userId}`);
    return req.query.userId;
  }
  
  // Если нет в параметрах, проверяем тело запроса
  if (req.body && req.body.userId) {
    console.log(`Using user ID from body: ${req.body.userId}`);
    return req.body.userId;
  }
  
  // Если ничего не нашли, используем тестовый ID
  console.log('Using test user ID');
  return 'test_user';
}

// API для хранилища ресурсов
// Получить информацию о хранилище для определенной локации и валюты
app.get('/api/player/storage/:locationId/:currencyId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { locationId } = req.params;
    let { currencyId } = req.params;
    
    // Проверяем, существует ли запись о хранилище для этого пользователя
    let storageInfo = await db.get(`
      SELECT storage_level, capacity 
      FROM player_storage_limits 
      WHERE user_id = ? AND location_id = ? AND currency_id = ?
    `, [userId, locationId, currencyId]);
    
    // Если записи нет, создаем её с начальными значениями
    if (!storageInfo) {
      // Получаем начальную емкость из таблицы уровней хранилища
      const initialLevel = await db.get(`
        SELECT capacity FROM storage_upgrade_levels 
        WHERE location_id = ? AND level = 1
      `, [locationId]);
      
      const initialCapacity = initialLevel ? initialLevel.capacity : 500;
      
      // Создаем запись о хранилище
      await db.run(`
        INSERT INTO player_storage_limits (user_id, location_id, currency_id, storage_level, capacity)
        VALUES (?, ?, ?, 1, ?)
      `, [userId, locationId, currencyId, initialCapacity]);
      
      storageInfo = { storage_level: 1, capacity: initialCapacity };
    }
    
    // Получаем текущее количество ресурсов
    const currencyAmount = await db.get(`
      SELECT amount FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, currencyId]);
    
    const amount = currencyAmount ? currencyAmount.amount : 0;
    const percentageFilled = (amount / storageInfo.capacity) * 100;
    
    res.json({
      storage_level: storageInfo.storage_level,
      capacity: storageInfo.capacity,
      current_amount: amount,
      percentage_filled: percentageFilled
    });
  } catch (error) {
    console.error('Ошибка при получении информации о хранилище:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить информацию об улучшении хранилища
app.get('/api/player/storage/:locationId/:currencyId/upgrade-info', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { locationId } = req.params;
    let { currencyId } = req.params;
    
    // Получаем текущий уровень хранилища
    const currentStorage = await db.get(`
      SELECT storage_level, capacity 
      FROM player_storage_limits 
      WHERE user_id = ? AND location_id = ? AND currency_id = ?
    `, [userId, locationId, currencyId]);
    
    // Если записи нет, создаем её с начальными значениями
    let currentLevel = 1;
    let currentCapacity = 500;
    
    if (currentStorage) {
      currentLevel = currentStorage.storage_level;
      currentCapacity = currentStorage.capacity;
    } else {
      // Получаем начальную емкость из таблицы уровней хранилища
      const initialLevel = await db.get(`
        SELECT capacity FROM storage_upgrade_levels 
        WHERE location_id = ? AND level = 1
      `, [locationId]);
      
      if (initialLevel) {
        currentCapacity = initialLevel.capacity;
      }
      
      // Создаем запись о хранилище
      await db.run(`
        INSERT INTO player_storage_limits (user_id, location_id, currency_id, storage_level, capacity)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, locationId, currencyId, currentLevel, currentCapacity]);
    }
    
    // Получаем информацию о следующем уровне
    const nextLevelInfo = await db.get(`
      SELECT level, capacity, upgrade_cost, currency_id 
      FROM storage_upgrade_levels 
      WHERE location_id = ? AND level = ?
    `, [locationId, currentLevel + 1]);
    
    // Если следующего уровня нет, возвращаем информацию о максимальном уровне
    if (!nextLevelInfo) {
      return res.json({
        currentLevel,
        nextLevel: currentLevel,
        currentCapacity,
        nextCapacity: currentCapacity,
        upgradeCost: 0,
        currencyType: 'main',
        canUpgrade: false
      });
    }
    
    // Проверяем, достаточно ли у игрока ресурсов для улучшения
    const playerCurrency = await db.get(`
      SELECT amount FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, nextLevelInfo.currency_id]);
    
    const playerAmount = playerCurrency ? playerCurrency.amount : 0;
    const canUpgrade = playerAmount >= nextLevelInfo.upgrade_cost;
    
    res.json({
      currentLevel,
      nextLevel: nextLevelInfo.level,
      currentCapacity,
      nextCapacity: nextLevelInfo.capacity,
      upgradeCost: nextLevelInfo.upgrade_cost,
      currencyType: nextLevelInfo.currency_id,
      canUpgrade
    });
  } catch (error) {
    console.error('Ошибка при получении информации об улучшении хранилища:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Улучшить хранилище
app.post('/api/player/storage/upgrade', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { locationId, currencyId } = req.body;
    
    console.log('Запрос на улучшение хранилища:', { userId, locationId, currencyId });
    
    // Получаем текущий уровень хранилища
    const currentStorage = await db.get(`
      SELECT storage_level 
      FROM player_storage_limits 
      WHERE user_id = ? AND location_id = ? AND currency_id = ?
    `, [userId, locationId, currencyId]);
    
    if (!currentStorage) {
      console.log('Хранилище не найдено:', { userId, locationId, currencyId });
      return res.status(404).json({ 
        success: false, 
        error: 'Хранилище не найдено' 
      });
    }
    
    const currentLevel = currentStorage.storage_level;
    console.log('Текущий уровень хранилища:', currentLevel);
    
    // Получаем информацию о следующем уровне
    const nextLevelInfo = await db.get(`
      SELECT level, capacity, upgrade_cost, currency_id 
      FROM storage_upgrade_levels 
      WHERE location_id = ? AND level = ?
    `, [locationId, currentLevel + 1]);
    
    // Если следующего уровня нет, возвращаем ошибку
    if (!nextLevelInfo) {
      console.log('Достигнут максимальный уровень хранилища:', { locationId, currentLevel });
      return res.status(400).json({ 
        success: false, 
        error: 'Достигнут максимальный уровень хранилища' 
      });
    }
    
    console.log('Информация о следующем уровне:', nextLevelInfo);
    
    // Получаем ID валюты для оплаты из таблицы валют по типу
    const paymentCurrencyId = nextLevelInfo.currency_id;
    
    console.log('Валюта для оплаты:', { 
      id: paymentCurrencyId 
    });
    
    // Проверяем, достаточно ли у игрока ресурсов для улучшения
    const playerCurrency = await db.get(`
      SELECT amount FROM player_currencies 
      WHERE user_id = ? AND currency_id = ?
    `, [userId, paymentCurrencyId]);
    
    const playerAmount = playerCurrency ? playerCurrency.amount : 0;
    console.log('Проверка ресурсов:', { 
      currency: paymentCurrencyId, 
      playerAmount, 
      required: nextLevelInfo.upgrade_cost,
      sufficient: playerAmount >= nextLevelInfo.upgrade_cost 
    });
    
    if (!playerCurrency || playerAmount < nextLevelInfo.upgrade_cost) {
      return res.status(400).json({ 
        success: false, 
        error: `Недостаточно ресурсов для улучшения (${Math.floor(playerAmount * 10) / 10}/${nextLevelInfo.upgrade_cost})` 
      });
    }
    
    // Списываем ресурсы
    await db.run(`
      UPDATE player_currencies 
      SET amount = amount - ? 
      WHERE user_id = ? AND currency_id = ?
    `, [nextLevelInfo.upgrade_cost, userId, paymentCurrencyId]);
    
    console.log('Списано ресурсов:', {
      currency: paymentCurrencyId,
      amount: nextLevelInfo.upgrade_cost
    });
    
    // Улучшаем хранилище
    await db.run(`
      UPDATE player_storage_limits 
      SET storage_level = ?, capacity = ? 
      WHERE user_id = ? AND location_id = ? AND currency_id = ?
    `, [nextLevelInfo.level, nextLevelInfo.capacity, userId, locationId, currencyId]);
    
    console.log('Хранилище успешно улучшено:', { 
      userId, 
      locationId, 
      currencyId, 
      oldLevel: currentLevel,
      newLevel: nextLevelInfo.level, 
      newCapacity: nextLevelInfo.capacity 
    });
    
    res.json({
      success: true,
      newLevel: nextLevelInfo.level,
      newCapacity: nextLevelInfo.capacity
    });
  } catch (error) {
    console.error('Ошибка при улучшении хранилища:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Получить все уровни хранилища для локации
app.get('/api/storage-levels/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    // Получаем все уровни хранилища для локации
    const levels = await db.all(`
      SELECT level, capacity, upgrade_cost, currency_type 
      FROM storage_upgrade_levels 
      WHERE location_id = ? 
      ORDER BY level
    `, [locationId]);
    
    res.json(levels);
  } catch (error) {
    console.error('Ошибка при получении уровней хранилища:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить информацию о накопленной прибыли помощников
app.get('/api/player/helpers/pending-income', async (req, res) => {
  try {
    const { userId } = req;
    
    // Сначала рассчитываем текущую прибыль, но не обновляем время последнего входа
    await calculateHelperIncome(userId, false);
    
    // Получаем информацию о накопленной прибыли
    const pendingIncome = await db.all(`
      SELECT currency_id, amount
      FROM player_pending_income
      WHERE user_id = ?
    `, [userId]);
    
    // Получаем информацию о максимальной вместимости склада для каждой валюты
    const storageCapacity = {
      '1': 10000, // Лес - 10000 единиц
      '5': 100000 // Основная валюта - 100000 единиц
    };
    
    // Получаем текущее количество валют у игрока
    const playerCurrencies = await db.all(`
      SELECT currency_id, amount
      FROM player_currencies
      WHERE user_id = ?
    `, [userId]);
    
    // Создаем карту текущих валют игрока
    const currencyMap = {};
    playerCurrencies.forEach(currency => {
      currencyMap[currency.currency_id] = parseFloat(currency.amount);
    });
    
    // Формируем ответ с информацией о прибыли и ограничениях
    const result = pendingIncome.map(income => {
      const currencyId = income.currency_id;
      const pendingAmount = parseFloat(income.amount);
      const currentAmount = currencyMap[currencyId] || 0;
      const capacity = storageCapacity[currencyId] || 10000;
      const availableSpace = Math.max(0, capacity - currentAmount);
      
      return {
        currency_id: currencyId,
        pending_amount: pendingAmount,
        current_amount: currentAmount,
        capacity: capacity,
        available_space: availableSpace,
        can_collect_all: availableSpace >= pendingAmount
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении информации о накопленной прибыли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Собрать накопленную прибыль помощников
app.post('/api/player/helpers/collect-income', async (req, res) => {
  try {
    const { userId } = req;
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    // Получаем накопленную прибыль
    const pendingIncome = await db.all(`
      SELECT currency_id, amount
      FROM player_pending_income
      WHERE user_id = ?
    `, [userId]);
    
    if (pendingIncome.length === 0) {
      await db.run('COMMIT');
      return res.json({ collected: [] });
    }
    
    // Получаем информацию о максимальной вместимости склада для каждой валюты
    const storageCapacity = {
      '1': 10000, // Лес - 10000 единиц
      '5': 100000 // Основная валюта - 100000 единиц
    };
    
    try {
      const collectedResults = [];
      
      for (const income of pendingIncome) {
        const currencyId = income.currency_id;
        const pendingAmount = parseFloat(income.amount);
        
        // Получаем текущее количество валюты у игрока
        const playerCurrency = await db.get(`
          SELECT amount FROM player_currencies
          WHERE user_id = ? AND currency_id = ?
        `, [userId, currencyId]);
        
        const currentAmount = playerCurrency ? parseFloat(playerCurrency.amount) : 0;
        const capacity = storageCapacity[currencyId] || 10000;
        const availableSpace = Math.max(0, capacity - currentAmount);
        
        // Определяем, сколько можно собрать
        const amountToCollect = Math.min(pendingAmount, availableSpace);
        
        if (amountToCollect > 0) {
          // Обновляем количество валюты у игрока
          if (playerCurrency) {
            await db.run(`
              UPDATE player_currencies
              SET amount = amount + ?
              WHERE user_id = ? AND currency_id = ?
            `, [amountToCollect, userId, currencyId]);
          } else {
            await db.run(`
              INSERT INTO player_currencies (user_id, currency_id, amount)
              VALUES (?, ?, ?)
            `, [userId, currencyId, amountToCollect]);
          }
          
          // Уменьшаем накопленную прибыль
          if (amountToCollect >= pendingAmount) {
            // Если собрали всё, удаляем запись
            await db.run(`
              DELETE FROM player_pending_income
              WHERE user_id = ? AND currency_id = ?
            `, [userId, currencyId]);
          } else {
            // Если собрали часть, обновляем запись
            await db.run(`
              UPDATE player_pending_income
              SET amount = amount - ?
              WHERE user_id = ? AND currency_id = ?
            `, [amountToCollect, userId, currencyId]);
          }
          
          collectedResults.push({
            currency_id: currencyId,
            collected: amountToCollect,
            remaining: pendingAmount - amountToCollect,
            storage_full: amountToCollect < pendingAmount
          });
        } else {
          collectedResults.push({
            currency_id: currencyId,
            collected: 0,
            remaining: pendingAmount,
            storage_full: true
          });
        }
      }
      
      // Обновляем время последнего входа игрока при сборе прибыли
      await db.run(`
        UPDATE player_progress SET last_login = datetime('now') WHERE user_id = ?
      `, [userId]);
      console.log(`Обновлено время последнего входа для пользователя ${userId} при сборе прибыли`);
      
      // Фиксируем транзакцию
      await db.run('COMMIT');
      
      res.json({ collected: collectedResults });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при сборе накопленной прибыли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить информацию о валюте по строковому типу
app.get('/api/currencies/:currencyType', async (req, res) => {
  try {
    const { currencyType } = req.params;
    
    // Преобразуем строковый тип валюты в ID
    let currencyId;
    
    if (currencyType === 'FOREST') {
      currencyId = 1;
    } else if (currencyType === 'MAIN') {
      currencyId = 5;
    } else if (!isNaN(parseInt(currencyType))) {
      // Если передан числовой ID, используем его
      currencyId = parseInt(currencyType);
    } else {
      return res.status(400).json({ error: 'Неизвестный тип валюты' });
    }
    
    // Получаем информацию о валюте
    const currency = await db.get(`
      SELECT * FROM currencies WHERE id = ?
    `, [currencyId]);
    
    if (!currency) {
      return res.status(404).json({ error: 'Валюта не найдена' });
    }
    
    res.json(currency);
  } catch (error) {
    console.error('Ошибка при получении информации о валюте:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить инструменты игрока для персонажа
app.get('/api/player/characters/:id/tools', async (req, res) => {
  try {
    const { userId } = req;
    const characterId = req.params.id;
    
    console.log(`Получение инструментов игрока для персонажа ${characterId} пользователя ${userId}`);
    
    // Получаем инструменты персонажа
    const characterTools = await db.all(`
      SELECT 
        t.id, 
        t.name, 
        t.character_id, 
        t.power,
        t.unlock_level, 
        t.unlock_cost, 
        t.currency_id,
        t.image_path,
        t.main_coins_power,
        t.location_coins_power,
        c.code as currency_type
      FROM tools t
      LEFT JOIN currencies c ON t.currency_id = c.id
      JOIN player_tools pt ON t.id = pt.tool_id
      WHERE t.character_id = ? AND pt.user_id = ?
    `, [characterId, userId]);
    
    console.log(`Найдено ${characterTools.length} инструментов игрока`);
    
    // Получаем текущий экипированный инструмент
    const equippedTool = await db.get(`
      SELECT tool_id FROM player_equipped_tools 
      WHERE user_id = ? AND character_id = ?
    `, [userId, characterId]);
    
    const equippedToolId = equippedTool ? equippedTool.tool_id : null;
    console.log(`Экипированный инструмент: ${equippedToolId}`);
    
    // Преобразуем результаты для клиента
    const formattedTools = characterTools.map(tool => {
      // Добавляем флаг, указывающий, экипирован ли инструмент
      const is_equipped = tool.id === equippedToolId;
      
      return {
        id: tool.id,
        name: tool.name,
        characterId: tool.character_id,
        power: tool.power,
        unlockLevel: tool.unlock_level,
        unlockCost: tool.unlock_cost,
        currencyId: tool.currency_id,
        currencyType: tool.currency_type,
        imagePath: tool.image_path,
        mainCoinsPower: tool.main_coins_power,
        locationCoinsPower: tool.location_coins_power,
        is_unlocked: true, // Всегда true, так как это уже разблокированные инструменты
        is_equipped: is_equipped,
        can_equip: !is_equipped
      };
    });
    
    console.log(`Отправка инструментов игрока: ${JSON.stringify(formattedTools)}`);
    res.json(formattedTools);
  } catch (error) {
    console.error('Ошибка при получении инструментов игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить профиль игрока
app.get('/api/player/profile', async (req, res) => {
  try {
    const { userId } = req;
    
    // Получаем основную информацию о прогрессе игрока
    const playerProgress = await db.get(`
      SELECT level FROM player_progress WHERE user_id = ?
    `, [userId]);
    
    if (!playerProgress) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }
    
    // Получаем или создаем профиль игрока
    let playerProfile = await db.get(`
      SELECT * FROM player_profile WHERE user_id = ?
    `, [userId]);
    
    // Если профиля нет, создаем его с базовыми значениями
    if (!playerProfile) {
      // По умолчанию используем ранг 1 (Бронза I)
      await db.run(`
        INSERT INTO player_profile (user_id, current_rank_id, highest_rank_id, avatar_path, total_points)
        VALUES (?, 1, 1, '/assets/avatars/default.png', 0)
      `, [userId]);
      
      playerProfile = {
        user_id: userId,
        current_rank_id: 1,
        highest_rank_id: 1,
        featured_achievement_id: null,
        avatar_path: '/assets/avatars/default.png',
        total_points: 0
      };
    }
    
    // Получаем информацию о текущем ранге
    const currentRank = await db.get(`
      SELECT id, name, image_path FROM ranks WHERE id = ?
    `, [playerProfile.current_rank_id || 1]);
    
    // Получаем информацию о наивысшем ранге
    const highestRank = await db.get(`
      SELECT id, name, image_path FROM ranks WHERE id = ?
    `, [playerProfile.highest_rank_id || 1]);
    
    // Получаем информацию о текущем сезоне
    const currentSeason = await db.get(`
      SELECT * FROM seasons WHERE is_active = 1 OR (CURRENT_TIMESTAMP BETWEEN start_date AND end_date)
      ORDER BY start_date DESC LIMIT 1
    `);
    
    // Получаем информацию о сезонном прогрессе игрока
    let seasonPoints = 0;
    let seasonRankId = 1;
    
    if (currentSeason) {
      const playerSeason = await db.get(`
        SELECT points, rank_id FROM player_season 
        WHERE user_id = ? AND season_id = ?
      `, [userId, currentSeason.id]);
      
      if (playerSeason) {
        seasonPoints = playerSeason.points;
        seasonRankId = playerSeason.rank_id;
      } else {
        // Если записи о сезоне для игрока нет, создаем её
        await db.run(`
          INSERT INTO player_season (user_id, season_id, points, rank_id, highest_rank_id)
          VALUES (?, ?, 0, 1, 1)
        `, [userId, currentSeason.id]);
      }
    }
    
    // Получаем информацию о последнем достижении
    let featuredAchievement = null;
    
    if (playerProfile.featured_achievement_id) {
      // Если в профиле указано избранное достижение, получаем его
      const achievement = await db.get(`
        SELECT a.*, pa.date_unlocked
        FROM achievements a
        JOIN player_achievements pa ON a.id = pa.achievement_id
        WHERE a.id = ? AND pa.user_id = ?
      `, [playerProfile.featured_achievement_id, userId]);
      
      if (achievement) {
        featuredAchievement = {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          imagePath: achievement.image_path,
          dateUnlocked: achievement.date_unlocked
        };
      }
    } else {
      // Иначе получаем последнее разблокированное достижение
      const lastAchievement = await db.get(`
        SELECT a.*, pa.date_unlocked
        FROM achievements a
        JOIN player_achievements pa ON a.id = pa.achievement_id
        WHERE pa.user_id = ?
        ORDER BY pa.date_unlocked DESC
        LIMIT 1
      `, [userId]);
      
      if (lastAchievement) {
        featuredAchievement = {
          id: lastAchievement.id,
          name: lastAchievement.name,
          description: lastAchievement.description,
          imagePath: lastAchievement.image_path,
          dateUnlocked: lastAchievement.date_unlocked
        };
      }
    }
    
    // Рассчитываем количество дней до конца сезона
    let daysLeft = 0;
    if (currentSeason) {
      const endDate = new Date(currentSeason.end_date);
      const now = new Date();
      daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    // Формируем ответ
    const response = {
      userId,
      username: `Игрок ${userId.substring(0, 6)}`, // Простая генерация имени из ID
      avatar: playerProfile.avatar_path || '/assets/avatars/default.png',
      level: playerProgress.level,
      currentRank: currentRank ? {
        id: currentRank.id,
        name: currentRank.name,
        imagePath: currentRank.image_path
      } : {
        id: 1,
        name: 'Бронза I',
        imagePath: '/assets/ranks/bronze_1.png'
      },
      highestRank: highestRank ? {
        id: highestRank.id,
        name: highestRank.name,
        imagePath: highestRank.image_path
      } : {
        id: 1,
        name: 'Бронза I',
        imagePath: '/assets/ranks/bronze_1.png'
      },
      currentSeason: currentSeason ? {
        id: currentSeason.id,
        name: currentSeason.name,
        endDate: currentSeason.end_date,
        daysLeft
      } : null,
      seasonPoints,
      featuredAchievement
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка при получении профиля игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить ранг игрока в сезоне
app.post('/api/player/update-rank', async (req, res) => {
  try {
    const { userId } = req;
    const { seasonId } = req.body;
    
    if (!seasonId) {
      return res.status(400).json({ error: 'Не указан ID сезона' });
    }
    
    // Получаем текущий сезон, если ID не указан
    let actualSeasonId = seasonId;
    if (!actualSeasonId) {
      const currentSeason = await db.get(`
        SELECT id FROM seasons WHERE is_active = 1
        OR (CURRENT_TIMESTAMP BETWEEN start_date AND end_date)
        ORDER BY start_date DESC LIMIT 1
      `);
      
      if (!currentSeason) {
        return res.status(404).json({ error: 'Активный сезон не найден' });
      }
      
      actualSeasonId = currentSeason.id;
    }
    
    // Получаем текущие очки игрока в сезоне
    const playerSeason = await db.get(`
      SELECT points, rank_id, highest_rank_id FROM player_season
      WHERE user_id = ? AND season_id = ?
    `, [userId, actualSeasonId]);
    
    if (!playerSeason) {
      return res.status(404).json({ error: 'Прогресс игрока в сезоне не найден' });
    }
    
    // Получаем все ранги
    const ranks = await db.all(`
      SELECT id, name, min_points, image_path FROM ranks
      ORDER BY min_points ASC
    `);
    
    if (!ranks || ranks.length === 0) {
      return res.status(404).json({ error: 'Ранги не найдены' });
    }
    
    // Определяем текущий ранг на основе очков
    let newRankId = 1; // По умолчанию первый ранг
    let newRank = ranks[0];
    
    for (const rank of ranks) {
      if (playerSeason.points >= rank.min_points) {
        newRankId = rank.id;
        newRank = rank;
      } else {
        break;
      }
    }
    
    // Если ранг изменился, обновляем его
    if (newRankId !== playerSeason.rank_id) {
      // Обновляем текущий ранг
      await db.run(`
        UPDATE player_season
        SET rank_id = ?
        WHERE user_id = ? AND season_id = ?
      `, [newRankId, userId, actualSeasonId]);
      
      // Если новый ранг выше предыдущего максимального, обновляем и его
      if (newRankId > playerSeason.highest_rank_id) {
        await db.run(`
          UPDATE player_season
          SET highest_rank_id = ?
          WHERE user_id = ? AND season_id = ?
        `, [newRankId, userId, actualSeasonId]);
        
        // Обновляем также в профиле игрока
        await db.run(`
          UPDATE player_profile
          SET current_rank_id = ?, highest_rank_id = ?
          WHERE user_id = ?
        `, [newRankId, newRankId, userId]);
        
        // Проверяем достижение "Мастер ранга" (достичь ранга Золото I)
        if (newRankId >= 5) { // ID 5 соответствует рангу "Золото I"
          const achievementExists = await db.get(`
            SELECT 1 FROM player_achievements
            WHERE user_id = ? AND achievement_id = 4
          `, [userId]);
          
          if (!achievementExists) {
            // Добавляем достижение
            await db.run(`
              INSERT INTO player_achievements (user_id, achievement_id, date_unlocked, is_claimed)
              VALUES (?, 4, CURRENT_TIMESTAMP, 0)
            `, [userId]);
            
            // Обновляем избранное достижение в профиле
            await db.run(`
              UPDATE player_profile
              SET featured_achievement_id = 4
              WHERE user_id = ?
            `, [userId]);
            
            // Возвращаем информацию о достижении
            const achievement = await db.get(`
              SELECT * FROM achievements WHERE id = 4
            `);
            
            if (achievement) {
              // Выдаем награду за достижение
              if (achievement.reward_type === 'coins' && achievement.reward_value > 0) {
                await getOrCreatePlayerCurrency(userId, 5); // ID 5 - сад-коины
                await db.run(`
                  UPDATE player_currencies
                  SET amount = amount + ?
                  WHERE user_id = ? AND currency_id = 5
                `, [achievement.reward_value, userId]);
              }
            }
          }
        }
      } else {
        // Обновляем только текущий ранг в профиле
        await db.run(`
          UPDATE player_profile
          SET current_rank_id = ?
          WHERE user_id = ?
        `, [newRankId, userId]);
      }
      
      // Возвращаем информацию о новом ранге
      res.json({
        success: true,
        rankChanged: true,
        previousRankId: playerSeason.rank_id,
        newRank: {
          id: newRank.id,
          name: newRank.name,
          imagePath: newRank.image_path,
          minPoints: newRank.min_points
        }
      });
    } else {
      // Ранг не изменился
      res.json({
        success: true,
        rankChanged: false,
        currentRank: {
          id: newRank.id,
          name: newRank.name,
          imagePath: newRank.image_path,
          minPoints: newRank.min_points
        }
      });
    }
  } catch (error) {
    console.error('Ошибка при обновлении ранга игрока:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить достижение
app.post('/api/player/unlock-achievement', async (req, res) => {
  try {
    const { userId } = req;
    const { achievementId } = req.body;
    
    if (!achievementId) {
      return res.status(400).json({ error: 'Не указан ID достижения' });
    }
    
    // Проверяем, существует ли достижение
    const achievement = await db.get(`
      SELECT * FROM achievements WHERE id = ?
    `, [achievementId]);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Достижение не найдено' });
    }
    
    // Проверяем, есть ли уже это достижение у игрока
    const existingAchievement = await db.get(`
      SELECT * FROM player_achievements
      WHERE user_id = ? AND achievement_id = ?
    `, [userId, achievementId]);
    
    if (existingAchievement) {
      return res.json({
        success: true,
        alreadyUnlocked: true,
        achievement: {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          imagePath: achievement.image_path,
          rewardValue: achievement.reward_value,
          dateUnlocked: existingAchievement.date_unlocked
        }
      });
    }
    
    // Добавляем достижение игроку
    await db.run(`
      INSERT INTO player_achievements (user_id, achievement_id, date_unlocked, is_claimed)
      VALUES (?, ?, CURRENT_TIMESTAMP, 0)
    `, [userId, achievementId]);
    
    // Обновляем избранное достижение в профиле
    await db.run(`
      UPDATE player_profile
      SET featured_achievement_id = ?
      WHERE user_id = ?
    `, [achievementId, userId]);
    
    // Выдаем награду за достижение
    if (achievement.reward_type === 'coins' && achievement.reward_value > 0) {
      await getOrCreatePlayerCurrency(userId, 5); // ID 5 - сад-коины
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = 5
      `, [achievement.reward_value, userId]);
    }
    
    // Возвращаем информацию о достижении
    res.json({
      success: true,
      alreadyUnlocked: false,
      achievement: {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        imagePath: achievement.image_path,
        rewardValue: achievement.reward_value,
        dateUnlocked: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при разблокировке достижения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Функция для проверки и выдачи достижений игроку
async function checkAndGrantAchievements(userId) {
  try {
    console.log(`Проверка достижений для пользователя ${userId}`);
    
    // Получаем все достижения из базы данных
    const allAchievements = await db.all('SELECT * FROM achievements');
    
    // Получаем список уже полученных достижений пользователя
    const userAchievements = await db.all(
      'SELECT achievement_id FROM player_achievements WHERE user_id = ?',
      [userId]
    );
    
    // Создаем множество ID уже полученных достижений для быстрой проверки
    const userAchievementIds = new Set(userAchievements.map(a => a.achievement_id));
    
    // Получаем данные о прогрессе пользователя
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    // Получаем профиль пользователя
    const playerProfile = await db.get(
      'SELECT * FROM player_profile WHERE user_id = ?',
      [userId]
    );
    
    // Получаем данные о сезонах пользователя
    const playerSeasons = await db.all(
      'SELECT DISTINCT season_id FROM player_season WHERE user_id = ?',
      [userId]
    );
    
    // Получаем данные о ежедневных входах
    const dailyLoginData = await getDailyLoginStreak(userId);
    
    // Проходим по каждому достижению и проверяем условия
    for (const achievement of allAchievements) {
      // Пропускаем, если достижение уже получено
      if (userAchievementIds.has(achievement.id)) {
        continue;
      }
      
      let conditionMet = false;
      
      // Проверяем условие в зависимости от типа достижения
      switch (achievement.condition_type) {
        case 'level':
          // Достижение за уровень
          conditionMet = playerProgress && playerProgress.level >= achievement.condition_value;
          break;
          
        case 'rank':
          // Достижение за ранг
          conditionMet = playerProfile && 
                         (playerProfile.current_rank_id >= achievement.condition_value || 
                          playerProfile.highest_rank_id >= achievement.condition_value);
          break;
          
        case 'seasons_participated':
          // Достижение за участие в сезонах
          conditionMet = playerSeasons && playerSeasons.length >= achievement.condition_value;
          break;
          
        case 'daily_streak':
          // Достижение за ежедневные входы
          conditionMet = dailyLoginData && dailyLoginData.currentStreak >= achievement.condition_value;
          break;
          
        case 'days_inactive':
          // Достижение за возвращение после перерыва
          conditionMet = dailyLoginData && dailyLoginData.daysInactive >= achievement.condition_value;
          break;
          
        case 'taps':
          // Достижение за количество тапов
          const tapCount = await getTotalTapCount(userId);
          conditionMet = tapCount >= achievement.condition_value;
          break;
          
        case 'helpers_count':
          // Достижение за количество помощников
          const helpersCount = await getActiveHelpersCount(userId);
          conditionMet = helpersCount >= achievement.condition_value;
          break;
          
        case 'storage_level':
          // Достижение за уровень хранилища
          const maxStorageLevel = await getMaxStorageLevel(userId);
          conditionMet = maxStorageLevel >= achievement.condition_value;
          break;
          
        // Можно добавить другие типы достижений
        default:
          console.log(`Неизвестный тип достижения: ${achievement.condition_type}`);
          break;
      }
      
      // Если условие выполнено, выдаем достижение
      if (conditionMet) {
        console.log(`Выдаем достижение ${achievement.id} (${achievement.name}) пользователю ${userId}`);
        
        try {
          await db.run(
            'INSERT INTO player_achievements (user_id, achievement_id, date_unlocked) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [userId, achievement.id]
          );
          
          // Отправляем уведомление о получении достижения
          await sendAchievementNotification(userId, achievement);
          
        } catch (error) {
          // Обрабатываем ошибку дублирования (если достижение уже было выдано)
          if (error.message.includes('UNIQUE constraint failed')) {
            console.log(`Достижение ${achievement.id} уже было выдано пользователю ${userId}`);
          } else {
            throw error;
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Ошибка при проверке достижений: ${error.message}`);
    return false;
  }
}

// Функция для получения данных о ежедневных входах пользователя
async function getDailyLoginStreak(userId) {
  try {
    // Получаем данные о последнем входе пользователя
    const playerProgress = await getOrCreatePlayerProgress(userId);
    
    if (!playerProgress || !playerProgress.last_login) {
      return { currentStreak: 0, daysInactive: 0 };
    }
    
    // Получаем историю входов пользователя (если есть такая таблица)
    // Если нет, можно создать или использовать другую логику
    let loginHistory;
    try {
      loginHistory = await db.all(
        'SELECT login_date FROM player_login_history WHERE user_id = ? ORDER BY login_date DESC',
        [userId]
      );
    } catch (error) {
      // Если таблицы нет, создаем пустой массив
      loginHistory = [];
    }
    
    const now = new Date();
    const lastLogin = new Date(playerProgress.last_login);
    
    // Вычисляем количество дней неактивности
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysInactive = Math.floor((now - lastLogin) / msPerDay);
    
    // Если нет истории входов, используем только last_login
    if (!loginHistory || loginHistory.length === 0) {
      // Если вход был сегодня или вчера, считаем streak = 1
      if (daysInactive <= 1) {
        return { currentStreak: 1, daysInactive };
      } else {
        return { currentStreak: 0, daysInactive };
      }
    }
    
    // Вычисляем текущий streak на основе истории входов
    let currentStreak = 1;
    let prevDate = new Date(loginHistory[0].login_date);
    
    for (let i = 1; i < loginHistory.length; i++) {
      const currentDate = new Date(loginHistory[i].login_date);
      const dayDiff = Math.floor((prevDate - currentDate) / msPerDay);
      
      if (dayDiff === 1) {
        // Последовательные дни
        currentStreak++;
      } else if (dayDiff > 1) {
        // Разрыв в последовательности
        break;
      }
      
      prevDate = currentDate;
    }
    
    return { currentStreak, daysInactive };
  } catch (error) {
    console.error(`Ошибка при получении данных о входах: ${error.message}`);
    return { currentStreak: 0, daysInactive: 0 };
  }
}

// Функция для получения общего количества тапов пользователя
async function getTotalTapCount(userId) {
  try {
    // Проверяем, существует ли таблица player_stats
    let hasTable = false;
    try {
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='player_stats'"
      );
      hasTable = !!tableCheck;
    } catch (error) {
      hasTable = false;
    }
    
    // Если таблица существует, получаем количество тапов
    if (hasTable) {
      const stats = await db.get(
        'SELECT total_taps FROM player_stats WHERE user_id = ?',
        [userId]
      );
      
      return stats ? stats.total_taps : 0;
    }
    
    // Если таблицы нет, возвращаем 0
    return 0;
  } catch (error) {
    console.error(`Ошибка при получении количества тапов: ${error.message}`);
    return 0;
  }
}

// Функция для получения количества активных помощников
async function getActiveHelpersCount(userId) {
  try {
    const helpers = await db.all(
      'SELECT COUNT(*) as count FROM player_helpers WHERE user_id = ?',
      [userId]
    );
    
    return helpers && helpers[0] ? helpers[0].count : 0;
  } catch (error) {
    console.error(`Ошибка при получении количества помощников: ${error.message}`);
    return 0;
  }
}

// Функция для получения максимального уровня хранилища
async function getMaxStorageLevel(userId) {
  try {
    const storages = await db.all(
      'SELECT MAX(storage_level) as max_level FROM player_storage_limits WHERE user_id = ?',
      [userId]
    );
    
    return storages && storages[0] && storages[0].max_level ? storages[0].max_level : 0;
  } catch (error) {
    console.error(`Ошибка при получении уровня хранилища: ${error.message}`);
    return 0;
  }
}

// Функция для создания таблицы истории входов, если её нет
async function ensureLoginHistoryTable() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='player_login_history'"
    );
    
    if (!tableExists) {
      console.log('Создаем таблицу истории входов player_login_history');
      
      // Создаем таблицу для хранения истории входов
      await db.run(`
        CREATE TABLE IF NOT EXISTS player_login_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          login_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, login_date)
        )
      `);
      
      // Создаем индекс для быстрого поиска
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_player_login_history_user_id 
        ON player_login_history (user_id)
      `);
      
      console.log('Таблица player_login_history успешно создана');
    }
  } catch (error) {
    console.error(`Ошибка при создании таблицы истории входов: ${error.message}`);
  }
}

// Функция для создания таблицы статистики игрока, если её нет
async function ensurePlayerStatsTable() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='player_stats'"
    );
    
    if (!tableExists) {
      console.log('Создаем таблицу статистики игрока player_stats');
      
      // Создаем таблицу для хранения статистики
      await db.run(`
        CREATE TABLE IF NOT EXISTS player_stats (
          user_id TEXT PRIMARY KEY,
          total_taps INTEGER NOT NULL DEFAULT 0,
          total_resources_gained INTEGER NOT NULL DEFAULT 0,
          total_energy_spent INTEGER NOT NULL DEFAULT 0,
          last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('Таблица player_stats успешно создана');
    }
  } catch (error) {
    console.error(`Ошибка при создании таблицы статистики игрока: ${error.message}`);
  }
}

// Функция для обновления истории входов пользователя
async function updateLoginHistory(userId) {
  try {
    // Проверяем, была ли запись о входе сегодня
    const today = new Date().toISOString().split('T')[0]; // Получаем только дату в формате YYYY-MM-DD
    
    // Проверяем, есть ли запись за сегодня
    const todayLogin = await db.get(
      "SELECT id FROM player_login_history WHERE user_id = ? AND date(login_date) = date(?)",
      [userId, today]
    );
    
    // Если записи за сегодня нет, добавляем новую
    if (!todayLogin) {
      await db.run(
        'INSERT INTO player_login_history (user_id, login_date) VALUES (?, CURRENT_TIMESTAMP)',
        [userId]
      );
      
      console.log(`Добавлена запись о входе пользователя ${userId} за ${today}`);
      
      // Обновляем last_login в player_progress
      await db.run(
        'UPDATE player_progress SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
        [userId]
      );
      
      // Проверяем достижения после обновления истории входов
      await checkAndGrantAchievements(userId);
    }
  } catch (error) {
    console.error(`Ошибка при обновлении истории входов: ${error.message}`);
  }
}

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
    
    for (let i = ranks.length - 1; i >= 0; i--) {
      if (points >= ranks[i].min_points) {
        newRankId = ranks[i].id;
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
      'UPDATE player_season SET points = ?, rank_id = ?, highest_rank_id = ? WHERE user_id = ? AND season_id = ?',
      [points, newRankId, newHighestRank, userId, seasonId]
    );
    
    // Обновляем профиль игрока
    await db.run(
      'UPDATE player_profile SET current_rank_id = ?, highest_rank_id = ? WHERE user_id = ?',
      [newRankId, newHighestRank, userId]
    );
    
    // Если ранг изменился, проверяем достижения
    if (rankChanged || newHighestRank > currentPlayerSeason.highest_rank_id) {
      await checkAndGrantAchievements(userId);
    }
    
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

// Функция для обновления статистики тапов
async function updateTapStats(userId, resourcesGained = 0, energySpent = 1) {
  try {
    // Проверяем, существует ли запись для пользователя
    const userStats = await db.get(
      'SELECT * FROM player_stats WHERE user_id = ?',
      [userId]
    );
    
    if (userStats) {
      // Обновляем существующую запись
      await db.run(
        `UPDATE player_stats 
         SET total_taps = total_taps + 1, 
             total_resources_gained = total_resources_gained + ?, 
             total_energy_spent = total_energy_spent + ?,
             last_updated = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [resourcesGained, energySpent, userId]
      );
    } else {
      // Создаем новую запись
      await db.run(
        `INSERT INTO player_stats 
         (user_id, total_taps, total_resources_gained, total_energy_spent) 
         VALUES (?, 1, ?, ?)`,
        [userId, resourcesGained, energySpent]
      );
    }
    
    // Проверяем достижения после обновления статистики тапов
    await checkAndGrantAchievements(userId);
  } catch (error) {
    console.error(`Ошибка при обновлении статистики тапов: ${error.message}`);
  }
}

// Функция для отправки уведомления о получении достижения
async function sendAchievementNotification(userId, achievement) {
  try {
    console.log(`Отправка уведомления о достижении ${achievement.id} (${achievement.name}) для пользователя ${userId}`);
    
    // Получаем текущие данные игрока
    const playerProfile = await db.get('SELECT * FROM player_profile WHERE user_id = ?', [userId]);
    
    // Всегда обновляем профиль с последним полученным достижением
    await db.run(
      'UPDATE player_profile SET featured_achievement_id = ? WHERE user_id = ?',
      [achievement.id, userId]
    );
    
    console.log(`Установлено достижение ${achievement.id} как последнее полученное для пользователя ${userId}`);
    
    // Создаем запись в таблице уведомлений
    try {
      const tableExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='player_notifications'"
      );
      
      if (tableExists) {
        await db.run(
          `INSERT INTO player_notifications 
           (user_id, type, title, message, related_id, image_path, is_read, created_at) 
           VALUES (?, 'achievement', ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
          [userId, 'Новое достижение!', `Вы получили достижение "${achievement.name}"`, achievement.id, achievement.image_path]
        );
        
        console.log(`Уведомление о достижении ${achievement.id} добавлено в базу`);
      }
    } catch (error) {
      // Если таблицы нет или возникла ошибка, логируем её
      console.log(`Ошибка при создании уведомления: ${error.message}`);
    }
    
    // Создаем поздравление с достижением для отображения плашки
    await createAchievementCongratulation(userId, achievement);
    
    return true;
  } catch (error) {
    console.error(`Ошибка при отправке уведомления о достижении: ${error.message}`);
    return false;
  }
}

// Функция для создания таблицы уведомлений, если её нет
async function ensureNotificationsTable() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='player_notifications'"
    );
    
    if (!tableExists) {
      console.log('Создаем таблицу уведомлений player_notifications');
      
      // Создаем таблицу для хранения уведомлений
      await db.run(`
        CREATE TABLE IF NOT EXISTS player_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          related_id INTEGER,
          image_path TEXT,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          read_at TEXT
        )
      `);
      
      // Создаем индекс для быстрого поиска
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_player_notifications_user_id 
        ON player_notifications (user_id)
      `);
      
      console.log('Таблица player_notifications успешно создана');
    }
  } catch (error) {
    console.error(`Ошибка при создании таблицы уведомлений: ${error.message}`);
  }
}

// Функция для создания поздравления с достижением
async function createAchievementCongratulation(userId, achievement) {
  try {
    // Проверяем, существует ли таблица поздравлений
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='achievement_congratulations'"
    );
    
    // Если таблицы нет, создаем её
    if (!tableExists) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS achievement_congratulations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          achievement_id INTEGER NOT NULL,
          achievement_name TEXT NOT NULL,
          achievement_description TEXT NOT NULL,
          image_path TEXT NOT NULL,
          is_shown INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          shown_at TEXT,
          UNIQUE(user_id, achievement_id)
        )
      `);
      
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_achievement_congratulations_user_id 
        ON achievement_congratulations (user_id)
      `);
      
      console.log('Таблица achievement_congratulations успешно создана');
    }
    
    // Добавляем запись о поздравлении
    try {
      await db.run(`
        INSERT INTO achievement_congratulations 
        (user_id, achievement_id, achievement_name, achievement_description, image_path) 
        VALUES (?, ?, ?, ?, ?)
      `, [userId, achievement.id, achievement.name, achievement.description, achievement.image_path]);
      
      console.log(`Создано поздравление с достижением ${achievement.id} для пользователя ${userId}`);
    } catch (error) {
      // Если запись уже существует, обновляем её
      if (error.message.includes('UNIQUE constraint failed')) {
        await db.run(`
          UPDATE achievement_congratulations 
          SET is_shown = 0, created_at = CURRENT_TIMESTAMP, shown_at = NULL 
          WHERE user_id = ? AND achievement_id = ?
        `, [userId, achievement.id]);
        
        console.log(`Обновлено поздравление с достижением ${achievement.id} для пользователя ${userId}`);
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Ошибка при создании поздравления с достижением: ${error.message}`);
    return false;
  }
}

// Функция для создания таблицы поздравлений, если её нет
async function ensureAchievementCongratulationsTable() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='achievement_congratulations'"
    );
    
    if (!tableExists) {
      console.log('Создаем таблицу поздравлений achievement_congratulations');
      
      // Создаем таблицу для хранения поздравлений
      await db.run(`
        CREATE TABLE IF NOT EXISTS achievement_congratulations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          achievement_id INTEGER NOT NULL,
          achievement_name TEXT NOT NULL,
          achievement_description TEXT NOT NULL,
          image_path TEXT NOT NULL,
          is_shown INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          shown_at TEXT,
          UNIQUE(user_id, achievement_id)
        )
      `);
      
      // Создаем индекс для быстрого поиска
      await db.run(`
        CREATE INDEX IF NOT EXISTS idx_achievement_congratulations_user_id 
        ON achievement_congratulations (user_id)
      `);
      
      console.log('Таблица achievement_congratulations успешно создана');
    }
  } catch (error) {
    console.error(`Ошибка при создании таблицы поздравлений: ${error.message}`);
  }
}

// Функция для обновления профиля с последним полученным достижением
async function updateProfileWithLatestAchievement(userId) {
  try {
    console.log(`Обновление профиля пользователя ${userId} с последним достижением`);
    
    // Получаем последнее достижение пользователя
    const latestAchievement = await db.get(`
      SELECT achievement_id 
      FROM player_achievements 
      WHERE user_id = ? 
      ORDER BY date_unlocked DESC 
      LIMIT 1
    `, [userId]);
    
    if (!latestAchievement) {
      console.log(`У пользователя ${userId} нет достижений`);
      return false;
    }
    
    // Обновляем профиль
    await db.run(`
      UPDATE player_profile 
      SET featured_achievement_id = ? 
      WHERE user_id = ?
    `, [latestAchievement.achievement_id, userId]);
    
    console.log(`Профиль пользователя ${userId} обновлен с последним достижением ${latestAchievement.achievement_id}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при обновлении профиля с последним достижением: ${error.message}`);
    return false;
  }
}