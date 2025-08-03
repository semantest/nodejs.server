"use strict";
/**
 * Tests for Authentication Events
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const auth_events_1 = require("../auth-events");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('Authentication Events', () => {
    describe('AuthenticationRequestedEvent', () => {
        it('should create event with password credentials', () => {
            const event = new auth_events_1.AuthenticationRequestedEvent({
                email: 'user@example.com',
                password: 'password123'
            }, 'password', {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                deviceId: 'device-123'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.credentials.email).toBe('user@example.com');
            expect(event.credentials.password).toBe('password123');
            expect(event.authMethod).toBe('password');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
            expect(event.metadata.userAgent).toBe('Mozilla/5.0');
            expect(event.metadata.deviceId).toBe('device-123');
        });
        it('should create event with API key credentials', () => {
            const event = new auth_events_1.AuthenticationRequestedEvent({
                apiKey: 'key-123456'
            }, 'apiKey', {
                ipAddress: '10.0.0.1',
                userAgent: 'API Client/1.0'
            });
            expect(event.credentials.apiKey).toBe('key-123456');
            expect(event.authMethod).toBe('apiKey');
            expect(event.metadata.deviceId).toBeUndefined();
        });
        it('should create event with OAuth2 credentials', () => {
            const event = new auth_events_1.AuthenticationRequestedEvent({
                provider: 'google',
                code: 'auth-code-123',
                redirectUri: 'https://app.example.com/callback'
            }, 'oauth2', {
                ipAddress: '192.168.1.100',
                userAgent: 'Chrome/96.0'
            });
            expect(event.credentials.provider).toBe('google');
            expect(event.credentials.code).toBe('auth-code-123');
            expect(event.credentials.redirectUri).toBe('https://app.example.com/callback');
            expect(event.authMethod).toBe('oauth2');
        });
    });
    describe('AuthorizationRequestedEvent', () => {
        it('should create event with all properties', () => {
            const event = new auth_events_1.AuthorizationRequestedEvent('bearer-token-123', ['read:users', 'write:users'], 'resource-456', {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                endpoint: '/api/users'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.token).toBe('bearer-token-123');
            expect(event.requiredPermissions).toEqual(['read:users', 'write:users']);
            expect(event.resourceId).toBe('resource-456');
            expect(event.metadata?.endpoint).toBe('/api/users');
        });
        it('should create event without optional properties', () => {
            const event = new auth_events_1.AuthorizationRequestedEvent('token-123', ['admin']);
            expect(event.token).toBe('token-123');
            expect(event.requiredPermissions).toEqual(['admin']);
            expect(event.resourceId).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('TokenRefreshRequestedEvent', () => {
        it('should create event with refresh token', () => {
            const event = new auth_events_1.TokenRefreshRequestedEvent('refresh-token-123', {
                ipAddress: '192.168.1.1',
                userAgent: 'Mobile App/2.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.refreshToken).toBe('refresh-token-123');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
            expect(event.metadata.userAgent).toBe('Mobile App/2.0');
        });
    });
    describe('ApiKeyValidationRequestedEvent', () => {
        it('should create event with API key', () => {
            const event = new auth_events_1.ApiKeyValidationRequestedEvent('api-key-123', '/api/data', {
                ipAddress: '192.168.1.1',
                userAgent: 'API Client/1.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.apiKey).toBe('api-key-123');
            expect(event.endpoint).toBe('/api/data');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
            expect(event.metadata.userAgent).toBe('API Client/1.0');
        });
    });
    describe('UserRegistrationRequestedEvent', () => {
        it('should create event with user data', () => {
            const event = new auth_events_1.UserRegistrationRequestedEvent({
                email: 'newuser@example.com',
                password: 'securepass123',
                firstName: 'John',
                lastName: 'Doe'
            }, {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/96.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.userData.email).toBe('newuser@example.com');
            expect(event.userData.firstName).toBe('John');
            expect(event.userData.lastName).toBe('Doe');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
            expect(event.metadata.userAgent).toBe('Chrome/96.0');
        });
    });
    describe('PasswordResetRequestedEvent', () => {
        it('should create event with email', () => {
            const event = new auth_events_1.PasswordResetRequestedEvent('user@example.com', {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/96.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.email).toBe('user@example.com');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
        });
    });
    describe('OAuth2AuthenticationRequestedEvent', () => {
        it('should create event with OAuth2 details', () => {
            const event = new auth_events_1.OAuth2AuthenticationRequestedEvent('google', 'auth-code-123', 'https://app.example.com/callback', 'state-123', {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/96.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.provider).toBe('google');
            expect(event.code).toBe('auth-code-123');
            expect(event.redirectUri).toBe('https://app.example.com/callback');
            expect(event.state).toBe('state-123');
            expect(event.metadata?.ipAddress).toBe('192.168.1.1');
            expect(event.metadata?.userAgent).toBe('Chrome/96.0');
        });
        it('should create event without optional properties', () => {
            const event = new auth_events_1.OAuth2AuthenticationRequestedEvent('github', 'code-456', 'https://app.example.com/auth');
            expect(event.provider).toBe('github');
            expect(event.code).toBe('code-456');
            expect(event.redirectUri).toBe('https://app.example.com/auth');
            expect(event.state).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('RateLimitExceededEvent', () => {
        it('should create event with rate limit details', () => {
            const event = new auth_events_1.RateLimitExceededEvent('api-key-123', '/api/data', 105, 100, 60, {
                ipAddress: '192.168.1.1',
                userAgent: 'API Client/1.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.identifier).toBe('api-key-123');
            expect(event.endpoint).toBe('/api/data');
            expect(event.currentCount).toBe(105);
            expect(event.limit).toBe(100);
            expect(event.windowSeconds).toBe(60);
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
            expect(event.metadata.userAgent).toBe('API Client/1.0');
        });
    });
    describe('SessionExpiredEvent', () => {
        it('should create event with session details', () => {
            const expiredAt = new Date();
            const event = new auth_events_1.SessionExpiredEvent('session-123', 'user-456', expiredAt, {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/96.0'
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.sessionId).toBe('session-123');
            expect(event.userId).toBe('user-456');
            expect(event.expiredAt).toBe(expiredAt);
            expect(event.metadata?.ipAddress).toBe('192.168.1.1');
            expect(event.metadata?.userAgent).toBe('Chrome/96.0');
        });
    });
    describe('SuspiciousActivityDetectedEvent', () => {
        it('should create event with suspicious activity details', () => {
            const timestamp = new Date();
            const event = new auth_events_1.SuspiciousActivityDetectedEvent('user-123', 'multiple_failed_logins', 0.85, {
                attempts: 5,
                locations: ['USA', 'China', 'Russia']
            }, {
                ipAddress: '10.0.0.1',
                userAgent: 'Unknown',
                timestamp
            });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.userId).toBe('user-123');
            expect(event.activityType).toBe('multiple_failed_logins');
            expect(event.riskScore).toBe(0.85);
            expect(event.details.attempts).toBe(5);
            expect(event.details.locations).toEqual(['USA', 'China', 'Russia']);
            expect(event.metadata.ipAddress).toBe('10.0.0.1');
            expect(event.metadata.userAgent).toBe('Unknown');
            expect(event.metadata.timestamp).toBe(timestamp);
        });
    });
});
//# sourceMappingURL=auth-events.test.js.map