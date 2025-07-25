/**
 * Queue REST API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DownloadQueueManager, QueueConfig } from '../../application/services/download-queue-manager';
import { QueuePriority } from '../../domain/entities/queue-item.entity';
import { 
  rateLimiters, 
  validateEnqueue, 
  sanitizeInput,
  validateInput 
} from '../../../security/infrastructure/middleware/security.middleware';

// Initialize queue manager
const queueConfig: QueueConfig = {
  maxConcurrent: parseInt(process.env.QUEUE_MAX_CONCURRENT || '5'),
  rateLimit: parseInt(process.env.QUEUE_RATE_LIMIT || '10'),
  retryDelays: [1000, 5000, 15000],
  dlqThreshold: 3,
  processingTimeout: 30000
};

const queueManager = new DownloadQueueManager(queueConfig);

// Create router
export const queueRouter = Router();

/**
 * POST /queue/enqueue
 * Add item to download queue
 */
queueRouter.post('/queue/enqueue', 
  rateLimiters.enqueue,
  sanitizeInput,
  ...validateEnqueue,
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, priority = 'normal', headers, metadata, addon_id, callback_url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        timestamp: new Date().toISOString()
      });
    }

    const validPriorities: QueuePriority[] = ['high', 'normal', 'low'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Invalid priority. Must be: high, normal, or low',
        timestamp: new Date().toISOString()
      });
    }

    const item = await queueManager.enqueue({
      url,
      headers,
      metadata,
      addon_id,
      callback_url
    }, priority);

    res.status(201).json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/status
 * Get queue metrics and status
 */
queueRouter.get('/queue/status', (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = queueManager.getStatus();

    res.json({
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/item/:id
 * Get specific item status
 */
queueRouter.get('/queue/item/:id', 
  validateInput.id,
  (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const item = queueManager.getItemStatus(id);

    if (!item) {
      return res.status(404).json({
        error: 'Queue item not found',
        itemId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /queue/item/:id
 * Cancel a queued item
 */
queueRouter.delete('/queue/item/:id', 
  validateInput.id,
  (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cancelled = queueManager.cancel(id);

    if (!cancelled) {
      return res.status(400).json({
        error: 'Cannot cancel item. It may be processing or not found.',
        itemId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'Item cancelled successfully',
      itemId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/dlq
 * Get Dead Letter Queue items
 */
queueRouter.get('/queue/dlq', (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = queueManager.getDLQItems();

    res.json({
      items,
      count: items.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /queue/dlq/:id/retry
 * Retry item from DLQ
 */
queueRouter.post('/queue/dlq/:id/retry', 
  validateInput.id,
  rateLimiters.strict,
  (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const retried = queueManager.retryFromDLQ(id);

    if (!retried) {
      return res.status(404).json({
        error: 'Item not found in DLQ',
        itemId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'Item requeued from DLQ',
      itemId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /queue/dlq
 * Clear Dead Letter Queue
 */
queueRouter.delete('/queue/dlq', (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = queueManager.clearDLQ();

    res.json({
      message: 'DLQ cleared',
      itemsCleared: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /queue/process/:id/complete
 * Mark item processing as complete (for external processors)
 */
queueRouter.post('/queue/process/:id/complete', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    queueManager.completeProcessing(id, result);

    res.json({
      message: 'Processing completed',
      itemId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /queue/process/:id/fail
 * Mark item processing as failed (for external processors)
 */
queueRouter.post('/queue/process/:id/fail', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error: errorMessage } = req.body;

    queueManager.failProcessing(id, new Error(errorMessage || 'Processing failed'));

    res.json({
      message: 'Processing marked as failed',
      itemId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Export queue manager for integration
export { queueManager };