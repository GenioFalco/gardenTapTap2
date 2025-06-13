// routes/currency.routes.js
const express = require('express');
const router = express.Router();
const { db, CurrencyType } = require('../db');

// Получить все валюты
router.get('/', async (req, res) => {
  try {
    const currencies = await db.all('SELECT * FROM currencies');
    res.json(currencies);
  } catch (error) {
    console.error('Ошибка при получении валют:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить валюту по типу
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    // Проверяем, что тип валюты корректный
    const normalizedType = type.toUpperCase();
    
    const currency = await db.get('SELECT * FROM currencies WHERE currency_type = ?', [type.toLowerCase()]);
    
    if (!currency) {
      return res.status(404).json({ error: 'Валюта не найдена' });
    }
    
    res.json(currency);
  } catch (error) {
    console.error('Ошибка при получении валюты по типу:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать новую валюту (для админов)
router.post('/', async (req, res) => {
  try {
    const { name, currency_type, image_path } = req.body;
    
    if (!name || !currency_type) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }
    
    const result = await db.run(
      'INSERT INTO currencies (name, currency_type, image_path) VALUES (?, ?, ?)',
      [name, currency_type.toLowerCase(), image_path]
    );
    
    const newCurrency = await db.get('SELECT * FROM currencies WHERE id = ?', [result.lastID]);
    
    res.status(201).json(newCurrency);
  } catch (error) {
    console.error('Ошибка при создании валюты:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить валюту (для админов)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, currency_type, image_path } = req.body;
    
    if (!name && !currency_type && !image_path) {
      return res.status(400).json({ error: 'Не указаны параметры для обновления' });
    }
    
    const currency = await db.get('SELECT * FROM currencies WHERE id = ?', [id]);
    
    if (!currency) {
      return res.status(404).json({ error: 'Валюта не найдена' });
    }
    
    const updatedName = name || currency.name;
    const updatedType = currency_type ? currency_type.toLowerCase() : currency.currency_type;
    const updatedImagePath = image_path || currency.image_path;
    
    await db.run(
      'UPDATE currencies SET name = ?, currency_type = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [updatedName, updatedType, updatedImagePath, id]
    );
    
    const updatedCurrency = await db.get('SELECT * FROM currencies WHERE id = ?', [id]);
    
    res.json(updatedCurrency);
  } catch (error) {
    console.error('Ошибка при обновлении валюты:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router; 