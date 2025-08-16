@echo off
echo ========================================
echo    Gate Control App - Development
echo ========================================
echo.

REM Check if .env file exists, if not create it from env.example
if not exist ".env" (
    if exist "env.example" (
        echo 📝 Creating .env file from env.example...
        copy "env.example" ".env" >nul
        echo ✅ .env file created successfully!
        echo.
        echo ⚠️  Please edit the .env file with your actual values:
        echo   - TWILIO_ACCOUNT_SID
        echo   - TWILIO_AUTH_TOKEN  
        echo   - ADMIN_PASSWORD
        echo.
        echo Press any key to continue after editing .env file...
        pause
    ) else (
        echo ❌ Error: env.example file not found!
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found!
    echo.
    echo Please create a .env file with the following variables:
    echo   TWILIO_ACCOUNT_SID=your_account_sid
    echo   TWILIO_AUTH_TOKEN=your_auth_token
    echo  TWILIO_PHONE_NUMBER=your_phone_number
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

echo.
echo 🚀 Starting Gate Control App in separate windows...
echo.
echo 📱 Client will open at: http://localhost:3000
echo 🔧 Server will run at: http://localhost:3001
echo.
echo Press Ctrl+C in each window to stop the respective service
echo.

REM Start server in a new command prompt window
start "Gate Control Server" cmd /k "cd /d %CD% && npm run server"

REM Wait a moment for server to start
timeout /t 2 /nobreak >nul

REM Start client in a new command prompt window
start "Gate Control Client" cmd /k "cd /d %CD%\client && npm start"

echo.
echo ✅ Both server and client are starting in separate windows
echo.
pause
