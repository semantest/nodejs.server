export interface ImageGenerationProjection {
  aggregateId: string;
  requestId: string;
  userId: string;
  prompt: string;
  status: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  priority?: string;
  processId?: string;
  workerId?: string;
  imageUrl?: string;
  metadata?: {
    size: number;
    format: string;
    dimensions: { width: number; height: number };
    processingTime: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
}

export interface QueueStatusProjection {
  totalInQueue: number;
  processing: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  workersAvailable: number;
  estimatedTimeForNext: number;
}

export interface UserImageGenerationsProjection {
  userId: string;
  totalGenerations: number;
  completedGenerations: number;
  failedGenerations: number;
  inProgressGenerations: number;
  generations: ImageGenerationProjection[];
}