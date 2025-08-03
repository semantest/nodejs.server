"use strict";
/**
 * Monitoring Integration Tests
 * Comprehensive tests for the monitoring infrastructure
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("./index");
const structured_logger_1 = require("./infrastructure/structured-logger");
const performance_metrics_1 = require("./infrastructure/performance-metrics");
const health_check_1 = require("./infrastructure/health-check");
const real_time_alerting_1 = require("./infrastructure/real-time-alerting");
const express_1 = __importDefault(require("express"));
const ws_1 = __importDefault(require("ws"));
(0, globals_1.describe)('Monitoring Integration Tests', () => {
    let monitoringSystem;
    let mockApp;
    (0, globals_1.beforeEach)(() => {
        monitoringSystem = new index_1.MonitoringSystem({
            enableMetrics: true,
            enableHealthChecks: true,
            enableAlerting: true,
            enableDashboard: true,
            alertingPort: 3005, // Different port for testing
            metricsInterval: 1000 // Shorter interval for testing
        });
        mockApp = (0, express_1.default)();
    });
    (0, globals_1.afterEach)(async () => {
        await monitoringSystem.shutdown();
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.describe)('System Initialization', () => {
        (0, globals_1.it)('should initialize all monitoring components', async () => {
            await monitoringSystem.initialize();
            const status = await monitoringSystem.getSystemStatus();
            (0, globals_1.expect)(status.monitoring.initialized).toBe(true);
            (0, globals_1.expect)(status.monitoring.components.metrics).toBe(true);
            (0, globals_1.expect)(status.monitoring.components.healthChecks).toBe(true);
            (0, globals_1.expect)(status.monitoring.components.alerting).toBe(true);
            (0, globals_1.expect)(status.monitoring.components.dashboard).toBe(true);
        });
        (0, globals_1.it)('should setup Express middleware correctly', async () => {
            await monitoringSystem.initialize();
            monitoringSystem.setupExpressMiddleware(mockApp);
            const endpoints = monitoringSystem.getEndpointsInfo();
            (0, globals_1.expect)(endpoints['Health Check']).toBe('/api/health');
            (0, globals_1.expect)(endpoints['Dashboard']).toBe('/monitoring/dashboard');
            (0, globals_1.expect)(endpoints['Alerting WebSocket']).toBe('ws://localhost:3005');
        });
        (0, globals_1.it)('should handle shutdown gracefully', async () => {
            await monitoringSystem.initialize();
            await monitoringSystem.shutdown();
            const status = await monitoringSystem.getSystemStatus();
            (0, globals_1.expect)(status.monitoring.initialized).toBe(false);
        });
    });
    (0, globals_1.describe)('Structured Logging', () => {
        (0, globals_1.it)('should log with correlation ID', () => {
            const mockLog = globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
            structured_logger_1.logger.info('Test message', {
                correlationId: 'test-correlation-id',
                userId: 'test-user',
                metadata: { key: 'value' }
            });
            (0, globals_1.expect)(mockLog).toHaveBeenCalled();
            mockLog.mockRestore();
        });
        (0, globals_1.it)('should log errors with stack traces', () => {
            const mockLog = globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
            const testError = new Error('Test error');
            structured_logger_1.logger.error('Error occurred', testError, {
                component: 'test-component'
            });
            (0, globals_1.expect)(mockLog).toHaveBeenCalled();
            mockLog.mockRestore();
        });
        (0, globals_1.it)('should create performance timers', () => {
            const endTimer = structured_logger_1.logger.createTimer('test-operation');
            // Simulate some work
            setTimeout(() => {
                endTimer();
            }, 100);
            (0, globals_1.expect)(typeof endTimer).toBe('function');
        });
    });
    (0, globals_1.describe)('Performance Metrics', () => {
        (0, globals_1.beforeEach)(() => {
            performance_metrics_1.performanceMetrics.start();
        });
        (0, globals_1.afterEach)(() => {
            performance_metrics_1.performanceMetrics.stop();
            performance_metrics_1.performanceMetrics.clear();
        });
        (0, globals_1.it)('should record timing metrics', () => {
            performance_metrics_1.performanceMetrics.timing('test.operation', 100);
            const summary = performance_metrics_1.performanceMetrics.getMetricSummary('test.operation');
            (0, globals_1.expect)(summary).toBeDefined();
            (0, globals_1.expect)(summary.count).toBe(1);
            (0, globals_1.expect)(summary.avg).toBe(100);
        });
        (0, globals_1.it)('should increment counters', () => {
            performance_metrics_1.performanceMetrics.increment('test.counter', 5);
            performance_metrics_1.performanceMetrics.increment('test.counter', 3);
            const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
            (0, globals_1.expect)(allMetrics.counters['test.counter']).toBe(8);
        });
        (0, globals_1.it)('should set gauge values', () => {
            performance_metrics_1.performanceMetrics.gauge('test.gauge', 42);
            const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
            (0, globals_1.expect)(allMetrics.gauges['test.gauge']).toBe(42);
        });
        (0, globals_1.it)('should record HTTP request metrics', () => {
            performance_metrics_1.performanceMetrics.recordHttpRequest('GET', '/api/test', 200, 150, 1024);
            const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
            (0, globals_1.expect)(allMetrics.counters['http.request.count']).toBe(1);
        });
        (0, globals_1.it)('should record WebSocket connection metrics', () => {
            performance_metrics_1.performanceMetrics.recordWebSocketConnection('connect');
            performance_metrics_1.performanceMetrics.recordWebSocketConnection('disconnect');
            const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
            (0, globals_1.expect)(allMetrics.counters['websocket.connect']).toBe(1);
            (0, globals_1.expect)(allMetrics.counters['websocket.disconnect']).toBe(1);
        });
        (0, globals_1.it)('should export Prometheus metrics', () => {
            performance_metrics_1.performanceMetrics.increment('test.counter', 5);
            performance_metrics_1.performanceMetrics.gauge('test.gauge', 42);
            const prometheusMetrics = performance_metrics_1.performanceMetrics.exportPrometheusMetrics();
            (0, globals_1.expect)(prometheusMetrics).toContain('test.counter 5');
            (0, globals_1.expect)(prometheusMetrics).toContain('test.gauge 42');
        });
    });
    (0, globals_1.describe)('Health Checks', () => {
        (0, globals_1.beforeEach)(() => {
            health_check_1.healthCheckManager.start();
        });
        (0, globals_1.afterEach)(() => {
            health_check_1.healthCheckManager.stop();
        });
        (0, globals_1.it)('should run system health check', async () => {
            const result = await health_check_1.healthCheckManager.runHealthCheck('system');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.status).toBeDefined();
            (0, globals_1.expect)(result.timestamp).toBeDefined();
            (0, globals_1.expect)(result.duration).toBeGreaterThanOrEqual(0);
        });
        (0, globals_1.it)('should generate comprehensive health report', async () => {
            const report = await health_check_1.healthCheckManager.getHealthReport();
            (0, globals_1.expect)(report.overall).toBeDefined();
            (0, globals_1.expect)(report.timestamp).toBeDefined();
            (0, globals_1.expect)(report.version).toBeDefined();
            (0, globals_1.expect)(report.services).toBeDefined();
            (0, globals_1.expect)(report.system).toBeDefined();
            (0, globals_1.expect)(report.business).toBeDefined();
        });
        (0, globals_1.it)('should add custom health check', async () => {
            health_check_1.healthCheckManager.addHealthCheck({
                name: 'custom-test',
                check: async () => ({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    duration: 0,
                    details: { test: true }
                }),
                timeout: 1000,
                critical: false
            });
            const result = await health_check_1.healthCheckManager.runHealthCheck('custom-test');
            (0, globals_1.expect)(result.status).toBe('healthy');
            (0, globals_1.expect)(result.details?.test).toBe(true);
        });
    });
    (0, globals_1.describe)('Real-time Alerting', () => {
        (0, globals_1.beforeEach)(() => {
            real_time_alerting_1.alertingManager.start(3006); // Different port
        });
        (0, globals_1.afterEach)(() => {
            real_time_alerting_1.alertingManager.stop();
        });
        (0, globals_1.it)('should create alerts', () => {
            const alert = real_time_alerting_1.alertingManager.createAlert('error', 'high', 'Test Alert', 'This is a test alert', 'test-source', { test: true }, ['test']);
            (0, globals_1.expect)(alert.id).toBeDefined();
            (0, globals_1.expect)(alert.type).toBe('error');
            (0, globals_1.expect)(alert.severity).toBe('high');
            (0, globals_1.expect)(alert.title).toBe('Test Alert');
            (0, globals_1.expect)(alert.message).toBe('This is a test alert');
            (0, globals_1.expect)(alert.source).toBe('test-source');
            (0, globals_1.expect)(alert.resolved).toBe(false);
        });
        (0, globals_1.it)('should get active alerts', () => {
            real_time_alerting_1.alertingManager.createAlert('error', 'high', 'Test Alert 1', 'Message 1', 'test-source');
            real_time_alerting_1.alertingManager.createAlert('performance', 'medium', 'Test Alert 2', 'Message 2', 'test-source');
            const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
            (0, globals_1.expect)(activeAlerts).toHaveLength(2);
            const errorAlerts = real_time_alerting_1.alertingManager.getActiveAlerts({
                types: ['error']
            });
            (0, globals_1.expect)(errorAlerts).toHaveLength(1);
            (0, globals_1.expect)(errorAlerts[0].type).toBe('error');
        });
        (0, globals_1.it)('should resolve alerts', () => {
            const alert = real_time_alerting_1.alertingManager.createAlert('error', 'high', 'Test Alert', 'Test message', 'test-source');
            const resolved = real_time_alerting_1.alertingManager.resolveAlert(alert.id, 'test-user');
            (0, globals_1.expect)(resolved).toBe(true);
            const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
            (0, globals_1.expect)(activeAlerts).toHaveLength(0);
        });
        (0, globals_1.it)('should acknowledge alerts', () => {
            const alert = real_time_alerting_1.alertingManager.createAlert('error', 'high', 'Test Alert', 'Test message', 'test-source');
            const acknowledged = real_time_alerting_1.alertingManager.acknowledgeAlert(alert.id, 'test-user');
            (0, globals_1.expect)(acknowledged).toBe(true);
        });
        (0, globals_1.it)('should get alert statistics', () => {
            real_time_alerting_1.alertingManager.createAlert('error', 'critical', 'Critical Alert', 'Critical message', 'test-source');
            real_time_alerting_1.alertingManager.createAlert('performance', 'medium', 'Performance Alert', 'Performance message', 'test-source');
            const stats = real_time_alerting_1.alertingManager.getAlertStatistics();
            (0, globals_1.expect)(stats.total).toBe(2);
            (0, globals_1.expect)(stats.active).toBe(2);
            (0, globals_1.expect)(stats.bySeverity.critical).toBe(1);
            (0, globals_1.expect)(stats.bySeverity.medium).toBe(1);
            (0, globals_1.expect)(stats.byType.error).toBe(1);
            (0, globals_1.expect)(stats.byType.performance).toBe(1);
        });
        (0, globals_1.it)('should evaluate alert rules', () => {
            // Add a test rule
            real_time_alerting_1.alertingManager.addAlertRule({
                id: 'test-rule',
                name: 'Test Rule',
                description: 'Test rule for high CPU',
                type: 'performance',
                severity: 'high',
                condition: (data) => data.cpu > 0.8,
                message: (data) => `CPU usage is ${data.cpu}`,
                enabled: true
            });
            // Evaluate with data that should trigger the rule
            real_time_alerting_1.alertingManager.evaluateRules({ cpu: 0.9 }, 'test-source');
            const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
            (0, globals_1.expect)(activeAlerts).toHaveLength(1);
            (0, globals_1.expect)(activeAlerts[0].type).toBe('performance');
            (0, globals_1.expect)(activeAlerts[0].severity).toBe('high');
        });
    });
    (0, globals_1.describe)('Error Handler Integration', () => {
        (0, globals_1.it)('should log errors through integration', () => {
            const mockLog = globals_1.jest.spyOn(console, 'log').mockImplementation(() => { });
            const testError = new Error('Integration test error');
            index_1.errorIntegration.logError(testError, {
                component: 'test-component',
                correlationId: 'test-correlation'
            });
            (0, globals_1.expect)(mockLog).toHaveBeenCalled();
            mockLog.mockRestore();
        });
        (0, globals_1.it)('should create alerts for errors', () => {
            const testError = new Error('Test error for alerting');
            index_1.errorIntegration.alertError(testError, {
                component: 'test-component'
            });
            const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
            (0, globals_1.expect)(activeAlerts.length).toBeGreaterThan(0);
            const errorAlert = activeAlerts.find(alert => alert.type === 'error');
            (0, globals_1.expect)(errorAlert).toBeDefined();
            (0, globals_1.expect)(errorAlert.message).toBe('Test error for alerting');
        });
        (0, globals_1.it)('should track error metrics', () => {
            const testError = new Error('Test error for metrics');
            index_1.errorIntegration.trackError(testError, {
                component: 'test-component'
            });
            const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
            (0, globals_1.expect)(allMetrics.counters['errors.total']).toBe(1);
            (0, globals_1.expect)(allMetrics.counters['errors.by_type.Error']).toBe(1);
        });
        (0, globals_1.it)('should get error statistics', () => {
            const testError = new Error('Test error for stats');
            index_1.errorIntegration.alertError(testError, {
                component: 'test-component'
            });
            const stats = index_1.errorIntegration.getErrorStats();
            (0, globals_1.expect)(stats).toBeDefined();
            (0, globals_1.expect)(stats.totalErrors).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('WebSocket Integration', () => {
        (0, globals_1.it)('should handle WebSocket connections for alerts', (done) => {
            const wsPort = 3007;
            real_time_alerting_1.alertingManager.start(wsPort);
            const ws = new ws_1.default(`ws://localhost:${wsPort}`);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    filters: {
                        types: ['error']
                    }
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'subscribed') {
                    // Create an alert that should be sent to the WebSocket
                    real_time_alerting_1.alertingManager.createAlert('error', 'high', 'WebSocket Test Alert', 'Test message', 'test-source');
                }
                if (message.type === 'alert') {
                    (0, globals_1.expect)(message.alert.title).toBe('WebSocket Test Alert');
                    ws.close();
                    done();
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
        });
    });
});
(0, globals_1.describe)('Integration with Express App', () => {
    (0, globals_1.it)('should integrate with Express application', async () => {
        const app = (0, express_1.default)();
        const monitoring = new index_1.MonitoringSystem();
        await monitoring.initialize();
        monitoring.setupExpressMiddleware(app);
        const endpoints = monitoring.getEndpointsInfo();
        (0, globals_1.expect)(endpoints['Health Check']).toBe('/api/health');
        (0, globals_1.expect)(endpoints['Dashboard']).toBe('/monitoring/dashboard');
        await monitoring.shutdown();
    });
});
(0, globals_1.describe)('End-to-End Monitoring Flow', () => {
    (0, globals_1.it)('should handle complete monitoring flow', async () => {
        const monitoring = new index_1.MonitoringSystem();
        // Initialize
        await monitoring.initialize();
        // Simulate application activity
        performance_metrics_1.performanceMetrics.recordHttpRequest('GET', '/api/test', 200, 150);
        performance_metrics_1.performanceMetrics.recordWebSocketConnection('connect');
        // Create an error
        const testError = new Error('End-to-end test error');
        index_1.errorIntegration.logError(testError, { component: 'e2e-test' });
        index_1.errorIntegration.trackError(testError, { component: 'e2e-test' });
        index_1.errorIntegration.alertError(testError, { component: 'e2e-test' });
        // Check health
        const healthReport = await health_check_1.healthCheckManager.getHealthReport();
        (0, globals_1.expect)(healthReport.overall).toBeDefined();
        // Check metrics
        const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
        (0, globals_1.expect)(allMetrics.counters['http.request.count']).toBe(1);
        (0, globals_1.expect)(allMetrics.counters['websocket.connect']).toBe(1);
        (0, globals_1.expect)(allMetrics.counters['errors.total']).toBe(1);
        // Check alerts
        const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
        (0, globals_1.expect)(activeAlerts.length).toBeGreaterThan(0);
        // Get system status
        const status = await monitoring.getSystemStatus();
        (0, globals_1.expect)(status.monitoring.initialized).toBe(true);
        (0, globals_1.expect)(status.health).toBeDefined();
        (0, globals_1.expect)(status.metrics).toBeDefined();
        (0, globals_1.expect)(status.alerts).toBeDefined();
        // Cleanup
        await monitoring.shutdown();
    });
});
//# sourceMappingURL=monitoring-integration.test.js.map