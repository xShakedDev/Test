#!/bin/bash

echo "🚀 Fast Build Script for Gates App"
echo "=================================="

# Set environment
export NODE_ENV=production

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf client/build server/public

# Install dependencies in parallel
echo "📦 Installing dependencies..."
(cd client && npm ci --only=production) &
(cd server && npm ci --only=production) &
wait

# Build React app
echo "⚛️  Building React app..."
cd client && npm run build && cd ..

# Copy build to server
echo "📋 Copying build files..."
mkdir -p server/public
cp -r client/build/* server/public/

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t gates-app:latest .

echo "✅ Build completed successfully!"
echo "🚀 Run with: docker run -p 3001:3001 gates-app:latest"
