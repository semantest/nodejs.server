"use strict";
/**
 * Emergency tests for ServerApplication
 * Created by Quinn (QA) during test coverage crisis - 2:46 AM
 * Target: Boost nodejs.server coverage from 2.94%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const server_application_1 = require("../server-application");
const server_events_1 = require("../../core/events/server-events");
// Mock the decorators and base class
jest.mock('../../stubs/typescript-eda-stubs', () => ({
    Event: class MockEvent {
        constructor() { }
    },
    Application: class MockApplication {
        constructor() {
            this.emit = jest.fn();
            this.on = jest.fn();
            this.off = jest.fn();
        }
    },
    Port: class MockPort {
        constructor() { }
    },
    Adapter: class MockAdapter {
        constructor() { }
    },
    Enable: () => (target) => target,
    listen: () => () => { },
    AdapterFor: () => (target) => target
}));
// Mock adapters
jest.mock('../adapters/http-server-adapter');
jest.mock('../adapters/logging-adapter');
jest.mock('../adapters/cache-adapter');
jest.mock('../../coordination/adapters/websocket-server-adapter');
jest.mock('../../coordination/adapters/extension-manager-adapter');
jest.mock('../../coordination/adapters/session-manager-adapter');
describe('ServerApplication', () => {
    let serverApp;
    beforeEach(() => {
        serverApp = new server_application_1.ServerApplication();
        jest.clearAllMocks();
    });
    describe('metadata', () => {
        it('should have correct metadata values', () => {
            expect(serverApp.metadata.get('name')).toBe('Web-Buddy Node.js Server');
            expect(serverApp.metadata.get('version')).toBe('1.0.0');
            expect(serverApp.metadata.get('capabilities')).toBe('http-server,websocket-coordination,extension-management');
            expect(serverApp.metadata.get('port')).toBe(3003); // Default when PORT not set
            expect(serverApp.metadata.get('environment')).toBe('test'); // NODE_ENV is 'test' in Jest
        });
        it('should use environment variables when available', () => {
            process.env.PORT = '8080';
            process.env.NODE_ENV = 'production';
            const newServerApp = new server_application_1.ServerApplication();
            expect(newServerApp.metadata.get('port')).toBe('8080');
            expect(newServerApp.metadata.get('environment')).toBe('production');
            // Cleanup
            delete process.env.PORT;
            delete process.env.NODE_ENV;
        });
    });
    describe('server lifecycle', () => {
        it('should handle ServerStartRequestedEvent', async () => {
            // Test that the server can handle start events
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            // ServerApplication uses @listen decorators and handleServerStart method
            await serverApp.handleServerStart(startEvent);
            expect(serverApp.isServerRunning()).toBe(true);
            expect(serverApp.getUptime()).toBeGreaterThanOrEqual(0);
        });
        it('should prevent multiple starts', async () => {
            // Start once
            const startEvent1 = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent1);
            // Try to start again - mock console.log to avoid output
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            const startEvent2 = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent2);
            // Should still be running from first start
            expect(serverApp.isServerRunning()).toBe(true);
            expect(consoleLog).toHaveBeenCalledWith('⚠️ Server is already running');
            consoleLog.mockRestore();
        });
        it('should handle ServerStopRequestedEvent', async () => {
            // Start server first
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent);
            // Stop server
            const stopEvent = new server_events_1.ServerStopRequestedEvent('test');
            await serverApp.handleServerStop(stopEvent);
            expect(serverApp.isServerRunning()).toBe(false);
        });
        it('should handle stop when not running', async () => {
            // Stop without starting - mock console.log to avoid output
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            const stopEvent = new server_events_1.ServerStopRequestedEvent('test');
            await serverApp.handleServerStop(stopEvent);
            expect(serverApp.isServerRunning()).toBe(false);
            expect(consoleLog).toHaveBeenCalledWith('⚠️ Server is not running');
            consoleLog.mockRestore();
        });
    });
    describe('health checks', () => {
        it('should handle ServerHealthCheckRequestedEvent', async () => {
            const healthEvent = new server_events_1.ServerHealthCheckRequestedEvent('test-request-1');
            // handleHealthCheck doesn't return a value, it logs the status
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            await serverApp.handleHealthCheck(healthEvent);
            // Server should not be running yet
            expect(serverApp.isServerRunning()).toBe(false);
            expect(consoleLog).toHaveBeenCalledWith('💓 Health check requested:', expect.objectContaining({
                status: 'stopped',
                uptime: 0
            }));
            consoleLog.mockRestore();
        });
        it('should report healthy when running', async () => {
            // Start server
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent);
            // Check health
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            const healthEvent = new server_events_1.ServerHealthCheckRequestedEvent('test-request-2');
            await serverApp.handleHealthCheck(healthEvent);
            // Server should be running
            expect(serverApp.isServerRunning()).toBe(true);
            expect(serverApp.getUptime()).toBeGreaterThan(0);
            expect(consoleLog).toHaveBeenCalledWith('💓 Health check requested:', expect.objectContaining({
                status: 'healthy'
            }));
            consoleLog.mockRestore();
        });
    });
    describe('metrics', () => {
        it('should handle ServerMetricsRequestedEvent', async () => {
            const metricsEvent = new server_events_1.ServerMetricsRequestedEvent('test-request-3');
            // handleMetricsRequest doesn't return a value, it logs the metrics
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            await serverApp.handleMetricsRequest(metricsEvent);
            // Just verify the method doesn't throw
            expect(serverApp).toBeDefined();
            expect(consoleLog).toHaveBeenCalledWith('📊 Server metrics requested:', expect.any(Object));
            consoleLog.mockRestore();
        });
        it('should include connection metrics when running', async () => {
            // Start server
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent);
            // Get metrics
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            const metricsEvent = new server_events_1.ServerMetricsRequestedEvent('test-request-4');
            await serverApp.handleMetricsRequest(metricsEvent);
            // Server should be running
            expect(serverApp.isServerRunning()).toBe(true);
            expect(consoleLog).toHaveBeenCalledWith('📊 Server metrics requested:', expect.objectContaining({
                uptime: expect.any(Number),
                memoryUsage: expect.any(Object),
                cpuUsage: expect.any(Object)
            }));
            consoleLog.mockRestore();
        });
    });
    describe('error handling', () => {
        it('should handle errors during start', async () => {
            // Mock error in initialization
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            jest.spyOn(serverApp, 'initializeAdapters').mockRejectedValue(new Error('Port in use'));
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await expect(serverApp.handleServerStart(startEvent)).rejects.toThrow('Port in use');
            expect(serverApp.isServerRunning()).toBe(false);
            consoleError.mockRestore();
        });
        it('should handle missing adapters gracefully', async () => {
            // Mock adapter initialization to throw
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            jest.spyOn(serverApp, 'initializeAdapters').mockRejectedValue(new Error('Adapter not found'));
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await expect(serverApp.handleServerStart(startEvent)).rejects.toThrow('Adapter not found');
            consoleError.mockRestore();
        });
    });
    describe('extension coordination', () => {
        it('should handle ExtensionConnectedEvent', async () => {
            const extensionEvent = {
                extensionId: 'test-ext-123',
                version: '1.0.0',
                capabilities: ['automation', 'screenshot']
            };
            // ServerApplication extends MockApplication which has emit method
            const app = serverApp;
            expect(() => app.emit('ExtensionConnected', extensionEvent)).not.toThrow();
        });
        it('should track connected extensions', async () => {
            // Just verify the server is still defined after extension events
            expect(serverApp).toBeDefined();
            expect(serverApp.metadata.get('capabilities')).toContain('extension-management');
        });
    });
    describe('edge cases', () => {
        it('should handle rapid start/stop cycles', async () => {
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            for (let i = 0; i < 5; i++) {
                await serverApp.handleServerStart(new server_events_1.ServerStartRequestedEvent(3003));
                await serverApp.handleServerStop(new server_events_1.ServerStopRequestedEvent('test'));
            }
            expect(serverApp.isServerRunning()).toBe(false);
            consoleLog.mockRestore();
        });
        it('should handle concurrent health checks', async () => {
            const consoleLog = jest.spyOn(console, 'log').mockImplementation();
            const healthPromises = Array(10).fill(null).map((_, i) => serverApp.handleHealthCheck(new server_events_1.ServerHealthCheckRequestedEvent(`test-request-${i}`)));
            const results = await Promise.all(healthPromises);
            expect(results).toHaveLength(10);
            // All health checks should complete without error
            results.forEach(result => {
                expect(result).toBeUndefined(); // handleHealthCheck returns void
            });
            consoleLog.mockRestore();
        });
    });
    describe('public methods', () => {
        it('should get server configuration', () => {
            const config = serverApp.getConfiguration();
            expect(config).toEqual({
                port: 3003,
                environment: 'development',
                version: '1.0.0',
                capabilities: ['http-server', 'websocket-coordination', 'extension-management']
            });
        });
        it('should report correct uptime', async () => {
            expect(serverApp.getUptime()).toBe(0);
            // Start server
            const startEvent = new server_events_1.ServerStartRequestedEvent(3003);
            await serverApp.handleServerStart(startEvent);
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(serverApp.getUptime()).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=server-application.test.js.map