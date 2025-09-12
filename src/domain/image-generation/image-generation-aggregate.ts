import { AggregateRoot } from '../core/aggregate-root';
import { DomainEvent } from '../core/domain-event';
import {
  ImageGenerationRequested,
  ImageGenerationQueued,
  ImageGenerationStarted,
  ImageGenerationCompleted,
  ImageGenerationFailed,
  ImageGenerationCancelled,
  ImageGenerationRetried
} from './events/image-generation-events';

export enum ImageGenerationStatus {
  REQUESTED = 'REQUESTED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class ImageGenerationAggregate extends AggregateRoot {
  private status: ImageGenerationStatus = ImageGenerationStatus.REQUESTED;
  private prompt: string = '';
  private userId: string = '';
  private requestId: string = '';
  private queuePosition?: number;
  private processId?: string;
  private workerId?: string;
  private imageUrl?: string;
  private error?: { code: string; message: string; details?: any };
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(id: string) {
    super(id);
  }

  static create(
    id: string,
    prompt: string,
    userId: string,
    requestId: string,
    options?: {
      width?: number;
      height?: number;
      quality?: 'low' | 'medium' | 'high';
      style?: string;
    }
  ): ImageGenerationAggregate {
    const aggregate = new ImageGenerationAggregate(id);
    aggregate.requestGeneration(prompt, userId, requestId, options);
    return aggregate;
  }

  private requestGeneration(
    prompt: string,
    userId: string,
    requestId: string,
    options?: any
  ): void {
    const event = new ImageGenerationRequested(
      this.id,
      prompt,
      userId,
      requestId,
      options
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  queueForProcessing(queuePosition: number, estimatedWaitTime: number, priority: 'low' | 'normal' | 'high' = 'normal'): void {
    if (this.status !== ImageGenerationStatus.REQUESTED) {
      throw new Error(`Cannot queue generation in status ${this.status}`);
    }
    
    const event = new ImageGenerationQueued(
      this.id,
      queuePosition,
      estimatedWaitTime,
      priority
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  startProcessing(processId: string, workerId: string): void {
    if (this.status !== ImageGenerationStatus.QUEUED && this.status !== ImageGenerationStatus.REQUESTED) {
      throw new Error(`Cannot start processing in status ${this.status}`);
    }
    
    const event = new ImageGenerationStarted(
      this.id,
      processId,
      workerId,
      new Date()
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  completeGeneration(
    imageUrl: string,
    metadata: {
      size: number;
      format: string;
      dimensions: { width: number; height: number };
      processingTime: number;
    }
  ): void {
    if (this.status !== ImageGenerationStatus.PROCESSING) {
      throw new Error(`Cannot complete generation in status ${this.status}`);
    }
    
    const event = new ImageGenerationCompleted(
      this.id,
      imageUrl,
      metadata,
      new Date()
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  failGeneration(error: { code: string; message: string; details?: any }): void {
    if (this.status !== ImageGenerationStatus.PROCESSING && this.status !== ImageGenerationStatus.QUEUED) {
      throw new Error(`Cannot fail generation in status ${this.status}`);
    }
    
    const canRetry = this.retryCount < this.maxRetries;
    const event = new ImageGenerationFailed(
      this.id,
      error,
      new Date(),
      canRetry
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  retry(): void {
    if (this.status !== ImageGenerationStatus.FAILED) {
      throw new Error(`Cannot retry generation in status ${this.status}`);
    }
    
    if (this.retryCount >= this.maxRetries) {
      throw new Error(`Maximum retry count (${this.maxRetries}) exceeded`);
    }
    
    const event = new ImageGenerationRetried(
      this.id,
      this.retryCount + 1,
      this.error?.message || 'Unknown error',
      new Date()
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  cancel(reason: string, cancelledBy: string): void {
    if (this.status === ImageGenerationStatus.COMPLETED || this.status === ImageGenerationStatus.CANCELLED) {
      throw new Error(`Cannot cancel generation in status ${this.status}`);
    }
    
    const event = new ImageGenerationCancelled(
      this.id,
      reason,
      cancelledBy,
      new Date()
    );
    this.addDomainEvent(event);
    this.applyEvent(event);
  }

  applyEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'ImageGenerationRequested':
        this.applyImageGenerationRequested(event as ImageGenerationRequested);
        break;
      case 'ImageGenerationQueued':
        this.applyImageGenerationQueued(event as ImageGenerationQueued);
        break;
      case 'ImageGenerationStarted':
        this.applyImageGenerationStarted(event as ImageGenerationStarted);
        break;
      case 'ImageGenerationCompleted':
        this.applyImageGenerationCompleted(event as ImageGenerationCompleted);
        break;
      case 'ImageGenerationFailed':
        this.applyImageGenerationFailed(event as ImageGenerationFailed);
        break;
      case 'ImageGenerationCancelled':
        this.applyImageGenerationCancelled(event as ImageGenerationCancelled);
        break;
      case 'ImageGenerationRetried':
        this.applyImageGenerationRetried(event as ImageGenerationRetried);
        break;
    }
  }

  private applyImageGenerationRequested(event: ImageGenerationRequested): void {
    this.status = ImageGenerationStatus.REQUESTED;
    this.prompt = event.prompt;
    this.userId = event.userId;
    this.requestId = event.requestId;
  }

  private applyImageGenerationQueued(event: ImageGenerationQueued): void {
    this.status = ImageGenerationStatus.QUEUED;
    this.queuePosition = event.queuePosition;
  }

  private applyImageGenerationStarted(event: ImageGenerationStarted): void {
    this.status = ImageGenerationStatus.PROCESSING;
    this.processId = event.processId;
    this.workerId = event.workerId;
  }

  private applyImageGenerationCompleted(event: ImageGenerationCompleted): void {
    this.status = ImageGenerationStatus.COMPLETED;
    this.imageUrl = event.imageUrl;
  }

  private applyImageGenerationFailed(event: ImageGenerationFailed): void {
    this.status = ImageGenerationStatus.FAILED;
    this.error = event.error;
  }

  private applyImageGenerationCancelled(event: ImageGenerationCancelled): void {
    this.status = ImageGenerationStatus.CANCELLED;
  }

  private applyImageGenerationRetried(event: ImageGenerationRetried): void {
    this.status = ImageGenerationStatus.REQUESTED;
    this.retryCount++;
    this.error = undefined;
  }

  getStatus(): ImageGenerationStatus {
    return this.status;
  }

  getImageUrl(): string | undefined {
    return this.imageUrl;
  }

  getError(): { code: string; message: string; details?: any } | undefined {
    return this.error;
  }

  canRetry(): boolean {
    return this.status === ImageGenerationStatus.FAILED && this.retryCount < this.maxRetries;
  }
}