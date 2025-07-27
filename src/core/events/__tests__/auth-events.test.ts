/**
 * Tests for Authentication Events
 * Created to improve coverage from 0%
 */

import {
  AuthenticationRequestedEvent,
  AuthorizationRequestedEvent,
  TokenRefreshRequestedEvent,
  ApiKeyValidationRequestedEvent,
  UserRegistrationRequestedEvent,
  PasswordResetRequestedEvent,
  OAuth2AuthenticationRequestedEvent,
  RateLimitExceededEvent,
  SessionExpiredEvent,
  SuspiciousActivityDetectedEvent
} from '../auth-events';
import { Event } from '../../../stubs/typescript-eda-stubs';

describe('Authentication Events', () => {
  describe('AuthenticationRequestedEvent', () => {
    it('should create event with password credentials', () => {
      const event = new AuthenticationRequestedEvent(
        {
          email: 'user@example.com',
          password: 'password123'
        },
        'password',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          deviceId: 'device-123'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.credentials.email).toBe('user@example.com');
      expect(event.credentials.password).toBe('password123');
      expect(event.authMethod).toBe('password');
      expect(event.metadata.ipAddress).toBe('192.168.1.1');
      expect(event.metadata.userAgent).toBe('Mozilla/5.0');
      expect(event.metadata.deviceId).toBe('device-123');
    });

    it('should create event with API key credentials', () => {
      const event = new AuthenticationRequestedEvent(
        {
          apiKey: 'key-123456'
        },
        'apiKey',
        {
          ipAddress: '10.0.0.1',
          userAgent: 'API Client/1.0'
        }
      );

      expect(event.credentials.apiKey).toBe('key-123456');
      expect(event.authMethod).toBe('apiKey');
      expect(event.metadata.deviceId).toBeUndefined();
    });

    it('should create event with OAuth2 credentials', () => {
      const event = new AuthenticationRequestedEvent(
        {
          provider: 'google',
          code: 'auth-code-123',
          redirectUri: 'https://app.example.com/callback'
        },
        'oauth2',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome/96.0'
        }
      );

      expect(event.credentials.provider).toBe('google');
      expect(event.credentials.code).toBe('auth-code-123');
      expect(event.credentials.redirectUri).toBe('https://app.example.com/callback');
      expect(event.authMethod).toBe('oauth2');
    });
  });

  describe('AuthorizationRequestedEvent', () => {
    it('should create event with all properties', () => {
      const event = new AuthorizationRequestedEvent(
        'bearer-token-123',
        ['read:users', 'write:users'],
        'resource-456',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/users'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.token).toBe('bearer-token-123');
      expect(event.requiredPermissions).toEqual(['read:users', 'write:users']);
      expect(event.resourceId).toBe('resource-456');
      expect(event.metadata?.endpoint).toBe('/api/users');
    });

    it('should create event without optional properties', () => {
      const event = new AuthorizationRequestedEvent(
        'token-123',
        ['admin']
      );

      expect(event.token).toBe('token-123');
      expect(event.requiredPermissions).toEqual(['admin']);
      expect(event.resourceId).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });
  });

  describe('TokenRefreshRequestedEvent', () => {
    it('should create event with refresh token', () => {
      const event = new TokenRefreshRequestedEvent(
        'refresh-token-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mobile App/2.0'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.refreshToken).toBe('refresh-token-123');
      expect(event.metadata.ipAddress).toBe('192.168.1.1');
      expect(event.metadata.userAgent).toBe('Mobile App/2.0');
    });
  });

  describe('SessionCreatedEvent', () => {
    it('should create event with session details', () => {
      const event = new SessionCreatedEvent(
        'session-123',
        'user-456',
        new Date('2024-01-01T10:00:00Z'),
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          deviceId: 'device-123'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.sessionId).toBe('session-123');
      expect(event.userId).toBe('user-456');
      expect(event.expiresAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(event.metadata.deviceId).toBe('device-123');
    });
  });

  describe('SessionTerminatedEvent', () => {
    it('should create event with termination reason', () => {
      const event = new SessionTerminatedEvent(
        'session-123',
        'user-456',
        'logout'
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.sessionId).toBe('session-123');
      expect(event.userId).toBe('user-456');
      expect(event.reason).toBe('logout');
    });

    it('should accept different termination reasons', () => {
      const reasons = ['logout', 'expired', 'revoked', 'replaced'];
      
      reasons.forEach(reason => {
        const event = new SessionTerminatedEvent(
          'session-123',
          'user-456',
          reason as any
        );
        expect(event.reason).toBe(reason);
      });
    });
  });

  describe('PasswordResetRequestedEvent', () => {
    it('should create event with email', () => {
      const event = new PasswordResetRequestedEvent(
        'user@example.com',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/96.0'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.email).toBe('user@example.com');
      expect(event.metadata.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('PasswordResetCompletedEvent', () => {
    it('should create event with user ID and metadata', () => {
      const event = new PasswordResetCompletedEvent(
        'user-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Firefox/95.0'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.userId).toBe('user-123');
      expect(event.metadata.userAgent).toBe('Firefox/95.0');
    });
  });

  describe('SecurityAlertEvent', () => {
    it('should create event with security alert details', () => {
      const event = new SecurityAlertEvent(
        'user-123',
        'suspicious_login',
        'high',
        {
          attempts: 5,
          location: 'Unknown',
          ipAddress: '10.0.0.1'
        }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.userId).toBe('user-123');
      expect(event.alertType).toBe('suspicious_login');
      expect(event.severity).toBe('high');
      expect(event.details.attempts).toBe(5);
      expect(event.details.location).toBe('Unknown');
      expect(event.details.ipAddress).toBe('10.0.0.1');
    });

    it('should accept different alert types', () => {
      const alertTypes = [
        'suspicious_login',
        'multiple_failed_attempts',
        'password_breach',
        'unusual_activity'
      ];

      alertTypes.forEach(alertType => {
        const event = new SecurityAlertEvent(
          'user-123',
          alertType as any,
          'medium',
          {}
        );
        expect(event.alertType).toBe(alertType);
      });
    });

    it('should accept different severity levels', () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      severities.forEach(severity => {
        const event = new SecurityAlertEvent(
          'user-123',
          'unusual_activity',
          severity as any,
          {}
        );
        expect(event.severity).toBe(severity);
      });
    });
  });
});