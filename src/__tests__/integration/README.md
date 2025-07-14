# Semantest Integration Tests

This directory contains comprehensive integration tests for the Semantest security system, testing the complete interaction between JWT authentication, CSRF protection, rate limiting, and the Express/WebSocket servers.

## Test Structure

### 1. `integration-test-setup.ts`
Shared test infrastructure providing:
- Test server creation with configurable security components
- User creation and authentication helpers
- WebSocket connection utilities
- Rate limit testing helpers
- Concurrent request simulation
- Test data cleanup

### 2. `auth-flow.integration.test.ts`
Complete authentication workflow testing:
- Full user lifecycle: registration → login → access → logout
- Multi-device session management
- Token refresh and rotation
- Account lockout after failed attempts
- Concurrent user authentication
- Session expiration handling

### 3. `api-security.integration.test.ts`
API endpoint security testing:
- CSRF protection enforcement
- Rate limiting per user and endpoint
- Security header validation
- Input sanitization and validation
- Request size limits
- Error handling without information leakage
- Performance under security load

### 4. `websocket-security.integration.test.ts`
WebSocket server security testing:
- JWT-based WebSocket authentication
- Message validation and sanitization
- Connection-level rate limiting
- Session tracking and management
- Heartbeat and health monitoring
- Concurrent connection handling
- Integration with HTTP authentication

### 5. `store-integration.test.ts`
Database/store integration testing:
- Redis integration for rate limiting
- In-memory fallback behavior
- Session storage and retrieval
- Token blacklist management
- CSRF token storage
- Store failover and recovery
- Performance under load

### 6. `multi-component.integration.test.ts`
Cross-component security scenarios:
- Complete user journeys with all security layers
- Multi-user concurrent operations
- Attack scenario defense (brute force, CSRF, DDoS)
- Security monitoring and alerting
- System resilience and recovery
- Compliance verification

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suites
npm run test:integration:auth    # Authentication flows
npm run test:integration:api     # API security
npm run test:integration:ws      # WebSocket security
npm run test:integration:store   # Store integration
npm run test:integration:multi   # Multi-component scenarios

# Run all tests (unit + integration)
npm run test:all
```

## Prerequisites

### Required Services
- **Redis** (optional): For testing Redis-based rate limiting
  ```bash
  docker run -d -p 6379:6379 redis:alpine
  ```

### Environment Variables
```bash
# Redis configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Rate limiting
RATE_LIMIT_STORE=memory  # or 'redis'
RATE_LIMIT_MEMORY_MAX_SIZE=10000
RATE_LIMIT_CLEANUP_INTERVAL=60000

# Security
JWT_SECRET=test-secret-key
JWT_REFRESH_SECRET=test-refresh-secret
```

## Test Features

### Security Testing
- **Authentication**: JWT token generation, validation, refresh
- **Authorization**: Role-based access control
- **CSRF Protection**: Token generation, validation, rotation
- **Rate Limiting**: Per-user, per-endpoint, burst protection
- **Session Management**: Multi-device, expiration, revocation

### Performance Testing
- Concurrent user simulation
- High-throughput scenarios
- Latency measurements
- Resource usage monitoring

### Resilience Testing
- Component failure recovery
- Fallback mechanisms
- Attack scenario defense
- System stability under load

## Test Patterns

### Creating Authenticated Users
```typescript
const { user, tokens, csrfToken } = await testHelper.createAuthenticatedUser(server, {
  email: 'test@example.com',
  password: 'SecurePass123!',
  roles: ['user', 'admin']
});
```

### WebSocket Testing
```typescript
const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
const message = await testHelper.waitForWSMessage(ws, 'authentication_success');
```

### Concurrent Operations
```typescript
const results = await testHelper.makeConcurrentRequests(
  requestFunctions,
  { maxConcurrent: 20, delayBetween: 50 }
);
```

### Rate Limit Testing
```typescript
await testHelper.exhaustRateLimit(server, identifier, endpoint, limit);
```

## Best Practices

1. **Test Isolation**: Each test cleans up its data using `beforeEach`
2. **Real Components**: Tests use actual server instances, not mocks
3. **Async Handling**: Proper async/await usage for all operations
4. **Error Scenarios**: Tests include both success and failure paths
5. **Performance Awareness**: Tests measure and assert on performance
6. **Security Focus**: Every test validates security constraints

## Debugging

Enable debug logging:
```bash
DEBUG=semantest:* npm run test:integration
```

Run specific tests:
```bash
npm test -- --testNamePattern="should complete full authentication lifecycle"
```

## Contributing

When adding new integration tests:
1. Use the shared test infrastructure in `integration-test-setup.ts`
2. Clean up all resources in `afterAll` hooks
3. Test both success and failure scenarios
4. Include performance assertions where relevant
5. Document complex test scenarios
6. Ensure tests run independently (no shared state)