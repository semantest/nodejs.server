/**
 * @fileoverview Production API key manager with Redis integration
 * @description Real API key management with Redis-based rate limiting
 * @author Semantest Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiKey, RateLimit, UsageStats } from '../domain/auth-entities';
/**
 * Production API key manager with Redis integration
 */
export declare class ProductionApiKeyManager extends Adapter {
    private readonly redis;
    private readonly keyPrefix;
    private readonly keyLength;
    private readonly rateLimitPrefix;
    private readonly usageStatsPrefix;
    constructor();
    /**
     * Create new API key
     */
    createApiKey(userId: string, keyData: {
        name: string;
        scopes: string[];
        tier: 'free' | 'premium' | 'enterprise';
        expiresAt?: Date;
        description?: string;
    }): Promise<ApiKey>;
    /**
     * Validate API key
     */
    validateApiKey(key: string): Promise<ApiKey | null>;
    /**
     * Check rate limit for API key using Redis
     */
    checkRateLimit(key: string): Promise<{
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
    }>;
    /**
     * Increment rate limit counters
     */
    incrementRateLimit(key: string): Promise<void>;
    /**
     * Decrement concurrent counter
     */
    decrementConcurrentCounter(key: string): Promise<void>;
    /**
     * Update API key usage statistics
     */
    updateUsageStats(key: string, responseTime: number, isError?: boolean, endpoint?: string): Promise<void>;
    /**
     * Get comprehensive usage statistics
     */
    getUsageStats(key: string): Promise<UsageStats & {
        endpointUsage: Record<string, number>;
        hourlyUsage: Record<string, number>;
        dailyUsage: Record<string, number>;
    } | null>;
    /**
     * Revoke API key
     */
    revokeApiKey(key: string): Promise<void>;
    /**
     * List API keys for user
     */
    listApiKeys(userId: string): Promise<ApiKey[]>;
    /**
     * Update API key scopes
     */
    updateScopes(key: string, scopes: string[]): Promise<void>;
    /**
     * Get rate limit analytics
     */
    getRateLimitAnalytics(key: string, timeframe?: '24h' | '7d' | '30d'): Promise<{
        totalRequests: number;
        rateLimitHits: number;
        rateLimitHitRate: number;
        peakRequestsPerMinute: number;
        averageRequestsPerHour: number;
        timeline: Array<{
            timestamp: Date;
            requests: number;
            rateLimitHits: number;
        }>;
    }>;
    /**
     * Initialize Redis connection
     */
    private initializeRedis;
    /**
     * Generate secure API key
     */
    private generateApiKey;
    /**
     * Generate API key ID
     */
    private generateApiKeyId;
    /**
     * Create initial usage statistics
     */
    private createInitialUsageStats;
    /**
     * Initialize usage stats in Redis
     */
    private initializeUsageStats;
    /**
     * Calculate average response time
     */
    private calculateAverageResponseTime;
    /**
     * Record rate limit exceeded event
     */
    private recordRateLimitExceeded;
    /**
     * Mock database operations (replace with actual database calls)
     */
    private storeApiKey;
    private findApiKeyByKey;
    private updateLastUsed;
    private updateApiKeyStatus;
    private updateApiKeyScopes;
    /**
     * Cleanup expired keys and stats (to be called periodically)
     */
    cleanupExpiredData(): Promise<void>;
}
//# sourceMappingURL=production-api-key-manager.d.ts.map