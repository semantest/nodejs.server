/**
 * Tests for RedisRateLimiter
 * Created to improve coverage from 0%
 */

import { RedisRateLimiter } from '../redis-rate-limiter';
import { RateLimitResult } from '../../domain/rate-limiting-entities';

// Mock Redis operations since we don't have actual Redis in tests
const mockRedisOperations = {
  executeScript: jest.fn(),
  getTtl: jest.fn(),
  cleanupOldEntries: jest.fn()
};

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      REDIS_URL: 'redis://test:6379',
      REDIS_RATE_LIMIT_PREFIX: 'test:rl:',
      REDIS_RATE_LIMIT_TTL: '7200'
    };
    rateLimiter = new RedisRateLimiter();
    
    // Mock the internal Redis methods
    (rateLimiter as any).executeSlidingWindowScript = jest.fn();
    (rateLimiter as any).executeTokenBucketScript = jest.fn();
    (rateLimiter as any).executeLeakyBucketScript = jest.fn();
    (rateLimiter as any).executeFixedWindowScript = jest.fn();
    (rateLimiter as any).getDistributedQuota = jest.fn();
    (rateLimiter as any).reportUsage = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use environment variables when available', () => {
      expect(rateLimiter).toBeDefined();
      expect((rateLimiter as any).redisUrl).toBe('redis://test:6379');
      expect((rateLimiter as any).keyPrefix).toBe('test:rl:');
      expect((rateLimiter as any).defaultTtl).toBe(7200);
    });

    it('should use default values when environment variables are not set', () => {
      process.env = {};
      const defaultRateLimiter = new RedisRateLimiter();
      expect((defaultRateLimiter as any).redisUrl).toBe('redis://localhost:6379');
      expect((defaultRateLimiter as any).keyPrefix).toBe('rl:');
      expect((defaultRateLimiter as any).defaultTtl).toBe(3600);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests within rate limit', async () => {
      const mockResults = { count: 5 };
      (rateLimiter as any).executeSlidingWindowScript.mockResolvedValue(mockResults);

      const result = await rateLimiter.checkLimit('user:123', 10, 60);

      expect(result).toMatchObject({
        allowed: true,
        limit: 10,
        remaining: 5,
        retryAfter: undefined,
        message: undefined
      });
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.headers['X-RateLimit-Limit']).toBe('10');
      expect(result.headers['X-RateLimit-Remaining']).toBe('5');
    });

    it('should block requests exceeding rate limit', async () => {
      const mockResults = { count: 15 };
      (rateLimiter as any).executeSlidingWindowScript.mockResolvedValue(mockResults);

      const result = await rateLimiter.checkLimit('user:123', 10, 60);

      expect(result).toMatchObject({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfter: 60,
        message: 'Rate limit exceeded'
      });
    });

    it('should handle Redis errors gracefully', async () => {
      (rateLimiter as any).executeSlidingWindowScript.mockRejectedValue(new Error('Redis connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await rateLimiter.checkLimit('user:123', 10, 60);

      expect(result).toMatchObject({
        allowed: true, // Fail open on errors
        limit: 10,
        remaining: 10,
        headers: {}
      });
      expect(consoleSpy).toHaveBeenCalledWith('Redis rate limit check failed:', expect.any(Error));
    });
  });

  describe('checkBurstLimit', () => {
    it('should allow requests within burst limit', async () => {
      const mockResults = { count: 5 };
      (rateLimiter as any).executeSlidingWindowScript.mockResolvedValue(mockResults);

      const result = await rateLimiter.checkBurstLimit('user:123', 10);

      expect(result).toMatchObject({
        allowed: true,
        limit: 10,
        remaining: 5,
        retryAfter: undefined,
        message: undefined
      });
      expect(result.headers['X-RateLimit-Burst-Limit']).toBe('10');
      expect(result.headers['X-RateLimit-Burst-Remaining']).toBe('5');
    });

    it('should block requests exceeding burst limit', async () => {
      const mockResults = { count: 15 };
      (rateLimiter as any).executeSlidingWindowScript.mockResolvedValue(mockResults);

      const result = await rateLimiter.checkBurstLimit('user:123', 10);

      expect(result).toMatchObject({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfter: 1,
        message: 'Burst limit exceeded'
      });
    });
  });

  describe('checkConcurrentLimit', () => {
    it('should allow requests within concurrent limit', async () => {
      jest.spyOn(rateLimiter, 'getConcurrentCount').mockResolvedValue(3);

      const result = await rateLimiter.checkConcurrentLimit('service:abc', 10);

      expect(result).toMatchObject({
        allowed: true,
        limit: 10,
        remaining: 7,
        retryAfter: undefined
      });
      expect(result.headers['X-RateLimit-Concurrent-Current']).toBe('3');
    });

    it('should block requests exceeding concurrent limit', async () => {
      jest.spyOn(rateLimiter, 'getConcurrentCount').mockResolvedValue(10);

      const result = await rateLimiter.checkConcurrentLimit('service:abc', 10);

      expect(result).toMatchObject({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfter: 60,
        message: 'Concurrent requests limit exceeded'
      });
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter with TTL', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (rateLimiter as any).executeIncrementScript = jest.fn().mockResolvedValue(undefined);

      await rateLimiter.incrementCounter('user:123', 3600);

      expect((rateLimiter as any).executeIncrementScript).toHaveBeenCalledWith('test:rl:user:123', 3600);
    });

    it('should handle increment errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (rateLimiter as any).executeIncrementScript = jest.fn().mockRejectedValue(new Error('Redis error'));

      await rateLimiter.incrementCounter('user:123', 3600);

      expect(consoleSpy).toHaveBeenCalledWith('Redis counter increment failed:', expect.any(Error));
    });
  });

  describe('incrementBurstCounter', () => {
    it('should increment burst counter', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (rateLimiter as any).executeBurstIncrementScript = jest.fn().mockResolvedValue(undefined);

      await rateLimiter.incrementBurstCounter('user:123');

      expect((rateLimiter as any).executeBurstIncrementScript).toHaveBeenCalledWith(
        'test:rl:burst:user:123',
        expect.any(Number)
      );
    });
  });

  describe('incrementConcurrentCounter', () => {
    it('should increment concurrent counter', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (rateLimiter as any).executeConcurrentIncrementScript = jest.fn().mockResolvedValue(undefined);

      await rateLimiter.incrementConcurrentCounter('service:abc');

      expect((rateLimiter as any).executeConcurrentIncrementScript).toHaveBeenCalledWith('test:rl:concurrent:service:abc');
    });
  });

  describe('decrementConcurrentCounter', () => {
    it('should decrement concurrent counter', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (rateLimiter as any).executeConcurrentDecrementScript = jest.fn().mockResolvedValue(undefined);

      await rateLimiter.decrementConcurrentCounter('service:abc');

      expect((rateLimiter as any).executeConcurrentDecrementScript).toHaveBeenCalledWith('test:rl:concurrent:service:abc');
    });
  });

  describe('getCurrentCount', () => {
    it('should get current count', async () => {
      (rateLimiter as any).getCount = jest.fn().mockResolvedValue(42);

      const result = await rateLimiter.getCurrentCount('user:123');

      expect(result).toBe(42);
      expect((rateLimiter as any).getCount).toHaveBeenCalledWith('test:rl:user:123');
    });

    it('should handle get count errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (rateLimiter as any).getCount = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await rateLimiter.getCurrentCount('user:123');

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Redis get count failed:', expect.any(Error));
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (rateLimiter as any).deleteKey = jest.fn().mockResolvedValue(undefined);

      await rateLimiter.clearRateLimit('user:123');

      expect((rateLimiter as any).deleteKey).toHaveBeenCalledWith('test:rl:user:123');
    });

    it('should handle clear errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (rateLimiter as any).deleteKey = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await rateLimiter.clearRateLimit('user:123');

      expect(consoleSpy).toHaveBeenCalledWith('Redis clear rate limit failed:', expect.any(Error));
    });
  });

  describe('getRateLimitInfo', () => {
    it('should get rate limit information', async () => {
      (rateLimiter as any).getCount = jest.fn().mockResolvedValue(45);
      (rateLimiter as any).getTtl = jest.fn().mockResolvedValue(300);

      const result = await rateLimiter.getRateLimitInfo('api:key456');

      expect(result).toMatchObject({
        count: 45,
        ttl: 300,
        resetTime: expect.any(Date)
      });
      expect((rateLimiter as any).getCount).toHaveBeenCalledWith('test:rl:api:key456');
      expect((rateLimiter as any).getTtl).toHaveBeenCalledWith('test:rl:api:key456');
    });

    it('should handle info retrieval errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (rateLimiter as any).getCount = jest.fn().mockRejectedValue(new Error('Get count failed'));

      const result = await rateLimiter.getRateLimitInfo('api:key456');

      expect(result).toEqual({
        count: 0,
        ttl: 0,
        resetTime: expect.any(Date)
      });
      expect(consoleSpy).toHaveBeenCalledWith('Redis get rate limit info failed:', expect.any(Error));
    });
  });
});