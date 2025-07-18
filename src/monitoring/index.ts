/**
 * Monitoring System Integration
 * Main entry point for the comprehensive monitoring infrastructure
 */

import { Express } from 'express';
import { createServer } from 'http';
import { 
  logger, 
  requestLoggingMiddleware, 
  websocketLoggingMiddleware,
  errorLoggingMiddleware,
  StructuredLogger
} from './infrastructure/structured-logger';
import { 
  performanceMetrics, 
  metricsMiddleware,
  websocketMetricsMiddleware
} from './infrastructure/performance-metrics';
import { 
  healthCheckManager,
  HealthCheckManager
} from './infrastructure/health-check';
import { 
  alertingManager,
  errorHandlerIntegration,
  RealTimeAlertingManager
} from './infrastructure/real-time-alerting';
import { 
  metricsDashboard,
  MetricsDashboard
} from './infrastructure/metrics-dashboard';

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
export class MonitoringSystem {
  private isInitialized = false;
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig = {}) {
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
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Monitoring system already initialized');
      return;
    }

    logger.info('Initializing monitoring system', {
      metadata: this.config
    });

    try {
      // Initialize performance metrics
      if (this.config.enableMetrics) {
        performanceMetrics.start();
        logger.info('Performance metrics initialized');
      }

      // Initialize health checks
      if (this.config.enableHealthChecks) {
        healthCheckManager.start();
        logger.info('Health check manager initialized');
      }

      // Initialize alerting system
      if (this.config.enableAlerting) {
        alertingManager.start(this.config.alertingPort);
        logger.info('Real-time alerting system initialized');
      }

      this.isInitialized = true;
      logger.info('Monitoring system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize monitoring system', error);
      throw error;
    }
  }

  /**
   * Shutdown monitoring system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    logger.info('Shutting down monitoring system');

    try {
      // Stop performance metrics
      if (this.config.enableMetrics) {
        performanceMetrics.stop();
      }

      // Stop health checks
      if (this.config.enableHealthChecks) {
        healthCheckManager.stop();
      }

      // Stop alerting system
      if (this.config.enableAlerting) {
        alertingManager.stop();
      }

      this.isInitialized = false;
      logger.info('Monitoring system shut down successfully');

    } catch (error) {
      logger.error('Error shutting down monitoring system', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupExpressMiddleware(app: Express): void {
    // Request logging middleware
    app.use(requestLoggingMiddleware);

    // Performance metrics middleware
    if (this.config.enableMetrics) {
      app.use(metricsMiddleware);
    }

    // Health check routes
    if (this.config.enableHealthChecks) {
      app.use('/api', healthCheckManager.getHealthRouter());
    }

    // Dashboard routes
    if (this.config.enableDashboard) {
      app.use('/monitoring', metricsDashboard.getDashboardRouter());
    }

    // Error logging middleware (should be last)
    app.use(errorLoggingMiddleware);

    logger.info('Express middleware configured for monitoring');
  }

  /**
   * Setup WebSocket middleware
   */
  setupWebSocketMiddleware(server: any): void {
    // WebSocket logging middleware
    server.use(websocketLoggingMiddleware);

    // WebSocket metrics middleware
    if (this.config.enableMetrics) {
      server.use(websocketMetricsMiddleware);
    }

    logger.info('WebSocket middleware configured for monitoring');
  }

  /**
   * Get monitoring endpoints info
   */
  getEndpointsInfo(): Record<string, string> {
    const endpoints: Record<string, string> = {};

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
  async getSystemStatus(): Promise<{
    monitoring: {
      initialized: boolean;
      components: Record<string, boolean>;
      uptime: number;
    };
    health: any;
    metrics: any;
    alerts: any;
  }> {
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
      health: null as any,
      metrics: null as any,
      alerts: null as any
    };

    if (this.isInitialized) {
      try {
        if (this.config.enableHealthChecks) {
          status.health = await healthCheckManager.getHealthReport();
        }

        if (this.config.enableMetrics) {
          status.metrics = performanceMetrics.getAllMetrics();
        }

        if (this.config.enableAlerting) {
          status.alerts = {
            active: alertingManager.getActiveAlerts().length,
            statistics: alertingManager.getAlertStatistics()
          };
        }
      } catch (error) {
        logger.error('Error getting system status', error);
      }
    }

    return status;
  }
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
export class MonitoringErrorIntegration implements ErrorHandlerIntegration {
  logError(error: Error, context?: any): void {
    logger.error(error.message, error, {
      component: context?.component || 'unknown',
      correlationId: context?.correlationId,
      userId: context?.userId,
      requestId: context?.requestId,
      metadata: context?.metadata
    });
  }

  alertError(error: Error, context?: any): void {
    errorHandlerIntegration.sendErrorAlert(error, {
      component: context?.component || 'unknown',
      correlationId: context?.correlationId,
      userId: context?.userId,
      requestId: context?.requestId,
      metadata: context?.metadata
    });
  }

  trackError(error: Error, context?: any): void {
    // Track error in performance metrics
    performanceMetrics.increment('errors.total', 1, {
      errorType: error.name,
      component: context?.component || 'unknown'
    });

    // Track error patterns
    performanceMetrics.increment(`errors.by_type.${error.name}`, 1);
    
    if (context?.component) {
      performanceMetrics.increment(`errors.by_component.${context.component}`, 1);
    }
  }

  getErrorStats(): Record<string, any> {
    return errorHandlerIntegration.getErrorAlertStats();
  }
}

/**
 * Default instances
 */
export const monitoringSystem = new MonitoringSystem();
export const errorIntegration = new MonitoringErrorIntegration();

/**
 * Re-export main components
 */
export {
  logger,
  performanceMetrics,
  healthCheckManager,
  alertingManager,
  metricsDashboard,
  StructuredLogger,
  HealthCheckManager,
  RealTimeAlertingManager,
  MetricsDashboard
};

/**
 * Quick setup function for common use cases
 */
export async function setupMonitoring(app: Express, config?: MonitoringConfig): Promise<void> {
  const monitoring = new MonitoringSystem(config);
  
  // Initialize monitoring
  await monitoring.initialize();
  
  // Setup Express middleware
  monitoring.setupExpressMiddleware(app);
  
  // Log endpoints
  const endpoints = monitoring.getEndpointsInfo();
  logger.info('Monitoring endpoints configured', {
    metadata: endpoints
  });
  
  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down monitoring...');
    await monitoring.shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down monitoring...');
    await monitoring.shutdown();
    process.exit(0);
  });
}

/**
 * Log aggregation setup (for external log systems)
 */
export function setupLogAggregation(config: {
  elasticsearch?: {
    host: string;
    index: string;
  };
  winston?: {
    transports: any[];
  };
}): void {
  // This would setup log forwarding to external systems
  // Implementation depends on specific log aggregation requirements
  logger.info('Log aggregation configured', {
    metadata: {
      elasticsearch: !!config.elasticsearch,
      customTransports: !!config.winston
    }
  });
}