/**
 * Additional tests for JWT Security Enhancements - Extended Coverage
 */

import { Request, Response, NextFunction } from 'express';
import { 
  createEnhancedJWTMiddleware,
  createSecurityMonitoringMiddleware,
  utils 
} from '../jwt-security-enhancements';
import { ConsoleSecurityAuditLogger } from '../security-audit-logger';
import { createMockTokenManager } from './mocks/token-manager.mock';

// Mock Express objects
const mockRequest = (overrides = {}): Partial<Request> => ({
  headers: {},
  path: '/api/test',
  method: 'GET',
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' } as any,
  user: undefined,
  ...overrides
});

const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.on = jest.fn();
  res.statusCode = 200;
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('JWT Security Enhancements - Extended Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced JWT Middleware - Edge Cases', () => {
    it('should handle device fingerprint mismatch', async () => {
      const mockTokenManager = createMockTokenManager();
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        deviceFingerprint: 'original-fingerprint',
        iat: Math.floor(Date.now() / 1000)
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager as any,
        bindToIP: false,
        bindToDevice: true 
      });
      
      const req = mockRequest({
        headers: { 
          authorization: `Bearer ${token}`,
          'user-agent': 'Different-Browser',
          'accept-language': 'fr-FR'
        }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token device mismatch' });
    });

    it('should handle anomaly detection with high score', async () => {
      const mockTokenManager = createMockTokenManager();
      const mockAnomalyDetector = {
        checkForAnomalies: jest.fn().mockResolvedValue({
          score: 85,
          reasons: ['unusual_access_pattern', 'rapid_requests'],
          requiresAdditionalAuth: true
        })
      };
      
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        iat: Math.floor(Date.now() / 1000)
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager as any,
        bindToIP: false,
        bindToDevice: false,
        anomalyDetector: mockAnomalyDetector
      });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Additional authentication required',
        reason: 'suspicious_activity_detected'
      });
    });

    it('should handle token verification errors', async () => {
      const mockTokenManager = createMockTokenManager();
      const mockLogger = new ConsoleSecurityAuditLogger();
      const logSpy = jest.spyOn(mockLogger, 'logAuthEvent');
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockRejectedValue(
        new Error('Invalid signature')
      );
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager as any,
        auditLogger: mockLogger
      });
      
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'access_denied',
        details: expect.objectContaining({
          reason: 'token_verification_failed',
          error: 'Invalid signature'
        })
      }));
    });

    it('should handle anomaly detection without additional auth requirement', async () => {
      const mockTokenManager = createMockTokenManager();
      const mockAnomalyDetector = {
        checkForAnomalies: jest.fn().mockResolvedValue({
          score: 85,
          reasons: ['unusual_pattern'],
          requiresAdditionalAuth: false
        })
      };
      
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        sessionId: 'session123',
        extensionId: 'ext123',
        roles: ['user'],
        jti: 'token123',
        iat: Math.floor(Date.now() / 1000)
      };
      
      (mockTokenManager.verifyAccessToken as jest.Mock).mockResolvedValue(decoded);
      (mockTokenManager.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const middleware = createEnhancedJWTMiddleware({ 
        tokenManager: mockTokenManager as any,
        bindToIP: false,
        bindToDevice: false,
        anomalyDetector: mockAnomalyDetector
      });
      
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = mockResponse();
      
      await middleware(req as Request, res as Response, mockNext);
      
      // Should pass through despite high anomaly score
      expect(mockNext).toHaveBeenCalled();
      expect((req as any).user).toEqual({
        userId: decoded.userId,
        extensionId: decoded.extensionId,
        sessionId: decoded.sessionId,
        roles: decoded.roles,
        tokenId: decoded.jti
      });
    });
  });

  describe('createSecurityMonitoringMiddleware', () => {
    it('should log successful requests', async () => {
      const mockLogger = new ConsoleSecurityAuditLogger();
      const logSpy = jest.spyOn(mockLogger, 'logAuthEvent');
      
      const middleware = createSecurityMonitoringMiddleware(mockLogger);
      
      const req = mockRequest({
        user: {
          userId: 'user123',
          roles: ['user']
        }
      });
      const res = mockResponse();
      res.statusCode = 200;
      
      middleware(req as Request, res as Response, mockNext);
      
      // Simulate response finish
      const finishCallback = (res.on as jest.Mock).mock.calls[0][1];
      await finishCallback();
      
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'access_denied',
        userId: 'user123',
        details: expect.objectContaining({
          status: 200,
          success: true
        })
      }));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should work without logger', () => {
      const middleware = createSecurityMonitoringMiddleware();
      
      const req = mockRequest();
      const res = mockResponse();
      
      expect(() => {
        middleware(req as Request, res as Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge cases for utility functions', () => {
    it('should handle missing socket in getClientIP', () => {
      const req = {
        ip: undefined,
        headers: {},
        socket: undefined
      };
      
      const ip = utils.getClientIP(req as any);
      expect(ip).toBe('unknown');
    });

    it('should handle undefined path in isShortLivedPath', () => {
      const patterns = ['/api/admin/*'];
      expect(utils.isShortLivedPath(undefined as any, patterns)).toBe(false);
      expect(utils.isShortLivedPath('', patterns)).toBe(false);
    });
  });

  describe('Token binding with all headers', () => {
    it('should generate consistent device fingerprint', () => {
      const req1 = mockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip, deflate',
          'accept': 'application/json'
        }
      });
      
      const req2 = mockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip, deflate',
          'accept': 'application/json'
        }
      });
      
      const fingerprint1 = utils.generateDeviceFingerprint(req1 as Request);
      const fingerprint2 = utils.generateDeviceFingerprint(req2 as Request);
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different fingerprints for different devices', () => {
      const req1 = mockRequest({
        headers: {
          'user-agent': 'Chrome/96.0',
          'accept-language': 'en-US'
        }
      });
      
      const req2 = mockRequest({
        headers: {
          'user-agent': 'Firefox/95.0',
          'accept-language': 'fr-FR'
        }
      });
      
      const fingerprint1 = utils.generateDeviceFingerprint(req1 as Request);
      const fingerprint2 = utils.generateDeviceFingerprint(req2 as Request);
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });
});