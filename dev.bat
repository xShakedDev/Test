@echo off
echo Starting Gate Control Server (Development Mode)...
echo.

echo Starting server only...
echo Client will need to be started separately with: cd client ^&^& npm start
echo.

npm run server

pause
