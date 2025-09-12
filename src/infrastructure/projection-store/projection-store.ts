import { ImageGenerationProjection, QueueStatusProjection } from '../../application/projections/image-generation-projection';

export interface ProjectionStore {
  saveImageGenerationProjection(projection: ImageGenerationProjection): Promise<void>;
  getImageGenerationProjection(aggregateId: string): Promise<ImageGenerationProjection | null>;
  getUserImageGenerations(
    userId: string,
    limit: number,
    offset: number,
    status?: string
  ): Promise<ImageGenerationProjection[]>;
  getQueueStatus(): Promise<QueueStatusProjection>;
  updateQueueStatus(status: QueueStatusProjection): Promise<void>;
}

export abstract class ProjectionStoreBase implements ProjectionStore {
  abstract saveImageGenerationProjection(projection: ImageGenerationProjection): Promise<void>;
  abstract getImageGenerationProjection(aggregateId: string): Promise<ImageGenerationProjection | null>;
  abstract getUserImageGenerations(
    userId: string,
    limit: number,
    offset: number,
    status?: string
  ): Promise<ImageGenerationProjection[]>;
  abstract getQueueStatus(): Promise<QueueStatusProjection>;
  abstract updateQueueStatus(status: QueueStatusProjection): Promise<void>;
}