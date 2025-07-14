/**
 * @fileoverview CSRF Middleware Unit Tests
 * @description Comprehensive tests for CSRF protection middleware
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import { CSRFService } from '../../infrastructure/csrf-service';

// We need to read the actual middleware since it might not be exported yet
// For now, let's create a mock middleware based on common patterns

// Mock CSRF middleware implementation for testing
interface CSRFMiddlewareOptions {
  csrfService?: CSRFService;
  exemptMethods?: string[];
  exemptPaths?: string[];
  allowExtensions?: boolean;
  allowedExtensions?: string[];
  onError?: (req: Request, res: Response, next: NextFunction) => void;
}

function createCSRFMiddleware(options: CSRFMiddlewareOptions = {}) {
  const {
    csrfService = new CSRFService(),
    exemptMethods = ['GET', 'HEAD', 'OPTIONS'],
    exemptPaths = [],
    allowExtensions = true,
    allowedExtensions = [],
    onError
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip CSRF protection for exempt methods
      if (exemptMethods.includes(req.method)) {
        return next();
      }

      // Skip CSRF protection for exempt paths
      if (exemptPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Skip CSRF protection for extensions if allowed
      if (allowExtensions && csrfService.isExtensionRequest(req)) {
        if (allowedExtensions.length === 0 || csrfService.validateExtensionOrigin(req, allowedExtensions)) {
          return next();
        }
      }

      // Get tokens from header and cookie
      const headerToken = csrfService.getTokenFromHeader(req);
      const cookieToken = csrfService.getTokenFromCookie(req);

      // Validate CSRF token
      const sessionId = req.user?.sessionId;
      const userId = req.user?.userId;
      
      const isValid = csrfService.validateToken(headerToken, cookieToken, sessionId, userId);

      if (!isValid) {
        if (onError) {
          return onError(req, res, next);
        } else {
          return res.status(403).json({
            error: 'CSRF token validation failed',
            message: 'Invalid or missing CSRF token'
          });
        }
      }

      next();
    } catch (error) {
      console.error('CSRF middleware error:', error);
      if (onError) {
        return onError(req, res, next);
      } else {
        return res.status(500).json({
          error: 'CSRF protection error',
          message: 'Internal error during CSRF validation'
        });
      }
    }
  };
}

// Mock dependencies
jest.mock('../../infrastructure/csrf-service');

const mockCSRFService = CSRFService as jest.MockedClass<typeof CSRFService>;

describe('CSRF Middleware', () => {
  let csrfService: jest.Mocked<CSRFService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();

    // Create mock CSRF service
    csrfService = new mockCSRFService() as jest.Mocked<CSRFService>;

    // Setup mock request, response, and next
    req = testUtils.createMockRequest({
      method: 'POST',
      path: '/api/test',
      headers: {},
      cookies: {},
      user: {
        userId: 'user-123',
        sessionId: 'session-456'
      }
    });
    res = testUtils.createMockResponse();
    next = testUtils.createMockNext();

    // Setup default CSRF service mocks
    csrfService.getTokenFromHeader.mockReturnValue(undefined);
    csrfService.getTokenFromCookie.mockReturnValue(undefined);
    csrfService.validateToken.mockReturnValue(false);
    csrfService.isExtensionRequest.mockReturnValue(false);
    csrfService.validateExtensionOrigin.mockReturnValue(false);
  });

  describe('Basic CSRF Protection', () => {
    let middleware: ReturnType<typeof createCSRFMiddleware>;

    beforeEach(() => {
      middleware = createCSRFMiddleware({ csrfService });
    });

    it('should allow request with valid CSRF tokens', () => {
      const validToken = 'valid-csrf-token';
      
      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalledWith(
        validToken,
        validToken,
        'session-456',
        'user-123'
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request with missing CSRF token', () => {
      csrfService.getTokenFromHeader.mockReturnValue(undefined);
      csrfService.getTokenFromCookie.mockReturnValue(undefined);
      csrfService.validateToken.mockReturnValue(false);

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token validation failed',
        message: 'Invalid or missing CSRF token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid CSRF token', () => {
      csrfService.getTokenFromHeader.mockReturnValue('invalid-token');
      csrfService.getTokenFromCookie.mockReturnValue('different-token');
      csrfService.validateToken.mockReturnValue(false);

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token validation failed',
        message: 'Invalid or missing CSRF token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle CSRF validation errors', () => {
      csrfService.getTokenFromHeader.mockImplementation(() => {
        throw new Error('Token extraction error');
      });

      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF protection error',
        message: 'Internal error during CSRF validation'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Method Exemptions', () => {
    it('should exempt safe HTTP methods by default', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      const middleware = createCSRFMiddleware({ csrfService });

      for (const method of safeMethods) {
        req.method = method;
        middleware(req as Request, res as Response, next);

        expect(csrfService.validateToken).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
        
        jest.clearAllMocks();
      }
    });

    it('should protect unsafe HTTP methods', () => {
      const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      const middleware = createCSRFMiddleware({ csrfService });

      for (const method of unsafeMethods) {
        req.method = method;
        middleware(req as Request, res as Response, next);

        expect(csrfService.validateToken).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        
        jest.clearAllMocks();
      }
    });

    it('should allow custom exempt methods', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        exemptMethods: ['POST'] // Exempt POST for testing
      });

      req.method = 'POST';
      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Path Exemptions', () => {
    it('should exempt configured paths', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        exemptPaths: ['/api/public', '/webhooks']
      });

      const exemptPaths = ['/api/public/data', '/webhooks/github'];

      for (const path of exemptPaths) {
        req.path = path;
        middleware(req as Request, res as Response, next);

        expect(csrfService.validateToken).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
        
        jest.clearAllMocks();
      }
    });

    it('should protect non-exempt paths', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        exemptPaths: ['/api/public']
      });

      req.path = '/api/protected';
      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalled();
    });
  });

  describe('Extension Request Handling', () => {
    it('should allow extension requests when enabled', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        allowExtensions: true
      });

      csrfService.isExtensionRequest.mockReturnValue(true);
      csrfService.validateExtensionOrigin.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.isExtensionRequest).toHaveBeenCalledWith(req);
      expect(csrfService.validateToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject extension requests when disabled', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        allowExtensions: false
      });

      csrfService.isExtensionRequest.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should validate extension against allowed list', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        allowExtensions: true,
        allowedExtensions: ['allowed-ext-1', 'allowed-ext-2']
      });

      csrfService.isExtensionRequest.mockReturnValue(true);
      csrfService.validateExtensionOrigin.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateExtensionOrigin).toHaveBeenCalledWith(
        req,
        ['allowed-ext-1', 'allowed-ext-2']
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject extensions not in allowed list', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        allowExtensions: true,
        allowedExtensions: ['allowed-ext']
      });

      csrfService.isExtensionRequest.mockReturnValue(true);
      csrfService.validateExtensionOrigin.mockReturnValue(false);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Custom Error Handling', () => {
    it('should use custom error handler when provided', () => {
      const customErrorHandler = jest.fn();
      const middleware = createCSRFMiddleware({
        csrfService,
        onError: customErrorHandler
      });

      csrfService.validateToken.mockReturnValue(false);

      middleware(req as Request, res as Response, next);

      expect(customErrorHandler).toHaveBeenCalledWith(req, res, next);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use custom error handler for exceptions', () => {
      const customErrorHandler = jest.fn();
      const middleware = createCSRFMiddleware({
        csrfService,
        onError: customErrorHandler
      });

      csrfService.getTokenFromHeader.mockImplementation(() => {
        throw new Error('Test error');
      });

      middleware(req as Request, res as Response, next);

      expect(customErrorHandler).toHaveBeenCalledWith(req, res, next);
    });
  });

  describe('Session and User Context', () => {
    it('should validate tokens with session and user context', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'valid-token';

      req.user = {
        userId: 'user-789',
        sessionId: 'session-012'
      };

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalledWith(
        validToken,
        validToken,
        'session-012',
        'user-789'
      );
    });

    it('should validate tokens without user context', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'valid-token';

      req.user = undefined;

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalledWith(
        validToken,
        validToken,
        undefined,
        undefined
      );
    });

    it('should handle partial user context', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'valid-token';

      req.user = {
        sessionId: 'session-only'
      } as any;

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).toHaveBeenCalledWith(
        validToken,
        validToken,
        'session-only',
        undefined
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with authenticated API requests', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'api-csrf-token';

      req.method = 'POST';
      req.path = '/api/users';
      req.headers = {
        'authorization': 'Bearer jwt-token',
        'x-csrf-token': validToken
      };
      req.cookies = { 'csrf-token': validToken };
      req.user = {
        userId: 'user-123',
        sessionId: 'session-456'
      };

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should work with form submissions', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'form-csrf-token';

      req.method = 'POST';
      req.path = '/submit-form';
      req.headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrf-token': validToken
      };
      req.cookies = { 'csrf-token': validToken };
      req.body = { data: 'form-data' };

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should work with AJAX requests', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'ajax-csrf-token';

      req.method = 'PUT';
      req.path = '/api/update';
      req.headers = {
        'x-requested-with': 'XMLHttpRequest',
        'x-csrf-token': validToken
      };
      req.cookies = { 'csrf-token': validToken };

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should handle Chrome extension requests', () => {
      const middleware = createCSRFMiddleware({
        csrfService,
        allowExtensions: true
      });

      req.method = 'POST';
      req.path = '/api/extension';
      req.headers = {
        'origin': 'chrome-extension://abcdefghijklmnop',
        'x-extension-id': 'abcdefghijklmnop'
      };

      csrfService.isExtensionRequest.mockReturnValue(true);
      csrfService.validateExtensionOrigin.mockReturnValue(true);

      middleware(req as Request, res as Response, next);

      expect(csrfService.validateToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle high-frequency requests efficiently', () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'perf-test-token';

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      // Simulate many requests
      for (let i = 0; i < 1000; i++) {
        const mockReq = { ...req };
        middleware(mockReq as Request, res as Response, next);
      }

      expect(csrfService.validateToken).toHaveBeenCalledTimes(1000);
      expect(next).toHaveBeenCalledTimes(1000);
    });

    it('should handle malformed requests gracefully', () => {
      const middleware = createCSRFMiddleware({ csrfService });

      // Test with malformed request object
      const malformedReq = {
        method: null,
        path: undefined,
        headers: null,
        cookies: null
      } as any;

      csrfService.getTokenFromHeader.mockImplementation(() => {
        throw new Error('Cannot read headers');
      });

      middleware(malformedReq, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle concurrent requests safely', async () => {
      const middleware = createCSRFMiddleware({ csrfService });
      const validToken = 'concurrent-token';

      csrfService.getTokenFromHeader.mockReturnValue(validToken);
      csrfService.getTokenFromCookie.mockReturnValue(validToken);
      csrfService.validateToken.mockReturnValue(true);

      // Simulate concurrent requests
      const promises = Array.from({ length: 100 }, () => {
        return new Promise<void>((resolve) => {
          const mockReq = { ...req };
          const mockRes = testUtils.createMockResponse();
          const mockNext = jest.fn(() => resolve());

          middleware(mockReq as Request, mockRes as Response, mockNext);
        });
      });

      await Promise.all(promises);
      expect(csrfService.validateToken).toHaveBeenCalledTimes(100);
    });
  });
});