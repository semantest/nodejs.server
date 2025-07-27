/**
 * Tests for AI tool activation in queue system
 */

import { DownloadQueueManager } from '../application/services/download-queue-manager';
import { QueueItemPayload } from '../domain/entities/queue-item.entity';

describe('AI Tool Queue Integration', () => {
  let queueManager: DownloadQueueManager;

  beforeEach(() => {
    queueManager = new DownloadQueueManager({
      maxConcurrent: 0, // Manual processing for tests
      dlqThreshold: 3
    });
  });

  afterEach(() => {
    queueManager.removeAllListeners();
    // @ts-ignore
    if (queueManager['processingInterval']) {
      clearInterval(queueManager['processingInterval']);
    }
  });

  describe('AI tool activation tracking', () => {
    it('should enqueue items with AI tool requirements', async () => {
      // Arrange
      const payload: QueueItemPayload = {
        url: 'https://dalle.ai/generate',
        addon_id: 'chatgpt_addon',
        ai_tool: {
          toolId: 'dall-e',
          activationRequired: true,
          activationAttempts: 0
        }
      };

      // Act
      const item = await queueManager.enqueue(payload, 'high');

      // Assert
      expect(item.payload.ai_tool).toBeDefined();
      expect(item.payload.ai_tool?.toolId).toBe('dall-e');
      expect(item.payload.ai_tool?.activationRequired).toBe(true);
      expect(item.payload.ai_tool?.activationAttempts).toBe(0);
    });

    it('should track activation attempts in payload', async () => {
      // Arrange
      const payload: QueueItemPayload = {
        url: 'https://dalle.ai/generate',
        addon_id: 'chatgpt_addon',
        ai_tool: {
          toolId: 'dall-e',
          activationRequired: true,
          activationAttempts: 2,
          lastActivationError: 'ACTIVATION_TIMEOUT'
        }
      };

      // Act
      const item = await queueManager.enqueue(payload);

      // Assert
      expect(item.payload.ai_tool?.activationAttempts).toBe(2);
      expect(item.payload.ai_tool?.lastActivationError).toBe('ACTIVATION_TIMEOUT');
    });

    it('should prioritize AI tool items appropriately', async () => {
      // Arrange
      const aiToolItem: QueueItemPayload = {
        url: 'https://dalle.ai/urgent-generate',
        ai_tool: {
          toolId: 'dall-e',
          activationRequired: true
        }
      };

      const normalItem: QueueItemPayload = {
        url: 'https://example.com/image.jpg'
      };

      // Act
      const urgent = await queueManager.enqueue(aiToolItem, 'high');
      const normal = await queueManager.enqueue(normalItem, 'normal');

      const status = queueManager.getStatus();

      // Assert
      expect(status.queueSizes.high).toBe(1);
      expect(status.queueSizes.normal).toBe(1);
      expect(urgent.priority).toBe('high');
    });
  });

  describe('AI tool failure handling', () => {
    it('should handle AI tool activation failures', async () => {
      // Arrange
      const payload: QueueItemPayload = {
        url: 'https://dalle.ai/generate',
        ai_tool: {
          toolId: 'dall-e',
          activationRequired: true,
          activationAttempts: 3, // Already at max
          lastActivationError: 'ACTIVATION_TIMEOUT'
        }
      };

      // Act
      const item = await queueManager.enqueue(payload);
      
      // Simulate the item being processed with max attempts already reached
      // @ts-ignore - Accessing private property for testing
      item.attempts = 2; // Set to dlqThreshold - 1, so next failure will trigger DLQ
      queueManager.processing.set(item.id, item);

      // Simulate failure handling
      queueManager.failProcessing(item.id, new Error('Max activation attempts reached'));

      // Assert
      const status = queueManager.getStatus();
      expect(status.totalFailed).toBe(1);
      expect(status.totalInDLQ).toBe(1); // Should be in DLQ since attempts >= dlqThreshold
    });
  });
});