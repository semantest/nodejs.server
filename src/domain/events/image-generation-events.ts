/**
 * Domain Events for Image Generation
 * Following Event Sourcing principles - events are immutable facts that have happened
 */

export interface DomainEvent {
  aggregateId: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  metadata?: Record<string, any>;
}

export interface ImageGenerationRequested extends DomainEvent {
  eventType: 'ImageGenerationRequested';
  payload: {
    userId: string;
    prompt: string;
    style?: string;
    dimensions?: {
      width: number;
      height: number;
    };
    priority?: 'normal' | 'high' | 'low';
    requestId: string;
  };
}

export interface ImageGenerationValidated extends DomainEvent {
  eventType: 'ImageGenerationValidated';
  payload: {
    requestId: string;
    validationResult: 'valid' | 'invalid';
    validationErrors?: string[];
    estimatedCredits?: number;
  };
}

export interface ImageGenerationQueued extends DomainEvent {
  eventType: 'ImageGenerationQueued';
  payload: {
    requestId: string;
    queuePosition: number;
    estimatedWaitTime: number; // in seconds
    priority: 'normal' | 'high' | 'low';
  };
}

export interface ImageGenerationStarted extends DomainEvent {
  eventType: 'ImageGenerationStarted';
  payload: {
    requestId: string;
    workerId: string;
    startedAt: Date;
    estimatedCompletionTime: number; // in seconds
  };
}

export interface ImageGenerationProgress extends DomainEvent {
  eventType: 'ImageGenerationProgress';
  payload: {
    requestId: string;
    progressPercentage: number;
    currentStep?: string;
    remainingTime?: number; // in seconds
  };
}

export interface ImageGenerationCompleted extends DomainEvent {
  eventType: 'ImageGenerationCompleted';
  payload: {
    requestId: string;
    imageUrl: string;
    thumbnailUrl?: string;
    metadata: {
      width: number;
      height: number;
      format: string;
      sizeInBytes: number;
    };
    processingTime: number; // in milliseconds
    creditsUsed: number;
  };
}

export interface ImageGenerationFailed extends DomainEvent {
  eventType: 'ImageGenerationFailed';
  payload: {
    requestId: string;
    errorCode: string;
    errorMessage: string;
    canRetry: boolean;
    refundCredits?: boolean;
  };
}

export interface ImageGenerationCancelled extends DomainEvent {
  eventType: 'ImageGenerationCancelled';
  payload: {
    requestId: string;
    cancelledBy: string;
    reason?: string;
    refundCredits: boolean;
  };
}

export interface ImageGenerationRetried extends DomainEvent {
  eventType: 'ImageGenerationRetried';
  payload: {
    requestId: string;
    originalRequestId: string;
    retryAttempt: number;
    maxRetries: number;
  };
}

// Union type for all image generation events
export type ImageGenerationEvent = 
  | ImageGenerationRequested
  | ImageGenerationValidated
  | ImageGenerationQueued
  | ImageGenerationStarted
  | ImageGenerationProgress
  | ImageGenerationCompleted
  | ImageGenerationFailed
  | ImageGenerationCancelled
  | ImageGenerationRetried;

// Event factory functions for type safety
export const createImageGenerationEvent = {
  requested: (aggregateId: string, payload: ImageGenerationRequested['payload']): ImageGenerationRequested => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationRequested',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  validated: (aggregateId: string, payload: ImageGenerationValidated['payload']): ImageGenerationValidated => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationValidated',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  queued: (aggregateId: string, payload: ImageGenerationQueued['payload']): ImageGenerationQueued => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationQueued',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  started: (aggregateId: string, payload: ImageGenerationStarted['payload']): ImageGenerationStarted => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationStarted',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  progress: (aggregateId: string, payload: ImageGenerationProgress['payload']): ImageGenerationProgress => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationProgress',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  completed: (aggregateId: string, payload: ImageGenerationCompleted['payload']): ImageGenerationCompleted => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationCompleted',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  failed: (aggregateId: string, payload: ImageGenerationFailed['payload']): ImageGenerationFailed => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationFailed',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  cancelled: (aggregateId: string, payload: ImageGenerationCancelled['payload']): ImageGenerationCancelled => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationCancelled',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  }),
  
  retried: (aggregateId: string, payload: ImageGenerationRetried['payload']): ImageGenerationRetried => ({
    aggregateId,
    eventId: generateEventId(),
    eventType: 'ImageGenerationRetried',
    eventVersion: 1,
    occurredAt: new Date(),
    payload
  })
};

// Helper function to generate unique event IDs
function generateEventId(): string {
  // Using timestamp + random for uniqueness (could use UUID in production)
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}