"use strict";
/**
 * @fileoverview Authentication routes for Express API
 * @description RESTful endpoints for authentication and user management
 * @author Semantest Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth-middleware");
const auth_events_1 = require("../core/events/auth-events");
const express_validator_1 = require("express-validator");
/**
 * Authentication routes controller
 */
class AuthRoutes {
    constructor(authService) {
        this.router = (0, express_1.Router)();
        this.authService = authService;
        this.authMiddleware = new auth_middleware_1.AuthMiddleware(authService);
        this.setupRoutes();
    }
    /**
     * Get Express router
     */
    getRouter() {
        return this.router;
    }
    /**
     * Setup authentication routes
     */
    setupRoutes() {
        // Public routes
        this.router.post('/login', this.validateLogin(), this.login.bind(this));
        this.router.post('/register', this.validateRegistration(), this.register.bind(this));
        this.router.post('/refresh', this.validateRefresh(), this.refresh.bind(this));
        this.router.post('/forgot-password', this.validateForgotPassword(), this.forgotPassword.bind(this));
        this.router.post('/reset-password', this.validateResetPassword(), this.resetPassword.bind(this));
        // OAuth2 routes
        this.router.get('/oauth2/providers', this.getOAuthProviders.bind(this));
        this.router.get('/oauth2/:provider/authorize', this.authorizeOAuth.bind(this));
        this.router.get('/oauth2/:provider/callback', this.handleOAuthCallback.bind(this));
        // Protected routes
        this.router.use(this.authMiddleware.requireAuth());
        this.router.post('/logout', this.logout.bind(this));
        this.router.get('/profile', this.getProfile.bind(this));
        this.router.put('/profile', this.validateProfileUpdate(), this.updateProfile.bind(this));
        this.router.put('/change-password', this.validatePasswordChange(), this.changePassword.bind(this));
        this.router.get('/sessions', this.getSessions.bind(this));
        this.router.delete('/sessions/:sessionId', this.invalidateSession.bind(this));
        // API key management routes
        this.router.get('/api-keys', this.getApiKeys.bind(this));
        this.router.post('/api-keys', this.validateApiKeyCreation(), this.createApiKey.bind(this));
        this.router.delete('/api-keys/:keyId', this.revokeApiKey.bind(this));
        this.router.get('/api-keys/:keyId/usage', this.getApiKeyUsage.bind(this));
    }
    /**
     * Login endpoint
     */
    async login(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            const { email, password } = req.body;
            const authEvent = new auth_events_1.AuthenticationRequestedEvent({ email, password }, 'password', {
                ipAddress: this.getClientIp(req),
                userAgent: req.get('User-Agent') || 'unknown'
            });
            const authToken = await this.authService.handleAuthentication(authEvent);
            res.json({
                success: true,
                message: 'Login successful',
                data: authToken
            });
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(401).json({
                error: 'Login failed',
                message: error.message
            });
        }
    }
    /**
     * Register endpoint
     */
    async register(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            const { email, password, firstName, lastName } = req.body;
            const user = await this.authService.createUser({
                email,
                password,
                firstName,
                lastName,
                roles: ['user']
            });
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    roles: user.roles
                }
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({
                error: 'Registration failed',
                message: error.message
            });
        }
    }
    /**
     * Refresh token endpoint
     */
    async refresh(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            const { refreshToken } = req.body;
            const refreshEvent = new auth_events_1.TokenRefreshRequestedEvent(refreshToken, {
                ipAddress: this.getClientIp(req),
                userAgent: req.get('User-Agent') || 'unknown'
            });
            const authToken = await this.authService.handleTokenRefresh(refreshEvent);
            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: authToken
            });
        }
        catch (error) {
            console.error('Token refresh error:', error);
            res.status(401).json({
                error: 'Token refresh failed',
                message: error.message
            });
        }
    }
    /**
     * Logout endpoint
     */
    async logout(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const token = this.extractTokenFromHeader(authHeader);
            if (!token) {
                res.status(400).json({ error: 'No token provided' });
                return;
            }
            await this.authService.logout(token, {
                ipAddress: this.getClientIp(req),
                userAgent: req.get('User-Agent') || 'unknown'
            });
            res.json({
                success: true,
                message: 'Logout successful'
            });
        }
        catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                error: 'Logout failed',
                message: error.message
            });
        }
    }
    /**
     * Get user profile endpoint
     */
    async getProfile(req, res) {
        try {
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const profile = await this.authService.getUserProfile(req.auth.userId);
            res.json({
                success: true,
                data: profile
            });
        }
        catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                error: 'Failed to get profile',
                message: error.message
            });
        }
    }
    /**
     * Update user profile endpoint
     */
    async updateProfile(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { firstName, lastName, metadata } = req.body;
            const updatedUser = await this.authService.updateUserProfile(req.auth.userId, {
                firstName,
                lastName,
                metadata
            });
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    firstName: updatedUser.firstName,
                    lastName: updatedUser.lastName,
                    updatedAt: updatedUser.updatedAt
                }
            });
        }
        catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                error: 'Failed to update profile',
                message: error.message
            });
        }
    }
    /**
     * Change password endpoint
     */
    async changePassword(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { currentPassword, newPassword } = req.body;
            await this.authService.changePassword(req.auth.userId, currentPassword, newPassword);
            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        }
        catch (error) {
            console.error('Change password error:', error);
            res.status(400).json({
                error: 'Failed to change password',
                message: error.message
            });
        }
    }
    /**
     * Get user sessions endpoint
     */
    async getSessions(req, res) {
        try {
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const sessions = await this.authService.getUserSessions(req.auth.userId);
            res.json({
                success: true,
                data: sessions
            });
        }
        catch (error) {
            console.error('Get sessions error:', error);
            res.status(500).json({
                error: 'Failed to get sessions',
                message: error.message
            });
        }
    }
    /**
     * Invalidate session endpoint
     */
    async invalidateSession(req, res) {
        try {
            const { sessionId } = req.params;
            await this.authService.invalidateSession(sessionId);
            res.json({
                success: true,
                message: 'Session invalidated successfully'
            });
        }
        catch (error) {
            console.error('Invalidate session error:', error);
            res.status(500).json({
                error: 'Failed to invalidate session',
                message: error.message
            });
        }
    }
    /**
     * Get API keys endpoint
     */
    async getApiKeys(req, res) {
        try {
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const apiKeys = await this.authService.listUserApiKeys(req.auth.userId);
            res.json({
                success: true,
                data: apiKeys
            });
        }
        catch (error) {
            console.error('Get API keys error:', error);
            res.status(500).json({
                error: 'Failed to get API keys',
                message: error.message
            });
        }
    }
    /**
     * Create API key endpoint
     */
    async createApiKey(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            if (!req.auth) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { name, scopes, tier, expiresAt, description } = req.body;
            const apiKey = await this.authService.createApiKey(req.auth.userId, {
                name,
                scopes,
                tier,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                description
            });
            res.status(201).json({
                success: true,
                message: 'API key created successfully',
                data: apiKey
            });
        }
        catch (error) {
            console.error('Create API key error:', error);
            res.status(500).json({
                error: 'Failed to create API key',
                message: error.message
            });
        }
    }
    /**
     * Revoke API key endpoint
     */
    async revokeApiKey(req, res) {
        try {
            const { keyId } = req.params;
            await this.authService.revokeApiKey(keyId);
            res.json({
                success: true,
                message: 'API key revoked successfully'
            });
        }
        catch (error) {
            console.error('Revoke API key error:', error);
            res.status(500).json({
                error: 'Failed to revoke API key',
                message: error.message
            });
        }
    }
    /**
     * Get API key usage endpoint
     */
    async getApiKeyUsage(req, res) {
        try {
            const { keyId } = req.params;
            // This would get usage stats for the API key
            res.json({
                success: true,
                data: {
                    keyId,
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0
                }
            });
        }
        catch (error) {
            console.error('Get API key usage error:', error);
            res.status(500).json({
                error: 'Failed to get API key usage',
                message: error.message
            });
        }
    }
    /**
     * Get OAuth providers endpoint
     */
    async getOAuthProviders(req, res) {
        try {
            // This would get available OAuth providers
            res.json({
                success: true,
                data: {
                    providers: ['google', 'github', 'microsoft', 'discord']
                }
            });
        }
        catch (error) {
            console.error('Get OAuth providers error:', error);
            res.status(500).json({
                error: 'Failed to get OAuth providers',
                message: error.message
            });
        }
    }
    /**
     * OAuth authorization endpoint
     */
    async authorizeOAuth(req, res) {
        try {
            const { provider } = req.params;
            // This would redirect to OAuth provider
            res.json({
                success: true,
                data: {
                    authorizationUrl: `https://oauth.${provider}.com/authorize?client_id=...`
                }
            });
        }
        catch (error) {
            console.error('OAuth authorization error:', error);
            res.status(500).json({
                error: 'Failed to authorize OAuth',
                message: error.message
            });
        }
    }
    /**
     * OAuth callback endpoint
     */
    async handleOAuthCallback(req, res) {
        try {
            const { provider } = req.params;
            const { code, state } = req.query;
            // This would handle OAuth callback
            res.json({
                success: true,
                message: 'OAuth callback handled',
                data: {
                    provider,
                    code,
                    state
                }
            });
        }
        catch (error) {
            console.error('OAuth callback error:', error);
            res.status(500).json({
                error: 'Failed to handle OAuth callback',
                message: error.message
            });
        }
    }
    /**
     * Forgot password endpoint
     */
    async forgotPassword(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            const { email } = req.body;
            // This would send password reset email
            res.json({
                success: true,
                message: 'Password reset email sent'
            });
        }
        catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                error: 'Failed to send password reset email',
                message: error.message
            });
        }
    }
    /**
     * Reset password endpoint
     */
    async resetPassword(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ error: 'Validation failed', details: errors.array() });
                return;
            }
            const { token, newPassword } = req.body;
            // This would reset password with token
            res.json({
                success: true,
                message: 'Password reset successful'
            });
        }
        catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                error: 'Failed to reset password',
                message: error.message
            });
        }
    }
    /**
     * Validation rules for login
     */
    validateLogin() {
        return [
            (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
            (0, express_validator_1.body)('password').isLength({ min: 8 }).trim()
        ];
    }
    /**
     * Validation rules for registration
     */
    validateRegistration() {
        return [
            (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
            (0, express_validator_1.body)('password').isLength({ min: 8 }).trim(),
            (0, express_validator_1.body)('firstName').isLength({ min: 1 }).trim(),
            (0, express_validator_1.body)('lastName').isLength({ min: 1 }).trim()
        ];
    }
    /**
     * Validation rules for token refresh
     */
    validateRefresh() {
        return [
            (0, express_validator_1.body)('refreshToken').isLength({ min: 1 }).trim()
        ];
    }
    /**
     * Validation rules for profile update
     */
    validateProfileUpdate() {
        return [
            (0, express_validator_1.body)('firstName').optional().isLength({ min: 1 }).trim(),
            (0, express_validator_1.body)('lastName').optional().isLength({ min: 1 }).trim(),
            (0, express_validator_1.body)('metadata').optional().isObject()
        ];
    }
    /**
     * Validation rules for password change
     */
    validatePasswordChange() {
        return [
            (0, express_validator_1.body)('currentPassword').isLength({ min: 8 }).trim(),
            (0, express_validator_1.body)('newPassword').isLength({ min: 8 }).trim()
        ];
    }
    /**
     * Validation rules for API key creation
     */
    validateApiKeyCreation() {
        return [
            (0, express_validator_1.body)('name').isLength({ min: 1 }).trim(),
            (0, express_validator_1.body)('scopes').isArray(),
            (0, express_validator_1.body)('tier').isIn(['free', 'premium', 'enterprise']),
            (0, express_validator_1.body)('expiresAt').optional().isISO8601(),
            (0, express_validator_1.body)('description').optional().isLength({ min: 1 }).trim()
        ];
    }
    /**
     * Validation rules for forgot password
     */
    validateForgotPassword() {
        return [
            (0, express_validator_1.body)('email').isEmail().normalizeEmail()
        ];
    }
    /**
     * Validation rules for reset password
     */
    validateResetPassword() {
        return [
            (0, express_validator_1.body)('token').isLength({ min: 1 }).trim(),
            (0, express_validator_1.body)('newPassword').isLength({ min: 8 }).trim()
        ];
    }
    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            return parts[1];
        }
        return null;
    }
    /**
     * Get client IP address
     */
    getClientIp(req) {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        if (realIp) {
            return realIp;
        }
        return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    }
}
exports.AuthRoutes = AuthRoutes;
//# sourceMappingURL=auth-routes.js.map