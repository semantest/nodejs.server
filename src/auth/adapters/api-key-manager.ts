/**
 * @fileoverview API key manager for authentication and rate limiting
 * @description Manages API key creation, validation, and rate limiting
 * @author Web-Buddy Team
 */

import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiKey, RateLimit, UsageStats, RATE_LIMIT_TIERS } from '../domain/auth-entities';

/**
 * API key manager for handling API authentication and rate limiting
 */
export class ApiKeyManager extends Adapter {
  private readonly keyPrefix: string;
  private readonly keyLength: number;

  constructor() {
    super();
    this.keyPrefix = process.env.API_KEY_PREFIX || 'wb';
    this.keyLength = 32;
  }

  /**
   * Create new API key
   */
  public async createApiKey(userId: string, keyData: {
    name: string;
    scopes: string[];
    tier: 'free' | 'premium' | 'enterprise';
    expiresAt?: Date;
  }): Promise<ApiKey> {
    const key = this.generateApiKey();
    const rateLimit = RATE_LIMIT_TIERS[keyData.tier];
    
    const apiKey: ApiKey = {
      id: this.generateApiKeyId(),
      key,
      name: keyData.name,
      userId,
      scopes: keyData.scopes,
      tier: keyData.tier,
      isActive: true,
      rateLimit,
      usageStats: this.createInitialUsageStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: keyData.expiresAt
    };

    // Store API key in database
    await this.storeApiKey(apiKey);
    
    console.log(`🔑 Created API key "${keyData.name}" for user ${userId}`);
    return apiKey;
  }

  /**
   * Validate API key
   */
  public async validateApiKey(key: string): Promise<ApiKey | null> {
    try {
      // Find API key in database
      const apiKey = await this.findApiKeyByKey(key);
      if (!apiKey) {
        return null;
      }

      // Check if key is active
      if (!apiKey.isActive) {
        return null;
      }

      // Check if key is expired
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
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
   * Check rate limit for API key
   */
  public async checkRateLimit(key: string): Promise<void> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const now = new Date();
    
    // Check per-minute rate limit
    const minuteKey = `rate_limit:${key}:minute:${Math.floor(now.getTime() / 60000)}`;
    const minuteCount = await this.getRateLimitCount(minuteKey);
    
    if (minuteCount >= apiKey.rateLimit.requestsPerMinute) {
      throw new Error('Rate limit exceeded: requests per minute');
    }

    // Check per-hour rate limit
    const hourKey = `rate_limit:${key}:hour:${Math.floor(now.getTime() / 3600000)}`;
    const hourCount = await this.getRateLimitCount(hourKey);
    
    if (hourCount >= apiKey.rateLimit.requestsPerHour) {
      throw new Error('Rate limit exceeded: requests per hour');
    }

    // Check per-day rate limit
    const dayKey = `rate_limit:${key}:day:${Math.floor(now.getTime() / 86400000)}`;
    const dayCount = await this.getRateLimitCount(dayKey);
    
    if (dayCount >= apiKey.rateLimit.requestsPerDay) {
      throw new Error('Rate limit exceeded: requests per day');
    }

    // Check concurrent requests
    const concurrentKey = `concurrent:${key}`;
    const concurrentCount = await this.getConcurrentCount(concurrentKey);
    
    if (concurrentCount >= apiKey.rateLimit.concurrentRequests) {
      throw new Error('Rate limit exceeded: concurrent requests');
    }

    // Increment counters
    await this.incrementRateLimitCount(minuteKey, 60); // 1 minute TTL
    await this.incrementRateLimitCount(hourKey, 3600); // 1 hour TTL
    await this.incrementRateLimitCount(dayKey, 86400); // 1 day TTL
    await this.incrementConcurrentCount(concurrentKey);
  }

  /**
   * Update API key usage statistics
   */
  public async updateUsageStats(key: string, responseTime: number, isError: boolean = false): Promise<void> {
    const apiKey = await this.findApiKeyByKey(key);
    if (!apiKey) return;

    const stats: UsageStats = {
      totalRequests: apiKey.usageStats.totalRequests + 1,
      requestsThisMonth: apiKey.usageStats.requestsThisMonth + 1,
      requestsToday: apiKey.usageStats.requestsToday + 1,
      errorCount: apiKey.usageStats.errorCount + (isError ? 1 : 0),
      lastError: isError ? new Date() : apiKey.usageStats.lastError,
      averageResponseTime: this.calculateAverageResponseTime(
        apiKey.usageStats.averageResponseTime,
        responseTime,
        apiKey.usageStats.totalRequests
      )
    };

    await this.updateApiKeyUsageStats(apiKey.id, stats);
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
    console.log(`🗑️ Revoked API key "${apiKey.name}"`);
  }

  /**
   * List API keys for user
   */
  public async listApiKeys(userId: string): Promise<ApiKey[]> {
    return await this.findApiKeysByUserId(userId);
  }

  /**
   * Get API key usage statistics
   */
  public async getUsageStats(key: string): Promise<UsageStats | null> {
    const apiKey = await this.findApiKeyByKey(key);
    return apiKey?.usageStats || null;
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
    console.log(`🔧 Updated scopes for API key "${apiKey.name}"`);
  }

  /**
   * Generate API key
   */
  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = this.keyPrefix + '_';
    
    for (let i = 0; i < this.keyLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Generate API key ID
   */
  private generateApiKeyId(): string {
    return `apikey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Calculate average response time
   */
  private calculateAverageResponseTime(currentAverage: number, newTime: number, totalRequests: number): number {
    if (totalRequests === 0) return newTime;
    return (currentAverage * totalRequests + newTime) / (totalRequests + 1);
  }

  /**
   * Helper methods (in production, these would use Redis and database)
   */
  private async storeApiKey(apiKey: ApiKey): Promise<void> {
    // Mock implementation - store in database
    console.log(`💾 Storing API key: ${apiKey.name}`);
  }

  private async findApiKeyByKey(key: string): Promise<ApiKey | null> {
    // Mock implementation - find in database
    return null;
  }

  private async findApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    // Mock implementation - find in database
    return [];
  }

  private async updateLastUsed(apiKeyId: string): Promise<void> {
    // Mock implementation - update in database
    console.log(`📊 Updated last used for API key ${apiKeyId}`);
  }

  private async updateApiKeyStatus(apiKeyId: string, isActive: boolean): Promise<void> {
    // Mock implementation - update in database
    console.log(`🔧 Updated status for API key ${apiKeyId}: ${isActive}`);
  }

  private async updateApiKeyScopes(apiKeyId: string, scopes: string[]): Promise<void> {
    // Mock implementation - update in database
    console.log(`🔧 Updated scopes for API key ${apiKeyId}`);
  }

  private async updateApiKeyUsageStats(apiKeyId: string, stats: UsageStats): Promise<void> {
    // Mock implementation - update in database
    console.log(`📊 Updated usage stats for API key ${apiKeyId}`);
  }

  private async getRateLimitCount(key: string): Promise<number> {
    // Mock implementation - get from Redis
    return 0;
  }

  private async getConcurrentCount(key: string): Promise<number> {
    // Mock implementation - get from Redis
    return 0;
  }

  private async incrementRateLimitCount(key: string, ttl: number): Promise<void> {
    // Mock implementation - increment in Redis with TTL
    console.log(`📊 Incremented rate limit counter: ${key}`);
  }

  private async incrementConcurrentCount(key: string): Promise<void> {
    // Mock implementation - increment in Redis
    console.log(`📊 Incremented concurrent counter: ${key}`);
  }
}