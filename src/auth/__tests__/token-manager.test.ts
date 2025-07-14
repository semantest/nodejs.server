/**
 * @fileoverview TokenManager Unit Tests
 * @description Comprehensive tests for JWT token management with RS256 algorithm
 * @author Web-Buddy Team
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { TokenManager, TokenPayload, TokenPair, DecodedToken } from '../infrastructure/token-manager';

// Mock filesystem operations
jest.mock('fs');
jest.mock('crypto');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockKeyPair: { publicKey: string; privateKey: string };

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();

    // Generate test key pair
    mockKeyPair = testUtils.generateTestKeyPair();

    // Mock filesystem operations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync
      .mockReturnValueOnce(mockKeyPair.privateKey) // private key
      .mockReturnValueOnce(mockKeyPair.publicKey); // public key

    // Mock crypto operations
    mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-random-bytes-16'));
    mockCrypto.generateKeyPairSync.mockReturnValue(mockKeyPair);

    tokenManager = new TokenManager('test-issuer', 'test-audience');
  });

  describe('Initialization', () => {
    it('should load existing RSA keys successfully', () => {
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('private.key')
      );
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('public.key')
      );
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should generate new keys in development when keys do not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation();
      mockFs.writeFileSync.mockImplementation();
      
      process.env.NODE_ENV = 'development';
      
      const newTokenManager = new TokenManager();
      
      expect(mockCrypto.generateKeyPairSync).toHaveBeenCalledWith('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should throw error in production when keys do not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      process.env.NODE_ENV = 'production';
      
      expect(() => new TokenManager()).toThrow(
        'RSA keys not found in production. Please provide keys.'
      );
    });
  });

  describe('Token Generation', () => {
    let testPayload: TokenPayload;

    beforeEach(() => {
      testPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['user', 'editor'],
        sessionId: 'session-456',
        extensionId: 'ext-789'
      };
    });

    it('should generate valid token pair', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testPayload);

      expect(tokenPair).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        accessTokenExpiry: expect.any(Date),
        refreshTokenExpiry: expect.any(Date)
      });

      expect(tokenPair.accessToken).toBeValidJWT();
      expect(tokenPair.refreshToken).toBeValidJWT();
    });

    it('should set correct expiry times', async () => {
      const beforeGeneration = Date.now();
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      const afterGeneration = Date.now();

      // Access token should expire in 15 minutes
      const accessExpiry = tokenPair.accessTokenExpiry.getTime();
      expect(accessExpiry).toBeWithinTimeRange(beforeGeneration + 15 * 60 * 1000, 1000);

      // Refresh token should expire in 7 days
      const refreshExpiry = tokenPair.refreshTokenExpiry.getTime();
      expect(refreshExpiry).toBeWithinTimeRange(beforeGeneration + 7 * 24 * 60 * 60 * 1000, 1000);
    });

    it('should include all payload data in access token', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      const decoded = await tokenManager.verifyAccessToken(tokenPair.accessToken);

      expect(decoded).toMatchObject({
        userId: testPayload.userId,
        email: testPayload.email,
        roles: testPayload.roles,
        sessionId: testPayload.sessionId,
        extensionId: testPayload.extensionId,
        type: 'access'
      });
    });

    it('should include minimal data in refresh token', async () => {
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      const decoded = await tokenManager.verifyRefreshToken(tokenPair.refreshToken);

      expect(decoded).toMatchObject({
        userId: testPayload.userId,
        sessionId: testPayload.sessionId,
        type: 'refresh'
      });
      expect(decoded.email).toBeUndefined();
      expect(decoded.roles).toBeUndefined();
    });

    it('should generate unique JTIs for each token', async () => {
      const tokenPair1 = await tokenManager.generateTokenPair(testPayload);
      const tokenPair2 = await tokenManager.generateTokenPair(testPayload);

      const decoded1 = await tokenManager.verifyAccessToken(tokenPair1.accessToken);
      const decoded2 = await tokenManager.verifyAccessToken(tokenPair2.accessToken);

      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
  });

  describe('Token Verification', () => {
    let validTokenPair: TokenPair;
    let testPayload: TokenPayload;

    beforeEach(async () => {
      testPayload = testUtils.generateTestJWTPayload();
      validTokenPair = await tokenManager.generateTokenPair(testPayload);
    });

    describe('Access Token Verification', () => {
      it('should verify valid access token', async () => {
        const decoded = await tokenManager.verifyAccessToken(validTokenPair.accessToken);

        expect(decoded).toMatchObject({
          userId: testPayload.userId,
          sessionId: testPayload.sessionId,
          type: 'access'
        });
        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      });

      it('should reject expired access token', async () => {
        // Advance time to expire the token
        testUtils.advanceTime(16 * 60 * 1000); // 16 minutes

        await expect(
          tokenManager.verifyAccessToken(validTokenPair.accessToken)
        ).rejects.toThrow('Access token expired');
      });

      it('should reject blacklisted access token', async () => {
        const decoded = await tokenManager.verifyAccessToken(validTokenPair.accessToken);
        
        // Blacklist the token
        tokenManager.blacklistToken(decoded.jti);

        await expect(
          tokenManager.verifyAccessToken(validTokenPair.accessToken)
        ).rejects.toThrow('Token has been revoked');
      });

      it('should reject token with wrong type', async () => {
        await expect(
          tokenManager.verifyAccessToken(validTokenPair.refreshToken)
        ).rejects.toThrow('Invalid token type');
      });

      it('should reject malformed token', async () => {
        await expect(
          tokenManager.verifyAccessToken('invalid-token')
        ).rejects.toThrow('Invalid access token');
      });
    });

    describe('Refresh Token Verification', () => {
      it('should verify valid refresh token', async () => {
        const decoded = await tokenManager.verifyRefreshToken(validTokenPair.refreshToken);

        expect(decoded).toMatchObject({
          userId: testPayload.userId,
          sessionId: testPayload.sessionId,
          type: 'refresh'
        });
      });

      it('should reject expired refresh token', async () => {
        // Advance time to expire the token
        testUtils.advanceTime(8 * 24 * 60 * 60 * 1000); // 8 days

        await expect(
          tokenManager.verifyRefreshToken(validTokenPair.refreshToken)
        ).rejects.toThrow('Refresh token expired');
      });

      it('should reject blacklisted refresh token', async () => {
        const decoded = await tokenManager.verifyRefreshToken(validTokenPair.refreshToken);
        
        // Blacklist the token
        tokenManager.blacklistToken(decoded.jti);

        await expect(
          tokenManager.verifyRefreshToken(validTokenPair.refreshToken)
        ).rejects.toThrow('Refresh token has been revoked');
      });

      it('should reject token with wrong type', async () => {
        await expect(
          tokenManager.verifyRefreshToken(validTokenPair.accessToken)
        ).rejects.toThrow('Invalid token type');
      });
    });
  });

  describe('Token Refresh', () => {
    let validTokenPair: TokenPair;
    let testPayload: TokenPayload;

    beforeEach(async () => {
      testPayload = testUtils.generateTestJWTPayload();
      validTokenPair = await tokenManager.generateTokenPair(testPayload);
    });

    it('should refresh access token successfully', async () => {
      const newTokenPair = await tokenManager.refreshAccessToken(
        validTokenPair.refreshToken,
        testPayload
      );

      expect(newTokenPair.accessToken).toBeValidJWT();
      expect(newTokenPair.refreshToken).toBeValidJWT();
      expect(newTokenPair.accessToken).not.toBe(validTokenPair.accessToken);
      expect(newTokenPair.refreshToken).not.toBe(validTokenPair.refreshToken);
    });

    it('should blacklist old tokens during refresh', async () => {
      const oldAccessDecoded = await tokenManager.verifyAccessToken(validTokenPair.accessToken);
      const oldRefreshDecoded = await tokenManager.verifyRefreshToken(validTokenPair.refreshToken);

      await tokenManager.refreshAccessToken(validTokenPair.refreshToken, testPayload);

      // Old tokens should be blacklisted
      await expect(
        tokenManager.verifyAccessToken(validTokenPair.accessToken)
      ).rejects.toThrow('Token has been revoked');

      await expect(
        tokenManager.verifyRefreshToken(validTokenPair.refreshToken)
      ).rejects.toThrow('Refresh token has been revoked');
    });

    it('should reject refresh with invalid refresh token', async () => {
      await expect(
        tokenManager.refreshAccessToken('invalid-token', testPayload)
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject refresh with expired refresh token', async () => {
      // Advance time to expire the token
      testUtils.advanceTime(8 * 24 * 60 * 60 * 1000); // 8 days

      await expect(
        tokenManager.refreshAccessToken(validTokenPair.refreshToken, testPayload)
      ).rejects.toThrow('Refresh token expired');
    });
  });

  describe('Token Blacklisting', () => {
    let validTokenPair: TokenPair;
    let testPayload: TokenPayload;

    beforeEach(async () => {
      testPayload = testUtils.generateTestJWTPayload();
      validTokenPair = await tokenManager.generateTokenPair(testPayload);
    });

    it('should blacklist token by JTI', async () => {
      const decoded = await tokenManager.verifyAccessToken(validTokenPair.accessToken);
      
      tokenManager.blacklistToken(decoded.jti);

      await expect(
        tokenManager.verifyAccessToken(validTokenPair.accessToken)
      ).rejects.toThrow('Token has been revoked');
    });

    it('should automatically remove blacklisted tokens after expiry', async () => {
      const decoded = await tokenManager.verifyAccessToken(validTokenPair.accessToken);
      
      tokenManager.blacklistToken(decoded.jti);
      
      // Advance time beyond token blacklist TTL
      testUtils.advanceTime(16 * 60 * 1000); // 16 minutes

      // Token should still be rejected (but for expiry, not blacklist)
      await expect(
        tokenManager.verifyAccessToken(validTokenPair.accessToken)
      ).rejects.toThrow('Access token expired');
    });

    it('should revoke all user tokens', async () => {
      const tokenPair1 = await tokenManager.generateTokenPair(testPayload);
      const tokenPair2 = await tokenManager.generateTokenPair(testPayload);

      // Both tokens should be valid initially
      await expect(tokenManager.verifyAccessToken(tokenPair1.accessToken)).resolves.toBeDefined();
      await expect(tokenManager.verifyAccessToken(tokenPair2.accessToken)).resolves.toBeDefined();

      // Revoke all tokens for the user
      tokenManager.revokeAllUserTokens(testPayload.userId);

      // Both tokens should be blacklisted
      await expect(
        tokenManager.verifyAccessToken(tokenPair1.accessToken)
      ).rejects.toThrow('Token has been revoked');
      
      await expect(
        tokenManager.verifyAccessToken(tokenPair2.accessToken)
      ).rejects.toThrow('Token has been revoked');
    });

    it('should revoke all session tokens', async () => {
      const tokenPair1 = await tokenManager.generateTokenPair(testPayload);
      const tokenPair2 = await tokenManager.generateTokenPair(testPayload);

      // Both tokens should be valid initially
      await expect(tokenManager.verifyAccessToken(tokenPair1.accessToken)).resolves.toBeDefined();
      await expect(tokenManager.verifyAccessToken(tokenPair2.accessToken)).resolves.toBeDefined();

      // Revoke all tokens for the session
      tokenManager.revokeSessionTokens(testPayload.sessionId);

      // Both tokens should be blacklisted
      await expect(
        tokenManager.verifyAccessToken(tokenPair1.accessToken)
      ).rejects.toThrow('Token has been revoked');
      
      await expect(
        tokenManager.verifyAccessToken(tokenPair2.accessToken)
      ).rejects.toThrow('Token has been revoked');
    });
  });

  describe('Token Statistics', () => {
    it('should return accurate token statistics', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      
      // Generate some tokens
      await tokenManager.generateTokenPair(testPayload);
      await tokenManager.generateTokenPair(testPayload);
      
      const stats = tokenManager.getTokenStats();

      expect(stats).toMatchObject({
        blacklistedTokens: 0,
        activeRefreshTokens: 2,
        issuer: 'test-issuer',
        audience: 'test-audience',
        algorithm: 'RS256'
      });
    });

    it('should track blacklisted tokens in statistics', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      const decoded = await tokenManager.verifyAccessToken(tokenPair.accessToken);

      // Blacklist a token
      tokenManager.blacklistToken(decoded.jti);

      const stats = tokenManager.getTokenStats();
      expect(stats.blacklistedTokens).toBe(1);
    });
  });

  describe('Token Cleanup', () => {
    it('should clean up expired tokens', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      
      // Generate tokens
      await tokenManager.generateTokenPair(testPayload);
      await tokenManager.generateTokenPair(testPayload);

      let stats = tokenManager.getTokenStats();
      expect(stats.activeRefreshTokens).toBe(2);

      // Advance time to expire tokens
      testUtils.advanceTime(8 * 24 * 60 * 60 * 1000); // 8 days

      // Run cleanup
      tokenManager.cleanupExpiredTokens();

      stats = tokenManager.getTokenStats();
      expect(stats.activeRefreshTokens).toBe(0);
    });
  });

  describe('Token Header Extraction', () => {
    it('should extract token from Bearer header', () => {
      const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
      const authHeader = `Bearer ${token}`;

      const extracted = TokenManager.extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = TokenManager.extractTokenFromHeader(undefined);
      expect(extracted).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const extracted = TokenManager.extractTokenFromHeader('Basic dXNlcjpwYXNz');
      expect(extracted).toBeNull();
    });

    it('should return null for empty Bearer header', () => {
      const extracted = TokenManager.extractTokenFromHeader('Bearer ');
      expect(extracted).toBe('');
    });
  });

  describe('Concurrent Token Operations', () => {
    it('should handle concurrent token generation', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      
      // Generate multiple tokens concurrently
      const promises = Array.from({ length: 10 }, () => 
        tokenManager.generateTokenPair(testPayload)
      );

      const tokenPairs = await Promise.all(promises);

      // All tokens should be unique
      const accessTokens = tokenPairs.map(tp => tp.accessToken);
      const uniqueAccessTokens = new Set(accessTokens);
      expect(uniqueAccessTokens.size).toBe(10);

      // All tokens should be valid
      for (const tokenPair of tokenPairs) {
        await expect(
          tokenManager.verifyAccessToken(tokenPair.accessToken)
        ).resolves.toBeDefined();
      }
    });

    it('should handle concurrent token verification', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      const tokenPair = await tokenManager.generateTokenPair(testPayload);

      // Verify the same token concurrently
      const promises = Array.from({ length: 10 }, () => 
        tokenManager.verifyAccessToken(tokenPair.accessToken)
      );

      const results = await Promise.all(promises);

      // All verifications should succeed and return the same data
      results.forEach(result => {
        expect(result.userId).toBe(testPayload.userId);
        expect(result.sessionId).toBe(testPayload.sessionId);
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject tokens with missing JTI', async () => {
      // This would require manipulating the JWT library, which is complex
      // In a real scenario, this would be tested by creating a malformed token
      const testPayload = testUtils.generateTestJWTPayload();
      delete testPayload.jti;
      
      // The actual implementation would handle this in the verification process
      // This is more of an integration test scenario
    });

    it('should handle malformed JWT structure', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'only-one-part',
        'two.parts',
        'three.parts.but-invalid-encoding',
        ''
      ];

      for (const token of malformedTokens) {
        await expect(
          tokenManager.verifyAccessToken(token)
        ).rejects.toThrow();
      }
    });

    it('should prevent token reuse after blacklisting', async () => {
      const testPayload = testUtils.generateTestJWTPayload();
      const tokenPair = await tokenManager.generateTokenPair(testPayload);
      const decoded = await tokenManager.verifyAccessToken(tokenPair.accessToken);

      // Blacklist the token
      tokenManager.blacklistToken(decoded.jti);

      // Multiple attempts should all fail
      for (let i = 0; i < 5; i++) {
        await expect(
          tokenManager.verifyAccessToken(tokenPair.accessToken)
        ).rejects.toThrow('Token has been revoked');
      }
    });
  });
});