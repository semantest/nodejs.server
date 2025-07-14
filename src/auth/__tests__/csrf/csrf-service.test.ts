/**
 * @fileoverview CSRF Service Unit Tests
 * @description Comprehensive tests for CSRF protection with double-submit cookie pattern
 * @author Web-Buddy Team
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { CSRFService, CSRFConfig, CSRFTokenData } from '../../infrastructure/csrf-service';

// Mock crypto module
jest.mock('crypto');

const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('CSRFService', () => {
  let csrfService: CSRFService;
  let config: Partial<CSRFConfig>;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();

    // Setup crypto mocks
    mockCrypto.randomBytes.mockReturnValue(Buffer.from('mockrandomhexstring12345678901234567890'));
    mockCrypto.createHmac.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mockedsignature')
    } as any);

    // Custom config for testing
    config = {
      cookieName: 'test-csrf-token',
      headerName: 'X-Test-CSRF-Token',
      tokenLength: 16,
      tokenExpiry: 60000, // 1 minute for testing
      secureCookie: false,
      sameSite: 'lax',
      httpOnly: false
    };

    // Clear environment variable for testing
    delete process.env.CSRF_SECRET;

    csrfService = new CSRFService(config);

    // Setup mock request and response
    req = testUtils.createMockRequest();
    res = testUtils.createMockResponse();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new CSRFService();
      const serviceConfig = defaultService.getConfig();

      expect(serviceConfig).toMatchObject({
        cookieName: 'csrf-token',
        headerName: 'X-CSRF-Token',
        tokenLength: 32,
        tokenExpiry: 3600000, // 1 hour
        secureCookie: false, // Since not in production
        sameSite: 'lax',
        httpOnly: false
      });
    });

    it('should initialize with custom configuration', () => {
      const serviceConfig = csrfService.getConfig();

      expect(serviceConfig).toMatchObject(config);
    });

    it('should use production security settings in production', () => {
      process.env.NODE_ENV = 'production';
      const prodService = new CSRFService();
      const serviceConfig = prodService.getConfig();

      expect(serviceConfig.secureCookie).toBe(true);
    });

    it('should use environment CSRF secret if provided', () => {
      process.env.CSRF_SECRET = 'test-environment-secret';
      const serviceWithEnvSecret = new CSRFService();
      
      // Service should initialize without error
      expect(serviceWithEnvSecret).toBeDefined();
    });
  });

  describe('Token Generation', () => {
    it('should generate valid CSRF token', () => {
      const tokenData = csrfService.generateToken('session-123', 'user-456');

      expect(tokenData).toMatchObject({
        token: expect.any(String),
        createdAt: expect.any(Date),
        sessionId: 'session-123',
        userId: 'user-456'
      });

      expect(tokenData.token).toBeValidCSRFToken();
    });

    it('should generate unique tokens', () => {
      const token1 = csrfService.generateToken();
      const token2 = csrfService.generateToken();

      expect(token1.token).not.toBe(token2.token);
    });

    it('should generate tokens with correct format', () => {
      const tokenData = csrfService.generateToken();
      
      // Token should be in format: randomBytes.timestamp.signature
      const parts = tokenData.token.split('.');
      expect(parts).toHaveLength(3);
      
      // First part should be hex (random bytes)
      expect(parts[0]).toMatch(/^[a-f0-9]+$/);
      
      // Second part should be timestamp
      expect(parseInt(parts[1])).toBeWithinTimeRange(Date.now(), 1000);
      
      // Third part should be signature
      expect(parts[2]).toMatch(/^[a-f0-9]+$/);
    });

    it('should store token data internally', () => {
      const tokenData = csrfService.generateToken('session-123');
      const stats = csrfService.getTokenStats();

      expect(stats.totalTokens).toBe(1);
      expect(stats.activeTokens).toBe(1);
    });
  });

  describe('Token Validation', () => {
    let validToken: string;
    let sessionId: string;
    let userId: string;

    beforeEach(() => {
      sessionId = 'session-123';
      userId = 'user-456';
      const tokenData = csrfService.generateToken(sessionId, userId);
      validToken = tokenData.token;
    });

    it('should validate matching tokens (double-submit pattern)', () => {
      const isValid = csrfService.validateToken(validToken, validToken, sessionId, userId);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      const anotherToken = csrfService.generateToken().token;
      const isValid = csrfService.validateToken(validToken, anotherToken, sessionId, userId);
      expect(isValid).toBe(false);
    });

    it('should reject missing header token', () => {
      const isValid = csrfService.validateToken(undefined, validToken, sessionId, userId);
      expect(isValid).toBe(false);
    });

    it('should reject missing cookie token', () => {
      const isValid = csrfService.validateToken(validToken, undefined, sessionId, userId);
      expect(isValid).toBe(false);
    });

    it('should reject non-existent token', () => {
      const fakeToken = 'fake-token-123.1640995200000.signature';
      const isValid = csrfService.validateToken(fakeToken, fakeToken, sessionId, userId);
      expect(isValid).toBe(false);
    });

    it('should reject expired token', () => {
      // Advance time beyond token expiry
      testUtils.advanceTime(config.tokenExpiry! + 1000);

      const isValid = csrfService.validateToken(validToken, validToken, sessionId, userId);
      expect(isValid).toBe(false);
    });

    it('should reject token with wrong session', () => {
      const isValid = csrfService.validateToken(validToken, validToken, 'wrong-session', userId);
      expect(isValid).toBe(false);
    });

    it('should reject token with wrong user', () => {
      const isValid = csrfService.validateToken(validToken, validToken, sessionId, 'wrong-user');
      expect(isValid).toBe(false);
    });

    it('should validate token without session/user binding when not provided', () => {
      const unboundToken = csrfService.generateToken().token;
      const isValid = csrfService.validateToken(unboundToken, unboundToken);
      expect(isValid).toBe(true);
    });

    it('should validate token with partial binding', () => {
      const sessionBoundToken = csrfService.generateToken(sessionId).token;
      
      // Should validate with session but no user
      expect(csrfService.validateToken(sessionBoundToken, sessionBoundToken, sessionId)).toBe(true);
      
      // Should validate without any binding info
      expect(csrfService.validateToken(sessionBoundToken, sessionBoundToken)).toBe(true);
    });

    it('should handle validation errors gracefully', () => {
      // Mock console.error to capture error logs
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an error by making crypto throw
      mockCrypto.createHmac.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      const isValid = csrfService.validateToken(validToken, validToken);
      expect(isValid).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Cookie Management', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = csrfService.generateToken().token;
    });

    it('should set CSRF token cookie with correct options', () => {
      csrfService.setCookie(res as Response, validToken);

      expect(res.cookie).toHaveBeenCalledWith(config.cookieName, validToken, {
        httpOnly: config.httpOnly,
        secure: config.secureCookie,
        sameSite: config.sameSite,
        maxAge: config.tokenExpiry,
        path: '/'
      });
    });

    it('should get token from request header', () => {
      req.headers = { [config.headerName!.toLowerCase()]: validToken };

      const token = csrfService.getTokenFromHeader(req as Request);
      expect(token).toBe(validToken);
    });

    it('should get token from request cookie', () => {
      req.cookies = { [config.cookieName!]: validToken };

      const token = csrfService.getTokenFromCookie(req as Request);
      expect(token).toBe(validToken);
    });

    it('should clear CSRF token cookie', () => {
      csrfService.clearCookie(res as Response);

      expect(res.clearCookie).toHaveBeenCalledWith(config.cookieName, {
        path: '/',
        secure: config.secureCookie,
        sameSite: config.sameSite
      });
    });
  });

  describe('Token Generation and Setting', () => {
    it('should generate and set new token', () => {
      const token = csrfService.generateAndSetToken(req as Request, res as Response, 'session-123', 'user-456');

      expect(token).toBeValidCSRFToken();
      expect(res.cookie).toHaveBeenCalledWith(
        config.cookieName,
        token,
        expect.objectContaining({
          maxAge: config.tokenExpiry
        })
      );
    });

    it('should reuse existing valid token', () => {
      const existingToken = csrfService.generateToken('session-123', 'user-456').token;
      req.cookies = { [config.cookieName!]: existingToken };

      const token = csrfService.generateAndSetToken(req as Request, res as Response, 'session-123', 'user-456');

      expect(token).toBe(existingToken);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('should generate new token when existing token is invalid', () => {
      req.cookies = { [config.cookieName!]: 'invalid-token' };

      const token = csrfService.generateAndSetToken(req as Request, res as Response);

      expect(token).toBeValidCSRFToken();
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('Extension Request Detection', () => {
    it('should detect Chrome extension request by origin', () => {
      req.headers = { origin: 'chrome-extension://abcdefghijklmnop' };

      const isExtension = csrfService.isExtensionRequest(req as Request);
      expect(isExtension).toBe(true);
    });

    it('should detect extension request by custom header', () => {
      req.headers = { 'x-extension-id': 'extension-123' };

      const isExtension = csrfService.isExtensionRequest(req as Request);
      expect(isExtension).toBe(true);
    });

    it('should not detect regular web request as extension', () => {
      req.headers = { 
        origin: 'https://example.com',
        'user-agent': 'Mozilla/5.0 (Chrome/91.0)'
      };

      const isExtension = csrfService.isExtensionRequest(req as Request);
      expect(isExtension).toBe(false);
    });

    it('should validate extension origin against allowed list', () => {
      req.headers = { 'x-extension-id': 'allowed-extension' };
      const allowedExtensions = ['allowed-extension', 'another-allowed'];

      const isValid = csrfService.validateExtensionOrigin(req as Request, allowedExtensions);
      expect(isValid).toBe(true);
    });

    it('should reject extension not in allowed list', () => {
      req.headers = { 'x-extension-id': 'forbidden-extension' };
      const allowedExtensions = ['allowed-extension'];

      const isValid = csrfService.validateExtensionOrigin(req as Request, allowedExtensions);
      expect(isValid).toBe(false);
    });

    it('should validate extension by origin URL', () => {
      req.headers = { origin: 'chrome-extension://allowedextension' };
      const allowedExtensions = ['allowedextension'];

      const isValid = csrfService.validateExtensionOrigin(req as Request, allowedExtensions);
      expect(isValid).toBe(true);
    });

    it('should allow any extension when no restrictions configured', () => {
      req.headers = { origin: 'chrome-extension://anyextension' };

      const isValid = csrfService.validateExtensionOrigin(req as Request);
      expect(isValid).toBe(true);
    });
  });

  describe('Token Rotation', () => {
    it('should rotate CSRF token', () => {
      const oldToken = csrfService.generateToken().token;
      req.cookies = { [config.cookieName!]: oldToken };

      const newToken = csrfService.rotateToken(req as Request, res as Response, 'session-123', 'user-456');

      expect(newToken).toBeValidCSRFToken();
      expect(newToken).not.toBe(oldToken);
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });

    it('should handle rotation without existing token', () => {
      req.cookies = {};

      const newToken = csrfService.rotateToken(req as Request, res as Response);

      expect(newToken).toBeValidCSRFToken();
      expect(res.clearCookie).not.toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('Token Statistics', () => {
    it('should provide accurate token statistics', () => {
      // Generate some tokens
      csrfService.generateToken('session-1', 'user-1');
      csrfService.generateToken('session-2', 'user-2');

      const stats = csrfService.getTokenStats();

      expect(stats).toMatchObject({
        totalTokens: 2,
        activeTokens: 2,
        expiredTokens: 0,
        config: expect.objectContaining({
          cookieName: config.cookieName,
          headerName: config.headerName,
          tokenExpiry: config.tokenExpiry,
          secureCookie: config.secureCookie
        })
      });
    });

    it('should track expired tokens in statistics', () => {
      // Generate tokens and advance time
      csrfService.generateToken();
      csrfService.generateToken();
      
      testUtils.advanceTime(config.tokenExpiry! + 1000);

      const stats = csrfService.getTokenStats();

      expect(stats.activeTokens).toBe(0);
      expect(stats.expiredTokens).toBe(2);
    });
  });

  describe('Token Invalidation', () => {
    it('should invalidate all tokens for a user', () => {
      csrfService.generateToken('session-1', 'user-123');
      csrfService.generateToken('session-2', 'user-123');
      csrfService.generateToken('session-3', 'user-456');

      const invalidated = csrfService.invalidateUserTokens('user-123');

      expect(invalidated).toBe(2);
      
      const stats = csrfService.getTokenStats();
      expect(stats.totalTokens).toBe(1); // Only user-456's token remains
    });

    it('should invalidate all tokens for a session', () => {
      csrfService.generateToken('session-123', 'user-1');
      csrfService.generateToken('session-123', 'user-2');
      csrfService.generateToken('session-456', 'user-3');

      const invalidated = csrfService.invalidateSessionTokens('session-123');

      expect(invalidated).toBe(2);
      
      const stats = csrfService.getTokenStats();
      expect(stats.totalTokens).toBe(1); // Only session-456's token remains
    });

    it('should return zero when invalidating non-existent user tokens', () => {
      const invalidated = csrfService.invalidateUserTokens('non-existent-user');
      expect(invalidated).toBe(0);
    });

    it('should return zero when invalidating non-existent session tokens', () => {
      const invalidated = csrfService.invalidateSessionTokens('non-existent-session');
      expect(invalidated).toBe(0);
    });
  });

  describe('Token Cleanup', () => {
    it('should clean up expired tokens periodically', () => {
      // Generate tokens
      csrfService.generateToken();
      csrfService.generateToken();

      let stats = csrfService.getTokenStats();
      expect(stats.totalTokens).toBe(2);

      // Advance time to expire tokens
      testUtils.advanceTime(config.tokenExpiry! + 1000);

      // Manually trigger cleanup (in real app this happens automatically)
      const cleanupMethod = (csrfService as any).cleanupExpiredTokens;
      cleanupMethod.call(csrfService);

      stats = csrfService.getTokenStats();
      expect(stats.totalTokens).toBe(0);
    });

    it('should only clean up expired tokens', () => {
      // Generate tokens at different times
      const token1 = csrfService.generateToken();
      
      testUtils.advanceTime(config.tokenExpiry! / 2); // Advance half expiry time
      
      const token2 = csrfService.generateToken();

      // Advance time to expire only first token
      testUtils.advanceTime(config.tokenExpiry! / 2 + 1000);

      // Manually trigger cleanup
      const cleanupMethod = (csrfService as any).cleanupExpiredTokens;
      cleanupMethod.call(csrfService);

      const stats = csrfService.getTokenStats();
      expect(stats.totalTokens).toBe(1); // Only second token should remain
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle token tampering attempts', () => {
      const validToken = csrfService.generateToken().token;
      const tamperedToken = validToken.replace(/.$/, 'X'); // Change last character

      const isValid = csrfService.validateToken(tamperedToken, tamperedToken);
      expect(isValid).toBe(false);
    });

    it('should handle malformed token formats', () => {
      const malformedTokens = [
        'only-one-part',
        'two.parts',
        'three.parts.but.wrong',
        'invalid-hex.123456789.signature',
        '123456789.invalid-timestamp.signature',
        ''
      ];

      for (const token of malformedTokens) {
        const isValid = csrfService.validateToken(token, token);
        expect(isValid).toBe(false);
      }
    });

    it('should handle concurrent token operations', () => {
      const promises = Array.from({ length: 10 }, () => 
        csrfService.generateToken()
      );

      const tokens = Promise.all(promises);
      
      // All tokens should be unique
      expect(tokens).resolves.toHaveLength(10);
    });

    it('should maintain token security under high load', () => {
      const sessionId = 'session-123';
      const userId = 'user-456';

      // Generate many tokens quickly
      const tokens = Array.from({ length: 100 }, () => 
        csrfService.generateToken(sessionId, userId).token
      );

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);

      // All tokens should be valid
      for (const token of tokens) {
        expect(csrfService.validateToken(token, token, sessionId, userId)).toBe(true);
      }
    });
  });
});