"use strict";
/**
 * @fileoverview JWT-based authentication service with refresh tokens
 * @description Handles authentication, authorization, and API key management
 * @author Web-Buddy Team
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const auth_events_1 = require("../core/events/auth-events");
const jwt_token_manager_1 = require("./adapters/jwt-token-manager");
const api_key_manager_1 = require("./adapters/api-key-manager");
const password_hash_manager_1 = require("./adapters/password-hash-manager");
const rbac_manager_1 = require("./adapters/rbac-manager");
const oauth2_manager_1 = require("./adapters/oauth2-manager");
/**
 * Authentication service that handles all authentication and authorization
 * Uses JWT tokens with refresh token rotation for security
 */
let AuthService = class AuthService extends typescript_eda_stubs_1.Application {
    constructor() {
        super();
        this.metadata = new Map([
            ['name', 'Web-Buddy Authentication Service'],
            ['version', '1.0.0'],
            ['capabilities', 'jwt-auth,api-keys,oauth2,rbac'],
            ['tokenExpiry', '15m'], // Access token expiry
            ['refreshTokenExpiry', '7d'] // Refresh token expiry
        ]);
        this.jwtManager = new jwt_token_manager_1.JwtTokenManager();
        this.apiKeyManager = new api_key_manager_1.ApiKeyManager();
        this.passwordHashManager = new password_hash_manager_1.PasswordHashManager();
        this.rbacManager = new rbac_manager_1.RoleBasedAccessControl();
        this.oauth2Manager = new oauth2_manager_1.OAuth2Manager();
    }
    /**
     * Handle authentication requests with credentials
     */
    async handleAuthentication(event) {
        try {
            const { credentials, authMethod } = event;
            switch (authMethod) {
                case 'password':
                    await this.authenticateWithPassword(credentials);
                    break;
                case 'apiKey':
                    await this.authenticateWithApiKey(credentials);
                    break;
                case 'oauth2':
                    await this.authenticateWithOAuth2(credentials);
                    break;
                default:
                    throw new Error(`Unsupported authentication method: ${authMethod}`);
            }
        }
        catch (error) {
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }
    /**
     * Handle authorization requests for protected resources
     */
    async handleAuthorization(event) {
        try {
            const { token, requiredPermissions, resourceId } = event;
            // Validate token
            const tokenPayload = await this.jwtManager.validateToken(token);
            // Check permissions
            const hasPermission = await this.rbacManager.checkPermissions(tokenPayload.userId, requiredPermissions, resourceId);
            if (!hasPermission) {
                throw new Error('Insufficient permissions');
            }
            console.log(`✅ Authorization granted for user ${tokenPayload.userId}`);
        }
        catch (error) {
            console.error('❌ Authorization failed:', error);
            throw error;
        }
    }
    /**
     * Handle token refresh requests
     */
    async handleTokenRefresh(event) {
        try {
            const { refreshToken } = event;
            // Validate refresh token
            const tokenPayload = await this.jwtManager.validateRefreshToken(refreshToken);
            // Generate new access token
            const newAccessToken = await this.jwtManager.generateAccessToken(tokenPayload.userId);
            // Rotate refresh token for security
            const newRefreshToken = await this.jwtManager.generateRefreshToken(tokenPayload.userId);
            // Invalidate old refresh token
            await this.jwtManager.invalidateRefreshToken(refreshToken);
            console.log(`✅ Token refreshed for user ${tokenPayload.userId}`);
        }
        catch (error) {
            console.error('❌ Token refresh failed:', error);
            throw error;
        }
    }
    /**
     * Authenticate user with password
     */
    async authenticateWithPassword(credentials) {
        const { email, password } = credentials;
        // Find user by email
        const user = await this.findUserByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        // Verify password
        const isPasswordValid = await this.passwordHashManager.verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }
        // Check if user is active
        if (!user.isActive) {
            throw new Error('User account is disabled');
        }
        // Generate tokens
        const accessToken = await this.jwtManager.generateAccessToken(user.id);
        const refreshToken = await this.jwtManager.generateRefreshToken(user.id);
        console.log(`✅ User ${user.email} authenticated successfully`);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes
            tokenType: 'Bearer'
        };
    }
    /**
     * Authenticate request with API key
     */
    async authenticateWithApiKey(credentials) {
        const { apiKey } = credentials;
        // Validate API key
        const keyInfo = await this.apiKeyManager.validateApiKey(apiKey);
        if (!keyInfo) {
            throw new Error('Invalid API key');
        }
        // Check if key is active
        if (!keyInfo.isActive) {
            throw new Error('API key is disabled');
        }
        // Check rate limits
        await this.apiKeyManager.checkRateLimit(apiKey);
        console.log(`✅ API key authenticated: ${keyInfo.name}`);
    }
    /**
     * Authenticate with OAuth2 provider
     */
    async authenticateWithOAuth2(credentials) {
        const { provider, code, redirectUri } = credentials;
        // Exchange code for access token
        const providerToken = await this.oauth2Manager.exchangeCodeForToken(provider, code, redirectUri);
        // Get user info from provider
        const providerUser = await this.oauth2Manager.getUserInfo(provider, providerToken.access_token);
        // Find or create user
        const user = await this.findOrCreateOAuthUser(provider, providerUser);
        // Generate our own tokens
        const accessToken = await this.jwtManager.generateAccessToken(user.id);
        const refreshToken = await this.jwtManager.generateRefreshToken(user.id);
        console.log(`✅ OAuth2 user ${user.email} authenticated via ${provider}`);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes
            tokenType: 'Bearer'
        };
    }
    /**
     * Create new user account
     */
    async createUser(userData) {
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
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Save user (in real implementation, this would use a database)
        await this.saveUser(user);
        console.log(`✅ User created: ${user.email}`);
        return user;
    }
    /**
     * Create new API key
     */
    async createApiKey(userId, keyData) {
        return await this.apiKeyManager.createApiKey(userId, keyData);
    }
    /**
     * Revoke API key
     */
    async revokeApiKey(apiKey) {
        await this.apiKeyManager.revokeApiKey(apiKey);
    }
    /**
     * Update user roles
     */
    async updateUserRoles(userId, roles) {
        await this.rbacManager.updateUserRoles(userId, roles);
    }
    /**
     * Helper methods (in real implementation, these would use a database)
     */
    async findUserByEmail(email) {
        // Mock implementation
        return null;
    }
    async findOrCreateOAuthUser(provider, providerUser) {
        // Mock implementation
        return {
            id: this.generateUserId(),
            email: providerUser.email,
            passwordHash: '',
            firstName: providerUser.given_name || '',
            lastName: providerUser.family_name || '',
            roles: ['user'],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    async saveUser(user) {
        // Mock implementation
        console.log(`💾 Saving user: ${user.email}`);
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
};
exports.AuthService = AuthService;
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.AuthenticationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.AuthenticationRequestedEvent]),
    __metadata("design:returntype", Promise)
], AuthService.prototype, "handleAuthentication", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.AuthorizationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.AuthorizationRequestedEvent]),
    __metadata("design:returntype", Promise)
], AuthService.prototype, "handleAuthorization", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(auth_events_1.TokenRefreshRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_events_1.TokenRefreshRequestedEvent]),
    __metadata("design:returntype", Promise)
], AuthService.prototype, "handleTokenRefresh", null);
exports.AuthService = AuthService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(jwt_token_manager_1.JwtTokenManager),
    (0, typescript_eda_stubs_1.Enable)(api_key_manager_1.ApiKeyManager),
    (0, typescript_eda_stubs_1.Enable)(password_hash_manager_1.PasswordHashManager),
    (0, typescript_eda_stubs_1.Enable)(rbac_manager_1.RoleBasedAccessControl),
    (0, typescript_eda_stubs_1.Enable)(oauth2_manager_1.OAuth2Manager),
    __metadata("design:paramtypes", [])
], AuthService);
//# sourceMappingURL=auth-service.js.map