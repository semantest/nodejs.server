/**
 * @fileoverview Rate Limiting Middleware
 * @description Intelligent rate limiting with burst protection
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../../../monitoring/infrastructure/structured-logger';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Redis client for distributed rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false
});

// Fallback to memory if Redis is unavailable
let rateLimiter: RateLimiterRedis | RateLimiterMemory;

redisClient.on('connect', () => {
  logger.info('Rate limiter connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error for rate limiter', { error: err.message });
});

/**
 * Create rate limiter middleware with intelligent fallback
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000, // 1 minute default
    max = 60, // 60 requests per minute default
    message = 'Too many requests, please try again later',
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = true
  } = options;

  // Initialize rate limiter
  if (!rateLimiter) {
    const points = max;
    const duration = Math.floor(windowMs / 1000); // Convert to seconds

    try {
      // Try Redis first for distributed rate limiting
      rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rl:api:',
        points,
        duration,
        blockDuration: duration, // Block for the same duration
        execEvenly: true // Spread requests evenly
      });
    } catch (error) {
      // Fallback to memory-based rate limiting
      logger.warn('Using memory-based rate limiter (Redis unavailable)');
      rateLimiter = new RateLimiterMemory({
        keyPrefix: 'rl:api:',
        points,
        duration,
        blockDuration: duration,
        execEvenly: true
      });
    }
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);

      // Special handling for Metaphysical (unlimited tier)
      if (req.apiClient?.tier === 'unlimited') {
        // Still track but with much higher limits
        const unlimitedLimiter = new RateLimiterMemory({
          keyPrefix: 'rl:unlimited:',
          points: 1000,
          duration: 60,
          execEvenly: false
        });

        try {
          await unlimitedLimiter.consume(key, 1);
        } catch (rlError) {
          logger.warn('Unlimited tier rate limit reached', {
            clientId: req.apiClient.id,
            key
          });
        }

        return next();
      }

      // Apply rate limiting
      const rlRes = await rateLimiter.consume(key, 1);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', rlRes.remainingPoints.toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rlRes.msBeforeNext).toISOString());
      res.setHeader('Retry-After', Math.round(rlRes.msBeforeNext / 1000).toString());

      // Log rate limit consumption
      if (rlRes.remainingPoints < max * 0.2) {
        logger.warn('Client approaching rate limit', {
          key,
          remaining: rlRes.remainingPoints,
          limit: max
        });
      }

      next();
    } catch (rlError: any) {
      // Rate limit exceeded
      if (rlError.remainingPoints !== undefined) {
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', rlError.remainingPoints.toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rlError.msBeforeNext).toISOString());
        res.setHeader('Retry-After', Math.round(rlError.msBeforeNext / 1000).toString());

        logger.info('Rate limit exceeded', {
          key: keyGenerator(req),
          ip: req.ip,
          endpoint: req.path
        });

        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: Math.round(rlError.msBeforeNext / 1000)
          }
        });
      }

      // Unexpected error - fail open to avoid blocking legitimate requests
      logger.error('Rate limiter error', { error: rlError });
      next();
    }
  };
}

/**
 * Default key generator using IP + API client ID
 */
function defaultKeyGenerator(req: Request): string {
  if (req.apiClient) {
    return `client:${req.apiClient.id}`;
  }
  
  // Fallback to IP-based limiting
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.ip;
  
  return `ip:${ip}`;
}

/**
 * Create endpoint-specific rate limiters
 */
export const rateLimiters = {
  // Strict limit for image generation
  imageGeneration: rateLimitMiddleware({
    windowMs: 60000,
    max: 30,
    message: 'Image generation rate limit exceeded'
  }),

  // More relaxed for status checks
  statusCheck: rateLimitMiddleware({
    windowMs: 60000,
    max: 300,
    message: 'Status check rate limit exceeded'
  }),

  // Very strict for batch operations
  batchOperation: rateLimitMiddleware({
    windowMs: 60000,
    max: 5,
    message: 'Batch operation rate limit exceeded'
  }),

  // Auth endpoints need protection
  authentication: rateLimitMiddleware({
    windowMs: 900000, // 15 minutes
    max: 5,
    message: 'Authentication rate limit exceeded'
  })
};

/**
 * Dynamic rate limiter that adjusts based on system load
 */
export function createDynamicRateLimiter() {
  let currentLoad = 0;
  let adjustmentFactor = 1;

  // Monitor system load
  setInterval(async () => {
    try {
      // In production, this would check actual system metrics
      // For now, we'll simulate based on Redis connection pool
      const info = await redisClient.info('clients');
      const connectedClients = parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0');
      
      // Adjust rate limits based on load
      if (connectedClients > 100) {
        adjustmentFactor = 0.5; // Reduce limits by 50%
      } else if (connectedClients > 50) {
        adjustmentFactor = 0.75; // Reduce limits by 25%
      } else {
        adjustmentFactor = 1; // Normal limits
      }

      currentLoad = connectedClients;
    } catch (error) {
      logger.error('Failed to check system load', { error });
    }
  }, 10000); // Check every 10 seconds

  return (baseOptions: RateLimitOptions = {}) => {
    return rateLimitMiddleware({
      ...baseOptions,
      max: Math.floor((baseOptions.max || 60) * adjustmentFactor)
    });
  };
}