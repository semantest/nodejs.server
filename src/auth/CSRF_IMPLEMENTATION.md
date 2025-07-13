# CSRF Protection Implementation for Semantest

## Overview

This document describes the comprehensive CSRF (Cross-Site Request Forgery) protection system implemented for the Semantest platform. The implementation uses a double-submit cookie pattern with stateless operation, cryptographically secure token generation, and Chrome extension exemption.

## Architecture

### Core Components

1. **CSRFService** (`csrf-service.ts`) - Token generation and validation service
2. **CSRF Middleware** (`csrf-middleware.ts`) - Express middleware for protection
3. **CSRF Helpers** (`csrf-helpers.ts`) - Utility functions for forms and AJAX
4. **Client Library** (`csrf-client.js`) - Browser-side token handling

### Security Features

- **Double-submit cookie pattern** for stateless operation
- **Cryptographically secure tokens** using HMAC-SHA256
- **Per-session token binding** for enhanced security
- **Automatic token rotation** on authentication events
- **Chrome extension exemption** via origin/header validation
- **Configurable token expiry** (default: 1 hour)

## Usage Guide

### Server-Side Implementation

#### 1. Basic Setup

```typescript
import { CSRFService } from './auth/infrastructure/csrf-service';
import { createCSRFMiddlewareWithAuth } from './auth/infrastructure/csrf-middleware';

// Initialize CSRF service
const csrfService = new CSRFService({
  cookieName: 'semantest-csrf-token',
  headerName: 'X-CSRF-Token',
  tokenLength: 32,
  tokenExpiry: 3600000, // 1 hour
  secureCookie: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
});

// Add CSRF middleware to protected routes
app.use('/api', createCSRFMiddlewareWithAuth(csrfService, {
  allowedExtensionIds: ['your-extension-id'],
  skipPaths: ['/auth/login', '/auth/register']
}));
```

#### 2. Integration with JWT Authentication

The CSRF system is automatically integrated with the existing JWT authentication:

```typescript
// Protected route with both JWT and CSRF protection
app.post('/api/protected-endpoint',
  createJWTMiddleware({ tokenManager }),
  createCSRFMiddlewareWithAuth(csrfService),
  (req, res) => {
    // Both JWT and CSRF tokens are validated
    res.json({ success: true, userId: req.user.userId });
  }
);
```

#### 3. Chrome Extension Exemption

Extensions are automatically detected and exempted from CSRF protection:

```typescript
// Extension requests are exempt when they include:
// - Origin: chrome-extension://extension-id
// - X-Extension-Id: extension-id header
```

### Client-Side Implementation

#### 1. Automatic Protection (Recommended)

Include the CSRF client library for automatic protection:

```html
<script src="/auth/csrf-client.js"></script>
<!-- CSRF protection is automatically initialized -->
```

#### 2. Manual Token Handling

```javascript
// Get CSRF token
const token = CSRF.getCurrentToken();

// Add to AJAX request
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token
  },
  body: JSON.stringify(data),
  credentials: 'include'
});

// Add to form
CSRF.addTokenToForm(document.getElementById('my-form'));
```

#### 3. Form Integration

```html
<!-- Manual form token -->
<form action="/api/submit" method="POST">
  <input type="hidden" name="csrf_token" value="{{csrfToken}}">
  <!-- other form fields -->
</form>

<!-- Automatic form protection -->
<form action="/api/submit" method="POST" data-csrf-protected="true">
  <!-- CSRF token will be added automatically -->
</form>
```

## API Endpoints

### CSRF Token Management

- `GET /auth/csrf-token` - Get current CSRF token
- `POST /auth/csrf-rotate` - Rotate CSRF token (requires authentication)
- `POST /auth/logout` - Clear CSRF tokens

### Example Responses

```json
// GET /auth/csrf-token
{
  "csrfToken": "abc123...",
  "headerName": "X-CSRF-Token",
  "cookieName": "semantest-csrf-token",
  "timestamp": "2023-12-07T10:30:00.000Z"
}

// Error response
{
  "error": "CSRF Protection Error",
  "type": "missing_token",
  "message": "CSRF token missing from request header",
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## Configuration Options

### CSRFService Configuration

```typescript
interface CSRFConfig {
  cookieName: string;        // Cookie name for token storage
  headerName: string;        // Header name for token transmission
  tokenLength: number;       // Token length in bytes
  tokenExpiry: number;       // Token expiry in milliseconds
  secureCookie: boolean;     // HTTPS-only cookies
  sameSite: 'strict' | 'lax' | 'none';
  httpOnly: boolean;         // JavaScript access to cookies
}
```

### Middleware Configuration

```typescript
interface CSRFMiddlewareOptions {
  csrfService: CSRFService;
  skipMethods?: string[];           // ['GET', 'HEAD', 'OPTIONS']
  skipPaths?: string[];             // Paths to skip CSRF protection
  allowedExtensionIds?: string[];   // Allowed Chrome extension IDs
  requireAuthentication?: boolean;  // Require JWT authentication
  customErrorHandler?: Function;    // Custom error handling
}
```

## Security Considerations

### Double-Submit Cookie Pattern

The implementation uses the double-submit cookie pattern:

1. CSRF token is sent as both a cookie and request header/form field
2. Server validates that both values match
3. This prevents CSRF attacks as attackers cannot read cross-origin cookies

### Token Security

- Tokens are cryptographically secure (HMAC-SHA256)
- Tokens include timestamp and signature for integrity
- Tokens are bound to user sessions when authentication is enabled
- Automatic token rotation on authentication events

### Extension Security

- Extensions are validated against allowed extension IDs
- Origin header validation for extension requests
- Custom header (`X-Extension-Id`) for additional validation

## Error Handling

### CSRF Error Types

- `missing_token` - Token not provided in header or cookie
- `invalid_token` - Token validation failed
- `token_mismatch` - Header and cookie tokens don't match
- `expired_token` - Token has expired
- `validation_error` - Internal validation error

### Client-Side Error Recovery

The client library automatically handles CSRF errors:

1. Detects 403 responses indicating CSRF failure
2. Automatically refreshes token from server
3. Retries failed requests with new token
4. Provides events for custom error handling

```javascript
// Listen for CSRF events
document.addEventListener('csrf:tokenRefreshed', event => {
  console.log('Token refreshed:', event.detail.token);
});

document.addEventListener('csrf:refreshError', event => {
  console.error('Token refresh failed:', event.detail.error);
});
```

## Development and Testing

### Development Mode

For development, use the relaxed CSRF middleware:

```typescript
import { createDevCSRFMiddleware } from './csrf-middleware';

if (process.env.NODE_ENV === 'development') {
  app.use(createDevCSRFMiddleware(csrfService));
}
```

### Testing CSRF Protection

```typescript
// Test valid token
const response = await fetch('/api/test', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': validToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data),
  credentials: 'include'
});

// Test invalid token (should return 403)
const response = await fetch('/api/test', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': 'invalid-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data),
  credentials: 'include'
});
```

## Monitoring and Metrics

### Token Statistics

```typescript
const stats = csrfService.getTokenStats();
console.log('CSRF Stats:', stats);
// {
//   totalTokens: 150,
//   activeTokens: 140,
//   expiredTokens: 10,
//   config: { ... }
// }
```

### Logging

The system provides comprehensive logging:

- Token generation and validation
- Extension request detection
- Error occurrences and recovery
- Token rotation events

## Performance Considerations

### Memory Usage

- Tokens are stored in memory with automatic cleanup
- Expired tokens are cleaned up every 5 minutes
- Token store size is self-limiting based on expiry

### Cookie Overhead

- CSRF cookies are small (typically 64-128 bytes)
- Cookies are sent only to same-origin requests
- Secure and HttpOnly flags minimize exposure

## Compliance and Standards

### OWASP Recommendations

The implementation follows OWASP CSRF prevention guidelines:

- ✅ Double-submit cookie pattern
- ✅ Cryptographically secure tokens
- ✅ Token validation on state-changing requests
- ✅ Proper error handling and logging
- ✅ Framework integration (Express.js)

### Security Headers

Recommended security headers to complement CSRF protection:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
```

## Troubleshooting

### Common Issues

1. **Token Missing**: Ensure cookies are enabled and same-origin
2. **Token Mismatch**: Check for token rotation during request
3. **Extension Blocked**: Verify extension ID in allowed list
4. **Token Expired**: Implement automatic token refresh

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
// Client-side debugging
window.CSRF.updateConfig({ debugMode: true });

// Server-side debugging
process.env.CSRF_DEBUG = 'true';
```

## Migration Guide

### From No CSRF Protection

1. Install CSRF middleware after body parsing
2. Add token endpoints to authentication routes
3. Include client library in web pages
4. Test with existing forms and AJAX requests

### Integration Checklist

- [ ] CSRF service configured and initialized
- [ ] Middleware added to protected routes
- [ ] Client library included in web pages
- [ ] Extension IDs configured for exemption
- [ ] Error handling implemented
- [ ] Monitoring and logging enabled
- [ ] Testing completed

## Files Reference

- `/src/auth/infrastructure/csrf-service.ts` - Core CSRF service
- `/src/auth/infrastructure/csrf-middleware.ts` - Express middleware
- `/src/auth/infrastructure/csrf-helpers.ts` - Server-side utilities
- `/src/auth/csrf-client.js` - Client-side library
- `/src/auth/sample-csrf-form.html` - Example implementation
- `/src/server/adapters/http-server-adapter-with-auth.ts` - Integration example

This CSRF protection system provides robust security against CSRF attacks while maintaining compatibility with the existing JWT authentication system and Chrome extension integration.