/**
 * @fileoverview Security Test Utilities
 * @description Common utilities and mocks for security component testing
 * @author Web-Buddy Team
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { TokenManager, TokenPayload, TokenPair } from '../auth/infrastructure/token-manager';
import { User } from '../auth/domain/user';
import { Session, SessionStatus } from '../auth/domain/session';
import { CSRFService } from '../auth/infrastructure/csrf-service';
import { RateLimitEntry } from '../security/rate-limit-stores';

/**
 * Security-focused test utilities for comprehensive security testing
 */
export class SecurityTestUtils {
  /**
   * Generate test RSA key pairs for JWT testing
   */
  static generateTestRSAKeyPair(): { publicKey: string; privateKey: string } {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  /**
   * Generate test JWT payload with security-relevant fields
   */
  static generateTestJWTPayload(overrides: Partial<TokenPayload & { 
    iat?: number; 
    exp?: number; 
    jti?: string; 
    type?: string 
  }> = {}): any {
    const now = Math.floor(Date.now() / 1000);
    return {
      userId: 'test-user-123',
      email: 'security-test@example.com',
      roles: ['user'],
      sessionId: 'test-session-456',
      extensionId: 'test-extension-789',
      iat: now,
      exp: now + 900, // 15 minutes
      jti: 'test-jti-' + crypto.randomBytes(8).toString('hex'),
      type: 'access',
      ...overrides
    };
  }

  /**
   * Generate test user with security-relevant fields
   */
  static generateTestUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-' + crypto.randomBytes(8).toString('hex'),
      email: 'test-user@example.com',
      password: '$2b$12$hashedPassword123', // bcrypt hash
      name: 'Test User',
      roles: ['user'],
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date('2022-01-01T00:00:00.000Z'),
      updatedAt: new Date('2022-01-01T00:00:00.000Z'),
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
      extensionId: 'ext-' + crypto.randomBytes(4).toString('hex'),
      apiKey: null,
      ...overrides
    };
  }

  /**
   * Generate test session with security tracking
   */
  static generateTestSession(overrides: Partial<Session> = {}): Session {
    return {
      id: 'session-' + crypto.randomBytes(8).toString('hex'),
      userId: 'user-123',
      userAgent: 'Mozilla/5.0 (Test Security Browser)',
      ipAddress: '127.0.0.1',
      status: SessionStatus.ACTIVE,
      createdAt: new Date('2022-01-01T00:00:00.000Z'),
      lastActivityAt: new Date('2022-01-01T00:00:00.000Z'),
      expiresAt: new Date('2022-01-08T00:00:00.000Z'),
      endedAt: null,
      ...overrides
    };
  }

  /**
   * Generate test CSRF token with proper format
   */
  static generateTestCSRFToken(): string {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const signature = crypto.randomBytes(8).toString('hex');
    return `${randomBytes}.${timestamp}.${signature}`;
  }

  /**
   * Generate test rate limit entry
   */
  static generateTestRateLimitEntry(overrides: Partial<RateLimitEntry> = {}): RateLimitEntry {
    return {
      count: 1,
      resetTime: Date.now() + 60000,
      tokens: 10,
      lastRefill: Date.now(),
      windowStart: Date.now(),
      requests: [Date.now()],
      ...overrides
    };
  }

  /**
   * Create mock Express request with security headers
   */
  static createSecurityMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      method: 'POST',
      path: '/api/secure-endpoint',
      url: '/api/secure-endpoint',
      headers: {
        'user-agent': 'SecurityTestAgent/1.0',
        'x-forwarded-for': '127.0.0.1',
        'x-real-ip': '127.0.0.1',
        'content-type': 'application/json',
        'origin': 'https://example.com',
        'referer': 'https://example.com/app'
      },
      cookies: {},
      body: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
      ...overrides
    };
  }

  /**
   * Create mock Express response with security method tracking
   */
  static createSecurityMockResponse(): Partial<Response> {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
      headers: {},
      headersSent: false,
      locals: {},
      statusCode: 200
    };

    // Track security-relevant method calls
    (res as any).securityCalls = {
      status: [],
      headers: [],
      cookies: []
    };

    // Wrap methods to track calls
    const originalStatus = res.status;
    res.status = jest.fn((code: number) => {
      (res as any).securityCalls.status.push(code);
      return originalStatus!.call(res, code);
    });

    const originalSetHeader = res.setHeader;
    res.setHeader = jest.fn((name: string, value: any) => {
      (res as any).securityCalls.headers.push({ name, value });
      return originalSetHeader!.call(res, name, value);
    });

    const originalCookie = res.cookie;
    res.cookie = jest.fn((name: string, value: any, options?: any) => {
      (res as any).securityCalls.cookies.push({ name, value, options });
      return originalCookie!.call(res, name, value, options);
    });

    return res;
  }

  /**
   * Create mock token manager with security validation
   */
  static createMockTokenManager(): jest.Mocked<TokenManager> {
    const mockTokenManager = {
      generateTokenPair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      blacklistToken: jest.fn(),
      revokeAllUserTokens: jest.fn(),
      revokeSessionTokens: jest.fn(),
      getTokenStats: jest.fn(),
      cleanupExpiredTokens: jest.fn()
    } as jest.Mocked<TokenManager>;

    // Default implementations for security testing
    mockTokenManager.generateTokenPair.mockResolvedValue({
      accessToken: 'mock-access-token.' + crypto.randomBytes(16).toString('base64'),
      refreshToken: 'mock-refresh-token.' + crypto.randomBytes(16).toString('base64'),
      accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
      refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    mockTokenManager.verifyAccessToken.mockResolvedValue(
      SecurityTestUtils.generateTestJWTPayload({ type: 'access' })
    );

    mockTokenManager.verifyRefreshToken.mockResolvedValue(
      SecurityTestUtils.generateTestJWTPayload({ type: 'refresh' })
    );

    mockTokenManager.getTokenStats.mockReturnValue({
      blacklistedTokens: 0,
      activeRefreshTokens: 0,
      issuer: 'test-issuer',
      audience: 'test-audience',
      algorithm: 'RS256'
    });

    return mockTokenManager;
  }

  /**
   * Create mock CSRF service with security validation
   */
  static createMockCSRFService(): jest.Mocked<CSRFService> {
    const mockCSRFService = {
      generateToken: jest.fn(),
      validateToken: jest.fn(),
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
      getTokenFromHeader: jest.fn(),
      getTokenFromCookie: jest.fn(),
      generateAndSetToken: jest.fn(),
      isExtensionRequest: jest.fn(),
      validateExtensionOrigin: jest.fn(),
      rotateToken: jest.fn(),
      getTokenStats: jest.fn(),
      invalidateUserTokens: jest.fn(),
      invalidateSessionTokens: jest.fn(),
      getConfig: jest.fn()
    } as jest.Mocked<CSRFService>;

    // Default secure implementations
    mockCSRFService.generateToken.mockReturnValue({
      token: SecurityTestUtils.generateTestCSRFToken(),
      createdAt: new Date(),
      sessionId: 'test-session',
      userId: 'test-user'
    });

    mockCSRFService.validateToken.mockReturnValue(true);
    mockCSRFService.isExtensionRequest.mockReturnValue(false);
    mockCSRFService.validateExtensionOrigin.mockReturnValue(false);

    mockCSRFService.getTokenStats.mockReturnValue({
      totalTokens: 0,
      activeTokens: 0,
      expiredTokens: 0,
      config: {
        cookieName: 'csrf-token',
        headerName: 'X-CSRF-Token',
        tokenExpiry: 3600000,
        secureCookie: false
      }
    });

    return mockCSRFService;
  }

  /**
   * Simulate password hashing for tests
   */
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  /**
   * Simulate password verification for tests
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate test API key with proper format
   */
  static generateTestApiKey(): string {
    return `sem_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Create test data for security scenarios
   */
  static createSecurityTestScenarios() {
    return {
      // Common attack patterns
      xssPayloads: [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">\';alert(String.fromCharCode(88,83,83))//\'></SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>">'
      ],

      // SQL injection patterns
      sqlInjectionPayloads: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --"
      ],

      // Invalid JWT tokens
      invalidJWTs: [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'expired.token.here',
        '',
        'not-a-jwt-at-all'
      ],

      // CSRF attack scenarios
      csrfAttackScenarios: [
        { header: undefined, cookie: 'valid-token' }, // Missing header
        { header: 'valid-token', cookie: undefined }, // Missing cookie
        { header: 'token1', cookie: 'token2' }, // Mismatched tokens
        { header: 'expired-token', cookie: 'expired-token' }, // Expired tokens
      ],

      // Rate limiting attack patterns
      rateLimitingAttacks: [
        { burstSize: 1000, timeframe: 1000 }, // Burst attack
        { requestsPerSecond: 100, duration: 60 }, // Sustained attack
        { concurrentConnections: 500 }, // Connection flooding
      ],

      // Suspicious user agents
      suspiciousUserAgents: [
        'sqlmap/1.0',
        'Nikto/2.1.6',
        'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)',
        '',
        'curl/7.68.0'
      ],

      // Malicious IP patterns
      maliciousIPs: [
        '192.168.1.1', // Private IP trying to access public API
        '10.0.0.1',     // Another private IP
        '172.16.0.1',   // Private network range
        '0.0.0.0',      // Invalid IP
      ]
    };
  }

  /**
   * Validate security response contains proper headers
   */
  static validateSecurityHeaders(response: Partial<Response>): {
    hasCSRFProtection: boolean;
    hasRateLimitHeaders: boolean;
    hasSecurityHeaders: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const calls = (response as any).securityCalls;

    // Check for CSRF headers
    const hasCSRFHeaders = calls?.headers?.some((h: any) => 
      h.name.toLowerCase().includes('csrf') || h.name.toLowerCase() === 'x-csrf-token'
    );

    // Check for rate limit headers
    const hasRateLimitHeaders = calls?.headers?.some((h: any) => 
      h.name.toLowerCase().includes('ratelimit') || h.name.toLowerCase().includes('x-ratelimit')
    );

    // Check for general security headers
    const securityHeaderNames = ['x-frame-options', 'x-content-type-options', 'strict-transport-security'];
    const hasSecurityHeaders = calls?.headers?.some((h: any) => 
      securityHeaderNames.includes(h.name.toLowerCase())
    );

    if (!hasCSRFHeaders) issues.push('Missing CSRF protection headers');
    if (!hasRateLimitHeaders) issues.push('Missing rate limiting headers');
    if (!hasSecurityHeaders) issues.push('Missing general security headers');

    return {
      hasCSRFProtection: hasCSRFHeaders,
      hasRateLimitHeaders,
      hasSecurityHeaders,
      issues
    };
  }

  /**
   * Measure test execution time for performance testing
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    executionTime: number;
  }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const executionTime = Number(end - start) / 1000000; // Convert to milliseconds

    return { result, executionTime };
  }

  /**
   * Generate test data for stress testing
   */
  static generateStressTestData(count: number): Array<{
    userId: string;
    sessionId: string;
    token: string;
    timestamp: number;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      userId: `stress-user-${i}`,
      sessionId: `stress-session-${i}`,
      token: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now() + (i * 1000)
    }));
  }

  /**
   * Validate that sensitive data is not exposed in responses
   */
  static validateNoSensitiveDataExposure(data: any): {
    isSecure: boolean;
    exposedFields: string[];
  } {
    const sensitiveFields = ['password', 'apiKey', 'secret', 'privateKey', 'hash'];
    const exposedFields: string[] = [];

    const checkObject = (obj: any, path = ''): void => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (sensitiveFields.includes(key.toLowerCase()) && value !== null && value !== undefined) {
          exposedFields.push(fullPath);
        }

        if (typeof value === 'object') {
          checkObject(value, fullPath);
        }
      }
    };

    checkObject(data);

    return {
      isSecure: exposedFields.length === 0,
      exposedFields
    };
  }
}

// Export for use in tests
export default SecurityTestUtils;