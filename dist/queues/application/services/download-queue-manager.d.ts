/**
 * Download Queue Manager with priority handling, retry logic, and DLQ
 */
import { EventEmitter } from 'events';
import { QueueItem, QueuePriority, QueueItemPayload, QueueMetrics } from '../../domain/entities/queue-item.entity';
export interface QueueConfig {
    maxConcurrent: number;
    rateLimit: number;
    retryDelays: number[];
    dlqThreshold: number;
    processingTimeout: number;
    maxQueueSize?: number;
}
export declare class DownloadQueueManager extends EventEmitter {
    private queues;
    private processing;
    private dlq;
    private config;
    private isProcessing;
    private metrics;
    private rateLimiter;
    private processingInterval?;
    private rateInterval?;
    constructor(config?: Partial<QueueConfig>);
    /**
     * Get current total queue size including processing items
     */
    private getTotalQueueSize;
    /**
     * Check if queue has capacity for new items
     */
    private checkQueueCapacity;
    /**
     * Enqueue a new download request
     */
    enqueue(payload: QueueItemPayload, priority?: QueuePriority): Promise<QueueItem>;
    /**
     * Get queue status
     */
    getStatus(): QueueMetrics;
    /**
     * Get specific item status
     */
    getItemStatus(id: string): QueueItem | null;
    /**
     * Cancel a queued item
     */
    cancel(id: string): boolean;
    /**
     * Process next item from queue
     */
    private processNext;
    /**
     * Get next item based on priority
     */
    private getNextItem;
    /**
     * Process a single item
     */
    private processItem;
    /**
     * Wait for external processor to handle the item
     */
    private waitForProcessing;
    /**
     * Complete processing of an item (called by external processor)
     */
    completeProcessing(id: string, result: any): void;
    /**
     * Fail processing of an item (called by external processor)
     */
    failProcessing(id: string, error: Error): void;
    /**
     * Rate limiting check
     */
    private checkRateLimit;
    /**
     * Update queue sizes in metrics
     */
    private updateQueueSizes;
    /**
     * Update average processing time
     */
    private updateAvgProcessingTime;
    /**
     * Start continuous processing loop
     */
    private startProcessingLoop;
    /**
     * Get items from DLQ
     */
    getDLQItems(): QueueItem[];
    /**
     * Retry item from DLQ
     */
    retryFromDLQ(id: string): boolean;
    /**
     * Clear DLQ
     */
    clearDLQ(): number;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Stop processing (for testing)
     */
    stopProcessing(): void;
}
//# sourceMappingURL=download-queue-manager.d.ts.map