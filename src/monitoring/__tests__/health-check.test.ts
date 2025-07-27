/**
 * Emergency tests for HealthCheck monitoring
 * Created by Quinn (QA) during test coverage crisis - 8:20 AM
 * Target: Boost nodejs.server coverage from 13.41%
 */

import { HealthCheckManager } from '../infrastructure/health-check';
import { Application } from '../../stubs/typescript-eda-stubs';

// Mock dependencies
jest.mock('../../stubs/typescript-eda-stubs', () => ({
  Application: class MockApplication {
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();
  },
  Event: class MockEvent {},
  Enable: () => (target: any) => target,
  listen: () => () => {},
  AdapterFor: () => (target: any) => target
}));

// Mock fs for config file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn()
}));

// Mock child_process for system checks
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn()
}));

describe('HealthCheckManager', () => {
  let healthCheck: HealthCheckManager;
  let mockApp: any;

  beforeEach(() => {
    healthCheck = new HealthCheckManager();
    mockApp = new Application();
    jest.clearAllMocks();
    
    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(healthCheck.metadata.get('name')).toBe('Health Check Service');
      expect(healthCheck.metadata.get('version')).toBe('1.0.0');
      expect(healthCheck.metadata.get('description')).toBe('Comprehensive health monitoring system');
    });

    it('should set up event listeners on application start', () => {
      healthCheck['app'] = mockApp;
      healthCheck.onApplicationBootstrap();

      expect(mockApp.on).toHaveBeenCalledWith('health:check', expect.any(Function));
      expect(mockApp.on).toHaveBeenCalledWith('health:detailed', expect.any(Function));
      expect(mockApp.on).toHaveBeenCalledWith('health:component', expect.any(Function));
    });
  });

  describe('health checks', () => {
    it('should perform basic health check', async () => {
      const result = await healthCheck.checkHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
    });

    it('should perform detailed health check', async () => {
      const result = await healthCheck.getDetailedHealth();

      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('timestamp');
      expect(result.components).toHaveProperty('database');
      expect(result.components).toHaveProperty('cache');
      expect(result.components).toHaveProperty('queue');
      expect(result.components).toHaveProperty('storage');
    });

    it('should check individual components', async () => {
      const components = ['database', 'cache', 'queue', 'storage'];

      for (const component of components) {
        const result = await healthCheck.checkComponent(component);
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('responseTime');
        expect(result).toHaveProperty('details');
      }
    });
  });

  describe('database health check', () => {
    it('should report healthy database', async () => {
      // Mock successful database check
      healthCheck['checkDatabaseHealth'] = jest.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 10,
        details: {
          connections: 5,
          maxConnections: 100,
          latency: 10
        }
      });

      const result = await healthCheck.checkComponent('database');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeLessThan(100);
    });

    it('should handle database connection errors', async () => {
      healthCheck['checkDatabaseHealth'] = jest.fn().mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await healthCheck.checkComponent('database');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection refused');
    });

    it('should detect high connection usage', async () => {
      healthCheck['checkDatabaseHealth'] = jest.fn().mockResolvedValue({
        status: 'degraded',
        responseTime: 50,
        details: {
          connections: 90,
          maxConnections: 100,
          latency: 50
        }
      });

      const result = await healthCheck.checkComponent('database');
      expect(result.status).toBe('degraded');
    });
  });

  describe('cache health check', () => {
    it('should report healthy cache', async () => {
      healthCheck['checkCacheHealth'] = jest.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 5,
        details: {
          hitRate: 0.95,
          memoryUsage: '100MB',
          evictions: 10
        }
      });

      const result = await healthCheck.checkComponent('cache');
      expect(result.status).toBe('healthy');
      expect(result.details.hitRate).toBeGreaterThan(0.9);
    });

    it('should detect low hit rate', async () => {
      healthCheck['checkCacheHealth'] = jest.fn().mockResolvedValue({
        status: 'degraded',
        responseTime: 5,
        details: {
          hitRate: 0.5,
          memoryUsage: '500MB',
          evictions: 1000
        }
      });

      const result = await healthCheck.checkComponent('cache');
      expect(result.status).toBe('degraded');
      expect(result.details.hitRate).toBeLessThan(0.8);
    });
  });

  describe('queue health check', () => {
    it('should report healthy queue', async () => {
      healthCheck['checkQueueHealth'] = jest.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 8,
        details: {
          pending: 10,
          processing: 5,
          failed: 0,
          completed: 1000
        }
      });

      const result = await healthCheck.checkComponent('queue');
      expect(result.status).toBe('healthy');
      expect(result.details.failed).toBe(0);
    });

    it('should detect queue backup', async () => {
      healthCheck['checkQueueHealth'] = jest.fn().mockResolvedValue({
        status: 'degraded',
        responseTime: 8,
        details: {
          pending: 10000,
          processing: 50,
          failed: 100,
          completed: 5000
        }
      });

      const result = await healthCheck.checkComponent('queue');
      expect(result.status).toBe('degraded');
      expect(result.details.pending).toBeGreaterThan(1000);
    });
  });

  describe('system metrics', () => {
    it('should collect CPU metrics', async () => {
      const metrics = await healthCheck['getSystemMetrics']();
      
      expect(metrics).toHaveProperty('cpu');
      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('loadAverage');
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
    });

    it('should collect memory metrics', async () => {
      const metrics = await healthCheck['getSystemMetrics']();
      
      expect(metrics).toHaveProperty('memory');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('free');
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory.used + metrics.memory.free).toBeLessThanOrEqual(metrics.memory.total);
    });

    it('should collect disk metrics', async () => {
      const metrics = await healthCheck['getSystemMetrics']();
      
      expect(metrics).toHaveProperty('disk');
      expect(metrics.disk).toHaveProperty('used');
      expect(metrics.disk).toHaveProperty('free');
      expect(metrics.disk).toHaveProperty('usagePercent');
    });
  });

  describe('thresholds and alerting', () => {
    it('should trigger unhealthy when CPU > 90%', async () => {
      healthCheck['getSystemMetrics'] = jest.fn().mockResolvedValue({
        cpu: { usage: 95, loadAverage: [3, 3, 3] },
        memory: { used: 4000, free: 4000, total: 8000 },
        disk: { used: 50, free: 50, usagePercent: 50 }
      });

      const result = await healthCheck.checkHealth();
      expect(result.status).toBe('unhealthy');
    });

    it('should trigger degraded when memory > 80%', async () => {
      healthCheck['getSystemMetrics'] = jest.fn().mockResolvedValue({
        cpu: { usage: 50, loadAverage: [1, 1, 1] },
        memory: { used: 7000, free: 1000, total: 8000 },
        disk: { used: 50, free: 50, usagePercent: 50 }
      });

      const result = await healthCheck.checkHealth();
      expect(['degraded', 'unhealthy']).toContain(result.status);
    });

    it('should emit warning events on degraded health', async () => {
      healthCheck['app'] = mockApp;
      healthCheck['getOverallHealth'] = jest.fn().mockResolvedValue('degraded');

      await healthCheck.checkHealth();

      expect(mockApp.emit).toHaveBeenCalledWith(
        'health:warning',
        expect.objectContaining({
          status: 'degraded'
        })
      );
    });
  });

  describe('health history', () => {
    it('should maintain health check history', async () => {
      // Perform multiple health checks
      await healthCheck.checkHealth();
      await healthCheck.checkHealth();
      await healthCheck.checkHealth();

      const history = healthCheck.getHealthHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('status');
    });

    it('should limit history to last 100 entries', async () => {
      // Perform 150 health checks
      for (let i = 0; i < 150; i++) {
        await healthCheck.checkHealth();
      }

      const history = healthCheck.getHealthHistory();
      expect(history).toHaveLength(100);
    });

    it('should calculate health trends', () => {
      // Add mock history
      const mockHistory = [
        { status: 'healthy', timestamp: new Date() },
        { status: 'healthy', timestamp: new Date() },
        { status: 'degraded', timestamp: new Date() },
        { status: 'healthy', timestamp: new Date() },
        { status: 'unhealthy', timestamp: new Date() }
      ];

      healthCheck['healthHistory'] = mockHistory;

      const trends = healthCheck.getHealthTrends();
      expect(trends.healthy).toBe(60); // 3/5 = 60%
      expect(trends.degraded).toBe(20); // 1/5 = 20%
      expect(trends.unhealthy).toBe(20); // 1/5 = 20%
    });
  });

  describe('custom health checks', () => {
    it('should register custom health check', () => {
      const customCheck = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Custom check passed'
      });

      healthCheck.registerHealthCheck('custom', customCheck);
      expect(healthCheck['customChecks'].has('custom')).toBe(true);
    });

    it('should execute custom health checks', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Custom check passed'
      });

      healthCheck.registerHealthCheck('custom', customCheck);
      const result = await healthCheck.checkComponent('custom');

      expect(customCheck).toHaveBeenCalled();
      expect(result.status).toBe('healthy');
    });

    it('should handle custom check failures', async () => {
      const customCheck = jest.fn().mockRejectedValue(
        new Error('Custom check failed')
      );

      healthCheck.registerHealthCheck('custom', customCheck);
      const result = await healthCheck.checkComponent('custom');

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Custom check failed');
    });
  });

  describe('health endpoints integration', () => {
    it('should format response for liveness probe', () => {
      const response = healthCheck.formatForKubernetes('healthy');
      expect(response).toEqual({ status: 'ok' });
    });

    it('should format response for readiness probe', async () => {
      const result = await healthCheck.getReadinessStatus();
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('checks');
    });

    it('should support different output formats', () => {
      const formats = ['json', 'prometheus', 'plain'];
      
      formats.forEach(format => {
        const result = healthCheck.formatHealthResponse(
          { status: 'healthy', timestamp: new Date() },
          format
        );
        expect(result).toBeDefined();
      });
    });
  });
});