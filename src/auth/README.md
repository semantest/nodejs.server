# JWT Authentication System for Semantest

## Overview

This directory contains a production-ready JWT authentication system for the Semantest platform, implementing secure authentication for both HTTP REST APIs and WebSocket connections.

## Features

- **RS256 (RSA) Algorithm**: Asymmetric key cryptography for enhanced security
- **Dual Token System**: Short-lived access tokens (15 min) and long-lived refresh tokens (7 days)
- **Secure Token Storage**: Refresh tokens stored in httpOnly cookies
- **Token Rotation**: Automatic refresh token rotation on use
- **Token Blacklisting**: Immediate revocation support for logout
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Track and manage active user sessions
- **Role-Based Access**: Support for user roles and permissions
- **Extension Authentication**: API key-based auth for browser extensions
- **WebSocket Auth**: Secure WebSocket connections with JWT

## Architecture

### Core Components

1. **TokenManager** (`infrastructure/token-manager.ts`)
   - Handles JWT generation, validation, and blacklisting
   - Manages RSA keys for token signing
   - Implements token rotation and cleanup

2. **AuthService** (`application/auth-service.ts`)
   - Main authentication business logic
   - User registration and login
   - Session management
   - Password management

3. **JWT Middleware** (`infrastructure/jwt-middleware.ts`)
   - Express middleware for route protection
   - WebSocket authentication handler
   - Role-based access control

4. **Auth Controller** (`infrastructure/auth-controller.ts`)
   - REST API endpoints for authentication
   - Rate limiting configuration
   - Request validation

### Domain Entities

- **User**: Core user entity with authentication data
- **Session**: Active user session tracking
- **UserRepository**: Interface for user persistence
- **SessionRepository**: Interface for session persistence

## API Endpoints

### Public Endpoints

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password or extensionId/apiKey
- `POST /auth/refresh` - Refresh access token
- `GET /auth/verify-token` - Verify token validity

### Protected Endpoints

- `POST /auth/logout` - Logout current session
- `POST /auth/logout-all` - Logout all sessions
- `GET /auth/me` - Get current user info
- `POST /auth/change-password` - Change password
- `POST /auth/generate-api-key` - Generate API key for extension
- `GET /auth/sessions` - List active sessions
- `DELETE /auth/sessions/:id` - Terminate specific session

## Usage Examples

### 1. Basic Setup

```typescript
import { TokenManager } from './auth/infrastructure/token-manager';
import { AuthService } from './auth/application/auth-service';
import { createAuthRouter } from './auth/infrastructure/auth-controller';

// Initialize components
const tokenManager = new TokenManager();
const authService = new AuthService(tokenManager, userRepo, sessionRepo);

// Add to Express app
const authRouter = createAuthRouter(authService, tokenManager);
app.use('/auth', authRouter);
```

### 2. Protecting Routes

```typescript
import { createJWTMiddleware, requireRoles } from './auth/infrastructure/jwt-middleware';

// Protect all routes
app.use(createJWTMiddleware({ tokenManager }));

// Role-based protection
app.get('/admin', 
  createJWTMiddleware({ tokenManager }),
  requireRoles('admin'),
  (req, res) => {
    res.json({ message: 'Admin only' });
  }
);
```

### 3. Client-Side Usage

```javascript
// Register
const register = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

// Login
const login = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const { accessToken } = await login.json();

// Use token
const response = await fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Refresh token
const refresh = await fetch('/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Sends refresh token cookie
});
```

### 4. WebSocket Authentication

```javascript
// Connect with token in query
const ws = new WebSocket(`ws://localhost:3004/ws?token=${accessToken}`);

// Or with Authorization header (if supported by client)
const ws = new WebSocket('ws://localhost:3004/ws', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## Security Features

### Token Security
- RS256 algorithm with 2048-bit RSA keys
- Short-lived access tokens (15 minutes)
- Secure httpOnly cookies for refresh tokens
- Automatic token rotation
- Token blacklisting on logout

### Request Security
- Rate limiting on auth endpoints
- Password complexity requirements
- Account lockout after failed attempts
- CORS configuration
- Security headers (Helmet)

### Session Security
- Session tracking and management
- Ability to terminate individual sessions
- Session expiry enforcement
- IP and user agent tracking

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=production
PORT=3003

# CORS
CORS_ORIGINS=https://app.semantest.com,https://extension.semantest.com

# Token Settings (optional, defaults shown)
JWT_ISSUER=semantest-auth
JWT_AUDIENCE=semantest-api
```

### RSA Key Management

Keys are automatically generated in development. For production:

1. Generate RSA key pair:
```bash
# Private key
openssl genrsa -out keys/private.key 2048

# Public key
openssl rsa -in keys/private.key -pubout -out keys/public.key
```

2. Secure the keys:
```bash
chmod 600 keys/private.key
chmod 644 keys/public.key
```

## Best Practices

1. **Always use HTTPS** in production
2. **Rotate RSA keys** periodically
3. **Monitor authentication failures** for security threats
4. **Implement proper logging** for audit trails
5. **Use environment-specific configurations**
6. **Regular token cleanup** to prevent memory issues
7. **Implement database persistence** for production (replace in-memory stores)

## Production Considerations

1. **Database Integration**: Replace in-memory repositories with database implementations
2. **Redis Integration**: Use Redis for token blacklist and session storage
3. **Key Rotation**: Implement automatic RSA key rotation
4. **Monitoring**: Add authentication metrics and alerts
5. **Audit Logging**: Log all authentication events
6. **Backup**: Regular backup of user data and keys

## Testing

Run the sample integration tests:

```typescript
import { testAuthentication } from './auth/sample-integration';
await testAuthentication();
```

## Troubleshooting

### Common Issues

1. **"RSA keys not found"**: Generate keys or set NODE_ENV=development
2. **"Token expired"**: Implement automatic token refresh on client
3. **"Too many requests"**: Rate limit hit, wait before retrying
4. **WebSocket auth fails**: Ensure token is passed correctly

### Debug Mode

Enable debug logging:
```javascript
console.log(tokenManager.getTokenStats());
```

## License

This authentication system is part of the Semantest platform and is licensed under GPL-3.0.