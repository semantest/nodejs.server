/**
 * Tests for auth domain entities and interfaces
 */

import {
  User,
  AuthToken,
  TokenPayload,
  ApiKey,
  RateLimit,
  UsageStats,
  Role,
  Permission,
  OAuth2Provider,
  OAuth2UserInfo,
  Session,
  AuthRequest,
  AuthContext,
  RATE_LIMIT_TIERS,
  DEFAULT_PERMISSIONS
} from '../auth-entities';

describe('Auth Entities', () => {
  describe('User Interface', () => {
    it('should create a valid user object', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['user', 'admin'],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-15'),
        emailVerified: true,
        twoFactorEnabled: false,
        metadata: { department: 'engineering' }
      };

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.roles).toContain('user');
      expect(user.roles).toContain('admin');
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(true);
      expect(user.metadata?.department).toBe('engineering');
    });

    it('should allow optional fields', () => {
      const minimalUser: User = {
        id: 'user-456',
        email: 'minimal@example.com',
        passwordHash: 'hash',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: [],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(minimalUser.lastLoginAt).toBeUndefined();
      expect(minimalUser.emailVerified).toBeUndefined();
      expect(minimalUser.twoFactorEnabled).toBeUndefined();
      expect(minimalUser.metadata).toBeUndefined();
    });
  });

  describe('AuthToken Interface', () => {
    it('should create a valid auth token', () => {
      const token: AuthToken = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh_token_here',
        expiresIn: 3600,
        tokenType: 'Bearer'
      };

      expect(token.accessToken).toContain('eyJ');
      expect(token.expiresIn).toBe(3600);
      expect(token.tokenType).toBe('Bearer');
    });
  });

  describe('TokenPayload Interface', () => {
    it('should create a valid token payload', () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        scopes: ['read:profile', 'write:profile'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'semantest-auth',
        sub: 'user-123',
        jti: 'jwt-123'
      };

      expect(payload.userId).toBe('user-123');
      expect(payload.roles).toContain('user');
      expect(payload.scopes).toContain('read:profile');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe('ApiKey Interface', () => {
    it('should create a valid API key with all fields', () => {
      const rateLimit: RateLimit = {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        concurrentRequests: 5
      };

      const usageStats: UsageStats = {
        totalRequests: 5000,
        requestsThisMonth: 1000,
        requestsToday: 50,
        errorCount: 5,
        lastError: new Date('2024-01-15'),
        averageResponseTime: 125.5
      };

      const apiKey: ApiKey = {
        id: 'key-123',
        key: 'sk_test_123456789',
        name: 'Production API Key',
        userId: 'user-123',
        scopes: ['read:data', 'write:data'],
        tier: 'premium',
        isActive: true,
        rateLimit,
        usageStats,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-10'),
        expiresAt: new Date('2025-01-01'),
        lastUsedAt: new Date('2024-01-15')
      };

      expect(apiKey.tier).toBe('premium');
      expect(apiKey.rateLimit.requestsPerMinute).toBe(60);
      expect(apiKey.usageStats.totalRequests).toBe(5000);
      expect(apiKey.scopes).toContain('read:data');
    });

    it('should handle different tiers', () => {
      const tiers: ApiKey['tier'][] = ['free', 'premium', 'enterprise'];
      
      tiers.forEach(tier => {
        const apiKey: Partial<ApiKey> = { tier };
        expect(apiKey.tier).toBe(tier);
      });
    });
  });

  describe('Role and Permission Interfaces', () => {
    it('should create a valid role with permissions', () => {
      const permissions: Permission[] = [
        {
          id: 'perm-1',
          name: 'read:users',
          resource: 'users',
          action: 'read',
          conditions: ['own', 'team'],
          description: 'Read user profiles'
        },
        {
          id: 'perm-2',
          name: 'write:users',
          resource: 'users',
          action: 'write',
          description: 'Update user profiles'
        }
      ];

      const role: Role = {
        id: 'role-123',
        name: 'team_admin',
        displayName: 'Team Administrator',
        description: 'Can manage team members',
        permissions,
        isSystemRole: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      expect(role.permissions).toHaveLength(2);
      expect(role.permissions[0].conditions).toContain('own');
      expect(role.isSystemRole).toBe(true);
    });
  });

  describe('OAuth2 Interfaces', () => {
    it('should create a valid OAuth2 provider', () => {
      const provider: OAuth2Provider = {
        id: 'oauth-google',
        name: 'google',
        displayName: 'Google',
        clientId: 'client_id_here',
        clientSecret: 'client_secret_here',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: 'http://localhost:3000/auth/callback/google',
        isActive: true
      };

      expect(provider.name).toBe('google');
      expect(provider.scopes).toContain('openid');
      expect(provider.isActive).toBe(true);
    });

    it('should create valid OAuth2 user info', () => {
      const userInfo: OAuth2UserInfo = {
        id: 'google-123',
        email: 'user@gmail.com',
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
        locale: 'en-US',
        verified_email: true
      };

      expect(userInfo.email).toBe('user@gmail.com');
      expect(userInfo.verified_email).toBe(true);
    });
  });

  describe('Session Interface', () => {
    it('should create a valid session', () => {
      const session: Session = {
        id: 'session-123',
        userId: 'user-123',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        isActive: true
      };

      expect(session.userId).toBe('user-123');
      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.isActive).toBe(true);
    });
  });

  describe('AuthRequest Interface', () => {
    it('should create password auth request', () => {
      const request: AuthRequest = {
        method: 'password',
        credentials: {
          email: 'user@example.com',
          password: 'password123'
        },
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120',
          deviceId: 'device-123'
        }
      };

      expect(request.method).toBe('password');
      expect(request.credentials.email).toBe('user@example.com');
    });

    it('should create API key auth request', () => {
      const request: AuthRequest = {
        method: 'apiKey',
        credentials: {
          apiKey: 'sk_test_123'
        },
        metadata: {
          ipAddress: '10.0.0.1',
          userAgent: 'API Client/1.0'
        }
      };

      expect(request.method).toBe('apiKey');
      expect(request.credentials.apiKey).toBe('sk_test_123');
    });

    it('should create OAuth2 auth request', () => {
      const request: AuthRequest = {
        method: 'oauth2',
        credentials: {
          provider: 'google',
          code: 'auth_code_123',
          redirectUri: 'http://localhost:3000/callback'
        },
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Firefox/120'
        }
      };

      expect(request.method).toBe('oauth2');
      expect(request.credentials.provider).toBe('google');
    });
  });

  describe('AuthContext Interface', () => {
    it('should create a valid auth context', () => {
      const context: AuthContext = {
        userId: 'user-123',
        roles: ['user', 'admin'],
        permissions: ['read:users', 'write:users'],
        apiKeyId: 'key-123',
        sessionId: 'session-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120'
      };

      expect(context.userId).toBe('user-123');
      expect(context.roles).toContain('admin');
      expect(context.permissions).toContain('read:users');
    });
  });

  describe('Constants', () => {
    describe('RATE_LIMIT_TIERS', () => {
      it('should have correct values for free tier', () => {
        const freeTier = RATE_LIMIT_TIERS.free;
        expect(freeTier.requestsPerMinute).toBe(60);
        expect(freeTier.requestsPerHour).toBe(1000);
        expect(freeTier.requestsPerDay).toBe(10000);
        expect(freeTier.burstLimit).toBe(10);
        expect(freeTier.concurrentRequests).toBe(5);
      });

      it('should have correct values for premium tier', () => {
        const premiumTier = RATE_LIMIT_TIERS.premium;
        expect(premiumTier.requestsPerMinute).toBe(300);
        expect(premiumTier.requestsPerHour).toBe(10000);
        expect(premiumTier.requestsPerDay).toBe(100000);
        expect(premiumTier.burstLimit).toBe(50);
        expect(premiumTier.concurrentRequests).toBe(20);
      });

      it('should have correct values for enterprise tier', () => {
        const enterpriseTier = RATE_LIMIT_TIERS.enterprise;
        expect(enterpriseTier.requestsPerMinute).toBe(1000);
        expect(enterpriseTier.requestsPerHour).toBe(50000);
        expect(enterpriseTier.requestsPerDay).toBe(1000000);
        expect(enterpriseTier.burstLimit).toBe(200);
        expect(enterpriseTier.concurrentRequests).toBe(100);
      });

      it('should have progressively higher limits', () => {
        expect(RATE_LIMIT_TIERS.premium.requestsPerMinute).toBeGreaterThan(
          RATE_LIMIT_TIERS.free.requestsPerMinute
        );
        expect(RATE_LIMIT_TIERS.enterprise.requestsPerMinute).toBeGreaterThan(
          RATE_LIMIT_TIERS.premium.requestsPerMinute
        );
      });
    });

    describe('DEFAULT_PERMISSIONS', () => {
      it('should have correct user permissions', () => {
        const userPerms = DEFAULT_PERMISSIONS.user;
        expect(userPerms).toContain('read:profile');
        expect(userPerms).toContain('update:profile');
        expect(userPerms).toContain('read:own-api-keys');
        expect(userPerms).toContain('create:own-api-keys');
        expect(userPerms).toContain('delete:own-api-keys');
        expect(userPerms).toHaveLength(5);
      });

      it('should have correct admin permissions', () => {
        const adminPerms = DEFAULT_PERMISSIONS.admin;
        expect(adminPerms).toContain('read:users');
        expect(adminPerms).toContain('update:users');
        expect(adminPerms).toContain('delete:users');
        expect(adminPerms).toContain('read:api-keys');
        expect(adminPerms).toContain('read:system-metrics');
        expect(adminPerms.length).toBeGreaterThan(DEFAULT_PERMISSIONS.user.length);
      });

      it('should have wildcard for super admin', () => {
        const superAdminPerms = DEFAULT_PERMISSIONS.super_admin;
        expect(superAdminPerms).toHaveLength(1);
        expect(superAdminPerms[0]).toBe('*');
      });
    });
  });
});