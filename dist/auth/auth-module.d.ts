/**
 * @fileoverview Authentication module for Express application
 * @description Main module that integrates all authentication components
 * @author Semantest Team
 */
import { Express, Router } from 'express';
import { ProductionAuthService } from './production-auth-service';
import { AuthMiddleware } from './middleware/auth-middleware';
import { AuthRoutes } from './routes/auth-routes';
/**
 * Authentication module configuration
 */
export interface AuthModuleConfig {
    jwtSecret?: string;
    jwtExpiresIn?: string;
    jwtRefreshExpiresIn?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    bcryptSaltRounds?: number;
    passwordPepper?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleRedirectUri?: string;
    githubClientId?: string;
    githubClientSecret?: string;
    githubRedirectUri?: string;
    microsoftClientId?: string;
    microsoftClientSecret?: string;
    microsoftRedirectUri?: string;
    discordClientId?: string;
    discordClientSecret?: string;
    discordRedirectUri?: string;
    allowedOrigins?: string[];
    enableRateLimiting?: boolean;
    apiKeyPrefix?: string;
    apiKeyLength?: number;
}
/**
 * Authentication module for Express applications
 */
export declare class AuthModule {
    private readonly authService;
    private readonly authMiddleware;
    private readonly authRoutes;
    private readonly config;
    constructor(config?: AuthModuleConfig);
    /**
     * Initialize authentication module with Express app
     */
    initialize(app: Express): void;
    /**
     * Get authentication service
     */
    getAuthService(): ProductionAuthService;
    /**
     * Get authentication middleware
     */
    getAuthMiddleware(): AuthMiddleware;
    /**
     * Get authentication routes
     */
    getAuthRoutes(): AuthRoutes;
    /**
     * Create a protected router with authentication middleware
     */
    createProtectedRouter(): Router;
    /**
     * Create a router that requires specific permissions
     */
    createPermissionRouter(permissions: string[]): Router;
    /**
     * Create a router that requires specific roles
     */
    createRoleRouter(roles: string[]): Router;
    /**
     * Create a router that requires API key authentication
     */
    createApiKeyRouter(): Router;
    /**
     * Create a router with optional authentication
     */
    createOptionalAuthRouter(): Router;
    /**
     * Start cleanup tasks
     */
    startCleanupTasks(): void;
    /**
     * Shutdown authentication module
     */
    shutdown(): Promise<void>;
    /**
     * Set environment variables from config
     */
    private setEnvironmentVariables;
}
/**
 * Factory function to create authentication module
 */
export declare function createAuthModule(config?: AuthModuleConfig): AuthModule;
/**
 * Default authentication module configuration
 */
export declare const DEFAULT_AUTH_CONFIG: AuthModuleConfig;
/**
 * Express middleware to add authentication to existing apps
 */
export declare function useAuthentication(app: Express, config?: AuthModuleConfig): AuthModule;
export * from './domain/auth-entities';
export * from './middleware/auth-middleware';
export * from './routes/auth-routes';
export * from './production-auth-service';
//# sourceMappingURL=auth-module.d.ts.map