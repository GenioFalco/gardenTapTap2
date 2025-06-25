@echo off
echo Запуск полного обновления базы данных...

echo 1. Удаление столбца power из таблицы tools...
call remove-power-column.bat

echo 2. Обновление структуры базы данных...
call update-db-structure.bat

echo Все миграции успешно выполнены!
pause 