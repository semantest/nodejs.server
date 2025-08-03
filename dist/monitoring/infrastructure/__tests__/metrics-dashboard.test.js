"use strict";
/**
 * Tests for MetricsDashboard
 * Testing metrics dashboard functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsDashboard = void 0;
const express_1 = require("express");
const metrics_dashboard_1 = require("../metrics-dashboard");
const performance_metrics_1 = require("../performance-metrics");
const health_check_1 = require("../health-check");
const real_time_alerting_1 = require("../real-time-alerting");
const structured_logger_1 = require("../structured-logger");
// Mock dependencies
jest.mock('express', () => ({
    Router: jest.fn(() => ({
        get: jest.fn()
    }))
}));
jest.mock('path');
jest.mock('fs');
jest.mock('../performance-metrics');
jest.mock('../health-check');
jest.mock('../real-time-alerting');
jest.mock('../structured-logger');
describe('MetricsDashboard', () => {
    let dashboard;
    let mockRouter;
    let mockReq;
    let mockRes;
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup router mock
        mockRouter = {
            get: jest.fn()
        };
        express_1.Router.mockReturnValue(mockRouter);
        // Setup request/response mocks
        mockReq = {};
        mockRes = {
            setHeader: jest.fn(),
            send: jest.fn(),
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        // Setup dependency mocks
        performance_metrics_1.performanceMetrics.getSystemMetrics = jest.fn().mockReturnValue({
            cpu: 50,
            memory: 60,
            disk: 70
        });
        performance_metrics_1.performanceMetrics.getBusinessMetrics = jest.fn().mockReturnValue({
            requests: 1000,
            errors: 10,
            latency: 100
        });
        real_time_alerting_1.alertingManager.getAlertStatistics = jest.fn().mockReturnValue({
            activeAlerts: 5,
            resolvedAlerts: 10,
            totalAlerts: 15
        });
        health_check_1.healthCheckManager.getHealthReport = jest.fn().mockResolvedValue({
            status: 'healthy',
            services: ['api', 'database']
        });
        dashboard = new metrics_dashboard_1.MetricsDashboard();
    });
    describe('Constructor', () => {
        it('should initialize dashboard HTML', () => {
            expect(dashboard).toBeDefined();
            expect(dashboard['dashboardHTML']).toBeDefined();
        });
        it('should set initial update time', () => {
            expect(dashboard['lastUpdateTime']).toBeInstanceOf(Date);
        });
        it('should initialize cached data as null', () => {
            expect(dashboard['cachedData']).toBeNull();
        });
        it('should set cache expiry to 30 seconds', () => {
            expect(dashboard['cacheExpiry']).toBe(30000);
        });
    });
    describe('getDashboardRouter', () => {
        let routeHandlers;
        beforeEach(() => {
            routeHandlers = new Map();
            mockRouter.get.mockImplementation((path, handler) => {
                routeHandlers.set(path, handler);
            });
        });
        it('should create router with all routes', () => {
            const router = dashboard.getDashboardRouter();
            expect(express_1.Router).toHaveBeenCalled();
            expect(mockRouter.get).toHaveBeenCalledWith('/dashboard', expect.any(Function));
            expect(mockRouter.get).toHaveBeenCalledWith('/dashboard/api/overview', expect.any(Function));
            expect(mockRouter.get).toHaveBeenCalledWith('/dashboard/api/metrics', expect.any(Function));
            expect(mockRouter.get).toHaveBeenCalledWith('/dashboard/api/alerts', expect.any(Function));
            expect(mockRouter.get).toHaveBeenCalledWith('/dashboard/api/health', expect.any(Function));
            expect(router).toBe(mockRouter);
        });
        describe('Dashboard page route', () => {
            it('should serve dashboard HTML', () => {
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard');
                handler(mockReq, mockRes);
                expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
                expect(mockRes.send).toHaveBeenCalledWith(dashboard['dashboardHTML']);
            });
        });
        describe('Overview API route', () => {
            it('should return overview data', async () => {
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/overview');
                await handler(mockReq, mockRes);
                expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                    timestamp: expect.any(Date),
                    system: expect.objectContaining({
                        cpu: 50,
                        memory: 60,
                        disk: 70
                    }),
                    business: expect.objectContaining({
                        requests: 1000,
                        errors: 10,
                        latency: 100
                    }),
                    alerts: expect.objectContaining({
                        activeAlerts: 5,
                        resolvedAlerts: 10,
                        totalAlerts: 15
                    }),
                    health: expect.objectContaining({
                        status: 'healthy',
                        services: ['api', 'database']
                    })
                }));
            });
            it('should handle errors', async () => {
                performance_metrics_1.performanceMetrics.getSystemMetrics = jest.fn().mockImplementation(() => {
                    throw new Error('Metrics error');
                });
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/overview');
                await handler(mockReq, mockRes);
                expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to get overview data', expect.any(Error));
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get overview data' });
            });
            it('should use cached data within expiry time', async () => {
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/overview');
                // First call
                await handler(mockReq, mockRes);
                expect(performance_metrics_1.performanceMetrics.getSystemMetrics).toHaveBeenCalledTimes(1);
                // Second call should use cache
                await handler(mockReq, mockRes);
                expect(performance_metrics_1.performanceMetrics.getSystemMetrics).toHaveBeenCalledTimes(1);
            });
            it('should refresh data after cache expiry', async () => {
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/overview');
                // First call
                await handler(mockReq, mockRes);
                expect(performance_metrics_1.performanceMetrics.getSystemMetrics).toHaveBeenCalledTimes(1);
                // Simulate cache expiry
                dashboard['lastUpdateTime'] = new Date(Date.now() - 35000);
                // Second call should refresh data
                await handler(mockReq, mockRes);
                expect(performance_metrics_1.performanceMetrics.getSystemMetrics).toHaveBeenCalledTimes(2);
            });
        });
        describe('Metrics API route', () => {
            it('should return metrics data', async () => {
                dashboard['getMetricsData'] = jest.fn().mockResolvedValue({ metrics: 'data' });
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/metrics');
                await handler(mockReq, mockRes);
                expect(dashboard['getMetricsData']).toHaveBeenCalled();
                expect(mockRes.json).toHaveBeenCalledWith({ metrics: 'data' });
            });
            it('should handle errors', async () => {
                dashboard['getMetricsData'] = jest.fn().mockRejectedValue(new Error('Metrics error'));
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/metrics');
                await handler(mockReq, mockRes);
                expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to get metrics data', expect.any(Error));
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get metrics data' });
            });
        });
        describe('Alerts API route', () => {
            it('should return alerts data', async () => {
                dashboard['getAlertsData'] = jest.fn().mockResolvedValue({ alerts: 'data' });
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/alerts');
                await handler(mockReq, mockRes);
                expect(dashboard['getAlertsData']).toHaveBeenCalled();
                expect(mockRes.json).toHaveBeenCalledWith({ alerts: 'data' });
            });
            it('should handle errors', async () => {
                dashboard['getAlertsData'] = jest.fn().mockRejectedValue(new Error('Alerts error'));
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/alerts');
                await handler(mockReq, mockRes);
                expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to get alerts data', expect.any(Error));
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get alerts data' });
            });
        });
        describe('Health API route', () => {
            it('should return health data', async () => {
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/health');
                await handler(mockReq, mockRes);
                expect(health_check_1.healthCheckManager.getHealthReport).toHaveBeenCalled();
                expect(mockRes.json).toHaveBeenCalledWith({
                    status: 'healthy',
                    services: ['api', 'database']
                });
            });
            it('should handle errors', async () => {
                health_check_1.healthCheckManager.getHealthReport.mockRejectedValue(new Error('Health error'));
                dashboard.getDashboardRouter();
                const handler = routeHandlers.get('/dashboard/api/health');
                await handler(mockReq, mockRes);
                expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to get health data', expect.any(Error));
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get health data' });
            });
        });
    });
    describe('Cache behavior', () => {
        it('should initialize with null cache', () => {
            expect(dashboard['cachedData']).toBeNull();
        });
        it('should update cache on first request', async () => {
            const router = dashboard.getDashboardRouter();
            const handler = Array.from(mockRouter.get.mock.calls).find(call => call[0] === '/dashboard/api/overview')[1];
            await handler(mockReq, mockRes);
            expect(dashboard['cachedData']).not.toBeNull();
            expect(dashboard['lastUpdateTime'].getTime()).toBeCloseTo(Date.now(), -2);
        });
        it('should respect cache expiry time', () => {
            expect(dashboard['cacheExpiry']).toBe(30000);
        });
    });
});
// Export for coverage
exports.metricsDashboard = new metrics_dashboard_1.MetricsDashboard();
//# sourceMappingURL=metrics-dashboard.test.js.map