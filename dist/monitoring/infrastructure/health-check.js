"use strict";
/**
 * Health Check System
 * Provides comprehensive health monitoring for all services and dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckManager = exports.HealthCheckManager = exports.HealthStatus = void 0;
const express_1 = require("express");
const performance_metrics_1 = require("./performance-metrics");
const structured_logger_1 = require("./structured-logger");
const perf_hooks_1 = require("perf_hooks");
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "healthy";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNHEALTHY"] = "unhealthy";
    HealthStatus["UNKNOWN"] = "unknown";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
/**
 * Health Check Manager
 */
class HealthCheckManager {
    constructor(version = '1.0.0') {
        this.version = version;
        this.healthChecks = new Map();
        this.lastResults = new Map();
        this.checkIntervals = new Map();
        this.alerts = [];
        this.isRunning = false;
        this.setupDefaultHealthChecks();
    }
    /**
     * Add a health check
     */
    addHealthCheck(check) {
        this.healthChecks.set(check.name, check);
        // Start periodic check if interval is specified
        if (check.interval && this.isRunning) {
            this.startPeriodicCheck(check);
        }
        structured_logger_1.logger.info(`Health check added: ${check.name}`, {
            metadata: {
                timeout: check.timeout,
                interval: check.interval,
                critical: check.critical
            }
        });
    }
    /**
     * Remove a health check
     */
    removeHealthCheck(name) {
        this.healthChecks.delete(name);
        this.lastResults.delete(name);
        const interval = this.checkIntervals.get(name);
        if (interval) {
            clearInterval(interval);
            this.checkIntervals.delete(name);
        }
        structured_logger_1.logger.info(`Health check removed: ${name}`);
    }
    /**
     * Start health check monitoring
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        // Start periodic checks for all health checks with intervals
        for (const [name, check] of this.healthChecks) {
            if (check.interval) {
                this.startPeriodicCheck(check);
            }
        }
        structured_logger_1.logger.info('Health check monitoring started');
    }
    /**
     * Stop health check monitoring
     */
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Clear all intervals
        for (const interval of this.checkIntervals.values()) {
            clearInterval(interval);
        }
        this.checkIntervals.clear();
        structured_logger_1.logger.info('Health check monitoring stopped');
    }
    /**
     * Run a specific health check
     */
    async runHealthCheck(name) {
        const check = this.healthChecks.get(name);
        if (!check) {
            throw new Error(`Health check not found: ${name}`);
        }
        const startTime = perf_hooks_1.performance.now();
        const timeout = check.timeout || 5000;
        try {
            const result = await Promise.race([
                check.check(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Health check timeout')), timeout);
                })
            ]);
            result.duration = perf_hooks_1.performance.now() - startTime;
            this.lastResults.set(name, result);
            // Check for alerts
            this.checkForAlerts(name, result);
            return result;
        }
        catch (error) {
            const result = {
                status: HealthStatus.UNHEALTHY,
                timestamp: new Date().toISOString(),
                duration: perf_hooks_1.performance.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.lastResults.set(name, result);
            this.checkForAlerts(name, result);
            return result;
        }
    }
    /**
     * Run all health checks
     */
    async runAllHealthChecks() {
        const results = {};
        const promises = Array.from(this.healthChecks.keys()).map(async (name) => {
            try {
                results[name] = await this.runHealthCheck(name);
            }
            catch (error) {
                results[name] = {
                    status: HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        await Promise.all(promises);
        return results;
    }
    /**
     * Get comprehensive health report
     */
    async getHealthReport() {
        const startTime = perf_hooks_1.performance.now();
        // Run all health checks
        const services = await this.runAllHealthChecks();
        // Get system and business metrics
        const systemMetrics = performance_metrics_1.performanceMetrics.getSystemMetrics();
        const businessMetrics = performance_metrics_1.performanceMetrics.getBusinessMetrics();
        // Check dependencies
        const dependencies = await this.checkDependencies();
        // Determine overall status
        const overallStatus = this.determineOverallStatus(services, dependencies);
        const report = {
            overall: overallStatus,
            timestamp: new Date().toISOString(),
            version: this.version,
            uptime: process.uptime(),
            services,
            system: systemMetrics,
            business: businessMetrics,
            dependencies,
            alerts: this.getActiveAlerts()
        };
        // Log health report
        structured_logger_1.logger.info('Health report generated', {
            metadata: {
                overall_status: overallStatus,
                duration: perf_hooks_1.performance.now() - startTime,
                services_count: Object.keys(services).length,
                alerts_count: this.alerts.length
            }
        });
        return report;
    }
    /**
     * Get health check router for Express
     */
    getHealthRouter() {
        const router = (0, express_1.Router)();
        // Basic health check
        router.get('/health', async (req, res) => {
            try {
                const report = await this.getHealthReport();
                const statusCode = report.overall === HealthStatus.HEALTHY ? 200 :
                    report.overall === HealthStatus.DEGRADED ? 200 : 503;
                res.status(statusCode).json(report);
            }
            catch (error) {
                structured_logger_1.logger.error('Health check failed', error);
                res.status(503).json({
                    status: HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
        // Liveness probe (for Kubernetes)
        router.get('/health/live', async (req, res) => {
            res.status(200).json({
                status: HealthStatus.HEALTHY,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        // Readiness probe (for Kubernetes)
        router.get('/health/ready', async (req, res) => {
            try {
                const criticalServices = await this.checkCriticalServices();
                const status = Object.values(criticalServices).every(result => result.status === HealthStatus.HEALTHY) ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
                const statusCode = status === HealthStatus.HEALTHY ? 200 : 503;
                res.status(statusCode).json({
                    status,
                    timestamp: new Date().toISOString(),
                    services: criticalServices
                });
            }
            catch (error) {
                structured_logger_1.logger.error('Readiness check failed', error);
                res.status(503).json({
                    status: HealthStatus.UNHEALTHY,
                    timestamp: new Date().toISOString(),
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
        // Specific service health check
        router.get('/health/service/:name', async (req, res) => {
            const serviceName = req.params.name;
            try {
                const result = await this.runHealthCheck(serviceName);
                const statusCode = result.status === HealthStatus.HEALTHY ? 200 : 503;
                res.status(statusCode).json(result);
            }
            catch (error) {
                res.status(404).json({
                    status: HealthStatus.UNKNOWN,
                    timestamp: new Date().toISOString(),
                    error: error instanceof Error ? error.message : 'Service not found'
                });
            }
        });
        // Metrics endpoint
        router.get('/metrics', (req, res) => {
            const accept = req.get('Accept');
            if (accept && accept.includes('application/json')) {
                res.json(performance_metrics_1.performanceMetrics.getAllMetrics());
            }
            else {
                res.set('Content-Type', 'text/plain');
                res.send(performance_metrics_1.performanceMetrics.exportPrometheusMetrics());
            }
        });
        // Alerts endpoint
        router.get('/health/alerts', (req, res) => {
            res.json({
                alerts: this.getActiveAlerts(),
                count: this.alerts.length
            });
        });
        return router;
    }
    /**
     * Setup default health checks
     */
    setupDefaultHealthChecks() {
        // System health check
        this.addHealthCheck({
            name: 'system',
            check: async () => {
                const systemMetrics = performance_metrics_1.performanceMetrics.getSystemMetrics();
                const memoryUsage = systemMetrics.memory.used / systemMetrics.memory.total;
                const cpuUsage = systemMetrics.cpu.usage;
                let status = HealthStatus.HEALTHY;
                const details = {
                    memory_usage: memoryUsage,
                    cpu_usage: cpuUsage,
                    uptime: systemMetrics.uptime
                };
                // Check thresholds
                if (memoryUsage > 0.9 || cpuUsage > 0.9) {
                    status = HealthStatus.UNHEALTHY;
                }
                else if (memoryUsage > 0.8 || cpuUsage > 0.8) {
                    status = HealthStatus.DEGRADED;
                }
                return {
                    status,
                    timestamp: new Date().toISOString(),
                    duration: 0,
                    details
                };
            },
            timeout: 5000,
            interval: 30000,
            critical: true
        });
        // WebSocket health check
        this.addHealthCheck({
            name: 'websocket',
            check: async () => {
                const businessMetrics = performance_metrics_1.performanceMetrics.getBusinessMetrics();
                const activeConnections = businessMetrics.websocketConnections.active;
                return {
                    status: HealthStatus.HEALTHY,
                    timestamp: new Date().toISOString(),
                    duration: 0,
                    details: {
                        active_connections: activeConnections,
                        total_connections: businessMetrics.websocketConnections.total,
                        failed_connections: businessMetrics.websocketConnections.failed
                    }
                };
            },
            timeout: 5000,
            interval: 60000,
            critical: false
        });
        // Process health check
        this.addHealthCheck({
            name: 'process',
            check: async () => {
                const memoryUsage = process.memoryUsage();
                const heapUsed = memoryUsage.heapUsed / memoryUsage.heapTotal;
                let status = HealthStatus.HEALTHY;
                if (heapUsed > 0.95) {
                    status = HealthStatus.UNHEALTHY;
                }
                else if (heapUsed > 0.85) {
                    status = HealthStatus.DEGRADED;
                }
                return {
                    status,
                    timestamp: new Date().toISOString(),
                    duration: 0,
                    details: {
                        heap_used: memoryUsage.heapUsed,
                        heap_total: memoryUsage.heapTotal,
                        heap_usage: heapUsed,
                        external: memoryUsage.external,
                        array_buffers: memoryUsage.arrayBuffers
                    }
                };
            },
            timeout: 5000,
            interval: 30000,
            critical: true
        });
    }
    /**
     * Start periodic check for a health check
     */
    startPeriodicCheck(check) {
        const interval = setInterval(async () => {
            try {
                await this.runHealthCheck(check.name);
            }
            catch (error) {
                structured_logger_1.logger.error(`Periodic health check failed: ${check.name}`, error);
            }
        }, check.interval);
        this.checkIntervals.set(check.name, interval);
    }
    /**
     * Check for alerts based on health check results
     */
    checkForAlerts(name, result) {
        const check = this.healthChecks.get(name);
        if (!check)
            return;
        // Create alert for unhealthy critical services
        if (result.status === HealthStatus.UNHEALTHY && check.critical) {
            this.createAlert({
                id: `${name}-unhealthy-${Date.now()}`,
                severity: 'critical',
                message: `Critical service ${name} is unhealthy`,
                timestamp: new Date().toISOString(),
                service: name,
                details: result.details
            });
        }
        // Create alert for degraded services
        if (result.status === HealthStatus.DEGRADED) {
            this.createAlert({
                id: `${name}-degraded-${Date.now()}`,
                severity: 'medium',
                message: `Service ${name} is degraded`,
                timestamp: new Date().toISOString(),
                service: name,
                details: result.details
            });
        }
    }
    /**
     * Create an alert
     */
    createAlert(alert) {
        this.alerts.push(alert);
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        structured_logger_1.logger.warn(`Health alert created: ${alert.message}`, {
            metadata: {
                alert_id: alert.id,
                severity: alert.severity,
                service: alert.service
            }
        });
    }
    /**
     * Get active alerts (last 24 hours)
     */
    getActiveAlerts() {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return this.alerts.filter(alert => new Date(alert.timestamp).getTime() > oneDayAgo);
    }
    /**
     * Check critical services only
     */
    async checkCriticalServices() {
        const results = {};
        for (const [name, check] of this.healthChecks) {
            if (check.critical) {
                results[name] = await this.runHealthCheck(name);
            }
        }
        return results;
    }
    /**
     * Check dependencies
     */
    async checkDependencies() {
        // This would check external dependencies like databases, APIs, etc.
        // For now, we'll return empty results
        return {};
    }
    /**
     * Determine overall status
     */
    determineOverallStatus(services, dependencies) {
        const allResults = [...Object.values(services), ...Object.values(dependencies)];
        if (allResults.some(result => result.status === HealthStatus.UNHEALTHY)) {
            return HealthStatus.UNHEALTHY;
        }
        if (allResults.some(result => result.status === HealthStatus.DEGRADED)) {
            return HealthStatus.DEGRADED;
        }
        return HealthStatus.HEALTHY;
    }
}
exports.HealthCheckManager = HealthCheckManager;
/**
 * Default health check manager instance
 */
exports.healthCheckManager = new HealthCheckManager(process.env.npm_package_version || '1.0.0');
//# sourceMappingURL=health-check.js.map