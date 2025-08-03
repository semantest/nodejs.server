"use strict";
/**
 * @fileoverview Domain entities for rate limiting
 * @description Type definitions for rate limiting, quotas, and throttling
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENFORCEMENT_ACTIONS = exports.VIOLATION_TYPES = exports.RATE_LIMIT_HEADERS = exports.RATE_LIMIT_TIERS = void 0;
/**
 * Rate limit tier definitions
 */
exports.RATE_LIMIT_TIERS = {
    free: {
        tier: 'free',
        displayName: 'Free',
        description: 'Free tier with basic rate limits',
        pricing: {
            monthlyFee: 0,
            overageFee: 0,
            currency: 'USD'
        },
        limits: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            requestsPerDay: 10000,
            requestsPerMonth: 100000,
            burstLimit: 10,
            concurrentRequests: 5
        },
        features: ['Basic API access', 'Community support'],
        isActive: true
    },
    premium: {
        tier: 'premium',
        displayName: 'Premium',
        description: 'Premium tier with higher rate limits',
        pricing: {
            monthlyFee: 29.99,
            overageFee: 0.001,
            currency: 'USD'
        },
        limits: {
            requestsPerMinute: 300,
            requestsPerHour: 10000,
            requestsPerDay: 100000,
            requestsPerMonth: 1000000,
            burstLimit: 50,
            concurrentRequests: 20
        },
        features: ['Higher rate limits', 'Priority support', 'Advanced analytics'],
        isActive: true
    },
    enterprise: {
        tier: 'enterprise',
        displayName: 'Enterprise',
        description: 'Enterprise tier with custom rate limits',
        pricing: {
            monthlyFee: 299.99,
            overageFee: 0.0005,
            currency: 'USD'
        },
        limits: {
            requestsPerMinute: 1000,
            requestsPerHour: 50000,
            requestsPerDay: 1000000,
            requestsPerMonth: 10000000,
            burstLimit: 200,
            concurrentRequests: 100
        },
        features: ['Custom rate limits', 'Dedicated support', 'SLA guarantees', 'Custom integrations'],
        isActive: true
    }
};
/**
 * Rate limit header names
 */
exports.RATE_LIMIT_HEADERS = {
    LIMIT: 'X-RateLimit-Limit',
    REMAINING: 'X-RateLimit-Remaining',
    RESET: 'X-RateLimit-Reset',
    RETRY_AFTER: 'Retry-After',
    TIER: 'X-RateLimit-Tier'
};
/**
 * Rate limit violation types
 */
exports.VIOLATION_TYPES = {
    RATE_LIMIT: 'rate_limit',
    QUOTA: 'quota',
    BURST: 'burst',
    CONCURRENT: 'concurrent'
};
/**
 * Rate limit enforcement actions
 */
exports.ENFORCEMENT_ACTIONS = {
    BLOCK: 'blocked',
    WARN: 'warned',
    THROTTLE: 'throttled'
};
//# sourceMappingURL=rate-limiting-entities.js.map