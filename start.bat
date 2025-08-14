@echo off
echo ========================================
echo    Gate Control App - Development
echo ========================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found!
    echo.
    echo Please create a .env file with the following variables:
    echo   TWILIO_ACCOUNT_SID=your_account_sid
    echo   TWILIO_AUTH_TOKEN=your_auth_token
    echo   TWILIO_PHONE_NUMBER=your_phone_number
    echo   ADMIN_PASSWORD=your_admin_password
    echo.
    echo You can copy from env-template.txt if available.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm run install-all
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Check if client node_modules exists
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
    if errorlevel 1 (
        echo ❌ Failed to install client dependencies
        pause
        exit /b 1
    )
    echo.
)

echo 🚀 Starting Gate Control App in development mode...
echo.
echo 📱 Client will open at: http://localhost:3000
echo 🔧 Server will run at: http://localhost:5000
echo.
echo Press Ctrl+C to stop both server and client
echo.

REM Start both server and client
call npm run dev

echo.
echo ✅ Development server stopped
pause
