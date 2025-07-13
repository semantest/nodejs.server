/**
 * @fileoverview Rate Limit Configuration
 * @description Endpoint-specific rate limiting configurations for the Semantest platform
 * @author Web-Buddy Team
 */

import { RateLimitConfig } from './rate-limiting-service';

/**
 * Rate limit tier types
 */
export type RateLimitTier = 
  | 'global'           // Global rate limits (per IP)
  | 'user'            // Per authenticated user
  | 'endpoint'        // Per endpoint
  | 'extension'       // Per Chrome extension
  | 'anonymous'       // For unauthenticated users
  | 'admin'           // For admin users
  | 'api'            // For API endpoints
  | 'auth'           // For authentication endpoints
  | 'heavy'          // For resource-intensive operations
  | 'realtime';      // For real-time operations (WebSocket, etc.)

/**
 * Rate limit configuration by endpoint pattern
 */
export interface EndpointRateLimitConfig {
  pattern: string | RegExp;
  method?: string | string[];
  tiers: RateLimitTier[];
  weight?: number; // Request weight multiplier
  skipConditions?: {
    roles?: string[];
    extensionIds?: string[];
    userIds?: string[];
    ipWhitelist?: string[];
  };
}

/**
 * User type classification for rate limiting
 */
export enum UserType {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
  EXTENSION = 'extension',
  ADMIN = 'admin',
  DEVELOPER = 'developer'
}

/**
 * Default rate limit configurations by tier
 */
export const DEFAULT_RATE_LIMITS: Record<RateLimitTier, RateLimitConfig> = {
  // Global limits (per IP address)
  global: {
    algorithm: 'sliding-window',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyGenerator: (identifier) => `global:${identifier}`
  },

  // Per authenticated user limits
  user: {
    algorithm: 'token-bucket',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    burstSize: 20,
    refillRate: 2, // 2 tokens per second
    keyGenerator: (identifier) => `user:${identifier}`
  },

  // Per endpoint limits
  endpoint: {
    algorithm: 'sliding-window',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (identifier, endpoint) => `endpoint:${endpoint}:${identifier}`
  },

  // Chrome extension specific limits
  extension: {
    algorithm: 'token-bucket',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // Higher limits for extensions
    burstSize: 50,
    refillRate: 5, // 5 tokens per second
    keyGenerator: (identifier) => `extension:${identifier}`
  },

  // Anonymous user limits (stricter)
  anonymous: {
    algorithm: 'fixed-window',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (identifier) => `anonymous:${identifier}`
  },

  // Admin user limits (more generous)
  admin: {
    algorithm: 'token-bucket',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500,
    burstSize: 100,
    refillRate: 8, // 8 tokens per second
    keyGenerator: (identifier) => `admin:${identifier}`
  },

  // API endpoint limits
  api: {
    algorithm: 'sliding-window',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyGenerator: (identifier, endpoint) => `api:${endpoint}:${identifier}`
  },

  // Authentication endpoint limits (very strict)
  auth: {
    algorithm: 'fixed-window',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    keyGenerator: (identifier, endpoint) => `auth:${endpoint}:${identifier}`
  },

  // Heavy operation limits
  heavy: {
    algorithm: 'token-bucket',
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    burstSize: 3,
    refillRate: 0.5, // 1 token per 2 seconds
    keyGenerator: (identifier, endpoint) => `heavy:${endpoint}:${identifier}`
  },

  // Real-time operation limits
  realtime: {
    algorithm: 'sliding-window',
    windowMs: 10 * 1000, // 10 seconds
    maxRequests: 100,
    keyGenerator: (identifier) => `realtime:${identifier}`
  }
};

/**
 * Endpoint-specific rate limit configurations
 */
export const ENDPOINT_RATE_LIMITS: EndpointRateLimitConfig[] = [
  // Authentication endpoints (very strict)
  {
    pattern: '/auth/login',
    method: 'POST',
    tiers: ['auth', 'global'],
    weight: 3,
    skipConditions: {
      ipWhitelist: process.env.AUTH_IP_WHITELIST?.split(',') || []
    }
  },
  {
    pattern: '/auth/register',
    method: 'POST',
    tiers: ['auth', 'global'],
    weight: 5
  },
  {
    pattern: '/auth/refresh',
    method: 'POST',
    tiers: ['auth', 'user'],
    weight: 1
  },
  {
    pattern: '/auth/logout',
    method: 'POST',
    tiers: ['user'],
    weight: 1
  },
  {
    pattern: '/auth/change-password',
    method: 'POST',
    tiers: ['auth', 'user'],
    weight: 2
  },
  {
    pattern: '/auth/generate-api-key',
    method: 'POST',
    tiers: ['heavy', 'user'],
    weight: 5
  },

  // API endpoints
  {
    pattern: /^\/api\/automation\/dispatch$/,
    method: 'POST',
    tiers: ['api', 'user', 'extension'],
    weight: 2
  },
  {
    pattern: /^\/api\/extensions/,
    method: 'GET',
    tiers: ['api', 'user'],
    weight: 1
  },
  {
    pattern: /^\/api\/metrics/,
    method: 'GET',
    tiers: ['api', 'user'],
    weight: 1,
    skipConditions: {
      roles: ['admin']
    }
  },

  // WebSocket related endpoints
  {
    pattern: /^\/api\/websocket\//,
    method: ['GET', 'POST'],
    tiers: ['realtime', 'user'],
    weight: 1
  },

  // Health and info endpoints (lenient)
  {
    pattern: '/health',
    method: 'GET',
    tiers: ['global'],
    weight: 0.1
  },
  {
    pattern: '/info',
    method: 'GET',
    tiers: ['global'],
    weight: 0.5
  },

  // CSRF endpoints
  {
    pattern: '/auth/csrf-token',
    method: 'GET',
    tiers: ['user', 'anonymous'],
    weight: 0.5
  },
  {
    pattern: '/auth/csrf-rotate',
    method: 'POST',
    tiers: ['user'],
    weight: 1
  },

  // Default catch-all for any other endpoints
  {
    pattern: /.*/,
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    tiers: ['global', 'endpoint'],
    weight: 1
  }
];

/**
 * Special rate limit configurations for Chrome extensions
 */
export const EXTENSION_RATE_LIMITS: Record<string, Partial<RateLimitConfig>> = {
  // Trusted extensions get higher limits
  'trusted': {
    maxRequests: 500,
    burstSize: 100,
    refillRate: 8
  },
  
  // Development extensions get moderate limits
  'development': {
    maxRequests: 200,
    burstSize: 40,
    refillRate: 3
  },
  
  // Unknown/new extensions get strict limits
  'unknown': {
    maxRequests: 50,
    burstSize: 10,
    refillRate: 1
  }
};

/**
 * IP whitelist for bypassing rate limits
 */
export const IP_WHITELIST = [
  '127.0.0.1',
  '::1',
  ...(process.env.RATE_LIMIT_IP_WHITELIST?.split(',') || [])
];

/**
 * Rate limit configuration factory
 */
export class RateLimitConfigFactory {
  /**
   * Get rate limit config for specific endpoint and user context
   */
  public static getEndpointConfig(
    method: string,
    path: string,
    userType: UserType,
    userRoles: string[] = [],
    extensionId?: string,
    userId?: string,
    ipAddress?: string
  ): {
    configs: Record<RateLimitTier, RateLimitConfig>;
    tiers: RateLimitTier[];
    weight: number;
    shouldSkip: boolean;
  } {
    // Find matching endpoint configuration
    const endpointConfig = ENDPOINT_RATE_LIMITS.find(config => {
      const methodMatch = !config.method || 
        config.method === method || 
        (Array.isArray(config.method) && config.method.includes(method));
      
      const pathMatch = typeof config.pattern === 'string' 
        ? path === config.pattern
        : config.pattern.test(path);
      
      return methodMatch && pathMatch;
    });

    if (!endpointConfig) {
      throw new Error(`No rate limit configuration found for ${method} ${path}`);
    }

    // Check skip conditions
    const shouldSkip = this.shouldSkipRateLimit(
      endpointConfig.skipConditions,
      userRoles,
      extensionId,
      userId,
      ipAddress
    );

    // Determine applicable tiers based on user type
    let applicableTiers = [...endpointConfig.tiers];
    
    // Add user-type specific tiers
    switch (userType) {
      case UserType.ANONYMOUS:
        if (!applicableTiers.includes('anonymous')) {
          applicableTiers.push('anonymous');
        }
        break;
      case UserType.AUTHENTICATED:
        if (!applicableTiers.includes('user')) {
          applicableTiers.push('user');
        }
        break;
      case UserType.EXTENSION:
        if (!applicableTiers.includes('extension')) {
          applicableTiers.push('extension');
        }
        break;
      case UserType.ADMIN:
        if (!applicableTiers.includes('admin')) {
          applicableTiers.unshift('admin'); // Prioritize admin limits
        }
        break;
    }

    // Build configuration map
    const configs: Record<RateLimitTier, RateLimitConfig> = {} as any;
    for (const tier of applicableTiers) {
      configs[tier] = { ...DEFAULT_RATE_LIMITS[tier] };
      
      // Apply extension-specific overrides
      if (tier === 'extension' && extensionId) {
        const extensionType = this.getExtensionType(extensionId);
        const overrides = EXTENSION_RATE_LIMITS[extensionType];
        if (overrides) {
          Object.assign(configs[tier], overrides);
        }
      }
    }

    return {
      configs,
      tiers: applicableTiers,
      weight: endpointConfig.weight || 1,
      shouldSkip
    };
  }

  /**
   * Check if rate limiting should be skipped
   */
  private static shouldSkipRateLimit(
    skipConditions: EndpointRateLimitConfig['skipConditions'],
    userRoles: string[],
    extensionId?: string,
    userId?: string,
    ipAddress?: string
  ): boolean {
    if (!skipConditions) return false;

    // Check IP whitelist
    if (ipAddress && IP_WHITELIST.includes(ipAddress)) {
      return true;
    }

    // Check role-based skip
    if (skipConditions.roles && userRoles.some(role => skipConditions.roles!.includes(role))) {
      return true;
    }

    // Check extension-based skip
    if (extensionId && skipConditions.extensionIds?.includes(extensionId)) {
      return true;
    }

    // Check user-based skip
    if (userId && skipConditions.userIds?.includes(userId)) {
      return true;
    }

    // Check IP whitelist in skip conditions
    if (ipAddress && skipConditions.ipWhitelist?.includes(ipAddress)) {
      return true;
    }

    return false;
  }

  /**
   * Determine extension type for rate limiting
   */
  private static getExtensionType(extensionId: string): string {
    const trustedExtensions = process.env.TRUSTED_EXTENSION_IDS?.split(',') || [];
    const devExtensions = process.env.DEV_EXTENSION_IDS?.split(',') || [];

    if (trustedExtensions.includes(extensionId)) {
      return 'trusted';
    }
    if (devExtensions.includes(extensionId)) {
      return 'development';
    }
    return 'unknown';
  }

  /**
   * Get user type from request context
   */
  public static getUserType(
    isAuthenticated: boolean,
    roles: string[] = [],
    extensionId?: string
  ): UserType {
    if (roles.includes('admin')) {
      return UserType.ADMIN;
    }
    if (extensionId && isAuthenticated) {
      return UserType.EXTENSION;
    }
    if (isAuthenticated) {
      return UserType.AUTHENTICATED;
    }
    return UserType.ANONYMOUS;
  }

  /**
   * Create rate limit key for multi-tier limiting
   */
  public static createMultiTierKey(
    baseIdentifier: string,
    tier: RateLimitTier,
    endpoint?: string
  ): string {
    const config = DEFAULT_RATE_LIMITS[tier];
    return config.keyGenerator ? config.keyGenerator(baseIdentifier, endpoint) : baseIdentifier;
  }
}

/**
 * Environment-specific configuration overrides
 */
export function getEnvironmentRateLimits(): Partial<Record<RateLimitTier, Partial<RateLimitConfig>>> {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        // Stricter limits in production
        global: { maxRequests: 800 },
        anonymous: { maxRequests: 50 },
        auth: { maxRequests: 10 }
      };
      
    case 'development':
      return {
        // More lenient limits in development
        global: { maxRequests: 2000 },
        user: { maxRequests: 300 },
        auth: { maxRequests: 50 }
      };
      
    case 'test':
      return {
        // Very high limits for testing
        global: { maxRequests: 10000 },
        user: { maxRequests: 1000 },
        auth: { maxRequests: 100 }
      };
      
    default:
      return {};
  }
}

/**
 * Merge environment overrides with default configurations
 */
export function getMergedRateLimits(): Record<RateLimitTier, RateLimitConfig> {
  const envOverrides = getEnvironmentRateLimits();
  const merged = { ...DEFAULT_RATE_LIMITS };
  
  for (const [tier, overrides] of Object.entries(envOverrides)) {
    if (overrides && merged[tier as RateLimitTier]) {
      merged[tier as RateLimitTier] = {
        ...merged[tier as RateLimitTier],
        ...overrides
      };
    }
  }
  
  return merged;
}