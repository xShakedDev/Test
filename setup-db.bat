@echo off
echo ========================================
echo    Gates Application - MySQL Setup
echo ========================================
echo.

echo Checking if MySQL is running...
net start mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL service is not running
    echo Please start MySQL service first
    echo You can use: net start mysql
    pause
    exit /b 1
)

echo ✅ MySQL service is running
echo.

echo Creating database and tables...
echo Please enter your MySQL root password when prompted:
echo.

echo Creating database 'gates_db'...
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS gates_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo.
echo Running schema file...
mysql -u root -p gates_db < server\config\schema.sql

echo.
echo ✅ Database setup completed!
echo.
echo Next steps:
echo 1. Create a .env file with your database credentials
echo 2. Run: npm start
echo.
pause
