import { QueryHandlerBase } from '../query-handler';
import {
  GetImageGenerationStatusQuery,
  GetQueuePositionQuery,
  GetUserImageGenerationsQuery,
  GetImageGenerationHistoryQuery,
  GetQueueStatusQuery
} from './image-generation-queries';
import {
  ImageGenerationProjection,
  QueueStatusProjection,
  UserImageGenerationsProjection
} from '../../projections/image-generation-projection';
import { ProjectionStore } from '../../../infrastructure/projection-store/projection-store';
import { EventStore } from '../../../infrastructure/event-store/event-store';

export class GetImageGenerationStatusQueryHandler extends QueryHandlerBase<
  GetImageGenerationStatusQuery,
  ImageGenerationProjection | null
> {
  constructor(private readonly projectionStore: ProjectionStore) {
    super();
  }

  async handle(query: GetImageGenerationStatusQuery): Promise<ImageGenerationProjection | null> {
    return await this.projectionStore.getImageGenerationProjection(query.aggregateId);
  }
}

export class GetQueuePositionQueryHandler extends QueryHandlerBase<
  GetQueuePositionQuery,
  { position: number; estimatedWaitTime: number } | null
> {
  constructor(private readonly projectionStore: ProjectionStore) {
    super();
  }

  async handle(query: GetQueuePositionQuery): Promise<{ position: number; estimatedWaitTime: number } | null> {
    const projection = await this.projectionStore.getImageGenerationProjection(query.aggregateId);
    if (!projection || !projection.queuePosition) {
      return null;
    }

    return {
      position: projection.queuePosition,
      estimatedWaitTime: projection.estimatedWaitTime || 0
    };
  }
}

export class GetUserImageGenerationsQueryHandler extends QueryHandlerBase<
  GetUserImageGenerationsQuery,
  UserImageGenerationsProjection
> {
  constructor(private readonly projectionStore: ProjectionStore) {
    super();
  }

  async handle(query: GetUserImageGenerationsQuery): Promise<UserImageGenerationsProjection> {
    const generations = await this.projectionStore.getUserImageGenerations(
      query.userId,
      query.limit,
      query.offset,
      query.status
    );

    const totalGenerations = generations.length;
    const completedGenerations = generations.filter(g => g.status === 'COMPLETED').length;
    const failedGenerations = generations.filter(g => g.status === 'FAILED').length;
    const inProgressGenerations = generations.filter(
      g => g.status === 'PROCESSING' || g.status === 'QUEUED' || g.status === 'REQUESTED'
    ).length;

    return {
      userId: query.userId,
      totalGenerations,
      completedGenerations,
      failedGenerations,
      inProgressGenerations,
      generations
    };
  }
}

export class GetImageGenerationHistoryQueryHandler extends QueryHandlerBase<
  GetImageGenerationHistoryQuery,
  any[]
> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(query: GetImageGenerationHistoryQuery): Promise<any[]> {
    const events = await this.eventStore.getEvents(query.aggregateId);
    return events.map(event => ({
      eventType: event.eventType,
      occurredOn: event.occurredOn,
      payload: event.payload
    }));
  }
}

export class GetQueueStatusQueryHandler extends QueryHandlerBase<
  GetQueueStatusQuery,
  QueueStatusProjection
> {
  constructor(private readonly projectionStore: ProjectionStore) {
    super();
  }

  async handle(query: GetQueueStatusQuery): Promise<QueueStatusProjection> {
    return await this.projectionStore.getQueueStatus();
  }
}