@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] Папка: %cd%
echo.

echo [2/3] npm install...
call npm install
if errorlevel 1 (
  echo ОШИБКА: npm install не удался.
  pause
  exit /b 1
)

echo.
echo [3/3] Сборка dnd_generator.exe ...
call npm run pkg:win
if errorlevel 1 (
  echo ОШИБКА: pkg:win не удался. Скопируйте текст выше.
  pause
  exit /b 1
)

echo.
if exist "dnd_generator.exe" (
  echo ГОТОВО: %cd%\dnd_generator.exe
  dir "dnd_generator.exe"
) else (
  echo Файл dnd_generator.exe не найден в этой папке.
)
echo.
echo Рядом с exe должен лежать dnd-loot.sqlite
pause
