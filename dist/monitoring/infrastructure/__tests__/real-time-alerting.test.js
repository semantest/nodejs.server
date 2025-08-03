"use strict";
/**
 * 🧪 Tests for Real-Time Alerting System
 * Testing WebSocket-based alerting and rule engine functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
const real_time_alerting_1 = require("../real-time-alerting");
const ws_1 = require("ws");
// Mock dependencies
jest.mock('ws');
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-alert-id')
}));
jest.mock('../structured-logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        security: jest.fn()
    },
    LogLevel: {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info'
    },
    LogCategory: {
        SYSTEM: 'system',
        SECURITY: 'security'
    }
}));
describe('RealTimeAlertingManager', () => {
    let alertManager;
    let mockWsServer;
    let mockWsClient;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Mock WebSocketServer
        mockWsServer = {
            on: jest.fn(),
            close: jest.fn((callback) => callback && callback()),
            clients: new Set()
        };
        ws_1.WebSocketServer.mockImplementation(() => mockWsServer);
        // Mock WebSocket client
        mockWsClient = {
            readyState: ws_1.WebSocket.OPEN,
            send: jest.fn(),
            on: jest.fn(),
            close: jest.fn()
        };
        alertManager = new real_time_alerting_1.RealTimeAlertingManager();
    });
    afterEach(() => {
        alertManager.stop();
        jest.useRealTimers();
    });
    describe('Lifecycle', () => {
        it('should start alerting system', () => {
            alertManager.start(3005);
            expect(ws_1.WebSocketServer).toHaveBeenCalledWith({ port: 3005 });
            expect(mockWsServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });
        it('should not start if already running', () => {
            alertManager.start();
            const callCount = ws_1.WebSocketServer.mock.calls.length;
            alertManager.start();
            expect(ws_1.WebSocketServer.mock.calls.length).toBe(callCount);
        });
        it('should stop alerting system', () => {
            alertManager.start();
            alertManager.stop();
            expect(mockWsServer.close).toHaveBeenCalled();
        });
    });
    describe('Alert Creation', () => {
        it('should create alert with all properties', () => {
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Test Alert', 'This is a test alert message', 'test-source', { userId: '123', errorCode: 'ERR001' }, ['error', 'test']);
            expect(alert).toMatchObject({
                id: 'test-alert-id',
                type: real_time_alerting_1.AlertType.ERROR,
                severity: real_time_alerting_1.AlertSeverity.HIGH,
                title: 'Test Alert',
                message: 'This is a test alert message',
                source: 'test-source',
                context: { userId: '123', errorCode: 'ERR001' },
                tags: ['error', 'test'],
                resolved: false,
                timestamp: expect.any(Date)
            });
        });
        it('should store alert and emit event', () => {
            const eventHandler = jest.fn();
            alertManager.on('alert', eventHandler);
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.SECURITY, real_time_alerting_1.AlertSeverity.CRITICAL, 'Security Alert', 'Unauthorized access attempt', 'auth-service');
            expect(alertManager.getActiveAlerts()).toHaveLength(1);
            expect(eventHandler).toHaveBeenCalledWith(alert);
        });
        it('should broadcast alert to WebSocket subscribers', () => {
            alertManager.start();
            // Add a mock connection
            alertManager['wsConnections'].set('conn-1', mockWsClient);
            alertManager['subscriptions'].set('sub-1', {
                id: 'sub-1',
                connectionId: 'conn-1',
                filters: {},
                createdAt: new Date()
            });
            alertManager.createAlert(real_time_alerting_1.AlertType.PERFORMANCE, real_time_alerting_1.AlertSeverity.MEDIUM, 'Performance Alert', 'High response time detected', 'api-service');
            expect(mockWsClient.send).toHaveBeenCalledWith(expect.stringContaining('"type":"alert"'));
        });
    });
    describe('Alert Resolution', () => {
        it('should resolve alert', () => {
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Test Alert', 'Test message', 'test');
            const resolved = alertManager.resolveAlert(alert.id, 'user-123');
            expect(resolved).toBe(true);
            expect(alert.resolved).toBe(true);
            expect(alert.resolvedAt).toBeDefined();
            expect(alert.resolvedBy).toBe('user-123');
        });
        it('should return false for non-existent alert', () => {
            const resolved = alertManager.resolveAlert('non-existent', 'user-123');
            expect(resolved).toBe(false);
        });
        it('should emit resolution event', () => {
            const eventHandler = jest.fn();
            alertManager.on('alert:resolved', eventHandler);
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Test Alert', 'Test message', 'test');
            alertManager.resolveAlert(alert.id, 'user-123');
            expect(eventHandler).toHaveBeenCalledWith(alert);
        });
    });
    describe('Alert Acknowledgment', () => {
        it('should acknowledge alert', () => {
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Test Alert', 'Test message', 'test');
            const acknowledged = alertManager.acknowledgeAlert(alert.id, 'user-123');
            expect(acknowledged).toBe(true);
            expect(alert.acknowledgedBy).toContain('user-123');
        });
        it('should not acknowledge same user twice', () => {
            const alert = alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Test Alert', 'Test message', 'test');
            alertManager.acknowledgeAlert(alert.id, 'user-123');
            alertManager.acknowledgeAlert(alert.id, 'user-123');
            expect(alert.acknowledgedBy).toHaveLength(1);
        });
    });
    describe('Alert Filtering', () => {
        beforeEach(() => {
            // Create various alerts
            alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Error 1', 'Message', 'api');
            alertManager.createAlert(real_time_alerting_1.AlertType.SECURITY, real_time_alerting_1.AlertSeverity.CRITICAL, 'Security 1', 'Message', 'auth');
            alertManager.createAlert(real_time_alerting_1.AlertType.PERFORMANCE, real_time_alerting_1.AlertSeverity.MEDIUM, 'Perf 1', 'Message', 'api');
            alertManager.createAlert(real_time_alerting_1.AlertType.HEALTH, real_time_alerting_1.AlertSeverity.LOW, 'Health 1', 'Message', 'system');
        });
        it('should filter by type', () => {
            const alerts = alertManager.getActiveAlerts({
                types: [real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertType.SECURITY]
            });
            expect(alerts).toHaveLength(2);
            expect(alerts.every(a => [real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertType.SECURITY].includes(a.type))).toBe(true);
        });
        it('should filter by severity', () => {
            const alerts = alertManager.getActiveAlerts({
                severities: [real_time_alerting_1.AlertSeverity.HIGH, real_time_alerting_1.AlertSeverity.CRITICAL]
            });
            expect(alerts).toHaveLength(2);
        });
        it('should filter by source', () => {
            const alerts = alertManager.getActiveAlerts({
                sources: ['api']
            });
            expect(alerts).toHaveLength(2);
        });
        it('should filter by multiple criteria', () => {
            const alerts = alertManager.getActiveAlerts({
                types: [real_time_alerting_1.AlertType.ERROR],
                severities: [real_time_alerting_1.AlertSeverity.HIGH],
                sources: ['api']
            });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].title).toBe('Error 1');
        });
    });
    describe('Alert Rules', () => {
        it('should add alert rule', () => {
            const rule = {
                id: 'cpu-high',
                name: 'High CPU Usage',
                description: 'Alert when CPU usage exceeds 80%',
                type: real_time_alerting_1.AlertType.PERFORMANCE,
                severity: real_time_alerting_1.AlertSeverity.HIGH,
                condition: (data) => data.cpu > 80,
                message: (data) => `CPU usage is ${data.cpu}%`,
                enabled: true
            };
            alertManager.addAlertRule(rule);
            const rules = alertManager.getAlertRules();
            expect(rules).toHaveLength(expect.any(Number));
            expect(rules.find(r => r.id === 'cpu-high')).toBeDefined();
        });
        it('should evaluate rules and create alerts', () => {
            const rule = {
                id: 'memory-high',
                name: 'High Memory Usage',
                description: 'Alert when memory usage exceeds 90%',
                type: real_time_alerting_1.AlertType.PERFORMANCE,
                severity: real_time_alerting_1.AlertSeverity.HIGH,
                condition: (data) => data.memory > 90,
                message: (data) => `Memory usage is ${data.memory}%`,
                enabled: true
            };
            alertManager.addAlertRule(rule);
            // Evaluate with data that should trigger the rule
            alertManager.evaluateRules({ memory: 95 }, 'monitoring-system');
            const alerts = alertManager.getActiveAlerts();
            expect(alerts).toHaveLength(1);
            expect(alerts[0].message).toBe('Memory usage is 95%');
        });
        it('should respect rule cooldown', () => {
            const rule = {
                id: 'test-cooldown',
                name: 'Test Cooldown',
                description: 'Test rule with cooldown',
                type: real_time_alerting_1.AlertType.SYSTEM,
                severity: real_time_alerting_1.AlertSeverity.LOW,
                condition: () => true,
                message: () => 'Test alert',
                cooldown: 5000, // 5 seconds
                enabled: true
            };
            alertManager.addAlertRule(rule);
            // First evaluation should create alert
            alertManager.evaluateRules({}, 'test');
            expect(alertManager.getActiveAlerts()).toHaveLength(1);
            // Second immediate evaluation should not create alert due to cooldown
            alertManager.evaluateRules({}, 'test');
            expect(alertManager.getActiveAlerts()).toHaveLength(1);
            // After cooldown, should create another alert
            jest.advanceTimersByTime(5001);
            alertManager.evaluateRules({}, 'test');
            expect(alertManager.getActiveAlerts()).toHaveLength(2);
        });
        it('should disable rule', () => {
            const rule = {
                id: 'test-disable',
                name: 'Test Disable',
                description: 'Test rule to disable',
                type: real_time_alerting_1.AlertType.SYSTEM,
                severity: real_time_alerting_1.AlertSeverity.LOW,
                condition: () => true,
                message: () => 'Test alert',
                enabled: true
            };
            alertManager.addAlertRule(rule);
            alertManager.disableAlertRule('test-disable');
            // Should not create alert when disabled
            alertManager.evaluateRules({}, 'test');
            expect(alertManager.getActiveAlerts()).toHaveLength(0);
        });
    });
    describe('Alert Statistics', () => {
        beforeEach(() => {
            // Create various alerts
            alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Error 1', 'Message', 'api');
            alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.CRITICAL, 'Error 2', 'Message', 'api');
            alertManager.createAlert(real_time_alerting_1.AlertType.SECURITY, real_time_alerting_1.AlertSeverity.CRITICAL, 'Security 1', 'Message', 'auth');
            alertManager.createAlert(real_time_alerting_1.AlertType.PERFORMANCE, real_time_alerting_1.AlertSeverity.MEDIUM, 'Perf 1', 'Message', 'api');
            // Resolve one alert
            const alerts = alertManager.getActiveAlerts();
            alertManager.resolveAlert(alerts[0].id, 'user-123');
        });
        it('should calculate alert statistics', () => {
            const stats = alertManager.getAlertStatistics();
            expect(stats.total).toBe(4);
            expect(stats.active).toBe(3);
            expect(stats.resolved).toBe(1);
            expect(stats.bySeverity.critical).toBe(2);
            expect(stats.bySeverity.high).toBe(1);
            expect(stats.bySeverity.medium).toBe(1);
            expect(stats.bySeverity.low).toBe(0);
            expect(stats.byType.error).toBe(2);
            expect(stats.byType.security).toBe(1);
            expect(stats.byType.performance).toBe(1);
        });
    });
    describe('WebSocket Integration', () => {
        beforeEach(() => {
            alertManager.start();
        });
        it('should handle WebSocket connection', () => {
            const connectionHandler = mockWsServer.on.mock.calls.find(call => call[0] === 'connection')[1];
            connectionHandler(mockWsClient);
            expect(mockWsClient.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWsClient.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockWsClient.send).toHaveBeenCalledWith(expect.stringContaining('"type":"connected"'));
        });
        it('should handle subscription message', () => {
            const connectionHandler = mockWsServer.on.mock.calls.find(call => call[0] === 'connection')[1];
            connectionHandler(mockWsClient);
            const messageHandler = mockWsClient.on.mock.calls.find(call => call[0] === 'message')[1];
            // Send subscription message
            messageHandler(JSON.stringify({
                type: 'subscribe',
                filters: {
                    types: ['error'],
                    severities: ['high', 'critical']
                }
            }));
            expect(mockWsClient.send).toHaveBeenCalledWith(expect.stringContaining('"type":"subscribed"'));
        });
        it('should filter alerts based on subscription', () => {
            const connectionHandler = mockWsServer.on.mock.calls.find(call => call[0] === 'connection')[1];
            connectionHandler(mockWsClient);
            const messageHandler = mockWsClient.on.mock.calls.find(call => call[0] === 'message')[1];
            // Subscribe to only error alerts
            messageHandler(JSON.stringify({
                type: 'subscribe',
                filters: {
                    types: ['error']
                }
            }));
            // Clear previous calls
            mockWsClient.send.mockClear();
            // Create error alert - should be sent
            alertManager.createAlert(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Error Alert', 'Message', 'test');
            expect(mockWsClient.send).toHaveBeenCalled();
            mockWsClient.send.mockClear();
            // Create performance alert - should not be sent
            alertManager.createAlert(real_time_alerting_1.AlertType.PERFORMANCE, real_time_alerting_1.AlertSeverity.HIGH, 'Perf Alert', 'Message', 'test');
            expect(mockWsClient.send).not.toHaveBeenCalled();
        });
        it('should handle WebSocket disconnection', () => {
            const connectionHandler = mockWsServer.on.mock.calls.find(call => call[0] === 'connection')[1];
            connectionHandler(mockWsClient);
            const closeHandler = mockWsClient.on.mock.calls.find(call => call[0] === 'close')[1];
            // Verify connection exists
            expect(alertManager['wsConnections'].size).toBe(1);
            // Trigger close
            closeHandler();
            // Verify cleanup
            expect(alertManager['wsConnections'].size).toBe(0);
        });
    });
});
describe('ErrorHandlerIntegration', () => {
    let integration;
    beforeEach(() => {
        jest.clearAllMocks();
        integration = real_time_alerting_1.errorHandlerIntegration;
    });
    describe('sendErrorAlert', () => {
        it('should create error alert', () => {
            const error = new Error('Test error');
            integration.sendErrorAlert(error, {
                component: 'test-component',
                correlationId: 'corr-123',
                userId: 'user-456'
            });
            expect(real_time_alerting_1.alertingManager.createAlert).toHaveBeenCalledWith(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.HIGH, 'Application Error', 'Test error', 'test-component', expect.objectContaining({
                errorName: 'Error',
                correlationId: 'corr-123',
                userId: 'user-456'
            }), ['error', 'application']);
        });
        it('should determine severity based on error type', () => {
            const criticalError = new Error('Database connection failed');
            integration.sendErrorAlert(criticalError, { component: 'database' });
            // Should be called with CRITICAL severity for database errors
            expect(real_time_alerting_1.alertingManager.createAlert).toHaveBeenCalledWith(real_time_alerting_1.AlertType.ERROR, real_time_alerting_1.AlertSeverity.CRITICAL, expect.any(String), expect.any(String), expect.any(String), expect.any(Object), expect.any(Array));
        });
    });
    describe('getErrorAlertStats', () => {
        it('should return error statistics', () => {
            // Mock some alerts
            const mockAlerts = [
                { type: real_time_alerting_1.AlertType.ERROR, severity: real_time_alerting_1.AlertSeverity.HIGH },
                { type: real_time_alerting_1.AlertType.ERROR, severity: real_time_alerting_1.AlertSeverity.CRITICAL },
                { type: real_time_alerting_1.AlertType.SECURITY, severity: real_time_alerting_1.AlertSeverity.HIGH }
            ];
            real_time_alerting_1.alertingManager.getActiveAlerts.mockReturnValue(mockAlerts);
            real_time_alerting_1.alertingManager.getAlertStatistics.mockReturnValue({
                total: 10,
                active: 3,
                resolved: 7
            });
            const stats = integration.getErrorAlertStats();
            expect(stats).toEqual({
                totalErrors: 2,
                activeErrors: 2,
                errorsBySeverity: {
                    high: 1,
                    critical: 1
                },
                overallStats: {
                    total: 10,
                    active: 3,
                    resolved: 7
                }
            });
        });
    });
});
describe('Default Instances', () => {
    it('should export alertingManager instance', () => {
        expect(real_time_alerting_1.alertingManager).toBeDefined();
        expect(real_time_alerting_1.alertingManager).toBeInstanceOf(real_time_alerting_1.RealTimeAlertingManager);
    });
    it('should export errorHandlerIntegration instance', () => {
        expect(real_time_alerting_1.errorHandlerIntegration).toBeDefined();
        expect(real_time_alerting_1.errorHandlerIntegration).toHaveProperty('sendErrorAlert');
        expect(real_time_alerting_1.errorHandlerIntegration).toHaveProperty('getErrorAlertStats');
    });
});
//# sourceMappingURL=real-time-alerting.test.js.map