"use strict";
/**
 * Tests for MonitoringSystem
 * Testing comprehensive monitoring infrastructure integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const structured_logger_1 = require("../infrastructure/structured-logger");
const performance_metrics_1 = require("../infrastructure/performance-metrics");
const health_check_1 = require("../infrastructure/health-check");
const real_time_alerting_1 = require("../infrastructure/real-time-alerting");
// Mock dependencies
jest.mock('../infrastructure/structured-logger');
jest.mock('../infrastructure/performance-metrics');
jest.mock('../infrastructure/health-check');
jest.mock('../infrastructure/real-time-alerting');
jest.mock('../infrastructure/metrics-dashboard');
describe('MonitoringSystem', () => {
    let monitoringSystem;
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup logger mock
        structured_logger_1.logger.info = jest.fn();
        structured_logger_1.logger.warn = jest.fn();
        structured_logger_1.logger.error = jest.fn();
        // Setup component mocks
        performance_metrics_1.performanceMetrics.start = jest.fn();
        health_check_1.healthCheckManager.start = jest.fn();
        real_time_alerting_1.alertingManager.start = jest.fn();
    });
    describe('Constructor', () => {
        it('should create monitoring system with default config', () => {
            monitoringSystem = new index_1.MonitoringSystem();
            expect(monitoringSystem['config']).toEqual({
                enableMetrics: true,
                enableHealthChecks: true,
                enableAlerting: true,
                enableDashboard: true,
                alertingPort: 3004,
                metricsInterval: 60000,
                logLevel: 'info',
                logDirectory: './logs'
            });
        });
        it('should create monitoring system with custom config', () => {
            const config = {
                enableMetrics: false,
                enableHealthChecks: true,
                enableAlerting: false,
                enableDashboard: false,
                alertingPort: 4000,
                metricsInterval: 30000,
                logLevel: 'debug',
                logDirectory: '/var/log'
            };
            monitoringSystem = new index_1.MonitoringSystem(config);
            expect(monitoringSystem['config']).toEqual(config);
        });
        it('should merge custom config with defaults', () => {
            const config = {
                enableMetrics: false,
                alertingPort: 5000
            };
            monitoringSystem = new index_1.MonitoringSystem(config);
            expect(monitoringSystem['config']).toEqual({
                enableMetrics: false,
                enableHealthChecks: true,
                enableAlerting: true,
                enableDashboard: true,
                alertingPort: 5000,
                metricsInterval: 60000,
                logLevel: 'info',
                logDirectory: './logs'
            });
        });
    });
    describe('initialize', () => {
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
        });
        it('should initialize all components when enabled', async () => {
            await monitoringSystem.initialize();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Initializing monitoring system', {
                metadata: monitoringSystem['config']
            });
            expect(performance_metrics_1.performanceMetrics.start).toHaveBeenCalled();
            expect(health_check_1.healthCheckManager.start).toHaveBeenCalled();
            expect(real_time_alerting_1.alertingManager.start).toHaveBeenCalledWith(3004);
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Performance metrics initialized');
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Health check manager initialized');
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Real-time alerting system initialized');
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
            expect(monitoringSystem['isInitialized']).toBe(true);
        });
        it('should skip disabled components', async () => {
            monitoringSystem = new index_1.MonitoringSystem({
                enableMetrics: false,
                enableHealthChecks: false,
                enableAlerting: false,
                enableDashboard: false
            });
            await monitoringSystem.initialize();
            expect(performance_metrics_1.performanceMetrics.start).not.toHaveBeenCalled();
            expect(health_check_1.healthCheckManager.start).not.toHaveBeenCalled();
            expect(real_time_alerting_1.alertingManager.start).not.toHaveBeenCalled();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
            expect(monitoringSystem['isInitialized']).toBe(true);
        });
        it('should warn if already initialized', async () => {
            await monitoringSystem.initialize();
            await monitoringSystem.initialize();
            expect(structured_logger_1.logger.warn).toHaveBeenCalledWith('Monitoring system already initialized');
            expect(performance_metrics_1.performanceMetrics.start).toHaveBeenCalledTimes(1);
        });
        it('should handle initialization errors', async () => {
            performance_metrics_1.performanceMetrics.start.mockImplementation(() => {
                throw new Error('Metrics error');
            });
            await expect(monitoringSystem.initialize()).rejects.toThrow('Failed to initialize monitoring system');
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to initialize monitoring system', expect.any(Error));
            expect(monitoringSystem['isInitialized']).toBe(false);
        });
        it('should use custom alerting port', async () => {
            monitoringSystem = new index_1.MonitoringSystem({
                alertingPort: 6000
            });
            await monitoringSystem.initialize();
            expect(real_time_alerting_1.alertingManager.start).toHaveBeenCalledWith(6000);
        });
    });
    describe('setupExpressMiddleware', () => {
        let mockApp;
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
            mockApp = {
                use: jest.fn()
            };
            // Mock metricsDashboard.getDashboardRouter
            require('../infrastructure/metrics-dashboard').metricsDashboard.getDashboardRouter = jest.fn().mockReturnValue('dashboard-router');
            health_check_1.healthCheckManager.getHealthRouter = jest.fn().mockReturnValue('health-router');
        });
        it('should setup Express middleware', () => {
            monitoringSystem.setupExpressMiddleware(mockApp);
            expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // requestLoggingMiddleware
            expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // metricsMiddleware
            expect(mockApp.use).toHaveBeenCalledWith('/api', 'health-router');
            expect(mockApp.use).toHaveBeenCalledWith('/monitoring', 'dashboard-router');
            expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // errorLoggingMiddleware
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Express middleware configured for monitoring');
        });
        it('should skip disabled components', () => {
            monitoringSystem = new index_1.MonitoringSystem({
                enableMetrics: false,
                enableHealthChecks: false,
                enableDashboard: false
            });
            monitoringSystem.setupExpressMiddleware(mockApp);
            const metricsCall = mockApp.use.mock.calls.find(call => call[0] === expect.any(Function) && call.length === 1);
            const healthCall = mockApp.use.mock.calls.find(call => call[0] === '/api');
            const dashboardCall = mockApp.use.mock.calls.find(call => call[0] === '/monitoring');
            expect(healthCall).toBeUndefined();
            expect(dashboardCall).toBeUndefined();
        });
    });
    describe('setupWebSocketMiddleware', () => {
        let mockServer;
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
            mockServer = {
                use: jest.fn()
            };
        });
        it('should setup WebSocket middleware', () => {
            monitoringSystem.setupWebSocketMiddleware(mockServer);
            expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function)); // websocketLoggingMiddleware
            expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function)); // websocketMetricsMiddleware
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('WebSocket middleware configured for monitoring');
        });
        it('should skip metrics middleware when disabled', () => {
            monitoringSystem = new index_1.MonitoringSystem({ enableMetrics: false });
            monitoringSystem.setupWebSocketMiddleware(mockServer);
            expect(mockServer.use).toHaveBeenCalledTimes(1); // Only logging middleware
        });
    });
    describe('getEndpointsInfo', () => {
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
        });
        it('should return all endpoints when enabled', () => {
            const endpoints = monitoringSystem.getEndpointsInfo();
            expect(endpoints).toEqual({
                'Health Check': '/api/health',
                'Liveness Probe': '/api/health/live',
                'Readiness Probe': '/api/health/ready',
                'Metrics': '/api/metrics',
                'Dashboard': '/monitoring/dashboard',
                'Dashboard API': '/monitoring/dashboard/api/*',
                'Alerting WebSocket': 'ws://localhost:3004'
            });
        });
        it('should exclude disabled components', () => {
            monitoringSystem = new index_1.MonitoringSystem({
                enableHealthChecks: false,
                enableDashboard: false,
                enableAlerting: false
            });
            const endpoints = monitoringSystem.getEndpointsInfo();
            expect(endpoints).toEqual({});
        });
        it('should use custom alerting port', () => {
            monitoringSystem = new index_1.MonitoringSystem({ alertingPort: 5000 });
            const endpoints = monitoringSystem.getEndpointsInfo();
            expect(endpoints['Alerting WebSocket']).toBe('ws://localhost:5000');
        });
    });
    describe('getSystemStatus', () => {
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
            performance_metrics_1.performanceMetrics.getAllMetrics = jest.fn().mockReturnValue({ cpu: 50 });
            real_time_alerting_1.alertingManager.getActiveAlerts = jest.fn().mockReturnValue([]);
            real_time_alerting_1.alertingManager.getAlertStatistics = jest.fn().mockReturnValue({ total: 0 });
        });
        it('should return uninitialized status', async () => {
            const status = await monitoringSystem.getSystemStatus();
            expect(status).toEqual({
                monitoring: {
                    initialized: false,
                    components: {
                        metrics: true,
                        healthChecks: true,
                        alerting: true,
                        dashboard: true
                    },
                    uptime: expect.any(Number)
                },
                health: null,
                metrics: null,
                alerts: null
            });
        });
        it('should return initialized status with data', async () => {
            await monitoringSystem.initialize();
            const status = await monitoringSystem.getSystemStatus();
            expect(status.monitoring.initialized).toBe(true);
            expect(status.health).toEqual({ status: 'healthy', services: ['api', 'database'] });
            expect(status.metrics).toEqual({ cpu: 50 });
            expect(status.alerts).toEqual({
                active: 0,
                statistics: { total: 0 }
            });
        });
        it('should handle errors gracefully', async () => {
            await monitoringSystem.initialize();
            health_check_1.healthCheckManager.getHealthReport.mockRejectedValue(new Error('Health error'));
            const status = await monitoringSystem.getSystemStatus();
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Error getting system status', expect.any(Error));
            expect(status.monitoring.initialized).toBe(true);
        });
    });
    describe('shutdown', () => {
        beforeEach(() => {
            monitoringSystem = new index_1.MonitoringSystem();
            performance_metrics_1.performanceMetrics.stop = jest.fn();
            health_check_1.healthCheckManager.stop = jest.fn();
            real_time_alerting_1.alertingManager.stop = jest.fn();
        });
        it('should shutdown all components', async () => {
            await monitoringSystem.initialize();
            await monitoringSystem.shutdown();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Shutting down monitoring system');
            expect(performance_metrics_1.performanceMetrics.stop).toHaveBeenCalled();
            expect(health_check_1.healthCheckManager.stop).toHaveBeenCalled();
            expect(real_time_alerting_1.alertingManager.stop).toHaveBeenCalled();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Monitoring system shut down successfully');
            expect(monitoringSystem['isInitialized']).toBe(false);
        });
        it('should handle shutdown when not initialized', async () => {
            await monitoringSystem.shutdown();
            expect(structured_logger_1.logger.warn).toHaveBeenCalledWith('Monitoring system not initialized');
            expect(performance_metrics_1.performanceMetrics.stop).not.toHaveBeenCalled();
        });
        it('should handle shutdown errors', async () => {
            await monitoringSystem.initialize();
            performance_metrics_1.performanceMetrics.stop.mockImplementation(() => {
                throw new Error('Stop error');
            });
            await expect(monitoringSystem.shutdown()).rejects.toThrow('Failed to shutdown monitoring system');
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to shutdown monitoring system', expect.any(Error));
        });
        it('should skip disabled components during shutdown', async () => {
            monitoringSystem = new index_1.MonitoringSystem({
                enableMetrics: false,
                enableHealthChecks: false,
                enableAlerting: false
            });
            await monitoringSystem.initialize();
            await monitoringSystem.shutdown();
            expect(performance_metrics_1.performanceMetrics.stop).not.toHaveBeenCalled();
            expect(health_check_1.healthCheckManager.stop).not.toHaveBeenCalled();
            expect(real_time_alerting_1.alertingManager.stop).not.toHaveBeenCalled();
        });
    });
    describe('setupMonitoring helper', () => {
        let mockApp;
        let originalProcess;
        beforeEach(() => {
            mockApp = {
                use: jest.fn()
            };
            // Mock metricsDashboard.getDashboardRouter
            require('../infrastructure/metrics-dashboard').metricsDashboard.getDashboardRouter = jest.fn().mockReturnValue('dashboard-router');
            health_check_1.healthCheckManager.getHealthRouter = jest.fn().mockReturnValue('health-router');
            // Store original process handlers
            originalProcess = {
                on: process.on,
                exit: process.exit
            };
            // Mock process methods
            process.on = jest.fn();
            process.exit = jest.fn();
        });
        afterEach(() => {
            // Restore process methods
            process.on = originalProcess.on;
            process.exit = originalProcess.exit;
        });
        it('should setup monitoring with default config', async () => {
            await (0, index_1.setupMonitoring)(mockApp);
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
            expect(mockApp.use).toHaveBeenCalled();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Monitoring endpoints configured', {
                metadata: expect.any(Object)
            });
            expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        });
        it('should setup monitoring with custom config', async () => {
            const config = {
                enableMetrics: false,
                alertingPort: 7000
            };
            await (0, index_1.setupMonitoring)(mockApp, config);
            expect(performance_metrics_1.performanceMetrics.start).not.toHaveBeenCalled();
        });
        it('should handle SIGTERM gracefully', async () => {
            await (0, index_1.setupMonitoring)(mockApp);
            // Get the SIGTERM handler
            const sigTermHandler = process.on.mock.calls.find(call => call[0] === 'SIGTERM')[1];
            // Call the handler
            await sigTermHandler();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Received SIGTERM, shutting down monitoring...');
            expect(process.exit).toHaveBeenCalledWith(0);
        });
        it('should handle SIGINT gracefully', async () => {
            await (0, index_1.setupMonitoring)(mockApp);
            // Get the SIGINT handler
            const sigIntHandler = process.on.mock.calls.find(call => call[0] === 'SIGINT')[1];
            // Call the handler
            await sigIntHandler();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Received SIGINT, shutting down monitoring...');
            expect(process.exit).toHaveBeenCalledWith(0);
        });
        it('should handle setup errors', async () => {
            performance_metrics_1.performanceMetrics.start.mockImplementation(() => {
                throw new Error('Setup error');
            });
            await expect((0, index_1.setupMonitoring)(mockApp)).rejects.toThrow('Setup error');
        });
    });
});
describe('MonitoringSystem Edge Cases', () => {
    let monitoringSystem;
    beforeEach(() => {
        jest.clearAllMocks();
        structured_logger_1.logger.info = jest.fn();
        structured_logger_1.logger.warn = jest.fn();
        structured_logger_1.logger.error = jest.fn();
    });
    it('should handle empty config', () => {
        monitoringSystem = new index_1.MonitoringSystem({});
        expect(monitoringSystem['config'].enableMetrics).toBe(true);
        expect(monitoringSystem['config'].logLevel).toBe('info');
    });
    it('should handle partial component failures during init', async () => {
        monitoringSystem = new index_1.MonitoringSystem();
        health_check_1.healthCheckManager.start.mockImplementation(() => {
            throw new Error('Health check error');
        });
        await expect(monitoringSystem.initialize()).rejects.toThrow('Health check error');
        expect(performance_metrics_1.performanceMetrics.start).toHaveBeenCalled();
        expect(monitoringSystem['isInitialized']).toBe(false);
    });
    it('should maintain idempotency on multiple initializations', async () => {
        monitoringSystem = new index_1.MonitoringSystem();
        await monitoringSystem.initialize();
        const firstCallCount = structured_logger_1.logger.info.mock.calls.length;
        await monitoringSystem.initialize();
        await monitoringSystem.initialize();
        expect(structured_logger_1.logger.warn).toHaveBeenCalledTimes(2);
        expect(structured_logger_1.logger.info.mock.calls.length).toBe(firstCallCount);
    });
});
describe('MonitoringErrorIntegration', () => {
    let errorIntegration;
    let mockError;
    let mockContext;
    beforeEach(() => {
        jest.clearAllMocks();
        // Import and create instance
        const { MonitoringErrorIntegration } = require('../index');
        errorIntegration = new MonitoringErrorIntegration();
        // Setup mocks
        structured_logger_1.logger.error = jest.fn();
        performance_metrics_1.performanceMetrics.increment = jest.fn();
        // Mock errorHandlerIntegration
        const errorHandlerIntegration = require('../infrastructure/real-time-alerting').errorHandlerIntegration;
        errorHandlerIntegration.sendErrorAlert = jest.fn();
        errorHandlerIntegration.getErrorAlertStats = jest.fn().mockReturnValue({ alerts: 10 });
        mockError = new Error('Test error');
        mockError.name = 'TestError';
        mockContext = {
            component: 'test-component',
            correlationId: 'corr-123',
            userId: 'user-456',
            requestId: 'req-789',
            metadata: { extra: 'data' }
        };
    });
    describe('logError', () => {
        it('should log error with context', () => {
            errorIntegration.logError(mockError, mockContext);
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Test error', mockError, {
                component: 'test-component',
                correlationId: 'corr-123',
                userId: 'user-456',
                requestId: 'req-789',
                metadata: { extra: 'data' }
            });
        });
        it('should handle missing context', () => {
            errorIntegration.logError(mockError);
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Test error', mockError, {
                component: 'unknown',
                correlationId: undefined,
                userId: undefined,
                requestId: undefined,
                metadata: undefined
            });
        });
    });
    describe('alertError', () => {
        it('should send error alert with context', () => {
            const errorHandlerIntegration = require('../infrastructure/real-time-alerting').errorHandlerIntegration;
            errorIntegration.alertError(mockError, mockContext);
            expect(errorHandlerIntegration.sendErrorAlert).toHaveBeenCalledWith(mockError, {
                component: 'test-component',
                correlationId: 'corr-123',
                userId: 'user-456',
                requestId: 'req-789',
                metadata: { extra: 'data' }
            });
        });
        it('should handle missing context', () => {
            const errorHandlerIntegration = require('../infrastructure/real-time-alerting').errorHandlerIntegration;
            errorIntegration.alertError(mockError);
            expect(errorHandlerIntegration.sendErrorAlert).toHaveBeenCalledWith(mockError, {
                component: 'unknown',
                correlationId: undefined,
                userId: undefined,
                requestId: undefined,
                metadata: undefined
            });
        });
    });
    describe('trackError', () => {
        it('should track error metrics with context', () => {
            errorIntegration.trackError(mockError, mockContext);
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledWith('errors.total', 1, {
                errorType: 'TestError',
                component: 'test-component'
            });
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledWith('errors.by_type.TestError', 1);
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledWith('errors.by_component.test-component', 1);
        });
        it('should track error without component', () => {
            errorIntegration.trackError(mockError);
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledWith('errors.total', 1, {
                errorType: 'TestError',
                component: 'unknown'
            });
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledWith('errors.by_type.TestError', 1);
            expect(performance_metrics_1.performanceMetrics.increment).toHaveBeenCalledTimes(2); // Not called for component
        });
    });
    describe('getErrorStats', () => {
        it('should return error statistics', () => {
            const stats = errorIntegration.getErrorStats();
            expect(stats).toEqual({ alerts: 10 });
            const errorHandlerIntegration = require('../infrastructure/real-time-alerting').errorHandlerIntegration;
            expect(errorHandlerIntegration.getErrorAlertStats).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=index.test.js.map