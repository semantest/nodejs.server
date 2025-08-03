/**
 * Queue item entity for priority queue system
 */
export interface QueueItemPayload {
    url: string;
    headers?: Record<string, string>;
    metadata?: Record<string, any>;
    addon_id?: string;
    callback_url?: string;
    ai_tool?: {
        toolId: string;
        activationRequired: boolean;
        activationAttempts?: number;
        lastActivationError?: string;
    };
}
export type QueuePriority = 'high' | 'normal' | 'low';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
export interface QueueItem {
    id: string;
    priority: QueuePriority;
    payload: QueueItemPayload;
    attempts: number;
    maxAttempts: number;
    status: QueueStatus;
    createdAt: Date;
    lastAttemptAt?: Date;
    completedAt?: Date;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    result?: any;
    processingTime?: number;
    nextRetryAt?: Date;
}
export interface QueueMetrics {
    totalEnqueued: number;
    totalProcessed: number;
    totalFailed: number;
    totalInDLQ: number;
    avgProcessingTime: number;
    currentRate: number;
    queueSizes: {
        high: number;
        normal: number;
        low: number;
        processing: number;
        dlq: number;
    };
}
//# sourceMappingURL=queue-item.entity.d.ts.map