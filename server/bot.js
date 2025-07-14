const TelegramBot = require('node-telegram-bot-api');
const { db } = require('./db');

// Конфигурация бота
const BOT_TOKEN = '7956184080:AAGPyyVY9g98V6W7fazaM2CqcXrUJYsrdx4';
const ADMIN_CHAT_ID = '854880510';

// Создание экземпляра бота
let bot = null;

// Функция для инициализации бота
function initBot() {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    
    console.log('Telegram bot успешно запущен!');
    
    // Обработчик команды /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      
      // Сохраняем информацию о пользователе
      await saveUserInfo(msg.from);
      
      bot.sendMessage(chatId, 'Бот Garden Tap Tap запущен! Этот бот отправляет уведомления о новых заказах услуг администраторам.');
      
      // Если это администратор, показываем дополнительную информацию
      if (chatId.toString() === ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, `Вы авторизованы как администратор. ID вашего чата: ${chatId}`);
      }
    });
    
    // Обработчик команды /status
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      
      // Сохраняем информацию о пользователе
      await saveUserInfo(msg.from);
      
      // Только администратор может использовать эту команду
      if (chatId.toString() === ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, 'Бот активен и готов к отправке уведомлений о заказах.');
      } else {
        bot.sendMessage(chatId, 'Команда доступна только администраторам.');
      }
    });
    
    // Обработчик команды /help
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      
      // Сохраняем информацию о пользователе
      await saveUserInfo(msg.from);
      
      const helpText = `
Доступные команды:
/start - Запустить бота
/status - Проверить статус бота (только для админа)
/help - Показать это сообщение

Этот бот отправляет уведомления о новых заказах услуг администраторам.
      `;
      bot.sendMessage(chatId, helpText);
    });
    
    // Обработчик ошибок
    bot.on('error', (error) => {
      console.error('Ошибка Telegram бота:', error);
    });
    
  } catch (error) {
    console.error('Ошибка при инициализации Telegram бота:', error);
  }
}

// Функция для отправки уведомления о новом заказе
function sendOrderNotification(orderData) {
  if (!bot) {
    console.error('Бот не инициализирован');
    return false;
  }
  
  if (!ADMIN_CHAT_ID) {
    console.error('ADMIN_CHAT_ID не настроен');
    return false;
  }
  
  const message = `🔔 НОВЫЙ ЗАКАЗ УСЛУГИ

📦 Заказ №${orderData.orderId}
👤 Пользователь: ${orderData.userName || orderData.userId}
🛍️ Услуга: ${orderData.serviceName}
💰 Цена: ${orderData.price} монет
📱 Контакт: ${orderData.contactInfo}
${orderData.notes ? `📝 Примечание: ${orderData.notes}` : ''}

⏰ Время: ${new Date().toLocaleString()}`;
  
  try {
    bot.sendMessage(ADMIN_CHAT_ID, message);
    console.log('Уведомление о новом заказе отправлено в Telegram');
    return true;
  } catch (error) {
    console.error('Ошибка при отправке уведомления о заказе:', error);
    return false;
  }
}

// Функция для отправки уведомления об изменении статуса заказа
function sendStatusUpdateNotification(orderData) {
  if (!bot) {
    console.error('Бот не инициализирован');
    return false;
  }
  
  if (!ADMIN_CHAT_ID) {
    console.error('ADMIN_CHAT_ID не настроен');
    return false;
  }
  
  const statusEmoji = {
    'pending': '⏳',
    'processing': '🔄',
    'completed': '✅',
    'cancelled': '❌'
  };
  
  const statusText = {
    'pending': 'В ожидании',
    'processing': 'В обработке',
    'completed': 'Выполнен',
    'cancelled': 'Отменен'
  };
  
  const message = `${statusEmoji[orderData.status]} ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗА

📦 Заказ №${orderData.orderId}
👤 Пользователь: ${orderData.userName || orderData.userId}
🛍️ Услуга: ${orderData.serviceName}
📊 Новый статус: ${statusText[orderData.status]}

⏰ Время: ${new Date().toLocaleString()}`;
  
  try {
    bot.sendMessage(ADMIN_CHAT_ID, message);
    console.log('Уведомление об изменении статуса отправлено в Telegram');
    return true;
  } catch (error) {
    console.error('Ошибка при отправке уведомления об изменении статуса:', error);
    return false;
  }
}

// Функция для сохранения информации о пользователе Telegram
async function saveUserInfo(userInfo) {
  try {
    if (!userInfo || !userInfo.id) {
      return;
    }
    
    const userId = userInfo.id.toString();
    const username = userInfo.username || null;
    const firstName = userInfo.first_name || null;
    const lastName = userInfo.last_name || null;
    const displayName = firstName || username || `User${userId}`;
    
    // Проверяем, существует ли пользователь
    const existingUser = await db.get(`
      SELECT user_id FROM telegram_users WHERE user_id = ?
    `, [userId]);
    
    if (existingUser) {
      // Обновляем существующего пользователя
      await db.run(`
        UPDATE telegram_users 
        SET username = ?, first_name = ?, last_name = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [username, firstName, lastName, displayName, userId]);
    } else {
      // Создаем нового пользователя
      await db.run(`
        INSERT INTO telegram_users (user_id, username, first_name, last_name, display_name)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, username, firstName, lastName, displayName]);
    }
    
    console.log(`Информация о пользователе Telegram сохранена: ${displayName} (${userId})`);
  } catch (error) {
    console.error('Ошибка при сохранении информации о пользователе Telegram:', error);
  }
}

module.exports = {
  initBot,
  sendOrderNotification,
  sendStatusUpdateNotification
}; 