@echo off
echo Обновление структуры базы данных...
cd garden-tap-tap\server
node db_structure_update.js
echo Обновление завершено
pause 