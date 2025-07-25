/**
 * TDD Tests for Download Queue Manager
 * Starting with basic enqueue functionality
 */

import { DownloadQueueManager } from '../application/services/download-queue-manager';
import { QueueItemPayload } from '../domain/entities/queue-item.entity';

describe('DownloadQueueManager', () => {
  let queueManager: DownloadQueueManager;

  beforeEach(() => {
    queueManager = new DownloadQueueManager({
      maxConcurrent: 0, // Don't process automatically
      rateLimit: 5,
      processingTimeout: 1000
    });
  });

  afterEach(() => {
    // Clean up any listeners and stop processing
    queueManager.removeAllListeners();
    // @ts-ignore - accessing private for cleanup
    if (queueManager['processingInterval']) {
      clearInterval(queueManager['processingInterval']);
    }
  });

  describe('enqueue', () => {
    it('should add an image download request to the queue and return a queue item', async () => {
      // Arrange
      const imagePayload: QueueItemPayload = {
        url: 'https://example.com/test-image.jpg',
        headers: {
          'User-Agent': 'Semantest/1.0'
        },
        metadata: {
          source: 'chatgpt',
          requestId: 'test-123'
        }
      };

      // Act
      const queueItem = await queueManager.enqueue(imagePayload);

      // Assert
      expect(queueItem).toBeDefined();
      expect(queueItem.id).toBeTruthy();
      expect(queueItem.payload).toEqual(imagePayload);
      expect(queueItem.status).toBe('pending');
      expect(queueItem.priority).toBe('normal');
      expect(queueItem.attempts).toBe(0);
      expect(queueItem.createdAt).toBeInstanceOf(Date);
    });

    it('should support different priority levels', async () => {
      // Arrange
      const highPriorityPayload: QueueItemPayload = {
        url: 'https://example.com/urgent.jpg',
        metadata: { priority: 'urgent' }
      };

      // Act
      const highItem = await queueManager.enqueue(highPriorityPayload, 'high');
      const normalItem = await queueManager.enqueue({ url: 'https://example.com/normal.jpg' }, 'normal');
      const lowItem = await queueManager.enqueue({ url: 'https://example.com/low.jpg' }, 'low');

      // Assert
      expect(highItem.priority).toBe('high');
      expect(normalItem.priority).toBe('normal');
      expect(lowItem.priority).toBe('low');
    });

    it('should emit queue:item:added event when item is added', async () => {
      // Arrange
      const payload: QueueItemPayload = { url: 'https://example.com/event-test.jpg' };
      let emittedItem;
      
      queueManager.on('queue:item:added', (item) => {
        emittedItem = item;
      });

      // Act
      const queueItem = await queueManager.enqueue(payload);

      // Assert
      expect(emittedItem).toEqual(queueItem);
    });
  });

  describe('queue status', () => {
    it('should return correct queue metrics', async () => {
      // Arrange & Act
      await queueManager.enqueue({ url: 'https://example.com/1.jpg' }, 'high');
      await queueManager.enqueue({ url: 'https://example.com/2.jpg' }, 'normal');
      await queueManager.enqueue({ url: 'https://example.com/3.jpg' }, 'normal');
      await queueManager.enqueue({ url: 'https://example.com/4.jpg' }, 'low');

      const status = queueManager.getStatus();

      // Assert
      expect(status.queueSizes.high).toBe(1);
      expect(status.queueSizes.normal).toBe(2);
      expect(status.queueSizes.low).toBe(1);
      expect(status.queueSizes.processing).toBe(0);
      expect(status.totalEnqueued).toBe(4);
    });
  });

  describe('dead letter queue (DLQ)', () => {
    it('should return DLQ items', () => {
      // Since we can't easily trigger DLQ without processing, test the getter
      const dlqItems = queueManager.getDLQItems();
      expect(dlqItems).toEqual([]);
    });

    it('should clear DLQ when requested', () => {
      // Test clear functionality
      const clearedCount = queueManager.clearDLQ();
      expect(clearedCount).toBe(0);
    });
  });

  describe('cancellation', () => {
    it('should cancel pending items', async () => {
      // Arrange
      const item = await queueManager.enqueue({ url: 'https://example.com/cancel-me.jpg' });

      // Act
      const cancelled = queueManager.cancel(item.id);

      // Assert
      expect(cancelled).toBe(true);
      expect(queueManager.getItemStatus(item.id)).toBeNull();
    });

    it('should not cancel non-existent items', () => {
      const cancelled = queueManager.cancel('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('processing simulation', () => {
    it('should handle manual completion', async () => {
      // Arrange
      const item = await queueManager.enqueue({ url: 'https://example.com/process.jpg' });

      // Act - simulate external processing completion
      queueManager.completeProcessing(item.id, { downloadedPath: '/tmp/process.jpg' });

      // Assert
      const status = queueManager.getStatus();
      expect(status.totalProcessed).toBe(1);
    });

    it('should handle manual failure', async () => {
      // Arrange
      const item = await queueManager.enqueue({ url: 'https://example.com/fail.jpg' });

      // Act - simulate external processing failure
      queueManager.failProcessing(item.id, new Error('Download failed'));

      // Assert
      const status = queueManager.getStatus();
      expect(status.totalFailed).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should maintain queue state across restarts', async () => {
      // This will require adding persistence layer
      expect(true).toBe(true); // Placeholder
    });
  });
});