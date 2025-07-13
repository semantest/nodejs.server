/**
 * @fileoverview CSRF Protection Middleware
 * @description Express middleware for CSRF protection with Chrome extension exemption
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import { CSRFService } from './csrf-service';
import { AuthenticatedUser } from './jwt-middleware';

// Extend Express Request type to include CSRF token
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}

export interface CSRFMiddlewareOptions {
  csrfService: CSRFService;
  skipMethods?: string[];
  skipPaths?: string[];
  allowedExtensionIds?: string[];
  requireAuthentication?: boolean;
  customErrorHandler?: (req: Request, res: Response, error: CSRFError) => void;
}

export interface CSRFError {
  type: 'missing_token' | 'invalid_token' | 'token_mismatch' | 'expired_token' | 'validation_error';
  message: string;
  details?: any;
}

/**
 * Create CSRF protection middleware
 * Implements double-submit cookie pattern with extension exemption
 */
export function createCSRFMiddleware(options: CSRFMiddlewareOptions) {
  const {
    csrfService,
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = [],
    allowedExtensionIds = [],
    requireAuthentication = false,
    customErrorHandler
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = req.method.toUpperCase();
      const path = req.path;

      // Skip CSRF protection for safe methods
      if (skipMethods.includes(method)) {
        // Still generate token for safe methods to ensure it's available
        if (method === 'GET') {
          generateTokenForRequest(req, res, csrfService);
        }
        return next();
      }

      // Skip CSRF protection for configured paths
      if (skipPaths.some(skipPath => path.startsWith(skipPath))) {
        return next();
      }

      // Check if request is from Chrome extension (exempt from CSRF)
      if (isExtensionRequestExempt(req, csrfService, allowedExtensionIds)) {
        console.log('🔌 Extension request detected - CSRF protection bypassed');
        return next();
      }

      // Validate CSRF token for state-changing requests
      const validationResult = await validateCSRFToken(req, csrfService, requireAuthentication);
      
      if (!validationResult.isValid) {
        return handleCSRFError(req, res, validationResult.error!, customErrorHandler);
      }

      // Attach validated token to request for use by application
      req.csrfToken = validationResult.token;

      next();
    } catch (error) {
      console.error('❌ CSRF middleware error:', error);
      
      const csrfError: CSRFError = {
        type: 'validation_error',
        message: 'CSRF validation failed due to internal error',
        details: error instanceof Error ? error.message : error
      };

      return handleCSRFError(req, res, csrfError, customErrorHandler);
    }
  };
}

/**
 * Middleware to generate CSRF token for new sessions
 */
export function createCSRFTokenGeneratorMiddleware(csrfService: CSRFService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      generateTokenForRequest(req, res, csrfService);
      next();
    } catch (error) {
      console.error('❌ CSRF token generation error:', error);
      next(error);
    }
  };
}

/**
 * Middleware to provide CSRF token endpoint
 */
export function createCSRFTokenEndpoint(csrfService: CSRFService) {
  return (req: Request, res: Response) => {
    try {
      const token = generateTokenForRequest(req, res, csrfService);
      
      res.json({
        csrfToken: token,
        headerName: csrfService.getConfig().headerName,
        cookieName: csrfService.getConfig().cookieName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ CSRF token endpoint error:', error);
      res.status(500).json({
        error: 'Failed to generate CSRF token',
        message: 'Internal server error'
      });
    }
  };
}

/**
 * Middleware to rotate CSRF tokens after authentication
 */
export function createCSRFTokenRotationMiddleware(csrfService: CSRFService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only rotate for authenticated users
      if (req.user) {
        const newToken = csrfService.rotateToken(
          req,
          res,
          req.user.sessionId,
          req.user.userId
        );
        req.csrfToken = newToken;
        console.log('🔄 CSRF token rotated for user:', req.user.userId);
      }
      next();
    } catch (error) {
      console.error('❌ CSRF token rotation error:', error);
      next();
    }
  };
}

/**
 * Middleware to clean up CSRF tokens on logout
 */
export function createCSRFCleanupMiddleware(csrfService: CSRFService) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear CSRF cookie on logout
      csrfService.clearCookie(res);
      
      // Invalidate user tokens if user is authenticated
      if (req.user) {
        csrfService.invalidateUserTokens(req.user.userId);
      }
      
      next();
    } catch (error) {
      console.error('❌ CSRF cleanup error:', error);
      next();
    }
  };
}

/**
 * Generate CSRF token for a request
 */
function generateTokenForRequest(req: Request, res: Response, csrfService: CSRFService): string {
  const user = req.user as AuthenticatedUser | undefined;
  const sessionId = user?.sessionId;
  const userId = user?.userId;
  
  return csrfService.generateAndSetToken(req, res, sessionId, userId);
}

/**
 * Check if request is from an exempt Chrome extension
 */
function isExtensionRequestExempt(
  req: Request,
  csrfService: CSRFService,
  allowedExtensionIds: string[]
): boolean {
  // First check if it's any extension request
  if (!csrfService.isExtensionRequest(req)) {
    return false;
  }

  // If no specific extension IDs are configured, allow all extensions
  if (allowedExtensionIds.length === 0) {
    return true;
  }

  // Validate against specific allowed extensions
  return csrfService.validateExtensionOrigin(req, allowedExtensionIds);
}

/**
 * Validate CSRF token for the request
 */
async function validateCSRFToken(
  req: Request,
  csrfService: CSRFService,
  requireAuthentication: boolean
): Promise<CSRFValidationResult> {
  const headerToken = csrfService.getTokenFromHeader(req);
  const cookieToken = csrfService.getTokenFromCookie(req);
  
  // Check if tokens are present
  if (!headerToken) {
    return {
      isValid: false,
      error: {
        type: 'missing_token',
        message: 'CSRF token missing from request header',
        details: { expectedHeader: csrfService.getConfig().headerName }
      }
    };
  }

  if (!cookieToken) {
    return {
      isValid: false,
      error: {
        type: 'missing_token',
        message: 'CSRF token missing from request cookie',
        details: { expectedCookie: csrfService.getConfig().cookieName }
      }
    };
  }

  // Get user context if authentication is required
  let sessionId: string | undefined;
  let userId: string | undefined;

  if (requireAuthentication) {
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) {
      return {
        isValid: false,
        error: {
          type: 'validation_error',
          message: 'Authentication required for CSRF validation'
        }
      };
    }
    sessionId = user.sessionId;
    userId = user.userId;
  }

  // Validate tokens using double-submit pattern
  const isValid = csrfService.validateToken(headerToken, cookieToken, sessionId, userId);
  
  if (!isValid) {
    return {
      isValid: false,
      error: {
        type: 'invalid_token',
        message: 'CSRF token validation failed',
        details: {
          reason: 'Token mismatch, expired, or invalid binding'
        }
      }
    };
  }

  return {
    isValid: true,
    token: headerToken
  };
}

/**
 * Handle CSRF validation errors
 */
function handleCSRFError(
  req: Request,
  res: Response,
  error: CSRFError,
  customErrorHandler?: (req: Request, res: Response, error: CSRFError) => void
): void {
  // Use custom error handler if provided
  if (customErrorHandler) {
    return customErrorHandler(req, res, error);
  }

  // Default error handling
  const statusCode = getStatusCodeForError(error.type);
  
  res.status(statusCode).json({
    error: 'CSRF Protection Error',
    type: error.type,
    message: error.message,
    details: error.details,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  });

  // Log the error for monitoring
  console.warn(`🛡️ CSRF validation failed: ${error.type} - ${error.message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
}

/**
 * Get appropriate status code for CSRF error type
 */
function getStatusCodeForError(errorType: CSRFError['type']): number {
  switch (errorType) {
    case 'missing_token':
    case 'token_mismatch':
    case 'invalid_token':
    case 'expired_token':
      return 403; // Forbidden
    case 'validation_error':
      return 400; // Bad Request
    default:
      return 403;
  }
}

/**
 * Generate unique request ID for error tracking
 */
function generateRequestId(): string {
  return `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create CSRF protection middleware with JWT integration
 */
export function createCSRFMiddlewareWithAuth(csrfService: CSRFService, options?: {
  skipPaths?: string[];
  allowedExtensionIds?: string[];
  customErrorHandler?: (req: Request, res: Response, error: CSRFError) => void;
}) {
  return createCSRFMiddleware({
    csrfService,
    requireAuthentication: true,
    skipPaths: ['/auth', '/health', '/info', ...(options?.skipPaths || [])],
    allowedExtensionIds: options?.allowedExtensionIds || [],
    customErrorHandler: options?.customErrorHandler
  });
}

/**
 * Create development-friendly CSRF middleware with relaxed validation
 */
export function createDevCSRFMiddleware(csrfService: CSRFService) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development CSRF middleware should not be used in production');
  }

  return createCSRFMiddleware({
    csrfService,
    requireAuthentication: false,
    skipPaths: ['/health', '/info'],
    allowedExtensionIds: [], // Allow all extensions in development
    customErrorHandler: (req, res, error) => {
      console.warn(`🔧 Dev CSRF Error: ${error.type} - ${error.message}`);
      res.status(200).json({
        warning: 'CSRF validation failed in development mode',
        error: error.type,
        message: error.message,
        devMode: true
      });
    }
  });
}

// Supporting interfaces

interface CSRFValidationResult {
  isValid: boolean;
  token?: string;
  error?: CSRFError;
}

// Export middleware creation functions
export {
  CSRFService,
  csrfService
} from './csrf-service';