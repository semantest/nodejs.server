/**
 * @fileoverview Rate Limiting Types and Interfaces
 * @description Comprehensive type definitions for the Semantest rate limiting system
 * @author Web-Buddy Team
 */

export * from './rate-limit-stores';
export * from './rate-limiting-service';
export * from './rate-limit-config';
export * from './monitoring';

/**
 * Rate limiting algorithm types
 */
export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window' | 'fixed-window';

/**
 * Rate limiting tier types for multi-tier limiting
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
 * User classification for rate limiting purposes
 */
export enum UserType {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
  EXTENSION = 'extension',
  ADMIN = 'admin',
  DEVELOPER = 'developer'
}

/**
 * Rate limit violation severity levels
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Store types for rate limiting backends
 */
export type StoreType = 'redis' | 'memory';

/**
 * Rate limiting configuration for specific endpoints
 */
export interface EndpointRateLimit {
  /** Endpoint path pattern (string or regex) */
  pattern: string | RegExp;
  /** HTTP methods to apply rate limiting to */
  method?: string | string[];
  /** Rate limit tiers to apply */
  tiers: RateLimitTier[];
  /** Request weight multiplier (default: 1) */
  weight?: number;
  /** Conditions to skip rate limiting */
  skipConditions?: {
    roles?: string[];
    extensionIds?: string[];
    userIds?: string[];
    ipWhitelist?: string[];
  };
}

/**
 * Rate limiting context for each request
 */
export interface RateLimitRequestContext {
  /** Primary identifier (IP, user ID, API key, etc.) */
  identifier: string;
  /** Endpoint being accessed */
  endpoint?: string;
  /** Request user agent */
  userAgent?: string;
  /** Chrome extension ID if applicable */
  extensionId?: string;
  /** Request timestamp */
  timestamp?: number;
  /** Request weight (for weighted rate limiting) */
  weight?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Rate limiting decision result
 */
export interface RateLimitDecision {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining tokens/requests */
  remainingTokens: number;
  /** Timestamp when rate limit resets */
  resetTime: number;
  /** Seconds to wait before retrying (if blocked) */
  retryAfter?: number;
  /** Algorithm used for this decision */
  algorithm: RateLimitAlgorithm;
  /** Additional metadata about the decision */
  metadata: {
    currentCount: number;
    windowStart?: number;
    totalHits: number;
    identifier: string;
    endpoint?: string;
  };
}

/**
 * Multi-tier rate limiting result
 */
export interface MultiTierRateLimitResult {
  /** Overall decision - allowed if all tiers allow */
  allowed: boolean;
  /** Results from each tier */
  results: Map<string, RateLimitDecision>;
  /** Most restrictive tier that caused blocking */
  mostRestrictive?: string;
  /** Combined headers to send to client */
  headers?: Record<string, string>;
}

/**
 * Rate limiting store statistics
 */
export interface RateLimitStoreStats {
  /** Total number of keys in store */
  totalKeys: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Cache hit rate percentage */
  hitRate?: number;
  /** Cache miss rate percentage */
  missRate?: number;
  /** Operation counters */
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    increments: number;
  };
}

/**
 * Rate limiting metrics over time
 */
export interface RateLimitMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Allowed requests */
  allowedRequests: number;
  /** Blocked requests */
  blockedRequests: number;
  /** Metrics by tier */
  byTier: Record<RateLimitTier, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  /** Metrics by endpoint */
  byEndpoint: Record<string, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  /** Metrics by user */
  byUser: Record<string, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  /** Recent violations */
  violations: RateLimitViolation[];
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Store statistics */
  storeStats?: RateLimitStoreStats;
  /** Time window for these metrics */
  timeWindow: {
    start: number;
    end: number;
    durationMs: number;
  };
}

/**
 * Rate limit violation record
 */
export interface RateLimitViolation {
  /** Identifier that violated the limit */
  identifier: string;
  /** Endpoint that was accessed */
  endpoint: string;
  /** Tier that was violated */
  tier: RateLimitTier;
  /** When the violation occurred */
  timestamp: number;
  /** Severity of the violation */
  severity: ViolationSeverity;
  /** Additional violation metadata */
  metadata: {
    userAgent?: string;
    extensionId?: string;
    ipAddress: string;
    userId?: string;
    requestCount: number;
    windowStart: number;
    rateLimitResult: RateLimitDecision;
  };
}

/**
 * Alert configuration for rate limiting monitoring
 */
export interface RateLimitAlertConfig {
  /** Whether alerting is enabled */
  enabled: boolean;
  /** Threshold values for triggering alerts */
  thresholds: {
    /** Violations per minute threshold */
    violationsPerMinute: number;
    /** Blocked requests percentage threshold */
    blockedRequestsPercentage: number;
    /** Critical violations per minute threshold */
    criticalViolationsPerMinute: number;
    /** Store error rate threshold */
    storeErrorRate: number;
  };
  /** Notification configurations */
  notifications: {
    /** Webhook notification settings */
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
    /** Email notification settings */
    email?: {
      to: string[];
      from: string;
      subject: string;
    };
    /** Slack notification settings */
    slack?: {
      webhook: string;
      channel: string;
    };
  };
  /** Minimum time between alerts of the same type */
  cooldownMs: number;
}

/**
 * Rate limiting middleware configuration
 */
export interface RateLimitMiddlewareConfig {
  /** Rate limit store instance */
  store?: any; // RateLimitStore
  /** Store configuration */
  storeConfig?: {
    type: StoreType;
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
  /** Paths to skip rate limiting */
  skipPaths?: (string | RegExp)[];
  /** Skip rate limiting for successful requests */
  skipSuccessfulRequests?: boolean;
  /** Skip rate limiting for failed requests */
  skipFailedRequests?: boolean;
  /** Custom key generator function */
  keyGenerator?: (req: any) => string;
  /** Custom handler when rate limit is reached */
  onLimitReached?: (req: any, res: any, next: any) => void;
  /** Whether to include rate limit headers */
  headers?: boolean;
  /** Whether to include legacy headers */
  legacyHeaders?: boolean;
  /** Custom error message */
  message?: string | ((req: any, res: any) => string);
  /** HTTP status code for rate limit errors */
  statusCode?: number;
  /** Whether to include standard headers */
  standardHeaders?: boolean;
}

/**
 * Rate limiting health status
 */
export interface RateLimitHealthStatus {
  /** Overall health status */
  healthy: boolean;
  /** List of identified issues */
  issues: string[];
  /** Current metrics snapshot */
  metrics: RateLimitMetrics;
  /** Store-specific health information */
  store?: {
    connected: boolean;
    latency?: number;
    errorRate?: number;
  };
}

/**
 * Rate limiting configuration per environment
 */
export interface EnvironmentRateLimitConfig {
  /** Production environment limits */
  production?: Partial<Record<RateLimitTier, Partial<any>>>;
  /** Development environment limits */
  development?: Partial<Record<RateLimitTier, Partial<any>>>;
  /** Test environment limits */
  test?: Partial<Record<RateLimitTier, Partial<any>>>;
}

/**
 * Extension-specific rate limiting configuration
 */
export interface ExtensionRateLimitConfig {
  /** Extension ID */
  extensionId: string;
  /** Extension type (trusted, development, unknown) */
  type: 'trusted' | 'development' | 'unknown';
  /** Custom rate limits for this extension */
  customLimits?: Partial<Record<RateLimitTier, Partial<any>>>;
  /** Whether this extension bypasses certain limits */
  bypassLimits?: RateLimitTier[];
}

/**
 * Rate limit headers to include in responses
 */
export interface RateLimitHeaders {
  /** Maximum requests allowed in time window */
  'X-RateLimit-Limit': string;
  /** Remaining requests in current window */
  'X-RateLimit-Remaining': string;
  /** When the rate limit resets (Unix timestamp) */
  'X-RateLimit-Reset': string;
  /** Seconds to wait before retrying (if rate limited) */
  'X-RateLimit-RetryAfter'?: string;
  /** Algorithm used for rate limiting */
  'X-RateLimit-Algorithm': string;
  /** Additional custom headers */
  [key: string]: string | undefined;
}

/**
 * Rate limiting service interface
 */
export interface IRateLimitingService {
  /** Check if request should be allowed */
  checkRateLimit(context: RateLimitRequestContext, config?: any): Promise<RateLimitDecision>;
  /** Reset rate limit for identifier */
  resetRateLimit(identifier: string, endpoint?: string): Promise<void>;
  /** Get current rate limit status */
  getRateLimitStatus(identifier: string, endpoint?: string): Promise<Omit<RateLimitDecision, 'allowed'> | null>;
  /** Cleanup expired entries */
  cleanup(): Promise<void>;
  /** Get service statistics */
  getStats(): Promise<RateLimitStoreStats>;
  /** Health check */
  healthCheck(): Promise<{ healthy: boolean; [key: string]: any }>;
}

/**
 * Rate limiting store interface
 */
export interface IRateLimitStore {
  /** Get rate limit entry */
  get(key: string): Promise<any | null>;
  /** Set rate limit entry */
  set(key: string, value: any, ttlMs?: number): Promise<void>;
  /** Increment counter atomically */
  increment(key: string, ttlMs?: number): Promise<number>;
  /** Delete rate limit entry */
  delete(key: string): Promise<void>;
  /** Check if key exists */
  exists(key: string): Promise<boolean>;
  /** Cleanup expired entries */
  cleanup(): Promise<void>;
  /** Get store statistics */
  getStats(): Promise<RateLimitStoreStats>;
}

/**
 * Rate limiting monitor interface
 */
export interface IRateLimitMonitor {
  /** Record a rate limit check */
  recordRateLimitCheck(
    identifier: string,
    endpoint: string,
    results: Map<string, RateLimitDecision>,
    allowed: boolean,
    responseTimeMs: number,
    context: any
  ): void;
  /** Get current metrics */
  getMetrics(): RateLimitMetrics;
  /** Get recent violations */
  getRecentViolations(sinceMs?: number): RateLimitViolation[];
  /** Get top violators */
  getTopViolators(limit?: number): any[];
  /** Reset metrics */
  resetMetrics(): void;
  /** Get health status */
  getHealthStatus(): RateLimitHealthStatus;
}

/**
 * Express Request interface extensions for rate limiting
 */
export interface RateLimitedRequest {
  /** Rate limiting results for this request */
  rateLimit?: {
    results: Map<string, RateLimitDecision>;
    allowed: boolean;
    mostRestrictive?: string;
  };
  /** Rate limiting context */
  rateLimitContext?: RateLimitRequestContext;
  /** User information (from auth middleware) */
  user?: {
    userId: string;
    email: string;
    roles: string[];
    sessionId: string;
    extensionId?: string;
  };
}

/**
 * Factory function type for creating rate limit stores
 */
export type RateLimitStoreFactory = (config: {
  type: StoreType;
  redis?: any;
  memory?: any;
}) => IRateLimitStore;

/**
 * Rate limiting configuration validation schema
 */
export interface RateLimitConfigSchema {
  /** Algorithm validation */
  algorithm: RateLimitAlgorithm;
  /** Window size validation */
  windowMs: number;
  /** Maximum requests validation */
  maxRequests: number;
  /** Optional burst size for token bucket */
  burstSize?: number;
  /** Optional refill rate for token bucket */
  refillRate?: number;
  /** Key generation function */
  keyGenerator?: (identifier: string, endpoint?: string) => string;
}

/**
 * Rate limiting audit log entry
 */
export interface RateLimitAuditLog {
  /** Timestamp of the event */
  timestamp: number;
  /** Type of event */
  eventType: 'violation' | 'reset' | 'config_change' | 'alert';
  /** Identifier involved */
  identifier?: string;
  /** Endpoint involved */
  endpoint?: string;
  /** Tier involved */
  tier?: RateLimitTier;
  /** Event details */
  details: Record<string, any>;
  /** Severity if applicable */
  severity?: ViolationSeverity;
}