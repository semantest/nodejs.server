/**
 * Monitoring System Integration
 * Main entry point for the comprehensive monitoring infrastructure
 */
import { Express } from 'express';
import { logger, StructuredLogger } from './infrastructure/structured-logger';
import { performanceMetrics } from './infrastructure/performance-metrics';
import { healthCheckManager, HealthCheckManager } from './infrastructure/health-check';
import { alertingManager, RealTimeAlertingManager } from './infrastructure/real-time-alerting';
import { metricsDashboard, MetricsDashboard } from './infrastructure/metrics-dashboard';
export interface MonitoringConfig {
    enableMetrics?: boolean;
    enableHealthChecks?: boolean;
    enableAlerting?: boolean;
    enableDashboard?: boolean;
    alertingPort?: number;
    metricsInterval?: number;
    logLevel?: string;
    logDirectory?: string;
}
/**
 * Comprehensive Monitoring System
 */
export declare class MonitoringSystem {
    private isInitialized;
    private config;
    constructor(config?: MonitoringConfig);
    /**
     * Initialize monitoring system
     */
    initialize(): Promise<void>;
    /**
     * Shutdown monitoring system
     */
    shutdown(): Promise<void>;
    /**
     * Setup Express middleware
     */
    setupExpressMiddleware(app: Express): void;
    /**
     * Setup WebSocket middleware
     */
    setupWebSocketMiddleware(server: any): void;
    /**
     * Get monitoring endpoints info
     */
    getEndpointsInfo(): Record<string, string>;
    /**
     * Get system status
     */
    getSystemStatus(): Promise<{
        monitoring: {
            initialized: boolean;
            components: Record<string, boolean>;
            uptime: number;
        };
        health: any;
        metrics: any;
        alerts: any;
    }>;
}
/**
 * Task 031 Error Handler Integration Interface
 */
export interface ErrorHandlerIntegration {
    /**
     * Log error with structured format
     */
    logError(error: Error, context?: any): void;
    /**
     * Create alert for error
     */
    alertError(error: Error, context?: any): void;
    /**
     * Track error metrics
     */
    trackError(error: Error, context?: any): void;
    /**
     * Get error statistics
     */
    getErrorStats(): Record<string, any>;
}
/**
 * Error handler integration implementation
 */
export declare class MonitoringErrorIntegration implements ErrorHandlerIntegration {
    logError(error: Error, context?: any): void;
    alertError(error: Error, context?: any): void;
    trackError(error: Error, context?: any): void;
    getErrorStats(): Record<string, any>;
}
/**
 * Default instances
 */
export declare const monitoringSystem: MonitoringSystem;
export declare const errorIntegration: MonitoringErrorIntegration;
/**
 * Re-export main components
 */
export { logger, performanceMetrics, healthCheckManager, alertingManager, metricsDashboard, StructuredLogger, HealthCheckManager, RealTimeAlertingManager, MetricsDashboard };
/**
 * Quick setup function for common use cases
 */
export declare function setupMonitoring(app: Express, config?: MonitoringConfig): Promise<void>;
/**
 * Log aggregation setup (for external log systems)
 */
export declare function setupLogAggregation(config: {
    elasticsearch?: {
        host: string;
        index: string;
    };
    winston?: {
        transports: any[];
    };
}): void;
//# sourceMappingURL=index.d.ts.map