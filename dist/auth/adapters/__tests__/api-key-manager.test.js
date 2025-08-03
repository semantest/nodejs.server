"use strict";
/**
 * Tests for ApiKeyManager
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const api_key_manager_1 = require("../api-key-manager");
const auth_entities_1 = require("../../domain/auth-entities");
describe('ApiKeyManager', () => {
    let apiKeyManager;
    const mockKeyPrefix = 'test';
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.API_KEY_PREFIX = mockKeyPrefix;
        apiKeyManager = new api_key_manager_1.ApiKeyManager();
    });
    afterEach(() => {
        delete process.env.API_KEY_PREFIX;
    });
    describe('initialization', () => {
        it('should initialize with environment prefix', () => {
            expect(apiKeyManager).toBeDefined();
            expect(apiKeyManager['keyPrefix']).toBe(mockKeyPrefix);
        });
        it('should use default prefix if environment variable not set', () => {
            delete process.env.API_KEY_PREFIX;
            const manager = new api_key_manager_1.ApiKeyManager();
            expect(manager['keyPrefix']).toBe('wb');
        });
    });
    describe('createApiKey', () => {
        it('should create a new API key with free tier', async () => {
            const userId = 'user123';
            const keyData = {
                name: 'Test API Key',
                scopes: ['read', 'write'],
                tier: 'free',
            };
            const apiKey = await apiKeyManager.createApiKey(userId, keyData);
            expect(apiKey).toBeDefined();
            expect(apiKey.name).toBe(keyData.name);
            expect(apiKey.userId).toBe(userId);
            expect(apiKey.scopes).toEqual(keyData.scopes);
            expect(apiKey.tier).toBe('free');
            expect(apiKey.isActive).toBe(true);
            expect(apiKey.rateLimit).toEqual(auth_entities_1.RATE_LIMIT_TIERS.free);
            expect(apiKey.key).toMatch(new RegExp(`^${mockKeyPrefix}_[A-Za-z0-9]{32}$`));
        });
        it('should create API key with premium tier', async () => {
            const userId = 'user123';
            const keyData = {
                name: 'Premium API Key',
                scopes: ['read', 'write', 'delete'],
                tier: 'premium',
            };
            const apiKey = await apiKeyManager.createApiKey(userId, keyData);
            expect(apiKey.tier).toBe('premium');
            expect(apiKey.rateLimit).toEqual(auth_entities_1.RATE_LIMIT_TIERS.premium);
        });
        it('should create API key with enterprise tier', async () => {
            const userId = 'user123';
            const keyData = {
                name: 'Enterprise API Key',
                scopes: ['*'],
                tier: 'enterprise',
            };
            const apiKey = await apiKeyManager.createApiKey(userId, keyData);
            expect(apiKey.tier).toBe('enterprise');
            expect(apiKey.rateLimit).toEqual(auth_entities_1.RATE_LIMIT_TIERS.enterprise);
        });
        it('should create API key with expiration date', async () => {
            const userId = 'user123';
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            const keyData = {
                name: 'Expiring API Key',
                scopes: ['read'],
                tier: 'free',
                expiresAt,
            };
            const apiKey = await apiKeyManager.createApiKey(userId, keyData);
            expect(apiKey.expiresAt).toEqual(expiresAt);
        });
        it('should initialize usage stats to zero', async () => {
            const userId = 'user123';
            const keyData = {
                name: 'Test API Key',
                scopes: ['read'],
                tier: 'free',
            };
            const apiKey = await apiKeyManager.createApiKey(userId, keyData);
            expect(apiKey.usageStats).toEqual({
                totalRequests: 0,
                requestsThisMonth: 0,
                requestsToday: 0,
                errorCount: 0,
                averageResponseTime: 0,
            });
        });
    });
    describe('validateApiKey', () => {
        it('should return null for non-existent key', async () => {
            const result = await apiKeyManager.validateApiKey('non_existent_key');
            expect(result).toBeNull();
        });
        it('should return null for inactive key', async () => {
            // Mock the findApiKeyByKey method
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: false,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const result = await apiKeyManager.validateApiKey('test_key');
            expect(result).toBeNull();
        });
        it('should return null for expired key', async () => {
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: true,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const result = await apiKeyManager.validateApiKey('test_key');
            expect(result).toBeNull();
        });
        it('should return valid API key and update last used', async () => {
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: true,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const updateLastUsedSpy = jest.spyOn(apiKeyManager, 'updateLastUsed').mockResolvedValue(undefined);
            const result = await apiKeyManager.validateApiKey('test_key');
            expect(result).toEqual(mockApiKey);
            expect(updateLastUsedSpy).toHaveBeenCalledWith(mockApiKey.id);
        });
        it('should handle errors gracefully', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockRejectedValue(new Error('Database error'));
            const result = await apiKeyManager.validateApiKey('test_key');
            expect(result).toBeNull();
        });
    });
    describe('checkRateLimit', () => {
        const mockApiKey = {
            id: 'apikey_123',
            key: 'test_key',
            name: 'Test Key',
            userId: 'user123',
            scopes: ['read'],
            tier: 'free',
            isActive: true,
            rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
            usageStats: {
                totalRequests: 0,
                requestsThisMonth: 0,
                requestsToday: 0,
                errorCount: 0,
                averageResponseTime: 0,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        beforeEach(() => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            jest.spyOn(apiKeyManager, 'getRateLimitCount').mockResolvedValue(0);
            jest.spyOn(apiKeyManager, 'getConcurrentCount').mockResolvedValue(0);
            jest.spyOn(apiKeyManager, 'incrementRateLimitCount').mockResolvedValue(undefined);
            jest.spyOn(apiKeyManager, 'incrementConcurrentCount').mockResolvedValue(undefined);
        });
        it('should throw error if API key not found', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(null);
            await expect(apiKeyManager.checkRateLimit('non_existent_key'))
                .rejects.toThrow('API key not found');
        });
        it('should pass rate limit check when under all limits', async () => {
            await expect(apiKeyManager.checkRateLimit('test_key'))
                .resolves.not.toThrow();
            expect(apiKeyManager['incrementRateLimitCount']).toHaveBeenCalledTimes(3);
            expect(apiKeyManager['incrementConcurrentCount']).toHaveBeenCalledTimes(1);
        });
        it('should throw error when per-minute limit exceeded', async () => {
            jest.spyOn(apiKeyManager, 'getRateLimitCount')
                .mockResolvedValueOnce(auth_entities_1.RATE_LIMIT_TIERS.free.requestsPerMinute);
            await expect(apiKeyManager.checkRateLimit('test_key'))
                .rejects.toThrow('Rate limit exceeded: requests per minute');
        });
        it('should throw error when per-hour limit exceeded', async () => {
            jest.spyOn(apiKeyManager, 'getRateLimitCount')
                .mockResolvedValueOnce(0) // Minute OK
                .mockResolvedValueOnce(auth_entities_1.RATE_LIMIT_TIERS.free.requestsPerHour);
            await expect(apiKeyManager.checkRateLimit('test_key'))
                .rejects.toThrow('Rate limit exceeded: requests per hour');
        });
        it('should throw error when per-day limit exceeded', async () => {
            jest.spyOn(apiKeyManager, 'getRateLimitCount')
                .mockResolvedValueOnce(0) // Minute OK
                .mockResolvedValueOnce(0) // Hour OK
                .mockResolvedValueOnce(auth_entities_1.RATE_LIMIT_TIERS.free.requestsPerDay);
            await expect(apiKeyManager.checkRateLimit('test_key'))
                .rejects.toThrow('Rate limit exceeded: requests per day');
        });
        it('should throw error when concurrent requests exceeded', async () => {
            jest.spyOn(apiKeyManager, 'getConcurrentCount')
                .mockResolvedValueOnce(auth_entities_1.RATE_LIMIT_TIERS.free.concurrentRequests);
            await expect(apiKeyManager.checkRateLimit('test_key'))
                .rejects.toThrow('Rate limit exceeded: concurrent requests');
        });
    });
    describe('updateUsageStats', () => {
        const mockApiKey = {
            id: 'apikey_123',
            key: 'test_key',
            name: 'Test Key',
            userId: 'user123',
            scopes: ['read'],
            tier: 'free',
            isActive: true,
            rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
            usageStats: {
                totalRequests: 100,
                requestsThisMonth: 50,
                requestsToday: 10,
                errorCount: 5,
                averageResponseTime: 200,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        it('should update usage stats for successful request', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const updateStatsSpy = jest.spyOn(apiKeyManager, 'updateApiKeyUsageStats').mockResolvedValue(undefined);
            await apiKeyManager.updateUsageStats('test_key', 150, false);
            expect(updateStatsSpy).toHaveBeenCalledWith(mockApiKey.id, {
                totalRequests: 101,
                requestsThisMonth: 51,
                requestsToday: 11,
                errorCount: 5,
                lastError: undefined,
                averageResponseTime: expect.any(Number),
            });
        });
        it('should update usage stats for error request', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const updateStatsSpy = jest.spyOn(apiKeyManager, 'updateApiKeyUsageStats').mockResolvedValue(undefined);
            await apiKeyManager.updateUsageStats('test_key', 500, true);
            expect(updateStatsSpy).toHaveBeenCalledWith(mockApiKey.id, {
                totalRequests: 101,
                requestsThisMonth: 51,
                requestsToday: 11,
                errorCount: 6,
                lastError: expect.any(Date),
                averageResponseTime: expect.any(Number),
            });
        });
        it('should handle non-existent key gracefully', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(null);
            const updateStatsSpy = jest.spyOn(apiKeyManager, 'updateApiKeyUsageStats');
            await apiKeyManager.updateUsageStats('non_existent_key', 100);
            expect(updateStatsSpy).not.toHaveBeenCalled();
        });
    });
    describe('revokeApiKey', () => {
        it('should revoke an existing API key', async () => {
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: true,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const updateStatusSpy = jest.spyOn(apiKeyManager, 'updateApiKeyStatus').mockResolvedValue(undefined);
            await apiKeyManager.revokeApiKey('test_key');
            expect(updateStatusSpy).toHaveBeenCalledWith(mockApiKey.id, false);
        });
        it('should throw error if API key not found', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(null);
            await expect(apiKeyManager.revokeApiKey('non_existent_key'))
                .rejects.toThrow('API key not found');
        });
    });
    describe('listApiKeys', () => {
        it('should return list of API keys for user', async () => {
            const mockApiKeys = [
                {
                    id: 'apikey_1',
                    key: 'test_key_1',
                    name: 'Test Key 1',
                    userId: 'user123',
                    scopes: ['read'],
                    tier: 'free',
                    isActive: true,
                    rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                    usageStats: {
                        totalRequests: 0,
                        requestsThisMonth: 0,
                        requestsToday: 0,
                        errorCount: 0,
                        averageResponseTime: 0,
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];
            jest.spyOn(apiKeyManager, 'findApiKeysByUserId').mockResolvedValue(mockApiKeys);
            const result = await apiKeyManager.listApiKeys('user123');
            expect(result).toEqual(mockApiKeys);
        });
        it('should return empty array if no keys found', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeysByUserId').mockResolvedValue([]);
            const result = await apiKeyManager.listApiKeys('user123');
            expect(result).toEqual([]);
        });
    });
    describe('getUsageStats', () => {
        it('should return usage stats for existing key', async () => {
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: true,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 100,
                    requestsThisMonth: 50,
                    requestsToday: 10,
                    errorCount: 5,
                    averageResponseTime: 200,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const result = await apiKeyManager.getUsageStats('test_key');
            expect(result).toEqual(mockApiKey.usageStats);
        });
        it('should return null for non-existent key', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(null);
            const result = await apiKeyManager.getUsageStats('non_existent_key');
            expect(result).toBeNull();
        });
    });
    describe('updateScopes', () => {
        it('should update scopes for existing key', async () => {
            const mockApiKey = {
                id: 'apikey_123',
                key: 'test_key',
                name: 'Test Key',
                userId: 'user123',
                scopes: ['read'],
                tier: 'free',
                isActive: true,
                rateLimit: auth_entities_1.RATE_LIMIT_TIERS.free,
                usageStats: {
                    totalRequests: 0,
                    requestsThisMonth: 0,
                    requestsToday: 0,
                    errorCount: 0,
                    averageResponseTime: 0,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(mockApiKey);
            const updateScopesSpy = jest.spyOn(apiKeyManager, 'updateApiKeyScopes').mockResolvedValue(undefined);
            const newScopes = ['read', 'write', 'delete'];
            await apiKeyManager.updateScopes('test_key', newScopes);
            expect(updateScopesSpy).toHaveBeenCalledWith(mockApiKey.id, newScopes);
        });
        it('should throw error if API key not found', async () => {
            jest.spyOn(apiKeyManager, 'findApiKeyByKey').mockResolvedValue(null);
            await expect(apiKeyManager.updateScopes('non_existent_key', ['read']))
                .rejects.toThrow('API key not found');
        });
    });
    describe('private methods', () => {
        it('should generate unique API key with correct format', () => {
            const key = apiKeyManager['generateApiKey']();
            expect(key).toMatch(new RegExp(`^${mockKeyPrefix}_[A-Za-z0-9]{32}$`));
        });
        it('should generate unique API key ID', () => {
            const id = apiKeyManager['generateApiKeyId']();
            expect(id).toMatch(/^apikey_\d+_[a-z0-9]{9}$/);
        });
        it('should calculate average response time correctly', () => {
            const currentAverage = 200;
            const newTime = 300;
            const totalRequests = 4;
            const result = apiKeyManager['calculateAverageResponseTime'](currentAverage, newTime, totalRequests);
            // (200 * 4 + 300) / 5 = 1100 / 5 = 220
            expect(result).toBe(220);
        });
        it('should handle first request average response time', () => {
            const result = apiKeyManager['calculateAverageResponseTime'](0, 150, 0);
            expect(result).toBe(150);
        });
    });
});
//# sourceMappingURL=api-key-manager.test.js.map