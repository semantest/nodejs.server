"use strict";
/**
 * Tests for AuthModule (Express Integration)
 * Testing authentication module initialization and configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_module_1 = require("../auth-module");
const production_auth_service_1 = require("../production-auth-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
const auth_routes_1 = require("../routes/auth-routes");
// Mock dependencies
jest.mock('../production-auth-service');
jest.mock('../middleware/auth-middleware');
jest.mock('../routes/auth-routes');
jest.mock('express', () => ({
    Router: jest.fn(() => ({
        use: jest.fn()
    }))
}));
// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
});
afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
});
describe('AuthModule', () => {
    let mockApp;
    let mockAuthService;
    let mockAuthMiddleware;
    let mockAuthRoutes;
    let mockRouter;
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset environment variables
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRES_IN;
        delete process.env.REDIS_HOST;
        // Setup mocks
        mockApp = {
            use: jest.fn()
        };
        mockRouter = {
            use: jest.fn()
        };
        express_1.Router.mockReturnValue(mockRouter);
        // Setup service mocks
        mockAuthService = {
            performCleanup: jest.fn().mockResolvedValue(undefined)
        };
        production_auth_service_1.ProductionAuthService.mockImplementation(() => mockAuthService);
        // Setup middleware mocks
        mockAuthMiddleware = {
            cors: jest.fn().mockReturnValue('cors-middleware'),
            rateLimiter: jest.fn().mockReturnValue('rate-limiter'),
            requireAuth: jest.fn().mockReturnValue('require-auth'),
            requirePermissions: jest.fn().mockReturnValue('require-permissions'),
            requireRoles: jest.fn().mockReturnValue('require-roles'),
            requireApiKey: jest.fn().mockReturnValue('require-api-key'),
            optionalAuth: jest.fn().mockReturnValue('optional-auth')
        };
        auth_middleware_1.AuthMiddleware.mockImplementation(() => mockAuthMiddleware);
        // Setup routes mocks
        mockAuthRoutes = {
            getRouter: jest.fn().mockReturnValue('auth-router')
        };
        auth_routes_1.AuthRoutes.mockImplementation(() => mockAuthRoutes);
    });
    describe('Constructor', () => {
        it('should create auth module with default config', () => {
            const authModule = new auth_module_1.AuthModule();
            expect(production_auth_service_1.ProductionAuthService).toHaveBeenCalled();
            expect(auth_middleware_1.AuthMiddleware).toHaveBeenCalledWith(mockAuthService);
            expect(auth_routes_1.AuthRoutes).toHaveBeenCalledWith(mockAuthService);
        });
        it('should set environment variables from config', () => {
            const config = {
                jwtSecret: 'test-secret',
                jwtExpiresIn: '30m',
                jwtRefreshExpiresIn: '14d',
                redisHost: 'redis.example.com',
                redisPort: 6380,
                redisPassword: 'redis-password',
                bcryptSaltRounds: 10,
                passwordPepper: 'pepper',
                googleClientId: 'google-id',
                googleClientSecret: 'google-secret',
                googleRedirectUri: 'google-redirect',
                githubClientId: 'github-id',
                githubClientSecret: 'github-secret',
                githubRedirectUri: 'github-redirect',
                microsoftClientId: 'microsoft-id',
                microsoftClientSecret: 'microsoft-secret',
                microsoftRedirectUri: 'microsoft-redirect',
                discordClientId: 'discord-id',
                discordClientSecret: 'discord-secret',
                discordRedirectUri: 'discord-redirect',
                allowedOrigins: ['http://example.com', 'https://example.com'],
                apiKeyPrefix: 'test',
                apiKeyLength: 64
            };
            new auth_module_1.AuthModule(config);
            expect(process.env.JWT_SECRET).toBe('test-secret');
            expect(process.env.JWT_EXPIRES_IN).toBe('30m');
            expect(process.env.JWT_REFRESH_EXPIRES_IN).toBe('14d');
            expect(process.env.REDIS_HOST).toBe('redis.example.com');
            expect(process.env.REDIS_PORT).toBe('6380');
            expect(process.env.REDIS_PASSWORD).toBe('redis-password');
            expect(process.env.BCRYPT_SALT_ROUNDS).toBe('10');
            expect(process.env.PASSWORD_PEPPER).toBe('pepper');
            expect(process.env.GOOGLE_CLIENT_ID).toBe('google-id');
            expect(process.env.GOOGLE_CLIENT_SECRET).toBe('google-secret');
            expect(process.env.GOOGLE_REDIRECT_URI).toBe('google-redirect');
            expect(process.env.GITHUB_CLIENT_ID).toBe('github-id');
            expect(process.env.GITHUB_CLIENT_SECRET).toBe('github-secret');
            expect(process.env.GITHUB_REDIRECT_URI).toBe('github-redirect');
            expect(process.env.MICROSOFT_CLIENT_ID).toBe('microsoft-id');
            expect(process.env.MICROSOFT_CLIENT_SECRET).toBe('microsoft-secret');
            expect(process.env.MICROSOFT_REDIRECT_URI).toBe('microsoft-redirect');
            expect(process.env.DISCORD_CLIENT_ID).toBe('discord-id');
            expect(process.env.DISCORD_CLIENT_SECRET).toBe('discord-secret');
            expect(process.env.DISCORD_REDIRECT_URI).toBe('discord-redirect');
            expect(process.env.ALLOWED_ORIGINS).toBe('http://example.com,https://example.com');
            expect(process.env.API_KEY_PREFIX).toBe('test');
            expect(process.env.API_KEY_LENGTH).toBe('64');
        });
        it('should not set undefined environment variables', () => {
            new auth_module_1.AuthModule({});
            expect(process.env.JWT_SECRET).toBeUndefined();
            expect(process.env.GOOGLE_CLIENT_ID).toBeUndefined();
        });
    });
    describe('initialize', () => {
        it('should initialize auth module with Express app', () => {
            const authModule = new auth_module_1.AuthModule();
            authModule.initialize(mockApp);
            expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
            expect(mockApp.use).toHaveBeenCalledWith('/api/auth', 'auth-router');
            expect(mockApp.use).toHaveBeenCalledWith('/api', 'rate-limiter');
            expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // authErrorHandler
            expect(console.log).toHaveBeenCalledWith('🔐 Authentication module initialized');
        });
        it('should skip rate limiting when disabled', () => {
            const authModule = new auth_module_1.AuthModule({ enableRateLimiting: false });
            authModule.initialize(mockApp);
            expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
            expect(mockApp.use).toHaveBeenCalledWith('/api/auth', 'auth-router');
            expect(mockApp.use).not.toHaveBeenCalledWith('/api', 'rate-limiter');
        });
    });
    describe('Getters', () => {
        it('should return auth service', () => {
            const authModule = new auth_module_1.AuthModule();
            const service = authModule.getAuthService();
            expect(service).toBe(mockAuthService);
        });
        it('should return auth middleware', () => {
            const authModule = new auth_module_1.AuthModule();
            const middleware = authModule.getAuthMiddleware();
            expect(middleware).toBe(mockAuthMiddleware);
        });
        it('should return auth routes', () => {
            const authModule = new auth_module_1.AuthModule();
            const routes = authModule.getAuthRoutes();
            expect(routes).toBe(mockAuthRoutes);
        });
    });
    describe('Router creation methods', () => {
        let authModule;
        beforeEach(() => {
            authModule = new auth_module_1.AuthModule();
        });
        it('should create protected router', () => {
            const router = authModule.createProtectedRouter();
            expect(express_1.Router).toHaveBeenCalled();
            expect(router.use).toHaveBeenCalledWith('require-auth');
        });
        it('should create permission router', () => {
            const permissions = ['read:users', 'write:users'];
            const router = authModule.createPermissionRouter(permissions);
            expect(express_1.Router).toHaveBeenCalled();
            expect(router.use).toHaveBeenCalledWith('require-auth');
            expect(mockAuthMiddleware.requirePermissions).toHaveBeenCalledWith(permissions);
            expect(router.use).toHaveBeenCalledWith('require-permissions');
        });
        it('should create role router', () => {
            const roles = ['admin', 'moderator'];
            const router = authModule.createRoleRouter(roles);
            expect(express_1.Router).toHaveBeenCalled();
            expect(router.use).toHaveBeenCalledWith('require-auth');
            expect(mockAuthMiddleware.requireRoles).toHaveBeenCalledWith(roles);
            expect(router.use).toHaveBeenCalledWith('require-roles');
        });
        it('should create API key router', () => {
            const router = authModule.createApiKeyRouter();
            expect(express_1.Router).toHaveBeenCalled();
            expect(router.use).toHaveBeenCalledWith('require-api-key');
        });
        it('should create optional auth router', () => {
            const router = authModule.createOptionalAuthRouter();
            expect(express_1.Router).toHaveBeenCalled();
            expect(router.use).toHaveBeenCalledWith('optional-auth');
        });
    });
    describe('Cleanup tasks', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('should start cleanup tasks', () => {
            const authModule = new auth_module_1.AuthModule();
            authModule.startCleanupTasks();
            expect(console.log).toHaveBeenCalledWith('🧹 Authentication cleanup tasks started');
            // Fast-forward 1 hour
            jest.advanceTimersByTime(60 * 60 * 1000);
            expect(mockAuthService.performCleanup).toHaveBeenCalled();
        });
        it('should handle cleanup errors', async () => {
            mockAuthService.performCleanup.mockRejectedValue(new Error('Cleanup failed'));
            const authModule = new auth_module_1.AuthModule();
            authModule.startCleanupTasks();
            // Fast-forward 1 hour
            jest.advanceTimersByTime(60 * 60 * 1000);
            // Allow promises to resolve
            await Promise.resolve();
            expect(console.error).toHaveBeenCalledWith('Authentication cleanup error:', expect.any(Error));
        });
    });
    describe('shutdown', () => {
        it('should shutdown auth module', async () => {
            const authModule = new auth_module_1.AuthModule();
            await authModule.shutdown();
            expect(mockAuthService.performCleanup).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('🔐 Authentication module shutdown complete');
        });
        it('should handle shutdown errors', async () => {
            mockAuthService.performCleanup.mockRejectedValue(new Error('Shutdown failed'));
            const authModule = new auth_module_1.AuthModule();
            await authModule.shutdown();
            expect(console.error).toHaveBeenCalledWith('Error during authentication module shutdown:', expect.any(Error));
        });
    });
});
describe('Factory functions', () => {
    it('should create auth module with factory function', () => {
        const config = { jwtSecret: 'factory-secret' };
        const authModule = (0, auth_module_1.createAuthModule)(config);
        expect(authModule).toBeInstanceOf(auth_module_1.AuthModule);
        expect(process.env.JWT_SECRET).toBe('factory-secret');
    });
    it('should use authentication middleware', () => {
        const mockApp = { use: jest.fn() };
        const config = { jwtSecret: 'middleware-secret' };
        const authModule = (0, auth_module_1.useAuthentication)(mockApp, config);
        expect(authModule).toBeInstanceOf(auth_module_1.AuthModule);
        expect(mockApp.use).toHaveBeenCalled();
        expect(process.env.JWT_SECRET).toBe('middleware-secret');
    });
    it('should merge with default config', () => {
        const mockApp = { use: jest.fn() };
        (0, auth_module_1.useAuthentication)(mockApp, { jwtSecret: 'override' });
        // Check that default values are still set
        expect(process.env.JWT_EXPIRES_IN).toBe(auth_module_1.DEFAULT_AUTH_CONFIG.jwtExpiresIn);
        expect(process.env.API_KEY_PREFIX).toBe(auth_module_1.DEFAULT_AUTH_CONFIG.apiKeyPrefix);
        expect(process.env.JWT_SECRET).toBe('override');
    });
});
describe('DEFAULT_AUTH_CONFIG', () => {
    it('should have expected default values', () => {
        expect(auth_module_1.DEFAULT_AUTH_CONFIG).toEqual({
            jwtExpiresIn: '15m',
            jwtRefreshExpiresIn: '7d',
            redisHost: 'localhost',
            redisPort: 6379,
            bcryptSaltRounds: 12,
            allowedOrigins: ['http://localhost:3000'],
            enableRateLimiting: true,
            apiKeyPrefix: 'sk',
            apiKeyLength: 32
        });
    });
});
//# sourceMappingURL=auth-module-new.test.js.map