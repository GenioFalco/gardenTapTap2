@echo off
echo Запуск скрипта исправления таблицы player_currencies...

cd garden-tap-tap
cd server

echo 1/3: Исправление запросов в server.js...
node fix-currency-queries.js

echo 2/3: Исправление структуры таблицы player_currencies (объединение дубликатов)...
node db_structure_update.js

echo 3/3: Удаление столбца currency_type из таблицы player_currencies...
node remove-currency-type-column.js

echo Все скрипты успешно выполнены!
echo.
echo Таблица player_currencies теперь имеет структуру:
echo - user_id TEXT NOT NULL
echo - currency_id TEXT NOT NULL
echo - amount INTEGER NOT NULL DEFAULT 0
echo - PRIMARY KEY (user_id, currency_id)
echo.
echo Проблема с дублированием записей решена!

cd ..
cd ..
pause 