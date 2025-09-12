import { CommandBase } from '../command';

export class RequestImageGenerationCommand extends CommandBase {
  constructor(
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
    super();
  }
}

export class QueueImageGenerationCommand extends CommandBase {
  constructor(
    aggregateId: string,
    public readonly queuePosition: number,
    public readonly estimatedWaitTime: number,
    public readonly priority: 'low' | 'normal' | 'high' = 'normal'
  ) {
    super(aggregateId);
  }
}

export class StartImageProcessingCommand extends CommandBase {
  constructor(
    aggregateId: string,
    public readonly processId: string,
    public readonly workerId: string
  ) {
    super(aggregateId);
  }
}

export class CompleteImageGenerationCommand extends CommandBase {
  constructor(
    aggregateId: string,
    public readonly imageUrl: string,
    public readonly metadata: {
      size: number;
      format: string;
      dimensions: { width: number; height: number };
      processingTime: number;
    }
  ) {
    super(aggregateId);
  }
}

export class FailImageGenerationCommand extends CommandBase {
  constructor(
    aggregateId: string,
    public readonly error: {
      code: string;
      message: string;
      details?: any;
    }
  ) {
    super(aggregateId);
  }
}

export class RetryImageGenerationCommand extends CommandBase {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class CancelImageGenerationCommand extends CommandBase {
  constructor(
    aggregateId: string,
    public readonly reason: string,
    public readonly cancelledBy: string
  ) {
    super(aggregateId);
  }
}