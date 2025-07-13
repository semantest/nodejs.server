# Semantest Rate Limiting System

A comprehensive, production-ready rate limiting system for the Semantest platform with multi-tier limiting, advanced algorithms, and real-time monitoring.

## Features

### Core Capabilities
- **Multi-tier rate limiting** - Global, user, endpoint, and extension-specific limits
- **Multiple algorithms** - Token bucket, sliding window, and fixed window
- **Redis & in-memory stores** - Scalable storage with fallback options
- **Real-time monitoring** - Comprehensive metrics and alerting
- **Chrome extension support** - Special handling for browser extensions
- **Authentication integration** - Works seamlessly with JWT and CSRF systems

### Advanced Features
- **Intelligent tier selection** - Automatic tier assignment based on user type
- **Weighted requests** - Different endpoints can have different costs
- **Burst handling** - Token bucket algorithm handles traffic spikes
- **Audit logging** - Complete audit trail of rate limit violations
- **Health monitoring** - Self-monitoring with alerting capabilities
- **Environment-specific configs** - Different limits for dev/staging/production

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Middleware    │────│  Rate Limiting   │────│     Store       │
│   Integration   │    │     Service      │    │  (Redis/Memory) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Monitoring    │    │   Configuration  │    │   Analytics     │
│   & Alerting    │    │    Management    │    │   & Reporting   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### Basic Setup

```typescript
import { createDefaultRateLimitingSystem } from './security';

// Create rate limiting system with environment defaults
const rateLimiting = createDefaultRateLimitingSystem();

// Add to Express app
app.use(rateLimiting.createMiddleware());
```

### Custom Configuration

```typescript
import { createRateLimitingSystem } from './security';

const rateLimiting = createRateLimitingSystem({
  storeType: 'redis',
  redisConfig: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 1
  },
  monitoring: {
    enabled: true,
    alertWebhookUrl: 'https://your-webhook.com/alerts',
    slackWebhookUrl: 'https://hooks.slack.com/...'
  }
});
```

## Configuration

### Environment Variables

```bash
# Store Configuration
RATE_LIMIT_STORE=redis                    # 'redis' or 'memory'
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=1

# Memory Store Configuration
RATE_LIMIT_MEMORY_MAX_SIZE=10000
RATE_LIMIT_CLEANUP_INTERVAL=60000
RATE_LIMIT_MAX_AGE=3600000

# Monitoring Configuration
RATE_LIMIT_MONITORING=true
RATE_LIMIT_VIOLATIONS_PER_MINUTE=10
RATE_LIMIT_BLOCKED_PERCENTAGE=20
RATE_LIMIT_CRITICAL_VIOLATIONS=5

# Alert Configuration
RATE_LIMIT_WEBHOOK_URL=https://your-webhook.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts
RATE_LIMIT_ALERT_COOLDOWN=300000

# Extension Configuration
TRUSTED_EXTENSION_IDS=ext1,ext2,ext3
DEV_EXTENSION_IDS=dev1,dev2
ALLOWED_EXTENSION_IDS=allowed1,allowed2
```

### Rate Limit Tiers

| Tier | Purpose | Default Limits | Algorithm |
|------|---------|----------------|-----------|
| `global` | Per-IP limits | 1000/15min | Sliding Window |
| `user` | Per authenticated user | 120/min | Token Bucket |
| `anonymous` | Unauthenticated users | 100/15min | Fixed Window |
| `extension` | Chrome extensions | 300/min | Token Bucket |
| `admin` | Admin users | 500/min | Token Bucket |
| `auth` | Authentication endpoints | 20/15min | Fixed Window |
| `api` | API endpoints | 200/min | Sliding Window |
| `heavy` | Resource-intensive ops | 10/5min | Token Bucket |
| `realtime` | WebSocket/SSE | 100/10sec | Sliding Window |

### Endpoint Configuration

Rate limits are automatically applied based on endpoint patterns defined in `rate-limit-config.ts`:

```typescript
// Example endpoint configurations
{
  pattern: '/auth/login',
  method: 'POST',
  tiers: ['auth', 'global'],
  weight: 3  // Login attempts cost 3x normal requests
},
{
  pattern: /^\/api\/automation\//,
  method: 'POST', 
  tiers: ['api', 'user', 'extension'],
  weight: 2
}
```

## Algorithms

### Token Bucket
- **Best for**: Handling bursts while maintaining average rate
- **Use cases**: User actions, API calls, extension requests
- **Parameters**: `burstSize`, `refillRate`

```typescript
{
  algorithm: 'token-bucket',
  maxRequests: 120,      // Total tokens
  burstSize: 20,         // Max burst
  refillRate: 2,         // Tokens per second
  windowMs: 60000        // 1 minute window
}
```

### Sliding Window
- **Best for**: Smooth, accurate rate limiting
- **Use cases**: General API endpoints, real-time operations
- **Benefits**: No burst at window boundaries

```typescript
{
  algorithm: 'sliding-window', 
  maxRequests: 100,
  windowMs: 60000              // 1 minute window
}
```

### Fixed Window
- **Best for**: Simple, memory-efficient limiting
- **Use cases**: Authentication, heavy operations
- **Benefits**: Low memory usage, simple logic

```typescript
{
  algorithm: 'fixed-window',
  maxRequests: 20,
  windowMs: 900000            // 15 minute window
}
```

## Monitoring & Alerting

### Metrics

The system provides comprehensive metrics:

```typescript
interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number; 
  blockedRequests: number;
  byTier: Record<string, TierMetrics>;
  byEndpoint: Record<string, EndpointMetrics>;
  byUser: Record<string, UserMetrics>;
  violations: RateLimitViolation[];
  averageResponseTime: number;
  storeStats: StoreStats;
}
```

### Alerts

Automatic alerts are triggered for:
- High violation rates (>10 violations/minute)
- High block percentage (>20% of requests)
- Critical violations (severe violations)
- Store errors (Redis connection issues)

### Endpoints

#### Get Metrics (Admin Only)
```http
GET /api/metrics
Authorization: Bearer <admin-token>
```

#### Get Rate Limit Status (Admin Only)
```http
GET /api/rate-limit/status
Authorization: Bearer <admin-token>
```

#### Reset Rate Limits (Admin Only)
```http
POST /api/rate-limit/reset
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "identifier": "user:123", 
  "endpoint": "/api/automation/dispatch"
}
```

## Chrome Extension Integration

### Extension Types

Extensions are automatically classified:

- **Trusted**: Pre-approved extensions with higher limits
- **Development**: Extensions in development with moderate limits  
- **Unknown**: New/unverified extensions with strict limits

### Extension-Specific Headers

Extensions should include these headers:

```http
X-Extension-Id: your-extension-id
X-Requested-With: XMLHttpRequest
Authorization: Bearer <extension-token>
```

### Extension Limits

```typescript
// Trusted extensions
{
  maxRequests: 500,
  burstSize: 100, 
  refillRate: 8
}

// Development extensions  
{
  maxRequests: 200,
  burstSize: 40,
  refillRate: 3
}

// Unknown extensions
{
  maxRequests: 50,
  burstSize: 10,
  refillRate: 1
}
```

## Advanced Usage

### Custom Middleware

```typescript
import { createRateLimitMiddleware } from './security';

// Create endpoint-specific middleware
const heavyOperationLimiter = createRateLimitMiddleware({
  keyGenerator: (req) => `heavy:${req.user?.userId || req.ip}`,
  message: 'Heavy operation rate limit exceeded',
  statusCode: 429
});

app.post('/api/heavy-operation', heavyOperationLimiter, handler);
```

### Custom Key Generation

```typescript
const customMiddleware = createRateLimitMiddleware({
  keyGenerator: (req) => {
    // Combine user and extension for compound limiting
    const userId = req.user?.userId || 'anonymous';
    const extensionId = req.headers['x-extension-id'] || 'none';
    return `composite:${userId}:${extensionId}`;
  }
});
```

### Programmatic Rate Limit Checks

```typescript
import { RateLimitingService } from './security';

const rateLimiter = new RateLimitingService(store);

const result = await rateLimiter.checkRateLimit({
  identifier: 'user:123',
  endpoint: '/api/test',
  extensionId: 'ext-456',
  weight: 2
});

if (!result.allowed) {
  throw new Error(`Rate limited. Retry after ${result.retryAfter} seconds`);
}
```

## Performance Considerations

### Redis Store
- **Pros**: Shared across instances, persistent, fast
- **Cons**: Network latency, external dependency
- **Best for**: Production, multi-instance deployments

### Memory Store  
- **Pros**: Fastest access, no dependencies
- **Cons**: Not shared, lost on restart, memory usage
- **Best for**: Development, single-instance deployments

### Store Selection

```typescript
// Production: Use Redis for persistence and scaling
const prodStore = createRateLimitStore({
  type: 'redis',
  redis: { host: 'redis-cluster.internal' }
});

// Development: Use memory for simplicity
const devStore = createRateLimitStore({
  type: 'memory', 
  memory: { maxSize: 5000 }
});
```

## Testing

### Unit Tests

```typescript
import { InMemoryRateLimitStore, RateLimitingService } from './security';

describe('Rate Limiting', () => {
  it('should block after limit exceeded', async () => {
    const store = new InMemoryRateLimitStore();
    const service = new RateLimitingService(store);
    
    // Simulate requests up to limit
    for (let i = 0; i < 5; i++) {
      const result = await service.checkRateLimit({
        identifier: 'test-user',
        endpoint: '/test'
      });
      expect(result.allowed).toBe(true);
    }
    
    // Next request should be blocked
    const result = await service.checkRateLimit({
      identifier: 'test-user', 
      endpoint: '/test'
    });
    expect(result.allowed).toBe(false);
  });
});
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Test rate limiting under load
artillery run --config artillery.yml
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce memory store `maxSize` or switch to Redis
2. **Redis Connection Errors**: Check Redis connectivity and credentials
3. **False Positives**: Adjust thresholds or implement IP whitelisting
4. **Performance Issues**: Use Redis clustering or tune cleanup intervals

### Debug Headers

Enable debug headers in development:

```http
X-RateLimit-Debug: true
```

Response includes:
```http
X-RateLimit-Debug-Tier: user
X-RateLimit-Debug-Algorithm: token-bucket
X-RateLimit-Debug-Key: user:123:/api/test
```

### Logging

Rate limiting events are logged with structured data:

```json
{
  "level": "warn",
  "message": "Rate limit violation",
  "identifier": "user:123",
  "endpoint": "/api/test", 
  "tier": "user",
  "severity": "medium",
  "requestCount": 125,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Security Considerations

### DDoS Protection
- Global IP-based limits prevent basic DDoS attacks
- Progressive penalties for repeat violators
- Automatic IP blocking for critical violations

### Bypass Prevention  
- Rate limiting applied before expensive operations
- Multiple identification methods (IP, user, session)
- Secure key generation prevents collisions

### Privacy
- Rate limit keys use hashed identifiers in production
- No PII stored in rate limit data
- Configurable data retention periods

## Migration Guide

### From express-rate-limit

Replace:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

With:
```typescript
import { createRateLimitMiddleware } from './security';

const limiter = createRateLimitMiddleware({
  // Automatic configuration based on endpoint and user
});
```

### From Custom Rate Limiting

The new system provides:
- Better algorithms and accuracy
- Built-in monitoring and alerting  
- Multi-tier limiting capabilities
- Extension-specific handling
- Production-ready scaling

## Contributing

### Adding New Algorithms

1. Extend `RateLimitAlgorithm` type in `types.ts`
2. Implement algorithm in `RateLimitingService`
3. Add configuration options
4. Update tests and documentation

### Adding New Tiers

1. Add tier to `RateLimitTier` type
2. Configure in `DEFAULT_RATE_LIMITS`
3. Update endpoint configurations
4. Test tier interactions

### Performance Improvements

- Profile with realistic load tests
- Optimize hot paths in rate limit checks
- Consider algorithm-specific optimizations
- Benchmark against current implementation