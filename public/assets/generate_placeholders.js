// Используем node-canvas для генерации placeholder изображений
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Функция для создания placeholder изображения
function createPlaceholder(filePath, width, height, bgColor, text, textColor = '#FFFFFF') {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Заливка фона
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  
  // Добавляем текст
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.floor(width / 10)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Разбиваем текст на строки
  const lines = text.split('\n');
  const lineHeight = Math.floor(width / 10) * 1.2;
  
  const startY = height / 2 - (lines.length - 1) * lineHeight / 2;
  
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });
  
  // Сохраняем в файл
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(filePath, buffer);
  
  console.log(`Created placeholder: ${filePath}`);
}

// Создаем папки, если они не существуют
const directories = [
  path.join(__dirname, 'backgrounds'),
  path.join(__dirname, 'tools'),
  path.join(__dirname, 'characters')
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Создаем placeholder для фона леса
createPlaceholder(
  path.join(__dirname, 'backgrounds', 'forest.jpg'),
  1280, 720,
  '#2E7D32',
  'FOREST\nBACKGROUND'
);

// Создаем placeholder для инструментов
createPlaceholder(
  path.join(__dirname, 'tools', 'axe.png'),
  128, 128,
  '#795548',
  'AXE'
);

createPlaceholder(
  path.join(__dirname, 'tools', 'handsaw.png'),
  128, 128,
  '#5D4037',
  'HANDSAW'
);

createPlaceholder(
  path.join(__dirname, 'tools', 'chainsaw.png'),
  128, 128,
  '#4E342E',
  'CHAINSAW'
);

// Создаем placeholder для персонажа
createPlaceholder(
  path.join(__dirname, 'characters', 'lumberjack.gif'),
  256, 256,
  '#3E2723',
  'LUMBERJACK\nCHARACTER'
);

console.log('All placeholders created successfully!'); 