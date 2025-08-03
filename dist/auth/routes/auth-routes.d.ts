/**
 * @fileoverview Authentication routes for Express API
 * @description RESTful endpoints for authentication and user management
 * @author Semantest Team
 */
import { Router } from 'express';
import { ProductionAuthService } from '../production-auth-service';
/**
 * Authentication routes controller
 */
export declare class AuthRoutes {
    private readonly router;
    private readonly authService;
    private readonly authMiddleware;
    constructor(authService: ProductionAuthService);
    /**
     * Get Express router
     */
    getRouter(): Router;
    /**
     * Setup authentication routes
     */
    private setupRoutes;
    /**
     * Login endpoint
     */
    private login;
    /**
     * Register endpoint
     */
    private register;
    /**
     * Refresh token endpoint
     */
    private refresh;
    /**
     * Logout endpoint
     */
    private logout;
    /**
     * Get user profile endpoint
     */
    private getProfile;
    /**
     * Update user profile endpoint
     */
    private updateProfile;
    /**
     * Change password endpoint
     */
    private changePassword;
    /**
     * Get user sessions endpoint
     */
    private getSessions;
    /**
     * Invalidate session endpoint
     */
    private invalidateSession;
    /**
     * Get API keys endpoint
     */
    private getApiKeys;
    /**
     * Create API key endpoint
     */
    private createApiKey;
    /**
     * Revoke API key endpoint
     */
    private revokeApiKey;
    /**
     * Get API key usage endpoint
     */
    private getApiKeyUsage;
    /**
     * Get OAuth providers endpoint
     */
    private getOAuthProviders;
    /**
     * OAuth authorization endpoint
     */
    private authorizeOAuth;
    /**
     * OAuth callback endpoint
     */
    private handleOAuthCallback;
    /**
     * Forgot password endpoint
     */
    private forgotPassword;
    /**
     * Reset password endpoint
     */
    private resetPassword;
    /**
     * Validation rules for login
     */
    private validateLogin;
    /**
     * Validation rules for registration
     */
    private validateRegistration;
    /**
     * Validation rules for token refresh
     */
    private validateRefresh;
    /**
     * Validation rules for profile update
     */
    private validateProfileUpdate;
    /**
     * Validation rules for password change
     */
    private validatePasswordChange;
    /**
     * Validation rules for API key creation
     */
    private validateApiKeyCreation;
    /**
     * Validation rules for forgot password
     */
    private validateForgotPassword;
    /**
     * Validation rules for reset password
     */
    private validateResetPassword;
    /**
     * Extract token from Authorization header
     */
    private extractTokenFromHeader;
    /**
     * Get client IP address
     */
    private getClientIp;
}
//# sourceMappingURL=auth-routes.d.ts.map