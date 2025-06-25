@echo off
echo Обновление базы данных...
cd garden-tap-tap\server
node update_tools_migration.js
pause 