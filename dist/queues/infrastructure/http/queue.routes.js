"use strict";
/**
 * Queue REST API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueManager = exports.queueRouter = void 0;
const express_1 = require("express");
const download_queue_manager_1 = require("../../application/services/download-queue-manager");
const security_middleware_1 = require("../../../security/infrastructure/middleware/security.middleware");
// Initialize queue manager
const queueConfig = {
    maxConcurrent: parseInt(process.env.QUEUE_MAX_CONCURRENT || '5'),
    rateLimit: parseInt(process.env.QUEUE_RATE_LIMIT || '10'),
    retryDelays: [1000, 5000, 15000],
    dlqThreshold: 3,
    processingTimeout: 30000
};
const queueManager = new download_queue_manager_1.DownloadQueueManager(queueConfig);
exports.queueManager = queueManager;
// Create router
exports.queueRouter = (0, express_1.Router)();
/**
 * POST /queue/enqueue
 * Add item to download queue
 */
exports.queueRouter.post('/queue/enqueue', security_middleware_1.rateLimiters.enqueue, security_middleware_1.sanitizeInput, ...security_middleware_1.validateEnqueue, async (req, res, next) => {
    try {
        const { url, priority = 'normal', headers, metadata, addon_id, callback_url } = req.body;
        if (!url) {
            return res.status(400).json({
                error: 'URL is required',
                timestamp: new Date().toISOString()
            });
        }
        const validPriorities = ['high', 'normal', 'low'];
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /queue/status
 * Get queue metrics and status
 */
exports.queueRouter.get('/queue/status', (req, res, next) => {
    try {
        const status = queueManager.getStatus();
        res.json({
            status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /queue/item/:id
 * Get specific item status
 */
exports.queueRouter.get('/queue/item/:id', security_middleware_1.validateInput.id, (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /queue/item/:id
 * Cancel a queued item
 */
exports.queueRouter.delete('/queue/item/:id', security_middleware_1.validateInput.id, (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /queue/dlq
 * Get Dead Letter Queue items
 */
exports.queueRouter.get('/queue/dlq', (req, res, next) => {
    try {
        const items = queueManager.getDLQItems();
        res.json({
            items,
            count: items.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /queue/dlq/:id/retry
 * Retry item from DLQ
 */
exports.queueRouter.post('/queue/dlq/:id/retry', security_middleware_1.validateInput.id, security_middleware_1.rateLimiters.strict, (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /queue/dlq
 * Clear Dead Letter Queue
 */
exports.queueRouter.delete('/queue/dlq', (req, res, next) => {
    try {
        const count = queueManager.clearDLQ();
        res.json({
            message: 'DLQ cleared',
            itemsCleared: count,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /queue/process/:id/complete
 * Mark item processing as complete (for external processors)
 */
exports.queueRouter.post('/queue/process/:id/complete', (req, res, next) => {
    try {
        const { id } = req.params;
        const { result } = req.body;
        queueManager.completeProcessing(id, result);
        res.json({
            message: 'Processing completed',
            itemId: id,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /queue/process/:id/fail
 * Mark item processing as failed (for external processors)
 */
exports.queueRouter.post('/queue/process/:id/fail', (req, res, next) => {
    try {
        const { id } = req.params;
        const { error: errorMessage } = req.body;
        queueManager.failProcessing(id, new Error(errorMessage || 'Processing failed'));
        res.json({
            message: 'Processing marked as failed',
            itemId: id,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=queue.routes.js.map