import { DomainEventBase } from '../../core/domain-event';

export class ImageGenerationRequested extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly prompt: string,
    public readonly userId: string,
    public readonly requestId: string,
    public readonly options?: {
      width?: number;
      height?: number;
      quality?: 'low' | 'medium' | 'high';
      style?: string;
    }
  ) {
    super(aggregateId, 'ImageGenerationRequested', {
      prompt,
      userId,
      requestId,
      options
    });
  }
}

export class ImageGenerationQueued extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly queuePosition: number,
    public readonly estimatedWaitTime: number,
    public readonly priority: 'low' | 'normal' | 'high'
  ) {
    super(aggregateId, 'ImageGenerationQueued', {
      queuePosition,
      estimatedWaitTime,
      priority
    });
  }
}

export class ImageGenerationStarted extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly processId: string,
    public readonly workerId: string,
    public readonly startedAt: Date
  ) {
    super(aggregateId, 'ImageGenerationStarted', {
      processId,
      workerId,
      startedAt: startedAt.toISOString()
    });
  }
}

export class ImageGenerationCompleted extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly imageUrl: string,
    public readonly metadata: {
      size: number;
      format: string;
      dimensions: { width: number; height: number };
      processingTime: number;
    },
    public readonly completedAt: Date
  ) {
    super(aggregateId, 'ImageGenerationCompleted', {
      imageUrl,
      metadata,
      completedAt: completedAt.toISOString()
    });
  }
}

export class ImageGenerationFailed extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly error: {
      code: string;
      message: string;
      details?: any;
    },
    public readonly failedAt: Date,
    public readonly canRetry: boolean
  ) {
    super(aggregateId, 'ImageGenerationFailed', {
      error,
      failedAt: failedAt.toISOString(),
      canRetry
    });
  }
}

export class ImageGenerationCancelled extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly reason: string,
    public readonly cancelledBy: string,
    public readonly cancelledAt: Date
  ) {
    super(aggregateId, 'ImageGenerationCancelled', {
      reason,
      cancelledBy,
      cancelledAt: cancelledAt.toISOString()
    });
  }
}

export class ImageGenerationRetried extends DomainEventBase {
  constructor(
    aggregateId: string,
    public readonly attemptNumber: number,
    public readonly previousError: string,
    public readonly retriedAt: Date
  ) {
    super(aggregateId, 'ImageGenerationRetried', {
      attemptNumber,
      previousError,
      retriedAt: retriedAt.toISOString()
    });
  }
}