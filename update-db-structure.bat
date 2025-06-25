@echo off
echo Запуск обновления структуры базы данных...
cd garden-tap-tap/server
node db_structure_update.js
echo Обновление структуры базы данных завершено.
pause 