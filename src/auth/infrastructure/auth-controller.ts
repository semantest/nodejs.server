/**
 * @fileoverview Authentication Controller
 * @description Express routes for authentication endpoints with rate limiting
 * @author Web-Buddy Team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../application/auth-service';
import { TokenManager } from './token-manager';
import { createJWTMiddleware, refreshTokenMiddleware } from './jwt-middleware';
import { validateRequest } from './validation-middleware';
import Joi from 'joi';

/**
 * Create authentication router with all auth endpoints
 */
export function createAuthRouter(
  authService: AuthService,
  tokenManager: TokenManager
): Router {
  const router = Router();

  // Note: Rate limiting is now handled by the global rate limiting middleware
  // which provides more sophisticated multi-tier rate limiting with different
  // algorithms (token bucket, sliding window) and proper monitoring.
  // Endpoint-specific limits are configured in rate-limit-config.ts

  // Validation schemas
  const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().optional(),
    extensionId: Joi.string().optional()
  });

  const loginSchema = Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().optional(),
    extensionId: Joi.string().optional(),
    apiKey: Joi.string().optional()
  }).or('email', 'extensionId');

  const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  });

  /**
   * POST /auth/register
   * Register a new user
   */
  router.post('/register',
    validateRequest(registerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await authService.register(req.body);
        
        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            extensionId: user.extensionId
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/login
   * Login user and get tokens
   */
  router.post('/login',
    validateRequest(loginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await authService.login(req.body);
        
        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/auth/refresh'
        });
        
        res.json({
          message: 'Login successful',
          user: result.user,
          accessToken: result.tokens.accessToken,
          accessTokenExpiry: result.tokens.accessTokenExpiry,
          sessionId: result.sessionId
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout user and revoke tokens
   */
  router.post('/logout',
    createJWTMiddleware({ tokenManager }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        await authService.logout(req.user.sessionId);
        
        // Clear refresh token cookie
        res.clearCookie('refreshToken', {
          path: '/auth/refresh'
        });
        
        res.json({
          message: 'Logout successful'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/logout-all
   * Logout all sessions for user
   */
  router.post('/logout-all',
    createJWTMiddleware({ tokenManager }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        await authService.logoutAllSessions(req.user.userId);
        
        // Clear refresh token cookie
        res.clearCookie('refreshToken', {
          path: '/auth/refresh'
        });
        
        res.json({
          message: 'All sessions terminated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh',
    refreshTokenMiddleware(tokenManager),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        const tokens = await authService.refreshToken(refreshToken, req.user.userId);
        
        // Update refresh token cookie
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/auth/refresh'
        });
        
        res.json({
          accessToken: tokens.accessToken,
          accessTokenExpiry: tokens.accessTokenExpiry
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /auth/me
   * Get current user information
   */
  router.get('/me',
    createJWTMiddleware({ tokenManager }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        res.json({
          user: {
            id: req.user.userId,
            email: req.user.email,
            extensionId: req.user.extensionId,
            roles: req.user.roles,
            sessionId: req.user.sessionId
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/change-password
   * Change user password
   */
  router.post('/change-password',
    createJWTMiddleware({ tokenManager }),
    validateRequest(changePasswordSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        await authService.changePassword(
          req.user.userId,
          req.body.currentPassword,
          req.body.newPassword
        );
        
        // Clear refresh token cookie (user will need to login again)
        res.clearCookie('refreshToken', {
          path: '/auth/refresh'
        });
        
        res.json({
          message: 'Password changed successfully. Please login again.'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /auth/generate-api-key
   * Generate API key for extension authentication
   */
  router.post('/generate-api-key',
    createJWTMiddleware({ tokenManager }),
    validateRequest(Joi.object({ extensionId: Joi.string().required() })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const apiKey = await authService.generateApiKey(
          req.user.userId,
          req.body.extensionId
        );
        
        res.json({
          message: 'API key generated successfully',
          apiKey,
          extensionId: req.body.extensionId,
          warning: 'Store this API key securely. It will not be shown again.'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /auth/sessions
   * Get active sessions for user
   */
  router.get('/sessions',
    createJWTMiddleware({ tokenManager }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const sessions = await authService.getActiveSessions(req.user.userId);
        
        res.json({
          sessions: sessions.map(session => ({
            id: session.id,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            isCurrent: session.id === req.user.sessionId
          }))
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /auth/sessions/:sessionId
   * Terminate specific session
   */
  router.delete('/sessions/:sessionId',
    createJWTMiddleware({ tokenManager }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        await authService.terminateSession(req.params.sessionId, req.user.userId);
        
        res.json({
          message: 'Session terminated successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /auth/verify-token
   * Verify if access token is valid
   */
  router.get('/verify-token',
    createJWTMiddleware({ tokenManager, requireAuth: false }),
    (req: Request, res: Response) => {
      if (req.user) {
        res.json({
          valid: true,
          user: {
            id: req.user.userId,
            email: req.user.email,
            roles: req.user.roles
          }
        });
      } else {
        res.json({
          valid: false
        });
      }
    }
  );

  /**
   * Error handler for auth routes
   */
  router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Auth error:', error);
    
    // Handle specific errors
    if (error.message.includes('User already exists')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    
    if (error.message.includes('Authentication failed') || 
        error.message.includes('Invalid') ||
        error.message.includes('not found')) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
    
    if (error.message.includes('locked')) {
      return res.status(423).json({
        error: 'Account locked',
        message: error.message
      });
    }
    
    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  });

  return router;
}

/**
 * Authentication configuration for HTTP server adapter
 */
export interface AuthConfig {
  skipPaths?: string[];
  requireAuth?: boolean;
  roles?: string[];
}

/**
 * Configure authentication for application
 */
export function configureAuth(app: Router, tokenManager: TokenManager, config: AuthConfig = {}): void {
  const { skipPaths = ['/health', '/auth'], requireAuth = true } = config;
  
  // Add JWT middleware to all routes except skip paths
  app.use(createJWTMiddleware({
    tokenManager,
    requireAuth,
    skipPaths,
    roles: config.roles
  }));
}