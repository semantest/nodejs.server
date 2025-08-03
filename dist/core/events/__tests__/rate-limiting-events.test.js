"use strict";
/**
 * Tests for rate limiting events
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rate_limiting_events_1 = require("../rate-limiting-events");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('Rate Limiting Events', () => {
    describe('RateLimitCheckRequestedEvent', () => {
        it('should create event with all required fields', () => {
            const event = new rate_limiting_events_1.RateLimitCheckRequestedEvent('user-123', '/api/data', 'premium', {
                ipAddress: '192.168.1.100',
                userAgent: 'Mozilla/5.0',
                requestId: 'req-123',
                timestamp: new Date('2024-01-01T12:00:00Z')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.identifier).toBe('user-123');
            expect(event.endpoint).toBe('/api/data');
            expect(event.tier).toBe('premium');
            expect(event.metadata.ipAddress).toBe('192.168.1.100');
            expect(event.metadata.requestId).toBe('req-123');
        });
    });
    describe('RateLimitExceededEvent', () => {
        it('should create event with violation details', () => {
            const event = new rate_limiting_events_1.RateLimitExceededEvent('api-key-456', '/api/users', 'rate_limit', 60, 75, new Date('2024-01-01T12:01:00Z'), {
                ipAddress: '10.0.0.1',
                userAgent: 'API Client/1.0',
                requestId: 'req-456',
                tier: 'free',
                severity: 'medium'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.violationType).toBe('rate_limit');
            expect(event.limit).toBe(60);
            expect(event.actual).toBe(75);
            expect(event.actual).toBeGreaterThan(event.limit);
            expect(event.metadata.severity).toBe('medium');
        });
    });
    describe('QuotaManagementRequestedEvent', () => {
        it('should create check operation event', () => {
            const event = new rate_limiting_events_1.QuotaManagementRequestedEvent('check', 'user-789', {
                usage: 50000,
                limit: 100000,
                tier: 'premium',
                resetDate: new Date('2024-02-01')
            }, {
                requestId: 'req-789',
                timestamp: new Date('2024-01-15')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.operation).toBe('check');
            expect(event.quotaData?.usage).toBe(50000);
            expect(event.quotaData?.limit).toBe(100000);
        });
        it('should create update operation event', () => {
            const event = new rate_limiting_events_1.QuotaManagementRequestedEvent('update', 'user-789', {
                limit: 200000,
                tier: 'enterprise'
            });
            expect(event.operation).toBe('update');
            expect(event.quotaData?.limit).toBe(200000);
            expect(event.quotaData?.tier).toBe('enterprise');
        });
        it('should handle different operations', () => {
            const operations = [
                'check', 'update', 'reset', 'upgrade'
            ];
            operations.forEach(op => {
                const event = new rate_limiting_events_1.QuotaManagementRequestedEvent(op, 'user-test');
                expect(event.operation).toBe(op);
            });
        });
    });
    describe('RateLimitViolationDetectedEvent', () => {
        it('should create violation event with details', () => {
            const event = new rate_limiting_events_1.RateLimitViolationDetectedEvent('ip-192.168.1.50', '/api/search', 'burst', 'high', {
                limit: 10,
                actual: 25,
                resetTime: new Date('2024-01-01T12:01:00Z'),
                tier: 'free'
            }, {
                ipAddress: '192.168.1.50',
                userAgent: 'Chrome/120',
                requestId: 'req-violation',
                timestamp: new Date('2024-01-01T12:00:30Z')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.violationType).toBe('burst');
            expect(event.severity).toBe('high');
            expect(event.details.actual).toBeGreaterThan(event.details.limit);
        });
    });
    describe('RateLimitMetricsRequestedEvent', () => {
        it('should create metrics request with filters', () => {
            const event = new rate_limiting_events_1.RateLimitMetricsRequestedEvent('1h', {
                tier: 'premium',
                endpoint: '/api/data',
                identifier: 'user-123'
            }, {
                requestId: 'req-metrics',
                timestamp: new Date('2024-01-01T13:00:00Z')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.timeframe).toBe('1h');
            expect(event.filters?.tier).toBe('premium');
            expect(event.filters?.endpoint).toBe('/api/data');
        });
        it('should create metrics request without filters', () => {
            const event = new rate_limiting_events_1.RateLimitMetricsRequestedEvent('24h');
            expect(event.timeframe).toBe('24h');
            expect(event.filters).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('RateLimitConfigurationUpdatedEvent', () => {
        it('should create tier configuration update', () => {
            const event = new rate_limiting_events_1.RateLimitConfigurationUpdatedEvent('tier', {
                tier: 'premium',
                limits: {
                    requestsPerMinute: 300,
                    requestsPerHour: 10000,
                    requestsPerDay: 100000
                }
            }, {
                updatedBy: 'admin-user',
                timestamp: new Date('2024-01-01')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.configType).toBe('tier');
            expect(event.configData.limits?.requestsPerMinute).toBe(300);
        });
        it('should create endpoint configuration update', () => {
            const event = new rate_limiting_events_1.RateLimitConfigurationUpdatedEvent('endpoint', {
                endpoint: '/api/heavy-operation',
                limits: {
                    requestsPerMinute: 10
                },
                rules: {
                    burstAllowed: false
                }
            }, {
                updatedBy: 'system',
                timestamp: new Date('2024-01-01')
            });
            expect(event.configType).toBe('endpoint');
            expect(event.configData.endpoint).toBe('/api/heavy-operation');
            expect(event.configData.rules?.burstAllowed).toBe(false);
        });
        it('should handle different config types', () => {
            const types = ['tier', 'endpoint', 'global'];
            types.forEach(type => {
                const event = new rate_limiting_events_1.RateLimitConfigurationUpdatedEvent(type, {}, { updatedBy: 'test', timestamp: new Date() });
                expect(event.configType).toBe(type);
            });
        });
    });
    describe('RateLimitAlertTriggeredEvent', () => {
        it('should create alert event', () => {
            const event = new rate_limiting_events_1.RateLimitAlertTriggeredEvent('alert-123', 'High Violation Rate Alert', 'violation_rate > 0.1', 0.1, 0.15, ['user-123', 'user-456', 'ip-192.168.1.100'], {
                severity: 'high',
                timeWindow: 300, // 5 minutes
                timestamp: new Date('2024-01-01T12:00:00Z')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.alertName).toBe('High Violation Rate Alert');
            expect(event.actual).toBeGreaterThan(event.threshold);
            expect(event.affectedIdentifiers).toHaveLength(3);
            expect(event.metadata.timeWindow).toBe(300);
        });
    });
    describe('RateLimitWhitelistUpdatedEvent', () => {
        it('should create add whitelist event', () => {
            const event = new rate_limiting_events_1.RateLimitWhitelistUpdatedEvent('add', 'api-key-trusted', 'api_key', 'Trusted partner integration', new Date('2025-01-01'), {
                updatedBy: 'admin',
                timestamp: new Date('2024-01-01')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.operation).toBe('add');
            expect(event.type).toBe('api_key');
            expect(event.reason).toContain('Trusted partner');
            expect(event.expiresAt).toBeDefined();
        });
        it('should create remove whitelist event', () => {
            const event = new rate_limiting_events_1.RateLimitWhitelistUpdatedEvent('remove', 'ip-10.0.0.1', 'ip', 'No longer needed');
            expect(event.operation).toBe('remove');
            expect(event.type).toBe('ip');
            expect(event.expiresAt).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
        it('should handle different operations and types', () => {
            const operations = ['add', 'remove', 'update'];
            const types = ['ip', 'api_key', 'user_id'];
            operations.forEach(op => {
                types.forEach(type => {
                    const event = new rate_limiting_events_1.RateLimitWhitelistUpdatedEvent(op, 'test', type, 'test reason');
                    expect(event.operation).toBe(op);
                    expect(event.type).toBe(type);
                });
            });
        });
    });
    describe('RateLimitBlacklistUpdatedEvent', () => {
        it('should create permanent blacklist event', () => {
            const event = new rate_limiting_events_1.RateLimitBlacklistUpdatedEvent('add', 'user-malicious', 'user_id', 'Multiple ToS violations', 'permanent', undefined, {
                updatedBy: 'security-team',
                timestamp: new Date('2024-01-01')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.severity).toBe('permanent');
            expect(event.expiresAt).toBeUndefined();
            expect(event.metadata?.updatedBy).toBe('security-team');
        });
        it('should create temporary blacklist event', () => {
            const event = new rate_limiting_events_1.RateLimitBlacklistUpdatedEvent('add', 'ip-192.168.1.100', 'ip', 'Suspicious activity detected', 'temporary', new Date('2024-02-01'));
            expect(event.severity).toBe('temporary');
            expect(event.expiresAt).toBeDefined();
        });
        it('should handle different severities', () => {
            const severities = ['temporary', 'permanent'];
            severities.forEach(severity => {
                const event = new rate_limiting_events_1.RateLimitBlacklistUpdatedEvent('add', 'test', 'ip', 'test', severity);
                expect(event.severity).toBe(severity);
            });
        });
    });
    describe('RateLimitAnalyticsGeneratedEvent', () => {
        it('should create analytics event', () => {
            const event = new rate_limiting_events_1.RateLimitAnalyticsGeneratedEvent('daily', {
                totalRequests: 1000000,
                blockedRequests: 5000,
                blockRate: 0.005,
                uniqueIdentifiers: 2500,
                topViolators: [
                    { identifier: 'user-123', violations: 150 },
                    { identifier: 'ip-192.168.1.50', violations: 100 },
                    { identifier: 'api-key-789', violations: 75 }
                ]
            }, {
                generatedAt: new Date('2024-01-02T00:00:00Z'),
                timeRange: {
                    start: new Date('2024-01-01T00:00:00Z'),
                    end: new Date('2024-01-01T23:59:59Z')
                }
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.period).toBe('daily');
            expect(event.analytics.totalRequests).toBe(1000000);
            expect(event.analytics.blockRate).toBe(0.005);
            expect(event.analytics.topViolators).toHaveLength(3);
            expect(event.analytics.topViolators[0].violations).toBeGreaterThan(event.analytics.topViolators[2].violations);
        });
    });
    describe('RateLimitCleanupRequestedEvent', () => {
        it('should create cleanup event for expired entries', () => {
            const event = new rate_limiting_events_1.RateLimitCleanupRequestedEvent('expired', new Date('2024-01-01'), {
                requestId: 'cleanup-123',
                timestamp: new Date('2024-01-15')
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.cleanupType).toBe('expired');
            expect(event.olderThan).toEqual(new Date('2024-01-01'));
        });
        it('should handle different cleanup types', () => {
            const types = [
                'expired', 'old_metrics', 'old_violations'
            ];
            types.forEach(type => {
                const event = new rate_limiting_events_1.RateLimitCleanupRequestedEvent(type, new Date());
                expect(event.cleanupType).toBe(type);
            });
        });
        it('should create cleanup event without metadata', () => {
            const event = new rate_limiting_events_1.RateLimitCleanupRequestedEvent('old_metrics', new Date('2023-12-01'));
            expect(event.metadata).toBeUndefined();
        });
    });
});
//# sourceMappingURL=rate-limiting-events.test.js.map