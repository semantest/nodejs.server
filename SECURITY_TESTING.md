# Semantest Security Testing Suite

This document describes the comprehensive security testing suite for Semantest's Node.js server implementation. The test suite focuses on critical security components including JWT authentication, CSRF protection, and rate limiting.

## 🛡️ Security Components Tested

### 1. JWT Authentication
- **TokenManager** - RS256 algorithm, token generation/validation, blacklisting
- **AuthService** - User registration, login, password validation, session management
- **JWTMiddleware** - Token extraction, validation, role-based access control

### 2. CSRF Protection
- **CSRFService** - Double-submit cookie pattern, token generation/validation
- **CSRFMiddleware** - Request validation, extension exemptions, path-based rules

### 3. Rate Limiting
- **RateLimitingService** - Token bucket, sliding window, and fixed window algorithms
- **RateLimitStores** - Redis and in-memory store implementations
- **RateLimitingMiddleware** - Multi-tier rate limiting with header management

## 📁 Test Structure

```
src/
├── __tests__/
│   ├── jest.env.ts              # Environment setup
│   ├── setup.ts                 # Global test configuration
│   ├── security-test-utils.ts   # Security-focused test utilities
│   ├── security-benchmarks.test.ts # Performance benchmarks
│   └── run-security-tests.ts    # Custom test runner
├── auth/__tests__/
│   ├── token-manager.test.ts    # JWT token management tests
│   ├── auth-service.test.ts     # Authentication service tests
│   ├── jwt-middleware.test.ts   # JWT middleware tests
│   └── csrf/
│       ├── csrf-service.test.ts     # CSRF service tests
│       └── csrf-middleware.test.ts  # CSRF middleware tests
└── security/__tests__/
    ├── rate-limiting-service.test.ts # Rate limiting algorithm tests
    ├── rate-limit-stores.test.ts     # Store implementation tests
    └── rate-limiting-middleware.test.ts # Rate limiting middleware tests
```

## 🚀 Running Tests

### All Security Tests
```bash
npm run test:security
```

### Specific Components
```bash
# JWT Authentication tests
npm run test:auth

# CSRF Protection tests
npm run test:csrf

# Rate Limiting tests
npm run test:rate-limit

# Performance benchmarks
npm run test:benchmarks
```

### Coverage Report
```bash
npm run test:coverage
```

### CI/CD Integration
```bash
npm run test:ci
```

## 📊 Test Coverage Goals

| Component | Target Coverage | Security Priority |
|-----------|----------------|-------------------|
| TokenManager | 95% | 🔴 Critical |
| AuthService | 90% | 🔴 Critical |
| JWTMiddleware | 90% | 🔴 Critical |
| CSRFService | 95% | 🔴 Critical |
| CSRFMiddleware | 85% | 🟡 High |
| RateLimitingService | 90% | 🟡 High |
| Rate Limit Stores | 85% | 🟡 High |

## 🧪 Test Categories

### 1. Unit Tests
- **Functionality**: Core security operations
- **Edge Cases**: Invalid inputs, malformed data
- **Error Handling**: Graceful failure scenarios
- **Concurrency**: Thread safety and race conditions

### 2. Security Tests
- **Attack Simulation**: XSS, SQL injection, CSRF attacks
- **Token Security**: JWT tampering, replay attacks
- **Rate Limiting**: Burst attacks, distributed attacks
- **Data Exposure**: Sensitive information leakage

### 3. Performance Tests
- **Benchmarks**: Critical path performance
- **Load Testing**: High-throughput scenarios
- **Memory Usage**: Resource consumption under load
- **Stress Testing**: System limits and degradation

### 4. Integration Tests
- **Middleware Chain**: Security component interactions
- **End-to-End**: Complete authentication flows
- **Cross-Component**: Service integration points

## 🔧 Custom Test Utilities

### SecurityTestUtils
The `SecurityTestUtils` class provides security-focused testing utilities:

```typescript
// Generate test data
const user = SecurityTestUtils.generateTestUser();
const jwt = SecurityTestUtils.generateTestJWTPayload();
const csrfToken = SecurityTestUtils.generateTestCSRFToken();

// Create mocks
const mockTokenManager = SecurityTestUtils.createMockTokenManager();
const mockCSRFService = SecurityTestUtils.createMockCSRFService();

// Security validation
const validation = SecurityTestUtils.validateSecurityHeaders(response);
const exposure = SecurityTestUtils.validateNoSensitiveDataExposure(data);

// Performance measurement
const { result, executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
  return await securityOperation();
});
```

### Custom Matchers
The test suite includes custom Jest matchers for security testing:

```typescript
expect(token).toBeValidJWT();
expect(csrfToken).toBeValidCSRFToken();
expect(response).toHaveSecurityHeaders();
expect(timestamp).toBeWithinTimeRange(expected, tolerance);
expect(decodedToken).toBeExpiredToken();
```

## 📈 Performance Benchmarks

### Thresholds
| Operation | Target Time | Critical |
|-----------|-------------|----------|
| JWT Generation | <100ms | Yes |
| JWT Validation | <50ms | Yes |
| CSRF Generation | <10ms | No |
| CSRF Validation | <5ms | No |
| Rate Limit Check | <10ms | Yes |
| Password Hash | <200ms | No |
| Password Verify | <150ms | No |

### Benchmark Tests
- Single operation performance
- Concurrent operation handling
- Memory usage under load
- Performance consistency across runs
- Stress testing with high loads

## 🚨 Security Scenarios Tested

### Attack Patterns
- **XSS Payloads**: Script injection attempts
- **SQL Injection**: Database manipulation attempts
- **CSRF Attacks**: Cross-site request forgery
- **JWT Tampering**: Token modification attempts
- **Rate Limit Bypass**: Burst and distributed attacks

### Edge Cases
- Malformed tokens and requests
- Expired credentials
- Concurrent access scenarios
- Memory pressure situations
- Network failure conditions

## 📋 Test Reports

### Console Output
The security test runner provides detailed console output:
- Test suite progress and results
- Coverage metrics per component
- Performance benchmark results
- Security assessment summary
- Deployment readiness status

### JSON Reports
Detailed JSON reports are generated for CI/CD integration:
- `test-results/security-test-report.json` - Comprehensive results
- `coverage/lcov-report/` - Coverage visualization
- `test-results/security-tests.xml` - JUnit format for CI

### Report Structure
```json
{
  "timestamp": "2025-01-01T00:00:00Z",
  "summary": {
    "totalTests": 150,
    "passed": 148,
    "failed": 2,
    "coverage": 92.5,
    "criticalFailures": 0
  },
  "suites": [...],
  "recommendations": [...]
}
```

## 🔍 Continuous Integration

### GitHub Actions
```yaml
name: Security Tests
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:security
      - uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: test-results/
```

### Pre-commit Hooks
```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run test:security || exit 1
```

## 🛠️ Development Guidelines

### Writing Security Tests
1. **Test Critical Paths**: Focus on security-sensitive operations
2. **Edge Cases**: Test malformed inputs and error conditions
3. **Performance**: Include performance assertions for critical operations
4. **Concurrency**: Test thread safety and race conditions
5. **Documentation**: Clearly document security test scenarios

### Mock Guidelines
- Use SecurityTestUtils for consistent mock data
- Mock external dependencies (Redis, filesystem, crypto)
- Validate security properties in mocks
- Ensure deterministic test behavior

### Coverage Requirements
- Minimum 85% overall coverage
- Minimum 90% for critical security components
- 100% coverage for public security APIs
- Test both success and failure paths

## 📚 Resources

### Security Testing Best Practices
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

### Testing Tools Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest API Testing](https://github.com/visionmedia/supertest)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contributing

When contributing to the security test suite:

1. **Follow Test Structure**: Use the established patterns and utilities
2. **Security Focus**: Prioritize security-relevant test scenarios
3. **Performance Aware**: Include performance considerations
4. **Documentation**: Update this README for significant changes
5. **Coverage**: Maintain or improve test coverage
6. **Review Process**: Security tests require additional review

## 📞 Support

For questions about the security testing suite:
- Review existing test patterns in the codebase
- Check the SecurityTestUtils for available utilities
- Consult the performance benchmarks for expectations
- Follow the established security testing patterns

Remember: Security testing is critical for protecting user data and maintaining system integrity. Every security component should have comprehensive test coverage.