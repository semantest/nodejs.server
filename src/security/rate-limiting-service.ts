/**
 * @fileoverview Rate Limiting Service
 * @description Core service with token bucket and sliding window algorithms
 * @author Web-Buddy Team
 */

import { RateLimitStore, RateLimitEntry } from './rate-limit-stores';

/**
 * Rate limit algorithm types
 */
export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window' | 'fixed-window';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  windowMs: number;
  maxRequests: number;
  burstSize?: number; // For token bucket
  refillRate?: number; // For token bucket (tokens per second)
  keyGenerator?: (identifier: string, endpoint?: string) => string;
  skipOnError?: boolean;
  skipOnSuccess?: boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  resetTime: number;
  retryAfter?: number;
  algorithm: RateLimitAlgorithm;
  metadata: {
    currentCount: number;
    windowStart?: number;
    totalHits: number;
    identifier: string;
    endpoint?: string;
  };
}

/**
 * Rate limit context
 */
export interface RateLimitContext {
  identifier: string; // IP, user ID, API key, etc.
  endpoint?: string;
  userAgent?: string;
  extensionId?: string;
  timestamp?: number;
  weight?: number; // Request weight (default: 1)
}

/**
 * Rate limiting service with multiple algorithms
 */
export class RateLimitingService {
  private readonly defaultConfig: Required<RateLimitConfig> = {
    algorithm: 'sliding-window',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    burstSize: 10,
    refillRate: 1, // 1 token per second
    keyGenerator: (identifier: string, endpoint?: string) => 
      endpoint ? `${identifier}:${endpoint}` : identifier,
    skipOnError: false,
    skipOnSuccess: false
  };

  constructor(
    private store: RateLimitStore,
    private globalConfig: Partial<RateLimitConfig> = {}
  ) {}

  /**
   * Check if request is allowed under rate limit
   */
  public async checkRateLimit(
    context: RateLimitContext,
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const mergedConfig = { ...this.defaultConfig, ...this.globalConfig, ...config };
    const key = mergedConfig.keyGenerator(context.identifier, context.endpoint);
    const weight = context.weight || 1;
    const timestamp = context.timestamp || Date.now();

    try {
      switch (mergedConfig.algorithm) {
        case 'token-bucket':
          return await this.checkTokenBucket(key, mergedConfig, weight, timestamp, context);
        case 'sliding-window':
          return await this.checkSlidingWindow(key, mergedConfig, weight, timestamp, context);
        case 'fixed-window':
          return await this.checkFixedWindow(key, mergedConfig, weight, timestamp, context);
        default:
          throw new Error(`Unsupported algorithm: ${mergedConfig.algorithm}`);
      }
    } catch (error) {
      console.error('❌ Rate limit check failed:', error);
      
      if (mergedConfig.skipOnError) {
        return this.createAllowedResult(mergedConfig, context, timestamp);
      }
      
      throw error;
    }
  }

  /**
   * Token bucket algorithm implementation
   */
  private async checkTokenBucket(
    key: string,
    config: Required<RateLimitConfig>,
    weight: number,
    timestamp: number,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const existing = await this.store.get(key);
    const now = timestamp;
    
    let tokens: number;
    let lastRefill: number;
    let totalHits: number;

    if (existing && existing.lastRefill) {
      // Calculate tokens to add based on refill rate
      const timePassed = (now - existing.lastRefill) / 1000; // seconds
      const tokensToAdd = Math.floor(timePassed * config.refillRate);
      tokens = Math.min(config.burstSize, (existing.tokens || 0) + tokensToAdd);
      lastRefill = existing.lastRefill + (tokensToAdd * 1000 / config.refillRate);
      totalHits = existing.count || 0;
    } else {
      // Initialize bucket
      tokens = config.burstSize;
      lastRefill = now;
      totalHits = 0;
    }

    const allowed = tokens >= weight;
    
    if (allowed) {
      tokens -= weight;
      totalHits += weight;
    }

    // Calculate next refill time
    const nextRefillTime = lastRefill + (1000 / config.refillRate);
    const resetTime = tokens === 0 ? nextRefillTime : now;

    // Store updated state
    const newEntry: RateLimitEntry = {
      count: totalHits,
      resetTime,
      tokens,
      lastRefill,
      windowStart: now
    };

    await this.store.set(key, newEntry, config.windowMs);

    return {
      allowed,
      remainingTokens: tokens,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((nextRefillTime - now) / 1000),
      algorithm: 'token-bucket',
      metadata: {
        currentCount: totalHits,
        windowStart: lastRefill,
        totalHits,
        identifier: context.identifier,
        endpoint: context.endpoint
      }
    };
  }

  /**
   * Sliding window algorithm implementation
   */
  private async checkSlidingWindow(
    key: string,
    config: Required<RateLimitConfig>,
    weight: number,
    timestamp: number,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const existing = await this.store.get(key);
    const now = timestamp;
    const windowStart = now - config.windowMs;
    
    let requests: number[] = [];
    let totalHits = 0;

    if (existing && existing.requests) {
      // Filter out requests outside the sliding window
      requests = existing.requests.filter(reqTime => reqTime > windowStart);
      totalHits = existing.count || 0;
    }

    // Calculate current count within the window
    const currentCount = requests.length;
    const allowed = currentCount + weight <= config.maxRequests;
    
    if (allowed) {
      // Add current request timestamp(s) based on weight
      for (let i = 0; i < weight; i++) {
        requests.push(now + i); // Slight offset for multiple requests
      }
      totalHits += weight;
    }

    // Calculate reset time (when the oldest request in window expires)
    const oldestRequestTime = requests.length > 0 ? Math.min(...requests) : now;
    const resetTime = oldestRequestTime + config.windowMs;

    // Store updated state
    const newEntry: RateLimitEntry = {
      count: totalHits,
      resetTime,
      windowStart: now,
      requests: requests.slice(-config.maxRequests) // Keep only recent requests to limit memory
    };

    await this.store.set(key, newEntry, config.windowMs);

    return {
      allowed,
      remainingTokens: Math.max(0, config.maxRequests - currentCount - (allowed ? weight : 0)),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      algorithm: 'sliding-window',
      metadata: {
        currentCount: currentCount + (allowed ? weight : 0),
        windowStart,
        totalHits,
        identifier: context.identifier,
        endpoint: context.endpoint
      }
    };
  }

  /**
   * Fixed window algorithm implementation
   */
  private async checkFixedWindow(
    key: string,
    config: Required<RateLimitConfig>,
    weight: number,
    timestamp: number,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const now = timestamp;
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const windowKey = `${key}:${windowStart}`;
    
    const existing = await this.store.get(windowKey);
    const currentCount = existing ? existing.count : 0;
    const allowed = currentCount + weight <= config.maxRequests;
    
    let newCount = currentCount;
    let totalHits = existing ? (existing.count || 0) : 0;
    
    if (allowed) {
      newCount += weight;
      totalHits += weight;
    }

    const resetTime = windowStart + config.windowMs;

    // Store updated state
    const newEntry: RateLimitEntry = {
      count: newCount,
      resetTime,
      windowStart
    };

    await this.store.set(windowKey, newEntry, config.windowMs);

    return {
      allowed,
      remainingTokens: Math.max(0, config.maxRequests - newCount),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
      algorithm: 'fixed-window',
      metadata: {
        currentCount: newCount,
        windowStart,
        totalHits,
        identifier: context.identifier,
        endpoint: context.endpoint
      }
    };
  }

  /**
   * Create allowed result for error cases
   */
  private createAllowedResult(
    config: Required<RateLimitConfig>,
    context: RateLimitContext,
    timestamp: number
  ): RateLimitResult {
    return {
      allowed: true,
      remainingTokens: config.maxRequests,
      resetTime: timestamp + config.windowMs,
      algorithm: config.algorithm,
      metadata: {
        currentCount: 0,
        totalHits: 0,
        identifier: context.identifier,
        endpoint: context.endpoint
      }
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public async resetRateLimit(
    identifier: string,
    endpoint?: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...this.globalConfig, ...config };
    const key = mergedConfig.keyGenerator(identifier, endpoint);
    await this.store.delete(key);
  }

  /**
   * Get current rate limit status without affecting the limit
   */
  public async getRateLimitStatus(
    identifier: string,
    endpoint?: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<Omit<RateLimitResult, 'allowed'> | null> {
    const mergedConfig = { ...this.defaultConfig, ...this.globalConfig, ...config };
    const key = mergedConfig.keyGenerator(identifier, endpoint);
    const entry = await this.store.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    let remainingTokens = 0;
    let currentCount = 0;

    switch (mergedConfig.algorithm) {
      case 'token-bucket':
        const timePassed = (now - (entry.lastRefill || now)) / 1000;
        const tokensToAdd = Math.floor(timePassed * mergedConfig.refillRate);
        remainingTokens = Math.min(mergedConfig.burstSize, (entry.tokens || 0) + tokensToAdd);
        currentCount = entry.count || 0;
        break;
        
      case 'sliding-window':
        const windowStart = now - mergedConfig.windowMs;
        const validRequests = (entry.requests || []).filter(reqTime => reqTime > windowStart);
        currentCount = validRequests.length;
        remainingTokens = Math.max(0, mergedConfig.maxRequests - currentCount);
        break;
        
      case 'fixed-window':
        currentCount = entry.count || 0;
        remainingTokens = Math.max(0, mergedConfig.maxRequests - currentCount);
        break;
    }

    return {
      remainingTokens,
      resetTime: entry.resetTime,
      algorithm: mergedConfig.algorithm,
      metadata: {
        currentCount,
        windowStart: entry.windowStart,
        totalHits: entry.count || 0,
        identifier,
        endpoint
      }
    };
  }

  /**
   * Cleanup expired entries
   */
  public async cleanup(): Promise<void> {
    await this.store.cleanup();
  }

  /**
   * Get store statistics
   */
  public async getStats() {
    return await this.store.getStats();
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    store: any;
    timestamp: number;
  }> {
    try {
      const stats = await this.getStats();
      return {
        healthy: true,
        store: stats,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Rate limiting service health check failed:', error);
      return {
        healthy: false,
        store: null,
        timestamp: Date.now()
      };
    }
  }
}

/**
 * Multi-tier rate limiting service
 * Supports different limits for different tiers (global, endpoint, user)
 */
export class MultiTierRateLimitingService {
  private services = new Map<string, RateLimitingService>();
  
  constructor(
    private store: RateLimitStore,
    private tiers: Map<string, RateLimitConfig>
  ) {
    // Initialize services for each tier
    for (const [tierName, config] of tiers) {
      this.services.set(tierName, new RateLimitingService(store, config));
    }
  }

  /**
   * Check rate limits across all applicable tiers
   */
  public async checkMultiTierRateLimit(
    context: RateLimitContext,
    tierNames: string[]
  ): Promise<{
    allowed: boolean;
    results: Map<string, RateLimitResult>;
    mostRestrictive?: string;
  }> {
    const results = new Map<string, RateLimitResult>();
    let allowed = true;
    let mostRestrictive: string | undefined;
    let shortestRetryAfter = Infinity;

    // Check each tier
    for (const tierName of tierNames) {
      const service = this.services.get(tierName);
      if (!service) {
        console.warn(`⚠️ Unknown rate limit tier: ${tierName}`);
        continue;
      }

      const result = await service.checkRateLimit(context);
      results.set(tierName, result);

      if (!result.allowed) {
        allowed = false;
        if (result.retryAfter && result.retryAfter < shortestRetryAfter) {
          shortestRetryAfter = result.retryAfter;
          mostRestrictive = tierName;
        }
      }
    }

    return {
      allowed,
      results,
      mostRestrictive
    };
  }

  /**
   * Get service for specific tier
   */
  public getTierService(tierName: string): RateLimitingService | undefined {
    return this.services.get(tierName);
  }

  /**
   * Add new tier
   */
  public addTier(tierName: string, config: RateLimitConfig): void {
    this.tiers.set(tierName, config);
    this.services.set(tierName, new RateLimitingService(this.store, config));
  }

  /**
   * Remove tier
   */
  public removeTier(tierName: string): void {
    this.tiers.delete(tierName);
    this.services.delete(tierName);
  }

  /**
   * Get all tier names
   */
  public getTierNames(): string[] {
    return Array.from(this.tiers.keys());
  }
}

/**
 * Rate limit response headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-RetryAfter'?: string;
  'X-RateLimit-Algorithm': string;
}

/**
 * Generate standard rate limit headers
 */
export function generateRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remainingTokens.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    'X-RateLimit-Algorithm': result.algorithm
  };

  if (result.retryAfter) {
    headers['X-RateLimit-RetryAfter'] = result.retryAfter.toString();
  }

  return headers;
}