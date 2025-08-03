"use strict";
/**
 * Monitoring System Integration
 * Main entry point for the comprehensive monitoring infrastructure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsDashboard = exports.RealTimeAlertingManager = exports.HealthCheckManager = exports.StructuredLogger = exports.metricsDashboard = exports.alertingManager = exports.healthCheckManager = exports.performanceMetrics = exports.logger = exports.errorIntegration = exports.monitoringSystem = exports.MonitoringErrorIntegration = exports.MonitoringSystem = void 0;
exports.setupMonitoring = setupMonitoring;
exports.setupLogAggregation = setupLogAggregation;
const structured_logger_1 = require("./infrastructure/structured-logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return structured_logger_1.logger; } });
Object.defineProperty(exports, "StructuredLogger", { enumerable: true, get: function () { return structured_logger_1.StructuredLogger; } });
const performance_metrics_1 = require("./infrastructure/performance-metrics");
Object.defineProperty(exports, "performanceMetrics", { enumerable: true, get: function () { return performance_metrics_1.performanceMetrics; } });
const health_check_1 = require("./infrastructure/health-check");
Object.defineProperty(exports, "healthCheckManager", { enumerable: true, get: function () { return health_check_1.healthCheckManager; } });
Object.defineProperty(exports, "HealthCheckManager", { enumerable: true, get: function () { return health_check_1.HealthCheckManager; } });
const real_time_alerting_1 = require("./infrastructure/real-time-alerting");
Object.defineProperty(exports, "alertingManager", { enumerable: true, get: function () { return real_time_alerting_1.alertingManager; } });
Object.defineProperty(exports, "RealTimeAlertingManager", { enumerable: true, get: function () { return real_time_alerting_1.RealTimeAlertingManager; } });
const metrics_dashboard_1 = require("./infrastructure/metrics-dashboard");
Object.defineProperty(exports, "metricsDashboard", { enumerable: true, get: function () { return metrics_dashboard_1.metricsDashboard; } });
Object.defineProperty(exports, "MetricsDashboard", { enumerable: true, get: function () { return metrics_dashboard_1.MetricsDashboard; } });
/**
 * Comprehensive Monitoring System
 */
class MonitoringSystem {
    constructor(config = {}) {
        this.isInitialized = false;
        this.config = {
            enableMetrics: true,
            enableHealthChecks: true,
            enableAlerting: true,
            enableDashboard: true,
            alertingPort: 3004,
            metricsInterval: 60000,
            logLevel: 'info',
            logDirectory: './logs',
            ...config
        };
    }
    /**
     * Initialize monitoring system
     */
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Monitoring system already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing monitoring system', {
            metadata: this.config
        });
        try {
            // Initialize performance metrics
            if (this.config.enableMetrics) {
                performance_metrics_1.performanceMetrics.start();
                structured_logger_1.logger.info('Performance metrics initialized');
            }
            // Initialize health checks
            if (this.config.enableHealthChecks) {
                health_check_1.healthCheckManager.start();
                structured_logger_1.logger.info('Health check manager initialized');
            }
            // Initialize alerting system
            if (this.config.enableAlerting) {
                real_time_alerting_1.alertingManager.start(this.config.alertingPort);
                structured_logger_1.logger.info('Real-time alerting system initialized');
            }
            this.isInitialized = true;
            structured_logger_1.logger.info('Monitoring system initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize monitoring system', error);
            throw error;
        }
    }
    /**
     * Shutdown monitoring system
     */
    async shutdown() {
        if (!this.isInitialized)
            return;
        structured_logger_1.logger.info('Shutting down monitoring system');
        try {
            // Stop performance metrics
            if (this.config.enableMetrics) {
                performance_metrics_1.performanceMetrics.stop();
            }
            // Stop health checks
            if (this.config.enableHealthChecks) {
                health_check_1.healthCheckManager.stop();
            }
            // Stop alerting system
            if (this.config.enableAlerting) {
                real_time_alerting_1.alertingManager.stop();
            }
            this.isInitialized = false;
            structured_logger_1.logger.info('Monitoring system shut down successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Error shutting down monitoring system', error);
            throw error;
        }
    }
    /**
     * Setup Express middleware
     */
    setupExpressMiddleware(app) {
        // Request logging middleware
        app.use(structured_logger_1.requestLoggingMiddleware);
        // Performance metrics middleware
        if (this.config.enableMetrics) {
            app.use(performance_metrics_1.metricsMiddleware);
        }
        // Health check routes
        if (this.config.enableHealthChecks) {
            app.use('/api', health_check_1.healthCheckManager.getHealthRouter());
        }
        // Dashboard routes
        if (this.config.enableDashboard) {
            app.use('/monitoring', metrics_dashboard_1.metricsDashboard.getDashboardRouter());
        }
        // Error logging middleware (should be last)
        app.use(structured_logger_1.errorLoggingMiddleware);
        structured_logger_1.logger.info('Express middleware configured for monitoring');
    }
    /**
     * Setup WebSocket middleware
     */
    setupWebSocketMiddleware(server) {
        // WebSocket logging middleware
        server.use(structured_logger_1.websocketLoggingMiddleware);
        // WebSocket metrics middleware
        if (this.config.enableMetrics) {
            server.use(performance_metrics_1.websocketMetricsMiddleware);
        }
        structured_logger_1.logger.info('WebSocket middleware configured for monitoring');
    }
    /**
     * Get monitoring endpoints info
     */
    getEndpointsInfo() {
        const endpoints = {};
        if (this.config.enableHealthChecks) {
            endpoints['Health Check'] = '/api/health';
            endpoints['Liveness Probe'] = '/api/health/live';
            endpoints['Readiness Probe'] = '/api/health/ready';
            endpoints['Metrics'] = '/api/metrics';
        }
        if (this.config.enableDashboard) {
            endpoints['Dashboard'] = '/monitoring/dashboard';
            endpoints['Dashboard API'] = '/monitoring/dashboard/api/*';
        }
        if (this.config.enableAlerting) {
            endpoints['Alerting WebSocket'] = `ws://localhost:${this.config.alertingPort}`;
        }
        return endpoints;
    }
    /**
     * Get system status
     */
    async getSystemStatus() {
        const status = {
            monitoring: {
                initialized: this.isInitialized,
                components: {
                    metrics: this.config.enableMetrics || false,
                    healthChecks: this.config.enableHealthChecks || false,
                    alerting: this.config.enableAlerting || false,
                    dashboard: this.config.enableDashboard || false
                },
                uptime: process.uptime()
            },
            health: null,
            metrics: null,
            alerts: null
        };
        if (this.isInitialized) {
            try {
                if (this.config.enableHealthChecks) {
                    status.health = await health_check_1.healthCheckManager.getHealthReport();
                }
                if (this.config.enableMetrics) {
                    status.metrics = performance_metrics_1.performanceMetrics.getAllMetrics();
                }
                if (this.config.enableAlerting) {
                    status.alerts = {
                        active: real_time_alerting_1.alertingManager.getActiveAlerts().length,
                        statistics: real_time_alerting_1.alertingManager.getAlertStatistics()
                    };
                }
            }
            catch (error) {
                structured_logger_1.logger.error('Error getting system status', error);
            }
        }
        return status;
    }
}
exports.MonitoringSystem = MonitoringSystem;
/**
 * Error handler integration implementation
 */
class MonitoringErrorIntegration {
    logError(error, context) {
        structured_logger_1.logger.error(error.message, error, {
            component: context?.component || 'unknown',
            correlationId: context?.correlationId,
            userId: context?.userId,
            requestId: context?.requestId,
            metadata: context?.metadata
        });
    }
    alertError(error, context) {
        real_time_alerting_1.errorHandlerIntegration.sendErrorAlert(error, {
            component: context?.component || 'unknown',
            correlationId: context?.correlationId,
            userId: context?.userId,
            requestId: context?.requestId,
            metadata: context?.metadata
        });
    }
    trackError(error, context) {
        // Track error in performance metrics
        performance_metrics_1.performanceMetrics.increment('errors.total', 1, {
            errorType: error.name,
            component: context?.component || 'unknown'
        });
        // Track error patterns
        performance_metrics_1.performanceMetrics.increment(`errors.by_type.${error.name}`, 1);
        if (context?.component) {
            performance_metrics_1.performanceMetrics.increment(`errors.by_component.${context.component}`, 1);
        }
    }
    getErrorStats() {
        return real_time_alerting_1.errorHandlerIntegration.getErrorAlertStats();
    }
}
exports.MonitoringErrorIntegration = MonitoringErrorIntegration;
/**
 * Default instances
 */
exports.monitoringSystem = new MonitoringSystem();
exports.errorIntegration = new MonitoringErrorIntegration();
/**
 * Quick setup function for common use cases
 */
async function setupMonitoring(app, config) {
    const monitoring = new MonitoringSystem(config);
    // Initialize monitoring
    await monitoring.initialize();
    // Setup Express middleware
    monitoring.setupExpressMiddleware(app);
    // Log endpoints
    const endpoints = monitoring.getEndpointsInfo();
    structured_logger_1.logger.info('Monitoring endpoints configured', {
        metadata: endpoints
    });
    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
        structured_logger_1.logger.info('Received SIGTERM, shutting down monitoring...');
        await monitoring.shutdown();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        structured_logger_1.logger.info('Received SIGINT, shutting down monitoring...');
        await monitoring.shutdown();
        process.exit(0);
    });
}
/**
 * Log aggregation setup (for external log systems)
 */
function setupLogAggregation(config) {
    // This would setup log forwarding to external systems
    // Implementation depends on specific log aggregation requirements
    structured_logger_1.logger.info('Log aggregation configured', {
        metadata: {
            elasticsearch: !!config.elasticsearch,
            customTransports: !!config.winston
        }
    });
}
//# sourceMappingURL=index.js.map