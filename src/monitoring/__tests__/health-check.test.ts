/**
 * 🧪 Tests for Health Check System
 * Testing comprehensive health monitoring for all services and dependencies
 */

import { 
  HealthCheckManager, 
  healthCheckManager,
  HealthStatus,
  HealthCheckResult,
  ServiceHealthCheck,
  ComprehensiveHealthReport,
  HealthAlert
} from '../infrastructure/health-check';
import { Router } from 'express';
import { performance } from 'perf_hooks';

// Mock dependencies
jest.mock('../infrastructure/performance-metrics', () => ({
  performanceMetrics: {
    getSystemMetrics: jest.fn(() => ({
      cpu: { usage: 0.5, loadAverage: [1, 1, 1] },
      memory: { total: 8000, free: 4000, used: 4000 },
      uptime: 1000
    })),
    getBusinessMetrics: jest.fn(() => ({
      apiRequests: { total: 100, errors: 5 },
      websocketConnections: { active: 10, total: 20 }
    }))
  }
}));

jest.mock('../infrastructure/structured-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock timers
jest.spyOn(global, 'setInterval');
jest.spyOn(global, 'clearInterval');

// Mock process.memoryUsage
const originalMemoryUsage = process.memoryUsage;
beforeEach(() => {
  process.memoryUsage = jest.fn(() => ({
    rss: 100000000,
    heapTotal: 100000000,
    heapUsed: 50000000,
    external: 1000000,
    arrayBuffers: 1000000
  })) as any;
});

afterEach(() => {
  process.memoryUsage = originalMemoryUsage;
});

jest.mock('perf_hooks', () => ({
  performance: {
    now: jest.fn(() => 1000)
  }
}));

describe('HealthCheckManager', () => {
  let healthManager: HealthCheckManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    healthManager = new HealthCheckManager('1.0.0');
  });

  afterEach(() => {
    healthManager.stop();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should create health manager with version', () => {
      const manager = new HealthCheckManager('2.0.0');
      expect(manager['version']).toBe('2.0.0');
    });

    it('should initialize with default health checks', () => {
      // Default checks should be set up
      expect(healthManager['healthChecks'].size).toBeGreaterThan(0);
    });
  });

  describe('Health Check Management', () => {
    it('should add health check', () => {
      const check: ServiceHealthCheck = {
        name: 'test-service',
        check: async () => ({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 10
        }),
        timeout: 3000,
        interval: 5000,
        critical: true
      };

      healthManager.addHealthCheck(check);

      expect(healthManager['healthChecks'].has('test-service')).toBe(true);
    });

    it('should remove health check', () => {
      const check: ServiceHealthCheck = {
        name: 'test-service',
        check: async () => ({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 10
        })
      };

      healthManager.addHealthCheck(check);
      healthManager.removeHealthCheck('test-service');

      expect(healthManager['healthChecks'].has('test-service')).toBe(false);
    });

    it('should start periodic check for health check with interval', () => {
      healthManager.start();

      const check: ServiceHealthCheck = {
        name: 'periodic-check',
        check: async () => ({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 10
        }),
        interval: 1000
      };

      healthManager.addHealthCheck(check);

      expect(setInterval).toHaveBeenCalled();
    });
  });

  describe('Health Check Execution', () => {
    it('should run specific health check', async () => {
      const mockCheck = jest.fn().mockResolvedValue({
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString(),
        duration: 10,
        details: { test: true }
      });

      const check: ServiceHealthCheck = {
        name: 'test-check',
        check: mockCheck
      };

      healthManager.addHealthCheck(check);

      const result = await healthManager.runHealthCheck('test-check');

      expect(mockCheck).toHaveBeenCalled();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.details).toEqual({ test: true });
    });

    it('should handle health check timeout', async () => {
      const check: ServiceHealthCheck = {
        name: 'slow-check',
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return {
            status: HealthStatus.HEALTHY,
            timestamp: new Date().toISOString(),
            duration: 10000
          };
        },
        timeout: 100
      };

      healthManager.addHealthCheck(check);

      const result = await healthManager.runHealthCheck('slow-check');

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toContain('timeout');
    }, 5000);

    it('should handle health check errors', async () => {
      const check: ServiceHealthCheck = {
        name: 'error-check',
        check: async () => {
          throw new Error('Check failed');
        }
      };

      healthManager.addHealthCheck(check);

      const result = await healthManager.runHealthCheck('error-check');

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toContain('Check failed');
    });

    it('should throw error for non-existent health check', async () => {
      await expect(healthManager.runHealthCheck('non-existent')).rejects.toThrow(
        'Health check not found: non-existent'
      );
    });
  });

  describe('Health Report Generation', () => {
    beforeEach(() => {
      // Add some test health checks
      healthManager.addHealthCheck({
        name: 'database',
        check: async () => ({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 20,
          details: { connections: 10 }
        }),
        critical: true
      });

      healthManager.addHealthCheck({
        name: 'cache',
        check: async () => ({
          status: HealthStatus.DEGRADED,
          timestamp: new Date().toISOString(),
          duration: 15,
          details: { hitRate: 0.7 }
        })
      });

      healthManager.addHealthCheck({
        name: 'queue',
        check: async () => ({
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date().toISOString(),
          duration: 50,
          error: 'Queue service down'
        })
      });
    });

    it('should generate comprehensive health report', async () => {
      const report = await healthManager.getHealthReport();

      expect(report).toHaveProperty('overall');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('version', '1.0.0');
      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('services');
      expect(report).toHaveProperty('system');
      expect(report).toHaveProperty('business');
      expect(report).toHaveProperty('dependencies');
      expect(report).toHaveProperty('alerts');

      expect(report.services).toHaveProperty('database');
      expect(report.services).toHaveProperty('cache');
      expect(report.services).toHaveProperty('queue');
    });

    it('should determine overall health status correctly', async () => {
      const report = await healthManager.getHealthReport();

      // Should be UNHEALTHY because queue is unhealthy
      expect(report.overall).toBe(HealthStatus.UNHEALTHY);
    });

    it('should handle partial health check failures', async () => {
      // Add a failing check
      healthManager.addHealthCheck({
        name: 'failing-check',
        check: async () => {
          throw new Error('Always fails');
        }
      });

      const report = await healthManager.getHealthReport();

      expect(report.services['failing-check'].status).toBe(HealthStatus.UNHEALTHY);
      expect(report.services['failing-check'].error).toContain('Always fails');
    });
  });

  describe('Lifecycle Management', () => {
    it('should start health monitoring', () => {
      healthManager.start();

      expect(healthManager['isRunning']).toBe(true);
    });

    it('should not start if already running', () => {
      healthManager.start();
      const initialIntervalCount = (setInterval as jest.Mock).mock.calls.length;

      healthManager.start();

      expect((setInterval as jest.Mock).mock.calls.length).toBe(initialIntervalCount);
    });

    it('should stop health monitoring', () => {
      healthManager.start();
      
      // Add a periodic check
      healthManager.addHealthCheck({
        name: 'periodic',
        check: async () => ({
          status: HealthStatus.HEALTHY,
          timestamp: new Date().toISOString(),
          duration: 10
        }),
        interval: 1000
      });

      healthManager.stop();

      expect(healthManager['isRunning']).toBe(false);
      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('Alert Management', () => {
    it('should add alert for critical failures', async () => {
      // Create a new health manager instance to avoid interference
      const testHealthManager = new HealthCheckManager('test');
      
      // Add a critical check that will fail
      testHealthManager.addHealthCheck({
        name: 'critical-service',
        check: async () => ({
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date().toISOString(),
          duration: 10,
          error: 'Critical service down'
        }),
        critical: true
      });

      const report = await testHealthManager.getHealthReport();

      // Find alerts for critical-service
      const criticalAlerts = report.alerts.filter(a => a.message.includes('critical-service'));
      
      expect(criticalAlerts).toHaveLength(1);
      expect(criticalAlerts[0].severity).toBe('critical');
      expect(criticalAlerts[0].message).toContain('critical-service');
    });

  });

  describe('Express Router', () => {
    it('should create health router', () => {
      const router = healthManager.getHealthRouter();

      expect(router).toBeDefined();
      expect(Router).toHaveBeenCalled();
    });

    it('should handle health endpoint', async () => {
      const router = healthManager.getHealthRouter();
      const mockGet = (Router as unknown as jest.Mock).mock.results[0].value.get;

      expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(mockGet).toHaveBeenCalledWith('/health/live', expect.any(Function));
      expect(mockGet).toHaveBeenCalledWith('/health/ready', expect.any(Function));
      expect(mockGet).toHaveBeenCalledWith('/metrics', expect.any(Function));
    });
  });

  describe('Periodic Health Checks', () => {
    it('should run periodic health checks', () => {
      jest.useFakeTimers();
      healthManager.start();

      const mockCheck = jest.fn().mockResolvedValue({
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString(),
        duration: 10
      });

      healthManager.addHealthCheck({
        name: 'periodic-test',
        check: mockCheck,
        interval: 5000
      });

      // Advance time to trigger the check
      jest.advanceTimersByTime(5000);

      expect(mockCheck).toHaveBeenCalled();
    });

    it('should cache periodic check results', async () => {
      const mockCheck = jest.fn().mockResolvedValue({
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString(),
        duration: 10
      });

      healthManager.addHealthCheck({
        name: 'cached-check',
        check: mockCheck,
        interval: 5000
      });

      healthManager.start();

      // Run the check
      await healthManager.runHealthCheck('cached-check');

      // Check should be cached
      expect(healthManager['lastResults'].has('cached-check')).toBe(true);
    });
  });

  describe('Default Health Checks', () => {
    it('should include system health check', async () => {
      const result = await healthManager.runHealthCheck('system');
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.details).toHaveProperty('cpu_usage');
      expect(result.details).toHaveProperty('memory_usage');
      expect(result.details).toHaveProperty('uptime');
    });

    it('should include process health check', async () => {
      const result = await healthManager.runHealthCheck('process');
      
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.details).toHaveProperty('memory');
      expect(result.details).toHaveProperty('cpu');
      expect(result.details).toHaveProperty('uptime');
    });
  });
});

describe('Default Instance', () => {
  it('should export default healthCheckManager instance', () => {
    expect(healthCheckManager).toBeDefined();
    expect(healthCheckManager).toBeInstanceOf(HealthCheckManager);
  });
});

// Mock Express Router
jest.mock('express', () => ({
  Router: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn()
  }))
}));