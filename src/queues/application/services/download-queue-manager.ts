/**
 * Download Queue Manager with priority handling, retry logic, and DLQ
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { QueueItem, QueuePriority, QueueStatus, QueueItemPayload, QueueMetrics } from '../../domain/entities/queue-item.entity';

export interface QueueConfig {
  maxConcurrent: number;
  rateLimit: number; // requests per second
  retryDelays: number[]; // delays in ms for each retry attempt
  dlqThreshold: number; // max attempts before DLQ
  processingTimeout: number; // timeout for processing in ms
}

export class DownloadQueueManager extends EventEmitter {
  private queues = {
    high: [] as QueueItem[],
    normal: [] as QueueItem[],
    low: [] as QueueItem[]
  };
  
  private processing = new Map<string, QueueItem>();
  private dlq: QueueItem[] = []; // Dead Letter Queue
  private config: QueueConfig;
  private isProcessing = false;
  private metrics: QueueMetrics;
  private rateLimiter: { tokens: number; lastRefill: number };
  private processingInterval?: NodeJS.Timeout;
  private rateInterval?: NodeJS.Timeout;

  constructor(config?: Partial<QueueConfig>) {
    super();
    
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
   * Enqueue a new download request
   */
  async enqueue(payload: QueueItemPayload, priority: QueuePriority = 'normal'): Promise<QueueItem> {
    const item: QueueItem = {
      id: uuidv4(),
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
  getStatus(): QueueMetrics {
    this.updateQueueSizes();
    return { ...this.metrics };
  }

  /**
   * Get specific item status
   */
  getItemStatus(id: string): QueueItem | null {
    // Check processing
    if (this.processing.has(id)) {
      return this.processing.get(id)!;
    }

    // Check queues
    for (const priority of ['high', 'normal', 'low'] as QueuePriority[]) {
      const item = this.queues[priority].find(i => i.id === id);
      if (item) return item;
    }

    // Check DLQ
    const dlqItem = this.dlq.find(i => i.id === id);
    if (dlqItem) return dlqItem;

    return null;
  }

  /**
   * Cancel a queued item
   */
  cancel(id: string): boolean {
    // Check if processing
    if (this.processing.has(id)) {
      return false; // Cannot cancel items being processed
    }

    // Remove from queues
    for (const priority of ['high', 'normal', 'low'] as QueuePriority[]) {
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
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
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
        if (!item) break;

        // Process item
        this.processItem(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get next item based on priority
   */
  private getNextItem(): QueueItem | null {
    // Check items that need retry
    const now = Date.now();
    for (const priority of ['high', 'normal', 'low'] as QueuePriority[]) {
      const retryIndex = this.queues[priority].findIndex(
        item => item.nextRetryAt && item.nextRetryAt.getTime() <= now
      );
      if (retryIndex !== -1) {
        return this.queues[priority].splice(retryIndex, 1)[0];
      }
    }

    // Get next item by priority
    for (const priority of ['high', 'normal', 'low'] as QueuePriority[]) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority].shift()!;
      }
    }

    return null;
  }

  /**
   * Process a single item
   */
  private async processItem(item: QueueItem): Promise<void> {
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
    } catch (error) {
      item.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
        stack: error instanceof Error ? error.stack : undefined
      };

      if (item.attempts >= item.maxAttempts) {
        // Move to DLQ
        item.status = 'dead';
        this.dlq.push(item);
        this.metrics.totalInDLQ++;
        this.emit('queue:item:dlq', item);
      } else {
        // Retry with backoff
        item.status = 'pending';
        item.nextRetryAt = new Date(
          Date.now() + this.config.retryDelays[item.attempts - 1] || 30000
        );
        this.queues[item.priority].push(item);
        this.emit('queue:item:retry', item);
      }

      this.metrics.totalFailed++;
    } finally {
      this.processing.delete(item.id);
      this.updateQueueSizes();
      this.processNext();
    }
  }

  /**
   * Wait for external processor to handle the item
   */
  private waitForProcessing(item: QueueItem): Promise<any> {
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
  completeProcessing(id: string, result: any): void {
    this.emit(`process:${id}:complete`, result);
  }

  /**
   * Fail processing of an item (called by external processor)
   */
  failProcessing(id: string, error: Error): void {
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
      } else {
        // Retry with backoff
        item.status = 'pending';
        item.nextRetryAt = new Date(
          Date.now() + this.config.retryDelays[item.attempts - 1] || 30000
        );
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
  private checkRateLimit(): boolean {
    const now = Date.now();
    const elapsed = now - this.rateLimiter.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.config.rateLimit / 1000);

    if (tokensToAdd > 0) {
      this.rateLimiter.tokens = Math.min(
        this.config.rateLimit,
        this.rateLimiter.tokens + tokensToAdd
      );
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
  private updateQueueSizes(): void {
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
  private updateAvgProcessingTime(newTime: number): void {
    const total = this.metrics.avgProcessingTime * (this.metrics.totalProcessed - 1) + newTime;
    this.metrics.avgProcessingTime = total / this.metrics.totalProcessed;
  }

  /**
   * Start continuous processing loop
   */
  private startProcessingLoop(): void {
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
  getDLQItems(): QueueItem[] {
    return [...this.dlq];
  }

  /**
   * Retry item from DLQ
   */
  retryFromDLQ(id: string): boolean {
    const index = this.dlq.findIndex(item => item.id === id);
    if (index === -1) return false;

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
  clearDLQ(): number {
    const count = this.dlq.length;
    this.dlq = [];
    this.metrics.totalInDLQ = 0;
    return count;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop processing (for testing)
   */
  stopProcessing(): void {
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