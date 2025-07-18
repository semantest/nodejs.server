/**
 * @fileoverview Domain entities for rate limiting
 * @description Type definitions for rate limiting, quotas, and throttling
 * @author Web-Buddy Team
 */

/**
 * Rate limit rule configuration
 */
export interface RateLimitRule {
  id: string;
  name: string;
  tier: string;
  endpoint: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  concurrentRequests: number;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
  message?: string;
  headers: Record<string, string>;
}

/**
 * Quota usage information
 */
export interface QuotaUsage {
  identifier: string;
  tier: string;
  totalRequests: number;
  requestsThisMonth: number;
  requestsToday: number;
  remainingQuota: number;
  quotaLimit: number;
  resetDate: Date;
  overage: number;
  overageAllowed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limit configuration by tier
 */
export interface RateLimitTierConfig {
  tier: string;
  displayName: string;
  description: string;
  pricing: {
    monthlyFee: number;
    overageFee: number;
    currency: string;
  };
  limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    requestsPerMonth: number;
    burstLimit: number;
    concurrentRequests: number;
  };
  features: string[];
  isActive: boolean;
}

/**
 * Rate limit violation record
 */
export interface RateLimitViolation {
  id: string;
  identifier: string;
  endpoint: string;
  tier: string;
  violationType: 'rate_limit' | 'quota' | 'burst' | 'concurrent';
  limit: number;
  actual: number;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  requestId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'blocked' | 'warned' | 'throttled';
}

/**
 * Rate limit metrics
 */
export interface RateLimitMetrics {
  timestamp: Date;
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  averageResponseTime: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    blocked: number;
  }>;
  topIdentifiers: Array<{
    identifier: string;
    requests: number;
    blocked: number;
  }>;
  tierDistribution: Record<string, number>;
  violationsByType: Record<string, number>;
}

/**
 * Rate limit analytics
 */
export interface RateLimitAnalytics {
  period: string;
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  blockedRequests: number;
  blockRate: number;
  averageRequestsPerMinute: number;
  peakRequestsPerMinute: number;
  uniqueIdentifiers: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
    totalRequests: number;
  }>;
  endpointAnalytics: Array<{
    endpoint: string;
    requests: number;
    blocked: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  tierAnalytics: Record<string, {
    requests: number;
    blocked: number;
    revenue: number;
    overage: number;
  }>;
}

/**
 * Sliding window rate limiter state
 */
export interface SlidingWindowState {
  identifier: string;
  endpoint: string;
  window: string;
  timestamps: number[];
  count: number;
  lastUpdate: Date;
  expiresAt: Date;
}

/**
 * Token bucket rate limiter state
 */
export interface TokenBucketState {
  identifier: string;
  endpoint: string;
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: Date;
  expiresAt: Date;
}

/**
 * Rate limit alert configuration
 */
export interface RateLimitAlert {
  id: string;
  name: string;
  description: string;
  conditions: {
    violationType: string[];
    threshold: number;
    timeWindow: number; // seconds
    severity: string[];
  };
  actions: {
    email: string[];
    webhook: string[];
    slack: string[];
    autoBlock: boolean;
    autoBan: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limit whitelist entry
 */
export interface RateLimitWhitelist {
  id: string;
  identifier: string;
  type: 'ip' | 'api_key' | 'user_id';
  reason: string;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limit blacklist entry
 */
export interface RateLimitBlacklist {
  id: string;
  identifier: string;
  type: 'ip' | 'api_key' | 'user_id';
  reason: string;
  severity: 'temporary' | 'permanent';
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  defaultTier: string;
  algorithm: 'sliding_window' | 'token_bucket' | 'fixed_window';
  redis: {
    enabled: boolean;
    url: string;
    keyPrefix: string;
    ttl: number;
  };
  monitoring: {
    enabled: boolean;
    alerting: boolean;
    metrics: boolean;
    analytics: boolean;
  };
  enforcement: {
    blockRequests: boolean;
    returnHeaders: boolean;
    logViolations: boolean;
    notifyViolations: boolean;
  };
}

/**
 * Rate limit tier definitions
 */
export const RATE_LIMIT_TIERS: Record<string, RateLimitTierConfig> = {
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
} as const;

/**
 * Rate limit header names
 */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
  TIER: 'X-RateLimit-Tier'
} as const;

/**
 * Rate limit violation types
 */
export const VIOLATION_TYPES = {
  RATE_LIMIT: 'rate_limit',
  QUOTA: 'quota',
  BURST: 'burst',
  CONCURRENT: 'concurrent'
} as const;

/**
 * Rate limit enforcement actions
 */
export const ENFORCEMENT_ACTIONS = {
  BLOCK: 'blocked',
  WARN: 'warned',
  THROTTLE: 'throttled'
} as const;