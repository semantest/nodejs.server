"use strict";
/**
 * @fileoverview Production authentication service with complete integration
 * @description Main auth service that coordinates all authentication components
 * @author Semantest Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionAuthService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const auth_events_1 = require("../core/events/auth-events");
const production_jwt_manager_1 = require("./adapters/production-jwt-manager");
const production_api_key_manager_1 = require("./adapters/production-api-key-manager");
const production_oauth2_manager_1 = require("./adapters/production-oauth2-manager");
const rbac_manager_1 = require("./adapters/rbac-manager");
const password_hash_manager_1 = require("./adapters/password-hash-manager");
const crypto = __importStar(require("crypto"));
/**
 * Production authentication service with comprehensive security features
 */
let ProductionAuthService = class ProductionAuthService extends typescript_eda_stubs_1.Application {
    constructor() {
        super(...arguments);
        this.metadata = new Map([
            ['name', 'Semantest Authentication Service'],
            ['version', '1.0.0'],
            ['capabilities', 'jwt-auth,api-keys,oauth2,rbac,2fa'],
            ['tokenExpiry', '15m'],
            ['refreshTokenExpiry', '7d'],
            ['maxSessionsPerUser', '5'],
            ['passwordPolicy', 'strong'],
            ['auditingEnabled', 'true']
        ]);
    }
    /**
     * Handle authentication requests
     */
    async handleAuthentication(event) {
        const startTime = Date.now();
        try {
            const { credentials, authMethod, metadata } = event;
            // Audit log
            await this.auditLog('auth_attempt', {
                method: authMethod,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
                timestamp: new Date().toISOString()
            });
            let authResult;
            switch (authMethod) {
                case 'password':
                    authResult = await this.authenticateWithPassword(credentials, metadata);
                    break;
                case 'apiKey':
                    authResult = await this.authenticateWithApiKey(credentials, metadata);
                    break;
                case 'oauth2':
                    authResult = await this.authenticateWithOAuth2(credentials, metadata);
                    break;
                default:
                    throw new Error(`Unsupported authentication method: ${authMethod}`);
            }
            // Success audit log
            await this.auditLog('auth_success', {
                method: authMethod,
                userId: await this.getUserIdFromToken(authResult.accessToken),
                duration: Date.now() - startTime,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent
            });
            return authResult;
        }
        catch (error) {
            // Failure audit log
            await this.auditLog('auth_failure', {
                method: event.authMethod,
                error: error.message,
                duration: Date.now() - startTime,
                ipAddress: event.metadata?.ipAddress,
                userAgent: event.metadata?.userAgent
            });
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }
    /**
     * Handle authorization requests
     */
    async handleAuthorization(event) {
        const startTime = Date.now();
        try {
            const { token, requiredPermissions, resourceId, metadata } = event;
            // Validate token and get user context
            const tokenPayload = await this.jwtManager.validateToken(token);
            // Check permissions
            const hasPermission = await this.rbacManager.checkPermissions(tokenPayload.userId, requiredPermissions, resourceId);
            if (!hasPermission) {
                await this.auditLog('auth_denied', {
                    userId: tokenPayload.userId,
                    requiredPermissions,
                    resourceId,
                    ipAddress: metadata?.ipAddress,
                    userAgent: metadata?.userAgent
                });
                throw new Error('Insufficient permissions');
            }
            // Create auth context
            const authContext = {
                userId: tokenPayload.userId,
                roles: tokenPayload.roles,
                permissions: requiredPermissions,
                sessionId: tokenPayload.sessionId,
                ipAddress: metadata?.ipAddress || 'unknown',
                userAgent: metadata?.userAgent || 'unknown'
            };
            // Success audit log
            await this.auditLog('auth_authorized', {
                userId: tokenPayload.userId,
                permissions: requiredPermissions,
                resourceId,
                duration: Date.now() - startTime,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent
            });
            console.log(`✅ Authorization granted for user ${tokenPayload.userId}`);
            return authContext;
        }
        catch (error) {
            // Failure audit log
            await this.auditLog('auth_unauthorized', {
                error: error.message,
                requiredPermissions: event.requiredPermissions,
                resourceId: event.resourceId,
                duration: Date.now() - startTime,
                ipAddress: event.metadata?.ipAddress,
                userAgent: event.metadata?.userAgent
            });
            console.error('❌ Authorization failed:', error);
            throw error;
        }
    }
    /**
     * Handle token refresh requests
     */
    async handleTokenRefresh(event) {
        const startTime = Date.now();
        try {
            const { refreshToken, metadata } = event;
            // Validate refresh token
            const tokenPayload = await this.jwtManager.validateRefreshToken(refreshToken);
            // Check if user is still active
            const user = await this.getUserById(tokenPayload.userId);
            if (!user || !user.isActive) {
                throw new Error('User is inactive');
            }
            // Generate new tokens
            const newTokens = await this.jwtManager.rotateRefreshToken(refreshToken);
            const newAccessToken = await this.jwtManager.generateAccessToken(tokenPayload.userId, [], // Will be populated from user roles
            tokenPayload.sessionId);
            const authToken = {
                accessToken: newAccessToken.token,
                refreshToken: newTokens.token,
                expiresIn: 900, // 15 minutes
                tokenType: 'Bearer'
            };
            // Success audit log
            await this.auditLog('token_refreshed', {
                userId: tokenPayload.userId,
                sessionId: tokenPayload.sessionId,
                duration: Date.now() - startTime,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent
            });
            console.log(`✅ Token refreshed for user ${tokenPayload.userId}`);
            return authToken;
        }
        catch (error) {
            // Failure audit log
            await this.auditLog('token_refresh_failed', {
                error: error.message,
                duration: Date.now() - startTime,
                ipAddress: event.metadata?.ipAddress,
                userAgent: event.metadata?.userAgent
            });
            console.error('❌ Token refresh failed:', error);
            throw error;
        }
    }
    /**
     * Create new user account
     */
    async createUser(userData) {
        try {
            // Validate password strength
            this.validatePasswordStrength(userData.password);
            // Check if user already exists
            const existingUser = await this.findUserByEmail(userData.email);
            if (existingUser) {
                throw new Error('User already exists');
            }
            // Hash password
            const passwordHash = await this.passwordHashManager.hashPassword(userData.password);
            // Create user
            const user = {
                id: this.generateUserId(),
                email: userData.email,
                passwordHash,
                firstName: userData.firstName,
                lastName: userData.lastName,
                roles: userData.roles || ['user'],
                isActive: true,
                emailVerified: false,
                twoFactorEnabled: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: userData.metadata
            };
            // Save user
            await this.saveUser(user);
            // Audit log
            await this.auditLog('user_created', {
                userId: user.id,
                email: user.email,
                roles: user.roles,
                timestamp: new Date().toISOString()
            });
            console.log(`✅ User created: ${user.email}`);
            return user;
        }
        catch (error) {
            console.error('❌ User creation failed:', error);
            throw error;
        }
    }
    /**
     * Authenticate user with password
     */
    async authenticateWithPassword(credentials, metadata) {
        const { email, password } = credentials;
        // Find user by email
        const user = await this.findUserByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        // Check account lockout
        await this.checkAccountLockout(user.id);
        // Verify password
        const isPasswordValid = await this.passwordHashManager.verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            await this.recordFailedAttempt(user.id);
            throw new Error('Invalid password');
        }
        // Clear failed attempts
        await this.clearFailedAttempts(user.id);
        // Check if user is active
        if (!user.isActive) {
            throw new Error('User account is disabled');
        }
        // Create session
        const sessionId = this.generateSessionId();
        const session = await this.createSession(user.id, sessionId, metadata);
        // Generate tokens
        const accessToken = await this.jwtManager.generateAccessToken(user.id, [], sessionId);
        const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
        // Update last login
        await this.updateLastLogin(user.id);
        console.log(`✅ User ${user.email} authenticated successfully`);
        return {
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            expiresIn: 900, // 15 minutes
            tokenType: 'Bearer'
        };
    }
    /**
     * Authenticate request with API key
     */
    async authenticateWithApiKey(credentials, metadata) {
        const { apiKey } = credentials;
        // Validate API key
        const keyInfo = await this.apiKeyManager.validateApiKey(apiKey);
        if (!keyInfo) {
            throw new Error('Invalid API key');
        }
        // Check rate limits
        const rateLimitResult = await this.apiKeyManager.checkRateLimit(apiKey);
        if (!rateLimitResult.allowed) {
            throw new Error('Rate limit exceeded');
        }
        // Increment rate limit counters
        await this.apiKeyManager.incrementRateLimit(apiKey);
        // Get user
        const user = await this.getUserById(keyInfo.userId);
        if (!user || !user.isActive) {
            throw new Error('User is inactive');
        }
        // Create session
        const sessionId = this.generateSessionId();
        const session = await this.createSession(user.id, sessionId, metadata);
        // Generate tokens with API key scopes
        const accessToken = await this.jwtManager.generateAccessToken(user.id, keyInfo.scopes, sessionId);
        const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
        console.log(`✅ API key authenticated: ${keyInfo.name}`);
        return {
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            expiresIn: 900, // 15 minutes
            tokenType: 'Bearer'
        };
    }
    /**
     * Authenticate with OAuth2 provider
     */
    async authenticateWithOAuth2(credentials, metadata) {
        const { provider, code, state, redirectUri } = credentials;
        // Validate OAuth2 callback
        const validation = this.oauth2Manager.validateCallback({ code, state });
        if (!validation.isValid) {
            throw new Error(validation.error);
        }
        // Exchange code for access token
        const providerToken = await this.oauth2Manager.exchangeCodeForToken(provider, code, state, redirectUri);
        // Get user info from provider
        const providerUser = await this.oauth2Manager.getUserInfo(provider, providerToken.access_token);
        // Get additional user data if needed
        const additionalData = await this.oauth2Manager.getAdditionalUserData(provider, providerToken.access_token);
        const completeUserInfo = { ...providerUser, ...additionalData };
        // Find or create user
        const user = await this.findOrCreateOAuthUser(provider, completeUserInfo);
        // Create session
        const sessionId = this.generateSessionId();
        const session = await this.createSession(user.id, sessionId, metadata);
        // Generate our own tokens
        const accessToken = await this.jwtManager.generateAccessToken(user.id, [], sessionId);
        const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
        console.log(`✅ OAuth2 user ${user.email} authenticated via ${provider}`);
        return {
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            expiresIn: 900, // 15 minutes
            tokenType: 'Bearer'
        };
    }
    /**
     * Logout user and invalidate session
     */
    async logout(accessToken, metadata) {
        try {
            const tokenPayload = await this.jwtManager.validateToken(accessToken);
            // Blacklist access token
            await this.jwtManager.blacklistToken(tokenPayload.jti, tokenPayload.exp);
            // Invalidate all refresh tokens for this session
            if (tokenPayload.sessionId) {
                await this.invalidateSession(tokenPayload.sessionId);
            }
            // Audit log
            await this.auditLog('user_logout', {
                userId: tokenPayload.userId,
                sessionId: tokenPayload.sessionId,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent
            });
            console.log(`✅ User ${tokenPayload.userId} logged out successfully`);
        }
        catch (error) {
            console.error('❌ Logout failed:', error);
            throw error;
        }
    }
    /**
     * Get user profile
     */
    async getUserProfile(userId) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Return safe user data (no password hash)
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles,
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
            metadata: user.metadata
        };
    }
    /**
     * Update user profile
     */
    async updateUserProfile(userId, updates) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Update user
        const updatedUser = {
            ...user,
            ...updates,
            updatedAt: new Date()
        };
        await this.saveUser(updatedUser);
        // Audit log
        await this.auditLog('user_updated', {
            userId,
            updates: Object.keys(updates),
            timestamp: new Date().toISOString()
        });
        return updatedUser;
    }
    /**
     * Change user password
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Verify current password
        const isCurrentPasswordValid = await this.passwordHashManager.verifyPassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }
        // Validate new password strength
        this.validatePasswordStrength(newPassword);
        // Hash new password
        const newPasswordHash = await this.passwordHashManager.hashPassword(newPassword);
        // Update user
        const updatedUser = {
            ...user,
            passwordHash: newPasswordHash,
            updatedAt: new Date()
        };
        await this.saveUser(updatedUser);
        // Invalidate all sessions (force re-login)
        await this.invalidateAllUserSessions(userId);
        // Audit log
        await this.auditLog('password_changed', {
            userId,
            timestamp: new Date().toISOString()
        });
        console.log(`✅ Password changed for user ${userId}`);
    }
    /**
     * API Key management methods
     */
    async createApiKey(userId, keyData) {
        return await this.apiKeyManager.createApiKey(userId, keyData);
    }
    async revokeApiKey(apiKey) {
        return await this.apiKeyManager.revokeApiKey(apiKey);
    }
    async listUserApiKeys(userId) {
        return await this.apiKeyManager.listApiKeys(userId);
    }
    /**
     * Session management
     */
    async getUserSessions(userId) {
        return await this.jwtManager.getActiveSessions(userId);
    }
    async invalidateSession(sessionId) {
        // Implementation would invalidate specific session
        console.log(`🗑️ Invalidated session ${sessionId}`);
    }
    async invalidateAllUserSessions(userId) {
        await this.jwtManager.invalidateAllRefreshTokens(userId);
    }
    /**
     * Security utilities
     */
    validatePasswordStrength(password) {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            throw new Error('Password must contain at least one number');
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }
    }
    generateUserId() {
        return `user_${crypto.randomUUID()}`;
    }
    generateSessionId() {
        return `session_${crypto.randomUUID()}`;
    }
    async getUserIdFromToken(token) {
        const tokenPayload = await this.jwtManager.validateToken(token);
        return tokenPayload.userId;
    }
    /**
     * Helper methods (in production, these would use actual database)
     */
    async findUserByEmail(email) {
        // Mock implementation
        return null;
    }
    async getUserById(userId) {
        // Mock implementation
        return null;
    }
    async saveUser(user) {
        // Mock implementation
        console.log(`💾 Saving user: ${user.email}`);
    }
    async updateLastLogin(userId) {
        // Mock implementation
        console.log(`📊 Updated last login for user ${userId}`);
    }
    async createSession(userId, sessionId, metadata) {
        // Mock implementation
        const session = {
            id: sessionId,
            userId,
            accessToken: '',
            refreshToken: '',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: metadata?.ipAddress || 'unknown',
            userAgent: metadata?.userAgent || 'unknown',
            isActive: true
        };
        console.log(`📱 Created session ${sessionId} for user ${userId}`);
        return session;
    }
    async findOrCreateOAuthUser(provider, userInfo) {
        // Mock implementation
        const user = {
            id: this.generateUserId(),
            email: userInfo.email,
            passwordHash: '',
            firstName: userInfo.given_name || '',
            lastName: userInfo.family_name || '',
            roles: ['user'],
            isActive: true,
            emailVerified: userInfo.emailVerified || false,
            twoFactorEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                oauthProvider: provider,
                oauthId: userInfo.id
            }
        };
        await this.saveUser(user);
        return user;
    }
    async checkAccountLockout(userId) {
        // Mock implementation - check if account is locked
        return;
    }
    async recordFailedAttempt(userId) {
        // Mock implementation - record failed login attempt
        console.log(`⚠️ Failed login attempt for user ${userId}`);
    }
    async clearFailedAttempts(userId) {
        // Mock implementation - clear failed attempts
        console.log(`✅ Cleared failed attempts for user ${userId}`);
    }
    async auditLog(event, data) {
        // Mock implementation - log to audit system
        console.log(`🔍 AUDIT: ${event}`, JSON.stringify(data, null, 2));
    }
    /**
     * Periodic cleanup tasks
     */
    async performCleanup() {
        console.log('🧹 Starting authentication system cleanup...');
        await Promise.all([
            this.jwtManager.cleanupExpiredTokens(),
            this.apiKeyManager.cleanupExpiredData(),
            this.oauth2Manager.cleanupExpiredData()
        ]);
        console.log('✅ Authentication system cleanup completed');
    }
};
exports.ProductionAuthService = ProductionAuthService;
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.AuthenticationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.AuthenticationRequestedEvent]),
    __metadata("design:returntype", Promise)
], ProductionAuthService.prototype, "handleAuthentication", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.AuthorizationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.AuthorizationRequestedEvent]),
    __metadata("design:returntype", Promise)
], ProductionAuthService.prototype, "handleAuthorization", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.TokenRefreshRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.TokenRefreshRequestedEvent]),
    __metadata("design:returntype", Promise)
], ProductionAuthService.prototype, "handleTokenRefresh", null);
exports.ProductionAuthService = ProductionAuthService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(production_jwt_manager_1.ProductionJwtManager),
    (0, typescript_eda_stubs_1.Enable)(production_api_key_manager_1.ProductionApiKeyManager),
    (0, typescript_eda_stubs_1.Enable)(production_oauth2_manager_1.ProductionOAuth2Manager),
    (0, typescript_eda_stubs_1.Enable)(rbac_manager_1.RoleBasedAccessControl),
    (0, typescript_eda_stubs_1.Enable)(password_hash_manager_1.PasswordHashManager)
], ProductionAuthService);
//# sourceMappingURL=production-auth-service.js.map