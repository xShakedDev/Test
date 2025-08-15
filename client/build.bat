@echo off
echo ========================================
echo    Building React App
echo ========================================
echo.

echo 🚀 Building React app...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Build successful!
echo.

echo 📁 Copying build files to server directory...
if not exist "..\public" mkdir "..\public"
xcopy /E /I /Y "build\*" "..\public\" >nul 2>&1

if errorlevel 1 (
    echo ❌ Failed to copy build files!
    echo Checking if build directory exists...
    if exist "build" (
        echo Build directory exists, checking contents...
        dir build
    ) else (
        echo Build directory not found!
    )
    pause
    exit /b 1
)

echo.
echo ✅ Build files copied to ../public/
echo 🎯 Your server can now serve the React app!
echo.
pause
