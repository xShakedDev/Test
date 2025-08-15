#!/bin/bash

echo "========================================"
echo "    Building React App"
echo "========================================"
echo

echo "🚀 Building React app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo
echo "✅ Build successful!"
echo

echo "📁 Copying build files to server directory..."
mkdir -p ../public
cp -r build/* ../public/

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy build files!"
    exit 1
fi

echo
echo "✅ Build files copied to ../public/"
echo "🎯 Your server can now serve the React app!"
echo
