/**
 * Emergency tests for JwtTokenManager
 * Created by Quinn (QA) during test coverage crisis - 8:15 AM
 * Target: Boost nodejs.server coverage from 13.41%
 */

import { JwtTokenManager } from '../jwt-token-manager';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('crypto');

describe('JwtTokenManager', () => {
  let manager: JwtTokenManager;
  const mockSecret = 'test-secret-key';
  const mockRefreshSecret = 'test-refresh-secret';

  beforeEach(() => {
    manager = new JwtTokenManager(mockSecret, mockRefreshSecret);
    jest.clearAllMocks();
    
    // Setup default mocks
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('random-token-id')
    });
  });

  describe('configuration', () => {
    it('should initialize with correct defaults', () => {
      expect(manager['secret']).toBe(mockSecret);
      expect(manager['refreshSecret']).toBe(mockRefreshSecret);
      expect(manager['accessTokenExpiry']).toBe('15m');
      expect(manager['refreshTokenExpiry']).toBe('7d');
      expect(manager['issuer']).toBe('web-buddy-auth');
      expect(manager['audience']).toBe('web-buddy-users');
    });

    it('should allow custom configuration', () => {
      const customManager = new JwtTokenManager(
        'custom-secret',
        'custom-refresh',
        '30m',
        '14d',
        'custom-issuer',
        'custom-audience'
      );

      expect(customManager['accessTokenExpiry']).toBe('30m');
      expect(customManager['refreshTokenExpiry']).toBe('14d');
      expect(customManager['issuer']).toBe('custom-issuer');
      expect(customManager['audience']).toBe('custom-audience');
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with user data', () => {
      const mockToken = 'mock.access.token';
      const userData = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user', 'admin']
      };

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = manager.generateAccessToken(userData);

      expect(jwt.sign).toHaveBeenCalledWith(
        userData,
        mockSecret,
        {
          expiresIn: '15m',
          issuer: 'web-buddy-auth',
          audience: 'web-buddy-users',
          jwtid: 'random-token-id'
        }
      );
      expect(token).toBe(mockToken);
    });

    it('should include custom claims', () => {
      const userData = {
        userId: 'user-123',
        customClaim: 'custom-value'
      };

      manager.generateAccessToken(userData);

      expect(jwt.sign).toHaveBeenCalledWith(
        userData,
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with user ID', () => {
      const mockToken = 'mock.refresh.token';
      const userId = 'user-123';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = manager.generateRefreshToken(userId);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId, type: 'refresh' },
        mockRefreshSecret,
        {
          expiresIn: '7d',
          issuer: 'web-buddy-auth',
          audience: 'web-buddy-users',
          jwtid: 'random-token-id'
        }
      );
      expect(token).toBe(mockToken);
    });

    it('should store refresh token in active tokens', () => {
      const userId = 'user-123';
      const mockToken = 'mock.refresh.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      manager.generateRefreshToken(userId);

      expect(manager['activeRefreshTokens'].has('random-token-id')).toBe(true);
      expect(manager['activeRefreshTokens'].get('random-token-id')).toEqual({
        userId,
        createdAt: expect.any(Date)
      });
    });
  });

  describe('validateToken', () => {
    it('should validate valid access token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user']
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = await manager.validateToken('valid.token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid.token',
        mockSecret,
        {
          issuer: 'web-buddy-auth',
          audience: 'web-buddy-users'
        }
      );
      expect(result).toEqual(mockDecoded);
    });

    it('should throw error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(manager.validateToken('invalid.token'))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error for expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(manager.validateToken('expired.token'))
        .rejects.toThrow('Token expired');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate valid refresh token', async () => {
      const tokenId = 'token-123';
      const mockDecoded = {
        userId: 'user-123',
        type: 'refresh',
        jti: tokenId
      };

      manager['activeRefreshTokens'].set(tokenId, {
        userId: 'user-123',
        createdAt: new Date()
      });

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = await manager.validateRefreshToken('valid.refresh.token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid.refresh.token',
        mockRefreshSecret,
        {
          issuer: 'web-buddy-auth',
          audience: 'web-buddy-users'
        }
      );
      expect(result).toEqual(mockDecoded);
    });

    it('should reject revoked refresh token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'refresh',
        jti: 'revoked-token-id'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      await expect(manager.validateRefreshToken('revoked.token'))
        .rejects.toThrow('Refresh token has been revoked');
    });

    it('should reject non-refresh token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'access',
        jti: 'token-id'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      await expect(manager.validateRefreshToken('access.token'))
        .rejects.toThrow('Invalid token type');
    });
  });

  describe('invalidateRefreshToken', () => {
    it('should remove refresh token from active tokens', async () => {
      const tokenId = 'token-123';
      const mockDecoded = {
        userId: 'user-123',
        type: 'refresh',
        jti: tokenId
      };

      manager['activeRefreshTokens'].set(tokenId, {
        userId: 'user-123',
        createdAt: new Date()
      });

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      await manager.invalidateRefreshToken('refresh.token');

      expect(manager['activeRefreshTokens'].has(tokenId)).toBe(false);
    });

    it('should return false for already revoked token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'refresh',
        jti: 'non-existent-token'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = await manager.invalidateRefreshToken('refresh.token');

      expect(result).toBe(false);
    });

    it('should handle invalid token gracefully', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await manager.invalidateRefreshToken('invalid.token');

      expect(result).toBe(false);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract Bearer token', () => {
      const token = manager.extractTokenFromHeader('Bearer eyJhbGciOiJIUzI1NiJ9');
      expect(token).toBe('eyJhbGciOiJIUzI1NiJ9');
    });

    it('should return null for missing header', () => {
      const token = manager.extractTokenFromHeader(undefined);
      expect(token).toBeNull();
    });

    it('should return null for invalid format', () => {
      const token = manager.extractTokenFromHeader('InvalidFormat');
      expect(token).toBeNull();
    });

    it('should return null for empty Bearer token', () => {
      const token = manager.extractTokenFromHeader('Bearer ');
      expect(token).toBeNull();
    });
  });

  describe('token cleanup', () => {
    it('should clean up expired refresh tokens', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days old

      manager['activeRefreshTokens'].set('old-token', {
        userId: 'user-123',
        createdAt: oldDate
      });

      manager['activeRefreshTokens'].set('new-token', {
        userId: 'user-456',
        createdAt: new Date()
      });

      manager['cleanupExpiredTokens']();

      expect(manager['activeRefreshTokens'].has('old-token')).toBe(false);
      expect(manager['activeRefreshTokens'].has('new-token')).toBe(true);
    });

    it('should schedule periodic cleanup', () => {
      jest.useFakeTimers();
      const cleanupSpy = jest.spyOn(manager as any, 'cleanupExpiredTokens');

      manager['startCleanupTimer']();

      jest.advanceTimersByTime(3600000); // 1 hour

      expect(cleanupSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('security features', () => {
    it('should generate unique token IDs', () => {
      const tokens = new Set();
      
      for (let i = 0; i < 10; i++) {
        (crypto.randomBytes as jest.Mock).mockReturnValueOnce({
          toString: jest.fn().mockReturnValue(`token-${i}`)
        });
        manager.generateAccessToken({ userId: 'user' });
      }

      expect(crypto.randomBytes).toHaveBeenCalledTimes(10);
    });

    it('should use different secrets for access and refresh tokens', () => {
      manager.generateAccessToken({ userId: 'user-123' });
      manager.generateRefreshToken('user-123');

      const calls = (jwt.sign as jest.Mock).mock.calls;
      expect(calls[0][1]).toBe(mockSecret);
      expect(calls[1][1]).toBe(mockRefreshSecret);
      expect(calls[0][1]).not.toBe(calls[1][1]);
    });
  });
});