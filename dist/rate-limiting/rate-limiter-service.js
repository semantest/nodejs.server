"use strict";
/**
 * @fileoverview Rate limiting service for API throttling
 * @description Handles request throttling, quota management, and distributed rate limiting
 * @author Web-Buddy Team
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const rate_limiting_events_1 = require("../core/events/rate-limiting-events");
const redis_rate_limiter_1 = require("./adapters/redis-rate-limiter");
const ip_rate_limiter_1 = require("./adapters/ip-rate-limiter");
const quota_manager_1 = require("./adapters/quota-manager");
const rate_limit_monitor_1 = require("./adapters/rate-limit-monitor");
/**
 * Rate limiting service for API throttling and quota management
 */
let RateLimiterService = class RateLimiterService extends typescript_eda_stubs_1.Application {
    constructor() {
        super(...arguments);
        this.metadata = new Map([
            ['name', 'Web-Buddy Rate Limiter Service'],
            ['version', '1.0.0'],
            ['capabilities', 'api-throttling,quota-management,distributed-limiting'],
            ['redisEnabled', process.env.REDIS_URL ? 'true' : 'false'],
            ['defaultTier', 'free']
        ]);
    }
    /**
     * Handle rate limit check requests
     */
    async handleRateLimitCheck(event) {
        try {
            const { identifier, endpoint, tier, metadata } = event;
            // Get rate limit rules for tier and endpoint
            const rules = await this.getRateLimitRules(tier, endpoint);
            // Check multiple rate limits
            const results = [];
            // Check per-minute limit
            if (rules.requestsPerMinute > 0) {
                const minuteResult = await this.checkRateLimit(identifier, endpoint, 'minute', rules.requestsPerMinute, 60);
                results.push(minuteResult);
            }
            // Check per-hour limit
            if (rules.requestsPerHour > 0) {
                const hourResult = await this.checkRateLimit(identifier, endpoint, 'hour', rules.requestsPerHour, 3600);
                results.push(hourResult);
            }
            // Check per-day limit
            if (rules.requestsPerDay > 0) {
                const dayResult = await this.checkRateLimit(identifier, endpoint, 'day', rules.requestsPerDay, 86400);
                results.push(dayResult);
            }
            // Check burst limit
            if (rules.burstLimit > 0) {
                const burstResult = await this.checkBurstLimit(identifier, endpoint, rules.burstLimit);
                results.push(burstResult);
            }
            // Check concurrent requests
            if (rules.concurrentRequests > 0) {
                const concurrentResult = await this.checkConcurrentLimit(identifier, endpoint, rules.concurrentRequests);
                results.push(concurrentResult);
            }
            // Find the most restrictive result
            const blockedResult = results.find(r => !r.allowed);
            if (blockedResult) {
                // Rate limit exceeded
                await this.handleRateLimitExceeded(identifier, endpoint, blockedResult, metadata);
            }
            else {
                // Increment counters for successful request
                await this.incrementRateLimitCounters(identifier, endpoint, rules);
                console.log(`✅ Rate limit check passed for ${identifier} on ${endpoint}`);
            }
        }
        catch (error) {
            console.error('❌ Rate limit check failed:', error);
            throw error;
        }
    }
    /**
     * Handle quota management requests
     */
    async handleQuotaManagement(event) {
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
        }
        catch (error) {
            console.error('❌ Quota management failed:', error);
            throw error;
        }
    }
    /**
     * Get rate limit rules for tier and endpoint
     */
    async getRateLimitRules(tier, endpoint) {
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
    async checkQuotaUsage(identifier) {
        return await this.quotaManager.getQuotaUsage(identifier);
    }
    /**
     * Update quota usage
     */
    async updateQuotaUsage(identifier, quotaData) {
        await this.quotaManager.updateQuotaUsage(identifier, quotaData);
    }
    /**
     * Reset quota usage
     */
    async resetQuotaUsage(identifier) {
        await this.quotaManager.resetQuotaUsage(identifier);
    }
    /**
     * Upgrade quota tier
     */
    async upgradeQuotaTier(identifier, newTier) {
        await this.quotaManager.upgradeQuotaTier(identifier, newTier);
    }
    /**
     * Get real-time rate limit metrics
     */
    async getRateLimitMetrics() {
        return await this.rateLimitMonitor.getMetrics();
    }
    /**
     * Get rate limit analytics
     */
    async getRateLimitAnalytics(timeframe) {
        return await this.rateLimitMonitor.getAnalytics(timeframe);
    }
    /**
     * Check individual rate limit
     */
    async checkRateLimit(identifier, endpoint, window, limit, ttl) {
        const key = `rate_limit:${identifier}:${endpoint}:${window}`;
        if (process.env.REDIS_URL) {
            return await this.redisRateLimiter.checkLimit(key, limit, ttl);
        }
        else {
            return await this.ipRateLimiter.checkLimit(key, limit, ttl);
        }
    }
    /**
     * Check burst limit
     */
    async checkBurstLimit(identifier, endpoint, limit) {
        const key = `burst_limit:${identifier}:${endpoint}`;
        if (process.env.REDIS_URL) {
            return await this.redisRateLimiter.checkBurstLimit(key, limit);
        }
        else {
            return await this.ipRateLimiter.checkBurstLimit(key, limit);
        }
    }
    /**
     * Check concurrent requests limit
     */
    async checkConcurrentLimit(identifier, endpoint, limit) {
        const key = `concurrent:${identifier}:${endpoint}`;
        if (process.env.REDIS_URL) {
            return await this.redisRateLimiter.checkConcurrentLimit(key, limit);
        }
        else {
            return await this.ipRateLimiter.checkConcurrentLimit(key, limit);
        }
    }
    /**
     * Increment rate limit counters
     */
    async incrementRateLimitCounters(identifier, endpoint, rules) {
        const promises = [];
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
    async incrementCounter(key, ttl) {
        if (process.env.REDIS_URL) {
            await this.redisRateLimiter.incrementCounter(key, ttl);
        }
        else {
            await this.ipRateLimiter.incrementCounter(key, ttl);
        }
    }
    /**
     * Increment burst counter
     */
    async incrementBurstCounter(key) {
        if (process.env.REDIS_URL) {
            await this.redisRateLimiter.incrementBurstCounter(key);
        }
        else {
            await this.ipRateLimiter.incrementBurstCounter(key);
        }
    }
    /**
     * Increment concurrent counter
     */
    async incrementConcurrentCounter(key) {
        if (process.env.REDIS_URL) {
            await this.redisRateLimiter.incrementConcurrentCounter(key);
        }
        else {
            await this.ipRateLimiter.incrementConcurrentCounter(key);
        }
    }
    /**
     * Handle rate limit exceeded
     */
    async handleRateLimitExceeded(identifier, endpoint, result, metadata) {
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
    getTierRules(tier) {
        const tierRules = {
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
    getEndpointRules(endpoint) {
        const endpointRules = {
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
};
exports.RateLimiterService = RateLimiterService;
__decorate([
    (0, typescript_eda_stubs_1.listen)(rate_limiting_events_1.RateLimitCheckRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rate_limiting_events_1.RateLimitCheckRequestedEvent]),
    __metadata("design:returntype", Promise)
], RateLimiterService.prototype, "handleRateLimitCheck", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(rate_limiting_events_1.QuotaManagementRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rate_limiting_events_1.QuotaManagementRequestedEvent]),
    __metadata("design:returntype", Promise)
], RateLimiterService.prototype, "handleQuotaManagement", null);
exports.RateLimiterService = RateLimiterService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(redis_rate_limiter_1.RedisRateLimiter),
    (0, typescript_eda_stubs_1.Enable)(ip_rate_limiter_1.IPRateLimiter),
    (0, typescript_eda_stubs_1.Enable)(quota_manager_1.QuotaManager),
    (0, typescript_eda_stubs_1.Enable)(rate_limit_monitor_1.RateLimitMonitor)
], RateLimiterService);
//# sourceMappingURL=rate-limiter-service.js.map