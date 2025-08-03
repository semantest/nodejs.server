/**
 * @fileoverview Redis-based distributed rate limiter
 * @description Implements rate limiting using Redis for distributed systems
 * @author Web-Buddy Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { RateLimitResult } from '../domain/rate-limiting-entities';
/**
 * Redis-based rate limiter for distributed systems
 */
export declare class RedisRateLimiter extends Adapter {
    private readonly redisUrl;
    private readonly keyPrefix;
    private readonly defaultTtl;
    constructor();
    /**
     * Check rate limit using sliding window algorithm
     */
    checkLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
    /**
     * Check burst limit
     */
    checkBurstLimit(key: string, limit: number): Promise<RateLimitResult>;
    /**
     * Check concurrent requests limit
     */
    checkConcurrentLimit(key: string, limit: number): Promise<RateLimitResult>;
    /**
     * Increment counter with TTL
     */
    incrementCounter(key: string, ttl: number): Promise<void>;
    /**
     * Increment burst counter
     */
    incrementBurstCounter(key: string): Promise<void>;
    /**
     * Increment concurrent counter
     */
    incrementConcurrentCounter(key: string): Promise<void>;
    /**
     * Decrement concurrent counter
     */
    decrementConcurrentCounter(key: string): Promise<void>;
    /**
     * Get current count
     */
    getCurrentCount(key: string): Promise<number>;
    /**
     * Get concurrent count
     */
    getConcurrentCount(key: string): Promise<number>;
    /**
     * Clear rate limit data
     */
    clearRateLimit(key: string): Promise<void>;
    /**
     * Get rate limit info
     */
    getRateLimitInfo(key: string): Promise<{
        count: number;
        ttl: number;
        resetTime: Date;
    }>;
    /**
     * Execute sliding window script (mock implementation)
     */
    private executeSlidingWindowScript;
    /**
     * Execute increment script (mock implementation)
     */
    private executeIncrementScript;
    /**
     * Execute burst increment script (mock implementation)
     */
    private executeBurstIncrementScript;
    /**
     * Execute concurrent increment script (mock implementation)
     */
    private executeConcurrentIncrementScript;
    /**
     * Execute concurrent decrement script (mock implementation)
     */
    private executeConcurrentDecrementScript;
    /**
     * Get count from Redis (mock implementation)
     */
    private getCount;
    /**
     * Get TTL from Redis (mock implementation)
     */
    private getTtl;
    /**
     * Delete key from Redis (mock implementation)
     */
    private deleteKey;
}
//# sourceMappingURL=redis-rate-limiter.d.ts.map