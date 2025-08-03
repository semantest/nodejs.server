"use strict";
/**
 * Addon Service
 * Handles business logic for serving addon code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddonService = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const structured_logger_1 = require("../../../monitoring/infrastructure/structured-logger");
class AddonService {
    constructor() {
        this.lastAccessTime = new Map();
        // Path to addon files
        this.addonsPath = (0, path_1.join)(__dirname, '../../');
    }
    /**
     * Retrieves the ChatGPT addon code from file
     */
    async getChatGPTAddonCode() {
        try {
            const addonPath = (0, path_1.join)(this.addonsPath, 'chatgpt-addon.js');
            const addonCode = await (0, promises_1.readFile)(addonPath, 'utf-8');
            // Track access time
            this.lastAccessTime.set('chatgpt-addon', new Date());
            structured_logger_1.logger.info('ChatGPT addon code loaded', {
                metadata: {
                    path: addonPath,
                    size: addonCode.length
                }
            });
            return addonCode;
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to load ChatGPT addon code', error);
            throw new Error('Addon code not found or inaccessible');
        }
    }
    /**
     * Returns health status of addon service
     */
    async getHealth() {
        const health = {
            status: 'healthy',
            service: 'addon-service',
            timestamp: new Date().toISOString(),
            addons: []
        };
        try {
            // Check if ChatGPT addon is available
            const addonPath = (0, path_1.join)(this.addonsPath, 'chatgpt-addon.js');
            const addonExists = await this.fileExists(addonPath);
            health.addons.push({
                id: 'chatgpt-addon',
                available: addonExists,
                lastAccessed: this.lastAccessTime.get('chatgpt-addon')?.toISOString()
            });
            // If any addon is unavailable, mark as unhealthy
            if (health.addons.some(addon => !addon.available)) {
                health.status = 'unhealthy';
            }
        }
        catch (error) {
            health.status = 'unhealthy';
            structured_logger_1.logger.error('Health check failed', error);
        }
        return health;
    }
    /**
     * Returns metadata about available addons
     */
    async getAddonMetadata() {
        const metadata = [
            {
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
            }
        ];
        return metadata;
    }
    /**
     * Helper method to check if a file exists
     */
    async fileExists(path) {
        try {
            await (0, promises_1.readFile)(path);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.AddonService = AddonService;
//# sourceMappingURL=addon.service.js.map