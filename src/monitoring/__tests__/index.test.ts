/**
 * Tests for MonitoringSystem
 * Testing comprehensive monitoring infrastructure integration
 */

import { Express } from 'express';
import { MonitoringSystem, MonitoringConfig, setupMonitoring } from '../index';
import { logger } from '../infrastructure/structured-logger';
import { performanceMetrics } from '../infrastructure/performance-metrics';
import { healthCheckManager } from '../infrastructure/health-check';
import { alertingManager } from '../infrastructure/real-time-alerting';

// Mock dependencies
jest.mock('../infrastructure/structured-logger');
jest.mock('../infrastructure/performance-metrics');
jest.mock('../infrastructure/health-check');
jest.mock('../infrastructure/real-time-alerting');
jest.mock('../infrastructure/metrics-dashboard');

describe('MonitoringSystem', () => {
  let monitoringSystem: MonitoringSystem;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mock
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
    
    // Setup component mocks
    (performanceMetrics.start as jest.Mock) = jest.fn();
    (healthCheckManager.start as jest.Mock) = jest.fn();
    (alertingManager.start as jest.Mock) = jest.fn();
  });

  describe('Constructor', () => {
    it('should create monitoring system with default config', () => {
      monitoringSystem = new MonitoringSystem();
      
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
      const config: MonitoringConfig = {
        enableMetrics: false,
        enableHealthChecks: true,
        enableAlerting: false,
        enableDashboard: false,
        alertingPort: 4000,
        metricsInterval: 30000,
        logLevel: 'debug',
        logDirectory: '/var/log'
      };
      
      monitoringSystem = new MonitoringSystem(config);
      
      expect(monitoringSystem['config']).toEqual(config);
    });

    it('should merge custom config with defaults', () => {
      const config: MonitoringConfig = {
        enableMetrics: false,
        alertingPort: 5000
      };
      
      monitoringSystem = new MonitoringSystem(config);
      
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
      monitoringSystem = new MonitoringSystem();
    });

    it('should initialize all components when enabled', async () => {
      await monitoringSystem.initialize();

      expect(logger.info).toHaveBeenCalledWith('Initializing monitoring system', {
        metadata: monitoringSystem['config']
      });
      expect(performanceMetrics.start).toHaveBeenCalled();
      expect(healthCheckManager.start).toHaveBeenCalled();
      expect(alertingManager.start).toHaveBeenCalledWith(3004);
      expect(logger.info).toHaveBeenCalledWith('Performance metrics initialized');
      expect(logger.info).toHaveBeenCalledWith('Health check manager initialized');
      expect(logger.info).toHaveBeenCalledWith('Real-time alerting system initialized');
      expect(logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
      expect(monitoringSystem['isInitialized']).toBe(true);
    });

    it('should skip disabled components', async () => {
      monitoringSystem = new MonitoringSystem({
        enableMetrics: false,
        enableHealthChecks: false,
        enableAlerting: false,
        enableDashboard: false
      });

      await monitoringSystem.initialize();

      expect(performanceMetrics.start).not.toHaveBeenCalled();
      expect(healthCheckManager.start).not.toHaveBeenCalled();
      expect(alertingManager.start).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
      expect(monitoringSystem['isInitialized']).toBe(true);
    });

    it('should warn if already initialized', async () => {
      await monitoringSystem.initialize();
      await monitoringSystem.initialize();

      expect(logger.warn).toHaveBeenCalledWith('Monitoring system already initialized');
      expect(performanceMetrics.start).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      (performanceMetrics.start as jest.Mock).mockImplementation(() => {
        throw new Error('Metrics error');
      });

      await expect(monitoringSystem.initialize()).rejects.toThrow('Failed to initialize monitoring system');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize monitoring system', expect.any(Error));
      expect(monitoringSystem['isInitialized']).toBe(false);
    });

    it('should use custom alerting port', async () => {
      monitoringSystem = new MonitoringSystem({
        alertingPort: 6000
      });

      await monitoringSystem.initialize();

      expect(alertingManager.start).toHaveBeenCalledWith(6000);
    });
  });

  describe('setupExpressMiddleware', () => {
    let mockApp: Express;

    beforeEach(() => {
      monitoringSystem = new MonitoringSystem();
      mockApp = {
        use: jest.fn()
      } as any;
      
      // Mock metricsDashboard.getDashboardRouter
      (require('../infrastructure/metrics-dashboard').metricsDashboard.getDashboardRouter as jest.Mock) = jest.fn().mockReturnValue('dashboard-router');
      (healthCheckManager.getHealthRouter as jest.Mock) = jest.fn().mockReturnValue('health-router');
    });

    it('should setup Express middleware', () => {
      monitoringSystem.setupExpressMiddleware(mockApp);

      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // requestLoggingMiddleware
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // metricsMiddleware
      expect(mockApp.use).toHaveBeenCalledWith('/api', 'health-router');
      expect(mockApp.use).toHaveBeenCalledWith('/monitoring', 'dashboard-router');
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // errorLoggingMiddleware
      expect(logger.info).toHaveBeenCalledWith('Express middleware configured for monitoring');
    });

    it('should skip disabled components', () => {
      monitoringSystem = new MonitoringSystem({
        enableMetrics: false,
        enableHealthChecks: false,
        enableDashboard: false
      });
      monitoringSystem.setupExpressMiddleware(mockApp);

      const metricsCall = (mockApp.use as jest.Mock).mock.calls.find(
        call => call[0] === expect.any(Function) && call.length === 1
      );
      const healthCall = (mockApp.use as jest.Mock).mock.calls.find(
        call => call[0] === '/api'
      );
      const dashboardCall = (mockApp.use as jest.Mock).mock.calls.find(
        call => call[0] === '/monitoring'
      );
      
      expect(healthCall).toBeUndefined();
      expect(dashboardCall).toBeUndefined();
    });
  });

  describe('setupWebSocketMiddleware', () => {
    let mockServer: any;

    beforeEach(() => {
      monitoringSystem = new MonitoringSystem();
      mockServer = {
        use: jest.fn()
      };
    });

    it('should setup WebSocket middleware', () => {
      monitoringSystem.setupWebSocketMiddleware(mockServer);

      expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function)); // websocketLoggingMiddleware
      expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function)); // websocketMetricsMiddleware
      expect(logger.info).toHaveBeenCalledWith('WebSocket middleware configured for monitoring');
    });

    it('should skip metrics middleware when disabled', () => {
      monitoringSystem = new MonitoringSystem({ enableMetrics: false });
      monitoringSystem.setupWebSocketMiddleware(mockServer);

      expect(mockServer.use).toHaveBeenCalledTimes(1); // Only logging middleware
    });
  });

  describe('getEndpointsInfo', () => {
    beforeEach(() => {
      monitoringSystem = new MonitoringSystem();
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
      monitoringSystem = new MonitoringSystem({
        enableHealthChecks: false,
        enableDashboard: false,
        enableAlerting: false
      });
      const endpoints = monitoringSystem.getEndpointsInfo();

      expect(endpoints).toEqual({});
    });

    it('should use custom alerting port', () => {
      monitoringSystem = new MonitoringSystem({ alertingPort: 5000 });
      const endpoints = monitoringSystem.getEndpointsInfo();

      expect(endpoints['Alerting WebSocket']).toBe('ws://localhost:5000');
    });
  });

  describe('getSystemStatus', () => {
    beforeEach(() => {
      monitoringSystem = new MonitoringSystem();
      (performanceMetrics.getAllMetrics as jest.Mock) = jest.fn().mockReturnValue({ cpu: 50 });
      (alertingManager.getActiveAlerts as jest.Mock) = jest.fn().mockReturnValue([]);
      (alertingManager.getAlertStatistics as jest.Mock) = jest.fn().mockReturnValue({ total: 0 });
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
      (healthCheckManager.getHealthReport as jest.Mock).mockRejectedValue(new Error('Health error'));
      
      const status = await monitoringSystem.getSystemStatus();

      expect(logger.error).toHaveBeenCalledWith('Error getting system status', expect.any(Error));
      expect(status.monitoring.initialized).toBe(true);
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      monitoringSystem = new MonitoringSystem();
      (performanceMetrics.stop as jest.Mock) = jest.fn();
      (healthCheckManager.stop as jest.Mock) = jest.fn();
      (alertingManager.stop as jest.Mock) = jest.fn();
    });

    it('should shutdown all components', async () => {
      await monitoringSystem.initialize();
      await monitoringSystem.shutdown();

      expect(logger.info).toHaveBeenCalledWith('Shutting down monitoring system');
      expect(performanceMetrics.stop).toHaveBeenCalled();
      expect(healthCheckManager.stop).toHaveBeenCalled();
      expect(alertingManager.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Monitoring system shut down successfully');
      expect(monitoringSystem['isInitialized']).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await monitoringSystem.shutdown();

      expect(logger.warn).toHaveBeenCalledWith('Monitoring system not initialized');
      expect(performanceMetrics.stop).not.toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      await monitoringSystem.initialize();
      (performanceMetrics.stop as jest.Mock).mockImplementation(() => {
        throw new Error('Stop error');
      });

      await expect(monitoringSystem.shutdown()).rejects.toThrow('Failed to shutdown monitoring system');
      expect(logger.error).toHaveBeenCalledWith('Failed to shutdown monitoring system', expect.any(Error));
    });

    it('should skip disabled components during shutdown', async () => {
      monitoringSystem = new MonitoringSystem({
        enableMetrics: false,
        enableHealthChecks: false,
        enableAlerting: false
      });
      await monitoringSystem.initialize();
      await monitoringSystem.shutdown();

      expect(performanceMetrics.stop).not.toHaveBeenCalled();
      expect(healthCheckManager.stop).not.toHaveBeenCalled();
      expect(alertingManager.stop).not.toHaveBeenCalled();
    });
  });

  describe('setupMonitoring helper', () => {
    let mockApp: Express;
    let originalProcess: any;

    beforeEach(() => {
      mockApp = {
        use: jest.fn()
      } as any;
      
      // Mock metricsDashboard.getDashboardRouter
      (require('../infrastructure/metrics-dashboard').metricsDashboard.getDashboardRouter as jest.Mock) = jest.fn().mockReturnValue('dashboard-router');
      (healthCheckManager.getHealthRouter as jest.Mock) = jest.fn().mockReturnValue('health-router');
      
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
      await setupMonitoring(mockApp);

      expect(logger.info).toHaveBeenCalledWith('Monitoring system initialized successfully');
      expect(mockApp.use).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Monitoring endpoints configured', {
        metadata: expect.any(Object)
      });
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should setup monitoring with custom config', async () => {
      const config: MonitoringConfig = {
        enableMetrics: false,
        alertingPort: 7000
      };
      await setupMonitoring(mockApp, config);

      expect(performanceMetrics.start).not.toHaveBeenCalled();
    });

    it('should handle SIGTERM gracefully', async () => {
      await setupMonitoring(mockApp);
      
      // Get the SIGTERM handler
      const sigTermHandler = (process.on as jest.Mock).mock.calls.find(
        call => call[0] === 'SIGTERM'
      )[1];
      
      // Call the handler
      await sigTermHandler();
      
      expect(logger.info).toHaveBeenCalledWith('Received SIGTERM, shutting down monitoring...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT gracefully', async () => {
      await setupMonitoring(mockApp);
      
      // Get the SIGINT handler
      const sigIntHandler = (process.on as jest.Mock).mock.calls.find(
        call => call[0] === 'SIGINT'
      )[1];
      
      // Call the handler
      await sigIntHandler();
      
      expect(logger.info).toHaveBeenCalledWith('Received SIGINT, shutting down monitoring...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle setup errors', async () => {
      (performanceMetrics.start as jest.Mock).mockImplementation(() => {
        throw new Error('Setup error');
      });

      await expect(setupMonitoring(mockApp)).rejects.toThrow('Setup error');
    });
  });
});

describe('MonitoringSystem Edge Cases', () => {
  let monitoringSystem: MonitoringSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
  });

  it('should handle empty config', () => {
    monitoringSystem = new MonitoringSystem({});
    
    expect(monitoringSystem['config'].enableMetrics).toBe(true);
    expect(monitoringSystem['config'].logLevel).toBe('info');
  });

  it('should handle partial component failures during init', async () => {
    monitoringSystem = new MonitoringSystem();
    (healthCheckManager.start as jest.Mock).mockImplementation(() => {
      throw new Error('Health check error');
    });

    await expect(monitoringSystem.initialize()).rejects.toThrow('Health check error');
    expect(performanceMetrics.start).toHaveBeenCalled();
    expect(monitoringSystem['isInitialized']).toBe(false);
  });

  it('should maintain idempotency on multiple initializations', async () => {
    monitoringSystem = new MonitoringSystem();
    
    await monitoringSystem.initialize();
    const firstCallCount = (logger.info as jest.Mock).mock.calls.length;
    
    await monitoringSystem.initialize();
    await monitoringSystem.initialize();
    
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect((logger.info as jest.Mock).mock.calls.length).toBe(firstCallCount);
  });
});

describe('MonitoringErrorIntegration', () => {
  let errorIntegration: any;
  let mockError: Error;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Import and create instance
    const { MonitoringErrorIntegration } = require('../index');
    errorIntegration = new MonitoringErrorIntegration();
    
    // Setup mocks
    (logger.error as jest.Mock) = jest.fn();
    (performanceMetrics.increment as jest.Mock) = jest.fn();
    
    // Mock errorHandlerIntegration
    const errorHandlerIntegration = require('../infrastructure/real-time-alerting').errorHandlerIntegration;
    (errorHandlerIntegration.sendErrorAlert as jest.Mock) = jest.fn();
    (errorHandlerIntegration.getErrorAlertStats as jest.Mock) = jest.fn().mockReturnValue({ alerts: 10 });
    
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

      expect(logger.error).toHaveBeenCalledWith('Test error', mockError, {
        component: 'test-component',
        correlationId: 'corr-123',
        userId: 'user-456',
        requestId: 'req-789',
        metadata: { extra: 'data' }
      });
    });

    it('should handle missing context', () => {
      errorIntegration.logError(mockError);

      expect(logger.error).toHaveBeenCalledWith('Test error', mockError, {
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

      expect(performanceMetrics.increment).toHaveBeenCalledWith('errors.total', 1, {
        errorType: 'TestError',
        component: 'test-component'
      });
      expect(performanceMetrics.increment).toHaveBeenCalledWith('errors.by_type.TestError', 1);
      expect(performanceMetrics.increment).toHaveBeenCalledWith('errors.by_component.test-component', 1);
    });

    it('should track error without component', () => {
      errorIntegration.trackError(mockError);

      expect(performanceMetrics.increment).toHaveBeenCalledWith('errors.total', 1, {
        errorType: 'TestError',
        component: 'unknown'
      });
      expect(performanceMetrics.increment).toHaveBeenCalledWith('errors.by_type.TestError', 1);
      expect(performanceMetrics.increment).toHaveBeenCalledTimes(2); // Not called for component
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