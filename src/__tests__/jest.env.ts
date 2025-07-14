/**
 * @fileoverview Jest Environment Setup
 * @description Configure environment variables and globals for security testing
 * @author Web-Buddy Team
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing-only';
process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test database

// Disable console output during tests (except for specific test logging)
const originalConsole = { ...console };

// Allow test-specific logging while suppressing application logs
global.testConsole = originalConsole;

// Mock console methods to reduce noise during testing
console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Set up test-specific timeouts and intervals
jest.setTimeout(30000); // 30 seconds for security tests

// Mock Date.now for deterministic time-based tests
const mockDateNow = jest.fn();
Date.now = mockDateNow;

// Default to a fixed timestamp for reproducible tests
mockDateNow.mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z

// Global test utilities
global.testUtils = {
  // Reset Date.now to a specific timestamp
  setMockTime: (timestamp: number) => {
    mockDateNow.mockReturnValue(timestamp);
  },
  
  // Advance time by milliseconds
  advanceTime: (ms: number) => {
    const current = mockDateNow.getMockReturnValue() || Date.now();
    mockDateNow.mockReturnValue(current + ms);
  },
  
  // Reset time to default
  resetTime: () => {
    mockDateNow.mockReturnValue(1640995200000);
  },
  
  // Generate test RSA key pair for JWT tests
  generateTestKeyPair: () => {
    const crypto = require('crypto');
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
  },
  
  // Generate test user data
  generateTestUser: (overrides: any = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    roles: ['user'],
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date('2022-01-01T00:00:00.000Z'),
    updatedAt: new Date('2022-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    ...overrides
  }),
  
  // Generate test session data
  generateTestSession: (overrides: any = {}) => ({
    id: 'test-session-456',
    userId: 'test-user-123',
    userAgent: 'Mozilla/5.0 (Test Browser)',
    ipAddress: '127.0.0.1',
    status: 'active',
    createdAt: new Date('2022-01-01T00:00:00.000Z'),
    lastActivityAt: new Date('2022-01-01T00:00:00.000Z'),
    expiresAt: new Date('2022-01-08T00:00:00.000Z'),
    endedAt: null,
    ...overrides
  }),
  
  // Generate test JWT payload
  generateTestJWTPayload: (overrides: any = {}) => ({
    userId: 'test-user-123',
    email: 'test@example.com',
    roles: ['user'],
    sessionId: 'test-session-456',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    jti: 'test-jti-789',
    ...overrides
  }),
  
  // Sleep function for async testing
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create Express request mock
  createMockRequest: (overrides: any = {}) => ({
    headers: {},
    cookies: {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    path: '/test',
    method: 'GET',
    user: undefined,
    ...overrides
  }),
  
  // Create Express response mock
  createMockResponse: () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      headers: {},
      statusCode: 200
    };
    return res;
  },
  
  // Create Express next function mock
  createMockNext: () => jest.fn()
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    setMockTime: (timestamp: number) => void;
    advanceTime: (ms: number) => void;
    resetTime: () => void;
    generateTestKeyPair: () => { publicKey: string; privateKey: string };
    generateTestUser: (overrides?: any) => any;
    generateTestSession: (overrides?: any) => any;
    generateTestJWTPayload: (overrides?: any) => any;
    sleep: (ms: number) => Promise<void>;
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    createMockNext: () => jest.Mock;
  };
  var testConsole: typeof console;
}

export {};