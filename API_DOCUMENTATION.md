# Semantest Node.js Server API Documentation

## Overview

The Semantest Node.js Server provides RESTful APIs for queue management, message storage, item history tracking, and system monitoring. All endpoints return JSON responses with consistent error formatting.

## Base URL

```
http://localhost:3003/api
```

## Authentication

Currently, no authentication is required. Future versions will support API key authentication via the `Authorization` header.

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Queue Operations**: 30 requests per minute per IP
- **Message Operations**: 50 requests per minute per IP
- **Sensitive Operations**: 10 requests per 15 minutes per IP

Rate limit errors return status code `429` with retry information.

## Common Response Formats

### Success Response

```json
{
  "data": { ... },
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "Error Type",
  "message": "Human-readable error description",
  "timestamp": "2025-07-25T12:00:00.000Z",
  "details": { ... } // Optional additional error details
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## API Endpoints

### Queue Management

#### Enqueue Item

Add an item to the download queue.

**Endpoint:** `POST /api/queue/enqueue`

**Request Body:**
```json
{
  "url": "https://example.com/image.jpg",  // Required, valid HTTP(S) URL
  "priority": "normal",                     // Optional: "high", "normal", "low"
  "addon_id": "extension_123",              // Optional
  "metadata": {                             // Optional, max 10KB
    "custom": "data"
  },
  "ai_tool": {                              // Optional
    "toolId": "dall-e",
    "activationRequired": true
  },
  "headers": {                              // Optional
    "Authorization": "Bearer token"
  },
  "callback_url": "https://webhook.url"    // Optional
}
```

**Success Response:** `201 Created`
```json
{
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://example.com/image.jpg",
    "priority": "normal",
    "status": "pending",
    "created_at": "2025-07-25T12:00:00.000Z",
    "attempts": 0
  },
  "position": 5,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid URL or parameters
- `429` - Rate limit exceeded

#### Get Queue Status

Get current queue statistics and health.

**Endpoint:** `GET /api/queue/status`

**Success Response:** `200 OK`
```json
{
  "status": {
    "queueSizes": {
      "high": 2,
      "normal": 10,
      "low": 5,
      "processing": 3,
      "dlq": 1
    },
    "totalEnqueued": 100,
    "totalProcessed": 79,
    "totalFailed": 1,
    "totalInDLQ": 1,
    "avgProcessingTime": 2500,
    "currentRate": 0.5
  },
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

#### Get Queue Item

Get details of a specific queue item.

**Endpoint:** `GET /api/queue/item/:id`

**URL Parameters:**
- `id` - UUID of the queue item

**Success Response:** `200 OK`
```json
{
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://example.com/image.jpg",
    "priority": "normal",
    "status": "completed",
    "created_at": "2025-07-25T12:00:00.000Z",
    "started_at": "2025-07-25T12:00:05.000Z",
    "completed_at": "2025-07-25T12:00:10.000Z",
    "attempts": 1,
    "result": {
      "filename": "image_123.jpg",
      "size": 1024000
    }
  },
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid ID format
- `404` - Item not found

#### Cancel Queue Item

Cancel a pending or processing queue item.

**Endpoint:** `DELETE /api/queue/item/:id`

**URL Parameters:**
- `id` - UUID of the queue item

**Success Response:** `200 OK`
```json
{
  "message": "Item cancelled successfully",
  "itemId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Cannot cancel (already completed or processing)
- `404` - Item not found

#### Get Dead Letter Queue

Get items that have failed maximum retry attempts.

**Endpoint:** `GET /api/queue/dlq`

**Success Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com/failed.jpg",
      "priority": "high",
      "status": "failed",
      "attempts": 3,
      "last_error": "Connection timeout",
      "failed_at": "2025-07-25T12:00:00.000Z"
    }
  ],
  "count": 1,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

#### Retry DLQ Item

Retry a failed item from the Dead Letter Queue.

**Endpoint:** `POST /api/queue/dlq/:id/retry`

**URL Parameters:**
- `id` - UUID of the DLQ item

**Success Response:** `200 OK`
```json
{
  "message": "Item requeued from DLQ",
  "itemId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

**Error Responses:**
- `404` - Item not found in DLQ
- `429` - Rate limit exceeded (sensitive operation)

### Message Store

#### Get Messages

Retrieve stored messages with optional filtering.

**Endpoint:** `GET /api/messages`

**Query Parameters:**
- `namespace` - Filter by namespace
- `type` - Filter by message type
- `addon_id` - Filter by addon ID
- `limit` - Maximum results (default: 100, max: 1000)
- `offset` - Pagination offset (default: 0)

**Success Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "msg_123",
      "namespace": "download",
      "type": "completed",
      "addon_id": "extension_123",
      "payload": { ... },
      "created_at": "2025-07-25T12:00:00.000Z"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

#### Get Recent Messages

Get the most recent messages.

**Endpoint:** `GET /api/messages/recent`

**Query Parameters:**
- `limit` - Number of messages (default: 10, max: 100)

**Success Response:** `200 OK`
```json
{
  "messages": [ ... ],
  "count": 10,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

### Item History

#### Get Items

Retrieve all items with pagination.

**Endpoint:** `GET /api/items`

**Query Parameters:**
- `limit` - Maximum results (default: 100)
- `offset` - Pagination offset (default: 0)

**Success Response:** `200 OK`
```json
{
  "items": [
    {
      "item_id": "item_123",
      "name": "Test Item",
      "type": "image",
      "status": "active",
      "created_at": "2025-07-25T12:00:00.000Z",
      "updated_at": "2025-07-25T12:00:00.000Z"
    }
  ],
  "total": 50,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

#### Get Item History

Get the complete history of changes for an item.

**Endpoint:** `GET /api/item/:item_id/history`

**URL Parameters:**
- `item_id` - ID of the item

**Success Response:** `200 OK`
```json
{
  "item_id": "item_123",
  "current": {
    "name": "Updated Item",
    "type": "image",
    "status": "active"
  },
  "history": [
    {
      "version": 2,
      "timestamp": "2025-07-25T12:00:00.000Z",
      "action": "update",
      "changes": {
        "name": {
          "from": "Test Item",
          "to": "Updated Item"
        }
      },
      "user_id": "user_456"
    }
  ],
  "total_versions": 2,
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

### Monitoring & Metrics

#### Prometheus Metrics

Get metrics in Prometheus format.

**Endpoint:** `GET /api/metrics`

**Success Response:** `200 OK`
```
# HELP nodejs_process_uptime_seconds Process uptime in seconds
# TYPE nodejs_process_uptime_seconds gauge
nodejs_process_uptime_seconds 3600

# HELP queue_items_total Total items in queues by priority
# TYPE queue_items_total gauge
queue_items_total{priority="high"} 5
queue_items_total{priority="normal"} 10
queue_items_total{priority="low"} 3
```

#### JSON Metrics

Get metrics in JSON format for custom dashboards.

**Endpoint:** `GET /api/metrics/json`

**Success Response:** `200 OK`
```json
{
  "timestamp": "2025-07-25T12:00:00.000Z",
  "uptime": {
    "process": 3600,
    "system": 86400
  },
  "memory": {
    "process": { ... },
    "system": { ... }
  },
  "cpu": { ... },
  "application": {
    "queue": { ... },
    "messages": { ... },
    "websocket": { ... }
  }
}
```

### Health Checks

#### Basic Health

**Endpoint:** `GET /health`

**Success Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2025-07-25T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

#### Detailed Health

**Endpoint:** `GET /health/detailed`

**Success Response:** `200 OK`
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "queue": "healthy",
    "websocket": "healthy"
  },
  "metrics": { ... },
  "timestamp": "2025-07-25T12:00:00.000Z"
}
```

## WebSocket Events

The server also supports WebSocket connections for real-time updates on port 3004.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3004/ws');
```

### Authentication

Send authentication message after connection:
```json
{
  "type": "authenticate",
  "extensionId": "extension_123",
  "metadata": { ... }
}
```

### Event Types

- `queue:item:added` - New item added to queue
- `queue:item:started` - Item processing started
- `queue:item:completed` - Item processing completed
- `queue:item:failed` - Item processing failed
- `ai:tool:activating` - AI tool activation started
- `ai:tool:activated` - AI tool activated successfully
- `ai:tool:failed` - AI tool activation failed

## Error Handling

All endpoints follow consistent error handling:

1. **Validation Errors** (400)
   - Missing required fields
   - Invalid data types
   - Format violations

2. **Resource Errors** (404)
   - Item not found
   - Invalid resource ID

3. **Rate Limit Errors** (429)
   - Includes `retryAfter` in seconds
   - Per-IP tracking

4. **Server Errors** (500)
   - Unexpected errors
   - Database connection issues
   - Internal processing failures

## Security

- **CORS**: Configured for allowed origins
- **Rate Limiting**: Per-IP request limits
- **Input Validation**: All inputs validated and sanitized
- **Security Headers**: HSTS, X-Frame-Options, etc.
- **Request Size**: Limited to 10MB

## Best Practices

1. **Always check response status codes**
2. **Handle rate limit errors with exponential backoff**
3. **Use appropriate priorities for queue items**
4. **Implement proper error handling for all endpoints**
5. **Use WebSocket for real-time updates instead of polling**
6. **Include metadata for better tracking and debugging**

## Changelog

### v1.0.0 (2025-07-25)
- Initial release
- Queue management system
- Message store
- Item history tracking
- Monitoring endpoints
- Security hardening