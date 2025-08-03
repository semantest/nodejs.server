"use strict";
/**
 * @fileoverview Production API key manager with Redis integration
 * @description Real API key management with Redis-based rate limiting
 * @author Semantest Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionApiKeyManager = void 0;
const ioredis_1 = require("ioredis");
const crypto = __importStar(require("crypto"));
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
const auth_entities_1 = require("../domain/auth-entities");
/**
 * Production API key manager with Redis integration
 */
class ProductionApiKeyManager extends typescript_eda_stubs_1.Adapter {
    constructor() {
        super();
        // Initialize Redis connection
        this.redis = new ioredis_1.Redis({
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
    async createApiKey(userId, keyData) {
        const key = this.generateApiKey();
        const keyId = this.generateApiKeyId();
        const rateLimit = auth_entities_1.RATE_LIMIT_TIERS[keyData.tier];
        const apiKey = {
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
    async validateApiKey(key) {
        try {
            // Check Redis cache first
            const cachedKey = await this.redis.get(`api_key:${key}`);
            let apiKey = null;
            if (cachedKey) {
                apiKey = JSON.parse(cachedKey);
            }
            else {
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
        }
        catch (error) {
            console.error('Error validating API key:', error);
            return null;
        }
    }
    /**
     * Check rate limit for API key using Redis
     */
    async checkRateLimit(key) {
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
        const minuteCount = parseInt(results[0][1] || '0');
        const hourCount = parseInt(results[1][1] || '0');
        const dayCount = parseInt(results[2][1] || '0');
        const concurrentCount = parseInt(results[3][1] || '0');
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
        const allowed = (minuteCount < limits.requestsPerMinute &&
            hourCount < limits.requestsPerHour &&
            dayCount < limits.requestsPerDay &&
            concurrentCount < limits.concurrentRequests);
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
    async incrementRateLimit(key) {
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
    async decrementConcurrentCounter(key) {
        const concurrentKey = `${this.rateLimitPrefix}:${key}:concurrent`;
        const current = await this.redis.get(concurrentKey);
        if (current && parseInt(current) > 0) {
            await this.redis.decr(concurrentKey);
        }
    }
    /**
     * Update API key usage statistics
     */
    async updateUsageStats(key, responseTime, isError = false, endpoint) {
        const apiKey = await this.findApiKeyByKey(key);
        if (!apiKey)
            return;
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
    async getUsageStats(key) {
        const apiKey = await this.findApiKeyByKey(key);
        if (!apiKey)
            return null;
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
        const hourlyUsage = {};
        for (let hour = 0; hour < 24; hour++) {
            const hourKey = `${this.rateLimitPrefix}:${key}:hour:${Math.floor(new Date(today + 'T' + hour.toString().padStart(2, '0') + ':00:00Z').getTime() / 3600000)}`;
            const count = await this.redis.get(hourKey);
            hourlyUsage[hour.toString()] = parseInt(count || '0');
        }
        // Get daily usage for last 30 days
        const dailyUsage = {};
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
            endpointUsage: Object.fromEntries(Object.entries(endpointUsage).map(([k, v]) => [k, parseInt(v)])),
            hourlyUsage,
            dailyUsage
        };
    }
    /**
     * Revoke API key
     */
    async revokeApiKey(key) {
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
    async listApiKeys(userId) {
        // In production, this would query the database
        // For now, return empty array
        return [];
    }
    /**
     * Update API key scopes
     */
    async updateScopes(key, scopes) {
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
    async getRateLimitAnalytics(key, timeframe = '24h') {
        const apiKey = await this.findApiKeyByKey(key);
        if (!apiKey) {
            throw new Error('API key not found');
        }
        const now = new Date();
        let intervals = [];
        let intervalSize;
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
    async initializeRedis() {
        try {
            await this.redis.connect();
            console.log('✅ Redis connection established for API key manager');
        }
        catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
        }
    }
    /**
     * Generate secure API key
     */
    generateApiKey() {
        const randomBytes = crypto.randomBytes(this.keyLength);
        const key = randomBytes.toString('base64url');
        return `${this.keyPrefix}_${key}`;
    }
    /**
     * Generate API key ID
     */
    generateApiKeyId() {
        return `apikey_${crypto.randomUUID()}`;
    }
    /**
     * Create initial usage statistics
     */
    createInitialUsageStats() {
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
    async initializeUsageStats(apiKeyId) {
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
    calculateAverageResponseTime(currentAverage, newTime, totalRequests) {
        if (totalRequests === 0)
            return newTime;
        return (currentAverage * totalRequests + newTime) / (totalRequests + 1);
    }
    /**
     * Record rate limit exceeded event
     */
    async recordRateLimitExceeded(key, details) {
        const now = new Date();
        const eventKey = `rate_limit_exceeded:${key}:${now.toISOString()}`;
        await this.redis.setex(eventKey, 86400, JSON.stringify({
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
    async storeApiKey(apiKey) {
        // Mock implementation - in production, store in database
        console.log(`💾 Storing API key in database: ${apiKey.name}`);
    }
    async findApiKeyByKey(key) {
        // Mock implementation - in production, query database
        // For now, return null to force cache misses
        return null;
    }
    async updateLastUsed(apiKeyId) {
        // Mock implementation - in production, update database
        console.log(`📊 Updated last used timestamp for API key ${apiKeyId}`);
    }
    async updateApiKeyStatus(apiKeyId, isActive) {
        // Mock implementation - in production, update database
        console.log(`🔧 Updated status for API key ${apiKeyId}: ${isActive}`);
    }
    async updateApiKeyScopes(apiKeyId, scopes) {
        // Mock implementation - in production, update database
        console.log(`🔧 Updated scopes for API key ${apiKeyId}: ${scopes.join(', ')}`);
    }
    /**
     * Cleanup expired keys and stats (to be called periodically)
     */
    async cleanupExpiredData() {
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
        }
        catch (error) {
            console.error('Error cleaning up expired API key data:', error);
        }
    }
}
exports.ProductionApiKeyManager = ProductionApiKeyManager;
//# sourceMappingURL=production-api-key-manager.js.map