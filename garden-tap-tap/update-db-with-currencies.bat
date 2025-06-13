@echo off
echo Обновление базы данных с добавлением колонок в таблицу tools и созданием таблицы currencies
cd server
node update_tools_migration.js
echo Обновление завершено
pause 