@echo off
echo Installing Gate Control App...
echo.

echo Installing server dependencies...
npm install

echo.
echo Installing client dependencies...
cd client
npm install
cd ..

echo.
echo Checking for .env file...
if not exist .env (
    echo Creating .env file from template...
    if exist .env.example (
        copy .env.example .env
        echo .env file created from template
    ) else (
        echo .env.example not found, creating basic .env file...
        echo # Twilio Configuration > .env
        echo TWILIO_ACCOUNT_SID=your_account_sid_here >> .env
        echo TWILIO_AUTH_TOKEN=your_auth_token_here >> .env
        echo TWILIO_PHONE_NUMBER=your_twilio_phone_number >> .env
        echo. >> .env
        echo # Server Configuration >> .env
        echo PORT=3001 >> .env
        echo NODE_ENV=development >> .env
        echo. >> .env
        echo # Admin Configuration >> .env
        echo ADMIN_PASSWORD=your-secure-admin-password >> .env
        echo Basic .env file created
    )
) else (
    echo .env file already exists
)

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Edit .env file with your Twilio credentials and admin password
echo 2. Run 'start.bat' to start both server and client
echo 3. Server will run on http://localhost:3001
echo 4. Client will run on http://localhost:3000
echo.
pause
