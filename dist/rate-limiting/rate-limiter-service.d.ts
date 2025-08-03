/**
 * @fileoverview Rate limiting service for API throttling
 * @description Handles request throttling, quota management, and distributed rate limiting
 * @author Web-Buddy Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { RateLimitCheckRequestedEvent, QuotaManagementRequestedEvent } from '../core/events/rate-limiting-events';
import { RateLimitRule, QuotaUsage } from './domain/rate-limiting-entities';
/**
 * Rate limiting service for API throttling and quota management
 */
export declare class RateLimiterService extends Application {
    readonly metadata: Map<string, string>;
    private redisRateLimiter;
    private ipRateLimiter;
    private quotaManager;
    private rateLimitMonitor;
    /**
     * Handle rate limit check requests
     */
    handleRateLimitCheck(event: RateLimitCheckRequestedEvent): Promise<void>;
    /**
     * Handle quota management requests
     */
    handleQuotaManagement(event: QuotaManagementRequestedEvent): Promise<void>;
    /**
     * Get rate limit rules for tier and endpoint
     */
    getRateLimitRules(tier: string, endpoint: string): Promise<RateLimitRule>;
    /**
     * Check quota usage for identifier
     */
    checkQuotaUsage(identifier: string): Promise<QuotaUsage>;
    /**
     * Update quota usage
     */
    updateQuotaUsage(identifier: string, quotaData: any): Promise<void>;
    /**
     * Reset quota usage
     */
    resetQuotaUsage(identifier: string): Promise<void>;
    /**
     * Upgrade quota tier
     */
    upgradeQuotaTier(identifier: string, newTier: string): Promise<void>;
    /**
     * Get real-time rate limit metrics
     */
    getRateLimitMetrics(): Promise<any>;
    /**
     * Get rate limit analytics
     */
    getRateLimitAnalytics(timeframe: string): Promise<any>;
    /**
     * Check individual rate limit
     */
    private checkRateLimit;
    /**
     * Check burst limit
     */
    private checkBurstLimit;
    /**
     * Check concurrent requests limit
     */
    private checkConcurrentLimit;
    /**
     * Increment rate limit counters
     */
    private incrementRateLimitCounters;
    /**
     * Increment counter
     */
    private incrementCounter;
    /**
     * Increment burst counter
     */
    private incrementBurstCounter;
    /**
     * Increment concurrent counter
     */
    private incrementConcurrentCounter;
    /**
     * Handle rate limit exceeded
     */
    private handleRateLimitExceeded;
    /**
     * Get tier-based rate limit rules
     */
    private getTierRules;
    /**
     * Get endpoint-specific rate limit rules
     */
    private getEndpointRules;
}
//# sourceMappingURL=rate-limiter-service.d.ts.map