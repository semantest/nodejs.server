/**
 * @fileoverview Rate limiting events
 * @description Events for rate limiting, quota management, and throttling
 * @author Web-Buddy Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Rate limit check requested event
 */
export class RateLimitCheckRequestedEvent extends Event {
  constructor(
    public readonly identifier: string,
    public readonly endpoint: string,
    public readonly tier: string,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit exceeded event
 */
export class RateLimitExceededEvent extends Event {
  constructor(
    public readonly identifier: string,
    public readonly endpoint: string,
    public readonly violationType: string,
    public readonly limit: number,
    public readonly actual: number,
    public readonly resetTime: Date,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      requestId: string;
      tier: string;
      severity: string;
    }
  ) {
    super();
  }
}

/**
 * Quota management requested event
 */
export class QuotaManagementRequestedEvent extends Event {
  constructor(
    public readonly operation: 'check' | 'update' | 'reset' | 'upgrade',
    public readonly identifier: string,
    public readonly quotaData?: {
      usage?: number;
      limit?: number;
      tier?: string;
      resetDate?: Date;
    },
    public readonly metadata?: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit violation detected event
 */
export class RateLimitViolationDetectedEvent extends Event {
  constructor(
    public readonly identifier: string,
    public readonly endpoint: string,
    public readonly violationType: string,
    public readonly severity: string,
    public readonly details: {
      limit: number;
      actual: number;
      resetTime: Date;
      tier: string;
    },
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit metrics requested event
 */
export class RateLimitMetricsRequestedEvent extends Event {
  constructor(
    public readonly timeframe: string,
    public readonly filters?: {
      tier?: string;
      endpoint?: string;
      identifier?: string;
    },
    public readonly metadata?: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit configuration updated event
 */
export class RateLimitConfigurationUpdatedEvent extends Event {
  constructor(
    public readonly configType: 'tier' | 'endpoint' | 'global',
    public readonly configData: {
      tier?: string;
      endpoint?: string;
      limits?: Record<string, number>;
      rules?: Record<string, any>;
    },
    public readonly metadata: {
      updatedBy: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit alert triggered event
 */
export class RateLimitAlertTriggeredEvent extends Event {
  constructor(
    public readonly alertId: string,
    public readonly alertName: string,
    public readonly condition: string,
    public readonly threshold: number,
    public readonly actual: number,
    public readonly affectedIdentifiers: string[],
    public readonly metadata: {
      severity: string;
      timeWindow: number;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit whitelist updated event
 */
export class RateLimitWhitelistUpdatedEvent extends Event {
  constructor(
    public readonly operation: 'add' | 'remove' | 'update',
    public readonly identifier: string,
    public readonly type: 'ip' | 'api_key' | 'user_id',
    public readonly reason: string,
    public readonly expiresAt?: Date,
    public readonly metadata?: {
      updatedBy: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit blacklist updated event
 */
export class RateLimitBlacklistUpdatedEvent extends Event {
  constructor(
    public readonly operation: 'add' | 'remove' | 'update',
    public readonly identifier: string,
    public readonly type: 'ip' | 'api_key' | 'user_id',
    public readonly reason: string,
    public readonly severity: 'temporary' | 'permanent',
    public readonly expiresAt?: Date,
    public readonly metadata?: {
      updatedBy: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Rate limit analytics generated event
 */
export class RateLimitAnalyticsGeneratedEvent extends Event {
  constructor(
    public readonly period: string,
    public readonly analytics: {
      totalRequests: number;
      blockedRequests: number;
      blockRate: number;
      uniqueIdentifiers: number;
      topViolators: Array<{
        identifier: string;
        violations: number;
      }>;
    },
    public readonly metadata: {
      generatedAt: Date;
      timeRange: {
        start: Date;
        end: Date;
      };
    }
  ) {
    super();
  }
}

/**
 * Rate limit cleanup requested event
 */
export class RateLimitCleanupRequestedEvent extends Event {
  constructor(
    public readonly cleanupType: 'expired' | 'old_metrics' | 'old_violations',
    public readonly olderThan: Date,
    public readonly metadata?: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}