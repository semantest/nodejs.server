"use strict";
/**
 * Download Queue Manager with priority handling, retry logic, and DLQ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadQueueManager = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
class DownloadQueueManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.queues = {
            high: [],
            normal: [],
            low: []
        };
        this.processing = new Map();
        this.dlq = []; // Dead Letter Queue
        this.isProcessing = false;
        this.config = {
            maxConcurrent: 5,
            rateLimit: 10,
            retryDelays: [1000, 5000, 15000], // 1s, 5s, 15s
            dlqThreshold: 3,
            processingTimeout: 30000,
            ...config
        };
        this.metrics = {
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
        this.rateLimiter = {
            tokens: this.config.rateLimit,
            lastRefill: Date.now()
        };
        // Start processing loop
        this.startProcessingLoop();
    }
    /**
     * Get current total queue size including processing items
     */
    getTotalQueueSize() {
        return this.queues.high.length +
            this.queues.normal.length +
            this.queues.low.length +
            this.processing.size;
    }
    /**
     * Check if queue has capacity for new items
     */
    checkQueueCapacity() {
        if (!this.config.maxQueueSize)
            return;
        const currentSize = this.getTotalQueueSize();
        if (currentSize >= this.config.maxQueueSize) {
            throw new Error(`Queue is at capacity (${this.config.maxQueueSize} items). Cannot accept new items.`);
        }
        // Emit event when reaching capacity
        if (currentSize + 1 === this.config.maxQueueSize) {
            this.emit('queue:capacity:reached', {
                currentSize: currentSize + 1,
                maxSize: this.config.maxQueueSize
            });
        }
    }
    /**
     * Enqueue a new download request
     */
    async enqueue(payload, priority = 'normal') {
        // Check queue capacity if configured
        this.checkQueueCapacity();
        const item = {
            id: (0, uuid_1.v4)(),
            priority,
            payload,
            attempts: 0,
            maxAttempts: this.config.dlqThreshold,
            status: 'pending',
            createdAt: new Date()
        };
        this.queues[priority].push(item);
        this.metrics.totalEnqueued++;
        this.updateQueueSizes();
        this.emit('queue:item:added', item);
        // Only process next if we have capacity
        if (this.config.maxConcurrent > 0) {
            this.processNext();
        }
        return item;
    }
    /**
     * Get queue status
     */
    getStatus() {
        this.updateQueueSizes();
        return { ...this.metrics };
    }
    /**
     * Get specific item status
     */
    getItemStatus(id) {
        // Check processing
        if (this.processing.has(id)) {
            return this.processing.get(id);
        }
        // Check queues
        for (const priority of ['high', 'normal', 'low']) {
            const item = this.queues[priority].find(i => i.id === id);
            if (item)
                return item;
        }
        // Check DLQ
        const dlqItem = this.dlq.find(i => i.id === id);
        if (dlqItem)
            return dlqItem;
        return null;
    }
    /**
     * Cancel a queued item
     */
    cancel(id) {
        // Check if processing
        if (this.processing.has(id)) {
            return false; // Cannot cancel items being processed
        }
        // Remove from queues
        for (const priority of ['high', 'normal', 'low']) {
            const index = this.queues[priority].findIndex(i => i.id === id);
            if (index !== -1) {
                this.queues[priority].splice(index, 1);
                this.emit('queue:item:cancelled', id);
                return true;
            }
        }
        return false;
    }
    /**
     * Process next item from queue
     */
    async processNext() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            while (this.processing.size < this.config.maxConcurrent) {
                // Check rate limit
                if (!this.checkRateLimit()) {
                    await this.sleep(100);
                    continue;
                }
                // Get next item
                const item = this.getNextItem();
                if (!item)
                    break;
                // Process item
                this.processItem(item);
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Get next item based on priority
     */
    getNextItem() {
        // Check items that need retry
        const now = Date.now();
        for (const priority of ['high', 'normal', 'low']) {
            const retryIndex = this.queues[priority].findIndex(item => item.nextRetryAt && item.nextRetryAt.getTime() <= now);
            if (retryIndex !== -1) {
                return this.queues[priority].splice(retryIndex, 1)[0];
            }
        }
        // Get next item by priority
        for (const priority of ['high', 'normal', 'low']) {
            if (this.queues[priority].length > 0) {
                return this.queues[priority].shift();
            }
        }
        return null;
    }
    /**
     * Process a single item
     */
    async processItem(item) {
        item.status = 'processing';
        item.lastAttemptAt = new Date();
        item.attempts++;
        this.processing.set(item.id, item);
        this.emit('queue:item:processing', item);
        const startTime = Date.now();
        try {
            // Emit for actual processing (handled by external processor)
            const result = await this.waitForProcessing(item);
            item.status = 'completed';
            item.completedAt = new Date();
            item.result = result;
            item.processingTime = Date.now() - startTime;
            this.metrics.totalProcessed++;
            this.updateAvgProcessingTime(item.processingTime);
            this.emit('queue:item:completed', item);
        }
        catch (error) {
            item.error = {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: error.code,
                stack: error instanceof Error ? error.stack : undefined
            };
            if (item.attempts >= item.maxAttempts) {
                // Move to DLQ
                item.status = 'dead';
                this.dlq.push(item);
                this.metrics.totalInDLQ++;
                this.emit('queue:item:dlq', item);
            }
            else {
                // Retry with backoff
                item.status = 'pending';
                item.nextRetryAt = new Date(Date.now() + this.config.retryDelays[item.attempts - 1] || 30000);
                this.queues[item.priority].push(item);
                this.emit('queue:item:retry', item);
            }
            this.metrics.totalFailed++;
        }
        finally {
            this.processing.delete(item.id);
            this.updateQueueSizes();
            this.processNext();
        }
    }
    /**
     * Wait for external processor to handle the item
     */
    waitForProcessing(item) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.removeAllListeners(`process:${item.id}:complete`);
                this.removeAllListeners(`process:${item.id}:error`);
                reject(new Error('Processing timeout'));
            }, this.config.processingTimeout);
            this.once(`process:${item.id}:complete`, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });
            this.once(`process:${item.id}:error`, (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            // Emit event for external processor
            this.emit('queue:process', item);
        });
    }
    /**
     * Complete processing of an item (called by external processor)
     */
    completeProcessing(id, result) {
        this.emit(`process:${id}:complete`, result);
    }
    /**
     * Fail processing of an item (called by external processor)
     */
    failProcessing(id, error) {
        const item = this.processing.get(id);
        if (item) {
            // Update metrics
            this.metrics.totalFailed++;
            // Handle retry or DLQ logic
            item.attempts++;
            if (item.attempts >= this.config.dlqThreshold) {
                // Move to DLQ
                item.status = 'dead';
                this.dlq.push(item);
                this.metrics.totalInDLQ++;
                this.emit('queue:item:dlq', item);
            }
            else {
                // Retry with backoff
                item.status = 'pending';
                item.nextRetryAt = new Date(Date.now() + this.config.retryDelays[item.attempts - 1] || 30000);
                this.queues[item.priority].push(item);
                this.emit('queue:item:retry', item);
            }
            // Remove from processing
            this.processing.delete(id);
            this.updateQueueSizes();
        }
        this.emit(`process:${id}:error`, error);
    }
    /**
     * Rate limiting check
     */
    checkRateLimit() {
        const now = Date.now();
        const elapsed = now - this.rateLimiter.lastRefill;
        const tokensToAdd = Math.floor(elapsed * this.config.rateLimit / 1000);
        if (tokensToAdd > 0) {
            this.rateLimiter.tokens = Math.min(this.config.rateLimit, this.rateLimiter.tokens + tokensToAdd);
            this.rateLimiter.lastRefill = now;
        }
        if (this.rateLimiter.tokens > 0) {
            this.rateLimiter.tokens--;
            return true;
        }
        return false;
    }
    /**
     * Update queue sizes in metrics
     */
    updateQueueSizes() {
        this.metrics.queueSizes = {
            high: this.queues.high.length,
            normal: this.queues.normal.length,
            low: this.queues.low.length,
            processing: this.processing.size,
            dlq: this.dlq.length
        };
    }
    /**
     * Update average processing time
     */
    updateAvgProcessingTime(newTime) {
        const total = this.metrics.avgProcessingTime * (this.metrics.totalProcessed - 1) + newTime;
        this.metrics.avgProcessingTime = total / this.metrics.totalProcessed;
    }
    /**
     * Start continuous processing loop
     */
    startProcessingLoop() {
        this.processingInterval = setInterval(() => {
            this.processNext();
        }, 1000);
        // Update current rate metric
        this.rateInterval = setInterval(() => {
            const processed = this.metrics.totalProcessed;
            setTimeout(() => {
                this.metrics.currentRate = this.metrics.totalProcessed - processed;
            }, 1000);
        }, 1000);
    }
    /**
     * Get items from DLQ
     */
    getDLQItems() {
        return [...this.dlq];
    }
    /**
     * Retry item from DLQ
     */
    retryFromDLQ(id) {
        const index = this.dlq.findIndex(item => item.id === id);
        if (index === -1)
            return false;
        const item = this.dlq.splice(index, 1)[0];
        item.status = 'pending';
        item.attempts = 0;
        item.error = undefined;
        this.queues[item.priority].push(item);
        this.metrics.totalInDLQ--;
        this.emit('queue:item:dlq:retry', item);
        this.processNext();
        return true;
    }
    /**
     * Clear DLQ
     */
    clearDLQ() {
        const count = this.dlq.length;
        this.dlq = [];
        this.metrics.totalInDLQ = 0;
        return count;
    }
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Stop processing (for testing)
     */
    stopProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }
        if (this.rateInterval) {
            clearInterval(this.rateInterval);
            this.rateInterval = undefined;
        }
    }
}
exports.DownloadQueueManager = DownloadQueueManager;
//# sourceMappingURL=download-queue-manager.js.map