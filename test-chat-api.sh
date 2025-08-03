#!/bin/bash

echo "Testing Chat API..."

# Create a new chat session
echo -e "\n1. Creating new chat session..."
curl -s -X POST http://localhost:3003/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-123","initialPrompt":"Hello! I need help.","metadata":{"title":"Test"}}' \
  | python3 -m json.tool || echo "Failed to create session"

# Get session (you'll need to replace SESSION_ID with actual ID from above)
echo -e "\n2. To get a session, use:"
echo "curl http://localhost:3003/api/chat/sessions/{SESSION_ID}"

echo -e "\n3. Testing without initial prompt..."
curl -s -X POST http://localhost:3003/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-456"}' \
  | python3 -m json.tool || echo "Failed to create session"

echo -e "\nDone!"