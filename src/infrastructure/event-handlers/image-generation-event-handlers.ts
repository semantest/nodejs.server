import { DomainEvent } from '../../domain/core/domain-event';
import {
  ImageGenerationRequested,
  ImageGenerationQueued,
  ImageGenerationStarted,
  ImageGenerationCompleted,
  ImageGenerationFailed,
  ImageGenerationCancelled,
  ImageGenerationRetried
} from '../../domain/image-generation/events/image-generation-events';
import { ProjectionStore } from '../projection-store/projection-store';
import { ImageGenerationProjection } from '../../application/projections/image-generation-projection';

export class ImageGenerationEventHandlers {
  constructor(private readonly projectionStore: ProjectionStore) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'ImageGenerationRequested':
        await this.handleImageGenerationRequested(event as ImageGenerationRequested);
        break;
      case 'ImageGenerationQueued':
        await this.handleImageGenerationQueued(event as ImageGenerationQueued);
        break;
      case 'ImageGenerationStarted':
        await this.handleImageGenerationStarted(event as ImageGenerationStarted);
        break;
      case 'ImageGenerationCompleted':
        await this.handleImageGenerationCompleted(event as ImageGenerationCompleted);
        break;
      case 'ImageGenerationFailed':
        await this.handleImageGenerationFailed(event as ImageGenerationFailed);
        break;
      case 'ImageGenerationCancelled':
        await this.handleImageGenerationCancelled(event as ImageGenerationCancelled);
        break;
      case 'ImageGenerationRetried':
        await this.handleImageGenerationRetried(event as ImageGenerationRetried);
        break;
    }
  }

  private async handleImageGenerationRequested(event: ImageGenerationRequested): Promise<void> {
    const projection: ImageGenerationProjection = {
      aggregateId: event.aggregateId,
      requestId: event.requestId,
      userId: event.userId,
      prompt: event.prompt,
      status: 'REQUESTED',
      retryCount: 0,
      createdAt: event.occurredOn,
      updatedAt: event.occurredOn
    };

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationQueued(event: ImageGenerationQueued): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'QUEUED';
    projection.queuePosition = event.queuePosition;
    projection.estimatedWaitTime = event.estimatedWaitTime;
    projection.priority = event.priority;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationStarted(event: ImageGenerationStarted): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'PROCESSING';
    projection.processId = event.processId;
    projection.workerId = event.workerId;
    projection.queuePosition = undefined;
    projection.estimatedWaitTime = undefined;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationCompleted(event: ImageGenerationCompleted): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'COMPLETED';
    projection.imageUrl = event.imageUrl;
    projection.metadata = event.metadata;
    projection.completedAt = event.occurredOn;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationFailed(event: ImageGenerationFailed): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'FAILED';
    projection.error = event.error;
    projection.failedAt = event.occurredOn;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationCancelled(event: ImageGenerationCancelled): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'CANCELLED';
    projection.cancelledAt = event.occurredOn;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async handleImageGenerationRetried(event: ImageGenerationRetried): Promise<void> {
    const projection = await this.projectionStore.getImageGenerationProjection(event.aggregateId);
    if (!projection) return;

    projection.status = 'REQUESTED';
    projection.retryCount++;
    projection.error = undefined;
    projection.failedAt = undefined;
    projection.updatedAt = event.occurredOn;

    await this.projectionStore.saveImageGenerationProjection(projection);
    await this.updateQueueStatus();
  }

  private async updateQueueStatus(): Promise<void> {
    const status = await this.projectionStore.getQueueStatus();
    
    // This is a simplified version. In production, you'd calculate these values
    // based on actual queue data
    status.totalInQueue = Math.floor(Math.random() * 10);
    status.processing = Math.floor(Math.random() * 3);
    status.averageWaitTime = Math.floor(Math.random() * 60);
    status.averageProcessingTime = Math.floor(Math.random() * 30);
    status.estimatedTimeForNext = status.totalInQueue * status.averageProcessingTime / status.workersAvailable;

    await this.projectionStore.updateQueueStatus(status);
  }
}