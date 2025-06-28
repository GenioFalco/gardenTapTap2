const { db, CurrencyType, RewardType, getCurrencyIdByType, getOrCreatePlayerCurrency } = require('./db');

// Промисифицируем запросы к базе данных
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
};

const getOne = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const getAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Получение или создание прогресса игрока
const getOrCreatePlayerProgress = async (userId) => {
  try {
    // Проверяем, существует ли запись для этого пользователя
    const progress = await getOne(
      'SELECT * FROM player_progress WHERE user_id = ?',
      [userId]
    );
    
    // Если нет, создаем новую запись
    if (!progress) {
      // Добавляем запись о прогрессе
      await runQuery(
        'INSERT INTO player_progress (user_id) VALUES (?)',
        [userId]
      );
      
      // Добавляем начальные валюты
      await runQuery(
        'INSERT INTO player_currencies (user_id, currency_id, amount) VALUES (?, ?, ?)',
        [userId, CurrencyType.MAIN, 0]
      );
      
      await runQuery(
        'INSERT INTO player_currencies (user_id, currency_id, amount) VALUES (?, ?, ?)',
        [userId, CurrencyType.FOREST, 0]
      );
      
      // Разблокируем первую локацию
      await runQuery(
        'INSERT INTO player_locations (user_id, location_id) VALUES (?, ?)',
        [userId, 1]
      );
      
      // Разблокируем первый инструмент
      await runQuery(
        'INSERT INTO player_tools (user_id, tool_id) VALUES (?, ?)',
        [userId, 1]
      );
      
      // Экипируем первый инструмент
      await runQuery(
        'INSERT INTO player_equipped_tools (user_id, character_id, tool_id) VALUES (?, ?, ?)',
        [userId, 1, 1]
      );
      
      // Получаем созданный прогресс
      return await getOne(
        'SELECT * FROM player_progress WHERE user_id = ?',
        [userId]
      );
    }
    
    return progress;
  } catch (error) {
    console.error('Ошибка при получении/создании прогресса игрока:', error);
    throw error;
  }
};

// API функции
const api = {
  // Получить все локации
  getLocations: async () => {
    return await getAll(`
      SELECT 
        id, name, background,
        character_id as characterId, unlock_level as unlockLevel,
        unlock_cost as unlockCost, currency_id as currencyId
      FROM locations
    `);
  },
  
  // Получить разблокированные локации игрока
  getUnlockedLocations: async (userId) => {
    return await getAll(`
      SELECT 
        l.id, l.name, l.background,
        l.character_id as characterId, l.unlock_level as unlockLevel,
        l.unlock_cost as unlockCost, l.currency_id as currencyId
      FROM locations l
      JOIN player_locations pl ON l.id = pl.location_id
      WHERE pl.user_id = ?
    `, [userId]);
  },
  
  // Получить персонажа по ID
  getCharacterById: async (id) => {
    return await getOne(`
      SELECT 
        id, name, animation_type as animationType, 
        animation_path as animationPath, frame_count as frameCount
      FROM characters
      WHERE id = ?
    `, [id]);
  },
  
  // Получить инструменты для персонажа
  getToolsByCharacterId: async (characterId) => {
    return await getAll(`
      SELECT 
        id, name, character_id as characterId, power,
        unlock_level as unlockLevel, unlock_cost as unlockCost,
        currency_id as currencyId, image_path as imagePath,
        main_coins_power as mainCoinsPower, location_coins_power as locationCoinsPower
      FROM tools
      WHERE character_id = ?
    `, [characterId]);
  },
  
  // Получить разблокированные инструменты игрока для персонажа
  getUnlockedToolsByCharacterId: async (userId, characterId) => {
    return await getAll(`
      SELECT 
        t.id, t.name, t.character_id as characterId, t.power,
        t.unlock_level as unlockLevel, t.unlock_cost as unlockCost,
        t.currency_id as currencyId, t.image_path as imagePath,
        t.main_coins_power as mainCoinsPower, t.location_coins_power as locationCoinsPower
      FROM tools t
      JOIN player_tools pt ON t.id = pt.tool_id
      WHERE pt.user_id = ? AND t.character_id = ?
    `, [userId, characterId]);
  },
  
  // Получить экипированный инструмент для персонажа
  getEquippedTool: async (userId, characterId) => {
    return await getOne(`
      SELECT 
        t.id, t.name, t.character_id as characterId, t.power,
        t.unlock_level as unlockLevel, t.unlock_cost as unlockCost,
        t.currency_id as currencyId, t.image_path as imagePath,
        t.main_coins_power as mainCoinsPower, t.location_coins_power as locationCoinsPower
      FROM tools t
      JOIN player_equipped_tools pet ON t.id = pet.tool_id
      WHERE pet.user_id = ? AND pet.character_id = ?
    `, [userId, characterId]);
  },
  
  // Экипировать инструмент
  equipTool: async (userId, characterId, toolId) => {
    try {
      // Проверяем, разблокирован ли инструмент у игрока
      const result = await getOne(`
        SELECT COUNT(*) as count FROM player_tools
        WHERE user_id = ? AND tool_id = ?
      `, [userId, toolId]);
      
      const toolUnlocked = result && result.count > 0;
      if (!toolUnlocked) {
        return false;
      }
      
      // Обновляем экипированный инструмент
      await runQuery(`
        INSERT OR REPLACE INTO player_equipped_tools (user_id, character_id, tool_id)
        VALUES (?, ?, ?)
      `, [userId, characterId, toolId]);
      
      return true;
    } catch (error) {
      console.error('Ошибка при экипировке инструмента:', error);
      return false;
    }
  },
  
  // Получить прогресс игрока
  getPlayerProgress: async (userId) => {
    try {
      // Получаем или создаем прогресс
      await getOrCreatePlayerProgress(userId);
      
      // Получаем основной прогресс
      const progress = await getOne(`
        SELECT 
          level, experience, energy, max_energy as maxEnergy,
          last_energy_refill_time as lastEnergyRefillTime
        FROM player_progress
        WHERE user_id = ?
      `, [userId]);
      
      // Получаем валюты игрока
      const currencies = await getAll(`
        SELECT currency_id as currencyId, amount
        FROM player_currencies
        WHERE user_id = ?
      `, [userId]);
      
      // Получаем разблокированные локации
      const locationsResult = await getAll(`
        SELECT location_id
        FROM player_locations
        WHERE user_id = ?
      `, [userId]);
      
      const unlockedLocations = locationsResult.map(row => row.location_id);
      
      // Получаем разблокированные инструменты
      const toolsResult = await getAll(`
        SELECT tool_id
        FROM player_tools
        WHERE user_id = ?
      `, [userId]);
      
      const unlockedTools = toolsResult.map(row => row.tool_id);
      
      // Получаем экипированные инструменты
      const equippedToolsRows = await getAll(`
        SELECT character_id, tool_id
        FROM player_equipped_tools
        WHERE user_id = ?
      `, [userId]);
      
      const equippedTools = {};
      equippedToolsRows.forEach(row => {
        equippedTools[row.character_id] = row.tool_id;
      });
      
      return {
        ...progress,
        currencies,
        unlockedLocations,
        unlockedTools,
        equippedTools
      };
    } catch (error) {
      console.error('Ошибка при получении прогресса игрока:', error);
      throw error;
    }
  },
  
  // Обновить энергию игрока
  updatePlayerEnergy: async (userId, energy) => {
    try {
      await runQuery(`
        UPDATE player_progress
        SET energy = ?,
            last_energy_refill_time = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [energy, userId]);
    } catch (error) {
      console.error('Ошибка при обновлении энергии игрока:', error);
      throw error;
    }
  },
  
  // Добавить ресурсы игроку
  addResources: async (userId, currencyId, amount) => {
    try {
      // Преобразуем тип валюты в ID, если нужно
      const actualCurrencyId = typeof currencyId === 'number' ? currencyId : await getCurrencyIdByType(currencyId);
      
      if (!actualCurrencyId) {
        console.error('Неизвестный тип валюты:', currencyId);
        return;
      }
      
      // Получаем или создаем запись о валюте
      await getOrCreatePlayerCurrency(userId, actualCurrencyId);
      
      // Обновляем количество ресурсов
      await runQuery(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = ?
      `, [parseFloat(amount), userId, actualCurrencyId]);
    } catch (error) {
      console.error('Ошибка при добавлении ресурсов игроку:', error);
      throw error;
    }
  },
  
  // Получить количество ресурсов игрока
  getResourceAmount: async (userId, currencyId) => {
    try {
      // Преобразуем тип валюты в ID, если нужно
      const actualCurrencyId = typeof currencyId === 'number' ? currencyId : await getCurrencyIdByType(currencyId);
      
      if (!actualCurrencyId) {
        console.error('Неизвестный тип валюты:', currencyId);
        return 0;
      }
      
      const result = await getOne(`
        SELECT amount
        FROM player_currencies
        WHERE user_id = ? AND currency_id = ?
      `, [userId, actualCurrencyId]);
      
      return result ? parseFloat(result.amount) : 0;
    } catch (error) {
      console.error('Ошибка при получении ресурсов игрока:', error);
      return 0;
    }
  },
  
  // Потратить ресурсы
  spendResources: async (userId, currencyId, amount) => {
    try {
      // Преобразуем тип валюты в ID, если нужно
      const actualCurrencyId = typeof currencyId === 'number' ? currencyId : await getCurrencyIdByType(currencyId);
      
      if (!actualCurrencyId) {
        console.error('Неизвестный тип валюты:', currencyId);
        return false;
      }
      
      // Проверяем, достаточно ли ресурсов
      const currentAmount = await api.getResourceAmount(userId, actualCurrencyId);
      if (currentAmount < amount) {
        return false;
      }
      
      // Тратим ресурсы
      await runQuery(`
        UPDATE player_currencies
        SET amount = amount - ?
        WHERE user_id = ? AND currency_id = ?
      `, [parseFloat(amount), userId, actualCurrencyId]);
      
      return true;
    } catch (error) {
      console.error('Ошибка при трате ресурсов:', error);
      return false;
    }
  },
  
  // Разблокировать инструмент
  unlockTool: async (userId, toolId) => {
    try {
      await runQuery(`
        INSERT OR IGNORE INTO player_tools (user_id, tool_id)
        VALUES (?, ?)
      `, [userId, toolId]);
    } catch (error) {
      console.error('Ошибка при разблокировке инструмента:', error);
      throw error;
    }
  },
  
  // Разблокировать локацию
  unlockLocation: async (userId, locationId) => {
    try {
      await runQuery(`
        INSERT OR IGNORE INTO player_locations (user_id, location_id)
        VALUES (?, ?)
      `, [userId, locationId]);
    } catch (error) {
      console.error('Ошибка при разблокировке локации:', error);
      throw error;
    }
  },
  
  // Добавить опыт и повысить уровень если нужно
  addExperience: async (userId, exp) => {
    try {
      // Получаем текущий прогресс
      const progress = await getOne(`
        SELECT level, experience
        FROM player_progress
        WHERE user_id = ?
      `, [userId]);
      
      // Получаем информацию о текущем уровне
      const currentLevel = await getOne(`
        SELECT required_exp
        FROM levels
        WHERE level = ?
      `, [progress.level]);
      
      // Обновляем опыт
      let newExp = progress.experience + exp;
      let newLevel = progress.level;
      let levelUp = false;
      let rewards = [];
      
      // Проверяем, нужно ли повысить уровень
      while (true) {
        // Получаем следующий уровень
        const nextLevel = await getOne(`
          SELECT level, required_exp
          FROM levels
          WHERE level = ?
        `, [newLevel + 1]);
        
        // Если следующего уровня нет или опыта недостаточно - выходим из цикла
        if (!nextLevel || newExp < currentLevel.required_exp) break;
        
        // Повышаем уровень
        newLevel++;
        levelUp = true;
        
        // Получаем награды за новый уровень
        const levelRewards = await getAll(`
          SELECT id, level_id as levelId, reward_type as rewardType, amount, target_id as targetId
          FROM rewards
          WHERE level_id = ?
        `, [newLevel]);
        
        rewards = [...rewards, ...levelRewards];
        
        // Применяем награды
        for (const reward of levelRewards) {
          switch (reward.rewardType) {
            case RewardType.MAIN_CURRENCY:
              await api.addResources(userId, CurrencyType.MAIN, reward.amount);
              break;
            case RewardType.LOCATION_CURRENCY:
              // Здесь должна быть логика определения типа валюты локации
              break;
            case RewardType.UNLOCK_TOOL:
              if (reward.targetId) await api.unlockTool(userId, reward.targetId);
              break;
            case RewardType.UNLOCK_LOCATION:
              if (reward.targetId) await api.unlockLocation(userId, reward.targetId);
              break;
          }
        }
      }
      
      // Обновляем прогресс игрока в базе
      await runQuery(`
        UPDATE player_progress
        SET level = ?, experience = ?
        WHERE user_id = ?
      `, [newLevel, newExp, userId]);
      
      return { levelUp, level: newLevel, rewards };
    } catch (error) {
      console.error('Ошибка при добавлении опыта:', error);
      throw error;
    }
  },
  
  // Получить информацию об уровне
  getLevelInfo: async (level) => {
    try {
      const levelInfo = await getOne(`
        SELECT level, required_exp as requiredExp
        FROM levels
        WHERE level = ?
      `, [level]);
      
      const rewards = await getAll(`
        SELECT id, level_id as levelId, reward_type as rewardType, amount, target_id as targetId
        FROM rewards
        WHERE level_id = ?
      `, [level]);
      
      return { ...levelInfo, rewards };
    } catch (error) {
      console.error('Ошибка при получении информации об уровне:', error);
      throw error;
    }
  },
  
  // Тап по кнопке (основная механика)
  tap: async (userId, locationId) => {
    try {
      // Получаем прогресс игрока
      const progress = await api.getPlayerProgress(userId);
      
      // Проверяем, есть ли энергия
      if (progress.energy <= 0) {
        return { 
          resourcesGained: 0, 
          experienceGained: 0, 
          levelUp: false, 
          level: progress.level, 
          rewards: [],
          energyLeft: 0
        };
      }
      
      // Получаем локацию
      const location = await getOne(`
        SELECT character_id as characterId, currency_id as currencyId
        FROM locations
        WHERE id = ?
      `, [locationId]);
      
      // Получаем экипированный инструмент
      const tool = await api.getEquippedTool(userId, location.characterId);
      
      // Рассчитываем полученные ресурсы (сила инструмента)
      const resourcesGained = parseFloat(tool.power);
      
      // Рассчитываем полученный опыт (пока равен ресурсам)
      const experienceGained = resourcesGained;
      
      // Добавляем ресурсы
      await api.addResources(userId, location.currencyId, resourcesGained);
      
      // Добавляем опыт и проверяем повышение уровня
      const levelResult = await api.addExperience(userId, experienceGained);
      
      // Уменьшаем энергию
      const newEnergy = Math.max(0, progress.energy - 1);
      await api.updatePlayerEnergy(userId, newEnergy);
      
      return {
        resourcesGained,
        experienceGained,
        levelUp: levelResult.levelUp,
        level: levelResult.level,
        rewards: levelResult.rewards,
        energyLeft: newEnergy
      };
    } catch (error) {
      console.error('Ошибка при тапе:', error);
      throw error;
    }
  },
  
  // Улучшить инструмент (купить новый)
  upgradeTool: async (userId, toolId) => {
    try {
      // Получаем инструмент
      const tool = await getOne(`
        SELECT unlock_cost as unlockCost, currency_id as currencyId
        FROM tools
        WHERE id = ?
      `, [toolId]);
      
      // Проверяем, достаточно ли ресурсов
      if (!tool || !(await api.spendResources(userId, tool.currencyId, tool.unlockCost))) {
        return false;
      }
      
      // Разблокируем инструмент
      await api.unlockTool(userId, toolId);
      
      return true;
    } catch (error) {
      console.error('Ошибка при улучшении инструмента:', error);
      return false;
    }
  }
};

module.exports = api; 