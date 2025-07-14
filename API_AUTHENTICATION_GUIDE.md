# Semantest Node.js Server - API Authentication Guide

## Overview

The Semantest Node.js server implements a comprehensive JWT-based authentication system with enterprise-grade security features. This guide covers authentication flows, security features, and API usage.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Security Features](#security-features)
3. [API Endpoints](#api-endpoints)
4. [Token Management](#token-management)
5. [CSRF Protection](#csrf-protection)
6. [Rate Limiting](#rate-limiting)
7. [Security Monitoring](#security-monitoring)
8. [Integration Examples](#integration-examples)

## Authentication Flow

### 1. Registration
```
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe"
}

Response:
{
  "userId": "user_123",
  "email": "user@example.com",
  "username": "johndoe",
  "createdAt": "2025-01-14T12:00:00Z"
}
```

### 2. Login
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "user_123",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

### 3. Token Refresh
```
POST /auth/refresh
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
}

Response:
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### 4. Logout
```
POST /auth/logout
Authorization: Bearer <access_token>

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Security Features

### JWT Token Security
- **Algorithm**: RS256 (RSA 2048-bit keys)
- **Access Token Expiry**: 15 minutes
- **Refresh Token Expiry**: 7 days
- **Token Rotation**: Automatic on refresh
- **Blacklisting**: Immediate revocation support

### Enhanced Security (New)
- **IP Binding**: Tokens bound to originating IP
- **Device Fingerprinting**: Tokens bound to device
- **Short-lived Tokens**: 5-minute expiry for sensitive operations
- **Anomaly Detection**: Suspicious activity monitoring
- **Audit Logging**: Comprehensive security event logging

## API Endpoints

### Public Endpoints (No Authentication Required)
- `GET /health` - Server health check
- `GET /info` - Server information
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `GET /auth/csrf-token` - Get CSRF token

### Protected Endpoints (Authentication Required)

#### Standard API Endpoints
```
Authorization: Bearer <access_token>
```

- `POST /api/automation/dispatch` - Dispatch automation request
- `GET /api/extensions` - List connected extensions
- `GET /api/metrics` - Server metrics
- `GET /api/websocket/info` - WebSocket connection info

#### Admin Endpoints (Admin Role Required)
```
Authorization: Bearer <access_token>
```

- `GET /api/rate-limit/status` - Rate limiting status
- `POST /api/rate-limit/reset` - Reset rate limits

#### CSRF-Protected Endpoints
```
Authorization: Bearer <access_token>
X-CSRF-Token: <csrf_token>
```

- `POST /api/automation/dispatch` - Requires both JWT and CSRF token

## Token Management

### Access Token Structure
```json
{
  "userId": "user_123",
  "extensionId": "ext_456",
  "sessionId": "session_789",
  "roles": ["user"],
  "iat": 1234567890,
  "exp": 1234568790,
  "iss": "semantest-auth",
  "aud": "semantest-api",
  "jti": "unique_token_id",
  "ip": "192.168.1.1",
  "deviceFingerprint": "abc123..."
}
```

### Using Tokens

#### HTTP Requests
```javascript
// Include in Authorization header
fetch('/api/extensions', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIs...',
    'Content-Type': 'application/json'
  }
});
```

#### WebSocket Connections
```javascript
// Send auth message after connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'eyJhbGciOiJSUzI1NiIs...'
}));
```

## CSRF Protection

### Getting CSRF Token
```javascript
// Automatically set as cookie on GET requests
const response = await fetch('/auth/csrf-token');
const { csrfToken } = await response.json();
```

### Using CSRF Token
```javascript
// Include in header for state-changing requests
fetch('/api/automation/dispatch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <access_token>',
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

## Rate Limiting

### Default Limits
- **Authentication endpoints**: 5 requests per 15 minutes
- **API endpoints**: 100 requests per minute
- **Admin endpoints**: 10 requests per minute

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### Handling Rate Limits
```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

## Security Monitoring

### Security Events Logged
- Login attempts (successful/failed)
- Token refresh operations
- Suspicious activities (IP/device mismatches)
- Rate limit violations
- Authorization failures

### Querying Security Logs (Admin Only)
```
GET /api/security/logs?startDate=2025-01-14&eventType=login
Authorization: Bearer <admin_token>
```

### Security Alerts
High severity events trigger immediate alerts:
- Multiple failed login attempts
- Token reuse attempts
- Anomalous access patterns
- Critical rate limit violations

## Integration Examples

### Complete Authentication Flow
```javascript
class SemantestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
    this.csrfToken = null;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    
    // Get CSRF token
    await this.getCsrfToken();
    
    return data;
  }

  async getCsrfToken() {
    const response = await fetch(`${this.baseUrl}/auth/csrf-token`);
    const data = await response.json();
    this.csrfToken = data.csrfToken;
  }

  async makeAuthenticatedRequest(path, options = {}) {
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers
    });

    // Handle token expiry
    if (response.status === 401) {
      await this.refreshAccessToken();
      // Retry request with new token
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      return fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers
      });
    }

    return response;
  }

  async refreshAccessToken() {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
  }

  async logout() {
    await this.makeAuthenticatedRequest('/auth/logout', {
      method: 'POST'
    });
    
    this.accessToken = null;
    this.refreshToken = null;
    this.csrfToken = null;
  }
}

// Usage
const client = new SemantestClient('http://localhost:3000');
await client.login('user@example.com', 'password');

// Make authenticated requests
const response = await client.makeAuthenticatedRequest('/api/extensions');
const extensions = await response.json();
```

### WebSocket Authentication
```javascript
class AuthenticatedWebSocket {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      // Send authentication immediately after connection
      this.authenticate();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'authSuccess') {
        console.log('WebSocket authenticated successfully');
        this.onAuthenticated();
      } else if (message.type === 'authError') {
        console.error('WebSocket authentication failed:', message.error);
        this.ws.close();
      }
    };
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'auth',
      token: this.token
    }));
  }

  onAuthenticated() {
    // Now you can send other messages
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'automation-events'
    }));
  }
}
```

## Best Practices

1. **Token Storage**
   - Store access tokens in memory (not localStorage)
   - Store refresh tokens in httpOnly cookies
   - Clear tokens on logout

2. **Error Handling**
   - Handle 401 errors by refreshing token
   - Handle 429 errors with exponential backoff
   - Log security-related errors

3. **Security Headers**
   - Always include CSRF token for state changes
   - Use HTTPS in production
   - Validate SSL certificates

4. **Session Management**
   - Implement auto-refresh before token expiry
   - Handle concurrent requests during refresh
   - Clear all tokens on security errors

## Troubleshooting

### Common Issues

1. **"Token IP mismatch" error**
   - Token was created from different IP
   - Solution: Re-authenticate from current IP

2. **"Token too old for this operation" error**
   - Accessing sensitive endpoint with old token
   - Solution: Re-authenticate to get fresh token

3. **"CSRF token invalid" error**
   - CSRF token expired or missing
   - Solution: Get new CSRF token before request

4. **Rate limiting errors**
   - Too many requests in time window
   - Solution: Implement request queuing/throttling

### Debug Mode

Enable debug logging for authentication:
```bash
DEBUG=semantest:auth npm start
```

This will log:
- Token verification details
- Authentication decisions
- Security events
- Rate limiting information

---

For additional support or security concerns, contact: security@semantest.com