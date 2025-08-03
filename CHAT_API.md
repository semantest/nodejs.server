# Chat API Documentation

## Overview

The Chat API provides endpoints for creating and managing chat sessions with AI-powered responses. This implementation addresses Issue #23 by providing support for the `NewChatRequested` event with initial prompt payloads.

## Endpoints

### 1. Create New Chat Session

**POST** `/api/chat/sessions`

Creates a new chat session with an optional initial prompt.

#### Request Body

```json
{
  "userId": "string",           // Required: User identifier
  "initialPrompt": "string",    // Optional: Initial message to start the conversation
  "metadata": {                 // Optional: Additional session metadata
    "title": "string",
    "tags": ["string"],
    "model": "string",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

#### Response

```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "userId": "string",
    "createdAt": "2025-08-02T12:00:00Z",
    "updatedAt": "2025-08-02T12:00:00Z",
    "status": "active",
    "metadata": {},
    "messages": [
      {
        "id": "uuid",
        "sessionId": "uuid",
        "content": "Hello! I need help.",
        "role": "user",
        "timestamp": "2025-08-02T12:00:00Z"
      },
      {
        "id": "uuid",
        "sessionId": "uuid",
        "content": "I understand you need help...",
        "role": "assistant",
        "timestamp": "2025-08-02T12:00:01Z"
      }
    ]
  }
}
```

### 2. Get Chat Session

**GET** `/api/chat/sessions/:sessionId`

Retrieves a specific chat session with all messages.

#### Response

```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "userId": "string",
    "createdAt": "2025-08-02T12:00:00Z",
    "updatedAt": "2025-08-02T12:00:00Z",
    "status": "active",
    "messages": []
  }
}
```

### 3. Send Message to Chat

**POST** `/api/chat/sessions/:sessionId/messages`

Sends a new message to an existing chat session and receives an AI response.

#### Request Body

```json
{
  "content": "string",    // Required: Message content
  "userId": "string"      // Optional: User identifier
}
```

#### Response

```json
{
  "success": true,
  "userMessage": {
    "id": "uuid",
    "sessionId": "uuid",
    "content": "What is the weather today?",
    "role": "user",
    "timestamp": "2025-08-02T12:00:00Z"
  },
  "assistantMessage": {
    "id": "uuid",
    "sessionId": "uuid",
    "content": "I understand you're asking about...",
    "role": "assistant",
    "timestamp": "2025-08-02T12:00:01Z"
  }
}
```

### 4. Get User's Chat Sessions

**GET** `/api/chat/users/:userId/sessions`

Retrieves all chat sessions for a specific user.

#### Response

```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "userId": "string",
      "createdAt": "2025-08-02T12:00:00Z",
      "updatedAt": "2025-08-02T12:00:00Z",
      "status": "active",
      "messages": []
    }
  ],
  "count": 1
}
```

### 5. Close Chat Session

**DELETE** `/api/chat/sessions/:sessionId`

Closes a chat session.

#### Request Body

```json
{
  "reason": "string"    // Optional: Reason for closing
}
```

#### Response

```json
{
  "success": true,
  "message": "Session closed successfully"
}
```

## Event System

### NewChatRequested Event

When a new chat session is created, a `NewChatRequested` event is published:

```typescript
class NewChatRequestedEvent {
  type: 'NewChatRequested';
  userId: string;
  initialPrompt: string;
  metadata?: ChatSessionMetadata;
}
```

The event handler:
1. Creates a new chat session
2. Adds the initial prompt as a user message (if provided)
3. Generates an AI response for the initial prompt
4. Publishes a `ChatSessionCreatedEvent` upon success

## Implementation Details

### File Structure

```
src/
├── chat/
│   ├── application/
│   │   └── services/
│   │       └── chat.service.ts         # Business logic
│   └── infrastructure/
│       ├── handlers/
│       │   ├── new-chat-requested.handler.ts
│       │   └── __tests__/
│       │       └── new-chat-requested.handler.test.ts
│       └── http/
│           ├── chat.routes.ts           # REST endpoints
│           └── __tests__/
│               └── chat.routes.test.ts
└── core/
    └── events/
        └── chat-events.ts               # Event definitions
```

### Testing

Run the chat tests:

```bash
npm test src/chat
```

### Example Usage

```bash
# Create a new chat session with initial prompt
curl -X POST http://localhost:3003/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "initialPrompt": "Hello! I need help with my code.",
    "metadata": {
      "title": "Code Help Session"
    }
  }'

# Send a follow-up message
curl -X POST http://localhost:3003/api/chat/sessions/{SESSION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Can you help me fix a TypeScript error?"
  }'
```

## Future Enhancements

1. **AI Integration**: Replace placeholder responses with actual AI service (OpenAI, Claude, etc.)
2. **Persistence**: Add database storage for sessions and messages
3. **WebSocket Support**: Real-time messaging capabilities
4. **Authentication**: Secure session access with proper auth
5. **Rate Limiting**: Prevent abuse with request limits
6. **Session Management**: Auto-cleanup of idle sessions
7. **Message History**: Pagination for large conversations
8. **Context Management**: Maintain conversation context for better responses