/**
 * Image Generation Aggregate
 * Following DDD and Event Sourcing principles
 * The aggregate is the consistency boundary and enforces business rules
 */

import {
  ImageGenerationEvent,
  ImageGenerationRequested,
  ImageGenerationValidated,
  ImageGenerationQueued,
  ImageGenerationStarted,
  ImageGenerationProgress,
  ImageGenerationCompleted,
  ImageGenerationFailed,
  ImageGenerationCancelled,
  ImageGenerationRetried,
  createImageGenerationEvent
} from '../events/image-generation-events';

export type ImageGenerationStatus = 
  | 'pending'
  | 'validated'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ImageGenerationState {
  aggregateId: string;
  requestId: string;
  userId: string;
  prompt: string;
  style?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  priority: 'normal' | 'high' | 'low';
  status: ImageGenerationStatus;
  queuePosition?: number;
  workerId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  creditsUsed?: number;
  startedAt?: Date;
  completedAt?: Date;
  version: number;
}

export class ImageGenerationAggregate {
  private state: ImageGenerationState;
  private uncommittedEvents: ImageGenerationEvent[] = [];
  
  constructor(private readonly aggregateId: string) {
    this.state = this.getInitialState();
  }
  
  private getInitialState(): ImageGenerationState {
    return {
      aggregateId: this.aggregateId,
      requestId: '',
      userId: '',
      prompt: '',
      priority: 'normal',
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      version: 0
    };
  }
  
  // Query methods (read-only access to state)
  public getState(): Readonly<ImageGenerationState> {
    return { ...this.state };
  }
  
  public getUncommittedEvents(): readonly ImageGenerationEvent[] {
    return [...this.uncommittedEvents];
  }
  
  public markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }
  
  // Command handlers - these enforce business rules and emit events
  
  public requestGeneration(
    userId: string,
    prompt: string,
    requestId: string,
    options?: {
      style?: string;
      dimensions?: { width: number; height: number };
      priority?: 'normal' | 'high' | 'low';
    }
  ): void {
    if (this.state.status !== 'pending') {
      throw new Error(`Cannot request generation: aggregate already in status ${this.state.status}`);
    }
    
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }
    
    if (options?.dimensions) {
      const { width, height } = options.dimensions;
      if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        throw new Error('Image dimensions must be between 256 and 2048 pixels');
      }
    }
    
    const event = createImageGenerationEvent.requested(this.aggregateId, {
      userId,
      prompt,
      requestId,
      style: options?.style,
      dimensions: options?.dimensions,
      priority: options?.priority || 'normal'
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public validateRequest(
    validationResult: 'valid' | 'invalid',
    validationErrors?: string[],
    estimatedCredits?: number
  ): void {
    if (this.state.status !== 'pending') {
      throw new Error(`Cannot validate: generation not in pending status`);
    }
    
    const event = createImageGenerationEvent.validated(this.aggregateId, {
      requestId: this.state.requestId,
      validationResult,
      validationErrors,
      estimatedCredits
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public queueGeneration(queuePosition: number, estimatedWaitTime: number): void {
    if (this.state.status !== 'validated') {
      throw new Error(`Cannot queue: generation not validated`);
    }
    
    const event = createImageGenerationEvent.queued(this.aggregateId, {
      requestId: this.state.requestId,
      queuePosition,
      estimatedWaitTime,
      priority: this.state.priority
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public startGeneration(workerId: string, estimatedCompletionTime: number): void {
    if (this.state.status !== 'queued') {
      throw new Error(`Cannot start: generation not in queue`);
    }
    
    const event = createImageGenerationEvent.started(this.aggregateId, {
      requestId: this.state.requestId,
      workerId,
      startedAt: new Date(),
      estimatedCompletionTime
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public updateProgress(progressPercentage: number, currentStep?: string, remainingTime?: number): void {
    if (this.state.status !== 'processing') {
      throw new Error(`Cannot update progress: generation not processing`);
    }
    
    if (progressPercentage < 0 || progressPercentage > 100) {
      throw new Error('Progress percentage must be between 0 and 100');
    }
    
    const event = createImageGenerationEvent.progress(this.aggregateId, {
      requestId: this.state.requestId,
      progressPercentage,
      currentStep,
      remainingTime
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public completeGeneration(
    imageUrl: string,
    metadata: {
      width: number;
      height: number;
      format: string;
      sizeInBytes: number;
    },
    processingTime: number,
    creditsUsed: number,
    thumbnailUrl?: string
  ): void {
    if (this.state.status !== 'processing') {
      throw new Error(`Cannot complete: generation not processing`);
    }
    
    const event = createImageGenerationEvent.completed(this.aggregateId, {
      requestId: this.state.requestId,
      imageUrl,
      thumbnailUrl,
      metadata,
      processingTime,
      creditsUsed
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public failGeneration(
    errorCode: string,
    errorMessage: string,
    canRetry: boolean,
    refundCredits?: boolean
  ): void {
    if (this.state.status !== 'processing' && this.state.status !== 'queued') {
      throw new Error(`Cannot fail: generation not in processing or queued status`);
    }
    
    const event = createImageGenerationEvent.failed(this.aggregateId, {
      requestId: this.state.requestId,
      errorCode,
      errorMessage,
      canRetry,
      refundCredits
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public cancelGeneration(cancelledBy: string, reason?: string): void {
    if (this.state.status === 'completed' || this.state.status === 'cancelled') {
      throw new Error(`Cannot cancel: generation already ${this.state.status}`);
    }
    
    const refundCredits = this.state.status !== 'processing';
    
    const event = createImageGenerationEvent.cancelled(this.aggregateId, {
      requestId: this.state.requestId,
      cancelledBy,
      reason,
      refundCredits
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  public retryGeneration(newRequestId: string): void {
    if (this.state.status !== 'failed') {
      throw new Error(`Cannot retry: generation not in failed status`);
    }
    
    if (this.state.retryCount >= this.state.maxRetries) {
      throw new Error(`Cannot retry: maximum retries (${this.state.maxRetries}) reached`);
    }
    
    const event = createImageGenerationEvent.retried(this.aggregateId, {
      requestId: newRequestId,
      originalRequestId: this.state.requestId,
      retryAttempt: this.state.retryCount + 1,
      maxRetries: this.state.maxRetries
    });
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  // Event sourcing: rebuild state from events
  public loadFromHistory(events: ImageGenerationEvent[]): void {
    events.forEach(event => this.applyEvent(event));
  }
  
  // Apply events to update state (Event Sourcing pattern)
  private applyEvent(event: ImageGenerationEvent): void {
    switch (event.eventType) {
      case 'ImageGenerationRequested':
        this.applyImageGenerationRequested(event);
        break;
      case 'ImageGenerationValidated':
        this.applyImageGenerationValidated(event);
        break;
      case 'ImageGenerationQueued':
        this.applyImageGenerationQueued(event);
        break;
      case 'ImageGenerationStarted':
        this.applyImageGenerationStarted(event);
        break;
      case 'ImageGenerationProgress':
        // Progress events don't change core state, just emit for monitoring
        break;
      case 'ImageGenerationCompleted':
        this.applyImageGenerationCompleted(event);
        break;
      case 'ImageGenerationFailed':
        this.applyImageGenerationFailed(event);
        break;
      case 'ImageGenerationCancelled':
        this.applyImageGenerationCancelled(event);
        break;
      case 'ImageGenerationRetried':
        this.applyImageGenerationRetried(event);
        break;
    }
    
    this.state.version++;
  }
  
  private applyImageGenerationRequested(event: ImageGenerationRequested): void {
    this.state.requestId = event.payload.requestId;
    this.state.userId = event.payload.userId;
    this.state.prompt = event.payload.prompt;
    this.state.style = event.payload.style;
    this.state.dimensions = event.payload.dimensions;
    this.state.priority = event.payload.priority || 'normal';
    this.state.status = 'pending';
  }
  
  private applyImageGenerationValidated(event: ImageGenerationValidated): void {
    if (event.payload.validationResult === 'valid') {
      this.state.status = 'validated';
    } else {
      this.state.status = 'failed';
      this.state.errorMessage = event.payload.validationErrors?.join(', ');
    }
  }
  
  private applyImageGenerationQueued(event: ImageGenerationQueued): void {
    this.state.status = 'queued';
    this.state.queuePosition = event.payload.queuePosition;
  }
  
  private applyImageGenerationStarted(event: ImageGenerationStarted): void {
    this.state.status = 'processing';
    this.state.workerId = event.payload.workerId;
    this.state.startedAt = event.payload.startedAt;
  }
  
  private applyImageGenerationCompleted(event: ImageGenerationCompleted): void {
    this.state.status = 'completed';
    this.state.imageUrl = event.payload.imageUrl;
    this.state.thumbnailUrl = event.payload.thumbnailUrl;
    this.state.creditsUsed = event.payload.creditsUsed;
    this.state.completedAt = new Date();
  }
  
  private applyImageGenerationFailed(event: ImageGenerationFailed): void {
    this.state.status = 'failed';
    this.state.errorMessage = event.payload.errorMessage;
  }
  
  private applyImageGenerationCancelled(event: ImageGenerationCancelled): void {
    this.state.status = 'cancelled';
  }
  
  private applyImageGenerationRetried(event: ImageGenerationRetried): void {
    this.state.requestId = event.payload.requestId;
    this.state.retryCount++;
    this.state.status = 'pending';
    this.state.errorMessage = undefined;
  }
}