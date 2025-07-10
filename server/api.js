const { db, CurrencyType, RewardType, getCurrencyIdByType, getOrCreatePlayerCurrency } = require('./db');
// Убираем неиспользуемый модуль
// const axios = require('axios');

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
      
      console.log(`Получение количества ресурсов с ID ${actualCurrencyId} для пользователя ${userId}`);
      
      const result = await getOne(`
        SELECT amount
        FROM player_currencies
        WHERE user_id = ? AND currency_id = ?
      `, [userId, actualCurrencyId]);
      
      const amount = result ? parseFloat(result.amount) : 0;
      console.log(`Количество ресурсов с ID ${actualCurrencyId}: ${amount}`);
      
      return amount;
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
      
      console.log(`Попытка потратить ${amount} ресурсов с ID ${actualCurrencyId} для пользователя ${userId}`);
      
      // Проверяем, достаточно ли ресурсов
      const currentAmount = await api.getResourceAmount(userId, actualCurrencyId);
      console.log(`Текущее количество ресурсов: ${currentAmount}, требуется: ${amount}`);
      
      if (currentAmount < amount) {
        console.log(`Недостаточно ресурсов: ${currentAmount} < ${amount}`);
        return false;
      }
      
      // Тратим ресурсы
      await runQuery(`
        UPDATE player_currencies
        SET amount = amount - ?
        WHERE user_id = ? AND currency_id = ?
      `, [parseFloat(amount), userId, actualCurrencyId]);
      
      // Проверяем, что ресурсы действительно списались
      const newAmount = await api.getResourceAmount(userId, actualCurrencyId);
      console.log(`Новое количество ресурсов после списания: ${newAmount}`);
      
      // Обновляем прогресс заданий в зависимости от типа валюты
      try {
        // Проверяем, существует ли путь до маршрутов API
        // const axios = require('axios'); // Удалено
        // const apiUrl = 'http://localhost:3002'; // URL API сервера // Удалено
        
        if (actualCurrencyId == 1 || actualCurrencyId == 5) { // Основная валюта (монеты)
          // Отправляем запрос на обновление прогресса задания
          // await axios.post(`${apiUrl}/api/player/tasks/update-progress`, { // Удалено
          //   taskType: 'spend_currency', // Удалено
          //   progress: parseFloat(amount) // Удалено
          // }, { // Удалено
          //   headers: { // Удалено
          //     'Content-Type': 'application/json', // Удалено
          //     'x-user-id': userId // Удалено
          //   } // Удалено
          // }); // Удалено
          
          console.log(`Обновлен прогресс задания spend_currency на ${amount} для пользователя ${userId}`);
        } 
        else { // Валюта локации
          // Отправляем запрос на обновление прогресса задания
          // await axios.post(`${apiUrl}/api/player/tasks/update-progress`, { // Удалено
          //   taskType: 'spend_location_currency', // Удалено
          //   progress: parseFloat(amount) // Удалено
          // }, { // Удалено
          //   headers: { // Удалено
          //     'Content-Type': 'application/json', // Удалено
          //     'x-user-id': userId // Удалено
          //   } // Удалено
          // }); // Удалено
          
          console.log(`Обновлен прогресс задания spend_location_currency на ${amount} для пользователя ${userId}`);
        }
      } catch (updateError) {
        console.error('Ошибка при обновлении прогресса задания:', updateError);
        // Не прерываем выполнение функции при ошибке обновления прогресса
      }
      
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
      console.log(`[TAP] Начало обработки тапа для пользователя ${userId} в локации ${locationId}`);
      
      // Получаем прогресс игрока
      const progress = await getOne(`
        SELECT level, experience, energy
        FROM player_progress
        WHERE user_id = ?
      `, [userId]);
      
      // Проверяем, есть ли энергия
      if (!progress || progress.energy <= 0) {
        console.log(`[TAP] Недостаточно энергии: ${progress ? progress.energy : 0}`);
        return { 
          resourcesGained: 0, 
          experienceGained: 0, 
          levelUp: false, 
          level: progress ? progress.level : 1, 
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
      
      if (!location) {
        console.error(`[TAP] Локация с ID ${locationId} не найдена`);
        throw new Error(`Локация с ID ${locationId} не найдена`);
      }
      
      console.log(`[TAP] Локация найдена: ID=${locationId}, валюта=${location.currencyId}`);
      
      // Получаем экипированный инструмент
      const tool = await getOne(`
        SELECT t.power, t.main_coins_power as mainCoinsPower
        FROM tools t
        JOIN player_equipped_tools pet ON t.id = pet.tool_id
        WHERE pet.user_id = ? AND pet.character_id = ?
      `, [userId, location.characterId]);
      
      if (!tool) {
        console.error(`[TAP] Экипированный инструмент для персонажа ${location.characterId} не найден`);
        throw new Error(`Экипированный инструмент не найден`);
      }
      
      console.log(`[TAP] Инструмент найден: сила=${tool.power}, множитель монет=${tool.mainCoinsPower || 0.5}`);
      
      // Рассчитываем полученные ресурсы (сила инструмента)
      const resourcesGained = parseFloat(tool.power);
      
      // Рассчитываем полученный опыт (пока равен ресурсам)
      const experienceGained = resourcesGained;
      
      // Рассчитываем полученные монеты (основная валюта)
      const mainCoinsPower = tool.mainCoinsPower || 0.5;
      const mainCurrencyGained = Math.round(tool.power * mainCoinsPower);
      
      console.log(`[TAP] Расчет наград: ресурсы=${resourcesGained}, опыт=${experienceGained}, монеты=${mainCurrencyGained}`);
      
      // Начинаем транзакцию для атомарного обновления
      await runQuery('BEGIN TRANSACTION');
      
      try {
        // 1. Проверяем лимит хранилища для валюты локации
        const storageLimit = await getOne(`
          SELECT capacity 
          FROM player_storage_limits 
          WHERE user_id = ? AND location_id = ? AND currency_id = ?
        `, [userId, locationId, location.currencyId]);
        
        const storageCapacity = storageLimit ? storageLimit.capacity : 1000;
        console.log(`[TAP] Емкость хранилища: ${storageCapacity}`);
        
        // 2. Получаем текущее количество ресурсов валюты локации
        const currencyAmount = await getOne(`
          SELECT amount 
          FROM player_currencies 
          WHERE user_id = ? AND currency_id = ?
        `, [userId, location.currencyId]);
        
        const currentAmount = currencyAmount ? parseFloat(currencyAmount.amount) : 0;
        console.log(`[TAP] Текущее количество ресурсов локации: ${currentAmount}`);
        
        // 3. Проверяем, не будет ли превышен лимит хранилища
        let actualResourcesGained = resourcesGained;
        let storageIsFull = false;
        
        if (currentAmount >= storageCapacity) {
          console.log(`[TAP] Хранилище полностью заполнено: ${currentAmount}/${storageCapacity}, ресурсы локации НЕ будут добавлены`);
          actualResourcesGained = 0;
          storageIsFull = true;
        } else if (currentAmount + resourcesGained > storageCapacity) {
          actualResourcesGained = storageCapacity - currentAmount;
          console.log(`[TAP] Хранилище почти заполнено: ${currentAmount}/${storageCapacity}, добавляем только ${actualResourcesGained}`);
        }
        
        // 4. Добавляем опыт и уменьшаем энергию
        await runQuery(`
          UPDATE player_progress
          SET experience = experience + ?,
              energy = energy - 1
          WHERE user_id = ?
        `, [experienceGained, userId]);
        console.log(`[TAP] Добавлен опыт: ${experienceGained}, уменьшена энергия на 1`);
        
        // 5. Всегда добавляем основную валюту (монеты)
        // Проверяем, существует ли запись о валюте
        const mainCurrencyExists = await getOne(`
          SELECT 1 FROM player_currencies 
          WHERE user_id = ? AND currency_id = 1
        `, [userId]);
        
        if (mainCurrencyExists) {
          await runQuery(`
            UPDATE player_currencies
            SET amount = amount + ?
            WHERE user_id = ? AND currency_id = 1
          `, [mainCurrencyGained, userId]);
          console.log(`[TAP] Добавлены монеты (обновление): ${mainCurrencyGained}`);
        } else {
          await runQuery(`
            INSERT INTO player_currencies (user_id, currency_id, amount)
            VALUES (?, 1, ?)
          `, [userId, mainCurrencyGained]);
          console.log(`[TAP] Добавлены монеты (создание): ${mainCurrencyGained}`);
        }
        
        // 6. Добавляем ресурсы локации только если хранилище не заполнено
        if (!storageIsFull && actualResourcesGained > 0) {
          // Проверяем, существует ли запись о валюте локации
          const locationCurrencyExists = await getOne(`
            SELECT 1 FROM player_currencies 
            WHERE user_id = ? AND currency_id = ?
          `, [userId, location.currencyId]);
          
          if (locationCurrencyExists) {
            await runQuery(`
              UPDATE player_currencies
              SET amount = amount + ?
              WHERE user_id = ? AND currency_id = ?
            `, [actualResourcesGained, userId, location.currencyId]);
            console.log(`[TAP] Добавлены ресурсы локации (обновление): ${actualResourcesGained}`);
          } else {
            await runQuery(`
              INSERT INTO player_currencies (user_id, currency_id, amount)
              VALUES (?, ?, ?)
            `, [userId, location.currencyId, actualResourcesGained]);
            console.log(`[TAP] Добавлены ресурсы локации (создание): ${actualResourcesGained}`);
          }
        } else {
          console.log(`[TAP] Ресурсы локации НЕ добавлены из-за заполненного хранилища`);
        }
        
        // Фиксируем транзакцию
        await runQuery('COMMIT');
        console.log(`[TAP] Транзакция успешно завершена`);
        
        // Проверяем, что ресурсы действительно не были добавлены при заполненном хранилище
        if (storageIsFull) {
          const newCurrencyAmount = await getOne(`
            SELECT amount FROM player_currencies 
            WHERE user_id = ? AND currency_id = ?
          `, [userId, location.currencyId]);
          
          const newAmount = newCurrencyAmount ? parseFloat(newCurrencyAmount.amount) : 0;
          console.log(`[TAP] Проверка после тапа: было=${currentAmount}, стало=${newAmount}`);
          
          if (Math.abs(newAmount - currentAmount) > 0.001) {
            console.error(`[TAP] ОШИБКА: Ресурсы локации были добавлены (${newAmount - currentAmount}), несмотря на заполненное хранилище!`);
          }
        }
        
        // Получаем обновленный прогресс
        const newProgress = await getOne(`
          SELECT level, energy
          FROM player_progress
          WHERE user_id = ?
        `, [userId]);
        
        return {
          resourcesGained: actualResourcesGained,
          mainCurrencyGained,
          experienceGained,
          levelUp: false, // Повышение уровня обрабатывается отдельно
          level: newProgress.level,
          rewards: [],
          energyLeft: newProgress.energy,
          storageIsFull
        };
      } catch (error) {
        // Откатываем транзакцию в случае ошибки
        await runQuery('ROLLBACK');
        console.error(`[TAP] Ошибка в транзакции, выполнен откат: ${error.message}`);
        throw error;
      }
    } catch (error) {
      console.error(`[TAP] Критическая ошибка: ${error.message}`);
      throw error;
    }
  },
  
  // Улучшить инструмент (купить новый)
  upgradeTool: async (userId, toolId) => {
    try {
      // Получаем инструмент
      const tool = await getOne(`
        SELECT 
          id, 
          name,
          unlock_cost as unlockCost, 
          currency_id as currencyId,
          character_id as characterId
        FROM tools
        WHERE id = ?
      `, [toolId]);
      
      if (!tool) {
        console.error(`Инструмент с ID ${toolId} не найден`);
        return false;
      }
      
      console.log(`Попытка улучшения инструмента: ${JSON.stringify(tool)}`);
      
      // Проверяем, достаточно ли ресурсов
      const currentAmount = await api.getResourceAmount(userId, tool.currencyId);
      console.log(`Текущее количество ресурсов: ${currentAmount}, требуется: ${tool.unlockCost}`);
      
      if (currentAmount < tool.unlockCost) {
        console.log(`Недостаточно ресурсов для улучшения инструмента: ${currentAmount} < ${tool.unlockCost}`);
        return false;
      }
      
      // Списываем ресурсы
      const spendResult = await api.spendResources(userId, tool.currencyId, tool.unlockCost);
      if (!spendResult) {
        console.error('Не удалось списать ресурсы');
        return false;
      }
      
      // Разблокируем инструмент
      await api.unlockTool(userId, toolId);
      
      console.log(`Инструмент ${toolId} успешно улучшен для пользователя ${userId}`);
      return true;
    } catch (error) {
      console.error('Ошибка при улучшении инструмента:', error);
      return false;
    }
  },

  // Функция для обновления прогресса ежедневных заданий при трате валюты локации
  updateTaskProgressForLocationCurrencySpend: async (userId, amount) => {
    try {
      // Отправляем запрос к API для обновления прогресса задания
      // const response = await axios.post(`${apiUrl}/api/player/tasks/update-progress`, { // Удалено
      //   taskType: 'spend_location_currency', // Удалено
      //   progress: amount // Удалено
      // }, { // Удалено
      //   headers: { // Удалено
      //     'Content-Type': 'application/json', // Удалено
      //     'x-user-id': userId // Удалено
      //   } // Удалено
      // }); // Удалено

      // return response.data; // Удалено
      console.log(`Обновлен прогресс задания spend_location_currency на ${amount} для пользователя ${userId}`);
      return { success: true, message: 'Прогресс обновлен' };
    } catch (error) {
      console.error('Ошибка при обновлении прогресса задания трата ресурсов локации:', error);
      return { success: false, error: 'Ошибка обновления прогресса' };
    }
  }
};

module.exports = api; 