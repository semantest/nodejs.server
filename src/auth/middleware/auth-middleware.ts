/**
 * @fileoverview Authentication middleware for Express API
 * @description Middleware to handle authentication and authorization
 * @author Semantest Team
 */

import { Request, Response, NextFunction } from 'express';
import { ProductionAuthService } from '../production-auth-service';
import { AuthorizationRequestedEvent } from '../core/events/auth-events';
import { AuthContext } from '../domain/auth-entities';

/**
 * Extended Express Request with authentication context
 */
export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Authentication and authorization middleware
 */
export class AuthMiddleware {
  private readonly authService: ProductionAuthService;

  constructor(authService: ProductionAuthService) {
    this.authService = authService;
  }

  /**
   * Middleware to require authentication
   */
  public requireAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No authorization header provided'
          });
        }

        const token = this.extractTokenFromHeader(authHeader);
        if (!token) {
          return res.status(401).json({
            error: 'Invalid token format',
            message: 'Authorization header must be in format: Bearer <token>'
          });
        }

        // Validate token and create auth context
        const authContext = await this.validateTokenAndCreateContext(token, req);
        
        // Add auth context to request
        req.auth = authContext;
        req.user = {
          id: authContext.userId,
          email: '', // Would be populated from user lookup
          roles: authContext.roles,
          permissions: authContext.permissions
        };

        next();
      } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
          error: 'Authentication failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Middleware to require specific permissions
   */
  public requirePermissions(permissions: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'This endpoint requires authentication'
          });
        }

        const authEvent = new AuthorizationRequestedEvent(
          this.extractTokenFromHeader(req.headers.authorization!),
          permissions,
          req.params.id || req.params.resourceId,
          {
            ipAddress: this.getClientIp(req),
            userAgent: req.get('User-Agent') || 'unknown'
          }
        );

        const authContext = await this.authService.handleAuthorization(authEvent);
        
        // Update request with full auth context
        req.auth = authContext;
        
        next();
      } catch (error) {
        console.error('Authorization error:', error);
        return res.status(403).json({
          error: 'Permission denied',
          message: error.message
        });
      }
    };
  }

  /**
   * Middleware to require specific roles
   */
  public requireRoles(roles: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'This endpoint requires authentication'
          });
        }

        const userRoles = req.auth.roles || [];
        const hasRequiredRole = roles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
          return res.status(403).json({
            error: 'Insufficient role',
            message: `This endpoint requires one of the following roles: ${roles.join(', ')}`
          });
        }

        next();
      } catch (error) {
        console.error('Role check error:', error);
        return res.status(403).json({
          error: 'Role check failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Middleware to handle API key authentication
   */
  public requireApiKey() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          return res.status(401).json({
            error: 'API key required',
            message: 'X-API-Key header is required'
          });
        }

        // Validate API key through auth service
        const authContext = await this.validateApiKeyAndCreateContext(apiKey, req);
        
        // Add auth context to request
        req.auth = authContext;
        req.user = {
          id: authContext.userId,
          email: '', // Would be populated from user lookup
          roles: authContext.roles,
          permissions: authContext.permissions
        };

        next();
      } catch (error) {
        console.error('API key authentication error:', error);
        return res.status(401).json({
          error: 'API key authentication failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Middleware to handle rate limiting
   */
  public rateLimiter() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (apiKey) {
          // Check rate limits for API key
          const rateLimitResult = await this.authService.checkRateLimit(apiKey);
          
          if (!rateLimitResult.allowed) {
            return res.status(429).json({
              error: 'Rate limit exceeded',
              message: 'Too many requests',
              limits: rateLimitResult.limits,
              remaining: rateLimitResult.remaining,
              resetTime: rateLimitResult.resetTime
            });
          }

          // Add rate limit headers
          res.set({
            'X-RateLimit-Limit': rateLimitResult.limits.requestsPerMinute.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.minute.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.minute.toISOString()
          });

          // Increment rate limit counter
          await this.authService.incrementRateLimit(apiKey);
        }

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Don't fail the request if rate limiting fails
        next();
      }
    };
  }

  /**
   * Middleware to handle optional authentication
   */
  public optionalAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
          const token = this.extractTokenFromHeader(authHeader);
          if (token) {
            try {
              const authContext = await this.validateTokenAndCreateContext(token, req);
              req.auth = authContext;
              req.user = {
                id: authContext.userId,
                email: '',
                roles: authContext.roles,
                permissions: authContext.permissions
              };
            } catch (error) {
              // Log the error but don't fail the request
              console.log('Optional auth failed:', error.message);
            }
          }
        }

        next();
      } catch (error) {
        console.error('Optional auth error:', error);
        // Don't fail the request if optional auth fails
        next();
      }
    };
  }

  /**
   * Middleware to handle CORS and preflight requests
   */
  public cors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }

      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    };
  }

  /**
   * Extract token from Authorization header
   */
  private extractTokenFromHeader(authHeader: string): string | null {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return null;
  }

  /**
   * Validate token and create auth context
   */
  private async validateTokenAndCreateContext(token: string, req: Request): Promise<AuthContext> {
    const authEvent = new AuthorizationRequestedEvent(
      token,
      [], // No specific permissions required for basic auth
      undefined, // No specific resource
      {
        ipAddress: this.getClientIp(req),
        userAgent: req.get('User-Agent') || 'unknown'
      }
    );

    return await this.authService.handleAuthorization(authEvent);
  }

  /**
   * Validate API key and create auth context
   */
  private async validateApiKeyAndCreateContext(apiKey: string, req: Request): Promise<AuthContext> {
    // This would validate the API key through the auth service
    // For now, we'll create a mock context
    return {
      userId: 'api-key-user',
      roles: ['api-user'],
      permissions: ['read:api'],
      apiKeyId: apiKey,
      ipAddress: this.getClientIp(req),
      userAgent: req.get('User-Agent') || 'unknown'
    };
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIp) {
      return realIp;
    }
    
    return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  }
}

/**
 * Error handler for authentication errors
 */
export function authErrorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Authentication error:', error);

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'The provided token has expired'
    });
  }

  if (error.name === 'NotBeforeError') {
    return res.status(401).json({
      error: 'Token not active',
      message: 'The provided token is not active yet'
    });
  }

  return res.status(500).json({
    error: 'Authentication system error',
    message: 'An internal authentication error occurred'
  });
}