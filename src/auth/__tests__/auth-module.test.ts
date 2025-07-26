/**
 * Emergency tests for AuthModule
 * Created by Quinn (QA) during test coverage crisis - 8:05 AM
 * Target: Boost nodejs.server coverage from 13.41%
 */

import { AuthModule } from '../auth-module';
import { Application } from '../../stubs/typescript-eda-stubs';

// Mock the stubs
jest.mock('../../stubs/typescript-eda-stubs', () => ({
  Module: class MockModule {},
  Application: class MockApplication {
    on = jest.fn();
    emit = jest.fn();
    off = jest.fn();
  },
  EnableModule: () => (target: any) => target
}));

// Mock the auth service
jest.mock('../auth-service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    metadata: new Map()
  }))
}));

describe('AuthModule', () => {
  let authModule: AuthModule;
  let mockApp: any;

  beforeEach(() => {
    authModule = new AuthModule();
    mockApp = new Application();
    jest.clearAllMocks();
  });

  describe('module metadata', () => {
    it('should have correct module name', () => {
      expect(authModule.name).toBe('auth');
    });

    it('should have correct version', () => {
      expect(authModule.version).toBe('1.0.0');
    });

    it('should provide auth services', () => {
      expect(authModule.provides).toEqual(['auth']);
    });

    it('should depend on required modules', () => {
      expect(authModule.depends).toEqual(['core', 'crypto', 'database']);
    });

    it('should have correct description', () => {
      expect(authModule.description).toBe('Authentication and authorization module for Web-Buddy platform');
    });
  });

  describe('module configuration', () => {
    it('should have default configuration', () => {
      const config = authModule.config;
      
      expect(config.jwt.secret).toBe(process.env.JWT_SECRET || 'default-secret-change-in-production');
      expect(config.jwt.expiresIn).toBe('15m');
      expect(config.jwt.refreshExpiresIn).toBe('7d');
      expect(config.bcrypt.rounds).toBe(10);
      expect(config.oauth2.providers).toEqual(['google', 'github', 'microsoft']);
      expect(config.rateLimit.maxAttempts).toBe(5);
      expect(config.rateLimit.windowMs).toBe(900000); // 15 minutes
      expect(config.session.secure).toBe(process.env.NODE_ENV === 'production');
      expect(config.session.sameSite).toBe('strict');
    });

    it('should use JWT_SECRET from environment', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'test-secret';
      
      const module = new AuthModule();
      expect(module.config.jwt.secret).toBe('test-secret');
      
      // Restore
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    });

    it('should set secure session in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const module = new AuthModule();
      expect(module.config.session.secure).toBe(true);
      
      // Restore
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });

  describe('module lifecycle', () => {
    it('should initialize auth service on init', async () => {
      const { AuthService } = require('../auth-service');
      
      await authModule.onInit(mockApp);
      
      expect(AuthService).toHaveBeenCalled();
      expect(authModule['authService']).toBeDefined();
    });

    it('should start auth service', async () => {
      authModule['authService'] = {
        start: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      await authModule.onStart();
      
      expect(authModule['authService'].start).toHaveBeenCalled();
    });

    it('should handle missing auth service on start', async () => {
      authModule['authService'] = undefined;
      
      // Should not throw
      await expect(authModule.onStart()).resolves.toBeUndefined();
    });

    it('should stop auth service', async () => {
      authModule['authService'] = {
        stop: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      await authModule.onStop();
      
      expect(authModule['authService'].stop).toHaveBeenCalled();
    });

    it('should handle missing auth service on stop', async () => {
      authModule['authService'] = undefined;
      
      // Should not throw
      await expect(authModule.onStop()).resolves.toBeUndefined();
    });

    it('should cleanup resources on destroy', async () => {
      authModule['authService'] = {
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      authModule['configWatcher'] = {
        close: jest.fn()
      } as any;
      
      await authModule.onDestroy();
      
      expect(authModule['authService'].cleanup).toHaveBeenCalled();
      expect(authModule['configWatcher'].close).toHaveBeenCalled();
    });

    it('should handle missing resources on destroy', async () => {
      authModule['authService'] = undefined;
      authModule['configWatcher'] = undefined;
      
      // Should not throw
      await expect(authModule.onDestroy()).resolves.toBeUndefined();
    });
  });

  describe('auth service methods', () => {
    beforeEach(async () => {
      authModule['authService'] = {
        authenticate: jest.fn().mockResolvedValue({ token: 'test-token' }),
        authorize: jest.fn().mockResolvedValue(true),
        refreshToken: jest.fn().mockResolvedValue({ token: 'new-token' }),
        logout: jest.fn().mockResolvedValue(undefined),
        register: jest.fn().mockResolvedValue({ userId: 'test-user' }),
        validateToken: jest.fn().mockResolvedValue({ valid: true }),
        revokeToken: jest.fn().mockResolvedValue(undefined),
        getUser: jest.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' })
      } as any;
    });

    it('should authenticate user', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const result = await authModule.authenticate(credentials);
      
      expect(authModule['authService'].authenticate).toHaveBeenCalledWith(credentials);
      expect(result).toEqual({ token: 'test-token' });
    });

    it('should authorize user', async () => {
      const token = 'test-token';
      const resource = '/api/users';
      const action = 'read';
      
      const result = await authModule.authorize(token, resource, action);
      
      expect(authModule['authService'].authorize).toHaveBeenCalledWith(token, resource, action);
      expect(result).toBe(true);
    });

    it('should refresh token', async () => {
      const refreshToken = 'refresh-token';
      const result = await authModule.refreshToken(refreshToken);
      
      expect(authModule['authService'].refreshToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({ token: 'new-token' });
    });

    it('should logout user', async () => {
      const token = 'test-token';
      await authModule.logout(token);
      
      expect(authModule['authService'].logout).toHaveBeenCalledWith(token);
    });

    it('should register user', async () => {
      const userData = { email: 'test@example.com', password: 'password' };
      const result = await authModule.register(userData);
      
      expect(authModule['authService'].register).toHaveBeenCalledWith(userData);
      expect(result).toEqual({ userId: 'test-user' });
    });

    it('should validate token', async () => {
      const token = 'test-token';
      const result = await authModule.validateToken(token);
      
      expect(authModule['authService'].validateToken).toHaveBeenCalledWith(token);
      expect(result).toEqual({ valid: true });
    });

    it('should revoke token', async () => {
      const token = 'test-token';
      await authModule.revokeToken(token);
      
      expect(authModule['authService'].revokeToken).toHaveBeenCalledWith(token);
    });

    it('should get user', async () => {
      const userId = 'test-user';
      const result = await authModule.getUser(userId);
      
      expect(authModule['authService'].getUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ id: 'test-user', email: 'test@example.com' });
    });

    it('should throw error when auth service not initialized', async () => {
      authModule['authService'] = undefined;
      
      await expect(authModule.authenticate({ email: 'test', password: 'test' }))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.authorize('token', 'resource', 'action'))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.refreshToken('token'))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.logout('token'))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.register({ email: 'test', password: 'test' }))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.validateToken('token'))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.revokeToken('token'))
        .rejects.toThrow('Auth service not initialized');
      await expect(authModule.getUser('userId'))
        .rejects.toThrow('Auth service not initialized');
    });
  });

  describe('configuration updates', () => {
    it('should update JWT configuration', () => {
      const newConfig = {
        secret: 'new-secret',
        expiresIn: '30m'
      };
      
      authModule.updateJwtConfig(newConfig);
      
      expect(authModule.config.jwt.secret).toBe('new-secret');
      expect(authModule.config.jwt.expiresIn).toBe('30m');
    });

    it('should update rate limit configuration', () => {
      const newConfig = {
        maxAttempts: 10,
        windowMs: 600000
      };
      
      authModule.updateRateLimitConfig(newConfig);
      
      expect(authModule.config.rateLimit.maxAttempts).toBe(10);
      expect(authModule.config.rateLimit.windowMs).toBe(600000);
    });

    it('should get current configuration', () => {
      const config = authModule.getConfig();
      
      expect(config).toEqual(authModule.config);
      expect(config).not.toBe(authModule.config); // Should be a copy
    });
  });

  describe('event handling', () => {
    it('should handle configuration change events', async () => {
      await authModule.onInit(mockApp);
      
      // Find the config change handler
      const configHandler = mockApp.on.mock.calls.find(
        call => call[0] === 'config:changed'
      );
      
      expect(configHandler).toBeDefined();
      
      // Test the handler
      if (configHandler) {
        const handler = configHandler[1];
        const event = {
          module: 'auth',
          config: {
            jwt: { expiresIn: '1h' }
          }
        };
        
        handler(event);
        
        expect(authModule.config.jwt.expiresIn).toBe('1h');
      }
    });

    it('should ignore config changes for other modules', async () => {
      await authModule.onInit(mockApp);
      
      const configHandler = mockApp.on.mock.calls.find(
        call => call[0] === 'config:changed'
      )[1];
      
      const originalConfig = { ...authModule.config };
      
      configHandler({
        module: 'other-module',
        config: { jwt: { expiresIn: '1h' } }
      });
      
      expect(authModule.config).toEqual(originalConfig);
    });
  });

  describe('health check', () => {
    it('should report healthy when service is running', async () => {
      authModule['authService'] = {
        isHealthy: jest.fn().mockResolvedValue(true)
      } as any;
      
      const health = await authModule.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.service).toBe('auth');
    });

    it('should report unhealthy when service is not running', async () => {
      authModule['authService'] = {
        isHealthy: jest.fn().mockResolvedValue(false)
      } as any;
      
      const health = await authModule.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.service).toBe('auth');
    });

    it('should report unhealthy when service is not initialized', async () => {
      authModule['authService'] = undefined;
      
      const health = await authModule.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.service).toBe('auth');
      expect(health.error).toBe('Service not initialized');
    });
  });
});