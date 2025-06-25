@echo off
echo Удаление столбца power из таблицы tools...
cd garden-tap-tap\server
node remove_power_column.js
echo Миграция завершена
pause 