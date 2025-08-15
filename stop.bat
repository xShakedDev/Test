@echo off
echo ========================================
echo    Stopping Gate Control App
echo ========================================
echo.

echo 🔴 Stopping development server...
echo.

REM Kill Node.js processes on ports 3000 and 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Stopping process on port 3000 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    echo Stopping process on port 3001 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo ✅ All Gate Control App processes stopped
echo.
pause
