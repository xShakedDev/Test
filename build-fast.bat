@echo off
echo 🚀 Fast Build Script for Gates App
echo ==================================

REM Set environment
set NODE_ENV=production

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist client\build rmdir /s /q client\build
if exist server\public rmdir /s /q server\public

REM Install dependencies
echo 📦 Installing dependencies...
cd client && npm ci --only=production && cd ..
cd server && npm ci --only=production && cd ..

REM Build React app
echo ⚛️  Building React app...
cd client && npm run build && cd ..

REM Copy build to server
echo 📋 Copying build files...
mkdir server\public
xcopy client\build\* server\public\ /E /I /Y

REM Build Docker image
echo 🐳 Building Docker image...
docker build -t gates-app:latest .

echo ✅ Build completed successfully!
echo 🚀 Run with: docker run -p 3001:3001 gates-app:latest
pause
