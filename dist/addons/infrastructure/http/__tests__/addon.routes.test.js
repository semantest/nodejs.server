"use strict";
/**
 * Tests for Addon Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const addon_routes_1 = require("../addon.routes");
const addon_service_1 = require("../../../application/services/addon.service");
// Mock dependencies
jest.mock('../../../application/services/addon.service');
jest.mock('../../../../monitoring/infrastructure/structured-logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));
describe('Addon Routes', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let mockAddonService;
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock request
        mockReq = {
            ip: '127.0.0.1',
            get: jest.fn((header) => {
                if (header === 'set-cookie')
                    return [];
                if (header === 'User-Agent')
                    return 'test-agent';
                return undefined;
            })
        };
        // Mock response
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            setHeader: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
        // Get mocked service instance
        mockAddonService = addon_service_1.AddonService.mock.instances[0];
    });
    describe('GET /api/addon', () => {
        it('should serve addon code successfully', async () => {
            const mockAddonCode = 'console.log("test addon");';
            mockAddonService.getChatGPTAddonCode = jest.fn().mockResolvedValue(mockAddonCode);
            // Find the route handler
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockAddonService.getChatGPTAddonCode).toHaveBeenCalled();
            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/javascript');
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
            expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(mockAddonCode);
        });
        it('should handle errors when serving addon code', async () => {
            const error = new Error('File not found');
            mockAddonService.getChatGPTAddonCode = jest.fn().mockRejectedValue(error);
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve addon code',
                message: 'File not found'
            });
        });
    });
    describe('GET /api/addon/health', () => {
        it('should return health status', async () => {
            const mockHealth = {
                status: 'healthy',
                service: 'addon-service',
                timestamp: '2025-01-01T00:00:00.000Z',
                addons: [{
                        id: 'chatgpt-addon',
                        available: true,
                        lastAccessed: '2025-01-01T00:00:00.000Z'
                    }]
            };
            mockAddonService.getHealth = jest.fn().mockResolvedValue(mockHealth);
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon/health')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockAddonService.getHealth).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(mockHealth);
        });
        it('should handle health check errors', async () => {
            const error = new Error('Service unavailable');
            mockAddonService.getHealth = jest.fn().mockRejectedValue(error);
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon/health')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith({
                status: 'unhealthy',
                error: 'Service unavailable'
            });
        });
    });
    describe('GET /api/addon/metadata', () => {
        it('should return addon metadata', async () => {
            const mockMetadata = [{
                    id: 'semantest-chatgpt-addon',
                    name: 'Semantest ChatGPT Integration',
                    version: '1.0.0',
                    description: 'Provides AI-powered assistance',
                    capabilities: ['text-generation'],
                    endpoint: '/api/addon'
                }];
            mockAddonService.getAddonMetadata = jest.fn().mockResolvedValue(mockMetadata);
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon/metadata')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockAddonService.getAddonMetadata).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(mockMetadata);
        });
        it('should handle metadata retrieval errors', async () => {
            const error = new Error('Metadata not available');
            mockAddonService.getAddonMetadata = jest.fn().mockRejectedValue(error);
            const routeHandler = addon_routes_1.addonRouter.stack.find(layer => layer.route?.path === '/addon/metadata')?.route?.stack[0].handle;
            await routeHandler(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve addon metadata',
                message: 'Metadata not available'
            });
        });
    });
});
//# sourceMappingURL=addon.routes.test.js.map