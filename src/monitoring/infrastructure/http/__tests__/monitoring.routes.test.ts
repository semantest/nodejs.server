/**
 * 🧪 Tests for Monitoring Routes
 * Testing metrics and monitoring endpoints
 */

import { Request, Response } from 'express';
import { monitoringRouter } from '../monitoring.routes';
import { queueManager } from '../../../../queues/infrastructure/http/queue.routes';
import { messageRepository } from '../../../../messages/infrastructure/http/message.routes';
import os from 'os';

// Mock dependencies
jest.mock('../../../../queues/infrastructure/http/queue.routes', () => ({
  queueManager: {
    getStatus: jest.fn()
  }
}));

jest.mock('../../../../messages/infrastructure/http/message.routes', () => ({
  messageRepository: {
    count: jest.fn()
  }
}));

jest.mock('os');

// Helper to extract route handlers
function getRouteHandler(path: string, method: string = 'get') {
  const route = monitoringRouter.stack.find((layer: any) => {
    return layer.route && layer.route.path === path && layer.route.methods[method];
  });
  return route?.route?.stack.find((s: any) => s.method === method)?.handle;
}

describe('Monitoring Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let typeMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    sendMock = jest.fn();
    typeMock = jest.fn().mockReturnThis();
    
    mockReq = {
      params: {},
      query: {}
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock,
      type: typeMock,
      send: sendMock
    };

    // Setup default mocks
    (queueManager.getStatus as jest.Mock).mockReturnValue({
      queueSizes: {
        high: 5,
        normal: 10,
        low: 3,
        processing: 2,
        dlq: 1
      },
      totalEnqueued: 100,
      totalProcessed: 80,
      totalFailed: 5,
      totalInDLQ: 1,
      avgProcessingTime: 5000,
      currentRate: 10
    });

    (messageRepository.count as jest.Mock).mockResolvedValue(150);

    // Mock OS functions
    (os.totalmem as jest.Mock).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    (os.freemem as jest.Mock).mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.2, 1.0]);
    (os.cpus as jest.Mock).mockReturnValue([
      { model: 'Intel Core i7', speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } },
      { model: 'Intel Core i7', speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } }
    ]);
    (os.uptime as jest.Mock).mockReturnValue(3600); // 1 hour
    (os.hostname as jest.Mock).mockReturnValue('test-server');
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.arch as jest.Mock).mockReturnValue('x64');

    // Mock process methods
    const originalUptime = process.uptime;
    const originalMemoryUsage = process.memoryUsage;
    process.uptime = jest.fn().mockReturnValue(1800); // 30 minutes
    process.memoryUsage = jest.fn().mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: 60 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    }) as any;
  });

  afterEach(() => {
    // Restore process methods
    jest.restoreAllMocks();
  });

  describe('GET /metrics', () => {
    it('should return Prometheus-formatted metrics', async () => {
      const handler = getRouteHandler('/metrics');
      await handler(mockReq as Request, mockRes as Response);
      
      expect(typeMock).toHaveBeenCalledWith('text/plain');
      expect(sendMock).toHaveBeenCalled();
      
      const metrics = sendMock.mock.calls[0][0];
      expect(metrics).toContain('# HELP nodejs_process_uptime_seconds');
      expect(metrics).toContain('nodejs_process_uptime_seconds 1800');
      expect(metrics).toContain('# HELP nodejs_memory_heap_used_bytes');
      expect(metrics).toContain(`nodejs_memory_heap_used_bytes ${60 * 1024 * 1024}`);
      expect(metrics).toContain('# HELP queue_items_total');
      expect(metrics).toContain('queue_items_total{priority="high"} 5');
      expect(metrics).toContain('queue_items_total{priority="normal"} 10');
      expect(metrics).toContain('queue_items_total{priority="low"} 3');
      expect(metrics).toContain('queue_items_total{priority="dlq"} 1');
      expect(metrics).toContain('# HELP queue_processed_total');
      expect(metrics).toContain('queue_processed_total 80');
      expect(metrics).toContain('# HELP message_store_size');
      expect(metrics).toContain('message_store_size 150');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Metrics collection failed');
      (queueManager.getStatus as jest.Mock).mockImplementation(() => {
        throw error;
      });
      
      const handler = getRouteHandler('/metrics');
      await handler(mockReq as Request, mockRes as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to collect metrics' });
    });
  });

  describe('GET /metrics/json', () => {
    it('should return JSON-formatted metrics', async () => {
      const handler = getRouteHandler('/metrics/json');
      await handler(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalled();
      const metrics = jsonMock.mock.calls[0][0];
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics.uptime).toEqual({
        process: 1800,
        system: 3600
      });
      
      expect(metrics).toHaveProperty('memory');
      expect(metrics.memory.process).toEqual({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      });
      expect(metrics.memory.system).toEqual({
        total: 8 * 1024 * 1024 * 1024,
        free: 4 * 1024 * 1024 * 1024,
        used: 4 * 1024 * 1024 * 1024,
        percentUsed: 50
      });
      
      expect(metrics).toHaveProperty('cpu');
      expect(metrics.cpu).toEqual({
        loadAvg: [1.5, 1.2, 1.0],
        cores: 2
      });
      
      expect(metrics).toHaveProperty('application');
      expect(metrics.application.queue).toEqual({
        depth: {
          high: 5,
          normal: 10,
          low: 3,
          processing: 2,
          dlq: 1
        },
        processingRate: 10,
        errorRate: 0.0625, // 5/80
        dlqSize: 1
      });
      expect(metrics.application.messages).toEqual({
        total: 150,
        rate: 0
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (messageRepository.count as jest.Mock).mockRejectedValue(error);
      
      const handler = getRouteHandler('/metrics/json');
      await handler(mockReq as Request, mockRes as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to collect metrics' });
    });
  });

  describe('GET /metrics/queue', () => {
    it('should return detailed queue metrics', () => {
      const handler = getRouteHandler('/metrics/queue');
      handler(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalled();
      const response = jsonMock.mock.calls[0][0];
      
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('queue');
      expect(response.queue).toEqual({
        sizes: {
          high: 5,
          normal: 10,
          low: 3,
          processing: 2,
          dlq: 1
        },
        totals: {
          enqueued: 100,
          processed: 80,
          failed: 5,
          inDLQ: 1
        },
        performance: {
          avgProcessingTime: 5000,
          currentRate: 10
        },
        health: {
          isHealthy: true, // dlq < 50
          warnings: [],
          errors: []
        }
      });
    });

    it('should show unhealthy status when DLQ is high', () => {
      (queueManager.getStatus as jest.Mock).mockReturnValue({
        queueSizes: {
          high: 5,
          normal: 10,
          low: 3,
          processing: 2,
          dlq: 55 // Over 50
        },
        totalEnqueued: 100,
        totalProcessed: 80,
        totalFailed: 55,
        totalInDLQ: 55,
        avgProcessingTime: 5000,
        currentRate: 10
      });
      
      const handler = getRouteHandler('/metrics/queue');
      handler(mockReq as Request, mockRes as Response);
      
      const response = jsonMock.mock.calls[0][0];
      expect(response.queue.health.isHealthy).toBe(false);
    });

    it('should handle errors', () => {
      const error = new Error('Queue unavailable');
      (queueManager.getStatus as jest.Mock).mockImplementation(() => {
        throw error;
      });
      
      const handler = getRouteHandler('/metrics/queue');
      handler(mockReq as Request, mockRes as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to collect queue metrics' });
    });
  });

  describe('GET /metrics/system', () => {
    it('should return system resource metrics', () => {
      const handler = getRouteHandler('/metrics/system');
      handler(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalled();
      const response = jsonMock.mock.calls[0][0];
      
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('hostname', 'test-server');
      expect(response).toHaveProperty('platform', 'linux');
      expect(response).toHaveProperty('arch', 'x64');
      expect(response).toHaveProperty('nodeVersion', process.version);
      
      expect(response.uptime).toEqual({
        system: 3600,
        process: 1800
      });
      
      expect(response.memory).toEqual({
        system: {
          total: 8 * 1024 * 1024 * 1024,
          free: 4 * 1024 * 1024 * 1024,
          used: 4 * 1024 * 1024 * 1024,
          percentUsed: 50
        },
        process: {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024
        }
      });
      
      expect(response.cpu).toHaveProperty('cores', 2);
      expect(response.cpu).toHaveProperty('usage');
      expect(response.cpu.usage).toHaveLength(2);
      expect(response.cpu.usage[0]).toEqual({
        core: 0,
        model: 'Intel Core i7',
        speed: 2400,
        times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 }
      });
      expect(response.cpu.loadAverage).toEqual([1.5, 1.2, 1.0]);
    });

    it('should handle errors', () => {
      const error = new Error('System metrics unavailable');
      (os.cpus as jest.Mock).mockImplementation(() => {
        throw error;
      });
      
      const handler = getRouteHandler('/metrics/system');
      handler(mockReq as Request, mockRes as Response);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to collect system metrics' });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing queue status properties', async () => {
      (queueManager.getStatus as jest.Mock).mockReturnValue({
        queueSizes: {
          processing: 2,
          dlq: 1
        },
        totalProcessed: 0
      });
      
      const handler = getRouteHandler('/metrics');
      await handler(mockReq as Request, mockRes as Response);
      
      expect(sendMock).toHaveBeenCalled();
      const metrics = sendMock.mock.calls[0][0];
      expect(metrics).toContain('queue_items_total{priority="high"} undefined');
    });

    it('should handle division by zero in error rate calculation', async () => {
      (queueManager.getStatus as jest.Mock).mockReturnValue({
        queueSizes: {
          high: 0,
          normal: 0,
          low: 0,
          processing: 0,
          dlq: 0
        },
        totalProcessed: 0,
        totalFailed: 0,
        currentRate: 0
      });
      
      const handler = getRouteHandler('/metrics/json');
      await handler(mockReq as Request, mockRes as Response);
      
      const metrics = jsonMock.mock.calls[0][0];
      expect(metrics.application.queue.errorRate).toBe(0); // 0/max(0,1) = 0
    });
  });
});