/**
 * @fileoverview Rate limiting events
 * @description Events for rate limiting, quota management, and throttling
 * @author Web-Buddy Team
 */
import { Event } from '../../stubs/typescript-eda-stubs';
/**
 * Rate limit check requested event
 */
export declare class RateLimitCheckRequestedEvent extends Event {
    readonly identifier: string;
    readonly endpoint: string;
    readonly tier: string;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        timestamp: Date;
    };
    constructor(identifier: string, endpoint: string, tier: string, metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Rate limit exceeded event
 */
export declare class RateLimitExceededEvent extends Event {
    readonly identifier: string;
    readonly endpoint: string;
    readonly violationType: string;
    readonly limit: number;
    readonly actual: number;
    readonly resetTime: Date;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        tier: string;
        severity: string;
    };
    constructor(identifier: string, endpoint: string, violationType: string, limit: number, actual: number, resetTime: Date, metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        tier: string;
        severity: string;
    });
}
/**
 * Quota management requested event
 */
export declare class QuotaManagementRequestedEvent extends Event {
    readonly operation: 'check' | 'update' | 'reset' | 'upgrade';
    readonly identifier: string;
    readonly quotaData?: {
        usage?: number;
        limit?: number;
        tier?: string;
        resetDate?: Date;
    };
    readonly metadata?: {
        requestId: string;
        timestamp: Date;
    };
    constructor(operation: 'check' | 'update' | 'reset' | 'upgrade', identifier: string, quotaData?: {
        usage?: number;
        limit?: number;
        tier?: string;
        resetDate?: Date;
    }, metadata?: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Rate limit violation detected event
 */
export declare class RateLimitViolationDetectedEvent extends Event {
    readonly identifier: string;
    readonly endpoint: string;
    readonly violationType: string;
    readonly severity: string;
    readonly details: {
        limit: number;
        actual: number;
        resetTime: Date;
        tier: string;
    };
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        timestamp: Date;
    };
    constructor(identifier: string, endpoint: string, violationType: string, severity: string, details: {
        limit: number;
        actual: number;
        resetTime: Date;
        tier: string;
    }, metadata: {
        ipAddress: string;
        userAgent: string;
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Rate limit metrics requested event
 */
export declare class RateLimitMetricsRequestedEvent extends Event {
    readonly timeframe: string;
    readonly filters?: {
        tier?: string;
        endpoint?: string;
        identifier?: string;
    };
    readonly metadata?: {
        requestId: string;
        timestamp: Date;
    };
    constructor(timeframe: string, filters?: {
        tier?: string;
        endpoint?: string;
        identifier?: string;
    }, metadata?: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Rate limit configuration updated event
 */
export declare class RateLimitConfigurationUpdatedEvent extends Event {
    readonly configType: 'tier' | 'endpoint' | 'global';
    readonly configData: {
        tier?: string;
        endpoint?: string;
        limits?: Record<string, number>;
        rules?: Record<string, any>;
    };
    readonly metadata: {
        updatedBy: string;
        timestamp: Date;
    };
    constructor(configType: 'tier' | 'endpoint' | 'global', configData: {
        tier?: string;
        endpoint?: string;
        limits?: Record<string, number>;
        rules?: Record<string, any>;
    }, metadata: {
        updatedBy: string;
        timestamp: Date;
    });
}
/**
 * Rate limit alert triggered event
 */
export declare class RateLimitAlertTriggeredEvent extends Event {
    readonly alertId: string;
    readonly alertName: string;
    readonly condition: string;
    readonly threshold: number;
    readonly actual: number;
    readonly affectedIdentifiers: string[];
    readonly metadata: {
        severity: string;
        timeWindow: number;
        timestamp: Date;
    };
    constructor(alertId: string, alertName: string, condition: string, threshold: number, actual: number, affectedIdentifiers: string[], metadata: {
        severity: string;
        timeWindow: number;
        timestamp: Date;
    });
}
/**
 * Rate limit whitelist updated event
 */
export declare class RateLimitWhitelistUpdatedEvent extends Event {
    readonly operation: 'add' | 'remove' | 'update';
    readonly identifier: string;
    readonly type: 'ip' | 'api_key' | 'user_id';
    readonly reason: string;
    readonly expiresAt?: Date;
    readonly metadata?: {
        updatedBy: string;
        timestamp: Date;
    };
    constructor(operation: 'add' | 'remove' | 'update', identifier: string, type: 'ip' | 'api_key' | 'user_id', reason: string, expiresAt?: Date, metadata?: {
        updatedBy: string;
        timestamp: Date;
    });
}
/**
 * Rate limit blacklist updated event
 */
export declare class RateLimitBlacklistUpdatedEvent extends Event {
    readonly operation: 'add' | 'remove' | 'update';
    readonly identifier: string;
    readonly type: 'ip' | 'api_key' | 'user_id';
    readonly reason: string;
    readonly severity: 'temporary' | 'permanent';
    readonly expiresAt?: Date;
    readonly metadata?: {
        updatedBy: string;
        timestamp: Date;
    };
    constructor(operation: 'add' | 'remove' | 'update', identifier: string, type: 'ip' | 'api_key' | 'user_id', reason: string, severity: 'temporary' | 'permanent', expiresAt?: Date, metadata?: {
        updatedBy: string;
        timestamp: Date;
    });
}
/**
 * Rate limit analytics generated event
 */
export declare class RateLimitAnalyticsGeneratedEvent extends Event {
    readonly period: string;
    readonly analytics: {
        totalRequests: number;
        blockedRequests: number;
        blockRate: number;
        uniqueIdentifiers: number;
        topViolators: Array<{
            identifier: string;
            violations: number;
        }>;
    };
    readonly metadata: {
        generatedAt: Date;
        timeRange: {
            start: Date;
            end: Date;
        };
    };
    constructor(period: string, analytics: {
        totalRequests: number;
        blockedRequests: number;
        blockRate: number;
        uniqueIdentifiers: number;
        topViolators: Array<{
            identifier: string;
            violations: number;
        }>;
    }, metadata: {
        generatedAt: Date;
        timeRange: {
            start: Date;
            end: Date;
        };
    });
}
/**
 * Rate limit cleanup requested event
 */
export declare class RateLimitCleanupRequestedEvent extends Event {
    readonly cleanupType: 'expired' | 'old_metrics' | 'old_violations';
    readonly olderThan: Date;
    readonly metadata?: {
        requestId: string;
        timestamp: Date;
    };
    constructor(cleanupType: 'expired' | 'old_metrics' | 'old_violations', olderThan: Date, metadata?: {
        requestId: string;
        timestamp: Date;
    });
}
//# sourceMappingURL=rate-limiting-events.d.ts.map