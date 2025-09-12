import { ProjectionStoreBase } from './projection-store';
import { ImageGenerationProjection, QueueStatusProjection } from '../../application/projections/image-generation-projection';

export class InMemoryProjectionStore extends ProjectionStoreBase {
  private imageGenerations: Map<string, ImageGenerationProjection> = new Map();
  private queueStatus: QueueStatusProjection = {
    totalInQueue: 0,
    processing: 0,
    averageWaitTime: 0,
    averageProcessingTime: 0,
    workersAvailable: 5,
    estimatedTimeForNext: 0
  };

  async saveImageGenerationProjection(projection: ImageGenerationProjection): Promise<void> {
    this.imageGenerations.set(projection.aggregateId, projection);
  }

  async getImageGenerationProjection(aggregateId: string): Promise<ImageGenerationProjection | null> {
    return this.imageGenerations.get(aggregateId) || null;
  }

  async getUserImageGenerations(
    userId: string,
    limit: number,
    offset: number,
    status?: string
  ): Promise<ImageGenerationProjection[]> {
    const userGenerations = Array.from(this.imageGenerations.values())
      .filter(g => g.userId === userId)
      .filter(g => !status || g.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
    
    return userGenerations;
  }

  async getQueueStatus(): Promise<QueueStatusProjection> {
    return { ...this.queueStatus };
  }

  async updateQueueStatus(status: QueueStatusProjection): Promise<void> {
    this.queueStatus = { ...status };
  }

  clear(): void {
    this.imageGenerations.clear();
    this.queueStatus = {
      totalInQueue: 0,
      processing: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      workersAvailable: 5,
      estimatedTimeForNext: 0
    };
  }
}