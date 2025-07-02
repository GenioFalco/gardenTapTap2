@echo off
echo Updating tasks table structure...
cd server
sqlite3 garden_tap_tap.db < update_daily_tasks_table.sql
echo Done!
pause 