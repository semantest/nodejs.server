/**
 * @fileoverview Domain entities for rate limiting
 * @description Type definitions for rate limiting, quotas, and throttling
 * @author Web-Buddy Team
 */
/**
 * Rate limit rule configuration
 */
export interface RateLimitRule {
    id: string;
    name: string;
    tier: string;
    endpoint: string;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
    concurrentRequests: number;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Rate limit result
 */
export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
    message?: string;
    headers: Record<string, string>;
}
/**
 * Quota usage information
 */
export interface QuotaUsage {
    identifier: string;
    tier: string;
    totalRequests: number;
    requestsThisMonth: number;
    requestsToday: number;
    remainingQuota: number;
    quotaLimit: number;
    resetDate: Date;
    overage: number;
    overageAllowed: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Rate limit configuration by tier
 */
export interface RateLimitTierConfig {
    tier: string;
    displayName: string;
    description: string;
    pricing: {
        monthlyFee: number;
        overageFee: number;
        currency: string;
    };
    limits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
        requestsPerMonth: number;
        burstLimit: number;
        concurrentRequests: number;
    };
    features: string[];
    isActive: boolean;
}
/**
 * Rate limit violation record
 */
export interface RateLimitViolation {
    id: string;
    identifier: string;
    endpoint: string;
    tier: string;
    violationType: 'rate_limit' | 'quota' | 'burst' | 'concurrent';
    limit: number;
    actual: number;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    requestId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    action: 'blocked' | 'warned' | 'throttled';
}
/**
 * Rate limit metrics
 */
export interface RateLimitMetrics {
    timestamp: Date;
    totalRequests: number;
    blockedRequests: number;
    allowedRequests: number;
    averageResponseTime: number;
    topEndpoints: Array<{
        endpoint: string;
        requests: number;
        blocked: number;
    }>;
    topIdentifiers: Array<{
        identifier: string;
        requests: number;
        blocked: number;
    }>;
    tierDistribution: Record<string, number>;
    violationsByType: Record<string, number>;
}
/**
 * Rate limit analytics
 */
export interface RateLimitAnalytics {
    period: string;
    startTime: Date;
    endTime: Date;
    totalRequests: number;
    blockedRequests: number;
    blockRate: number;
    averageRequestsPerMinute: number;
    peakRequestsPerMinute: number;
    uniqueIdentifiers: number;
    topViolators: Array<{
        identifier: string;
        violations: number;
        totalRequests: number;
    }>;
    endpointAnalytics: Array<{
        endpoint: string;
        requests: number;
        blocked: number;
        averageResponseTime: number;
        errorRate: number;
    }>;
    tierAnalytics: Record<string, {
        requests: number;
        blocked: number;
        revenue: number;
        overage: number;
    }>;
}
/**
 * Sliding window rate limiter state
 */
export interface SlidingWindowState {
    identifier: string;
    endpoint: string;
    window: string;
    timestamps: number[];
    count: number;
    lastUpdate: Date;
    expiresAt: Date;
}
/**
 * Token bucket rate limiter state
 */
export interface TokenBucketState {
    identifier: string;
    endpoint: string;
    tokens: number;
    capacity: number;
    refillRate: number;
    lastRefill: Date;
    expiresAt: Date;
}
/**
 * Rate limit alert configuration
 */
export interface RateLimitAlert {
    id: string;
    name: string;
    description: string;
    conditions: {
        violationType: string[];
        threshold: number;
        timeWindow: number;
        severity: string[];
    };
    actions: {
        email: string[];
        webhook: string[];
        slack: string[];
        autoBlock: boolean;
        autoBan: boolean;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Rate limit whitelist entry
 */
export interface RateLimitWhitelist {
    id: string;
    identifier: string;
    type: 'ip' | 'api_key' | 'user_id';
    reason: string;
    expiresAt?: Date;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Rate limit blacklist entry
 */
export interface RateLimitBlacklist {
    id: string;
    identifier: string;
    type: 'ip' | 'api_key' | 'user_id';
    reason: string;
    severity: 'temporary' | 'permanent';
    expiresAt?: Date;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    enabled: boolean;
    defaultTier: string;
    algorithm: 'sliding_window' | 'token_bucket' | 'fixed_window';
    redis: {
        enabled: boolean;
        url: string;
        keyPrefix: string;
        ttl: number;
    };
    monitoring: {
        enabled: boolean;
        alerting: boolean;
        metrics: boolean;
        analytics: boolean;
    };
    enforcement: {
        blockRequests: boolean;
        returnHeaders: boolean;
        logViolations: boolean;
        notifyViolations: boolean;
    };
}
/**
 * Rate limit tier definitions
 */
export declare const RATE_LIMIT_TIERS: Record<string, RateLimitTierConfig>;
/**
 * Rate limit header names
 */
export declare const RATE_LIMIT_HEADERS: {
    readonly LIMIT: "X-RateLimit-Limit";
    readonly REMAINING: "X-RateLimit-Remaining";
    readonly RESET: "X-RateLimit-Reset";
    readonly RETRY_AFTER: "Retry-After";
    readonly TIER: "X-RateLimit-Tier";
};
/**
 * Rate limit violation types
 */
export declare const VIOLATION_TYPES: {
    readonly RATE_LIMIT: "rate_limit";
    readonly QUOTA: "quota";
    readonly BURST: "burst";
    readonly CONCURRENT: "concurrent";
};
/**
 * Rate limit enforcement actions
 */
export declare const ENFORCEMENT_ACTIONS: {
    readonly BLOCK: "blocked";
    readonly WARN: "warned";
    readonly THROTTLE: "throttled";
};
//# sourceMappingURL=rate-limiting-entities.d.ts.map