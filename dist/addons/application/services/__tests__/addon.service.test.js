"use strict";
/**
 * Tests for Addon Service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const addon_service_1 = require("../addon.service");
// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../../monitoring/infrastructure/structured-logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));
describe('AddonService', () => {
    let addonService;
    let mockReadFile;
    beforeEach(() => {
        jest.clearAllMocks();
        addonService = new addon_service_1.AddonService();
        mockReadFile = promises_1.readFile;
    });
    describe('getChatGPTAddonCode', () => {
        it('should successfully load addon code from file', async () => {
            const mockAddonCode = '(function() { console.log("ChatGPT addon"); })();';
            mockReadFile.mockResolvedValue(mockAddonCode);
            const result = await addonService.getChatGPTAddonCode();
            expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('chatgpt-addon.js'), 'utf-8');
            expect(result).toBe(mockAddonCode);
        });
        it('should throw error when addon file is not found', async () => {
            const error = new Error('ENOENT: no such file or directory');
            mockReadFile.mockRejectedValue(error);
            await expect(addonService.getChatGPTAddonCode()).rejects.toThrow('Addon code not found or inaccessible');
        });
        it('should track last access time when loading addon', async () => {
            const mockAddonCode = '(function() { console.log("ChatGPT addon"); })();';
            mockReadFile.mockResolvedValue(mockAddonCode);
            await addonService.getChatGPTAddonCode();
            // Load again to check if last access is tracked
            await addonService.getChatGPTAddonCode();
            // Check that the file was read twice
            expect(mockReadFile).toHaveBeenCalledTimes(2);
        });
    });
    describe('getHealth', () => {
        it('should return healthy status when addon is available', async () => {
            // First call for file exists check
            mockReadFile.mockResolvedValueOnce('addon content');
            const health = await addonService.getHealth();
            expect(health.status).toBe('healthy');
            expect(health.service).toBe('addon-service');
            expect(health.timestamp).toBeDefined();
            expect(health.addons).toHaveLength(1);
            expect(health.addons[0]).toEqual({
                id: 'chatgpt-addon',
                available: true,
                lastAccessed: undefined
            });
        });
        it('should return unhealthy status when addon is not available', async () => {
            // Simulate file not found
            mockReadFile.mockRejectedValue(new Error('File not found'));
            const health = await addonService.getHealth();
            expect(health.status).toBe('unhealthy');
            expect(health.addons[0].available).toBe(false);
        });
        it('should include last access time if addon was accessed', async () => {
            // Load addon first
            mockReadFile.mockResolvedValueOnce('addon content');
            await addonService.getChatGPTAddonCode();
            // Now check health
            mockReadFile.mockResolvedValueOnce('addon content');
            const health = await addonService.getHealth();
            expect(health.addons[0].lastAccessed).toBeDefined();
        });
    });
    describe('getAddonMetadata', () => {
        it('should return metadata for available addons', async () => {
            const metadata = await addonService.getAddonMetadata();
            expect(metadata).toHaveLength(1);
            expect(metadata[0]).toEqual({
                id: 'semantest-chatgpt-addon',
                name: 'Semantest ChatGPT Integration',
                version: '1.0.0',
                description: 'Provides AI-powered assistance for Semantest operations',
                capabilities: [
                    'text-generation',
                    'code-analysis',
                    'test-generation',
                    'documentation'
                ],
                endpoint: '/api/addon'
            });
        });
    });
});
//# sourceMappingURL=addon.service.test.js.map