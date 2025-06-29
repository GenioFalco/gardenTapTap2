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
    // Явно преобразуем строковые значения в числа с помощью parseFloat
    let locationCoinsPower = 1; // Базовое значение
    let mainCoinsPower = 0.5; // Базовое значение
    
    if (equipped) {
      locationCoinsPower = equipped.location_coins_power ? parseFloat(equipped.location_coins_power) : 1;
      mainCoinsPower = equipped.main_coins_power ? parseFloat(equipped.main_coins_power) : 0.5;
    }
    
    console.log(`Тап с инструментом: ${equipped ? equipped.name : 'базовый'}`);
    console.log(`Сила для валюты локации: ${locationCoinsPower}`);
    console.log(`Сила для основной валюты: ${mainCoinsPower}`);
    
    // Получаем ID валюты локации
    const locationCurrencyId = location.currency_id || '2';
    
    // Обновляем валюту локации - получаем или создаем запись и затем обновляем
    const locationCurrency = await getOrCreatePlayerCurrency(userId, locationCurrencyId);
    await db.run(`
      UPDATE player_currencies
      SET amount = amount + ?
      WHERE user_id = ? AND currency_id = ?
    `, [locationCoinsPower, userId, locationCurrency.currency_id]);
    
    console.log(`Добавлено ${locationCoinsPower} валюты ${locationCurrencyId} (ID: ${locationCurrency.currency_id})`);
    
    // Обновляем основную валюту (сад-коины)
    const mainCurrency = await getOrCreatePlayerCurrency(userId, '1');
    await db.run(`
      UPDATE player_currencies
      SET amount = amount + ?
      WHERE user_id = ? AND currency_id = ?
    `, [mainCoinsPower, userId, mainCurrency.currency_id]);
    
    console.log(`Добавлено ${mainCoinsPower} валюты с ID: ${mainCurrency.currency_id} (сад-коины)`);
    
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
  } catch (error) {
    console.error('Ошибка при проверке структуры таблицы player_progress:', error);
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
      SELECT level, capacity, upgrade_cost, currency_type 
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
    `, [userId, nextLevelInfo.currency_type]);
    
    const playerAmount = playerCurrency ? playerCurrency.amount : 0;
    const canUpgrade = playerAmount >= nextLevelInfo.upgrade_cost;
    
    res.json({
      currentLevel,
      nextLevel: nextLevelInfo.level,
      currentCapacity,
      nextCapacity: nextLevelInfo.capacity,
      upgradeCost: nextLevelInfo.upgrade_cost,
      currencyType: nextLevelInfo.currency_type,
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
      SELECT level, capacity, upgrade_cost, currency_type 
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
    const paymentCurrency = await db.get(`
      SELECT id FROM currencies 
      WHERE currency_type = ?
    `, [nextLevelInfo.currency_type]);
    
    const paymentCurrencyId = paymentCurrency ? paymentCurrency.id : nextLevelInfo.currency_type;
    
    console.log('Валюта для оплаты:', { 
      type: nextLevelInfo.currency_type, 
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