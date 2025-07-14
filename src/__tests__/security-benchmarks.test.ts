/**
 * @fileoverview Security Performance Benchmark Tests
 * @description Performance benchmarks for critical security paths
 * @author Web-Buddy Team
 */

import SecurityTestUtils from './security-test-utils';
import { TokenManager } from '../auth/infrastructure/token-manager';
import { AuthService } from '../auth/application/auth-service';
import { CSRFService } from '../auth/infrastructure/csrf-service';
import { RateLimitingService } from '../security/rate-limiting-service';
import { InMemoryRateLimitStore } from '../security/rate-limit-stores';

// Performance thresholds (adjust based on requirements)
const PERFORMANCE_THRESHOLDS = {
  JWT_GENERATION: 100, // milliseconds
  JWT_VALIDATION: 50,
  CSRF_GENERATION: 10,
  CSRF_VALIDATION: 5,
  RATE_LIMIT_CHECK: 10,
  PASSWORD_HASH: 200,
  PASSWORD_VERIFY: 150,
  CONCURRENT_OPERATIONS: 1000 // for 100 concurrent operations
};

describe('Security Performance Benchmarks', () => {
  describe('JWT Token Performance', () => {
    let tokenManager: TokenManager;
    let testPayload: any;

    beforeEach(() => {
      tokenManager = SecurityTestUtils.createMockTokenManager() as any;
      testPayload = SecurityTestUtils.generateTestJWTPayload();
    });

    it('should generate JWT tokens within performance threshold', async () => {
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return await tokenManager.generateTokenPair(testPayload);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.JWT_GENERATION);
      testConsole.log(`JWT Generation: ${executionTime.toFixed(2)}ms`);
    });

    it('should validate JWT tokens within performance threshold', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return await tokenManager.verifyAccessToken(tokenPair.accessToken);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.JWT_VALIDATION);
      testConsole.log(`JWT Validation: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle concurrent JWT operations efficiently', async () => {
      const concurrentOperations = 100;
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrentOperations }, () => 
          tokenManager.generateTokenPair(testPayload)
        );
        return await Promise.all(promises);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS);
      testConsole.log(`${concurrentOperations} Concurrent JWT Generations: ${executionTime.toFixed(2)}ms`);
    });

    it('should maintain performance under token blacklisting load', async () => {
      // Generate multiple tokens
      const tokens = await Promise.all(
        Array.from({ length: 50 }, () => tokenManager.generateTokenPair(testPayload))
      );

      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        // Blacklist all tokens
        for (const tokenPair of tokens) {
          const decoded = await tokenManager.verifyAccessToken(tokenPair.accessToken);
          tokenManager.blacklistToken(decoded.jti);
        }
      });

      testConsole.log(`Blacklisting 50 tokens: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(500); // 500ms threshold for bulk operations
    });
  });

  describe('CSRF Token Performance', () => {
    let csrfService: CSRFService;

    beforeEach(() => {
      csrfService = new CSRFService({
        tokenLength: 16,
        tokenExpiry: 60000
      });
    });

    it('should generate CSRF tokens within performance threshold', async () => {
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return csrfService.generateToken('session-123', 'user-456');
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CSRF_GENERATION);
      testConsole.log(`CSRF Generation: ${executionTime.toFixed(2)}ms`);
    });

    it('should validate CSRF tokens within performance threshold', async () => {
      const tokenData = csrfService.generateToken('session-123', 'user-456');
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return csrfService.validateToken(
          tokenData.token,
          tokenData.token,
          'session-123',
          'user-456'
        );
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CSRF_VALIDATION);
      testConsole.log(`CSRF Validation: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle high-frequency CSRF operations', async () => {
      const operationCount = 1000;
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        const operations = [];
        
        for (let i = 0; i < operationCount; i++) {
          const tokenData = csrfService.generateToken(`session-${i}`, `user-${i}`);
          operations.push(
            csrfService.validateToken(
              tokenData.token,
              tokenData.token,
              `session-${i}`,
              `user-${i}`
            )
          );
        }
        
        return operations;
      });

      testConsole.log(`${operationCount} CSRF operations: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(1000); // 1 second for 1000 operations
    });

    it('should maintain performance with large token stores', async () => {
      // Generate many tokens to fill the store
      for (let i = 0; i < 1000; i++) {
        csrfService.generateToken(`session-${i}`, `user-${i}`);
      }

      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        const tokenData = csrfService.generateToken('performance-session', 'performance-user');
        return csrfService.validateToken(
          tokenData.token,
          tokenData.token,
          'performance-session',
          'performance-user'
        );
      });

      testConsole.log(`CSRF operation with 1000 existing tokens: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(20); // Should not degrade significantly
    });
  });

  describe('Rate Limiting Performance', () => {
    let rateLimitingService: RateLimitingService;
    let store: InMemoryRateLimitStore;

    beforeEach(() => {
      store = new InMemoryRateLimitStore({ maxSize: 10000 });
      rateLimitingService = new RateLimitingService(store);
    });

    afterEach(() => {
      store.shutdown();
    });

    it('should check rate limits within performance threshold', async () => {
      const context = {
        identifier: 'perf-test-user',
        endpoint: '/api/test'
      };

      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return await rateLimitingService.checkRateLimit(context);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RATE_LIMIT_CHECK);
      testConsole.log(`Rate Limit Check: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle high-throughput rate limiting', async () => {
      const requestCount = 1000;
      const contexts = Array.from({ length: requestCount }, (_, i) => ({
        identifier: `user-${i % 100}`, // 100 different users
        endpoint: '/api/endpoint'
      }));

      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        const promises = contexts.map(context => 
          rateLimitingService.checkRateLimit(context)
        );
        return await Promise.all(promises);
      });

      testConsole.log(`${requestCount} rate limit checks: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(2000); // 2 seconds for 1000 operations
    });

    it('should maintain performance across different algorithms', async () => {
      const algorithms = ['token-bucket', 'sliding-window', 'fixed-window'] as const;
      const context = { identifier: 'algorithm-test-user', endpoint: '/api/test' };

      for (const algorithm of algorithms) {
        const config = {
          algorithm,
          windowMs: 60000,
          maxRequests: 100,
          burstSize: 10,
          refillRate: 1
        };

        const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
          const promises = Array.from({ length: 100 }, () => 
            rateLimitingService.checkRateLimit(context, config)
          );
          return await Promise.all(promises);
        });

        testConsole.log(`${algorithm} algorithm (100 checks): ${executionTime.toFixed(2)}ms`);
        expect(executionTime).toBeLessThan(500);
      }
    });

    it('should efficiently handle sliding window memory management', async () => {
      const config = {
        algorithm: 'sliding-window' as const,
        windowMs: 60000,
        maxRequests: 1000
      };

      const context = { identifier: 'memory-test-user', endpoint: '/api/test' };

      // Generate many requests to test memory management
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        for (let i = 0; i < 1500; i++) {
          await rateLimitingService.checkRateLimit(context, config);
          testUtils.advanceTime(10); // Small time advancement
        }
      });

      testConsole.log(`Sliding window memory management (1500 requests): ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('Password Hashing Performance', () => {
    it('should hash passwords within performance threshold', async () => {
      const password = 'TestPassword123!';
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return await SecurityTestUtils.hashPassword(password);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PASSWORD_HASH);
      testConsole.log(`Password Hashing: ${executionTime.toFixed(2)}ms`);
    });

    it('should verify passwords within performance threshold', async () => {
      const password = 'TestPassword123!';
      const hash = await SecurityTestUtils.hashPassword(password);
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return await SecurityTestUtils.verifyPassword(password, hash);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PASSWORD_VERIFY);
      testConsole.log(`Password Verification: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle concurrent password operations', async () => {
      const passwords = Array.from({ length: 10 }, (_, i) => `Password${i}123!`);
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        const hashPromises = passwords.map(pwd => SecurityTestUtils.hashPassword(pwd));
        return await Promise.all(hashPromises);
      });

      testConsole.log(`10 concurrent password hashes: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(2000); // 2 seconds for 10 concurrent hashes
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate load across different security components
      const tokenManager = SecurityTestUtils.createMockTokenManager();
      const csrfService = new CSRFService();
      const store = new InMemoryRateLimitStore({ maxSize: 1000 });
      const rateLimitingService = new RateLimitingService(store);

      // Simulate heavy usage
      for (let i = 0; i < 100; i++) {
        // JWT operations
        const payload = SecurityTestUtils.generateTestJWTPayload();
        await tokenManager.generateTokenPair(payload);

        // CSRF operations
        csrfService.generateToken(`session-${i}`, `user-${i}`);

        // Rate limiting operations
        await rateLimitingService.checkRateLimit({
          identifier: `user-${i}`,
          endpoint: '/api/test'
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      testConsole.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      store.shutdown();
    });
  });

  describe('Stress Testing', () => {
    it('should handle security operations under stress', async () => {
      const stressTestData = SecurityTestUtils.generateStressTestData(500);
      const tokenManager = SecurityTestUtils.createMockTokenManager();
      const csrfService = new CSRFService();
      
      const { executionTime, result } = await SecurityTestUtils.measureExecutionTime(async () => {
        const operations = stressTestData.map(async (data) => {
          // JWT operations
          const jwtResult = await tokenManager.generateTokenPair({
            userId: data.userId,
            sessionId: data.sessionId
          });

          // CSRF operations
          const csrfToken = csrfService.generateToken(data.sessionId, data.userId);
          const csrfValid = csrfService.validateToken(
            csrfToken.token,
            csrfToken.token,
            data.sessionId,
            data.userId
          );

          return { jwt: jwtResult, csrf: csrfValid };
        });

        return await Promise.all(operations);
      });

      testConsole.log(`Stress test (500 operations): ${executionTime.toFixed(2)}ms`);
      
      // All operations should complete successfully
      expect(result).toHaveLength(500);
      expect(result.every(r => r.jwt && r.csrf)).toBe(true);
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(5000); // 5 seconds
    });

    it('should maintain performance consistency across multiple runs', async () => {
      const runCount = 5;
      const operationsPerRun = 100;
      const executionTimes: number[] = [];

      for (let run = 0; run < runCount; run++) {
        const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
          const csrfService = new CSRFService();
          
          for (let i = 0; i < operationsPerRun; i++) {
            const token = csrfService.generateToken(`session-${i}`, `user-${i}`);
            csrfService.validateToken(token.token, token.token, `session-${i}`, `user-${i}`);
          }
        });

        executionTimes.push(executionTime);
      }

      const avgTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      const variance = maxTime - minTime;

      testConsole.log(`Performance consistency: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms, variance=${variance.toFixed(2)}ms`);

      // Variance should be reasonable (less than 50% of average)
      expect(variance).toBeLessThan(avgTime * 0.5);
    });
  });

  describe('Security Validation Performance', () => {
    it('should quickly identify malicious patterns', async () => {
      const scenarios = SecurityTestUtils.createSecurityTestScenarios();
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        // Test XSS detection performance
        scenarios.xssPayloads.forEach(payload => {
          // Simulate XSS detection (would be actual validation in real code)
          const hasTags = /<[^>]*>/.test(payload);
          const hasScript = /script/i.test(payload);
          return hasTags || hasScript;
        });

        // Test SQL injection detection performance
        scenarios.sqlInjectionPayloads.forEach(payload => {
          // Simulate SQL injection detection
          const hasSqlKeywords = /(union|select|drop|insert|update|delete)/i.test(payload);
          const hasQuotes = /'|"/.test(payload);
          return hasSqlKeywords && hasQuotes;
        });

        return true;
      });

      testConsole.log(`Security pattern detection: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(10); // Should be very fast
    });

    it('should efficiently validate security headers', async () => {
      const response = SecurityTestUtils.createSecurityMockResponse();
      
      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return SecurityTestUtils.validateSecurityHeaders(response);
      });

      testConsole.log(`Security header validation: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(5);
    });

    it('should quickly detect sensitive data exposure', async () => {
      const testData = {
        user: SecurityTestUtils.generateTestUser(),
        session: SecurityTestUtils.generateTestSession(),
        config: { password: 'secret', apiKey: 'key123' }
      };

      const { executionTime } = await SecurityTestUtils.measureExecutionTime(async () => {
        return SecurityTestUtils.validateNoSensitiveDataExposure(testData);
      });

      testConsole.log(`Sensitive data detection: ${executionTime.toFixed(2)}ms`);
      expect(executionTime).toBeLessThan(10);
    });
  });
});