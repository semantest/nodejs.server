"use strict";
/**
 * Tests for HealthCheckManager
 * Testing comprehensive health monitoring system
 */
Object.defineProperty(exports, "__esModule", { value: true });
const health_check_1 = require("../health-check");
const express_1 = require("express");
const performance_metrics_1 = require("../performance-metrics");
// Mock dependencies
jest.mock('../performance-metrics');
jest.mock('../structured-logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));
// Mock Express router
const mockRouter = {
    get: jest.fn()
};
jest.mock('express', () => ({
    Router: jest.fn(() => mockRouter)
}));
// Mock performance
const mockPerformanceNow = jest.fn();
global.performance = {
    now: mockPerformanceNow
};
// Mock process.uptime
jest.spyOn(process, 'uptime').mockReturnValue(3600);
describe('HealthCheckManager', () => {
    let healthCheckManager;
    let mockSystemMetrics;
    let mockBusinessMetrics;
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup mock metrics
        mockSystemMetrics = {
            memory: { used: 1000, total: 2000 },
            cpu: { usage: 0.5 },
            uptime: 3600
        };
        mockBusinessMetrics = {
            websocketConnections: {
                active: 10,
                total: 100,
                failed: 5
            }
        };
        performance_metrics_1.performanceMetrics.getSystemMetrics.mockReturnValue(mockSystemMetrics);
        performance_metrics_1.performanceMetrics.getBusinessMetrics.mockReturnValue(mockBusinessMetrics);
        performance_metrics_1.performanceMetrics.getAllMetrics.mockReturnValue({ system: mockSystemMetrics, business: mockBusinessMetrics });
        performance_metrics_1.performanceMetrics.exportPrometheusMetrics.mockReturnValue('# HELP metrics\n# TYPE gauge\nmetric_value 1');
        mockPerformanceNow.mockReturnValue(1000);
        healthCheckManager = new health_check_1.HealthCheckManager('1.0.0');
    });
    afterEach(() => {
        healthCheckManager.stop();
    });
    describe('constructor', () => {
        it('should initialize with version', () => {
            expect(healthCheckManager).toBeDefined();
            expect(healthCheckManager.version).toBe('1.0.0');
        });
        it('should setup default health checks', () => {
            const checks = healthCheckManager.healthChecks;
            expect(checks.has('system')).toBe(true);
            expect(checks.has('websocket')).toBe(true);
            expect(checks.has('process')).toBe(true);
        });
        it('should use default version if not provided', () => {
            const defaultManager = new health_check_1.HealthCheckManager();
            expect(defaultManager.version).toBe('1.0.0');
        });
    });
    describe('addHealthCheck', () => {
        it('should add a health check', () => {
            const check = {
                name: 'test-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 100
                })
            };
            healthCheckManager.addHealthCheck(check);
            expect(healthCheckManager.healthChecks.has('test-check')).toBe(true);
        });
        it('should start periodic check if interval specified and running', () => {
            healthCheckManager.start();
            const check = {
                name: 'periodic-check',
                check: jest.fn(),
                interval: 5000
            };
            healthCheckManager.addHealthCheck(check);
            expect(healthCheckManager.checkIntervals.has('periodic-check')).toBe(true);
        });
        it('should not start periodic check if not running', () => {
            const check = {
                name: 'periodic-check',
                check: jest.fn(),
                interval: 5000
            };
            healthCheckManager.addHealthCheck(check);
            expect(healthCheckManager.checkIntervals.has('periodic-check')).toBe(false);
        });
    });
    describe('removeHealthCheck', () => {
        it('should remove a health check', () => {
            const check = {
                name: 'test-check',
                check: jest.fn()
            };
            healthCheckManager.addHealthCheck(check);
            healthCheckManager.removeHealthCheck('test-check');
            expect(healthCheckManager.healthChecks.has('test-check')).toBe(false);
        });
        it('should clear interval when removing', () => {
            healthCheckManager.start();
            const check = {
                name: 'periodic-check',
                check: jest.fn(),
                interval: 5000
            };
            healthCheckManager.addHealthCheck(check);
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            healthCheckManager.removeHealthCheck('periodic-check');
            expect(clearIntervalSpy).toHaveBeenCalled();
            expect(healthCheckManager.checkIntervals.has('periodic-check')).toBe(false);
        });
    });
    describe('start/stop', () => {
        it('should start monitoring', () => {
            healthCheckManager.start();
            expect(healthCheckManager.isRunning).toBe(true);
        });
        it('should not start if already running', () => {
            healthCheckManager.start();
            const intervalCount = healthCheckManager.checkIntervals.size;
            healthCheckManager.start();
            expect(healthCheckManager.checkIntervals.size).toBe(intervalCount);
        });
        it('should stop monitoring', () => {
            healthCheckManager.start();
            healthCheckManager.stop();
            expect(healthCheckManager.isRunning).toBe(false);
            expect(healthCheckManager.checkIntervals.size).toBe(0);
        });
        it('should not stop if not running', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            healthCheckManager.stop();
            expect(clearIntervalSpy).not.toHaveBeenCalled();
        });
    });
    describe('runHealthCheck', () => {
        it('should run a specific health check', async () => {
            const mockResult = {
                status: health_check_1.HealthStatus.HEALTHY,
                timestamp: new Date().toISOString(),
                duration: 0,
                details: { test: true }
            };
            const check = {
                name: 'test-check',
                check: jest.fn().mockResolvedValue(mockResult)
            };
            healthCheckManager.addHealthCheck(check);
            const result = await healthCheckManager.runHealthCheck('test-check');
            expect(result.status).toBe(health_check_1.HealthStatus.HEALTHY);
            expect(result.duration).toBeGreaterThan(0);
            expect(check.check).toHaveBeenCalled();
        });
        it('should handle check timeout', async () => {
            const check = {
                name: 'slow-check',
                check: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000))),
                timeout: 100
            };
            healthCheckManager.addHealthCheck(check);
            const result = await healthCheckManager.runHealthCheck('slow-check');
            expect(result.status).toBe(health_check_1.HealthStatus.UNHEALTHY);
            expect(result.error).toBe('Health check timeout');
        });
        it('should handle check errors', async () => {
            const check = {
                name: 'error-check',
                check: jest.fn().mockRejectedValue(new Error('Check failed'))
            };
            healthCheckManager.addHealthCheck(check);
            const result = await healthCheckManager.runHealthCheck('error-check');
            expect(result.status).toBe(health_check_1.HealthStatus.UNHEALTHY);
            expect(result.error).toBe('Check failed');
        });
        it('should throw error for non-existent check', async () => {
            await expect(healthCheckManager.runHealthCheck('non-existent'))
                .rejects.toThrow('Health check not found: non-existent');
        });
        it('should create critical alert for unhealthy critical service', async () => {
            const check = {
                name: 'critical-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                }),
                critical: true
            };
            healthCheckManager.addHealthCheck(check);
            await healthCheckManager.runHealthCheck('critical-check');
            const alerts = healthCheckManager.alerts;
            expect(alerts).toHaveLength(1);
            expect(alerts[0].severity).toBe('critical');
        });
        it('should create medium alert for degraded service', async () => {
            const check = {
                name: 'degraded-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.DEGRADED,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check);
            await healthCheckManager.runHealthCheck('degraded-check');
            const alerts = healthCheckManager.alerts;
            expect(alerts).toHaveLength(1);
            expect(alerts[0].severity).toBe('medium');
        });
    });
    describe('runAllHealthChecks', () => {
        it('should run all health checks', async () => {
            const check1 = {
                name: 'check1',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            const check2 = {
                name: 'check2',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check1);
            healthCheckManager.addHealthCheck(check2);
            const results = await healthCheckManager.runAllHealthChecks();
            expect(Object.keys(results)).toContain('check1');
            expect(Object.keys(results)).toContain('check2');
            expect(Object.keys(results)).toContain('system');
            expect(Object.keys(results)).toContain('websocket');
            expect(Object.keys(results)).toContain('process');
        });
        it('should handle individual check failures', async () => {
            const check = {
                name: 'failing-check',
                check: jest.fn().mockRejectedValue(new Error('Check error'))
            };
            healthCheckManager.addHealthCheck(check);
            const results = await healthCheckManager.runAllHealthChecks();
            expect(results['failing-check'].status).toBe(health_check_1.HealthStatus.UNHEALTHY);
            expect(results['failing-check'].error).toBe('Check error');
        });
    });
    describe('getHealthReport', () => {
        it('should generate comprehensive health report', async () => {
            const report = await healthCheckManager.getHealthReport();
            expect(report.overall).toBeDefined();
            expect(report.timestamp).toBeDefined();
            expect(report.version).toBe('1.0.0');
            expect(report.uptime).toBeDefined();
            expect(report.services).toBeDefined();
            expect(report.system).toBe(mockSystemMetrics);
            expect(report.business).toBe(mockBusinessMetrics);
            expect(report.dependencies).toBeDefined();
            expect(report.alerts).toBeDefined();
        });
        it('should determine overall status as healthy when all healthy', async () => {
            // Stop the manager to remove default checks
            healthCheckManager.stop();
            // Create a new manager without default checks
            const cleanManager = new health_check_1.HealthCheckManager('1.0.0');
            // Remove default checks
            cleanManager.removeHealthCheck('system');
            cleanManager.removeHealthCheck('websocket');
            cleanManager.removeHealthCheck('process');
            const check = {
                name: 'healthy-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            cleanManager.addHealthCheck(check);
            const report = await cleanManager.getHealthReport();
            expect(report.overall).toBe(health_check_1.HealthStatus.HEALTHY);
        });
        it('should determine overall status as unhealthy when any unhealthy', async () => {
            const check = {
                name: 'unhealthy-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check);
            const report = await healthCheckManager.getHealthReport();
            expect(report.overall).toBe(health_check_1.HealthStatus.UNHEALTHY);
        });
        it('should determine overall status as degraded when any degraded', async () => {
            const check = {
                name: 'degraded-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.DEGRADED,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check);
            const report = await healthCheckManager.getHealthReport();
            expect(report.overall).toBe(health_check_1.HealthStatus.DEGRADED);
        });
    });
    describe('getHealthRouter', () => {
        let mockReq;
        let mockRes;
        let mockNext;
        beforeEach(() => {
            mockReq = {
                params: {},
                get: jest.fn()
            };
            mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
                send: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis()
            };
            mockNext = jest.fn();
        });
        it('should create health router', () => {
            const router = healthCheckManager.getHealthRouter();
            expect(express_1.Router).toHaveBeenCalled();
            expect(mockRouter.get).toHaveBeenCalledTimes(6);
        });
        it('should handle /health endpoint', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[0][1];
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                overall: expect.any(String),
                timestamp: expect.any(String),
                version: '1.0.0'
            }));
        });
        it('should return 503 for unhealthy status', async () => {
            const check = {
                name: 'unhealthy-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check);
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[0][1];
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(503);
        });
        it('should handle /health/live endpoint', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[1][1];
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                status: health_check_1.HealthStatus.HEALTHY,
                uptime: expect.any(Number)
            }));
        });
        it('should handle /health/ready endpoint', async () => {
            // Create a new manager with healthy critical services
            const readyManager = new health_check_1.HealthCheckManager('1.0.0');
            readyManager.removeHealthCheck('system');
            readyManager.removeHealthCheck('websocket');
            readyManager.removeHealthCheck('process');
            const criticalCheck = {
                name: 'critical-service',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                }),
                critical: true
            };
            readyManager.addHealthCheck(criticalCheck);
            readyManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[2][1];
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
        it('should handle /health/service/:name endpoint', async () => {
            const check = {
                name: 'test-service',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                })
            };
            healthCheckManager.addHealthCheck(check);
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[3][1];
            mockReq.params.name = 'test-service';
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
        it('should handle non-existent service', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[3][1];
            mockReq.params.name = 'non-existent';
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
        it('should handle /metrics endpoint with JSON', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[4][1];
            mockReq.get.mockReturnValue('application/json');
            await handler(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith({ system: mockSystemMetrics, business: mockBusinessMetrics });
        });
        it('should handle /metrics endpoint with Prometheus format', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[4][1];
            mockReq.get.mockReturnValue('text/plain');
            await handler(mockReq, mockRes);
            expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
            expect(mockRes.send).toHaveBeenCalledWith('# HELP metrics\n# TYPE gauge\nmetric_value 1');
        });
        it('should handle /health/alerts endpoint', async () => {
            healthCheckManager.getHealthRouter();
            const handler = mockRouter.get.mock.calls[5][1];
            await handler(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                alerts: expect.any(Array),
                count: expect.any(Number)
            }));
        });
    });
    describe('Alert Management', () => {
        it('should limit alerts to 100', async () => {
            // Add 105 alerts
            for (let i = 0; i < 105; i++) {
                healthCheckManager.createAlert({
                    id: `alert-${i}`,
                    severity: 'low',
                    message: `Alert ${i}`,
                    timestamp: new Date().toISOString()
                });
            }
            const alerts = healthCheckManager.alerts;
            expect(alerts).toHaveLength(100);
            expect(alerts[0].id).toBe('alert-5'); // First 5 should be removed
        });
        it('should get active alerts from last 24 hours', async () => {
            const now = Date.now();
            const oldAlert = {
                id: 'old-alert',
                severity: 'low',
                message: 'Old alert',
                timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
            };
            const recentAlert = {
                id: 'recent-alert',
                severity: 'low',
                message: 'Recent alert',
                timestamp: new Date(now - 1000).toISOString() // 1 second ago
            };
            healthCheckManager.alerts = [oldAlert, recentAlert];
            const activeAlerts = healthCheckManager.getActiveAlerts();
            expect(activeAlerts).toHaveLength(1);
            expect(activeAlerts[0].id).toBe('recent-alert');
        });
    });
    describe('Default Health Checks', () => {
        it('should check system health', async () => {
            const result = await healthCheckManager.runHealthCheck('system');
            expect(result.status).toBe(health_check_1.HealthStatus.HEALTHY);
            expect(result.details).toMatchObject({
                memory_usage: 0.5,
                cpu_usage: 0.5,
                uptime: 3600
            });
        });
        it('should mark system as degraded at 80% usage', async () => {
            mockSystemMetrics.memory.used = 1700;
            mockSystemMetrics.cpu.usage = 0.85;
            const result = await healthCheckManager.runHealthCheck('system');
            expect(result.status).toBe(health_check_1.HealthStatus.DEGRADED);
        });
        it('should mark system as unhealthy at 90% usage', async () => {
            mockSystemMetrics.memory.used = 1900;
            mockSystemMetrics.cpu.usage = 0.95;
            const result = await healthCheckManager.runHealthCheck('system');
            expect(result.status).toBe(health_check_1.HealthStatus.UNHEALTHY);
        });
        it('should check websocket health', async () => {
            const result = await healthCheckManager.runHealthCheck('websocket');
            expect(result.status).toBe(health_check_1.HealthStatus.HEALTHY);
            expect(result.details).toMatchObject({
                active_connections: 10,
                total_connections: 100,
                failed_connections: 5
            });
        });
        it('should check process health', async () => {
            const mockMemoryUsage = {
                heapUsed: 500,
                heapTotal: 1000,
                external: 100,
                arrayBuffers: 50,
                rss: 2000
            };
            jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
            const result = await healthCheckManager.runHealthCheck('process');
            expect(result.status).toBe(health_check_1.HealthStatus.HEALTHY);
            expect(result.details).toMatchObject({
                heap_used: 500,
                heap_total: 1000,
                heap_usage: 0.5
            });
        });
        it('should mark process as degraded at 85% heap usage', async () => {
            const mockMemoryUsage = {
                heapUsed: 900,
                heapTotal: 1000,
                external: 100,
                arrayBuffers: 50,
                rss: 2000
            };
            jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
            const result = await healthCheckManager.runHealthCheck('process');
            expect(result.status).toBe(health_check_1.HealthStatus.DEGRADED);
        });
        it('should mark process as unhealthy at 95% heap usage', async () => {
            const mockMemoryUsage = {
                heapUsed: 980,
                heapTotal: 1000,
                external: 100,
                arrayBuffers: 50,
                rss: 2000
            };
            jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
            const result = await healthCheckManager.runHealthCheck('process');
            expect(result.status).toBe(health_check_1.HealthStatus.UNHEALTHY);
        });
    });
    describe('Periodic Health Checks', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('should run periodic checks', async () => {
            const check = {
                name: 'periodic-check',
                check: jest.fn().mockResolvedValue({
                    status: health_check_1.HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0
                }),
                interval: 5000
            };
            healthCheckManager.start();
            healthCheckManager.addHealthCheck(check);
            jest.advanceTimersByTime(5000);
            expect(check.check).toHaveBeenCalled();
        });
        it('should handle periodic check errors', async () => {
            const check = {
                name: 'failing-periodic',
                check: jest.fn().mockRejectedValue(new Error('Periodic fail')),
                interval: 5000
            };
            healthCheckManager.start();
            healthCheckManager.addHealthCheck(check);
            jest.advanceTimersByTime(5000);
            // Should not throw, just log error
            expect(check.check).toHaveBeenCalled();
        });
    });
});
describe('healthCheckManager singleton', () => {
    it('should export default instance', () => {
        const { healthCheckManager } = require('../health-check');
        expect(healthCheckManager).toBeDefined();
        expect(healthCheckManager).toBeInstanceOf(health_check_1.HealthCheckManager);
    });
    it('should use npm package version', () => {
        process.env.npm_package_version = '2.0.0';
        jest.resetModules();
        const { healthCheckManager } = require('../health-check');
        expect(healthCheckManager.version).toBe('2.0.0');
        delete process.env.npm_package_version;
    });
});
//# sourceMappingURL=health-check.test.js.map