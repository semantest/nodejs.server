/**
 * @fileoverview Authentication middleware for Express API
 * @description Middleware to handle authentication and authorization
 * @author Semantest Team
 */
import { Request, Response, NextFunction } from 'express';
import { ProductionAuthService } from '../production-auth-service';
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
export declare class AuthMiddleware {
    private readonly authService;
    constructor(authService: ProductionAuthService);
    /**
     * Middleware to require authentication
     */
    requireAuth(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    /**
     * Middleware to require specific permissions
     */
    requirePermissions(permissions: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    /**
     * Middleware to require specific roles
     */
    requireRoles(roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    /**
     * Middleware to handle API key authentication
     */
    requireApiKey(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    /**
     * Middleware to handle rate limiting
     */
    rateLimiter(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    /**
     * Middleware to handle optional authentication
     */
    optionalAuth(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Middleware to handle CORS and preflight requests
     */
    cors(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Extract token from Authorization header
     */
    private extractTokenFromHeader;
    /**
     * Validate token and create auth context
     */
    private validateTokenAndCreateContext;
    /**
     * Validate API key and create auth context
     */
    private validateApiKeyAndCreateContext;
    /**
     * Get client IP address
     */
    private getClientIp;
}
/**
 * Error handler for authentication errors
 */
export declare function authErrorHandler(error: Error, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
//# sourceMappingURL=auth-middleware.d.ts.map