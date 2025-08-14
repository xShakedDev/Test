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
echo Creating .env file from template...
copy env.example .env

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Edit .env file with your Twilio credentials
echo 2. Run 'npm run dev' to start the development server
echo 3. Open http://localhost:3000 in your browser
echo.
pause
