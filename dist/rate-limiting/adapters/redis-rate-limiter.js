"use strict";
/**
 * @fileoverview Redis-based distributed rate limiter
 * @description Implements rate limiting using Redis for distributed systems
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisRateLimiter = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Redis-based rate limiter for distributed systems
 */
class RedisRateLimiter extends typescript_eda_stubs_1.Adapter {
    constructor() {
        super();
        this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.keyPrefix = process.env.REDIS_RATE_LIMIT_PREFIX || 'rl:';
        this.defaultTtl = parseInt(process.env.REDIS_RATE_LIMIT_TTL || '3600');
    }
    /**
     * Check rate limit using sliding window algorithm
     */
    async checkLimit(key, limit, windowSeconds) {
        try {
            const fullKey = this.keyPrefix + key;
            const now = Date.now();
            const windowStart = now - (windowSeconds * 1000);
            // Use Redis sorted set for sliding window
            const results = await this.executeSlidingWindowScript(fullKey, now, windowStart, limit, windowSeconds);
            const count = results.count;
            const remaining = Math.max(0, limit - count);
            const resetTime = new Date(now + (windowSeconds * 1000));
            return {
                allowed: count <= limit,
                limit,
                remaining,
                resetTime,
                retryAfter: count > limit ? Math.ceil(windowSeconds) : undefined,
                message: count > limit ? 'Rate limit exceeded' : undefined,
                headers: {
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString()
                }
            };
        }
        catch (error) {
            console.error('Redis rate limit check failed:', error);
            // Fallback to allow request on Redis failure
            return {
                allowed: true,
                limit,
                remaining: limit,
                resetTime: new Date(),
                headers: {}
            };
        }
    }
    /**
     * Check burst limit
     */
    async checkBurstLimit(key, limit) {
        try {
            const fullKey = this.keyPrefix + 'burst:' + key;
            const now = Date.now();
            const windowStart = now - 1000; // 1 second window
            const results = await this.executeSlidingWindowScript(fullKey, now, windowStart, limit, 1);
            const count = results.count;
            const remaining = Math.max(0, limit - count);
            const resetTime = new Date(now + 1000);
            return {
                allowed: count <= limit,
                limit,
                remaining,
                resetTime,
                retryAfter: count > limit ? 1 : undefined,
                message: count > limit ? 'Burst limit exceeded' : undefined,
                headers: {
                    'X-RateLimit-Burst-Limit': limit.toString(),
                    'X-RateLimit-Burst-Remaining': remaining.toString(),
                    'X-RateLimit-Burst-Reset': Math.ceil(resetTime.getTime() / 1000).toString()
                }
            };
        }
        catch (error) {
            console.error('Redis burst limit check failed:', error);
            return {
                allowed: true,
                limit,
                remaining: limit,
                resetTime: new Date(),
                headers: {}
            };
        }
    }
    /**
     * Check concurrent requests limit
     */
    async checkConcurrentLimit(key, limit) {
        try {
            const fullKey = this.keyPrefix + 'concurrent:' + key;
            const count = await this.getConcurrentCount(fullKey);
            const remaining = Math.max(0, limit - count);
            const resetTime = new Date(Date.now() + 60000); // 1 minute from now
            return {
                allowed: count < limit,
                limit,
                remaining,
                resetTime,
                retryAfter: count >= limit ? 60 : undefined,
                message: count >= limit ? 'Concurrent requests limit exceeded' : undefined,
                headers: {
                    'X-RateLimit-Concurrent-Limit': limit.toString(),
                    'X-RateLimit-Concurrent-Remaining': remaining.toString(),
                    'X-RateLimit-Concurrent-Current': count.toString()
                }
            };
        }
        catch (error) {
            console.error('Redis concurrent limit check failed:', error);
            return {
                allowed: true,
                limit,
                remaining: limit,
                resetTime: new Date(),
                headers: {}
            };
        }
    }
    /**
     * Increment counter with TTL
     */
    async incrementCounter(key, ttl) {
        try {
            const fullKey = this.keyPrefix + key;
            await this.executeIncrementScript(fullKey, ttl);
        }
        catch (error) {
            console.error('Redis counter increment failed:', error);
        }
    }
    /**
     * Increment burst counter
     */
    async incrementBurstCounter(key) {
        try {
            const fullKey = this.keyPrefix + 'burst:' + key;
            const now = Date.now();
            await this.executeBurstIncrementScript(fullKey, now);
        }
        catch (error) {
            console.error('Redis burst counter increment failed:', error);
        }
    }
    /**
     * Increment concurrent counter
     */
    async incrementConcurrentCounter(key) {
        try {
            const fullKey = this.keyPrefix + 'concurrent:' + key;
            await this.executeConcurrentIncrementScript(fullKey);
        }
        catch (error) {
            console.error('Redis concurrent counter increment failed:', error);
        }
    }
    /**
     * Decrement concurrent counter
     */
    async decrementConcurrentCounter(key) {
        try {
            const fullKey = this.keyPrefix + 'concurrent:' + key;
            await this.executeConcurrentDecrementScript(fullKey);
        }
        catch (error) {
            console.error('Redis concurrent counter decrement failed:', error);
        }
    }
    /**
     * Get current count
     */
    async getCurrentCount(key) {
        try {
            const fullKey = this.keyPrefix + key;
            return await this.getCount(fullKey);
        }
        catch (error) {
            console.error('Redis get count failed:', error);
            return 0;
        }
    }
    /**
     * Get concurrent count
     */
    async getConcurrentCount(key) {
        try {
            const fullKey = this.keyPrefix + 'concurrent:' + key;
            return await this.getCount(fullKey);
        }
        catch (error) {
            console.error('Redis get concurrent count failed:', error);
            return 0;
        }
    }
    /**
     * Clear rate limit data
     */
    async clearRateLimit(key) {
        try {
            const fullKey = this.keyPrefix + key;
            await this.deleteKey(fullKey);
        }
        catch (error) {
            console.error('Redis clear rate limit failed:', error);
        }
    }
    /**
     * Get rate limit info
     */
    async getRateLimitInfo(key) {
        try {
            const fullKey = this.keyPrefix + key;
            const count = await this.getCount(fullKey);
            const ttl = await this.getTtl(fullKey);
            const resetTime = new Date(Date.now() + (ttl * 1000));
            return { count, ttl, resetTime };
        }
        catch (error) {
            console.error('Redis get rate limit info failed:', error);
            return { count: 0, ttl: 0, resetTime: new Date() };
        }
    }
    /**
     * Execute sliding window script (mock implementation)
     */
    async executeSlidingWindowScript(key, now, windowStart, limit, windowSeconds) {
        // In production, use Redis Lua script for atomic operations
        // This is a mock implementation
        const count = Math.floor(Math.random() * limit * 0.8);
        return { count };
    }
    /**
     * Execute increment script (mock implementation)
     */
    async executeIncrementScript(key, ttl) {
        // In production, use Redis INCR with EXPIRE
        console.log(`📊 Incrementing counter: ${key} (TTL: ${ttl}s)`);
    }
    /**
     * Execute burst increment script (mock implementation)
     */
    async executeBurstIncrementScript(key, timestamp) {
        // In production, use Redis sorted set operations
        console.log(`⚡ Incrementing burst counter: ${key} at ${timestamp}`);
    }
    /**
     * Execute concurrent increment script (mock implementation)
     */
    async executeConcurrentIncrementScript(key) {
        // In production, use Redis INCR
        console.log(`🔄 Incrementing concurrent counter: ${key}`);
    }
    /**
     * Execute concurrent decrement script (mock implementation)
     */
    async executeConcurrentDecrementScript(key) {
        // In production, use Redis DECR
        console.log(`🔄 Decrementing concurrent counter: ${key}`);
    }
    /**
     * Get count from Redis (mock implementation)
     */
    async getCount(key) {
        // In production, use Redis GET
        return Math.floor(Math.random() * 10);
    }
    /**
     * Get TTL from Redis (mock implementation)
     */
    async getTtl(key) {
        // In production, use Redis TTL
        return 3600;
    }
    /**
     * Delete key from Redis (mock implementation)
     */
    async deleteKey(key) {
        // In production, use Redis DEL
        console.log(`🗑️ Deleting key: ${key}`);
    }
}
exports.RedisRateLimiter = RedisRateLimiter;
//# sourceMappingURL=redis-rate-limiter.js.map