/**
 * Monitoring Integration Tests
 * Comprehensive tests for the monitoring infrastructure
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MonitoringSystem, errorIntegration } from './index';
import { logger } from './infrastructure/structured-logger';
import { performanceMetrics } from './infrastructure/performance-metrics';
import { healthCheckManager } from './infrastructure/health-check';
import { alertingManager } from './infrastructure/real-time-alerting';
import express from 'express';
import WebSocket from 'ws';

describe('Monitoring Integration Tests', () => {
  let monitoringSystem: MonitoringSystem;
  let mockApp: express.Express;

  beforeEach(() => {
    monitoringSystem = new MonitoringSystem({
      enableMetrics: true,
      enableHealthChecks: true,
      enableAlerting: true,
      enableDashboard: true,
      alertingPort: 3005, // Different port for testing
      metricsInterval: 1000 // Shorter interval for testing
    });
    
    mockApp = express();
  });

  afterEach(async () => {
    await monitoringSystem.shutdown();
    jest.clearAllMocks();
  });

  describe('System Initialization', () => {
    it('should initialize all monitoring components', async () => {
      await monitoringSystem.initialize();
      
      const status = await monitoringSystem.getSystemStatus();
      
      expect(status.monitoring.initialized).toBe(true);
      expect(status.monitoring.components.metrics).toBe(true);
      expect(status.monitoring.components.healthChecks).toBe(true);
      expect(status.monitoring.components.alerting).toBe(true);
      expect(status.monitoring.components.dashboard).toBe(true);
    });

    it('should setup Express middleware correctly', async () => {
      await monitoringSystem.initialize();
      monitoringSystem.setupExpressMiddleware(mockApp);
      
      const endpoints = monitoringSystem.getEndpointsInfo();
      
      expect(endpoints['Health Check']).toBe('/api/health');
      expect(endpoints['Dashboard']).toBe('/monitoring/dashboard');
      expect(endpoints['Alerting WebSocket']).toBe('ws://localhost:3005');
    });

    it('should handle shutdown gracefully', async () => {
      await monitoringSystem.initialize();
      await monitoringSystem.shutdown();
      
      const status = await monitoringSystem.getSystemStatus();
      expect(status.monitoring.initialized).toBe(false);
    });
  });

  describe('Structured Logging', () => {
    it('should log with correlation ID', () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation();
      
      logger.info('Test message', {
        correlationId: 'test-correlation-id',
        userId: 'test-user',
        metadata: { key: 'value' }
      });
      
      expect(mockLog).toHaveBeenCalled();
      mockLog.mockRestore();
    });

    it('should log errors with stack traces', () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation();
      const testError = new Error('Test error');
      
      logger.error('Error occurred', testError, {
        component: 'test-component'
      });
      
      expect(mockLog).toHaveBeenCalled();
      mockLog.mockRestore();
    });

    it('should create performance timers', () => {
      const endTimer = logger.createTimer('test-operation');
      
      // Simulate some work
      setTimeout(() => {
        endTimer();
      }, 100);
      
      expect(typeof endTimer).toBe('function');
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      performanceMetrics.start();
    });

    afterEach(() => {
      performanceMetrics.stop();
      performanceMetrics.clear();
    });

    it('should record timing metrics', () => {
      performanceMetrics.timing('test.operation', 100);
      
      const summary = performanceMetrics.getMetricSummary('test.operation');
      expect(summary).toBeDefined();
      expect(summary!.count).toBe(1);
      expect(summary!.avg).toBe(100);
    });

    it('should increment counters', () => {
      performanceMetrics.increment('test.counter', 5);
      performanceMetrics.increment('test.counter', 3);
      
      const allMetrics = performanceMetrics.getAllMetrics();
      expect(allMetrics.counters['test.counter']).toBe(8);
    });

    it('should set gauge values', () => {
      performanceMetrics.gauge('test.gauge', 42);
      
      const allMetrics = performanceMetrics.getAllMetrics();
      expect(allMetrics.gauges['test.gauge']).toBe(42);
    });

    it('should record HTTP request metrics', () => {
      performanceMetrics.recordHttpRequest('GET', '/api/test', 200, 150, 1024);
      
      const allMetrics = performanceMetrics.getAllMetrics();
      expect(allMetrics.counters['http.request.count']).toBe(1);
    });

    it('should record WebSocket connection metrics', () => {
      performanceMetrics.recordWebSocketConnection('connect');
      performanceMetrics.recordWebSocketConnection('disconnect');
      
      const allMetrics = performanceMetrics.getAllMetrics();
      expect(allMetrics.counters['websocket.connect']).toBe(1);
      expect(allMetrics.counters['websocket.disconnect']).toBe(1);
    });

    it('should export Prometheus metrics', () => {
      performanceMetrics.increment('test.counter', 5);
      performanceMetrics.gauge('test.gauge', 42);
      
      const prometheusMetrics = performanceMetrics.exportPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('test.counter 5');
      expect(prometheusMetrics).toContain('test.gauge 42');
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      healthCheckManager.start();
    });

    afterEach(() => {
      healthCheckManager.stop();
    });

    it('should run system health check', async () => {
      const result = await healthCheckManager.runHealthCheck('system');
      
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should generate comprehensive health report', async () => {
      const report = await healthCheckManager.getHealthReport();
      
      expect(report.overall).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.version).toBeDefined();
      expect(report.services).toBeDefined();
      expect(report.system).toBeDefined();
      expect(report.business).toBeDefined();
    });

    it('should add custom health check', async () => {
      healthCheckManager.addHealthCheck({
        name: 'custom-test',
        check: async () => ({
          status: 'healthy' as any,
          timestamp: new Date().toISOString(),
          duration: 0,
          details: { test: true }
        }),
        timeout: 1000,
        critical: false
      });
      
      const result = await healthCheckManager.runHealthCheck('custom-test');
      expect(result.status).toBe('healthy');
      expect(result.details?.test).toBe(true);
    });
  });

  describe('Real-time Alerting', () => {
    beforeEach(() => {
      alertingManager.start(3006); // Different port
    });

    afterEach(() => {
      alertingManager.stop();
    });

    it('should create alerts', () => {
      const alert = alertingManager.createAlert(
        'error' as any,
        'high' as any,
        'Test Alert',
        'This is a test alert',
        'test-source',
        { test: true },
        ['test']
      );
      
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('error');
      expect(alert.severity).toBe('high');
      expect(alert.title).toBe('Test Alert');
      expect(alert.message).toBe('This is a test alert');
      expect(alert.source).toBe('test-source');
      expect(alert.resolved).toBe(false);
    });

    it('should get active alerts', () => {
      alertingManager.createAlert(
        'error' as any,
        'high' as any,
        'Test Alert 1',
        'Message 1',
        'test-source'
      );
      
      alertingManager.createAlert(
        'performance' as any,
        'medium' as any,
        'Test Alert 2',
        'Message 2',
        'test-source'
      );
      
      const activeAlerts = alertingManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(2);
      
      const errorAlerts = alertingManager.getActiveAlerts({
        types: ['error' as any]
      });
      expect(errorAlerts).toHaveLength(1);
      expect(errorAlerts[0].type).toBe('error');
    });

    it('should resolve alerts', () => {
      const alert = alertingManager.createAlert(
        'error' as any,
        'high' as any,
        'Test Alert',
        'Test message',
        'test-source'
      );
      
      const resolved = alertingManager.resolveAlert(alert.id, 'test-user');
      expect(resolved).toBe(true);
      
      const activeAlerts = alertingManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });

    it('should acknowledge alerts', () => {
      const alert = alertingManager.createAlert(
        'error' as any,
        'high' as any,
        'Test Alert',
        'Test message',
        'test-source'
      );
      
      const acknowledged = alertingManager.acknowledgeAlert(alert.id, 'test-user');
      expect(acknowledged).toBe(true);
    });

    it('should get alert statistics', () => {
      alertingManager.createAlert(
        'error' as any,
        'critical' as any,
        'Critical Alert',
        'Critical message',
        'test-source'
      );
      
      alertingManager.createAlert(
        'performance' as any,
        'medium' as any,
        'Performance Alert',
        'Performance message',
        'test-source'
      );
      
      const stats = alertingManager.getAlertStatistics();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.byType.error).toBe(1);
      expect(stats.byType.performance).toBe(1);
    });

    it('should evaluate alert rules', () => {
      // Add a test rule
      alertingManager.addAlertRule({
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test rule for high CPU',
        type: 'performance' as any,
        severity: 'high' as any,
        condition: (data) => data.cpu > 0.8,
        message: (data) => `CPU usage is ${data.cpu}`,
        enabled: true
      });
      
      // Evaluate with data that should trigger the rule
      alertingManager.evaluateRules({ cpu: 0.9 }, 'test-source');
      
      const activeAlerts = alertingManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].type).toBe('performance');
      expect(activeAlerts[0].severity).toBe('high');
    });
  });

  describe('Error Handler Integration', () => {
    it('should log errors through integration', () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation();
      const testError = new Error('Integration test error');
      
      errorIntegration.logError(testError, {
        component: 'test-component',
        correlationId: 'test-correlation'
      });
      
      expect(mockLog).toHaveBeenCalled();
      mockLog.mockRestore();
    });

    it('should create alerts for errors', () => {
      const testError = new Error('Test error for alerting');
      
      errorIntegration.alertError(testError, {
        component: 'test-component'
      });
      
      const activeAlerts = alertingManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const errorAlert = activeAlerts.find(alert => alert.type === 'error');
      expect(errorAlert).toBeDefined();
      expect(errorAlert!.message).toBe('Test error for alerting');
    });

    it('should track error metrics', () => {
      const testError = new Error('Test error for metrics');
      
      errorIntegration.trackError(testError, {
        component: 'test-component'
      });
      
      const allMetrics = performanceMetrics.getAllMetrics();
      expect(allMetrics.counters['errors.total']).toBe(1);
      expect(allMetrics.counters['errors.by_type.Error']).toBe(1);
    });

    it('should get error statistics', () => {
      const testError = new Error('Test error for stats');
      
      errorIntegration.alertError(testError, {
        component: 'test-component'
      });
      
      const stats = errorIntegration.getErrorStats();
      expect(stats).toBeDefined();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('WebSocket Integration', () => {
    it('should handle WebSocket connections for alerts', (done) => {
      const wsPort = 3007;
      alertingManager.start(wsPort);
      
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
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
          alertingManager.createAlert(
            'error' as any,
            'high' as any,
            'WebSocket Test Alert',
            'Test message',
            'test-source'
          );
        }
        
        if (message.type === 'alert') {
          expect(message.alert.title).toBe('WebSocket Test Alert');
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

describe('Integration with Express App', () => {
  it('should integrate with Express application', async () => {
    const app = express();
    const monitoring = new MonitoringSystem();
    
    await monitoring.initialize();
    monitoring.setupExpressMiddleware(app);
    
    const endpoints = monitoring.getEndpointsInfo();
    expect(endpoints['Health Check']).toBe('/api/health');
    expect(endpoints['Dashboard']).toBe('/monitoring/dashboard');
    
    await monitoring.shutdown();
  });
});

describe('End-to-End Monitoring Flow', () => {
  it('should handle complete monitoring flow', async () => {
    const monitoring = new MonitoringSystem();
    
    // Initialize
    await monitoring.initialize();
    
    // Simulate application activity
    performanceMetrics.recordHttpRequest('GET', '/api/test', 200, 150);
    performanceMetrics.recordWebSocketConnection('connect');
    
    // Create an error
    const testError = new Error('End-to-end test error');
    errorIntegration.logError(testError, { component: 'e2e-test' });
    errorIntegration.trackError(testError, { component: 'e2e-test' });
    errorIntegration.alertError(testError, { component: 'e2e-test' });
    
    // Check health
    const healthReport = await healthCheckManager.getHealthReport();
    expect(healthReport.overall).toBeDefined();
    
    // Check metrics
    const allMetrics = performanceMetrics.getAllMetrics();
    expect(allMetrics.counters['http.request.count']).toBe(1);
    expect(allMetrics.counters['websocket.connect']).toBe(1);
    expect(allMetrics.counters['errors.total']).toBe(1);
    
    // Check alerts
    const activeAlerts = alertingManager.getActiveAlerts();
    expect(activeAlerts.length).toBeGreaterThan(0);
    
    // Get system status
    const status = await monitoring.getSystemStatus();
    expect(status.monitoring.initialized).toBe(true);
    expect(status.health).toBeDefined();
    expect(status.metrics).toBeDefined();
    expect(status.alerts).toBeDefined();
    
    // Cleanup
    await monitoring.shutdown();
  });
});