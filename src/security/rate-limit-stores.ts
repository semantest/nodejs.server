/**
 * @fileoverview Rate Limiting Stores
 * @description Redis and in-memory store implementations for rate limiting
 * @author Web-Buddy Team
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Rate limit store entry
 */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
  tokens?: number; // For token bucket algorithm
  lastRefill?: number; // For token bucket algorithm
  windowStart?: number; // For sliding window algorithm
  requests?: number[]; // For sliding window algorithm (timestamps)
}

/**
 * Abstract rate limit store interface
 */
export abstract class RateLimitStore {
  abstract get(key: string): Promise<RateLimitEntry | null>;
  abstract set(key: string, value: RateLimitEntry, ttlMs?: number): Promise<void>;
  abstract increment(key: string, ttlMs?: number): Promise<number>;
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  abstract cleanup(): Promise<void>;
  abstract getStats(): Promise<StoreStats>;
}

/**
 * Store statistics interface
 */
export interface StoreStats {
  totalKeys: number;
  memoryUsage: number;
  hitRate?: number;
  missRate?: number;
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    increments: number;
  };
}

/**
 * Redis-based rate limit store
 */
export class RedisRateLimitStore extends RateLimitStore {
  private client: RedisClientType;
  private isConnected = false;
  private stats = {
    gets: 0,
    sets: 0,
    deletes: 0,
    increments: 0,
    hits: 0,
    misses: 0
  };

  constructor(
    private config: {
      url?: string;
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      retryAttempts?: number;
      retryDelay?: number;
      keyPrefix?: string;
    } = {}
  ) {
    super();
    this.client = createClient({
      url: config.url,
      socket: {
        host: config.host || 'localhost',
        port: config.port || 6379,
        reconnectStrategy: (retries) => {
          const maxRetries = config.retryAttempts || 5;
          if (retries >= maxRetries) {
            console.error(`❌ Redis connection failed after ${maxRetries} attempts`);
            return false;
          }
          const delay = Math.min(config.retryDelay || 1000 * Math.pow(2, retries), 30000);
          console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
          return delay;
        }
      },
      password: config.password,
      database: config.db || 0
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      console.log('✅ Redis client ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      console.error('❌ Redis client error:', error);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      console.log('🔌 Redis client disconnected');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
    });
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Get prefixed key
   */
  private getKey(key: string): string {
    const prefix = this.config.keyPrefix || 'rl:';
    return `${prefix}${key}`;
  }

  /**
   * Get rate limit entry
   */
  public async get(key: string): Promise<RateLimitEntry | null> {
    this.stats.gets++;
    
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const data = await this.client.get(this.getKey(key));
      
      if (data) {
        this.stats.hits++;
        return JSON.parse(data) as RateLimitEntry;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('❌ Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set rate limit entry
   */
  public async set(key: string, value: RateLimitEntry, ttlMs?: number): Promise<void> {
    this.stats.sets++;
    
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const redisKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);

      if (ttlMs) {
        await this.client.setEx(redisKey, Math.ceil(ttlMs / 1000), serializedValue);
      } else {
        await this.client.set(redisKey, serializedValue);
      }
    } catch (error) {
      console.error('❌ Redis set error:', error);
      throw error;
    }
  }

  /**
   * Increment counter atomically
   */
  public async increment(key: string, ttlMs?: number): Promise<number> {
    this.stats.increments++;
    
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const redisKey = this.getKey(key);
      const result = await this.client.incr(redisKey);

      if (ttlMs && result === 1) {
        // Set TTL only for the first increment
        await this.client.expire(redisKey, Math.ceil(ttlMs / 1000));
      }

      return result;
    } catch (error) {
      console.error('❌ Redis increment error:', error);
      throw error;
    }
  }

  /**
   * Delete rate limit entry
   */
  public async delete(key: string): Promise<void> {
    this.stats.deletes++;
    
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.client.del(this.getKey(key));
    } catch (error) {
      console.error('❌ Redis delete error:', error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error('❌ Redis exists error:', error);
      return false;
    }
  }

  /**
   * Cleanup expired entries
   */
  public async cleanup(): Promise<void> {
    // Redis handles TTL cleanup automatically
    console.log('🧹 Redis cleanup - TTL handles expiration automatically');
  }

  /**
   * Get store statistics
   */
  public async getStats(): Promise<StoreStats> {
    try {
      let totalKeys = 0;
      let memoryUsage = 0;

      if (this.isConnected) {
        // Get database size
        totalKeys = await this.client.dbSize();
        
        // Get memory usage (Redis info command)
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          memoryUsage = parseInt(memoryMatch[1], 10);
        }
      }

      const totalOperations = this.stats.gets + this.stats.sets + this.stats.deletes + this.stats.increments;
      const hitRate = this.stats.gets > 0 ? (this.stats.hits / this.stats.gets) * 100 : 0;
      const missRate = this.stats.gets > 0 ? (this.stats.misses / this.stats.gets) * 100 : 0;

      return {
        totalKeys,
        memoryUsage,
        hitRate,
        missRate,
        operations: {
          gets: this.stats.gets,
          sets: this.stats.sets,
          deletes: this.stats.deletes,
          increments: this.stats.increments
        }
      };
    } catch (error) {
      console.error('❌ Redis stats error:', error);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        operations: {
          gets: this.stats.gets,
          sets: this.stats.sets,
          deletes: this.stats.deletes,
          increments: this.stats.increments
        }
      };
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('❌ Redis health check failed:', error);
      return false;
    }
  }
}

/**
 * In-memory rate limit store with LRU eviction
 */
export class InMemoryRateLimitStore extends RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private lastAccess = new Map<string, number>();
  private cleanupInterval?: NodeJS.Timeout;
  private stats = {
    gets: 0,
    sets: 0,
    deletes: 0,
    increments: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(
    private config: {
      maxSize?: number;
      cleanupIntervalMs?: number;
      maxAge?: number;
    } = {}
  ) {
    super();
    
    const maxSize = config.maxSize || 10000;
    const cleanupIntervalMs = config.cleanupIntervalMs || 60000; // 1 minute
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    console.log(`💾 In-memory rate limit store initialized (max size: ${maxSize})`);
  }

  /**
   * Get rate limit entry
   */
  public async get(key: string): Promise<RateLimitEntry | null> {
    this.stats.gets++;
    
    const entry = this.store.get(key);
    
    if (entry) {
      this.stats.hits++;
      this.lastAccess.set(key, Date.now());
      
      // Check if entry is expired
      if (entry.resetTime <= Date.now()) {
        this.store.delete(key);
        this.lastAccess.delete(key);
        this.stats.misses++;
        return null;
      }
      
      return { ...entry }; // Return copy to prevent mutations
    } else {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set rate limit entry
   */
  public async set(key: string, value: RateLimitEntry, ttlMs?: number): Promise<void> {
    this.stats.sets++;
    
    // Check if we need to evict entries
    this.evictIfNecessary();
    
    const now = Date.now();
    const entry: RateLimitEntry = {
      ...value,
      resetTime: ttlMs ? now + ttlMs : value.resetTime
    };
    
    this.store.set(key, entry);
    this.lastAccess.set(key, now);
  }

  /**
   * Increment counter atomically
   */
  public async increment(key: string, ttlMs?: number): Promise<number> {
    this.stats.increments++;
    
    const existing = await this.get(key);
    const now = Date.now();
    
    if (existing) {
      existing.count++;
      await this.set(key, existing);
      return existing.count;
    } else {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: ttlMs ? now + ttlMs : now + 3600000 // Default 1 hour
      };
      await this.set(key, newEntry);
      return 1;
    }
  }

  /**
   * Delete rate limit entry
   */
  public async delete(key: string): Promise<void> {
    this.stats.deletes++;
    
    if (this.store.delete(key)) {
      this.lastAccess.delete(key);
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  /**
   * Cleanup expired entries and enforce size limits
   */
  public async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = this.config.maxAge || 3600000; // 1 hour default
    let cleaned = 0;

    // Remove expired entries
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
        this.lastAccess.delete(key);
        cleaned++;
      }
    }

    // Remove old entries based on last access
    for (const [key, lastAccess] of this.lastAccess.entries()) {
      if (now - lastAccess > maxAge) {
        this.store.delete(key);
        this.lastAccess.delete(key);
        cleaned++;
      }
    }

    // Enforce size limit with LRU eviction
    this.evictIfNecessary();

    if (cleaned > 0) {
      console.log(`🧹 In-memory store cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Evict entries if store is over size limit
   */
  private evictIfNecessary(): void {
    const maxSize = this.config.maxSize || 10000;
    
    if (this.store.size >= maxSize) {
      // Find least recently used entries
      const sortedByAccess = Array.from(this.lastAccess.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const toEvict = Math.floor(maxSize * 0.1); // Evict 10% of max size
      
      for (let i = 0; i < toEvict && i < sortedByAccess.length; i++) {
        const [key] = sortedByAccess[i];
        this.store.delete(key);
        this.lastAccess.delete(key);
        this.stats.evictions++;
      }
      
      console.log(`💾 Evicted ${toEvict} entries due to size limit`);
    }
  }

  /**
   * Get store statistics
   */
  public async getStats(): Promise<StoreStats> {
    const memoryUsage = this.estimateMemoryUsage();
    const hitRate = this.stats.gets > 0 ? (this.stats.hits / this.stats.gets) * 100 : 0;
    const missRate = this.stats.gets > 0 ? (this.stats.misses / this.stats.gets) * 100 : 0;

    return {
      totalKeys: this.store.size,
      memoryUsage,
      hitRate,
      missRate,
      operations: {
        gets: this.stats.gets,
        sets: this.stats.sets,
        deletes: this.stats.deletes,
        increments: this.stats.increments
      }
    };
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    const avgKeySize = 50; // bytes
    const avgValueSize = 200; // bytes (JSON serialized RateLimitEntry)
    return this.store.size * (avgKeySize + avgValueSize);
  }

  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.store.clear();
    this.lastAccess.clear();
    
    console.log('💾 In-memory rate limit store shut down');
  }
}

/**
 * Factory function to create rate limit store based on configuration
 */
export function createRateLimitStore(config: {
  type: 'redis' | 'memory';
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    retryAttempts?: number;
    retryDelay?: number;
    keyPrefix?: string;
  };
  memory?: {
    maxSize?: number;
    cleanupIntervalMs?: number;
    maxAge?: number;
  };
}): RateLimitStore {
  switch (config.type) {
    case 'redis':
      return new RedisRateLimitStore(config.redis || {});
    case 'memory':
      return new InMemoryRateLimitStore(config.memory || {});
    default:
      throw new Error(`Unsupported rate limit store type: ${config.type}`);
  }
}