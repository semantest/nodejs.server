"use strict";
/**
 * Emergency tests for AuthModule
 * Created by Quinn (QA) during test coverage crisis - 8:05 AM
 * Target: Boost nodejs.server coverage from 13.41%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const auth_module_1 = require("../auth-module");
const auth_routes_1 = require("../routes/auth-routes");
// Mock the dependencies
jest.mock('../production-auth-service');
jest.mock('../middleware/auth-middleware');
jest.mock('../routes/auth-routes');
jest.mock('../middleware/auth-middleware', () => ({
    AuthMiddleware: jest.fn().mockImplementation(() => ({
        cors: jest.fn().mockReturnValue('cors-middleware'),
        rateLimiter: jest.fn().mockReturnValue('rate-limiter'),
        requireAuth: jest.fn().mockReturnValue('require-auth'),
        requirePermissions: jest.fn().mockReturnValue('require-permissions'),
        requireRoles: jest.fn().mockReturnValue('require-roles'),
        requireApiKey: jest.fn().mockReturnValue('require-api-key'),
        optionalAuth: jest.fn().mockReturnValue('optional-auth')
    })),
    authErrorHandler: jest.fn()
}));
describe('AuthModule', () => {
    let authModule;
    let mockApp;
    let consoleLogSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        authModule = new auth_module_1.AuthModule();
        mockApp = {
            use: jest.fn()
        };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        // Mock the AuthRoutes
        auth_routes_1.AuthRoutes.mockImplementation(() => ({
            getRouter: jest.fn().mockReturnValue('auth-router')
        }));
    });
    afterEach(() => {
        consoleLogSpy.mockRestore();
    });
    describe('module initialization', () => {
        it('should create an instance of AuthModule', () => {
            expect(authModule).toBeInstanceOf(auth_module_1.AuthModule);
        });
        it('should have auth service', () => {
            expect(authModule['authService']).toBeDefined();
        });
        it('should have auth middleware', () => {
            expect(authModule['authMiddleware']).toBeDefined();
        });
        it('should have auth routes', () => {
            expect(authModule['authRoutes']).toBeDefined();
        });
        it('should have config', () => {
            expect(authModule['config']).toBeDefined();
        });
    });
    describe('module configuration', () => {
        it('should accept custom configuration', () => {
            const customConfig = {
                jwtSecret: 'custom-secret',
                jwtExpiresIn: '30m',
                enableRateLimiting: false,
                apiKeyPrefix: 'custom_',
                apiKeyLength: 64
            };
            const customAuthModule = new auth_module_1.AuthModule(customConfig);
            expect(customAuthModule['config']).toEqual(customConfig);
        });
        it('should set environment variables from config', () => {
            const config = {
                jwtSecret: 'test-jwt-secret',
                jwtExpiresIn: '20m',
                redisHost: 'redis-server',
                redisPort: 6380,
                bcryptSaltRounds: 14
            };
            new auth_module_1.AuthModule(config);
            expect(process.env.JWT_SECRET).toBe('test-jwt-secret');
            expect(process.env.JWT_EXPIRES_IN).toBe('20m');
            expect(process.env.REDIS_HOST).toBe('redis-server');
            expect(process.env.REDIS_PORT).toBe('6380');
            expect(process.env.BCRYPT_SALT_ROUNDS).toBe('14');
        });
    });
    describe('initialize', () => {
        it('should setup Express middleware', () => {
            authModule.initialize(mockApp);
            expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
            expect(mockApp.use).toHaveBeenCalledWith('/api/auth', 'auth-router');
            expect(mockApp.use).toHaveBeenCalledWith('/api', 'rate-limiter');
            expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // authErrorHandler
            expect(consoleLogSpy).toHaveBeenCalledWith('🔐 Authentication module initialized');
        });
        it('should skip rate limiting when disabled', () => {
            const customModule = new auth_module_1.AuthModule({ enableRateLimiting: false });
            customModule.initialize(mockApp);
            const rateLimiterCall = mockApp.use.mock.calls.find(call => call[1] === 'rate-limiter');
            expect(rateLimiterCall).toBeUndefined();
        });
    });
    describe('getters', () => {
        it('should return auth service', () => {
            const service = authModule.getAuthService();
            expect(service).toBe(authModule['authService']);
        });
        it('should return auth middleware', () => {
            const middleware = authModule.getAuthMiddleware();
            expect(middleware).toBe(authModule['authMiddleware']);
        });
        it('should return auth routes', () => {
            const routes = authModule.getAuthRoutes();
            expect(routes).toBe(authModule['authRoutes']);
        });
    });
    describe('router creation methods', () => {
        let mockRouter;
        beforeEach(() => {
            mockRouter = { use: jest.fn() };
            jest.doMock('express', () => ({
                Router: jest.fn(() => mockRouter)
            }));
        });
        afterEach(() => {
            jest.dontMock('express');
        });
        it('should create protected router', () => {
            const router = authModule.createProtectedRouter();
            expect(mockRouter.use).toHaveBeenCalledWith('require-auth');
        });
        it('should create permission router', () => {
            const permissions = ['read:users', 'write:users'];
            const router = authModule.createPermissionRouter(permissions);
            expect(mockRouter.use).toHaveBeenCalledWith('require-auth');
            expect(mockRouter.use).toHaveBeenCalledWith('require-permissions');
        });
        it('should create role router', () => {
            const roles = ['admin', 'moderator'];
            const router = authModule.createRoleRouter(roles);
            expect(mockRouter.use).toHaveBeenCalledWith('require-auth');
            expect(mockRouter.use).toHaveBeenCalledWith('require-roles');
        });
        it('should create API key router', () => {
            const router = authModule.createApiKeyRouter();
            expect(mockRouter.use).toHaveBeenCalledWith('require-api-key');
        });
        it('should create optional auth router', () => {
            const router = authModule.createOptionalAuthRouter();
            expect(mockRouter.use).toHaveBeenCalledWith('optional-auth');
        });
    });
    describe('cleanup tasks', () => {
        let setIntervalSpy;
        let mockAuthService;
        beforeEach(() => {
            setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation();
            mockAuthService = {
                performCleanup: jest.fn().mockResolvedValue(undefined)
            };
        });
        afterEach(() => {
            setIntervalSpy.mockRestore();
        });
        it('should start cleanup tasks', () => {
            const mockPerformCleanup = jest.fn();
            authModule.getAuthService().performCleanup = mockPerformCleanup;
            authModule.startCleanupTasks();
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
            expect(consoleLogSpy).toHaveBeenCalledWith('🧹 Authentication cleanup tasks started');
        });
        it('should handle cleanup errors', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockPerformCleanup = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
            authModule.getAuthService().performCleanup = mockPerformCleanup;
            authModule.startCleanupTasks();
            // Get the interval callback
            const intervalCallback = setIntervalSpy.mock.calls[0][0];
            await intervalCallback();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Authentication cleanup error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
    describe('shutdown', () => {
        it('should perform cleanup on shutdown', async () => {
            const mockPerformCleanup = jest.fn().mockResolvedValue(undefined);
            authModule.getAuthService().performCleanup = mockPerformCleanup;
            await authModule.shutdown();
            expect(mockPerformCleanup).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('🔐 Authentication module shutdown complete');
        });
        it('should handle shutdown errors', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockPerformCleanup = jest.fn().mockRejectedValue(new Error('Shutdown failed'));
            authModule.getAuthService().performCleanup = mockPerformCleanup;
            await authModule.shutdown();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error during authentication module shutdown:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
    describe('factory functions', () => {
        it('should create auth module with factory function', () => {
            const config = { jwtSecret: 'factory-secret' };
            const module = (0, auth_module_1.createAuthModule)(config);
            expect(module).toBeInstanceOf(auth_module_1.AuthModule);
            expect(module['config']).toEqual(config);
        });
        it('should use authentication with Express app', () => {
            const module = (0, auth_module_1.useAuthentication)(mockApp);
            expect(module).toBeInstanceOf(auth_module_1.AuthModule);
            expect(mockApp.use).toHaveBeenCalled();
        });
        it('should merge default config in useAuthentication', () => {
            const customConfig = { jwtSecret: 'custom' };
            const module = (0, auth_module_1.useAuthentication)(mockApp, customConfig);
            expect(module['config']).toMatchObject({
                ...auth_module_1.DEFAULT_AUTH_CONFIG,
                ...customConfig
            });
        });
    });
    describe('OAuth configuration', () => {
        it('should set OAuth environment variables', () => {
            const config = {
                googleClientId: 'google-id',
                googleClientSecret: 'google-secret',
                googleRedirectUri: 'google-redirect',
                githubClientId: 'github-id',
                githubClientSecret: 'github-secret',
                githubRedirectUri: 'github-redirect',
                microsoftClientId: 'ms-id',
                microsoftClientSecret: 'ms-secret',
                microsoftRedirectUri: 'ms-redirect',
                discordClientId: 'discord-id',
                discordClientSecret: 'discord-secret',
                discordRedirectUri: 'discord-redirect'
            };
            new auth_module_1.AuthModule(config);
            expect(process.env.GOOGLE_CLIENT_ID).toBe('google-id');
            expect(process.env.GOOGLE_CLIENT_SECRET).toBe('google-secret');
            expect(process.env.GOOGLE_REDIRECT_URI).toBe('google-redirect');
            expect(process.env.GITHUB_CLIENT_ID).toBe('github-id');
            expect(process.env.GITHUB_CLIENT_SECRET).toBe('github-secret');
            expect(process.env.GITHUB_REDIRECT_URI).toBe('github-redirect');
            expect(process.env.MICROSOFT_CLIENT_ID).toBe('ms-id');
            expect(process.env.MICROSOFT_CLIENT_SECRET).toBe('ms-secret');
            expect(process.env.MICROSOFT_REDIRECT_URI).toBe('ms-redirect');
            expect(process.env.DISCORD_CLIENT_ID).toBe('discord-id');
            expect(process.env.DISCORD_CLIENT_SECRET).toBe('discord-secret');
            expect(process.env.DISCORD_REDIRECT_URI).toBe('discord-redirect');
        });
    });
    describe('CORS and security configuration', () => {
        it('should set allowed origins', () => {
            const config = {
                allowedOrigins: ['http://localhost:3000', 'https://app.example.com']
            };
            new auth_module_1.AuthModule(config);
            expect(process.env.ALLOWED_ORIGINS).toBe('http://localhost:3000,https://app.example.com');
        });
        it('should set API key configuration', () => {
            const config = {
                apiKeyPrefix: 'test_',
                apiKeyLength: 48
            };
            new auth_module_1.AuthModule(config);
            expect(process.env.API_KEY_PREFIX).toBe('test_');
            expect(process.env.API_KEY_LENGTH).toBe('48');
        });
    });
});
// Note: Express Router is mocked only within the test context, not globally
//# sourceMappingURL=auth-module.test.js.map