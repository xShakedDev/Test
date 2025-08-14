@echo off
echo Starting Gate Control App...
echo.
echo Starting server and client in separate windows...
echo.

REM Start server in a new window
start "Gate Control Server" cmd /k "cd /d %~dp0 && npm run server"

REM Wait a moment for server to start
timeout /t 3 /nobreak >nul

REM Start client in a new window
start "Gate Control Client" cmd /k "cd /d %~dp0\client && npm start"

echo.
echo Both server and client are starting...
echo Server will run on port 3001
echo Client will run on port 3000
echo.
echo Close this window when done
pause
