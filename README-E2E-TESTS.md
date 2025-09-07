# Semantest E2E Security Tests

Comprehensive end-to-end security testing suite for the Semantest platform, covering browser-based authentication, Chrome extension security, attack simulations, and cross-browser compatibility.

## Test Structure

```
src/__tests__/e2e/
├── browser-auth.e2e.test.ts      # Browser authentication flows
├── extension-security.e2e.test.ts # Chrome extension security
├── attack-simulation.e2e.test.ts  # Security attack prevention
├── cross-browser.e2e.test.ts     # Browser compatibility
├── user-journey.e2e.test.ts      # Complete user workflows
├── visual-regression.e2e.test.ts  # UI security components
├── performance-security.e2e.test.ts # Performance impact
├── e2e-helpers/
│   ├── global-setup.ts           # Test environment setup
│   ├── global-teardown.ts        # Cleanup after tests
│   ├── page-objects.ts           # Page object models
│   └── test-extension.ts         # Extension test utilities
└── fixtures/
    └── attack-payloads.json      # Attack simulation data
```

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Suites
```bash
# Security-focused tests
npm run test:security

# Performance tests
npm run test:performance

# Visual regression tests
npm run test:visual

# Update visual snapshots
npm run test:visual:update
```

### Interactive Mode
```bash
# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Test Coverage

### 1. Browser Authentication (`browser-auth.e2e.test.ts`)
- ✅ Login/logout flows with CSRF protection
- ✅ Session management and persistence
- ✅ Password security and complexity validation
- ✅ MFA/2FA authentication flows
- ✅ Account lockout after failed attempts
- ✅ OAuth integration testing
- ✅ Browser storage security
- ✅ Security headers validation

### 2. Chrome Extension Security (`extension-security.e2e.test.ts`)
- ✅ Extension installation and permissions
- ✅ Permission migration and management
- ✅ API key validation and encryption
- ✅ Content script isolation
- ✅ Message origin validation
- ✅ Extension update security
- ✅ Browser action security
- ✅ CSP enforcement in extensions
- ✅ Data protection and encryption

### 3. Attack Simulations (`attack-simulation.e2e.test.ts`)
- ✅ CSRF attack prevention
- ✅ XSS injection protection (stored, reflected, DOM-based)
- ✅ JWT tampering and replay attacks
- ✅ Rate limiting bypass attempts
- ✅ SQL injection prevention
- ✅ Session fixation and hijacking
- ✅ DDoS protection testing
- ✅ File upload security
- ✅ API input validation

### 4. Cross-Browser Testing (`cross-browser.e2e.test.ts`)
- ✅ Chrome, Firefox, Safari, Edge compatibility
- ✅ Mobile browser testing (iOS Safari, Android Chrome)
- ✅ Cookie handling variations
- ✅ CSP implementation differences
- ✅ WebCrypto API support
- ✅ Form security behaviors
- ✅ JavaScript API security

### 5. User Journey Tests (`user-journey.e2e.test.ts`)
- ✅ New user registration with email verification
- ✅ Complete authentication workflows
- ✅ Permission management scenarios
- ✅ GDPR compliance and data export
- ✅ Account deletion process
- ✅ Security incident response
- ✅ Multi-device management
- ✅ Emergency access recovery

### 6. Visual Regression (`visual-regression.e2e.test.ts`)
- ✅ Login page states and variations
- ✅ Permission dialogs
- ✅ Security alerts and warnings
- ✅ 2FA components
- ✅ Password strength indicators
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Accessibility features

### 7. Performance Security (`performance-security.e2e.test.ts`)
- ✅ Authentication performance metrics
- ✅ CSRF token generation overhead
- ✅ Rate limiting performance impact
- ✅ Security headers processing
- ✅ Encryption/decryption performance
- ✅ Session validation overhead
- ✅ Resource loading impact
- ✅ Memory usage monitoring

## Key Features

### Page Object Model
All tests use page objects for maintainability:
```typescript
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('user@test.com', 'password');
```

### Security Helpers
Utilities for security testing:
```typescript
const securityHelpers = new SecurityTestHelpers(page, context);
await securityHelpers.simulateCSRFAttack(targetUrl, formData);
await securityHelpers.checkSecurityHeaders(response);
```

### Attack Payloads
Comprehensive attack vectors in `fixtures/attack-payloads.json`:
- XSS payloads (basic, advanced, encoded)
- SQL injection patterns
- JWT tampering techniques
- Rate limiting bypass methods
- Session attacks

### Chrome Extension Testing
Full extension testing harness:
```typescript
const harness = new ExtensionTestHarness(extensionPath);
await harness.loadExtension();
const popup = await harness.openPopup(extensionId);
```

## Configuration

### Playwright Config
- Multiple browser projects (Chrome, Firefox, Safari, mobile)
- Automatic retries and timeouts
- Video recording on failure
- HTML/JSON/JUnit reporting
- Trace collection

### Environment Variables
```bash
BASE_URL=http://localhost:3000
JWT_SECRET=test-secret-key
CSRF_SECRET=test-csrf-secret
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

## Best Practices

### Test Isolation
- Each test creates its own browser context
- No shared state between tests
- Automatic cleanup after each test

### Security Monitoring
- Console error monitoring
- Network request interception
- Performance metrics collection
- Security header validation

### Visual Testing
- Consistent viewport sizes
- Animation disabling
- Font loading synchronization
- Dark mode testing

### Performance Testing
- Coverage collection
- Memory leak detection
- Resource loading analysis
- Concurrent request handling

## Debugging

### Failed Tests
1. Check HTML report: `npm run test:e2e:report`
2. Review video recordings in `reports/artifacts/`
3. Examine trace files for detailed debugging
4. Use `--debug` flag for step-by-step execution

### Visual Differences
1. Review diff images in `reports/artifacts/`
2. Update snapshots if changes are intentional
3. Check for environment-specific rendering

### Performance Issues
1. Review performance metrics in test output
2. Check memory usage patterns
3. Analyze network waterfall
4. Profile JavaScript execution

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run E2E Security Tests
  run: |
    npm ci
    npm run build
    npm run test:e2e
  env:
    CI: true
```

### Test Reports
- JUnit XML for CI integration
- HTML reports for human review
- JSON output for programmatic analysis
- Visual regression artifacts

## Future Enhancements

1. **API Fuzzing**: Automated API security testing
2. **Penetration Testing**: Integration with security tools
3. **Compliance Testing**: GDPR, CCPA, SOC2 validation
4. **Load Testing**: Security under high load
5. **Mobile App Testing**: Native app security
6. **WAF Testing**: Web application firewall validation
7. **Container Security**: Docker/K8s security testing
8. **Supply Chain**: Dependency vulnerability scanning

## Contributing

When adding new E2E tests:
1. Use page object pattern
2. Include attack scenarios
3. Test across browsers
4. Add visual regression
5. Measure performance impact
6. Document test purpose
7. Update this README

## Security Notes

- Never commit real API keys or secrets
- Use test-specific credentials
- Sanitize test data
- Review security implications
- Follow OWASP guidelines
- Test both positive and negative cases
- Include edge cases and error conditions