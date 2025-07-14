/**
 * @fileoverview Jest Setup Configuration
 * @description Global setup for security testing suite
 * @author Web-Buddy Team
 */

import 'reflect-metadata';

// Configure Jest environment
beforeAll(async () => {
  // Reset time to consistent state
  testUtils.resetTime();
  
  // Clear any existing test data
  jest.clearAllMocks();
  
  testConsole.log('🧪 Security test suite initialized');
});

afterAll(async () => {
  // Clean up any resources
  jest.clearAllTimers();
  jest.restoreAllMocks();
  
  testConsole.log('🧪 Security test suite completed');
});

beforeEach(() => {
  // Reset time before each test
  testUtils.resetTime();
  
  // Clear mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});

// Add custom Jest matchers for security testing
expect.extend({
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    
    return {
      message: () => `Expected ${received} ${pass ? 'not ' : ''}to be a valid JWT format`,
      pass
    };
  },
  
  toBeValidCSRFToken(received: string) {
    // CSRF tokens should be hexadecimal strings with timestamp and signature
    const csrfRegex = /^[a-f0-9]+\.\d+\.[a-f0-9]+$/;
    const pass = csrfRegex.test(received);
    
    return {
      message: () => `Expected ${received} ${pass ? 'not ' : ''}to be a valid CSRF token format`,
      pass
    };
  },
  
  toHaveSecurityHeaders(received: any) {
    const requiredHeaders = [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ];
    
    const missingHeaders = requiredHeaders.filter(header => !received[header]);
    const pass = missingHeaders.length === 0;
    
    return {
      message: () => pass 
        ? `Expected headers not to include security headers`
        : `Expected headers to include: ${missingHeaders.join(', ')}`,
      pass
    };
  },
  
  toBeWithinTimeRange(received: number, expected: number, toleranceMs: number = 1000) {
    const difference = Math.abs(received - expected);
    const pass = difference <= toleranceMs;
    
    return {
      message: () => `Expected ${received} ${pass ? 'not ' : ''}to be within ${toleranceMs}ms of ${expected}`,
      pass
    };
  },
  
  toBeExpiredToken(received: any) {
    const now = Math.floor(Date.now() / 1000);
    const pass = received.exp && received.exp < now;
    
    return {
      message: () => `Expected token ${pass ? 'not ' : ''}to be expired`,
      pass
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toBeValidCSRFToken(): R;
      toHaveSecurityHeaders(): R;
      toBeWithinTimeRange(expected: number, toleranceMs?: number): R;
      toBeExpiredToken(): R;
    }
  }
}

export {};