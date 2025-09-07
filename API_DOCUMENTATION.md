# API Documentation for Image Generation Service

## Overview

This document describes the HTTP API endpoints and WebSocket protocol for the image generation service that connects the CLI client with Chrome extension workers.

## Architecture Flow

```
CLI Client → HTTP API → Server → WebSocket → Chrome Extension → Image Generation
                           ↓
                    Image Download & Storage
```

## HTTP API Endpoints

### 1. Generate Image

**Endpoint:** `POST /api/images/generate`

**Description:** Submit an image generation request from the CLI

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "model": "dall-e-3",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "quality": "hd",
    "style": "natural",
    "numberOfImages": 1
  },
  "userId": "cli-user-123"
}
```

**Response:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "accepted",
  "message": "Image generation request submitted",
  "correlationId": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Request accepted successfully
- `400 Bad Request` - Missing required fields or invalid parameters
- `500 Internal Server Error` - Server processing error

### 2. Get Image Status

**Endpoint:** `GET /api/images/:requestId/status`

**Description:** Check the status of an image generation request

**Response:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 75,
  "timestamp": "2024-01-14T12:01:00.000Z"
}
```

**Status Values:**
- `accepted` - Request received and queued
- `processing` - Being processed by Chrome extension
- `completed` - Image generated successfully
- `failed` - Generation failed
- `downloading` - Downloading generated image

### 3. Get Generated Image

**Endpoint:** `GET /api/images/:requestId`

**Description:** Retrieve information about a generated image

**Response:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "imageUrl": "https://example.com/generated-image.png",
  "imagePath": "/generated-images/550e8400-e29b-41d4-a716-446655440000_1234567890.png",
  "metadata": {
    "model": "dall-e-3",
    "prompt": "A beautiful sunset over mountains",
    "width": 1024,
    "height": 1024,
    "generatedAt": "2024-01-14T12:02:00.000Z"
  },
  "timestamp": "2024-01-14T12:02:30.000Z"
}
```

### 4. Health Check

**Endpoint:** `GET /health`

**Description:** Check server health status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-14T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 104857600,
    "heapTotal": 52428800,
    "heapUsed": 26214400
  },
  "environment": "production"
}
```

### 5. WebSocket Connection Info

**Endpoint:** `GET /api/websocket/info`

**Description:** Get WebSocket connection information

**Response:**
```json
{
  "url": "ws://localhost:3001/ws",
  "activeConnections": 5,
  "protocol": "websocket",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

## WebSocket Protocol

### Connection

**URL:** `ws://localhost:3001/ws`

### Authentication Flow

1. **Client connects to WebSocket**
2. **Server sends authentication request:**
```json
{
  "type": "authentication_required",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

3. **Client sends authentication:**
```json
{
  "type": "authenticate",
  "extensionId": "chrome-extension-123",
  "metadata": {
    "version": "1.0.0",
    "capabilities": ["image-generation", "dall-e-3"]
  }
}
```

4. **Server confirms authentication:**
```json
{
  "type": "authentication_success",
  "extensionId": "chrome-extension-123",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

### Message Types

#### Server → Extension

**Generate Image Request:**
```json
{
  "type": "generate_image",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "A beautiful sunset over mountains",
  "model": "dall-e-3",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "quality": "hd"
  },
  "userId": "cli-user-123",
  "correlationId": "660e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

#### Extension → Server

**Image Generated:**
```json
{
  "type": "image_generated",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "imageUrl": "https://example.com/generated-image.png",
  "metadata": {
    "model": "dall-e-3",
    "prompt": "A beautiful sunset over mountains",
    "width": 1024,
    "height": 1024,
    "generatedAt": "2024-01-14T12:02:00.000Z"
  },
  "correlationId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Generation Failed:**
```json
{
  "type": "image_generation_failed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "Rate limit exceeded",
  "reason": "Too many requests in the last hour",
  "correlationId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Progress Update:**
```json
{
  "type": "image_generation_progress",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 50,
  "status": "Generating image...",
  "correlationId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "extensionId": "chrome-extension-123",
  "status": {
    "available": true,
    "queueSize": 2,
    "activeRequests": 1
  }
}
```

### Error Handling

**Server Error Response:**
```json
{
  "type": "error",
  "error": "Invalid message format",
  "timestamp": "2024-01-14T12:00:00.000Z"
}
```

## Event Flow

1. **CLI sends request** to `POST /api/images/generate`
2. **Server creates** `ImageGenerationRequestedEvent`
3. **Server forwards** request to available Chrome extension via WebSocket
4. **Extension processes** the request and generates image
5. **Extension sends** `image_generated` message back to server
6. **Server downloads** the image to local storage
7. **Server emits** `ImageGeneratedEvent`
8. **CLI can poll** status via `GET /api/images/:requestId/status`
9. **CLI retrieves** result via `GET /api/images/:requestId`

## Image Storage

Generated images are stored in the `generated-images/` directory with the following naming convention:

```
{requestId}_{timestamp}.png
```

Example:
```
generated-images/550e8400-e29b-41d4-a716-446655440000_1705238520000.png
```

## Error Codes

| Code | Description |
|------|-------------|
| `ERR_NO_EXTENSION` | No Chrome extension available to handle request |
| `ERR_INVALID_PROMPT` | Invalid or missing prompt |
| `ERR_RATE_LIMIT` | Rate limit exceeded |
| `ERR_GENERATION_FAILED` | Image generation failed |
| `ERR_DOWNLOAD_FAILED` | Failed to download generated image |
| `ERR_TIMEOUT` | Request timed out |

## Rate Limiting

- **Default limit:** 10 requests per minute per user
- **Burst limit:** 20 requests
- **Headers returned:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets

## CLI Integration Example

```bash
# Generate an image
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic cityscape at night",
    "model": "dall-e-3",
    "parameters": {
      "width": 1024,
      "height": 1024,
      "quality": "hd"
    },
    "userId": "cli-user"
  }'

# Check status
curl http://localhost:3000/api/images/550e8400-e29b-41d4-a716-446655440000/status

# Get result
curl http://localhost:3000/api/images/550e8400-e29b-41d4-a716-446655440000
```

## Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# WebSocket Configuration
WS_PORT=3001
WS_PATH=/ws

# Image Storage
IMAGE_STORAGE_PATH=./generated-images
MAX_IMAGE_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Timeouts
REQUEST_TIMEOUT_MS=300000  # 5 minutes
DOWNLOAD_TIMEOUT_MS=60000  # 1 minute
```

## Security Considerations

1. **Authentication**: Implement JWT tokens for CLI authentication
2. **CORS**: Configure appropriate CORS headers for browser extensions
3. **Input Validation**: Sanitize and validate all user inputs
4. **Rate Limiting**: Implement per-user and global rate limits
5. **File Security**: Ensure downloaded images are scanned and validated
6. **HTTPS**: Use HTTPS in production environments
7. **WebSocket Security**: Implement WSS (WebSocket Secure) in production

## Monitoring and Logging

- All requests are logged with correlation IDs
- WebSocket connections are monitored with heartbeat checks
- Failed requests are logged with error details
- Performance metrics are tracked for image generation times

## Future Enhancements

1. **Batch Processing**: Support multiple image generation in single request
2. **Webhooks**: Notify CLI when image is ready instead of polling
3. **Image Variations**: Support generating variations of existing images
4. **Queue Management**: Implement priority queues for different user tiers
5. **Caching**: Cache frequently requested images
6. **CDN Integration**: Serve images through CDN for better performance