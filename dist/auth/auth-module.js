"use strict";
/**
 * @fileoverview Authentication module for Express application
 * @description Main module that integrates all authentication components
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUTH_CONFIG = exports.AuthModule = void 0;
exports.createAuthModule = createAuthModule;
exports.useAuthentication = useAuthentication;
const express_1 = require("express");
const production_auth_service_1 = require("./production-auth-service");
const auth_middleware_1 = require("./middleware/auth-middleware");
const auth_routes_1 = require("./routes/auth-routes");
const auth_middleware_2 = require("./middleware/auth-middleware");
/**
 * Authentication module for Express applications
 */
class AuthModule {
    constructor(config = {}) {
        this.config = config;
        this.setEnvironmentVariables();
        // Initialize services
        this.authService = new production_auth_service_1.ProductionAuthService();
        this.authMiddleware = new auth_middleware_1.AuthMiddleware(this.authService);
        this.authRoutes = new auth_routes_1.AuthRoutes(this.authService);
    }
    /**
     * Initialize authentication module with Express app
     */
    initialize(app) {
        // Add CORS middleware
        app.use(this.authMiddleware.cors());
        // Add authentication routes
        app.use('/api/auth', this.authRoutes.getRouter());
        // Add rate limiting middleware if enabled
        if (this.config.enableRateLimiting !== false) {
            app.use('/api', this.authMiddleware.rateLimiter());
        }
        // Add authentication error handler
        app.use(auth_middleware_2.authErrorHandler);
        console.log('🔐 Authentication module initialized');
    }
    /**
     * Get authentication service
     */
    getAuthService() {
        return this.authService;
    }
    /**
     * Get authentication middleware
     */
    getAuthMiddleware() {
        return this.authMiddleware;
    }
    /**
     * Get authentication routes
     */
    getAuthRoutes() {
        return this.authRoutes;
    }
    /**
     * Create a protected router with authentication middleware
     */
    createProtectedRouter() {
        const router = (0, express_1.Router)();
        router.use(this.authMiddleware.requireAuth());
        return router;
    }
    /**
     * Create a router that requires specific permissions
     */
    createPermissionRouter(permissions) {
        const router = (0, express_1.Router)();
        router.use(this.authMiddleware.requireAuth());
        router.use(this.authMiddleware.requirePermissions(permissions));
        return router;
    }
    /**
     * Create a router that requires specific roles
     */
    createRoleRouter(roles) {
        const router = (0, express_1.Router)();
        router.use(this.authMiddleware.requireAuth());
        router.use(this.authMiddleware.requireRoles(roles));
        return router;
    }
    /**
     * Create a router that requires API key authentication
     */
    createApiKeyRouter() {
        const router = (0, express_1.Router)();
        router.use(this.authMiddleware.requireApiKey());
        return router;
    }
    /**
     * Create a router with optional authentication
     */
    createOptionalAuthRouter() {
        const router = (0, express_1.Router)();
        router.use(this.authMiddleware.optionalAuth());
        return router;
    }
    /**
     * Start cleanup tasks
     */
    startCleanupTasks() {
        // Run cleanup every hour
        setInterval(async () => {
            try {
                await this.authService.performCleanup();
            }
            catch (error) {
                console.error('Authentication cleanup error:', error);
            }
        }, 60 * 60 * 1000); // 1 hour
        console.log('🧹 Authentication cleanup tasks started');
    }
    /**
     * Shutdown authentication module
     */
    async shutdown() {
        try {
            // Perform final cleanup
            await this.authService.performCleanup();
            console.log('🔐 Authentication module shutdown complete');
        }
        catch (error) {
            console.error('Error during authentication module shutdown:', error);
        }
    }
    /**
     * Set environment variables from config
     */
    setEnvironmentVariables() {
        if (this.config.jwtSecret) {
            process.env.JWT_SECRET = this.config.jwtSecret;
        }
        if (this.config.jwtExpiresIn) {
            process.env.JWT_EXPIRES_IN = this.config.jwtExpiresIn;
        }
        if (this.config.jwtRefreshExpiresIn) {
            process.env.JWT_REFRESH_EXPIRES_IN = this.config.jwtRefreshExpiresIn;
        }
        if (this.config.redisHost) {
            process.env.REDIS_HOST = this.config.redisHost;
        }
        if (this.config.redisPort) {
            process.env.REDIS_PORT = this.config.redisPort.toString();
        }
        if (this.config.redisPassword) {
            process.env.REDIS_PASSWORD = this.config.redisPassword;
        }
        if (this.config.bcryptSaltRounds) {
            process.env.BCRYPT_SALT_ROUNDS = this.config.bcryptSaltRounds.toString();
        }
        if (this.config.passwordPepper) {
            process.env.PASSWORD_PEPPER = this.config.passwordPepper;
        }
        if (this.config.googleClientId) {
            process.env.GOOGLE_CLIENT_ID = this.config.googleClientId;
        }
        if (this.config.googleClientSecret) {
            process.env.GOOGLE_CLIENT_SECRET = this.config.googleClientSecret;
        }
        if (this.config.googleRedirectUri) {
            process.env.GOOGLE_REDIRECT_URI = this.config.googleRedirectUri;
        }
        if (this.config.githubClientId) {
            process.env.GITHUB_CLIENT_ID = this.config.githubClientId;
        }
        if (this.config.githubClientSecret) {
            process.env.GITHUB_CLIENT_SECRET = this.config.githubClientSecret;
        }
        if (this.config.githubRedirectUri) {
            process.env.GITHUB_REDIRECT_URI = this.config.githubRedirectUri;
        }
        if (this.config.microsoftClientId) {
            process.env.MICROSOFT_CLIENT_ID = this.config.microsoftClientId;
        }
        if (this.config.microsoftClientSecret) {
            process.env.MICROSOFT_CLIENT_SECRET = this.config.microsoftClientSecret;
        }
        if (this.config.microsoftRedirectUri) {
            process.env.MICROSOFT_REDIRECT_URI = this.config.microsoftRedirectUri;
        }
        if (this.config.discordClientId) {
            process.env.DISCORD_CLIENT_ID = this.config.discordClientId;
        }
        if (this.config.discordClientSecret) {
            process.env.DISCORD_CLIENT_SECRET = this.config.discordClientSecret;
        }
        if (this.config.discordRedirectUri) {
            process.env.DISCORD_REDIRECT_URI = this.config.discordRedirectUri;
        }
        if (this.config.allowedOrigins) {
            process.env.ALLOWED_ORIGINS = this.config.allowedOrigins.join(',');
        }
        if (this.config.apiKeyPrefix) {
            process.env.API_KEY_PREFIX = this.config.apiKeyPrefix;
        }
        if (this.config.apiKeyLength) {
            process.env.API_KEY_LENGTH = this.config.apiKeyLength.toString();
        }
    }
}
exports.AuthModule = AuthModule;
/**
 * Factory function to create authentication module
 */
function createAuthModule(config = {}) {
    return new AuthModule(config);
}
/**
 * Default authentication module configuration
 */
exports.DEFAULT_AUTH_CONFIG = {
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    redisHost: 'localhost',
    redisPort: 6379,
    bcryptSaltRounds: 12,
    allowedOrigins: ['http://localhost:3000'],
    enableRateLimiting: true,
    apiKeyPrefix: 'sk',
    apiKeyLength: 32
};
/**
 * Express middleware to add authentication to existing apps
 */
function useAuthentication(app, config = {}) {
    const authModule = new AuthModule({ ...exports.DEFAULT_AUTH_CONFIG, ...config });
    authModule.initialize(app);
    return authModule;
}
// Export all authentication types and interfaces
__exportStar(require("./domain/auth-entities"), exports);
__exportStar(require("./middleware/auth-middleware"), exports);
__exportStar(require("./routes/auth-routes"), exports);
__exportStar(require("./production-auth-service"), exports);
//# sourceMappingURL=auth-module.js.map