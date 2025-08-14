#!/bin/bash
set -e

echo "🚀 Starting build process..."

# Install server dependencies
echo "📦 Installing server dependencies..."
npm ci --only=production

# Install and build client
echo "🔨 Building React client..."
cd client
npm ci --only=production
npm run build
cd ..

# Create public directory if it doesn't exist
mkdir -p public

# Copy built client to public directory
echo "📁 Copying built client..."
cp -r client/build/* public/

echo "✅ Build completed successfully!"
echo "🎯 Application ready to run with: npm start"
