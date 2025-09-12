/**
 * CQRS Queries for Image Generation
 * Queries represent requests for information without changing state
 */

export interface Query {
  queryId: string;
  timestamp: Date;
  userId?: string;
}

export interface GetImageGenerationStatusQuery extends Query {
  type: 'GetImageGenerationStatus';
  payload: {
    requestId: string;
  };
}

export interface GetQueuePositionQuery extends Query {
  type: 'GetQueuePosition';
  payload: {
    requestId: string;
  };
}

export interface GetUserGenerationsQuery extends Query {
  type: 'GetUserGenerations';
  payload: {
    userId: string;
    status?: string[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  };
}

export interface GetGenerationDetailsQuery extends Query {
  type: 'GetGenerationDetails';
  payload: {
    requestId: string;
  };
}

export interface GetQueueStatusQuery extends Query {
  type: 'GetQueueStatus';
  payload: {
    priority?: 'normal' | 'high' | 'low';
  };
}

export interface GetWorkerStatusQuery extends Query {
  type: 'GetWorkerStatus';
  payload: {
    workerId?: string;
  };
}

export interface GetGenerationHistoryQuery extends Query {
  type: 'GetGenerationHistory';
  payload: {
    aggregateId: string;
  };
}

export interface GetUserCreditsQuery extends Query {
  type: 'GetUserCredits';
  payload: {
    userId: string;
  };
}

export interface GetSystemMetricsQuery extends Query {
  type: 'GetSystemMetrics';
  payload: {
    fromDate?: Date;
    toDate?: Date;
    metrics?: string[];
  };
}

// Union type for all queries
export type ImageGenerationQuery =
  | GetImageGenerationStatusQuery
  | GetQueuePositionQuery
  | GetUserGenerationsQuery
  | GetGenerationDetailsQuery
  | GetQueueStatusQuery
  | GetWorkerStatusQuery
  | GetGenerationHistoryQuery
  | GetUserCreditsQuery
  | GetSystemMetricsQuery;

// Query result types
export interface ImageGenerationStatusResult {
  requestId: string;
  status: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  progressPercentage?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueuePositionResult {
  requestId: string;
  position: number;
  estimatedWaitTime: number;
  priority: string;
  aheadInQueue: number;
}

export interface UserGenerationResult {
  requestId: string;
  prompt: string;
  status: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  creditsUsed?: number;
}

export interface GenerationDetailsResult {
  requestId: string;
  aggregateId: string;
  userId: string;
  prompt: string;
  style?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  priority: string;
  status: string;
  queuePosition?: number;
  workerId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    sizeInBytes: number;
  };
  processingTime?: number;
  creditsUsed?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface QueueStatusResult {
  totalInQueue: number;
  byPriority: {
    high: number;
    normal: number;
    low: number;
  };
  estimatedWaitTime: {
    high: number;
    normal: number;
    low: number;
  };
  activeWorkers: number;
  averageProcessingTime: number;
}

export interface WorkerStatusResult {
  workerId: string;
  status: 'idle' | 'processing' | 'offline';
  currentJob?: string;
  jobsCompleted: number;
  averageProcessingTime: number;
  lastActivity: Date;
}

export interface UserCreditsResult {
  userId: string;
  availableCredits: number;
  usedCredits: number;
  pendingCredits: number;
  creditHistory: Array<{
    date: Date;
    amount: number;
    operation: 'purchase' | 'used' | 'refund';
    description: string;
  }>;
}

export interface SystemMetricsResult {
  period: {
    from: Date;
    to: Date;
  };
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  averageQueueTime: number;
  creditsConsumed: number;
  activeUsers: number;
  popularStyles: Array<{
    style: string;
    count: number;
  }>;
  errorRate: number;
  throughput: number;
}

// Query factory functions
export const createQuery = {
  getStatus: (requestId: string, userId?: string): GetImageGenerationStatusQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetImageGenerationStatus',
    payload: { requestId }
  }),
  
  getQueuePosition: (requestId: string, userId?: string): GetQueuePositionQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetQueuePosition',
    payload: { requestId }
  }),
  
  getUserGenerations: (
    userId: string,
    options?: {
      status?: string[];
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): GetUserGenerationsQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetUserGenerations',
    payload: { userId, ...options }
  }),
  
  getDetails: (requestId: string, userId?: string): GetGenerationDetailsQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetGenerationDetails',
    payload: { requestId }
  }),
  
  getQueueStatus: (priority?: 'normal' | 'high' | 'low'): GetQueueStatusQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    type: 'GetQueueStatus',
    payload: { priority }
  }),
  
  getWorkerStatus: (workerId?: string): GetWorkerStatusQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    type: 'GetWorkerStatus',
    payload: { workerId }
  }),
  
  getHistory: (aggregateId: string, userId?: string): GetGenerationHistoryQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetGenerationHistory',
    payload: { aggregateId }
  }),
  
  getUserCredits: (userId: string): GetUserCreditsQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    userId,
    type: 'GetUserCredits',
    payload: { userId }
  }),
  
  getSystemMetrics: (options?: {
    fromDate?: Date;
    toDate?: Date;
    metrics?: string[];
  }): GetSystemMetricsQuery => ({
    queryId: generateQueryId(),
    timestamp: new Date(),
    type: 'GetSystemMetrics',
    payload: options || {}
  })
};

function generateQueryId(): string {
  return `qry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}