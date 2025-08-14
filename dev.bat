@echo off
echo 🚀 Starting Gate Control App (Quick Dev Mode)
echo.

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  .env file not found! Please run install.bat first
    pause
    exit /b 1
)

echo 📱 Starting development server...
echo.
echo Client: http://localhost:3000
echo Server: http://localhost:5000
echo.
echo Press Ctrl+C to stop
echo.

npm run dev
