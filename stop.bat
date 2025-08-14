@echo off
echo Stopping Gate Control App...
echo.

echo Stopping all Node.js processes...
taskkill /f /im node.exe 2>nul

echo.
echo All processes stopped!
echo.
pause
