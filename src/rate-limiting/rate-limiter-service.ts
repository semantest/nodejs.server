/**
 * @fileoverview Rate limiting service for API throttling
 * @description Handles request throttling, quota management, and distributed rate limiting
 * @author Web-Buddy Team
 */

import { Application, Enable, listen } from '../stubs/typescript-eda-stubs';
import { RateLimitCheckRequestedEvent, RateLimitExceededEvent, QuotaManagementRequestedEvent } from '../core/events/rate-limiting-events';
import { RedisRateLimiter } from './adapters/redis-rate-limiter';
import { IPRateLimiter } from './adapters/ip-rate-limiter';
import { QuotaManager } from './adapters/quota-manager';
import { RateLimitMonitor } from './adapters/rate-limit-monitor';
import { RateLimitRule, RateLimitResult, QuotaUsage } from './domain/rate-limiting-entities';

/**
 * Rate limiting service for API throttling and quota management
 */
@Enable(RedisRateLimiter)
@Enable(IPRateLimiter)
@Enable(QuotaManager)
@Enable(RateLimitMonitor)
export class RateLimiterService extends Application {
  public readonly metadata = new Map([
    ['name', 'Web-Buddy Rate Limiter Service'],
    ['version', '1.0.0'],
    ['capabilities', 'api-throttling,quota-management,distributed-limiting'],
    ['redisEnabled', process.env.REDIS_URL ? 'true' : 'false'],
    ['defaultTier', 'free']
  ]);

  private redisRateLimiter!: RedisRateLimiter;
  private ipRateLimiter!: IPRateLimiter;
  private quotaManager!: QuotaManager;
  private rateLimitMonitor!: RateLimitMonitor;

  /**
   * Handle rate limit check requests
   */
  @listen(RateLimitCheckRequestedEvent)
  public async handleRateLimitCheck(event: RateLimitCheckRequestedEvent): Promise<void> {
    try {
      const { identifier, endpoint, tier, metadata } = event;
      
      // Get rate limit rules for tier and endpoint
      const rules = await this.getRateLimitRules(tier, endpoint);
      
      // Check multiple rate limits
      const results: RateLimitResult[] = [];
      
      // Check per-minute limit
      if (rules.requestsPerMinute > 0) {
        const minuteResult = await this.checkRateLimit(
          identifier,
          endpoint,
          'minute',
          rules.requestsPerMinute,
          60
        );
        results.push(minuteResult);
      }

      // Check per-hour limit
      if (rules.requestsPerHour > 0) {
        const hourResult = await this.checkRateLimit(
          identifier,
          endpoint,
          'hour',
          rules.requestsPerHour,
          3600
        );
        results.push(hourResult);
      }

      // Check per-day limit
      if (rules.requestsPerDay > 0) {
        const dayResult = await this.checkRateLimit(
          identifier,
          endpoint,
          'day',
          rules.requestsPerDay,
          86400
        );
        results.push(dayResult);
      }

      // Check burst limit
      if (rules.burstLimit > 0) {
        const burstResult = await this.checkBurstLimit(
          identifier,
          endpoint,
          rules.burstLimit
        );
        results.push(burstResult);
      }

      // Check concurrent requests
      if (rules.concurrentRequests > 0) {
        const concurrentResult = await this.checkConcurrentLimit(
          identifier,
          endpoint,
          rules.concurrentRequests
        );
        results.push(concurrentResult);
      }

      // Find the most restrictive result
      const blockedResult = results.find(r => !r.allowed);
      
      if (blockedResult) {
        // Rate limit exceeded
        await this.handleRateLimitExceeded(identifier, endpoint, blockedResult, metadata);
      } else {
        // Increment counters for successful request
        await this.incrementRateLimitCounters(identifier, endpoint, rules);
        console.log(`✅ Rate limit check passed for ${identifier} on ${endpoint}`);
      }

    } catch (error) {
      console.error('❌ Rate limit check failed:', error);
      throw error;
    }
  }

  /**
   * Handle quota management requests
   */
  @listen(QuotaManagementRequestedEvent)
  public async handleQuotaManagement(event: QuotaManagementRequestedEvent): Promise<void> {
    try {
      const { operation, identifier, quotaData } = event;
      
      switch (operation) {
        case 'check':
          await this.checkQuotaUsage(identifier);
          break;
        case 'update':
          await this.updateQuotaUsage(identifier, quotaData);
          break;
        case 'reset':
          await this.resetQuotaUsage(identifier);
          break;
        case 'upgrade':
          await this.upgradeQuotaTier(identifier, quotaData.tier);
          break;
        default:
          throw new Error(`Unsupported quota operation: ${operation}`);
      }
    } catch (error) {
      console.error('❌ Quota management failed:', error);
      throw error;
    }
  }

  /**
   * Get rate limit rules for tier and endpoint
   */
  public async getRateLimitRules(tier: string, endpoint: string): Promise<RateLimitRule> {
    // Get base rules for tier
    const baseRules = this.getTierRules(tier);
    
    // Apply endpoint-specific overrides
    const endpointRules = this.getEndpointRules(endpoint);
    
    return {
      ...baseRules,
      ...endpointRules,
      tier,
      endpoint
    };
  }

  /**
   * Check quota usage for identifier
   */
  public async checkQuotaUsage(identifier: string): Promise<QuotaUsage> {
    return await this.quotaManager.getQuotaUsage(identifier);
  }

  /**
   * Update quota usage
   */
  public async updateQuotaUsage(identifier: string, quotaData: any): Promise<void> {
    await this.quotaManager.updateQuotaUsage(identifier, quotaData);
  }

  /**
   * Reset quota usage
   */
  public async resetQuotaUsage(identifier: string): Promise<void> {
    await this.quotaManager.resetQuotaUsage(identifier);
  }

  /**
   * Upgrade quota tier
   */
  public async upgradeQuotaTier(identifier: string, newTier: string): Promise<void> {
    await this.quotaManager.upgradeQuotaTier(identifier, newTier);
  }

  /**
   * Get real-time rate limit metrics
   */
  public async getRateLimitMetrics(): Promise<any> {
    return await this.rateLimitMonitor.getMetrics();
  }

  /**
   * Get rate limit analytics
   */
  public async getRateLimitAnalytics(timeframe: string): Promise<any> {
    return await this.rateLimitMonitor.getAnalytics(timeframe);
  }

  /**
   * Check individual rate limit
   */
  private async checkRateLimit(
    identifier: string,
    endpoint: string,
    window: string,
    limit: number,
    ttl: number
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${identifier}:${endpoint}:${window}`;
    
    if (process.env.REDIS_URL) {
      return await this.redisRateLimiter.checkLimit(key, limit, ttl);
    } else {
      return await this.ipRateLimiter.checkLimit(key, limit, ttl);
    }
  }

  /**
   * Check burst limit
   */
  private async checkBurstLimit(
    identifier: string,
    endpoint: string,
    limit: number
  ): Promise<RateLimitResult> {
    const key = `burst_limit:${identifier}:${endpoint}`;
    
    if (process.env.REDIS_URL) {
      return await this.redisRateLimiter.checkBurstLimit(key, limit);
    } else {
      return await this.ipRateLimiter.checkBurstLimit(key, limit);
    }
  }

  /**
   * Check concurrent requests limit
   */
  private async checkConcurrentLimit(
    identifier: string,
    endpoint: string,
    limit: number
  ): Promise<RateLimitResult> {
    const key = `concurrent:${identifier}:${endpoint}`;
    
    if (process.env.REDIS_URL) {
      return await this.redisRateLimiter.checkConcurrentLimit(key, limit);
    } else {
      return await this.ipRateLimiter.checkConcurrentLimit(key, limit);
    }
  }

  /**
   * Increment rate limit counters
   */
  private async incrementRateLimitCounters(
    identifier: string,
    endpoint: string,
    rules: RateLimitRule
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Increment minute counter
    if (rules.requestsPerMinute > 0) {
      const minuteKey = `rate_limit:${identifier}:${endpoint}:minute`;
      promises.push(this.incrementCounter(minuteKey, 60));
    }

    // Increment hour counter
    if (rules.requestsPerHour > 0) {
      const hourKey = `rate_limit:${identifier}:${endpoint}:hour`;
      promises.push(this.incrementCounter(hourKey, 3600));
    }

    // Increment day counter
    if (rules.requestsPerDay > 0) {
      const dayKey = `rate_limit:${identifier}:${endpoint}:day`;
      promises.push(this.incrementCounter(dayKey, 86400));
    }

    // Increment burst counter
    if (rules.burstLimit > 0) {
      const burstKey = `burst_limit:${identifier}:${endpoint}`;
      promises.push(this.incrementBurstCounter(burstKey));
    }

    // Increment concurrent counter
    if (rules.concurrentRequests > 0) {
      const concurrentKey = `concurrent:${identifier}:${endpoint}`;
      promises.push(this.incrementConcurrentCounter(concurrentKey));
    }

    await Promise.all(promises);
  }

  /**
   * Increment counter
   */
  private async incrementCounter(key: string, ttl: number): Promise<void> {
    if (process.env.REDIS_URL) {
      await this.redisRateLimiter.incrementCounter(key, ttl);
    } else {
      await this.ipRateLimiter.incrementCounter(key, ttl);
    }
  }

  /**
   * Increment burst counter
   */
  private async incrementBurstCounter(key: string): Promise<void> {
    if (process.env.REDIS_URL) {
      await this.redisRateLimiter.incrementBurstCounter(key);
    } else {
      await this.ipRateLimiter.incrementBurstCounter(key);
    }
  }

  /**
   * Increment concurrent counter
   */
  private async incrementConcurrentCounter(key: string): Promise<void> {
    if (process.env.REDIS_URL) {
      await this.redisRateLimiter.incrementConcurrentCounter(key);
    } else {
      await this.ipRateLimiter.incrementConcurrentCounter(key);
    }
  }

  /**
   * Handle rate limit exceeded
   */
  private async handleRateLimitExceeded(
    identifier: string,
    endpoint: string,
    result: RateLimitResult,
    metadata: any
  ): Promise<void> {
    // Log rate limit exceeded
    console.log(`🚨 Rate limit exceeded for ${identifier} on ${endpoint}`);
    
    // Record metrics
    await this.rateLimitMonitor.recordRateLimitExceeded(identifier, endpoint, result);
    
    // Emit rate limit exceeded event
    // In a real implementation, this would trigger alerts and notifications
    throw new Error(`Rate limit exceeded: ${result.message}`);
  }

  /**
   * Get tier-based rate limit rules
   */
  private getTierRules(tier: string): Partial<RateLimitRule> {
    const tierRules: Record<string, Partial<RateLimitRule>> = {
      free: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        concurrentRequests: 5
      },
      premium: {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstLimit: 50,
        concurrentRequests: 20
      },
      enterprise: {
        requestsPerMinute: 1000,
        requestsPerHour: 50000,
        requestsPerDay: 1000000,
        burstLimit: 200,
        concurrentRequests: 100
      }
    };

    return tierRules[tier] || tierRules.free;
  }

  /**
   * Get endpoint-specific rate limit rules
   */
  private getEndpointRules(endpoint: string): Partial<RateLimitRule> {
    const endpointRules: Record<string, Partial<RateLimitRule>> = {
      '/api/auth/login': {
        requestsPerMinute: 10, // More restrictive for auth endpoints
        burstLimit: 3
      },
      '/api/auth/register': {
        requestsPerMinute: 5,
        burstLimit: 2
      },
      '/api/search': {
        requestsPerMinute: 100, // Less restrictive for search
        burstLimit: 20
      }
    };

    return endpointRules[endpoint] || {};
  }
}