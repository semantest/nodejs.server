#!/bin/bash
# Standalone test runner that bypasses workspace issues

echo "🧪 Running nodejs.server tests in standalone mode..."

# Set npm to ignore workspaces
export npm_config_workspaces=false

# Run jest directly
npx jest --passWithNoTests

echo "✅ Test run complete"