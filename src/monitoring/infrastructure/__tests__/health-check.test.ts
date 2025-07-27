/**
 * Tests for HealthCheckManager
 * Testing comprehensive health monitoring system
 */

import { HealthCheckManager, HealthStatus, HealthCheckResult, ServiceHealthCheck, HealthAlert } from '../health-check';
import { Router } from 'express';
import { performanceMetrics } from '../performance-metrics';

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
} as any;

describe('HealthCheckManager', () => {
  let healthCheckManager: HealthCheckManager;
  let mockSystemMetrics: any;
  let mockBusinessMetrics: any;

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
    
    (performanceMetrics.getSystemMetrics as jest.Mock).mockReturnValue(mockSystemMetrics);
    (performanceMetrics.getBusinessMetrics as jest.Mock).mockReturnValue(mockBusinessMetrics);
    (performanceMetrics.getAllMetrics as jest.Mock).mockReturnValue({ system: mockSystemMetrics, business: mockBusinessMetrics });
    (performanceMetrics.exportPrometheusMetrics as jest.Mock).mockReturnValue('# HELP metrics\n# TYPE gauge\nmetric_value 1');
    
    mockPerformanceNow.mockReturnValue(1000);
    
    healthCheckManager = new HealthCheckManager('1.0.0');
  });

  afterEach(() => {
    healthCheckManager.stop();
  });

  describe('constructor', () => {
    it('should initialize with version', () => {
      expect(healthCheckManager).toBeDefined();
      expect((healthCheckManager as any).version).toBe('1.0.0');
    });

    it('should setup default health checks', () => {
      const checks = (healthCheckManager as any).healthChecks;
      expect(checks.has('system')).toBe(true);
      expect(checks.has('websocket')).toBe(true);
      expect(checks.has('process')).toBe(true);
    });

    it('should use default version if not provided', () => {
      const defaultManager = new HealthCheckManager();
      expect((defaultManager as any).version).toBe('1.0.0');
    });
  });

  describe('addHealthCheck', () => {
    it('should add a health check', () => {
      const check: ServiceHealthCheck = {
        name: 'test-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 100
        })
      };

      healthCheckManager.addHealthCheck(check);
      
      expect((healthCheckManager as any).healthChecks.has('test-check')).toBe(true);
    });

    it('should start periodic check if interval specified and running', () => {
      healthCheckManager.start();
      
      const check: ServiceHealthCheck = {
        name: 'periodic-check',
        check: jest.fn(),
        interval: 5000
      };

      healthCheckManager.addHealthCheck(check);
      
      expect((healthCheckManager as any).checkIntervals.has('periodic-check')).toBe(true);
    });

    it('should not start periodic check if not running', () => {
      const check: ServiceHealthCheck = {
        name: 'periodic-check',
        check: jest.fn(),
        interval: 5000
      };

      healthCheckManager.addHealthCheck(check);
      
      expect((healthCheckManager as any).checkIntervals.has('periodic-check')).toBe(false);
    });
  });

  describe('removeHealthCheck', () => {
    it('should remove a health check', () => {
      const check: ServiceHealthCheck = {
        name: 'test-check',
        check: jest.fn()
      };

      healthCheckManager.addHealthCheck(check);
      healthCheckManager.removeHealthCheck('test-check');
      
      expect((healthCheckManager as any).healthChecks.has('test-check')).toBe(false);
    });

    it('should clear interval when removing', () => {
      healthCheckManager.start();
      
      const check: ServiceHealthCheck = {
        name: 'periodic-check',
        check: jest.fn(),
        interval: 5000
      };

      healthCheckManager.addHealthCheck(check);
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      healthCheckManager.removeHealthCheck('periodic-check');
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((healthCheckManager as any).checkIntervals.has('periodic-check')).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should start monitoring', () => {
      healthCheckManager.start();
      expect((healthCheckManager as any).isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      healthCheckManager.start();
      const intervalCount = (healthCheckManager as any).checkIntervals.size;
      
      healthCheckManager.start();
      expect((healthCheckManager as any).checkIntervals.size).toBe(intervalCount);
    });

    it('should stop monitoring', () => {
      healthCheckManager.start();
      healthCheckManager.stop();
      
      expect((healthCheckManager as any).isRunning).toBe(false);
      expect((healthCheckManager as any).checkIntervals.size).toBe(0);
    });

    it('should not stop if not running', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      healthCheckManager.stop();
      
      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('runHealthCheck', () => {
    it('should run a specific health check', async () => {
      const mockResult: HealthCheckResult = {
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString(),
        duration: 0,
        details: { test: true }
      };

      const check: ServiceHealthCheck = {
        name: 'test-check',
        check: jest.fn().mockResolvedValue(mockResult)
      };

      healthCheckManager.addHealthCheck(check);
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100);
      
      const result = await healthCheckManager.runHealthCheck('test-check');
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.duration).toBe(100);
      expect(check.check).toHaveBeenCalled();
    });

    it('should handle check timeout', async () => {
      const check: ServiceHealthCheck = {
        name: 'slow-check',
        check: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 10000))
        ),
        timeout: 100
      };

      healthCheckManager.addHealthCheck(check);
      
      const result = await healthCheckManager.runHealthCheck('slow-check');
      
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Health check timeout');
    });

    it('should handle check errors', async () => {
      const check: ServiceHealthCheck = {
        name: 'error-check',
        check: jest.fn().mockRejectedValue(new Error('Check failed'))
      };

      healthCheckManager.addHealthCheck(check);
      
      const result = await healthCheckManager.runHealthCheck('error-check');
      
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Check failed');
    });

    it('should throw error for non-existent check', async () => {
      await expect(healthCheckManager.runHealthCheck('non-existent'))
        .rejects.toThrow('Health check not found: non-existent');
    });

    it('should create critical alert for unhealthy critical service', async () => {
      const check: ServiceHealthCheck = {
        name: 'critical-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date().toISOString(),
          duration: 0
        }),
        critical: true
      };

      healthCheckManager.addHealthCheck(check);
      await healthCheckManager.runHealthCheck('critical-check');
      
      const alerts = (healthCheckManager as any).alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should create medium alert for degraded service', async () => {
      const check: ServiceHealthCheck = {
        name: 'degraded-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.DEGRADED,
          timestamp: new Date().toISOString(),
          duration: 0
        })
      };

      healthCheckManager.addHealthCheck(check);
      await healthCheckManager.runHealthCheck('degraded-check');
      
      const alerts = (healthCheckManager as any).alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('medium');
    });
  });

  describe('runAllHealthChecks', () => {
    it('should run all health checks', async () => {
      const check1: ServiceHealthCheck = {
        name: 'check1',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 0
        })
      };

      const check2: ServiceHealthCheck = {
        name: 'check2',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
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
      const check: ServiceHealthCheck = {
        name: 'failing-check',
        check: jest.fn().mockRejectedValue(new Error('Check error'))
      };

      healthCheckManager.addHealthCheck(check);
      
      const results = await healthCheckManager.runAllHealthChecks();
      
      expect(results['failing-check'].status).toBe(HealthStatus.UNHEALTHY);
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
      const check: ServiceHealthCheck = {
        name: 'healthy-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 0
        })
      };

      healthCheckManager.addHealthCheck(check);
      const report = await healthCheckManager.getHealthReport();
      
      expect(report.overall).toBe(HealthStatus.HEALTHY);
    });

    it('should determine overall status as unhealthy when any unhealthy', async () => {
      const check: ServiceHealthCheck = {
        name: 'unhealthy-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date().toISOString(),
          duration: 0
        })
      };

      healthCheckManager.addHealthCheck(check);
      const report = await healthCheckManager.getHealthReport();
      
      expect(report.overall).toBe(HealthStatus.UNHEALTHY);
    });

    it('should determine overall status as degraded when any degraded', async () => {
      const check: ServiceHealthCheck = {
        name: 'degraded-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.DEGRADED,
          timestamp: new Date().toISOString(),
          duration: 0
        })
      };

      healthCheckManager.addHealthCheck(check);
      const report = await healthCheckManager.getHealthReport();
      
      expect(report.overall).toBe(HealthStatus.DEGRADED);
    });
  });

  describe('getHealthRouter', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

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
      expect(Router).toHaveBeenCalled();
      expect(mockRouter.get).toHaveBeenCalledTimes(6);
    });

    it('should handle /health endpoint', async () => {
      healthCheckManager.getHealthRouter();
      const handler = mockRouter.get.mock.calls[0][1];
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overall: expect.any(String),
          timestamp: expect.any(String),
          version: '1.0.0'
        })
      );
    });

    it('should return 503 for unhealthy status', async () => {
      const check: ServiceHealthCheck = {
        name: 'unhealthy-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
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
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HealthStatus.HEALTHY,
          uptime: expect.any(Number)
        })
      );
    });

    it('should handle /health/ready endpoint', async () => {
      healthCheckManager.getHealthRouter();
      const handler = mockRouter.get.mock.calls[2][1];
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle /health/service/:name endpoint', async () => {
      const check: ServiceHealthCheck = {
        name: 'test-service',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
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
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          alerts: expect.any(Array),
          count: expect.any(Number)
        })
      );
    });
  });

  describe('Alert Management', () => {
    it('should limit alerts to 100', async () => {
      // Add 105 alerts
      for (let i = 0; i < 105; i++) {
        (healthCheckManager as any).createAlert({
          id: `alert-${i}`,
          severity: 'low',
          message: `Alert ${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      const alerts = (healthCheckManager as any).alerts;
      expect(alerts).toHaveLength(100);
      expect(alerts[0].id).toBe('alert-5'); // First 5 should be removed
    });

    it('should get active alerts from last 24 hours', async () => {
      const now = Date.now();
      const oldAlert: HealthAlert = {
        id: 'old-alert',
        severity: 'low',
        message: 'Old alert',
        timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
      };
      
      const recentAlert: HealthAlert = {
        id: 'recent-alert',
        severity: 'low',
        message: 'Recent alert',
        timestamp: new Date(now - 1000).toISOString() // 1 second ago
      };
      
      (healthCheckManager as any).alerts = [oldAlert, recentAlert];
      
      const activeAlerts = (healthCheckManager as any).getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].id).toBe('recent-alert');
    });
  });

  describe('Default Health Checks', () => {
    it('should check system health', async () => {
      const result = await healthCheckManager.runHealthCheck('system');
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
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
      
      expect(result.status).toBe(HealthStatus.DEGRADED);
    });

    it('should mark system as unhealthy at 90% usage', async () => {
      mockSystemMetrics.memory.used = 1900;
      mockSystemMetrics.cpu.usage = 0.95;
      
      const result = await healthCheckManager.runHealthCheck('system');
      
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should check websocket health', async () => {
      const result = await healthCheckManager.runHealthCheck('websocket');
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
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
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
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
      
      expect(result.status).toBe(HealthStatus.DEGRADED);
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
      
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
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
      const check: ServiceHealthCheck = {
        name: 'periodic-check',
        check: jest.fn().mockResolvedValue({
          status: HealthStatus.HEALTHY,
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
      const check: ServiceHealthCheck = {
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
    expect(healthCheckManager).toBeInstanceOf(HealthCheckManager);
  });

  it('should use npm package version', () => {
    process.env.npm_package_version = '2.0.0';
    jest.resetModules();
    
    const { healthCheckManager } = require('../health-check');
    expect((healthCheckManager as any).version).toBe('2.0.0');
    
    delete process.env.npm_package_version;
  });
});