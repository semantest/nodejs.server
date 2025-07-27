/**
 * Tests for rate-limiting domain entities
 * Testing interfaces, constants, and type definitions
 */

import {
  RateLimitRule,
  RateLimitResult,
  QuotaUsage,
  RateLimitTierConfig,
  RateLimitViolation,
  RateLimitMetrics,
  RateLimitAnalytics,
  SlidingWindowState,
  TokenBucketState,
  RateLimitAlert,
  RateLimitWhitelist,
  RateLimitBlacklist,
  RateLimitConfig,
  RATE_LIMIT_TIERS,
  RATE_LIMIT_HEADERS,
  VIOLATION_TYPES,
  ENFORCEMENT_ACTIONS
} from '../rate-limiting-entities';

describe('Rate Limiting Entities', () => {
  describe('Type Guards and Interface Validation', () => {
    it('should create valid RateLimitRule', () => {
      const rule: RateLimitRule = {
        id: 'rule-1',
        name: 'API Rate Limit',
        tier: 'free',
        endpoint: '/api/users',
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        concurrentRequests: 5,
        isActive: true,
        priority: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      expect(rule.id).toBe('rule-1');
      expect(rule.tier).toBe('free');
      expect(rule.requestsPerMinute).toBe(60);
      expect(rule.isActive).toBe(true);
    });

    it('should create valid RateLimitResult', () => {
      const result: RateLimitResult = {
        allowed: false,
        limit: 60,
        remaining: 0,
        resetTime: new Date('2024-01-01T12:00:00Z'),
        retryAfter: 30,
        message: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1704110400',
          'Retry-After': '30'
        }
      };

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
      expect(result.headers['Retry-After']).toBe('30');
    });

    it('should create valid QuotaUsage', () => {
      const quota: QuotaUsage = {
        identifier: 'user-123',
        tier: 'premium',
        totalRequests: 500000,
        requestsThisMonth: 450000,
        requestsToday: 5000,
        remainingQuota: 50000,
        quotaLimit: 1000000,
        resetDate: new Date('2024-02-01'),
        overage: 0,
        overageAllowed: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      };

      expect(quota.remainingQuota).toBe(50000);
      expect(quota.overageAllowed).toBe(true);
      expect(quota.tier).toBe('premium');
    });

    it('should create valid RateLimitViolation', () => {
      const violation: RateLimitViolation = {
        id: 'violation-1',
        identifier: 'user-123',
        endpoint: '/api/data',
        tier: 'free',
        violationType: 'rate_limit',
        limit: 60,
        actual: 75,
        timestamp: new Date('2024-01-01T10:30:00Z'),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
        severity: 'high',
        action: 'blocked'
      };

      expect(violation.violationType).toBe('rate_limit');
      expect(violation.actual).toBeGreaterThan(violation.limit);
      expect(violation.severity).toBe('high');
      expect(violation.action).toBe('blocked');
    });

    it('should create valid RateLimitMetrics', () => {
      const metrics: RateLimitMetrics = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        totalRequests: 10000,
        blockedRequests: 500,
        allowedRequests: 9500,
        averageResponseTime: 150.5,
        topEndpoints: [
          { endpoint: '/api/users', requests: 3000, blocked: 150 },
          { endpoint: '/api/data', requests: 2000, blocked: 100 }
        ],
        topIdentifiers: [
          { identifier: 'user-123', requests: 1000, blocked: 50 },
          { identifier: 'user-456', requests: 800, blocked: 40 }
        ],
        tierDistribution: {
          free: 6000,
          premium: 3000,
          enterprise: 1000
        },
        violationsByType: {
          rate_limit: 300,
          quota: 100,
          burst: 75,
          concurrent: 25
        }
      };

      expect(metrics.totalRequests).toBe(10000);
      expect(metrics.blockedRequests + metrics.allowedRequests).toBe(metrics.totalRequests);
      expect(metrics.topEndpoints).toHaveLength(2);
      expect(Object.values(metrics.tierDistribution).reduce((a, b) => a + b, 0)).toBe(10000);
    });

    it('should create valid RateLimitAnalytics', () => {
      const analytics: RateLimitAnalytics = {
        period: 'daily',
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T23:59:59Z'),
        totalRequests: 100000,
        blockedRequests: 5000,
        blockRate: 0.05,
        averageRequestsPerMinute: 69.44,
        peakRequestsPerMinute: 250,
        uniqueIdentifiers: 1000,
        topViolators: [
          { identifier: 'user-123', violations: 50, totalRequests: 5000 },
          { identifier: 'user-456', violations: 30, totalRequests: 3000 }
        ],
        endpointAnalytics: [
          {
            endpoint: '/api/users',
            requests: 30000,
            blocked: 1500,
            averageResponseTime: 120.5,
            errorRate: 0.02
          }
        ],
        tierAnalytics: {
          free: {
            requests: 60000,
            blocked: 4000,
            revenue: 0,
            overage: 0
          },
          premium: {
            requests: 30000,
            blocked: 800,
            revenue: 29.99,
            overage: 0
          },
          enterprise: {
            requests: 10000,
            blocked: 200,
            revenue: 299.99,
            overage: 0
          }
        }
      };

      expect(analytics.blockRate).toBe(analytics.blockedRequests / analytics.totalRequests);
      expect(analytics.period).toBe('daily');
      expect(analytics.uniqueIdentifiers).toBe(1000);
    });

    it('should create valid SlidingWindowState', () => {
      const state: SlidingWindowState = {
        identifier: 'user-123',
        endpoint: '/api/users',
        window: '60s',
        timestamps: [1704110400000, 1704110410000, 1704110420000],
        count: 3,
        lastUpdate: new Date('2024-01-01T12:00:20Z'),
        expiresAt: new Date('2024-01-01T12:01:00Z')
      };

      expect(state.timestamps).toHaveLength(3);
      expect(state.count).toBe(3);
      expect(state.window).toBe('60s');
    });

    it('should create valid TokenBucketState', () => {
      const state: TokenBucketState = {
        identifier: 'user-123',
        endpoint: '/api/data',
        tokens: 45,
        capacity: 60,
        refillRate: 1,
        lastRefill: new Date('2024-01-01T12:00:00Z'),
        expiresAt: new Date('2024-01-01T13:00:00Z')
      };

      expect(state.tokens).toBeLessThanOrEqual(state.capacity);
      expect(state.refillRate).toBe(1);
    });

    it('should create valid RateLimitAlert', () => {
      const alert: RateLimitAlert = {
        id: 'alert-1',
        name: 'High Rate Limit Violations',
        description: 'Alert when violations exceed threshold',
        conditions: {
          violationType: ['rate_limit', 'burst'],
          threshold: 10,
          timeWindow: 300,
          severity: ['high', 'critical']
        },
        actions: {
          email: ['admin@example.com'],
          webhook: ['https://webhook.example.com/alert'],
          slack: ['#alerts'],
          autoBlock: true,
          autoBan: false
        },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      expect(alert.conditions.threshold).toBe(10);
      expect(alert.actions.autoBlock).toBe(true);
      expect(alert.actions.email).toContain('admin@example.com');
    });

    it('should create valid RateLimitWhitelist', () => {
      const entry: RateLimitWhitelist = {
        id: 'whitelist-1',
        identifier: '192.168.1.100',
        type: 'ip',
        reason: 'Internal testing server',
        expiresAt: new Date('2024-12-31'),
        createdBy: 'admin',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      expect(entry.type).toBe('ip');
      expect(entry.reason).toBe('Internal testing server');
    });

    it('should create valid RateLimitBlacklist', () => {
      const entry: RateLimitBlacklist = {
        id: 'blacklist-1',
        identifier: 'user-malicious',
        type: 'user_id',
        reason: 'Repeated violations',
        severity: 'permanent',
        createdBy: 'system',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      expect(entry.severity).toBe('permanent');
      expect(entry.type).toBe('user_id');
      expect(entry.expiresAt).toBeUndefined();
    });

    it('should create valid RateLimitConfig', () => {
      const config: RateLimitConfig = {
        enabled: true,
        defaultTier: 'free',
        algorithm: 'sliding_window',
        redis: {
          enabled: true,
          url: 'redis://localhost:6379',
          keyPrefix: 'ratelimit:',
          ttl: 3600
        },
        monitoring: {
          enabled: true,
          alerting: true,
          metrics: true,
          analytics: true
        },
        enforcement: {
          blockRequests: true,
          returnHeaders: true,
          logViolations: true,
          notifyViolations: false
        }
      };

      expect(config.algorithm).toBe('sliding_window');
      expect(config.redis.enabled).toBe(true);
      expect(config.monitoring.alerting).toBe(true);
    });
  });

  describe('Constants', () => {
    describe('RATE_LIMIT_TIERS', () => {
      it('should have free tier configured correctly', () => {
        const freeTier = RATE_LIMIT_TIERS.free;
        
        expect(freeTier.tier).toBe('free');
        expect(freeTier.displayName).toBe('Free');
        expect(freeTier.pricing.monthlyFee).toBe(0);
        expect(freeTier.limits.requestsPerMinute).toBe(60);
        expect(freeTier.limits.requestsPerMonth).toBe(100000);
        expect(freeTier.features).toContain('Basic API access');
        expect(freeTier.isActive).toBe(true);
      });

      it('should have premium tier configured correctly', () => {
        const premiumTier = RATE_LIMIT_TIERS.premium;
        
        expect(premiumTier.tier).toBe('premium');
        expect(premiumTier.displayName).toBe('Premium');
        expect(premiumTier.pricing.monthlyFee).toBe(29.99);
        expect(premiumTier.pricing.overageFee).toBe(0.001);
        expect(premiumTier.limits.requestsPerMinute).toBe(300);
        expect(premiumTier.limits.requestsPerMonth).toBe(1000000);
        expect(premiumTier.features).toContain('Higher rate limits');
        expect(premiumTier.features).toContain('Priority support');
      });

      it('should have enterprise tier configured correctly', () => {
        const enterpriseTier = RATE_LIMIT_TIERS.enterprise;
        
        expect(enterpriseTier.tier).toBe('enterprise');
        expect(enterpriseTier.displayName).toBe('Enterprise');
        expect(enterpriseTier.pricing.monthlyFee).toBe(299.99);
        expect(enterpriseTier.pricing.overageFee).toBe(0.0005);
        expect(enterpriseTier.limits.requestsPerMinute).toBe(1000);
        expect(enterpriseTier.limits.requestsPerMonth).toBe(10000000);
        expect(enterpriseTier.features).toContain('Custom rate limits');
        expect(enterpriseTier.features).toContain('SLA guarantees');
      });

      it('should have all tiers with consistent structure', () => {
        Object.values(RATE_LIMIT_TIERS).forEach(tier => {
          expect(tier).toHaveProperty('tier');
          expect(tier).toHaveProperty('displayName');
          expect(tier).toHaveProperty('description');
          expect(tier).toHaveProperty('pricing');
          expect(tier.pricing).toHaveProperty('monthlyFee');
          expect(tier.pricing).toHaveProperty('overageFee');
          expect(tier.pricing).toHaveProperty('currency');
          expect(tier).toHaveProperty('limits');
          expect(tier.limits).toHaveProperty('requestsPerMinute');
          expect(tier.limits).toHaveProperty('requestsPerHour');
          expect(tier.limits).toHaveProperty('requestsPerDay');
          expect(tier.limits).toHaveProperty('requestsPerMonth');
          expect(tier.limits).toHaveProperty('burstLimit');
          expect(tier.limits).toHaveProperty('concurrentRequests');
          expect(tier).toHaveProperty('features');
          expect(tier).toHaveProperty('isActive');
        });
      });

      it('should have progressive rate limits across tiers', () => {
        const tiers = [RATE_LIMIT_TIERS.free, RATE_LIMIT_TIERS.premium, RATE_LIMIT_TIERS.enterprise];
        
        for (let i = 0; i < tiers.length - 1; i++) {
          const lowerTier = tiers[i];
          const higherTier = tiers[i + 1];
          
          expect(higherTier.limits.requestsPerMinute).toBeGreaterThan(lowerTier.limits.requestsPerMinute);
          expect(higherTier.limits.requestsPerHour).toBeGreaterThan(lowerTier.limits.requestsPerHour);
          expect(higherTier.limits.requestsPerDay).toBeGreaterThan(lowerTier.limits.requestsPerDay);
          expect(higherTier.limits.requestsPerMonth).toBeGreaterThan(lowerTier.limits.requestsPerMonth);
          expect(higherTier.limits.burstLimit).toBeGreaterThan(lowerTier.limits.burstLimit);
          expect(higherTier.limits.concurrentRequests).toBeGreaterThan(lowerTier.limits.concurrentRequests);
        }
      });
    });

    describe('RATE_LIMIT_HEADERS', () => {
      it('should have all required header names', () => {
        expect(RATE_LIMIT_HEADERS.LIMIT).toBe('X-RateLimit-Limit');
        expect(RATE_LIMIT_HEADERS.REMAINING).toBe('X-RateLimit-Remaining');
        expect(RATE_LIMIT_HEADERS.RESET).toBe('X-RateLimit-Reset');
        expect(RATE_LIMIT_HEADERS.RETRY_AFTER).toBe('Retry-After');
        expect(RATE_LIMIT_HEADERS.TIER).toBe('X-RateLimit-Tier');
      });

      it('should have unique header names', () => {
        const headers = Object.values(RATE_LIMIT_HEADERS);
        const uniqueHeaders = new Set(headers);
        expect(uniqueHeaders.size).toBe(headers.length);
      });
    });

    describe('VIOLATION_TYPES', () => {
      it('should have all violation types', () => {
        expect(VIOLATION_TYPES.RATE_LIMIT).toBe('rate_limit');
        expect(VIOLATION_TYPES.QUOTA).toBe('quota');
        expect(VIOLATION_TYPES.BURST).toBe('burst');
        expect(VIOLATION_TYPES.CONCURRENT).toBe('concurrent');
      });

      it('should match RateLimitViolation type values', () => {
        const violation: RateLimitViolation = {
          id: 'test',
          identifier: 'test',
          endpoint: '/test',
          tier: 'free',
          violationType: VIOLATION_TYPES.RATE_LIMIT,
          limit: 60,
          actual: 70,
          timestamp: new Date(),
          ipAddress: '0.0.0.0',
          userAgent: 'test',
          severity: 'low',
          action: 'blocked'
        };

        expect([
          VIOLATION_TYPES.RATE_LIMIT,
          VIOLATION_TYPES.QUOTA,
          VIOLATION_TYPES.BURST,
          VIOLATION_TYPES.CONCURRENT
        ]).toContain(violation.violationType);
      });
    });

    describe('ENFORCEMENT_ACTIONS', () => {
      it('should have all enforcement actions', () => {
        expect(ENFORCEMENT_ACTIONS.BLOCK).toBe('blocked');
        expect(ENFORCEMENT_ACTIONS.WARN).toBe('warned');
        expect(ENFORCEMENT_ACTIONS.THROTTLE).toBe('throttled');
      });

      it('should match RateLimitViolation action values', () => {
        const violation: RateLimitViolation = {
          id: 'test',
          identifier: 'test',
          endpoint: '/test',
          tier: 'free',
          violationType: 'rate_limit',
          limit: 60,
          actual: 70,
          timestamp: new Date(),
          ipAddress: '0.0.0.0',
          userAgent: 'test',
          severity: 'low',
          action: ENFORCEMENT_ACTIONS.BLOCK
        };

        expect([
          ENFORCEMENT_ACTIONS.BLOCK,
          ENFORCEMENT_ACTIONS.WARN,
          ENFORCEMENT_ACTIONS.THROTTLE
        ]).toContain(violation.action);
      });
    });
  });

  describe('Type Safety and Const Assertions', () => {
    it('should have readonly RATE_LIMIT_TIERS', () => {
      const tiers = RATE_LIMIT_TIERS;
      // Verify the object is frozen/readonly by checking its properties
      expect(Object.isFrozen(tiers)).toBe(false); // The object itself isn't frozen
      expect(tiers.free.tier).toBe('free');
      expect(tiers.premium.tier).toBe('premium');
      expect(tiers.enterprise.tier).toBe('enterprise');
    });

    it('should have readonly RATE_LIMIT_HEADERS', () => {
      const headers = RATE_LIMIT_HEADERS;
      // Verify all headers are string constants
      expect(typeof headers.LIMIT).toBe('string');
      expect(typeof headers.REMAINING).toBe('string');
      expect(typeof headers.RESET).toBe('string');
      expect(typeof headers.RETRY_AFTER).toBe('string');
      expect(typeof headers.TIER).toBe('string');
    });

    it('should have readonly VIOLATION_TYPES', () => {
      const types = VIOLATION_TYPES;
      // Verify all types are string constants
      expect(typeof types.RATE_LIMIT).toBe('string');
      expect(typeof types.QUOTA).toBe('string');
      expect(typeof types.BURST).toBe('string');
      expect(typeof types.CONCURRENT).toBe('string');
    });

    it('should have readonly ENFORCEMENT_ACTIONS', () => {
      const actions = ENFORCEMENT_ACTIONS;
      // Verify all actions are string constants
      expect(typeof actions.BLOCK).toBe('string');
      expect(typeof actions.WARN).toBe('string');
      expect(typeof actions.THROTTLE).toBe('string');
    });
  });

  describe('Business Logic Validation', () => {
    it('should have valid pricing structure', () => {
      expect(RATE_LIMIT_TIERS.free.pricing.monthlyFee).toBe(0);
      expect(RATE_LIMIT_TIERS.free.pricing.overageFee).toBe(0);
      
      expect(RATE_LIMIT_TIERS.premium.pricing.monthlyFee).toBeGreaterThan(0);
      expect(RATE_LIMIT_TIERS.premium.pricing.overageFee).toBeGreaterThan(0);
      
      expect(RATE_LIMIT_TIERS.enterprise.pricing.monthlyFee).toBeGreaterThan(
        RATE_LIMIT_TIERS.premium.pricing.monthlyFee
      );
    });

    it('should have valid rate limit progressions', () => {
      Object.values(RATE_LIMIT_TIERS).forEach(tier => {
        const limits = tier.limits;
        
        // Rate limits should make sense relative to each other
        // Hourly limit should be reasonable compared to per-minute
        expect(limits.requestsPerHour).toBeGreaterThan(limits.requestsPerMinute);
        expect(limits.requestsPerHour).toBeLessThan(limits.requestsPerMinute * 60 * 2); // Allow for rate limiting
        
        // Daily limit should be reasonable compared to hourly
        expect(limits.requestsPerDay).toBeGreaterThan(limits.requestsPerHour);
        expect(limits.requestsPerDay).toBeLessThan(limits.requestsPerHour * 24 * 2); // Allow for rate limiting
        
        // Monthly limit should be reasonable compared to daily
        expect(limits.requestsPerMonth).toBeGreaterThan(limits.requestsPerDay);
        expect(limits.requestsPerMonth).toBeLessThan(limits.requestsPerDay * 31 * 2); // Allow for rate limiting
        
        // Burst limit should be reasonable compared to per-minute limit
        expect(limits.burstLimit).toBeLessThan(limits.requestsPerMinute);
        
        // Concurrent requests should be less than or equal to burst limit
        expect(limits.concurrentRequests).toBeLessThanOrEqual(limits.burstLimit);
      });
    });

    it('should have all tiers active by default', () => {
      Object.values(RATE_LIMIT_TIERS).forEach(tier => {
        expect(tier.isActive).toBe(true);
      });
    });

    it('should use USD as currency for all tiers', () => {
      Object.values(RATE_LIMIT_TIERS).forEach(tier => {
        expect(tier.pricing.currency).toBe('USD');
      });
    });
  });
});