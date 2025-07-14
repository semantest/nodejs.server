/**
 * Tests for JWT Security Enhancements
 */

import { Request, Response, NextFunction } from 'express';
import { 
  createEnhancedJWTMiddleware, 
  createGlobalAPIProtection,
  createTokenBindingMiddleware,
  utils 
} from '../jwt-security-enhancements';
import { TokenManager } from '../token-manager';
import { ConsoleSecurityAuditLogger } from '../security-audit-logger';

// Mock Express objects
const mockRequest = (overrides = {}): Partial<Request> => ({
  headers: {},
  path: '/api/test',
  method: 'GET',
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
  ...overrides
});

const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.on = jest.fn();
  return res;
};

const mockNext: NextFunction = jest.fn();

// Mock TokenManager
const mockTokenManager = {
  verifyAccessToken: jest.fn(),
  isTokenBlacklisted: jest.fn()
} as unknown as TokenManager;

describe('JWT Security Enhancements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEnhancedJWTMiddleware', () => {
    it('should reject requests without token', async () => {
      const middleware = createEnhancedJWTMiddleware({ tokenManager: mockTokenManager });
      const req = mockRequest();
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid token', async () => {
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        extensionId: 'ext123',
        sessionId: 'session123',
        iat: Math.floor(Date.now() / 1000),
        jti: 'token123'
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager,
        bindToIP: false,
        bindToDevice: false 
      });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(mockTokenManager.verifyAccessToken).toHaveBeenCalledWith(token);
      expect(mockNext).toHaveBeenCalled();
      expect((req as any).user).toEqual({
        userId: decoded.userId,
        extensionId: decoded.extensionId,
        sessionId: decoded.sessionId,
        roles: [],
        tokenId: decoded.jti
      });
    });

    it('should reject blacklisted token', async () => {
      const token = 'blacklisted-token';
      const decoded = {
        userId: 'user123',
        iat: Math.floor(Date.now() / 1000)
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);
      
      const middleware = createEnhancedJWTMiddleware({ tokenManager: mockTokenManager });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should enforce IP binding when enabled', async () => {
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        ip: '192.168.1.1', // Different from request IP
        iat: Math.floor(Date.now() / 1000)
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager,
        bindToIP: true 
      });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
        ip: '127.0.0.1' // Different from token IP
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token IP mismatch' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should enforce short-lived tokens for sensitive paths', async () => {
      const token = 'old-token';
      const decoded = {
        userId: 'user123',
        iat: Math.floor((Date.now() - 10 * 60 * 1000) / 1000), // 10 minutes old
        jti: 'token123'
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager,
        bindToIP: false,
        bindToDevice: false,
        shortLivedTokenPaths: ['/api/admin/*']
      });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
        path: '/api/admin/users'
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Token too old for this operation. Please re-authenticate.' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log security events when logger provided', async () => {
      const mockLogger = new ConsoleSecurityAuditLogger();
      const logSpy = jest.spyOn(mockLogger, 'logAuthEvent');
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager,
        auditLogger: mockLogger 
      });
      
      const req = mockRequest();
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'access_denied',
        ip: '127.0.0.1',
        details: { reason: 'missing_token', path: '/api/test' }
      }));
    });
  });

  describe('createGlobalAPIProtection', () => {
    it('should protect /api/* paths', async () => {
      const middleware = createGlobalAPIProtection({ tokenManager: mockTokenManager });
      
      const req = mockRequest({ path: '/api/users' });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip public paths', async () => {
      const middleware = createGlobalAPIProtection({ tokenManager: mockTokenManager });
      
      const publicPaths = ['/health', '/info', '/auth/login'];
      
      for (const path of publicPaths) {
        const req = mockRequest({ path });
        const res = mockResponse();
        
        await middleware(req as Request, res as Response, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });

    it('should skip non-API paths', async () => {
      const middleware = createGlobalAPIProtection({ tokenManager: mockTokenManager });
      
      const req = mockRequest({ path: '/static/image.png' });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('createTokenBindingMiddleware', () => {
    it('should add binding info to request', () => {
      const middleware = createTokenBindingMiddleware();
      
      const req = mockRequest({
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip',
          'accept': 'application/json'
        }
      });
      const res = mockResponse();
      
      middleware(req as Request, res as Response, mockNext);
      
      expect((req as any).tokenBinding).toBeDefined();
      expect((req as any).tokenBinding.ip).toBe('192.168.1.1');
      expect((req as any).tokenBinding.deviceFingerprint).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('utils', () => {
    describe('extractToken', () => {
      it('should extract bearer token from header', () => {
        const req = mockRequest({
          headers: { authorization: 'Bearer abc123' }
        });
        
        const token = utils.extractToken(req as Request);
        expect(token).toBe('abc123');
      });

      it('should return null for missing auth header', () => {
        const req = mockRequest();
        
        const token = utils.extractToken(req as Request);
        expect(token).toBeNull();
      });

      it('should return null for non-bearer auth', () => {
        const req = mockRequest({
          headers: { authorization: 'Basic abc123' }
        });
        
        const token = utils.extractToken(req as Request);
        expect(token).toBeNull();
      });
    });

    describe('getClientIP', () => {
      it('should get IP from req.ip', () => {
        const req = mockRequest({ ip: '192.168.1.1' });
        
        const ip = utils.getClientIP(req as Request);
        expect(ip).toBe('192.168.1.1');
      });

      it('should get IP from x-forwarded-for header', () => {
        const req = mockRequest({
          headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' }
        });
        
        const ip = utils.getClientIP(req as Request);
        expect(ip).toBe('10.0.0.1');
      });

      it('should fallback to socket remote address', () => {
        const req = mockRequest({
          ip: undefined,
          socket: { remoteAddress: '127.0.0.1' }
        });
        
        const ip = utils.getClientIP(req as Request);
        expect(ip).toBe('127.0.0.1');
      });
    });

    describe('isShortLivedPath', () => {
      it('should match exact paths', () => {
        const patterns = ['/api/admin/users', '/api/sensitive/data'];
        
        expect(utils.isShortLivedPath('/api/admin/users', patterns)).toBe(true);
        expect(utils.isShortLivedPath('/api/other', patterns)).toBe(false);
      });

      it('should match wildcard patterns', () => {
        const patterns = ['/api/admin/*', '/api/sensitive/*'];
        
        expect(utils.isShortLivedPath('/api/admin/users', patterns)).toBe(true);
        expect(utils.isShortLivedPath('/api/admin/settings', patterns)).toBe(true);
        expect(utils.isShortLivedPath('/api/public/data', patterns)).toBe(false);
      });
    });
  });
});