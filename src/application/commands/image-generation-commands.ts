/**
 * CQRS Commands for Image Generation
 * Commands represent intentions to change state
 */

export interface Command {
  commandId: string;
  aggregateId: string;
  timestamp: Date;
  userId: string;
}

export interface RequestImageGenerationCommand extends Command {
  type: 'RequestImageGeneration';
  payload: {
    prompt: string;
    style?: string;
    dimensions?: {
      width: number;
      height: number;
    };
    priority?: 'normal' | 'high' | 'low';
  };
}

export interface ValidateImageRequestCommand extends Command {
  type: 'ValidateImageRequest';
  payload: {
    requestId: string;
  };
}

export interface QueueImageGenerationCommand extends Command {
  type: 'QueueImageGeneration';
  payload: {
    requestId: string;
  };
}

export interface StartImageGenerationCommand extends Command {
  type: 'StartImageGeneration';
  payload: {
    requestId: string;
    workerId: string;
  };
}

export interface UpdateImageProgressCommand extends Command {
  type: 'UpdateImageProgress';
  payload: {
    requestId: string;
    progressPercentage: number;
    currentStep?: string;
    remainingTime?: number;
  };
}

export interface CompleteImageGenerationCommand extends Command {
  type: 'CompleteImageGeneration';
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
    processingTime: number;
    creditsUsed: number;
  };
}

export interface FailImageGenerationCommand extends Command {
  type: 'FailImageGeneration';
  payload: {
    requestId: string;
    errorCode: string;
    errorMessage: string;
    canRetry: boolean;
    refundCredits?: boolean;
  };
}

export interface CancelImageGenerationCommand extends Command {
  type: 'CancelImageGeneration';
  payload: {
    requestId: string;
    reason?: string;
  };
}

export interface RetryImageGenerationCommand extends Command {
  type: 'RetryImageGeneration';
  payload: {
    requestId: string;
  };
}

// Union type for all commands
export type ImageGenerationCommand =
  | RequestImageGenerationCommand
  | ValidateImageRequestCommand
  | QueueImageGenerationCommand
  | StartImageGenerationCommand
  | UpdateImageProgressCommand
  | CompleteImageGenerationCommand
  | FailImageGenerationCommand
  | CancelImageGenerationCommand
  | RetryImageGenerationCommand;

// Command factory functions
export const createCommand = {
  requestGeneration: (
    aggregateId: string,
    userId: string,
    payload: RequestImageGenerationCommand['payload']
  ): RequestImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'RequestImageGeneration',
    payload
  }),
  
  validateRequest: (
    aggregateId: string,
    userId: string,
    requestId: string
  ): ValidateImageRequestCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'ValidateImageRequest',
    payload: { requestId }
  }),
  
  queueGeneration: (
    aggregateId: string,
    userId: string,
    requestId: string
  ): QueueImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'QueueImageGeneration',
    payload: { requestId }
  }),
  
  startGeneration: (
    aggregateId: string,
    userId: string,
    requestId: string,
    workerId: string
  ): StartImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'StartImageGeneration',
    payload: { requestId, workerId }
  }),
  
  updateProgress: (
    aggregateId: string,
    userId: string,
    payload: UpdateImageProgressCommand['payload']
  ): UpdateImageProgressCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'UpdateImageProgress',
    payload
  }),
  
  completeGeneration: (
    aggregateId: string,
    userId: string,
    payload: CompleteImageGenerationCommand['payload']
  ): CompleteImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'CompleteImageGeneration',
    payload
  }),
  
  failGeneration: (
    aggregateId: string,
    userId: string,
    payload: FailImageGenerationCommand['payload']
  ): FailImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'FailImageGeneration',
    payload
  }),
  
  cancelGeneration: (
    aggregateId: string,
    userId: string,
    requestId: string,
    reason?: string
  ): CancelImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'CancelImageGeneration',
    payload: { requestId, reason }
  }),
  
  retryGeneration: (
    aggregateId: string,
    userId: string,
    requestId: string
  ): RetryImageGenerationCommand => ({
    commandId: generateCommandId(),
    aggregateId,
    timestamp: new Date(),
    userId,
    type: 'RetryImageGeneration',
    payload: { requestId }
  })
};

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}