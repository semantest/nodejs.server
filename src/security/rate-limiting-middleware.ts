/**
 * @fileoverview Rate Limiting Middleware
 * @description Express middleware integration for multi-tier rate limiting
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import { 
  RateLimitingService, 
  MultiTierRateLimitingService,
  RateLimitContext,
  RateLimitResult,
  generateRateLimitHeaders
} from './rate-limiting-service';
import { 
  RateLimitConfigFactory, 
  UserType, 
  RateLimitTier,
  getMergedRateLimits
} from './rate-limit-config';
import { createRateLimitStore, RateLimitStore } from './rate-limit-stores';

/**
 * Extended Request interface with user and rate limit info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        roles: string[];
        sessionId: string;
        extensionId?: string;
      };
      rateLimit?: {
        results: Map<string, RateLimitResult>;
        allowed: boolean;
        mostRestrictive?: string;
      };
      rateLimitContext?: RateLimitContext;
    }
  }
}

/**
 * Rate limiting middleware options
 */
export interface RateLimitMiddlewareOptions {
  store?: RateLimitStore;
  storeConfig?: {
    type: 'redis' | 'memory';
    redis?: {
      url?: string;
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
    };
    memory?: {
      maxSize?: number;
      cleanupIntervalMs?: number;
      maxAge?: number;
    };
  };
  skipPaths?: (string | RegExp)[];
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response, next: NextFunction) => void;
  headers?: boolean;
  legacyHeaders?: boolean;
  message?: string | ((req: Request, res: Response) => string);
  statusCode?: number;
  standardHeaders?: boolean;
}

/**
 * Rate limiting middleware factory
 */
export class RateLimitMiddleware {
  private multiTierService: MultiTierRateLimitingService;
  private store: RateLimitStore;
  private options: Required<RateLimitMiddlewareOptions>;

  constructor(options: RateLimitMiddlewareOptions = {}) {
    // Initialize store
    this.store = options.store || createRateLimitStore({
      type: options.storeConfig?.type || 'memory',
      redis: options.storeConfig?.redis,
      memory: options.storeConfig?.memory
    });

    // Initialize multi-tier service
    const rateLimitConfigs = getMergedRateLimits();
    this.multiTierService = new MultiTierRateLimitingService(
      this.store,
      new Map(Object.entries(rateLimitConfigs))
    );

    // Set default options
    this.options = {
      store: this.store,
      storeConfig: options.storeConfig || { type: 'memory' },
      skipPaths: options.skipPaths || [],
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      onLimitReached: options.onLimitReached || this.defaultLimitReachedHandler,
      headers: options.headers !== false,
      legacyHeaders: options.legacyHeaders || false,
      message: options.message || 'Too many requests, please try again later.',
      statusCode: options.statusCode || 429,
      standardHeaders: options.standardHeaders !== false
    };
  }

  /**
   * Default key generator (IP-based)
   */
  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Default rate limit reached handler
   */
  private defaultLimitReachedHandler(req: Request, res: Response, next: NextFunction): void {
    const message = typeof this.options.message === 'function' 
      ? this.options.message(req, res)
      : this.options.message;

    res.status(this.options.statusCode).json({
      error: 'Rate limit exceeded',
      message,
      retryAfter: req.rateLimit?.results?.values().next().value?.retryAfter,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create Express middleware
   */
  public createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if path should be skipped
        if (this.shouldSkipPath(req.path)) {
          return next();
        }

        // Extract user context
        const userContext = this.extractUserContext(req);
        
        // Generate rate limit context
        const rateLimitContext = this.generateRateLimitContext(req, userContext);
        req.rateLimitContext = rateLimitContext;

        // Get endpoint configuration
        const endpointConfig = RateLimitConfigFactory.getEndpointConfig(
          req.method,
          req.path,
          userContext.type,
          userContext.roles,
          userContext.extensionId,
          userContext.userId,
          rateLimitContext.identifier
        );

        // Skip rate limiting if configured
        if (endpointConfig.shouldSkip) {
          return next();
        }

        // Apply weight to context
        rateLimitContext.weight = endpointConfig.weight;

        // Check rate limits across all applicable tiers
        const rateLimitResult = await this.multiTierService.checkMultiTierRateLimit(
          rateLimitContext,
          endpointConfig.tiers
        );

        // Store results in request for logging/monitoring
        req.rateLimit = rateLimitResult;

        // Set response headers
        if (this.options.headers) {
          this.setRateLimitHeaders(res, rateLimitResult.results, endpointConfig.tiers);
        }

        // Handle rate limit exceeded
        if (!rateLimitResult.allowed) {
          console.warn(`🚫 Rate limit exceeded for ${rateLimitContext.identifier} on ${req.method} ${req.path}`, {
            mostRestrictive: rateLimitResult.mostRestrictive,
            userType: userContext.type,
            extensionId: userContext.extensionId,
            endpoint: req.path
          });

          return this.options.onLimitReached(req, res, next);
        }

        // Handle successful requests
        if (this.options.skipSuccessfulRequests) {
          res.on('finish', () => {
            if (res.statusCode < 400) {
              // TODO: Implement request reversal for successful requests
            }
          });
        }

        // Handle failed requests
        if (this.options.skipFailedRequests) {
          res.on('finish', () => {
            if (res.statusCode >= 400) {
              // TODO: Implement request reversal for failed requests
            }
          });
        }

        next();

      } catch (error) {
        console.error('❌ Rate limiting middleware error:', error);
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Check if path should be skipped
   */
  private shouldSkipPath(path: string): boolean {
    return this.options.skipPaths.some(skipPath => {
      if (typeof skipPath === 'string') {
        return path === skipPath;
      }
      return skipPath.test(path);
    });
  }

  /**
   * Extract user context from request
   */
  private extractUserContext(req: Request): {
    type: UserType;
    userId?: string;
    roles: string[];
    extensionId?: string;
  } {
    const isAuthenticated = !!req.user;
    const roles = req.user?.roles || [];
    const extensionId = req.user?.extensionId || req.headers['x-extension-id'] as string;

    return {
      type: RateLimitConfigFactory.getUserType(isAuthenticated, roles, extensionId),
      userId: req.user?.userId,
      roles,
      extensionId
    };
  }

  /**
   * Generate rate limit context
   */
  private generateRateLimitContext(req: Request, userContext: any): RateLimitContext {
    const baseIdentifier = this.options.keyGenerator(req);
    
    // Use user ID if authenticated, otherwise fall back to IP
    const identifier = userContext.userId || baseIdentifier;

    return {
      identifier,
      endpoint: req.path,
      userAgent: req.headers['user-agent'],
      extensionId: userContext.extensionId,
      timestamp: Date.now()
    };
  }

  /**
   * Set rate limit headers on response
   */
  private setRateLimitHeaders(
    res: Response, 
    results: Map<string, RateLimitResult>,
    tiers: RateLimitTier[]
  ): void {
    // Find the most restrictive tier for header display
    let mostRestrictiveResult: RateLimitResult | undefined;
    let lowestRemaining = Infinity;

    for (const [tierName, result] of results) {
      if (result.remainingTokens < lowestRemaining) {
        lowestRemaining = result.remainingTokens;
        mostRestrictiveResult = result;
      }
    }

    if (mostRestrictiveResult) {
      const maxRequests = this.getMostRestrictiveLimit(tiers);
      const headers = generateRateLimitHeaders(mostRestrictiveResult, maxRequests);
      
      // Set standard headers
      if (this.options.standardHeaders) {
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      // Set legacy headers for backward compatibility
      if (this.options.legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', headers['X-RateLimit-Limit']);
        res.setHeader('X-RateLimit-Remaining', headers['X-RateLimit-Remaining']);
        res.setHeader('X-RateLimit-Reset', headers['X-RateLimit-Reset']);
        if (headers['X-RateLimit-RetryAfter']) {
          res.setHeader('Retry-After', headers['X-RateLimit-RetryAfter']);
        }
      }
    }
  }

  /**
   * Get the most restrictive limit for header display
   */
  private getMostRestrictiveLimit(tiers: RateLimitTier[]): number {
    const rateLimitConfigs = getMergedRateLimits();
    return Math.min(...tiers.map(tier => rateLimitConfigs[tier].maxRequests));
  }

  /**
   * Get rate limiting statistics
   */
  public async getStats() {
    return await this.multiTierService.getTierService('global')?.getStats();
  }

  /**
   * Health check
   */
  public async healthCheck() {
    return await this.multiTierService.getTierService('global')?.healthCheck();
  }

  /**
   * Cleanup resources
   */
  public async cleanup() {
    await this.store.cleanup();
  }
}

/**
 * Create rate limiting middleware with default configuration
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const rateLimitMiddleware = new RateLimitMiddleware(options);
  return rateLimitMiddleware.createMiddleware();
}

/**
 * Create endpoint-specific rate limiting middleware
 */
export function createEndpointRateLimitMiddleware(
  endpoint: string,
  customConfig?: Partial<RateLimitMiddlewareOptions>
) {
  const options: RateLimitMiddlewareOptions = {
    ...customConfig,
    keyGenerator: customConfig?.keyGenerator || ((req: Request) => {
      const baseKey = req.user?.userId || req.ip || 'unknown';
      return `${baseKey}:${endpoint}`;
    })
  };

  return createRateLimitMiddleware(options);
}

/**
 * Create user-specific rate limiting middleware
 */
export function createUserRateLimitMiddleware(
  customConfig?: Partial<RateLimitMiddlewareOptions>
) {
  const options: RateLimitMiddlewareOptions = {
    ...customConfig,
    keyGenerator: customConfig?.keyGenerator || ((req: Request) => {
      if (!req.user?.userId) {
        throw new Error('User rate limiting requires authenticated user');
      }
      return `user:${req.user.userId}`;
    })
  };

  return createRateLimitMiddleware(options);
}

/**
 * Create extension-specific rate limiting middleware
 */
export function createExtensionRateLimitMiddleware(
  customConfig?: Partial<RateLimitMiddlewareOptions>
) {
  const options: RateLimitMiddlewareOptions = {
    ...customConfig,
    keyGenerator: customConfig?.keyGenerator || ((req: Request) => {
      const extensionId = req.user?.extensionId || req.headers['x-extension-id'] as string;
      if (!extensionId) {
        throw new Error('Extension rate limiting requires extension ID');
      }
      return `extension:${extensionId}`;
    })
  };

  return createRateLimitMiddleware(options);
}

/**
 * Rate limiting middleware with logging
 */
export function createLoggingRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {}
) {
  const middleware = createRateLimitMiddleware({
    ...options,
    onLimitReached: (req, res, next) => {
      // Log rate limit violation
      console.warn('🚫 Rate limit exceeded', {
        ip: req.ip,
        user: req.user?.userId,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        extensionId: req.user?.extensionId,
        timestamp: new Date().toISOString(),
        rateLimitResults: req.rateLimit
      });

      // Call original handler or default
      if (options.onLimitReached) {
        options.onLimitReached(req, res, next);
      } else {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.',
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  return middleware;
}

/**
 * Development-friendly rate limiting middleware with extended limits
 */
export function createDevelopmentRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {}
) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    return createRateLimitMiddleware(options);
  }

  // In development, use more lenient limits and additional logging
  return createLoggingRateLimitMiddleware({
    ...options,
    message: 'Rate limit exceeded (development mode)',
    onLimitReached: (req, res, next) => {
      console.log('🚫 [DEV] Rate limit exceeded', {
        path: req.path,
        method: req.method,
        rateLimitResults: req.rateLimit
      });

      if (options.onLimitReached) {
        options.onLimitReached(req, res, next);
      } else {
        res.status(429).json({
          error: 'Rate limit exceeded (development mode)',
          message: 'Too many requests, please try again later.',
          debug: req.rateLimit,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
}