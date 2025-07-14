/**
 * @fileoverview JWT Middleware Unit Tests
 * @description Comprehensive tests for JWT authentication middleware
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import {
  createJWTMiddleware,
  createWebSocketAuthHandler,
  requireRoles,
  requireExtension,
  optionalAuth,
  refreshTokenMiddleware,
  authErrorHandler,
  AuthenticatedUser,
  JWTMiddlewareOptions
} from '../infrastructure/jwt-middleware';
import { TokenManager, DecodedToken } from '../infrastructure/token-manager';

// Mock dependencies
jest.mock('../infrastructure/token-manager');

const mockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>;

describe('JWT Middleware', () => {
  let tokenManager: jest.Mocked<TokenManager>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();

    // Create mock token manager
    tokenManager = new mockTokenManager() as jest.Mocked<TokenManager>;

    // Create mock request, response, and next
    req = testUtils.createMockRequest();
    res = testUtils.createMockResponse();
    next = testUtils.createMockNext();

    // Mock static method
    TokenManager.extractTokenFromHeader = jest.fn();
  });

  describe('createJWTMiddleware', () => {
    let middleware: ReturnType<typeof createJWTMiddleware>;
    let options: JWTMiddlewareOptions;

    beforeEach(() => {
      options = {
        tokenManager,
        requireAuth: true,
        roles: [],
        skipPaths: []
      };
      middleware = createJWTMiddleware(options);
    });

    describe('Authentication Required', () => {
      it('should authenticate valid token successfully', async () => {
        const decodedToken: DecodedToken = {
          userId: 'user-123',
          email: 'test@example.com',
          roles: ['user'],
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          jti: 'jwt-id-789',
          type: 'access'
        };

        req.headers = { authorization: 'Bearer valid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('valid-token');
        tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

        await middleware(req as Request, res as Response, next);

        expect(req.user).toMatchObject({
          userId: 'user-123',
          email: 'test@example.com',
          roles: ['user'],
          sessionId: 'session-456',
          tokenJTI: 'jwt-id-789',
          tokenExp: decodedToken.exp
        });
        expect(req.token).toBe('valid-token');
        expect(next).toHaveBeenCalledWith();
      });

      it('should reject request without token', async () => {
        req.headers = {};
        TokenManager.extractTokenFromHeader.mockReturnValue(null);

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'No authentication token provided'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject request with invalid token', async () => {
        req.headers = { authorization: 'Bearer invalid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('invalid-token');
        tokenManager.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication failed',
          message: 'Invalid token'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject request with expired token', async () => {
        req.headers = { authorization: 'Bearer expired-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('expired-token');
        tokenManager.verifyAccessToken.mockRejectedValue(new Error('Access token expired'));

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication failed',
          message: 'Access token expired'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should handle middleware errors gracefully', async () => {
        req.headers = { authorization: 'Bearer valid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('valid-token');
        tokenManager.verifyAccessToken.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal server error',
          message: 'Authentication processing failed'
        });
      });
    });

    describe('Optional Authentication', () => {
      beforeEach(() => {
        options.requireAuth = false;
        middleware = createJWTMiddleware(options);
      });

      it('should proceed without token when auth not required', async () => {
        req.headers = {};
        TokenManager.extractTokenFromHeader.mockReturnValue(null);

        await middleware(req as Request, res as Response, next);

        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
      });

      it('should authenticate valid token when provided', async () => {
        const decodedToken: DecodedToken = {
          userId: 'user-123',
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          jti: 'jwt-id-789',
          type: 'access'
        };

        req.headers = { authorization: 'Bearer valid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('valid-token');
        tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

        await middleware(req as Request, res as Response, next);

        expect(req.user).toBeDefined();
        expect(next).toHaveBeenCalledWith();
      });

      it('should proceed even with invalid token when auth not required', async () => {
        req.headers = { authorization: 'Bearer invalid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('invalid-token');
        tokenManager.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

        await middleware(req as Request, res as Response, next);

        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
      });
    });

    describe('Path Skipping', () => {
      beforeEach(() => {
        options.skipPaths = ['/health', '/public'];
        middleware = createJWTMiddleware(options);
      });

      it('should skip authentication for configured paths', async () => {
        req.path = '/health';

        await middleware(req as Request, res as Response, next);

        expect(tokenManager.verifyAccessToken).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
      });

      it('should authenticate non-skipped paths', async () => {
        req.path = '/protected';
        req.headers = {};
        TokenManager.extractTokenFromHeader.mockReturnValue(null);

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Role-Based Access Control', () => {
      beforeEach(() => {
        options.roles = ['admin', 'moderator'];
        middleware = createJWTMiddleware(options);
      });

      it('should allow access with required roles', async () => {
        const decodedToken: DecodedToken = {
          userId: 'user-123',
          roles: ['user', 'admin'],
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          jti: 'jwt-id-789',
          type: 'access'
        };

        req.headers = { authorization: 'Bearer valid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('valid-token');
        tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

        await middleware(req as Request, res as Response, next);

        expect(req.user).toBeDefined();
        expect(next).toHaveBeenCalledWith();
      });

      it('should deny access without required roles', async () => {
        const decodedToken: DecodedToken = {
          userId: 'user-123',
          roles: ['user'],
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
          jti: 'jwt-id-789',
          type: 'access'
        };

        req.headers = { authorization: 'Bearer valid-token' };
        TokenManager.extractTokenFromHeader.mockReturnValue('valid-token');
        tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Insufficient permissions',
          message: 'User does not have required roles'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('WebSocket Authentication', () => {
    let wsAuthHandler: ReturnType<typeof createWebSocketAuthHandler>;
    let mockWs: Partial<WebSocket>;
    let mockRequest: Partial<IncomingMessage>;

    beforeEach(() => {
      wsAuthHandler = createWebSocketAuthHandler(tokenManager);
      mockWs = {
        close: jest.fn()
      };
      mockRequest = {
        headers: {},
        url: 'ws://localhost:3000/ws'
      };
    });

    it('should authenticate WebSocket with Authorization header', async () => {
      const decodedToken: DecodedToken = {
        userId: 'user-123',
        sessionId: 'session-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        jti: 'jwt-id-789',
        type: 'access'
      };

      mockRequest.headers = { authorization: 'Bearer ws-token' };
      TokenManager.extractTokenFromHeader.mockReturnValue('ws-token');
      tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

      const user = await wsAuthHandler(mockWs as WebSocket, mockRequest as IncomingMessage);

      expect(user).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-456',
        tokenJTI: 'jwt-id-789'
      });
      expect(mockWs.close).not.toHaveBeenCalled();
    });

    it('should authenticate WebSocket with query parameter', async () => {
      const decodedToken: DecodedToken = {
        userId: 'user-123',
        sessionId: 'session-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        jti: 'jwt-id-789',
        type: 'access'
      };

      mockRequest.url = 'ws://localhost:3000/ws?token=query-token';
      mockRequest.headers = { host: 'localhost:3000' };
      TokenManager.extractTokenFromHeader.mockReturnValue(null);
      tokenManager.verifyAccessToken.mockResolvedValue(decodedToken);

      const user = await wsAuthHandler(mockWs as WebSocket, mockRequest as IncomingMessage);

      expect(tokenManager.verifyAccessToken).toHaveBeenCalledWith('query-token');
      expect(user).toBeDefined();
    });

    it('should close WebSocket without token', async () => {
      mockRequest.headers = {};
      TokenManager.extractTokenFromHeader.mockReturnValue(null);

      const user = await wsAuthHandler(mockWs as WebSocket, mockRequest as IncomingMessage);

      expect(mockWs.close).toHaveBeenCalledWith(1008, 'Authentication required');
      expect(user).toBeNull();
    });

    it('should close WebSocket with invalid token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      TokenManager.extractTokenFromHeader.mockReturnValue('invalid-token');
      tokenManager.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      const user = await wsAuthHandler(mockWs as WebSocket, mockRequest as IncomingMessage);

      expect(mockWs.close).toHaveBeenCalledWith(1008, 'Invalid token');
      expect(user).toBeNull();
    });
  });

  describe('Role Requirements Middleware', () => {
    let roleMiddleware: ReturnType<typeof requireRoles>;

    beforeEach(() => {
      roleMiddleware = requireRoles('admin', 'moderator');
    });

    it('should allow access with required roles', () => {
      req.user = {
        userId: 'user-123',
        roles: ['user', 'admin'],
        sessionId: 'session-456',
        tokenJTI: 'jwt-id-789',
        tokenExp: Math.floor(Date.now() / 1000) + 900
      };

      roleMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny access without required roles', () => {
      req.user = {
        userId: 'user-123',
        roles: ['user'],
        sessionId: 'session-456',
        tokenJTI: 'jwt-id-789',
        tokenExp: Math.floor(Date.now() / 1000) + 900
      };

      roleMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        message: 'Required roles: admin, moderator'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      req.user = undefined;

      roleMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Extension Requirement Middleware', () => {
    let extensionMiddleware: ReturnType<typeof requireExtension>;

    beforeEach(() => {
      extensionMiddleware = requireExtension();
    });

    it('should allow access with extension ID', () => {
      req.user = {
        userId: 'user-123',
        extensionId: 'ext-456',
        roles: ['user'],
        sessionId: 'session-456',
        tokenJTI: 'jwt-id-789',
        tokenExp: Math.floor(Date.now() / 1000) + 900
      };

      extensionMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny access without extension ID', () => {
      req.user = {
        userId: 'user-123',
        roles: ['user'],
        sessionId: 'session-456',
        tokenJTI: 'jwt-id-789',
        tokenExp: Math.floor(Date.now() / 1000) + 900
      };

      extensionMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Extension authentication required',
        message: 'This endpoint requires extension authentication'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      req.user = undefined;

      extensionMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Optional Authentication Middleware', () => {
    let optionalMiddleware: ReturnType<typeof optionalAuth>;

    beforeEach(() => {
      optionalMiddleware = optionalAuth(tokenManager);
    });

    it('should work like createJWTMiddleware with requireAuth: false', async () => {
      req.headers = {};
      TokenManager.extractTokenFromHeader.mockReturnValue(null);

      await optionalMiddleware(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Refresh Token Middleware', () => {
    let refreshMiddleware: ReturnType<typeof refreshTokenMiddleware>;

    beforeEach(() => {
      refreshMiddleware = refreshTokenMiddleware(tokenManager);
    });

    it('should verify refresh token from cookies', async () => {
      const decodedToken: DecodedToken = {
        userId: 'user-123',
        sessionId: 'session-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        jti: 'refresh-jti-789',
        type: 'refresh'
      };

      req.cookies = { refreshToken: 'valid-refresh-token' };
      tokenManager.verifyRefreshToken.mockResolvedValue(decodedToken);

      await refreshMiddleware(req as Request, res as Response, next);

      expect(req.user).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-456',
        tokenJTI: 'refresh-jti-789'
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should verify refresh token from body', async () => {
      const decodedToken: DecodedToken = {
        userId: 'user-123',
        sessionId: 'session-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        jti: 'refresh-jti-789',
        type: 'refresh'
      };

      req.body = { refreshToken: 'body-refresh-token' };
      tokenManager.verifyRefreshToken.mockResolvedValue(decodedToken);

      await refreshMiddleware(req as Request, res as Response, next);

      expect(tokenManager.verifyRefreshToken).toHaveBeenCalledWith('body-refresh-token');
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request without refresh token', async () => {
      req.cookies = {};
      req.body = {};

      await refreshMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid refresh token', async () => {
      req.cookies = { refreshToken: 'invalid-refresh-token' };
      tokenManager.verifyRefreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      await refreshMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token',
        message: 'Invalid refresh token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Auth Error Handler', () => {
    let errorHandler: ReturnType<typeof authErrorHandler>;
    let error: Error;

    beforeEach(() => {
      errorHandler = authErrorHandler();
      error = new Error('Test error');
    });

    it('should handle UnauthorizedError', () => {
      error.name = 'UnauthorizedError';

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Test error'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass through other errors', () => {
      error.name = 'SomeOtherError';

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});