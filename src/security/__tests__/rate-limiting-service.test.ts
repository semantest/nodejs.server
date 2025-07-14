/**
 * @fileoverview Rate Limiting Service Unit Tests
 * @description Comprehensive tests for rate limiting algorithms and multi-tier logic
 * @author Web-Buddy Team
 */

import {
  RateLimitingService,
  MultiTierRateLimitingService,
  RateLimitContext,
  RateLimitResult,
  RateLimitConfig,
  generateRateLimitHeaders
} from '../rate-limiting-service';
import { RateLimitStore, RateLimitEntry } from '../rate-limit-stores';

// Mock rate limit store
class MockRateLimitStore extends RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private stats = { gets: 0, sets: 0, deletes: 0, increments: 0 };

  async get(key: string): Promise<RateLimitEntry | null> {
    this.stats.gets++;
    return this.store.get(key) || null;
  }

  async set(key: string, value: RateLimitEntry, ttlMs?: number): Promise<void> {
    this.stats.sets++;
    this.store.set(key, value);
  }

  async increment(key: string, ttlMs?: number): Promise<number> {
    this.stats.increments++;
    const existing = this.store.get(key);
    const newValue = (existing?.count || 0) + 1;
    this.store.set(key, { ...existing, count: newValue } as RateLimitEntry);
    return newValue;
  }

  async delete(key: string): Promise<void> {
    this.stats.deletes++;
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }

  async getStats() {
    return {
      totalKeys: this.store.size,
      memoryUsage: this.store.size * 100,
      operations: this.stats
    };
  }

  // Test helper methods
  clear() {
    this.store.clear();
  }

  getStoreContents() {
    return new Map(this.store);
  }
}

describe('RateLimitingService', () => {
  let service: RateLimitingService;
  let store: MockRateLimitStore;
  let context: RateLimitContext;

  beforeEach(() => {
    testUtils.resetTime();
    store = new MockRateLimitStore();
    service = new RateLimitingService(store);
    
    context = {
      identifier: 'test-user-123',
      endpoint: '/api/test',
      userAgent: 'Test Browser',
      timestamp: Date.now()
    };
  });

  describe('Token Bucket Algorithm', () => {
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'token-bucket',
        windowMs: 60000, // 1 minute
        maxRequests: 10, // Not used in token bucket
        burstSize: 5, // 5 tokens
        refillRate: 1 // 1 token per second
      };
    });

    it('should allow requests within burst size', async () => {
      const results = [];
      
      // Make 5 requests (full burst)
      for (let i = 0; i < 5; i++) {
        const result = await service.checkRateLimit(context, config);
        results.push(result);
      }

      // All should be allowed
      expect(results.every(r => r.allowed)).toBe(true);
      
      // Remaining tokens should decrease
      expect(results[0].remainingTokens).toBe(4);
      expect(results[4].remainingTokens).toBe(0);
    });

    it('should reject requests when bucket is empty', async () => {
      // Exhaust the bucket
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      // Next request should be rejected
      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should refill tokens over time', async () => {
      // Exhaust the bucket
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      // Advance time by 2 seconds (should refill 2 tokens)
      testUtils.advanceTime(2000);

      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(1); // Had 2, used 1
    });

    it('should not exceed burst size during refill', async () => {
      // Use 1 token
      await service.checkRateLimit(context, config);

      // Advance time by 10 seconds (would refill 10 tokens, but max is 5)
      testUtils.advanceTime(10000);

      const result = await service.checkRateLimit(context, config);
      
      expect(result.remainingTokens).toBe(4); // Max 5, used 1 = 4 remaining
    });

    it('should handle weighted requests', async () => {
      const weightedContext = { ...context, weight: 3 };
      
      const result = await service.checkRateLimit(weightedContext, config);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(2); // 5 - 3 = 2
    });

    it('should reject weighted request if insufficient tokens', async () => {
      // Use 3 tokens first
      await service.checkRateLimit({ ...context, weight: 3 }, config);
      
      // Try to use 3 more (only 2 remaining)
      const result = await service.checkRateLimit({ ...context, weight: 3 }, config);
      
      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(2);
    });

    it('should calculate correct reset time', async () => {
      // Exhaust the bucket
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      const result = await service.checkRateLimit(context, config);
      const expectedResetTime = Date.now() + 1000; // 1 second for next token
      
      expect(result.resetTime).toBeWithinTimeRange(expectedResetTime, 100);
    });
  });

  describe('Sliding Window Algorithm', () => {
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'sliding-window',
        windowMs: 60000, // 1 minute
        maxRequests: 5
      };
    });

    it('should allow requests within limit', async () => {
      const results = [];
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await service.checkRateLimit(context, config);
        results.push(result);
      }

      // All should be allowed
      expect(results.every(r => r.allowed)).toBe(true);
      
      // Remaining should decrease
      expect(results[0].remainingTokens).toBe(4);
      expect(results[4].remainingTokens).toBe(0);
    });

    it('should reject requests exceeding limit', async () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      // 6th request should be rejected
      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(0);
    });

    it('should allow requests as window slides', async () => {
      // Make 5 requests at start
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
        testUtils.advanceTime(1000); // Space out requests
      }

      // Advance time to move window (oldest request should expire)
      testUtils.advanceTime(57000); // Total: 61 seconds from first request

      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(0); // 4 requests still in window
    });

    it('should handle weighted requests correctly', async () => {
      // Make request with weight 3
      const result1 = await service.checkRateLimit({ ...context, weight: 3 }, config);
      expect(result1.allowed).toBe(true);
      expect(result1.remainingTokens).toBe(2);

      // Make request with weight 2
      const result2 = await service.checkRateLimit({ ...context, weight: 2 }, config);
      expect(result2.allowed).toBe(true);
      expect(result2.remainingTokens).toBe(0);

      // Try one more request
      const result3 = await service.checkRateLimit(context, config);
      expect(result3.allowed).toBe(false);
    });

    it('should calculate correct reset time', async () => {
      // Make requests with timestamps
      const timestamps = [];
      for (let i = 0; i < 5; i++) {
        timestamps.push(Date.now());
        await service.checkRateLimit(context, config);
        testUtils.advanceTime(1000);
      }

      const result = await service.checkRateLimit(context, config);
      const expectedResetTime = timestamps[0] + config.windowMs;
      
      expect(result.resetTime).toBeWithinTimeRange(expectedResetTime, 100);
    });

    it('should limit memory usage by trimming old requests', async () => {
      // This test ensures we don't store unlimited request timestamps
      const configWithHighLimit = { ...config, maxRequests: 1000 };
      
      // Make many requests
      for (let i = 0; i < 1500; i++) {
        await service.checkRateLimit(context, configWithHighLimit);
        testUtils.advanceTime(10); // Space out requests
      }

      // Check that memory isn't growing unbounded
      const storeContents = store.getStoreContents();
      const entry = storeContents.values().next().value;
      
      expect(entry.requests?.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Fixed Window Algorithm', () => {
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'fixed-window',
        windowMs: 60000, // 1 minute
        maxRequests: 5
      };
    });

    it('should allow requests within window limit', async () => {
      const results = [];
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await service.checkRateLimit(context, config);
        results.push(result);
      }

      // All should be allowed
      expect(results.every(r => r.allowed)).toBe(true);
      expect(results[4].remainingTokens).toBe(0);
    });

    it('should reject requests exceeding window limit', async () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      // 6th request should be rejected
      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(false);
      expect(result.remainingTokens).toBe(0);
    });

    it('should reset counter at window boundary', async () => {
      // Make 5 requests to exhaust limit
      for (let i = 0; i < 5; i++) {
        await service.checkRateLimit(context, config);
      }

      // Advance to next window
      testUtils.advanceTime(60000);

      // Should be allowed in new window
      const result = await service.checkRateLimit(context, config);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(4);
    });

    it('should use window-specific keys', async () => {
      const storeContents = store.getStoreContents();
      
      await service.checkRateLimit(context, config);
      
      const keys = Array.from(storeContents.keys());
      expect(keys[0]).toMatch(/test-user-123:\d+/); // Should include window timestamp
    });

    it('should handle weighted requests', async () => {
      const result = await service.checkRateLimit({ ...context, weight: 3 }, config);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingTokens).toBe(2);
    });

    it('should calculate correct reset time', async () => {
      const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
      
      const result = await service.checkRateLimit(context, config);
      const expectedResetTime = windowStart + config.windowMs;
      
      expect(result.resetTime).toBe(expectedResetTime);
    });
  });

  describe('Configuration and Error Handling', () => {
    it('should use default configuration', async () => {
      const defaultService = new RateLimitingService(store);
      
      const result = await defaultService.checkRateLimit(context);
      
      expect(result.algorithm).toBe('sliding-window');
      expect(result.allowed).toBe(true);
    });

    it('should merge configurations correctly', async () => {
      const globalConfig = { algorithm: 'token-bucket' as const, burstSize: 10 };
      const serviceWithGlobal = new RateLimitingService(store, globalConfig);
      
      const localConfig = { refillRate: 2 };
      
      await serviceWithGlobal.checkRateLimit(context, localConfig);
      
      // Should use merged configuration
      expect(store.getStoreContents().size).toBe(1);
    });

    it('should handle unsupported algorithm', async () => {
      const invalidConfig = { algorithm: 'invalid-algorithm' as any };
      
      await expect(
        service.checkRateLimit(context, invalidConfig)
      ).rejects.toThrow('Unsupported algorithm: invalid-algorithm');
    });

    it('should handle store errors with skipOnError', async () => {
      const errorConfig = { skipOnError: true };
      
      // Mock store to throw error
      jest.spyOn(store, 'get').mockRejectedValue(new Error('Store error'));
      
      const result = await service.checkRateLimit(context, errorConfig);
      
      expect(result.allowed).toBe(true); // Should allow on error
    });

    it('should propagate store errors without skipOnError', async () => {
      jest.spyOn(store, 'get').mockRejectedValue(new Error('Store error'));
      
      await expect(
        service.checkRateLimit(context)
      ).rejects.toThrow('Store error');
    });
  });

  describe('Key Generation', () => {
    it('should use default key generator', async () => {
      await service.checkRateLimit(context);
      
      const keys = Array.from(store.getStoreContents().keys());
      expect(keys[0]).toBe('test-user-123:/api/test');
    });

    it('should use custom key generator', async () => {
      const customConfig = {
        keyGenerator: (identifier: string, endpoint?: string) => `custom:${identifier}`
      };
      
      await service.checkRateLimit(context, customConfig);
      
      const keys = Array.from(store.getStoreContents().keys());
      expect(keys[0]).toBe('custom:test-user-123');
    });

    it('should handle missing endpoint in key generation', async () => {
      const contextWithoutEndpoint = { ...context, endpoint: undefined };
      
      await service.checkRateLimit(contextWithoutEndpoint);
      
      const keys = Array.from(store.getStoreContents().keys());
      expect(keys[0]).toBe('test-user-123');
    });
  });

  describe('Rate Limit Status and Management', () => {
    it('should get rate limit status without affecting limit', async () => {
      const config = { algorithm: 'sliding-window' as const, maxRequests: 5 };
      
      // Make some requests
      await service.checkRateLimit(context, config);
      await service.checkRateLimit(context, config);
      
      const status = await service.getRateLimitStatus(context.identifier, context.endpoint, config);
      
      expect(status).toMatchObject({
        remainingTokens: 3,
        algorithm: 'sliding-window',
        metadata: expect.objectContaining({
          currentCount: 2,
          identifier: context.identifier
        })
      });
    });

    it('should return null for non-existent rate limit', async () => {
      const status = await service.getRateLimitStatus('nonexistent-user');
      expect(status).toBeNull();
    });

    it('should reset rate limit successfully', async () => {
      await service.checkRateLimit(context);
      
      let status = await service.getRateLimitStatus(context.identifier, context.endpoint);
      expect(status).not.toBeNull();
      
      await service.resetRateLimit(context.identifier, context.endpoint);
      
      status = await service.getRateLimitStatus(context.identifier, context.endpoint);
      expect(status).toBeNull();
    });

    it('should provide service statistics', async () => {
      await service.checkRateLimit(context);
      
      const stats = await service.getStats();
      
      expect(stats).toMatchObject({
        totalKeys: 1,
        memoryUsage: expect.any(Number),
        operations: expect.objectContaining({
          gets: expect.any(Number),
          sets: expect.any(Number)
        })
      });
    });

    it('should perform health check', async () => {
      const health = await service.healthCheck();
      
      expect(health).toMatchObject({
        healthy: true,
        store: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });

    it('should handle health check failure', async () => {
      jest.spyOn(store, 'getStats').mockRejectedValue(new Error('Store error'));
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
    });
  });
});

describe('MultiTierRateLimitingService', () => {
  let multiService: MultiTierRateLimitingService;
  let store: MockRateLimitStore;
  let context: RateLimitContext;

  beforeEach(() => {
    testUtils.resetTime();
    store = new MockRateLimitStore();
    
    const tiers = new Map([
      ['global', { algorithm: 'sliding-window' as const, windowMs: 60000, maxRequests: 100 }],
      ['user', { algorithm: 'token-bucket' as const, windowMs: 60000, burstSize: 10, refillRate: 1 }],
      ['endpoint', { algorithm: 'fixed-window' as const, windowMs: 60000, maxRequests: 20 }]
    ]);
    
    multiService = new MultiTierRateLimitingService(store, tiers);
    
    context = {
      identifier: 'test-user-123',
      endpoint: '/api/test'
    };
  });

  it('should check multiple tiers and allow when all pass', async () => {
    const result = await multiService.checkMultiTierRateLimit(context, ['global', 'user', 'endpoint']);
    
    expect(result.allowed).toBe(true);
    expect(result.results.size).toBe(3);
    expect(result.results.has('global')).toBe(true);
    expect(result.results.has('user')).toBe(true);
    expect(result.results.has('endpoint')).toBe(true);
  });

  it('should deny when any tier fails', async () => {
    // Exhaust the user tier (token bucket with 10 tokens)
    for (let i = 0; i < 10; i++) {
      await multiService.checkMultiTierRateLimit(context, ['user']);
    }
    
    const result = await multiService.checkMultiTierRateLimit(context, ['global', 'user', 'endpoint']);
    
    expect(result.allowed).toBe(false);
    expect(result.mostRestrictive).toBe('user');
  });

  it('should identify most restrictive tier', async () => {
    // Make requests to approach limits differently
    for (let i = 0; i < 8; i++) {
      await multiService.checkMultiTierRateLimit(context, ['user']); // 8/10 used
    }
    for (let i = 0; i < 15; i++) {
      await multiService.checkMultiTierRateLimit(context, ['endpoint']); // 15/20 used
    }
    
    const result = await multiService.checkMultiTierRateLimit(context, ['global', 'user', 'endpoint']);
    
    expect(result.allowed).toBe(true);
    // User tier should be closer to limit (2 remaining vs 5 remaining)
    const userResult = result.results.get('user')!;
    const endpointResult = result.results.get('endpoint')!;
    expect(userResult.remainingTokens).toBeLessThan(endpointResult.remainingTokens);
  });

  it('should handle unknown tiers gracefully', async () => {
    const result = await multiService.checkMultiTierRateLimit(context, ['global', 'unknown-tier']);
    
    expect(result.allowed).toBe(true);
    expect(result.results.size).toBe(1); // Only global processed
  });

  it('should provide access to individual tier services', () => {
    const userService = multiService.getTierService('user');
    const unknownService = multiService.getTierService('unknown');
    
    expect(userService).toBeDefined();
    expect(unknownService).toBeUndefined();
  });

  it('should allow dynamic tier management', () => {
    expect(multiService.getTierNames()).toEqual(['global', 'user', 'endpoint']);
    
    multiService.addTier('premium', { algorithm: 'sliding-window', windowMs: 60000, maxRequests: 200 });
    expect(multiService.getTierNames()).toContain('premium');
    
    multiService.removeTier('endpoint');
    expect(multiService.getTierNames()).not.toContain('endpoint');
  });
});

describe('Rate Limit Headers', () => {
  it('should generate correct rate limit headers', () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingTokens: 7,
      resetTime: 1640995200000, // Unix timestamp
      algorithm: 'sliding-window',
      metadata: {
        currentCount: 3,
        totalHits: 3,
        identifier: 'test-user',
        endpoint: '/api/test'
      }
    };
    
    const headers = generateRateLimitHeaders(result, 10);
    
    expect(headers).toEqual({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '7',
      'X-RateLimit-Reset': '1640995200', // Unix timestamp in seconds
      'X-RateLimit-Algorithm': 'sliding-window'
    });
  });

  it('should include retry-after header when request is denied', () => {
    const result: RateLimitResult = {
      allowed: false,
      remainingTokens: 0,
      resetTime: 1640995260000,
      retryAfter: 60,
      algorithm: 'token-bucket',
      metadata: {
        currentCount: 10,
        totalHits: 10,
        identifier: 'test-user',
        endpoint: '/api/test'
      }
    };
    
    const headers = generateRateLimitHeaders(result, 10);
    
    expect(headers['X-RateLimit-RetryAfter']).toBe('60');
  });

  it('should not include retry-after header when request is allowed', () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingTokens: 5,
      resetTime: 1640995260000,
      algorithm: 'sliding-window',
      metadata: {
        currentCount: 5,
        totalHits: 5,
        identifier: 'test-user',
        endpoint: '/api/test'
      }
    };
    
    const headers = generateRateLimitHeaders(result, 10);
    
    expect(headers['X-RateLimit-RetryAfter']).toBeUndefined();
  });
});