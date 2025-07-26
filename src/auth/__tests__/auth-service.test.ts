/**
 * Emergency tests for AuthService
 * Created by Quinn (QA) during test coverage crisis - 2:47 AM
 * Target: Boost nodejs.server coverage from 2.94%
 */

import { AuthService } from '../auth-service';
import {
  AuthenticationRequestedEvent,
  AuthorizationRequestedEvent,
  TokenRefreshRequestedEvent
} from '../../core/events/auth-events';

// Mock the decorators and base class
jest.mock('../../stubs/typescript-eda-stubs', () => ({
  Application: class MockApplication {
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();
  },
  Enable: () => (target: any) => target,
  listen: () => () => {}
}));

// Mock adapters
jest.mock('../adapters/jwt-token-manager');
jest.mock('../adapters/api-key-manager');
jest.mock('../adapters/password-hash-manager');
jest.mock('../adapters/rbac-manager');
jest.mock('../adapters/oauth2-manager');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct metadata values', () => {
      expect(authService.metadata.get('name')).toBe('Web-Buddy Authentication Service');
      expect(authService.metadata.get('version')).toBe('1.0.0');
      expect(authService.metadata.get('capabilities')).toBe('jwt-auth,api-keys,oauth2,rbac');
      expect(authService.metadata.get('tokenExpiry')).toBe('15m');
      expect(authService.metadata.get('refreshTokenExpiry')).toBe('7d');
    });
  });

  describe('authentication', () => {
    it('should handle password authentication', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {
          username: 'testuser',
          password: 'testpass123'
        },
        'password',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      // Mock password hash manager
      authService['passwordHashManager'] = {
        hash: jest.fn(),
        verifyPassword: jest.fn().mockResolvedValue(true),
        needsRehash: jest.fn().mockReturnValue(false)
      } as any;

      authService['jwtManager'] = {
        generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
        generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
        verifyAccessToken: jest.fn(),
        verifyRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn()
      } as any;

      await authService.handleAuthentication(authEvent);
      
      expect(authService['passwordHashManager'].verify).toHaveBeenCalled();
      expect(authService['jwtManager'].generateTokenPair).toHaveBeenCalled();
    });

    it('should handle API key authentication', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {
          apiKey: 'test-api-key-123'
        },
        'apiKey',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['apiKeyManager'] = {
        keyPrefix: 'sk_test_',
        keyLength: 32,
        validateApiKey: jest.fn().mockResolvedValue({
          id: 'key-123',
          name: 'Test Key',
          permissions: ['read', 'write']
        }),
        createApiKey: jest.fn(),
        checkRateLimit: jest.fn()
      } as any;

      await authService.handleAuthentication(authEvent);
      
      expect(authService['apiKeyManager'].validateApiKey).toHaveBeenCalledWith('test-api-key-123');
    });

    it('should handle OAuth2 authentication', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {
          code: 'oauth-code-123',
          provider: 'google'
        },
        'oauth2',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['oauth2Manager'] = {
        exchangeCodeForToken: jest.fn().mockResolvedValue({
          accessToken: 'google-access-token',
          profile: {
            id: 'google-123',
            email: 'test@gmail.com'
          }
        }),
        getAuthorizationUrl: jest.fn(),
        refreshToken: jest.fn()
      } as any;

      await authService.handleAuthentication(authEvent);
      
      expect(authService['oauth2Manager'].exchangeCodeForToken).toHaveBeenCalled();
    });

    it('should reject invalid credentials', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {
          username: 'testuser',
          password: 'wrongpass'
        },
        'password',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['passwordHashManager'] = {
        hash: jest.fn(),
        verifyPassword: jest.fn().mockResolvedValue(false),
        needsRehash: jest.fn().mockReturnValue(false)
      } as any;

      await expect(authService.handleAuthentication(authEvent)).rejects.toThrow();
    });

    it('should handle unsupported auth methods', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {},
        'unsupported' as any,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      await expect(authService.handleAuthentication(authEvent)).rejects.toThrow();
    });
  });

  describe('authorization', () => {
    it('should handle authorization requests', async () => {
      const authzEvent = new AuthorizationRequestedEvent(
        'valid-jwt-token',
        ['read'],
        '/api/users',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          endpoint: '/api/users'
        }
      );

      authService['jwtManager'] = {
        generateAccessToken: jest.fn(),
        generateRefreshToken: jest.fn(),
        verifyAccessToken: jest.fn().mockResolvedValue({
          userId: 'user-123',
          roles: ['user', 'admin']
        }),
        verifyRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn()
      } as any;

      authService['rbacManager'] = {
        checkPermission: jest.fn().mockResolvedValue(true),
        getRolesForUser: jest.fn(),
        getPermissionsForRole: jest.fn(),
        assignRole: jest.fn(),
        revokeRole: jest.fn()
      } as any;

      const result = await authService.handleAuthorization(authzEvent);
      
      expect(authService['jwtManager'].verifyAccessToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(authService['rbacManager'].checkPermission).toHaveBeenCalled();
      expect(result.authorized).toBe(true);
    });

    it('should deny unauthorized access', async () => {
      const authzEvent = new AuthorizationRequestedEvent(
        'valid-jwt-token',
        ['delete'],
        '/api/admin',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          endpoint: '/api/admin'
        }
      );

      authService['jwtManager'] = {
        generateAccessToken: jest.fn(),
        generateRefreshToken: jest.fn(),
        verifyAccessToken: jest.fn().mockResolvedValue({
          userId: 'user-123',
          roles: ['user']
        }),
        verifyRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn()
      } as any;

      authService['rbacManager'] = {
        checkPermission: jest.fn().mockResolvedValue(false),
        getRolesForUser: jest.fn(),
        getPermissionsForRole: jest.fn(),
        assignRole: jest.fn(),
        revokeRole: jest.fn()
      } as any;

      const result = await authService.handleAuthorization(authzEvent);
      
      expect(result.authorized).toBe(false);
    });

    it('should handle invalid tokens', async () => {
      const authzEvent = new AuthorizationRequestedEvent(
        'invalid-token',
        ['read'],
        '/api/users',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          endpoint: '/api/users'
        }
      );

      authService['jwtManager'] = {
        generateAccessToken: jest.fn(),
        generateRefreshToken: jest.fn(),
        verifyAccessToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
        verifyRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn()
      } as any;

      await expect(authService.handleAuthorization(authzEvent)).rejects.toThrow('Invalid token');
    });
  });

  describe('token refresh', () => {
    it('should handle token refresh requests', async () => {
      const refreshEvent = new TokenRefreshRequestedEvent(
        'valid-refresh-token',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['jwtManager'] = {
        generateAccessToken: jest.fn().mockReturnValue('new-access-token'),
        generateRefreshToken: jest.fn().mockReturnValue('new-refresh-token'),
        verifyAccessToken: jest.fn(),
        verifyRefreshToken: jest.fn().mockResolvedValue({
          userId: 'user-123',
          tokenId: 'token-123'
        }),
        revokeRefreshToken: jest.fn().mockResolvedValue(true)
      } as any;

      const result = await authService.handleTokenRefresh(refreshEvent);
      
      expect(authService['jwtManager'].verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(authService['jwtManager'].generateAccessToken).toHaveBeenCalled();
      expect(authService['jwtManager'].generateRefreshToken).toHaveBeenCalled();
      expect(authService['jwtManager'].revokeRefreshToken).toHaveBeenCalledWith('token-123');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should reject invalid refresh tokens', async () => {
      const refreshEvent = new TokenRefreshRequestedEvent(
        'invalid-refresh-token',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['jwtManager'] = {
        generateAccessToken: jest.fn(),
        generateRefreshToken: jest.fn(),
        verifyAccessToken: jest.fn(),
        verifyRefreshToken: jest.fn().mockRejectedValue(new Error('Invalid refresh token')),
        revokeRefreshToken: jest.fn()
      } as any;

      await expect(authService.handleTokenRefresh(refreshEvent)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('security features', () => {
    it('should implement rate limiting for auth attempts', async () => {
      // Simulate multiple failed auth attempts
      const authEvent = new AuthenticationRequestedEvent(
        {
          username: 'testuser',
          password: 'wrongpass'
        },
        'password',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      authService['passwordHashManager'] = {
        hash: jest.fn(),
        verifyPassword: jest.fn().mockResolvedValue(false),
        needsRehash: jest.fn().mockReturnValue(false)
      } as any;

      // Should track failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.handleAuthentication(authEvent);
        } catch (e) {
          // Expected to fail
        }
      }

      // 6th attempt should be rate limited
      await expect(authService.handleAuthentication(authEvent)).rejects.toThrow(/rate limit/i);
    });

    it('should hash API keys before storage', async () => {
      const apiKey = 'sk_test_123456789';
      
      authService['apiKeyManager'] = {
        keyPrefix: 'sk_test_',
        keyLength: 32,
        createApiKey: jest.fn().mockImplementation((key) => {
          expect(key).not.toBe(apiKey); // Should be hashed
          return Promise.resolve({
            id: 'key-123',
            hashedKey: 'hashed-version',
            prefix: 'sk_test_'
          });
        }),
        validateApiKey: jest.fn(),
        checkRateLimit: jest.fn()
      } as any;

      await authService.createApiKey('Test Key', {
        name: 'Test Key',
        scopes: ['read'],
        tier: 'free'
      });
      expect(authService['apiKeyManager'].createApiKey).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing credentials gracefully', async () => {
      const authEvent = new AuthenticationRequestedEvent(
        {},
        'password',
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        }
      );

      await expect(authService.handleAuthentication(authEvent)).rejects.toThrow(/credentials/i);
    });

    it('should handle concurrent auth requests', async () => {
      const authPromises = Array(10).fill(null).map((_, i) => 
        authService.handleAuthentication(new AuthenticationRequestedEvent(
          {
            username: `user${i}`,
            password: 'pass123'
          },
          'password',
          {
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent'
          }
        ))
      );

      authService['passwordHashManager'] = {
        hash: jest.fn(),
        verifyPassword: jest.fn().mockResolvedValue(true),
        needsRehash: jest.fn().mockReturnValue(false)
      } as any;
      authService['jwtManager'] = {
        generateAccessToken: jest.fn().mockReturnValue('token'),
        generateRefreshToken: jest.fn().mockReturnValue('refresh'),
        verifyAccessToken: jest.fn(),
        verifyRefreshToken: jest.fn(),
        revokeRefreshToken: jest.fn()
      } as any;

      // Should handle all requests without interference
      const results = await Promise.allSettled(authPromises);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
    });
  });
});