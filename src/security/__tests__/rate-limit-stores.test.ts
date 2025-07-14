/**
 * @fileoverview Rate Limit Stores Unit Tests
 * @description Comprehensive tests for Redis and in-memory store operations
 * @author Web-Buddy Team
 */

import {
  RateLimitStore,
  RateLimitEntry,
  RedisRateLimitStore,
  InMemoryRateLimitStore,
  createRateLimitStore
} from '../rate-limit-stores';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  dbSize: jest.fn(),
  info: jest.fn(),
  ping: jest.fn(),
  on: jest.fn()
};

// Mock Redis createClient
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

describe('InMemoryRateLimitStore', () => {
  let store: InMemoryRateLimitStore;
  let testEntry: RateLimitEntry;

  beforeEach(() => {
    testUtils.resetTime();
    store = new InMemoryRateLimitStore({
      maxSize: 100,
      cleanupIntervalMs: 1000,
      maxAge: 60000
    });

    testEntry = {
      count: 5,
      resetTime: Date.now() + 60000,
      tokens: 10,
      lastRefill: Date.now(),
      windowStart: Date.now(),
      requests: [Date.now() - 1000, Date.now()]
    };
  });

  afterEach(() => {
    store.shutdown();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve entries', async () => {
      await store.set('test-key', testEntry);
      const retrieved = await store.get('test-key');

      expect(retrieved).toEqual(testEntry);
    });

    it('should return null for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      await store.set('test-key', testEntry);
      
      expect(await store.exists('test-key')).toBe(true);
      expect(await store.exists('non-existent')).toBe(false);
    });

    it('should delete entries', async () => {
      await store.set('test-key', testEntry);
      await store.delete('test-key');
      
      const result = await store.get('test-key');
      expect(result).toBeNull();
    });

    it('should increment counters atomically', async () => {
      const count1 = await store.increment('counter-key');
      const count2 = await store.increment('counter-key');
      const count3 = await store.increment('counter-key');

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('should set TTL when incrementing new key', async () => {
      const ttl = 5000;
      await store.increment('ttl-key', ttl);
      
      // Advance time beyond TTL
      testUtils.advanceTime(ttl + 1000);
      
      // Entry should be considered expired
      const entry = await store.get('ttl-key');
      expect(entry).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect TTL when setting entries', async () => {
      const ttl = 5000;
      await store.set('ttl-key', testEntry, ttl);
      
      // Should exist immediately
      expect(await store.exists('ttl-key')).toBe(true);
      
      // Advance time beyond TTL
      testUtils.advanceTime(ttl + 1000);
      
      // Should be expired
      const result = await store.get('ttl-key');
      expect(result).toBeNull();
    });

    it('should handle entries without TTL', async () => {
      await store.set('no-ttl-key', testEntry);
      
      // Advance time significantly
      testUtils.advanceTime(24 * 60 * 60 * 1000); // 24 hours
      
      // Should still exist
      expect(await store.exists('no-ttl-key')).toBe(true);
    });

    it('should return copy of entries to prevent mutations', async () => {
      await store.set('test-key', testEntry);
      const retrieved = await store.get('test-key');
      
      // Modify retrieved entry
      retrieved!.count = 999;
      
      // Original should be unchanged
      const original = await store.get('test-key');
      expect(original!.count).toBe(testEntry.count);
    });
  });

  describe('Memory Management', () => {
    it('should track accurate statistics', async () => {
      await store.set('key1', testEntry);
      await store.set('key2', testEntry);
      await store.increment('key3');
      
      const stats = await store.getStats();
      
      expect(stats.totalKeys).toBe(3);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.operations.sets).toBe(2);
      expect(stats.operations.increments).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should evict least recently used entries when size limit reached', async () => {
      const smallStore = new InMemoryRateLimitStore({ maxSize: 3 });
      
      // Add entries up to limit
      await smallStore.set('key1', testEntry);
      await smallStore.set('key2', testEntry);
      await smallStore.set('key3', testEntry);
      
      // Access key1 to make it recently used
      await smallStore.get('key1');
      
      // Add key4 - should evict key2 (least recently used)
      await smallStore.set('key4', testEntry);
      
      expect(await smallStore.exists('key1')).toBe(true); // Recently accessed
      expect(await smallStore.exists('key2')).toBe(false); // Should be evicted
      expect(await smallStore.exists('key3')).toBe(true);
      expect(await smallStore.exists('key4')).toBe(true);
      
      smallStore.shutdown();
    });

    it('should clean up expired entries', async () => {
      const expiredEntry = {
        ...testEntry,
        resetTime: Date.now() - 1000 // Already expired
      };
      
      await store.set('expired-key', expiredEntry);
      await store.set('valid-key', testEntry);
      
      // Trigger cleanup
      await store.cleanup();
      
      expect(await store.exists('expired-key')).toBe(false);
      expect(await store.exists('valid-key')).toBe(true);
    });

    it('should clean up old entries based on last access', async () => {
      const shortAgeStore = new InMemoryRateLimitStore({ maxAge: 1000 });
      
      await shortAgeStore.set('old-key', testEntry);
      
      // Advance time beyond maxAge
      testUtils.advanceTime(2000);
      
      // Add new entry to trigger cleanup
      await shortAgeStore.set('new-key', testEntry);
      await shortAgeStore.cleanup();
      
      expect(await shortAgeStore.exists('old-key')).toBe(false);
      expect(await shortAgeStore.exists('new-key')).toBe(true);
      
      shortAgeStore.shutdown();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent increments correctly', async () => {
      const promises = Array.from({ length: 100 }, () => 
        store.increment('concurrent-key')
      );
      
      const results = await Promise.all(promises);
      
      // Results should be sequential numbers from 1 to 100
      const sorted = results.sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    });

    it('should handle concurrent reads and writes', async () => {
      const operations = [];
      
      // Mix of concurrent operations
      for (let i = 0; i < 50; i++) {
        operations.push(store.set(`key${i}`, { ...testEntry, count: i }));
        operations.push(store.get(`key${Math.floor(i / 2)}`));
        operations.push(store.increment(`counter${i % 10}`));
      }
      
      // Should complete without errors
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle memory pressure gracefully', async () => {
      const stressStore = new InMemoryRateLimitStore({ maxSize: 10 });
      
      // Add many entries to trigger eviction
      for (let i = 0; i < 50; i++) {
        await stressStore.set(`stress-key-${i}`, testEntry);
      }
      
      const stats = await stressStore.getStats();
      expect(stats.totalKeys).toBeLessThanOrEqual(10);
      
      stressStore.shutdown();
    });

    it('should estimate memory usage reasonably', async () => {
      const emptyStats = await store.getStats();
      const emptyMemory = emptyStats.memoryUsage;
      
      // Add entries
      for (let i = 0; i < 10; i++) {
        await store.set(`memory-key-${i}`, testEntry);
      }
      
      const fullStats = await store.getStats();
      expect(fullStats.memoryUsage).toBeGreaterThan(emptyMemory);
    });
  });
});

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;
  let testEntry: RateLimitEntry;

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();
    
    store = new RedisRateLimitStore({
      host: 'localhost',
      port: 6379,
      db: 15, // Use test database
      keyPrefix: 'test:rl:',
      retryAttempts: 3,
      retryDelay: 100
    });

    testEntry = {
      count: 5,
      resetTime: Date.now() + 60000,
      tokens: 10,
      lastRefill: Date.now()
    };

    // Setup default mock behaviors
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.disconnect.mockResolvedValue(undefined);
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.setEx.mockResolvedValue('OK');
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.expire.mockResolvedValue(1);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.dbSize.mockResolvedValue(0);
    mockRedisClient.info.mockResolvedValue('used_memory:1024\r\n');
    mockRedisClient.ping.mockResolvedValue('PONG');
  });

  afterEach(async () => {
    await store.disconnect();
  });

  describe('Connection Management', () => {
    it('should initialize with correct configuration', () => {
      expect(store).toBeDefined();
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should connect to Redis when needed', async () => {
      await store.get('test-key');
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should disconnect from Redis', async () => {
      await store.connect();
      await store.disconnect();
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection error'));
      
      const result = await store.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve entries with prefix', async () => {
      const serializedEntry = JSON.stringify(testEntry);
      mockRedisClient.get.mockResolvedValue(serializedEntry);
      
      await store.set('test-key', testEntry);
      const retrieved = await store.get('test-key');

      expect(mockRedisClient.set).toHaveBeenCalledWith('test:rl:test-key', serializedEntry);
      expect(retrieved).toEqual(testEntry);
    });

    it('should store entries with TTL', async () => {
      const ttl = 60000;
      
      await store.set('ttl-key', testEntry, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:rl:ttl-key',
        60, // TTL in seconds
        JSON.stringify(testEntry)
      );
    });

    it('should return null for non-existent keys', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      
      const exists = await store.exists('test-key');
      expect(exists).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test:rl:test-key');
    });

    it('should delete entries', async () => {
      await store.delete('test-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:rl:test-key');
    });

    it('should increment counters atomically', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(1)
                         .mockResolvedValueOnce(2)
                         .mockResolvedValueOnce(3);
      
      const count1 = await store.increment('counter-key');
      const count2 = await store.increment('counter-key');
      const count3 = await store.increment('counter-key');

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('should set TTL on first increment', async () => {
      mockRedisClient.incr.mockResolvedValue(1); // First increment
      
      const ttl = 60000;
      await store.increment('new-counter', ttl);
      
      expect(mockRedisClient.expire).toHaveBeenCalledWith('test:rl:new-counter', 60);
    });

    it('should not set TTL on subsequent increments', async () => {
      mockRedisClient.incr.mockResolvedValue(2); // Not first increment
      
      const ttl = 60000;
      await store.increment('existing-counter', ttl);
      
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis operation errors', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));
      
      await expect(store.set('error-key', testEntry)).rejects.toThrow('Redis error');
    });

    it('should handle get operation errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Get error'));
      
      const result = await store.get('error-key');
      expect(result).toBeNull();
    });

    it('should handle exists operation errors', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Exists error'));
      
      const result = await store.exists('error-key');
      expect(result).toBe(false);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json');
      
      await expect(store.get('malformed-key')).rejects.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide store statistics', async () => {
      mockRedisClient.dbSize.mockResolvedValue(42);
      mockRedisClient.info.mockResolvedValue('used_memory:2048\r\nother_info:value\r\n');
      
      const stats = await store.getStats();
      
      expect(stats).toMatchObject({
        totalKeys: 42,
        memoryUsage: 2048,
        hitRate: expect.any(Number),
        missRate: expect.any(Number),
        operations: expect.objectContaining({
          gets: expect.any(Number),
          sets: expect.any(Number),
          deletes: expect.any(Number),
          increments: expect.any(Number)
        })
      });
    });

    it('should track hit and miss rates', async () => {
      // Simulate hits and misses
      mockRedisClient.get.mockResolvedValueOnce('{"count":1}') // Hit
                         .mockResolvedValueOnce(null)           // Miss
                         .mockResolvedValueOnce('{"count":2}'); // Hit
      
      await store.get('key1'); // Hit
      await store.get('key2'); // Miss
      await store.get('key3'); // Hit
      
      const stats = await store.getStats();
      expect(stats.hitRate).toBeCloseTo(66.67, 1); // 2/3 * 100
      expect(stats.missRate).toBeCloseTo(33.33, 1); // 1/3 * 100
    });

    it('should handle statistics errors gracefully', async () => {
      mockRedisClient.dbSize.mockRejectedValue(new Error('Stats error'));
      
      const stats = await store.getStats();
      
      expect(stats.totalKeys).toBe(0);
      expect(stats.memoryUsage).toBe(0);
    });

    it('should perform health check', async () => {
      const healthy = await store.healthCheck();
      expect(healthy).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should fail health check on Redis error', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'));
      
      const healthy = await store.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should handle cleanup (Redis handles TTL automatically)', async () => {
      await store.cleanup();
      // Redis handles TTL cleanup automatically, so this should just complete
      expect(true).toBe(true);
    });
  });

  describe('Connection Resilience', () => {
    it('should handle reconnection scenarios', async () => {
      // Simulate connection loss and recovery
      mockRedisClient.get.mockRejectedValueOnce(new Error('Connection lost'))
                         .mockResolvedValueOnce('{"count":1}');
      
      const result1 = await store.get('test-key'); // Should fail gracefully
      const result2 = await store.get('test-key'); // Should succeed after reconnection
      
      expect(result1).toBeNull();
      expect(result2).toEqual({ count: 1 });
    });
  });
});

describe('Store Factory', () => {
  it('should create Redis store with configuration', () => {
    const config = {
      type: 'redis' as const,
      redis: {
        host: 'localhost',
        port: 6379,
        password: 'secret'
      }
    };
    
    const store = createRateLimitStore(config);
    expect(store).toBeInstanceOf(RedisRateLimitStore);
  });

  it('should create memory store with configuration', () => {
    const config = {
      type: 'memory' as const,
      memory: {
        maxSize: 1000,
        maxAge: 60000
      }
    };
    
    const store = createRateLimitStore(config);
    expect(store).toBeInstanceOf(InMemoryRateLimitStore);
    
    // Clean up
    (store as InMemoryRateLimitStore).shutdown();
  });

  it('should throw error for unsupported store type', () => {
    const config = { type: 'unsupported' as any };
    
    expect(() => createRateLimitStore(config)).toThrow(
      'Unsupported rate limit store type: unsupported'
    );
  });

  it('should create stores with default configurations', () => {
    const redisStore = createRateLimitStore({ type: 'redis' });
    const memoryStore = createRateLimitStore({ type: 'memory' });
    
    expect(redisStore).toBeInstanceOf(RedisRateLimitStore);
    expect(memoryStore).toBeInstanceOf(InMemoryRateLimitStore);
    
    // Clean up
    (memoryStore as InMemoryRateLimitStore).shutdown();
  });
});

describe('Store Performance and Concurrency', () => {
  let memoryStore: InMemoryRateLimitStore;

  beforeEach(() => {
    memoryStore = new InMemoryRateLimitStore({ maxSize: 1000 });
  });

  afterEach(() => {
    memoryStore.shutdown();
  });

  it('should handle high-throughput operations', async () => {
    const operations = [];
    const startTime = Date.now();
    
    // Simulate high throughput
    for (let i = 0; i < 1000; i++) {
      operations.push(memoryStore.increment(`key-${i % 100}`));
    }
    
    await Promise.all(operations);
    const endTime = Date.now();
    
    // Should complete within reasonable time (adjust threshold as needed)
    expect(endTime - startTime).toBeLessThan(1000);
    
    const stats = await memoryStore.getStats();
    expect(stats.operations.increments).toBe(1000);
  });

  it('should maintain data consistency under concurrent access', async () => {
    const key = 'consistency-test';
    const numOperations = 100;
    
    // Concurrent increments
    const promises = Array.from({ length: numOperations }, () => 
      memoryStore.increment(key)
    );
    
    const results = await Promise.all(promises);
    
    // Final count should equal number of operations
    const finalEntry = await memoryStore.get(key);
    expect(finalEntry?.count).toBe(numOperations);
    
    // All results should be unique sequential numbers
    const sortedResults = results.sort((a, b) => a - b);
    expect(sortedResults).toEqual(Array.from({ length: numOperations }, (_, i) => i + 1));
  });

  it('should handle memory pressure gracefully', async () => {
    const smallStore = new InMemoryRateLimitStore({ maxSize: 10 });
    
    // Add more entries than the limit
    for (let i = 0; i < 50; i++) {
      await smallStore.set(`pressure-key-${i}`, {
        count: i,
        resetTime: Date.now() + 60000
      });
    }
    
    const stats = await smallStore.getStats();
    expect(stats.totalKeys).toBeLessThanOrEqual(10);
    
    smallStore.shutdown();
  });
});