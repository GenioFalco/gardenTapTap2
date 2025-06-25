@echo off
echo Запуск процесса стандартизации полей валюты (замена currency_type на currency_id)...
cd garden-tap-tap
cd server
node currency_field_standardization.js
echo.
echo Для завершения нажмите любую клавишу...
pause 