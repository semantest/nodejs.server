/**
 * @fileoverview JWT Authentication Middleware for Express
 * @description Protects routes and handles authentication for HTTP and WebSocket connections
 * @author Web-Buddy Team
 */

import { Request, Response, NextFunction } from 'express';
import { TokenManager, DecodedToken } from './token-manager';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
    }
  }
}

export interface AuthenticatedUser {
  userId: string;
  extensionId?: string;
  email?: string;
  roles?: string[];
  sessionId: string;
  tokenJTI: string;
  tokenExp: number;
}

/**
 * JWT Middleware Options
 */
export interface JWTMiddlewareOptions {
  tokenManager: TokenManager;
  requireAuth?: boolean;
  roles?: string[];
  skipPaths?: string[];
}

/**
 * Create JWT authentication middleware
 */
export function createJWTMiddleware(options: JWTMiddlewareOptions) {
  const { tokenManager, requireAuth = true, roles = [], skipPaths = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if path should skip authentication
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Extract token from header
      const authHeader = req.headers.authorization;
      const token = TokenManager.extractTokenFromHeader(authHeader);

      if (!token) {
        if (requireAuth) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No authentication token provided'
          });
        }
        return next();
      }

      // Verify token
      try {
        const decoded = await tokenManager.verifyAccessToken(token);
        
        // Create authenticated user object
        const user: AuthenticatedUser = {
          userId: decoded.userId,
          extensionId: decoded.extensionId,
          email: decoded.email,
          roles: decoded.roles || [],
          sessionId: decoded.sessionId,
          tokenJTI: decoded.jti!,
          tokenExp: decoded.exp
        };

        // Check role requirements
        if (roles.length > 0 && !hasRequiredRoles(user.roles, roles)) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'User does not have required roles'
          });
        }

        // Attach user and token to request
        req.user = user;
        req.token = token;

        next();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid token';
        
        if (requireAuth) {
          return res.status(401).json({
            error: 'Authentication failed',
            message: errorMessage
          });
        }
        
        // If auth not required, continue without user
        next();
      }
    } catch (error) {
      console.error('JWT middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication processing failed'
      });
    }
  };
}

/**
 * Create WebSocket authentication handler
 */
export function createWebSocketAuthHandler(tokenManager: TokenManager) {
  return async (ws: WebSocket, request: IncomingMessage): Promise<AuthenticatedUser | null> => {
    try {
      // Extract token from query parameter or Authorization header
      let token: string | null = null;

      // Check Authorization header first
      const authHeader = request.headers.authorization;
      if (authHeader) {
        token = TokenManager.extractTokenFromHeader(authHeader);
      }

      // Fallback to query parameter
      if (!token) {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        token = url.searchParams.get('token');
      }

      if (!token) {
        ws.close(1008, 'Authentication required');
        return null;
      }

      // Verify token
      const decoded = await tokenManager.verifyAccessToken(token);

      // Create authenticated user object
      const user: AuthenticatedUser = {
        userId: decoded.userId,
        extensionId: decoded.extensionId,
        email: decoded.email,
        roles: decoded.roles || [],
        sessionId: decoded.sessionId,
        tokenJTI: decoded.jti!,
        tokenExp: decoded.exp
      };

      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      ws.close(1008, errorMessage);
      return null;
    }
  };
}

/**
 * Middleware to require specific roles
 */
export function requireRoles(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    if (!hasRequiredRoles(req.user.roles, requiredRoles)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required roles: ${requiredRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Middleware to require extension authentication
 */
export function requireExtension() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    if (!req.user.extensionId) {
      return res.status(403).json({
        error: 'Extension authentication required',
        message: 'This endpoint requires extension authentication'
      });
    }

    next();
  };
}

/**
 * Middleware for optional authentication
 */
export function optionalAuth(tokenManager: TokenManager) {
  return createJWTMiddleware({
    tokenManager,
    requireAuth: false
  });
}

/**
 * Refresh token middleware
 */
export function refreshTokenMiddleware(tokenManager: TokenManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token required',
          message: 'No refresh token provided'
        });
      }

      // Verify refresh token
      try {
        const decoded = await tokenManager.verifyRefreshToken(refreshToken);
        
        // Attach decoded refresh token to request
        req.user = {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          roles: [],
          tokenJTI: decoded.jti!,
          tokenExp: decoded.exp
        };

        next();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid refresh token';
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: errorMessage
        });
      }
    } catch (error) {
      console.error('Refresh token middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Refresh token processing failed'
      });
    }
  };
}

/**
 * Check if user has required roles
 */
function hasRequiredRoles(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Create authentication error handler
 */
export function authErrorHandler() {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error.name === 'UnauthorizedError') {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    } else {
      next(error);
    }
  };
}