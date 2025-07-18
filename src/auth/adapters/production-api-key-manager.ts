/**
 * @fileoverview Production API key manager with Redis integration
 * @description Real API key management with Redis-based rate limiting
 * @author Semantest Team
 */

import { Redis } from 'ioredis';
import * as crypto from 'crypto';
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiKey, RateLimit, UsageStats, RATE_LIMIT_TIERS } from '../domain/auth-entities';

/**
 * Production API key manager with Redis integration
 */
export class ProductionApiKeyManager extends Adapter {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly keyLength: number;
  private readonly rateLimitPrefix: string;
  private readonly usageStatsPrefix: string;

  constructor() {
    super();
    
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.keyPrefix = process.env.API_KEY_PREFIX || 'sk';
    this.keyLength = parseInt(process.env.API_KEY_LENGTH || '32');
    this.rateLimitPrefix = 'rate_limit';
    this.usageStatsPrefix = 'usage_stats';

    this.initializeRedis();
  }

  /**
   * Create new API key
   */
  public async createApiKey(userId: string, keyData: {
    name: string;
    scopes: string[];
    tier: 'free' | 'premium' | 'enterprise';
    expiresAt?: Date;
    description?: string;
  }): Promise<ApiKey> {
    const key = this.generateApiKey();
    const keyId = this.generateApiKeyId();
    const rateLimit = RATE_LIMIT_TIERS[keyData.tier];
    
    const apiKey: ApiKey = {
      id: keyId,
      key,
      name: keyData.name,
      description: keyData.description,
      userId,
      scopes: keyData.scopes,
      tier: keyData.tier,
      isActive: true,
      rateLimit,
      usageStats: this.createInitialUsageStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: keyData.expiresAt,
      lastUsedAt: null
    };

    // Store API key in Redis
    await this.storeApiKey(apiKey);
    
    // Initialize usage stats
    await this.initializeUsageStats(keyId);
    
    console.log(`🔑 Created API key "${keyData.name}" for user ${userId} (tier: ${keyData.tier})`);
    return apiKey;
  }

  /**
   * Validate API key
   */
  public async validateApiKey(key: string): Promise<ApiKey | null> {
    try {
      // Check Redis cache first
      const cachedKey = await this.redis.get(`api_key:${key}`);
      let apiKey: ApiKey | null = null;

      if (cachedKey) {
        apiKey = JSON.parse(cachedKey);
      } else {
        // If not in cache, get from database and cache it
        apiKey = await this.findApiKeyByKey(key);
        if (apiKey) {
          await this.redis.setex(`api_key:${key}`, 3600, JSON.stringify(apiKey)); // Cache for 1 hour
        }
      }

      if (!apiKey) {
        return null;
      }

      // Check if key is active
      if (!apiKey.isActive) {
        return null;
      }

      // Check if key is expired
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        await this.updateApiKeyStatus(apiKey.id, false);
        return null;
      }

      // Update last used timestamp
      await this.updateLastUsed(apiKey.id);

      return apiKey;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  /**
   * Check rate limit for API key using Redis
   */
  public async checkRateLimit(key: string): Promise<{ 
    allowed: boolean; 
    limits: RateLimit; 
    remaining: { 
      minute: number; 
      hour: number; 
      day: number; 
      concurrent: number; 
    }; 
    resetTime: { 
      minute: Date; 
      hour: Date; 
      day: Date; 
    };
  }> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const now = new Date();
    const minuteWindow = Math.floor(now.getTime() / 60000);
    const hourWindow = Math.floor(now.getTime() / 3600000);
    const dayWindow = Math.floor(now.getTime() / 86400000);

    // Check rate limits using Redis pipeline for efficiency
    const pipeline = this.redis.pipeline();
    
    // Get current counts
    const minuteKey = `${this.rateLimitPrefix}:${key}:minute:${minuteWindow}`;
    const hourKey = `${this.rateLimitPrefix}:${key}:hour:${hourWindow}`;
    const dayKey = `${this.rateLimitPrefix}:${key}:day:${dayWindow}`;
    const concurrentKey = `${this.rateLimitPrefix}:${key}:concurrent`;

    pipeline.get(minuteKey);
    pipeline.get(hourKey);
    pipeline.get(dayKey);
    pipeline.get(concurrentKey);

    const results = await pipeline.exec();
    
    const minuteCount = parseInt(results[0][1] as string || '0');
    const hourCount = parseInt(results[1][1] as string || '0');
    const dayCount = parseInt(results[2][1] as string || '0');
    const concurrentCount = parseInt(results[3][1] as string || '0');

    const limits = apiKey.rateLimit;
    const remaining = {
      minute: Math.max(0, limits.requestsPerMinute - minuteCount),
      hour: Math.max(0, limits.requestsPerHour - hourCount),
      day: Math.max(0, limits.requestsPerDay - dayCount),
      concurrent: Math.max(0, limits.concurrentRequests - concurrentCount)
    };

    const resetTime = {
      minute: new Date((minuteWindow + 1) * 60000),
      hour: new Date((hourWindow + 1) * 3600000),
      day: new Date((dayWindow + 1) * 86400000)
    };

    // Check if any limits are exceeded
    const allowed = (
      minuteCount < limits.requestsPerMinute &&
      hourCount < limits.requestsPerHour &&
      dayCount < limits.requestsPerDay &&
      concurrentCount < limits.concurrentRequests
    );

    if (!allowed) {
      // Record rate limit exceeded
      await this.recordRateLimitExceeded(key, {
        minuteCount,
        hourCount,
        dayCount,
        concurrentCount,
        limits
      });
    }

    return {
      allowed,
      limits,
      remaining,
      resetTime
    };
  }

  /**
   * Increment rate limit counters
   */
  public async incrementRateLimit(key: string): Promise<void> {
    const now = new Date();
    const minuteWindow = Math.floor(now.getTime() / 60000);
    const hourWindow = Math.floor(now.getTime() / 3600000);
    const dayWindow = Math.floor(now.getTime() / 86400000);

    const pipeline = this.redis.pipeline();
    
    // Increment counters with appropriate TTL
    const minuteKey = `${this.rateLimitPrefix}:${key}:minute:${minuteWindow}`;
    const hourKey = `${this.rateLimitPrefix}:${key}:hour:${hourWindow}`;
    const dayKey = `${this.rateLimitPrefix}:${key}:day:${dayWindow}`;
    const concurrentKey = `${this.rateLimitPrefix}:${key}:concurrent`;

    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600);
    pipeline.incr(dayKey);
    pipeline.expire(dayKey, 86400);
    pipeline.incr(concurrentKey);

    await pipeline.exec();
  }

  /**
   * Decrement concurrent counter
   */
  public async decrementConcurrentCounter(key: string): Promise<void> {
    const concurrentKey = `${this.rateLimitPrefix}:${key}:concurrent`;
    const current = await this.redis.get(concurrentKey);
    
    if (current && parseInt(current) > 0) {
      await this.redis.decr(concurrentKey);
    }
  }

  /**
   * Update API key usage statistics
   */
  public async updateUsageStats(
    key: string, 
    responseTime: number, 
    isError: boolean = false,
    endpoint?: string
  ): Promise<void> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.toISOString().substring(0, 7);

    const pipeline = this.redis.pipeline();
    
    // Update counters
    const statsKey = `${this.usageStatsPrefix}:${apiKey.id}`;
    pipeline.hincrby(statsKey, 'totalRequests', 1);
    pipeline.hincrby(statsKey, `requests:${today}`, 1);
    pipeline.hincrby(statsKey, `requests:${thisMonth}`, 1);
    
    if (isError) {
      pipeline.hincrby(statsKey, 'errorCount', 1);
      pipeline.hset(statsKey, 'lastError', now.toISOString());
    }

    // Update response time (moving average)
    const currentStats = await this.redis.hmget(statsKey, 'totalRequests', 'averageResponseTime');
    const totalRequests = parseInt(currentStats[0] || '0');
    const currentAverage = parseFloat(currentStats[1] || '0');
    const newAverage = this.calculateAverageResponseTime(currentAverage, responseTime, totalRequests);
    
    pipeline.hset(statsKey, 'averageResponseTime', newAverage.toString());
    pipeline.hset(statsKey, 'lastUsed', now.toISOString());

    // Track endpoint usage
    if (endpoint) {
      pipeline.hincrby(`${statsKey}:endpoints`, endpoint, 1);
    }

    // Set expiration for monthly stats
    pipeline.expire(`${statsKey}:requests:${thisMonth}`, 86400 * 32); // 32 days
    pipeline.expire(`${statsKey}:requests:${today}`, 86400 * 7); // 7 days

    await pipeline.exec();
  }

  /**
   * Get comprehensive usage statistics
   */
  public async getUsageStats(key: string): Promise<UsageStats & { 
    endpointUsage: Record<string, number>;
    hourlyUsage: Record<string, number>;
    dailyUsage: Record<string, number>;
  } | null> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) return null;

    const statsKey = `${this.usageStatsPrefix}:${apiKey.id}`;
    const stats = await this.redis.hgetall(statsKey);
    
    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }

    // Get endpoint usage
    const endpointUsage = await this.redis.hgetall(`${statsKey}:endpoints`);
    
    // Get hourly usage for today
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hourlyUsage: Record<string, number> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `${this.rateLimitPrefix}:${key}:hour:${Math.floor(new Date(today + 'T' + hour.toString().padStart(2, '0') + ':00:00Z').getTime() / 3600000)}`;
      const count = await this.redis.get(hourKey);
      hourlyUsage[hour.toString()] = parseInt(count || '0');
    }

    // Get daily usage for last 30 days
    const dailyUsage: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const count = stats[`requests:${dateKey}`] || '0';
      dailyUsage[dateKey] = parseInt(count);
    }

    return {
      totalRequests: parseInt(stats.totalRequests || '0'),
      requestsThisMonth: parseInt(stats[`requests:${now.toISOString().substring(0, 7)}`] || '0'),
      requestsToday: parseInt(stats[`requests:${today}`] || '0'),
      errorCount: parseInt(stats.errorCount || '0'),
      averageResponseTime: parseFloat(stats.averageResponseTime || '0'),
      lastError: stats.lastError ? new Date(stats.lastError) : undefined,
      endpointUsage: Object.fromEntries(
        Object.entries(endpointUsage).map(([k, v]) => [k, parseInt(v as string)])
      ),
      hourlyUsage,
      dailyUsage
    };
  }

  /**
   * Revoke API key
   */
  public async revokeApiKey(key: string): Promise<void> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    await this.updateApiKeyStatus(apiKey.id, false);
    
    // Remove from cache
    await this.redis.del(`api_key:${key}`);
    
    console.log(`🗑️ Revoked API key "${apiKey.name}"`);
  }

  /**
   * List API keys for user
   */
  public async listApiKeys(userId: string): Promise<ApiKey[]> {
    // In production, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Update API key scopes
   */
  public async updateScopes(key: string, scopes: string[]): Promise<void> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    await this.updateApiKeyScopes(apiKey.id, scopes);
    
    // Update cache
    apiKey.scopes = scopes;
    apiKey.updatedAt = new Date();
    await this.redis.setex(`api_key:${key}`, 3600, JSON.stringify(apiKey));
    
    console.log(`🔧 Updated scopes for API key "${apiKey.name}"`);
  }

  /**
   * Get rate limit analytics
   */
  public async getRateLimitAnalytics(key: string, timeframe: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalRequests: number;
    rateLimitHits: number;
    rateLimitHitRate: number;
    peakRequestsPerMinute: number;
    averageRequestsPerHour: number;
    timeline: Array<{ timestamp: Date; requests: number; rateLimitHits: number }>;
  }> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const now = new Date();
    let intervals: Date[] = [];
    let intervalSize: number;
    
    switch (timeframe) {
      case '24h':
        intervalSize = 60 * 60 * 1000; // 1 hour
        for (let i = 0; i < 24; i++) {
          intervals.push(new Date(now.getTime() - i * intervalSize));
        }
        break;
      case '7d':
        intervalSize = 24 * 60 * 60 * 1000; // 1 day
        for (let i = 0; i < 7; i++) {
          intervals.push(new Date(now.getTime() - i * intervalSize));
        }
        break;
      case '30d':
        intervalSize = 24 * 60 * 60 * 1000; // 1 day
        for (let i = 0; i < 30; i++) {
          intervals.push(new Date(now.getTime() - i * intervalSize));
        }
        break;
    }

    const timeline = [];
    let totalRequests = 0;
    let rateLimitHits = 0;
    let peakRequestsPerMinute = 0;

    for (const interval of intervals.reverse()) {
      const windowKey = Math.floor(interval.getTime() / (timeframe === '24h' ? 3600000 : 86400000));
      const requestKey = `${this.rateLimitPrefix}:${key}:${timeframe === '24h' ? 'hour' : 'day'}:${windowKey}`;
      const rateLimitKey = `rate_limit_exceeded:${key}:${timeframe === '24h' ? 'hour' : 'day'}:${windowKey}`;
      
      const [requests, rateLimitHitsCount] = await Promise.all([
        this.redis.get(requestKey),
        this.redis.get(rateLimitKey)
      ]);

      const requestCount = parseInt(requests || '0');
      const rateLimitHitCount = parseInt(rateLimitHitsCount || '0');
      
      totalRequests += requestCount;
      rateLimitHits += rateLimitHitCount;
      
      if (timeframe === '24h') {
        peakRequestsPerMinute = Math.max(peakRequestsPerMinute, Math.floor(requestCount / 60));
      }

      timeline.push({
        timestamp: interval,
        requests: requestCount,
        rateLimitHits: rateLimitHitCount
      });
    }

    return {
      totalRequests,
      rateLimitHits,
      rateLimitHitRate: totalRequests > 0 ? (rateLimitHits / totalRequests) * 100 : 0,
      peakRequestsPerMinute,
      averageRequestsPerHour: totalRequests / intervals.length,
      timeline
    };
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('✅ Redis connection established for API key manager');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
    }
  }

  /**
   * Generate secure API key
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.keyLength);
    const key = randomBytes.toString('base64url');
    return `${this.keyPrefix}_${key}`;
  }

  /**
   * Generate API key ID
   */
  private generateApiKeyId(): string {
    return `apikey_${crypto.randomUUID()}`;
  }

  /**
   * Create initial usage statistics
   */
  private createInitialUsageStats(): UsageStats {
    return {
      totalRequests: 0,
      requestsThisMonth: 0,
      requestsToday: 0,
      errorCount: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Initialize usage stats in Redis
   */
  private async initializeUsageStats(apiKeyId: string): Promise<void> {
    const statsKey = `${this.usageStatsPrefix}:${apiKeyId}`;
    const now = new Date();
    
    await this.redis.hmset(statsKey, {
      totalRequests: '0',
      errorCount: '0',
      averageResponseTime: '0',
      createdAt: now.toISOString()
    });
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(currentAverage: number, newTime: number, totalRequests: number): number {
    if (totalRequests === 0) return newTime;
    return (currentAverage * totalRequests + newTime) / (totalRequests + 1);
  }

  /**
   * Record rate limit exceeded event
   */
  private async recordRateLimitExceeded(key: string, details: {
    minuteCount: number;
    hourCount: number;
    dayCount: number;
    concurrentCount: number;
    limits: RateLimit;
  }): Promise<void> {
    const now = new Date();
    const eventKey = `rate_limit_exceeded:${key}:${now.toISOString()}`;
    
    await this.redis.setex(eventKey, 86400, JSON.stringify({ // Store for 24 hours
      timestamp: now.toISOString(),
      details
    }));

    // Increment daily counter
    const dayWindow = Math.floor(now.getTime() / 86400000);
    const dayKey = `rate_limit_exceeded:${key}:day:${dayWindow}`;
    await this.redis.incr(dayKey);
    await this.redis.expire(dayKey, 86400);
  }

  /**
   * Mock database operations (replace with actual database calls)
   */
  private async storeApiKey(apiKey: ApiKey): Promise<void> {
    // Mock implementation - in production, store in database
    console.log(`💾 Storing API key in database: ${apiKey.name}`);
  }

  private async findApiKeyByKey(key: string): Promise<ApiKey | null> {
    // Mock implementation - in production, query database
    // For now, return null to force cache misses
    return null;
  }

  private async updateLastUsed(apiKeyId: string): Promise<void> {
    // Mock implementation - in production, update database
    console.log(`📊 Updated last used timestamp for API key ${apiKeyId}`);
  }

  private async updateApiKeyStatus(apiKeyId: string, isActive: boolean): Promise<void> {
    // Mock implementation - in production, update database
    console.log(`🔧 Updated status for API key ${apiKeyId}: ${isActive}`);
  }

  private async updateApiKeyScopes(apiKeyId: string, scopes: string[]): Promise<void> {
    // Mock implementation - in production, update database
    console.log(`🔧 Updated scopes for API key ${apiKeyId}: ${scopes.join(', ')}`);
  }

  /**
   * Cleanup expired keys and stats (to be called periodically)
   */
  public async cleanupExpiredData(): Promise<void> {
    try {
      // Clean up expired rate limit counters
      const patterns = [
        `${this.rateLimitPrefix}:*:minute:*`,
        `${this.rateLimitPrefix}:*:hour:*`,
        `${this.rateLimitPrefix}:*:day:*`,
        `rate_limit_exceeded:*`
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          // Check TTL and remove expired keys
          const pipeline = this.redis.pipeline();
          for (const key of keys) {
            pipeline.ttl(key);
          }
          const ttls = await pipeline.exec();
          
          const expiredKeys = keys.filter((_, index) => ttls[index][1] === -1);
          if (expiredKeys.length > 0) {
            await this.redis.del(...expiredKeys);
            console.log(`🧹 Cleaned up ${expiredKeys.length} expired API key data entries`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired API key data:', error);
    }
  }
}