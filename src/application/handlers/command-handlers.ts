/**
 * Command Handlers for Image Generation
 * These handlers process commands, apply business logic via aggregates,
 * and persist events to the event store
 */

import { ImageGenerationAggregate } from '../../domain/aggregates/image-generation-aggregate';
import { EventStore, EventBus } from '../../domain/event-store/event-store.interface';
import {
  ImageGenerationCommand,
  RequestImageGenerationCommand,
  ValidateImageRequestCommand,
  QueueImageGenerationCommand,
  StartImageGenerationCommand,
  UpdateImageProgressCommand,
  CompleteImageGenerationCommand,
  FailImageGenerationCommand,
  CancelImageGenerationCommand,
  RetryImageGenerationCommand
} from '../commands/image-generation-commands';

export interface CommandHandler<T extends ImageGenerationCommand> {
  handle(command: T): Promise<void>;
}

export class CommandHandlerRegistry {
  private handlers = new Map<string, CommandHandler<any>>();
  
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {
    this.registerHandlers();
  }
  
  private registerHandlers(): void {
    this.handlers.set('RequestImageGeneration', new RequestImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('ValidateImageRequest', new ValidateImageRequestHandler(this.eventStore, this.eventBus));
    this.handlers.set('QueueImageGeneration', new QueueImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('StartImageGeneration', new StartImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('UpdateImageProgress', new UpdateImageProgressHandler(this.eventStore, this.eventBus));
    this.handlers.set('CompleteImageGeneration', new CompleteImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('FailImageGeneration', new FailImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('CancelImageGeneration', new CancelImageGenerationHandler(this.eventStore, this.eventBus));
    this.handlers.set('RetryImageGeneration', new RetryImageGenerationHandler(this.eventStore, this.eventBus));
  }
  
  async handle(command: ImageGenerationCommand): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    
    await handler.handle(command);
  }
}

abstract class BaseCommandHandler<T extends ImageGenerationCommand> implements CommandHandler<T> {
  constructor(
    protected readonly eventStore: EventStore,
    protected readonly eventBus: EventBus
  ) {}
  
  abstract handle(command: T): Promise<void>;
  
  protected async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    aggregate.loadFromHistory(events);
    return aggregate;
  }
  
  protected async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    const currentVersion = await this.eventStore.getAggregateVersion(aggregate.getState().aggregateId);
    
    // Persist events to event store
    await this.eventStore.appendEvents(
      aggregate.getState().aggregateId,
      [...uncommittedEvents],
      currentVersion
    );
    
    // Publish events to event bus for projections and other handlers
    for (const event of uncommittedEvents) {
      await this.eventBus.publish(event);
    }
    
    // Mark events as committed
    aggregate.markEventsAsCommitted();
  }
}

export class RequestImageGenerationHandler extends BaseCommandHandler<RequestImageGenerationCommand> {
  async handle(command: RequestImageGenerationCommand): Promise<void> {
    // Create new aggregate for new image generation request
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    
    // Generate a unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Apply the command to the aggregate
    aggregate.requestGeneration(
      command.userId,
      command.payload.prompt,
      requestId,
      {
        style: command.payload.style,
        dimensions: command.payload.dimensions,
        priority: command.payload.priority
      }
    );
    
    // Save the aggregate (persist events)
    await this.saveAggregate(aggregate);
  }
}

export class ValidateImageRequestHandler extends BaseCommandHandler<ValidateImageRequestCommand> {
  async handle(command: ValidateImageRequestCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    // Perform validation logic (this would normally call external services)
    const isValid = await this.validateRequest(aggregate.getState());
    const errors = isValid ? undefined : ['Invalid prompt content'];
    const estimatedCredits = isValid ? this.calculateCredits(aggregate.getState()) : 0;
    
    aggregate.validateRequest(
      isValid ? 'valid' : 'invalid',
      errors,
      estimatedCredits
    );
    
    await this.saveAggregate(aggregate);
  }
  
  private async validateRequest(state: any): Promise<boolean> {
    // Validation logic: check prompt content, user credits, etc.
    // This is simplified - real implementation would be more complex
    return state.prompt && state.prompt.length > 0 && state.prompt.length < 1000;
  }
  
  private calculateCredits(state: any): number {
    // Calculate credits based on dimensions and style
    let credits = 10; // base cost
    
    if (state.dimensions) {
      const pixels = state.dimensions.width * state.dimensions.height;
      credits += Math.floor(pixels / 100000); // extra credits for larger images
    }
    
    if (state.style) {
      credits += 5; // style adds complexity
    }
    
    if (state.priority === 'high') {
      credits += 5; // priority processing costs more
    }
    
    return credits;
  }
}

export class QueueImageGenerationHandler extends BaseCommandHandler<QueueImageGenerationCommand> {
  async handle(command: QueueImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    // Calculate queue position (would normally query the queue service)
    const queuePosition = await this.getQueuePosition(aggregate.getState().priority);
    const estimatedWaitTime = queuePosition * 30; // 30 seconds per position (simplified)
    
    aggregate.queueGeneration(queuePosition, estimatedWaitTime);
    
    await this.saveAggregate(aggregate);
  }
  
  private async getQueuePosition(priority: string): Promise<number> {
    // Simplified - real implementation would query actual queue
    return priority === 'high' ? 1 : priority === 'normal' ? 5 : 10;
  }
}

export class StartImageGenerationHandler extends BaseCommandHandler<StartImageGenerationCommand> {
  async handle(command: StartImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    // Estimated completion time based on complexity
    const estimatedCompletionTime = this.calculateEstimatedTime(aggregate.getState());
    
    aggregate.startGeneration(command.payload.workerId, estimatedCompletionTime);
    
    await this.saveAggregate(aggregate);
  }
  
  private calculateEstimatedTime(state: any): number {
    let baseTime = 60; // 60 seconds base
    
    if (state.dimensions) {
      const pixels = state.dimensions.width * state.dimensions.height;
      baseTime += Math.floor(pixels / 50000); // more pixels = more time
    }
    
    if (state.style) {
      baseTime += 30; // style processing adds time
    }
    
    return baseTime;
  }
}

export class UpdateImageProgressHandler extends BaseCommandHandler<UpdateImageProgressCommand> {
  async handle(command: UpdateImageProgressCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    aggregate.updateProgress(
      command.payload.progressPercentage,
      command.payload.currentStep,
      command.payload.remainingTime
    );
    
    await this.saveAggregate(aggregate);
  }
}

export class CompleteImageGenerationHandler extends BaseCommandHandler<CompleteImageGenerationCommand> {
  async handle(command: CompleteImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    aggregate.completeGeneration(
      command.payload.imageUrl,
      command.payload.metadata,
      command.payload.processingTime,
      command.payload.creditsUsed,
      command.payload.thumbnailUrl
    );
    
    await this.saveAggregate(aggregate);
  }
}

export class FailImageGenerationHandler extends BaseCommandHandler<FailImageGenerationCommand> {
  async handle(command: FailImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    aggregate.failGeneration(
      command.payload.errorCode,
      command.payload.errorMessage,
      command.payload.canRetry,
      command.payload.refundCredits
    );
    
    await this.saveAggregate(aggregate);
  }
}

export class CancelImageGenerationHandler extends BaseCommandHandler<CancelImageGenerationCommand> {
  async handle(command: CancelImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    aggregate.cancelGeneration(
      command.userId,
      command.payload.reason
    );
    
    await this.saveAggregate(aggregate);
  }
}

export class RetryImageGenerationHandler extends BaseCommandHandler<RetryImageGenerationCommand> {
  async handle(command: RetryImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    // Generate new request ID for retry
    const newRequestId = `req_retry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    aggregate.retryGeneration(newRequestId);
    
    await this.saveAggregate(aggregate);
  }
}