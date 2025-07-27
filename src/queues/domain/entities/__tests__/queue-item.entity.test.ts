/**
 * Tests for Queue Item Entity
 * Testing interfaces, types, and queue-related data structures
 */

import { 
  QueueItemPayload, 
  QueuePriority, 
  QueueStatus, 
  QueueItem, 
  QueueMetrics 
} from '../queue-item.entity';

describe('Queue Item Entity', () => {
  describe('Type Definitions', () => {
    it('should have correct priority types', () => {
      const priorities: QueuePriority[] = ['high', 'normal', 'low'];
      
      priorities.forEach(priority => {
        expect(['high', 'normal', 'low']).toContain(priority);
      });
    });

    it('should have correct status types', () => {
      const statuses: QueueStatus[] = ['pending', 'processing', 'completed', 'failed', 'dead'];
      
      statuses.forEach(status => {
        expect(['pending', 'processing', 'completed', 'failed', 'dead']).toContain(status);
      });
    });
  });

  describe('QueueItemPayload', () => {
    it('should create minimal payload', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook'
      };

      expect(payload.url).toBe('https://api.example.com/webhook');
      expect(payload.headers).toBeUndefined();
      expect(payload.metadata).toBeUndefined();
      expect(payload.addon_id).toBeUndefined();
      expect(payload.callback_url).toBeUndefined();
      expect(payload.ai_tool).toBeUndefined();
    });

    it('should create payload with headers', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        }
      };

      expect(payload.headers).toBeDefined();
      expect(payload.headers!['Content-Type']).toBe('application/json');
      expect(payload.headers!['Authorization']).toBe('Bearer token123');
    });

    it('should create payload with metadata', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        metadata: {
          userId: 'user-123',
          orderId: 'order-456',
          timestamp: Date.now(),
          nested: {
            key: 'value'
          }
        }
      };

      expect(payload.metadata).toBeDefined();
      expect(payload.metadata!.userId).toBe('user-123');
      expect(payload.metadata!.nested.key).toBe('value');
    });

    it('should create payload with addon_id', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        addon_id: 'addon-789'
      };

      expect(payload.addon_id).toBe('addon-789');
    });

    it('should create payload with callback_url', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        callback_url: 'https://callback.example.com/status'
      };

      expect(payload.callback_url).toBe('https://callback.example.com/status');
    });

    it('should create payload with ai_tool', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        ai_tool: {
          toolId: 'tool-123',
          activationRequired: true,
          activationAttempts: 3,
          lastActivationError: 'Connection timeout'
        }
      };

      expect(payload.ai_tool).toBeDefined();
      expect(payload.ai_tool!.toolId).toBe('tool-123');
      expect(payload.ai_tool!.activationRequired).toBe(true);
      expect(payload.ai_tool!.activationAttempts).toBe(3);
      expect(payload.ai_tool!.lastActivationError).toBe('Connection timeout');
    });

    it('should create payload with minimal ai_tool', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        ai_tool: {
          toolId: 'tool-456',
          activationRequired: false
        }
      };

      expect(payload.ai_tool!.activationAttempts).toBeUndefined();
      expect(payload.ai_tool!.lastActivationError).toBeUndefined();
    });

    it('should create fully populated payload', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com/webhook',
        headers: { 'X-Custom': 'value' },
        metadata: { key: 'value' },
        addon_id: 'addon-123',
        callback_url: 'https://callback.example.com',
        ai_tool: {
          toolId: 'tool-789',
          activationRequired: true
        }
      };

      expect(payload.url).toBe('https://api.example.com/webhook');
      expect(payload.headers).toBeDefined();
      expect(payload.metadata).toBeDefined();
      expect(payload.addon_id).toBeDefined();
      expect(payload.callback_url).toBeDefined();
      expect(payload.ai_tool).toBeDefined();
    });
  });

  describe('QueueItem', () => {
    it('should create pending queue item', () => {
      const item: QueueItem = {
        id: 'queue-item-123',
        priority: 'normal',
        payload: {
          url: 'https://api.example.com/webhook'
        },
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      expect(item.id).toBe('queue-item-123');
      expect(item.priority).toBe('normal');
      expect(item.status).toBe('pending');
      expect(item.attempts).toBe(0);
      expect(item.lastAttemptAt).toBeUndefined();
      expect(item.completedAt).toBeUndefined();
      expect(item.error).toBeUndefined();
      expect(item.result).toBeUndefined();
    });

    it('should create processing queue item', () => {
      const item: QueueItem = {
        id: 'queue-item-456',
        priority: 'high',
        payload: {
          url: 'https://api.example.com/webhook'
        },
        attempts: 1,
        maxAttempts: 3,
        status: 'processing',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastAttemptAt: new Date('2024-01-01T10:01:00Z')
      };

      expect(item.status).toBe('processing');
      expect(item.attempts).toBe(1);
      expect(item.lastAttemptAt).toBeDefined();
    });

    it('should create completed queue item', () => {
      const item: QueueItem = {
        id: 'queue-item-789',
        priority: 'normal',
        payload: {
          url: 'https://api.example.com/webhook'
        },
        attempts: 1,
        maxAttempts: 3,
        status: 'completed',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastAttemptAt: new Date('2024-01-01T10:01:00Z'),
        completedAt: new Date('2024-01-01T10:01:30Z'),
        result: { success: true, data: 'processed' },
        processingTime: 500
      };

      expect(item.status).toBe('completed');
      expect(item.completedAt).toBeDefined();
      expect(item.result).toEqual({ success: true, data: 'processed' });
      expect(item.processingTime).toBe(500);
    });

    it('should create failed queue item', () => {
      const item: QueueItem = {
        id: 'queue-item-failed',
        priority: 'low',
        payload: {
          url: 'https://api.example.com/webhook'
        },
        attempts: 3,
        maxAttempts: 3,
        status: 'failed',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastAttemptAt: new Date('2024-01-01T10:03:00Z'),
        error: {
          message: 'Connection timeout',
          code: 'ETIMEDOUT',
          stack: 'Error: Connection timeout\n    at Socket...'
        },
        nextRetryAt: new Date('2024-01-01T10:08:00Z')
      };

      expect(item.status).toBe('failed');
      expect(item.attempts).toBe(item.maxAttempts);
      expect(item.error).toBeDefined();
      expect(item.error!.message).toBe('Connection timeout');
      expect(item.error!.code).toBe('ETIMEDOUT');
      expect(item.nextRetryAt).toBeDefined();
    });

    it('should create dead letter queue item', () => {
      const item: QueueItem = {
        id: 'queue-item-dead',
        priority: 'normal',
        payload: {
          url: 'https://api.example.com/webhook'
        },
        attempts: 5,
        maxAttempts: 3,
        status: 'dead',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastAttemptAt: new Date('2024-01-01T10:20:00Z'),
        error: {
          message: 'Max attempts exceeded'
        }
      };

      expect(item.status).toBe('dead');
      expect(item.attempts).toBeGreaterThan(item.maxAttempts);
    });

    it('should create queue item with different priorities', () => {
      const priorities: QueuePriority[] = ['high', 'normal', 'low'];
      
      priorities.forEach(priority => {
        const item: QueueItem = {
          id: `queue-item-${priority}`,
          priority: priority,
          payload: { url: 'https://api.example.com' },
          attempts: 0,
          maxAttempts: 3,
          status: 'pending',
          createdAt: new Date()
        };

        expect(item.priority).toBe(priority);
      });
    });
  });

  describe('QueueMetrics', () => {
    it('should create queue metrics', () => {
      const metrics: QueueMetrics = {
        totalEnqueued: 1000,
        totalProcessed: 850,
        totalFailed: 50,
        totalInDLQ: 10,
        avgProcessingTime: 250.5,
        currentRate: 10.5,
        queueSizes: {
          high: 5,
          normal: 45,
          low: 40,
          processing: 10,
          dlq: 10
        }
      };

      expect(metrics.totalEnqueued).toBe(1000);
      expect(metrics.totalProcessed).toBe(850);
      expect(metrics.totalFailed).toBe(50);
      expect(metrics.totalInDLQ).toBe(10);
      expect(metrics.avgProcessingTime).toBe(250.5);
      expect(metrics.currentRate).toBe(10.5);
      expect(metrics.queueSizes.high).toBe(5);
      expect(metrics.queueSizes.normal).toBe(45);
      expect(metrics.queueSizes.low).toBe(40);
      expect(metrics.queueSizes.processing).toBe(10);
      expect(metrics.queueSizes.dlq).toBe(10);
    });

    it('should have consistent metrics', () => {
      const metrics: QueueMetrics = {
        totalEnqueued: 1000,
        totalProcessed: 850,
        totalFailed: 50,
        totalInDLQ: 10,
        avgProcessingTime: 250.5,
        currentRate: 10.5,
        queueSizes: {
          high: 5,
          normal: 45,
          low: 40,
          processing: 10,
          dlq: 10
        }
      };

      // Total in queues should be reasonable
      const totalInQueues = metrics.queueSizes.high + 
                          metrics.queueSizes.normal + 
                          metrics.queueSizes.low + 
                          metrics.queueSizes.processing;
      
      const totalHandled = metrics.totalProcessed + metrics.totalFailed + metrics.totalInDLQ;
      const remaining = metrics.totalEnqueued - totalHandled;

      // Remaining items should be in queues or processing
      expect(totalInQueues).toBeLessThanOrEqual(remaining + metrics.queueSizes.processing);
    });

    it('should create empty queue metrics', () => {
      const metrics: QueueMetrics = {
        totalEnqueued: 0,
        totalProcessed: 0,
        totalFailed: 0,
        totalInDLQ: 0,
        avgProcessingTime: 0,
        currentRate: 0,
        queueSizes: {
          high: 0,
          normal: 0,
          low: 0,
          processing: 0,
          dlq: 0
        }
      };

      expect(metrics.totalEnqueued).toBe(0);
      expect(metrics.avgProcessingTime).toBe(0);
      expect(metrics.currentRate).toBe(0);
      Object.values(metrics.queueSizes).forEach(size => {
        expect(size).toBe(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', () => {
      const longUrl = 'https://api.example.com/' + 'a'.repeat(1000);
      const payload: QueueItemPayload = {
        url: longUrl
      };

      expect(payload.url).toBe(longUrl);
      expect(payload.url.length).toBeGreaterThan(1000);
    });

    it('should handle deeply nested metadata', () => {
      const payload: QueueItemPayload = {
        url: 'https://api.example.com',
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    value: 'deep'
                  }
                }
              }
            }
          }
        }
      };

      expect(payload.metadata!.level1.level2.level3.level4.level5.value).toBe('deep');
    });

    it('should handle large number of headers', () => {
      const headers: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        headers[`Header-${i}`] = `Value-${i}`;
      }

      const payload: QueueItemPayload = {
        url: 'https://api.example.com',
        headers
      };

      expect(Object.keys(payload.headers!)).toHaveLength(100);
      expect(payload.headers!['Header-50']).toBe('Value-50');
    });

    it('should handle various error scenarios', () => {
      const errorScenarios = [
        { message: 'Connection refused', code: 'ECONNREFUSED' },
        { message: 'Timeout', code: 'ETIMEDOUT' },
        { message: 'Bad request', code: '400' },
        { message: 'Internal server error', code: '500' },
        { message: 'Unknown error' }
      ];

      errorScenarios.forEach(error => {
        const item: QueueItem = {
          id: 'item-error',
          priority: 'normal',
          payload: { url: 'https://api.example.com' },
          attempts: 1,
          maxAttempts: 3,
          status: 'failed',
          createdAt: new Date(),
          error: error
        };

        expect(item.error).toEqual(error);
      });
    });
  });
});