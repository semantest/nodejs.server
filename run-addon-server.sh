#!/usr/bin/env bash

echo "🚀 Starting addon development server..."

# Check if express is installed
if ! npm list express >/dev/null 2>&1; then
    echo "📦 Installing express..."
    npm install express
fi

# Check if cors is installed
if ! npm list cors >/dev/null 2>&1; then
    echo "📦 Installing cors..."
    npm install cors
fi

# Run the server
echo "🔧 Starting server on port 3003..."
node addon-dev-server.js
