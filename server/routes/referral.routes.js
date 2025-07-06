const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Функция для генерации уникального реферального кода
function generateReferralCode() {
  // Генерируем короткий код на основе UUID
  return uuidv4().substring(0, 8).toUpperCase();
}

// Функция для проверки и создания записи валюты, если она не существует
async function getOrCreatePlayerCurrency(userId, currencyId) {
  try {
    // Проверяем, существует ли запись о валюте
    const currency = await db.get(
      'SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = ?',
      [userId, currencyId]
    );
    
    // Если записи нет, создаем её
    if (!currency) {
      console.log(`Создаем запись о валюте ${currencyId} для пользователя ${userId}`);
      await db.run(
        'INSERT INTO player_currencies (user_id, currency_id, amount) VALUES (?, ?, 0)',
        [userId, currencyId]
      );
      return { amount: 0 };
    }
    
    return currency;
  } catch (error) {
    console.error(`Ошибка при проверке/создании валюты: ${error.message}`);
    throw error;
  }
}

// Получить реферальный код пользователя
router.get('/code', async (req, res) => {
  try {
    const { userId } = req;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Необходима авторизация' });
    }
    
    // Проверяем, есть ли уже реферальный код у пользователя
    let referralCode = await db.get(
      'SELECT code FROM referral_codes WHERE user_id = ?',
      [userId]
    );
    
    // Если кода нет, создаем новый
    if (!referralCode) {
      const newCode = generateReferralCode();
      
      // Сохраняем код в базе данных
      await db.run(
        'INSERT INTO referral_codes (user_id, code, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [userId, newCode]
      );
      
      referralCode = { code: newCode };
    }
    
    res.json({
      success: true,
      code: referralCode.code
    });
    
  } catch (error) {
    console.error('Ошибка при получении реферального кода:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Получить статистику приглашений
router.get('/stats', async (req, res) => {
  try {
    const { userId } = req;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Необходима авторизация' });
    }
    
    // Получаем количество отправленных приглашений
    const sentInvitations = await db.get(
      'SELECT COUNT(*) as count FROM referral_invitations WHERE referrer_id = ?',
      [userId]
    );
    
    // Получаем количество принятых приглашений
    const acceptedInvitations = await db.get(
      'SELECT COUNT(*) as count FROM referral_invitations WHERE referrer_id = ? AND is_accepted = 1',
      [userId]
    );
    
    // Получаем общую сумму полученных монет за приглашения
    const totalCoins = await db.get(
      'SELECT SUM(coins_rewarded) as total FROM referral_invitations WHERE referrer_id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      stats: {
        sent: sentInvitations ? sentInvitations.count : 0,
        accepted: acceptedInvitations ? acceptedInvitations.count : 0,
        totalCoins: totalCoins && totalCoins.total ? totalCoins.total : 0
      }
    });
    
  } catch (error) {
    console.error('Ошибка при получении статистики приглашений:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Отправить приглашение (без награды за отправку)
router.post('/send-invitation', async (req, res) => {
  try {
    const { userId } = req;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Необходима авторизация'
      });
    }
    
    // Добавляем запись об отправленном приглашении
    await db.run(`
      INSERT INTO referral_invitations (referrer_id, coins_rewarded, sent_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [userId, 0]); // 0 монет за отправку
    
    console.log(`Игрок ${userId} отправил приглашение`);
    
    // Возвращаем информацию об успешной отправке
    res.json({
      success: true,
      message: 'Приглашение отправлено!',
      coinsAdded: 0
    });
  } catch (error) {
    console.error('Ошибка при отправке приглашения:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера'
    });
  }
});

// Применить реферальный код
router.post('/apply-code', async (req, res) => {
  try {
    const { userId } = req;
    const { code } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Необходима авторизация' });
    }
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Не указан реферальный код' });
    }
    
    // Проверяем, существует ли такой код
    const referralCode = await db.get(
      'SELECT user_id FROM referral_codes WHERE code = ?',
      [code]
    );
    
    if (!referralCode) {
      return res.status(404).json({ success: false, message: 'Реферальный код не найден' });
    }
    
    // Проверяем, не свой ли это код
    if (referralCode.user_id === userId) {
      return res.status(400).json({ success: false, message: 'Нельзя использовать свой реферальный код' });
    }
    
    // Проверяем, не применял ли уже пользователь реферальный код
    const existingApplication = await db.get(
      'SELECT 1 FROM referral_applications WHERE user_id = ?',
      [userId]
    );
    
    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'Вы уже применили реферальный код' });
    }
    
    // Сумма награды за применение кода (500 монет)
    const rewardAmount = 500;
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Добавляем запись о применении кода
      await db.run(
        'INSERT INTO referral_applications (user_id, referrer_id, code, applied_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, referralCode.user_id, code]
      );
      
      // Обновляем запись о приглашении, отмечая его как принятое
      await db.run(`
        UPDATE referral_invitations
        SET is_accepted = 1, referee_id = ?, accepted_at = CURRENT_TIMESTAMP
        WHERE referrer_id = ? AND referee_id IS NULL
        LIMIT 1
      `, [userId, referralCode.user_id]);
      
      // Проверяем и создаем запись о валюте для пригласившего игрока, если её нет
      await getOrCreatePlayerCurrency(referralCode.user_id, 5); // ID 5 - сад-коины
      
      // Получаем текущий баланс пригласившего игрока до начисления
      const beforeBalance = await db.get(
        'SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = 5',
        [referralCode.user_id]
      );
      console.log(`Баланс игрока ${referralCode.user_id} ДО начисления награды за приглашение: ${beforeBalance ? beforeBalance.amount : 0}`);
      
      // Начисляем награду пригласившему игроку
      await db.run(`
        UPDATE player_currencies
        SET amount = amount + ?
        WHERE user_id = ? AND currency_id = 5
      `, [rewardAmount, referralCode.user_id]);
      
      // Получаем обновленный баланс пригласившего игрока
      const afterBalance = await db.get(
        'SELECT amount FROM player_currencies WHERE user_id = ? AND currency_id = 5',
        [referralCode.user_id]
      );
      console.log(`Баланс игрока ${referralCode.user_id} ПОСЛЕ начисления награды за приглашение: ${afterBalance ? afterBalance.amount : rewardAmount}`);
      
      // Обновляем сумму полученных монет в записи о приглашении
      await db.run(`
        UPDATE referral_invitations
        SET coins_rewarded = coins_rewarded + ?
        WHERE referrer_id = ? AND referee_id = ?
      `, [rewardAmount, referralCode.user_id, userId]);
      
      await db.run('COMMIT');
      
      console.log(`Игрок ${referralCode.user_id} получил ${rewardAmount} монет за приглашение игрока ${userId}`);
      
      res.json({
        success: true,
        message: 'Реферальный код успешно применен!',
        referrerId: referralCode.user_id
      });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Ошибка при применении реферального кода:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

module.exports = router; 