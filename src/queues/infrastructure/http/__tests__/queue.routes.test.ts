/**
 * 🧪 Tests for Queue Routes
 * Testing REST API endpoints for queue management
 */

import { Request, Response, NextFunction } from 'express';
import { queueRouter, queueManager } from '../queue.routes';
import { DownloadQueueManager } from '../../../application/services/download-queue-manager';
import { QueueItem } from '../../../domain/entities/queue-item.entity';

// Mock dependencies
jest.mock('../../../application/services/download-queue-manager');
jest.mock('../../../security/infrastructure/middleware/security.middleware', () => ({
  rateLimiters: {
    enqueue: jest.fn((req: any, res: any, next: any) => next()),
    strict: jest.fn((req: any, res: any, next: any) => next())
  },
  validateEnqueue: [jest.fn((req: any, res: any, next: any) => next())],
  sanitizeInput: jest.fn((req: any, res: any, next: any) => next()),
  validateInput: {
    id: jest.fn((req: any, res: any, next: any) => next())
  }
}));

// Helper to extract route handlers
function getRouteHandler(path: string, method: string = 'get', middlewareIndex: number = -1) {
  const route = queueRouter.stack.find((layer: any) => {
    return layer.route && layer.route.path === path && layer.route.methods[method];
  });
  
  if (!route) return null;
  
  const handlers = route.route.stack
    .filter((s: any) => s.method === method)
    .map((s: any) => s.handle);
  
  // Return the last handler (main handler) by default
  return handlers[middlewareIndex] || handlers[handlers.length - 1];
}

describe('Queue Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockQueueManager: jest.Mocked<DownloadQueueManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockNext = jest.fn();
    
    mockReq = {
      params: {},
      body: {},
      query: {}
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock
    };

    // Get mocked instance
    mockQueueManager = queueManager as jest.Mocked<DownloadQueueManager>;
  });

  describe('POST /queue/enqueue', () => {
    it('should enqueue new item with default priority', async () => {
      const mockItem: Partial<QueueItem> = {
        id: 'queue-123',
        url: 'https://example.com/file.pdf',
        priority: 'normal',
        status: 'waiting',
        created_at: new Date()
      };
      
      mockReq.body = { url: 'https://example.com/file.pdf' };
      mockQueueManager.enqueue.mockResolvedValue(mockItem as QueueItem);
      
      const handler = getRouteHandler('/queue/enqueue', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.enqueue).toHaveBeenCalledWith({
        url: 'https://example.com/file.pdf',
        headers: undefined,
        metadata: undefined,
        addon_id: undefined,
        callback_url: undefined
      }, 'normal');
      
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        item: mockItem,
        timestamp: expect.any(String)
      });
    });

    it('should enqueue item with all parameters', async () => {
      const mockItem: Partial<QueueItem> = {
        id: 'queue-456',
        url: 'https://example.com/document.pdf',
        priority: 'high',
        status: 'waiting',
        headers: { 'Authorization': 'Bearer token' },
        metadata: { type: 'document' },
        addon_id: 'addon-123',
        callback_url: 'https://webhook.example.com',
        created_at: new Date()
      };
      
      mockReq.body = {
        url: 'https://example.com/document.pdf',
        priority: 'high',
        headers: { 'Authorization': 'Bearer token' },
        metadata: { type: 'document' },
        addon_id: 'addon-123',
        callback_url: 'https://webhook.example.com'
      };
      
      mockQueueManager.enqueue.mockResolvedValue(mockItem as QueueItem);
      
      const handler = getRouteHandler('/queue/enqueue', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.enqueue).toHaveBeenCalledWith({
        url: 'https://example.com/document.pdf',
        headers: { 'Authorization': 'Bearer token' },
        metadata: { type: 'document' },
        addon_id: 'addon-123',
        callback_url: 'https://webhook.example.com'
      }, 'high');
    });

    it('should return 400 if URL is missing', async () => {
      mockReq.body = { priority: 'high' };
      
      const handler = getRouteHandler('/queue/enqueue', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'URL is required',
        timestamp: expect.any(String)
      });
      expect(mockQueueManager.enqueue).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid priority', async () => {
      mockReq.body = {
        url: 'https://example.com/file.pdf',
        priority: 'urgent' // Invalid
      };
      
      const handler = getRouteHandler('/queue/enqueue', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid priority. Must be: high, normal, or low',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      mockReq.body = { url: 'https://example.com/file.pdf' };
      const error = new Error('Queue full');
      mockQueueManager.enqueue.mockRejectedValue(error);
      
      const handler = getRouteHandler('/queue/enqueue', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /queue/status', () => {
    it('should return queue status', () => {
      const mockStatus = {
        queueSizes: {
          waiting: 10,
          processing: 3,
          dlq: 2
        },
        jobStats: {
          completed: 150,
          failed: 5,
          active: 3
        },
        performance: {
          avgProcessingTime: 5000,
          successRate: 0.97
        }
      };
      
      mockQueueManager.getStatus.mockReturnValue(mockStatus);
      
      const handler = getRouteHandler('/queue/status');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        status: mockStatus,
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', () => {
      const error = new Error('Status unavailable');
      mockQueueManager.getStatus.mockImplementation(() => {
        throw error;
      });
      
      const handler = getRouteHandler('/queue/status');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /queue/item/:id', () => {
    it('should return item status', () => {
      const mockItem: Partial<QueueItem> = {
        id: 'item-123',
        url: 'https://example.com/file.pdf',
        status: 'processing',
        priority: 'normal',
        created_at: new Date(),
        started_at: new Date()
      };
      
      mockReq.params = { id: 'item-123' };
      mockQueueManager.getItemStatus.mockReturnValue(mockItem as QueueItem);
      
      const handler = getRouteHandler('/queue/item/:id');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.getItemStatus).toHaveBeenCalledWith('item-123');
      expect(jsonMock).toHaveBeenCalledWith({
        item: mockItem,
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent item', () => {
      mockReq.params = { id: 'non-existent' };
      mockQueueManager.getItemStatus.mockReturnValue(null);
      
      const handler = getRouteHandler('/queue/item/:id');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Queue item not found',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('DELETE /queue/item/:id', () => {
    it('should cancel queued item', () => {
      mockReq.params = { id: 'item-123' };
      mockQueueManager.cancel.mockReturnValue(true);
      
      const handler = getRouteHandler('/queue/item/:id', 'delete');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.cancel).toHaveBeenCalledWith('item-123');
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Item cancelled successfully',
        itemId: 'item-123',
        timestamp: expect.any(String)
      });
    });

    it('should return 400 if item cannot be cancelled', () => {
      mockReq.params = { id: 'item-123' };
      mockQueueManager.cancel.mockReturnValue(false);
      
      const handler = getRouteHandler('/queue/item/:id', 'delete');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Cannot cancel item. It may be processing or not found.',
        itemId: 'item-123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /queue/dlq', () => {
    it('should return DLQ items', () => {
      const mockDLQItems: Partial<QueueItem>[] = [
        {
          id: 'dlq-1',
          url: 'https://example.com/failed1.pdf',
          status: 'failed',
          error: 'Download failed',
          retry_count: 3
        },
        {
          id: 'dlq-2',
          url: 'https://example.com/failed2.pdf',
          status: 'failed',
          error: 'Timeout',
          retry_count: 3
        }
      ];
      
      mockQueueManager.getDLQItems.mockReturnValue(mockDLQItems as QueueItem[]);
      
      const handler = getRouteHandler('/queue/dlq');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        items: mockDLQItems,
        count: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle empty DLQ', () => {
      mockQueueManager.getDLQItems.mockReturnValue([]);
      
      const handler = getRouteHandler('/queue/dlq');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        items: [],
        count: 0,
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /queue/dlq/:id/retry', () => {
    it('should retry item from DLQ', () => {
      mockReq.params = { id: 'dlq-item-123' };
      mockQueueManager.retryFromDLQ.mockReturnValue(true);
      
      const handler = getRouteHandler('/queue/dlq/:id/retry', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.retryFromDLQ).toHaveBeenCalledWith('dlq-item-123');
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Item requeued from DLQ',
        itemId: 'dlq-item-123',
        timestamp: expect.any(String)
      });
    });

    it('should return 404 if item not in DLQ', () => {
      mockReq.params = { id: 'non-existent' };
      mockQueueManager.retryFromDLQ.mockReturnValue(false);
      
      const handler = getRouteHandler('/queue/dlq/:id/retry', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Item not found in DLQ',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('DELETE /queue/dlq', () => {
    it('should clear DLQ', () => {
      mockQueueManager.clearDLQ.mockReturnValue(5);
      
      const handler = getRouteHandler('/queue/dlq', 'delete');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.clearDLQ).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'DLQ cleared',
        itemsCleared: 5,
        timestamp: expect.any(String)
      });
    });

    it('should handle empty DLQ', () => {
      mockQueueManager.clearDLQ.mockReturnValue(0);
      
      const handler = getRouteHandler('/queue/dlq', 'delete');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'DLQ cleared',
        itemsCleared: 0,
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /queue/process/:id/complete', () => {
    it('should mark item as complete', () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = { result: { fileSize: 1024, downloadTime: 5000 } };
      
      const handler = getRouteHandler('/queue/process/:id/complete', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.completeProcessing).toHaveBeenCalledWith(
        'item-123',
        { fileSize: 1024, downloadTime: 5000 }
      );
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Processing completed',
        itemId: 'item-123',
        timestamp: expect.any(String)
      });
    });

    it('should handle completion without result', () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = {};
      
      const handler = getRouteHandler('/queue/process/:id/complete', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.completeProcessing).toHaveBeenCalledWith(
        'item-123',
        undefined
      );
    });
  });

  describe('POST /queue/process/:id/fail', () => {
    it('should mark item as failed', () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = { error: 'Download timeout' };
      
      const handler = getRouteHandler('/queue/process/:id/fail', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.failProcessing).toHaveBeenCalledWith(
        'item-123',
        new Error('Download timeout')
      );
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Processing marked as failed',
        itemId: 'item-123',
        timestamp: expect.any(String)
      });
    });

    it('should handle failure without error message', () => {
      mockReq.params = { id: 'item-123' };
      mockReq.body = {};
      
      const handler = getRouteHandler('/queue/process/:id/fail', 'post');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockQueueManager.failProcessing).toHaveBeenCalledWith(
        'item-123',
        new Error('Processing failed')
      );
    });
  });

  describe('Error Handling', () => {
    it('should pass errors to error handler', () => {
      const error = new Error('Unexpected error');
      mockQueueManager.getStatus.mockImplementation(() => {
        throw error;
      });
      
      const handler = getRouteHandler('/queue/status');
      handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});