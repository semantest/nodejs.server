import { CommandHandler } from '../commands/base-command';
import {
  RequestImageGenerationCommand,
  StartImageGenerationCommand,
  UpdateProgressCommand,
  CompleteImageGenerationCommand,
  FailImageGenerationCommand,
  CancelImageGenerationCommand,
  RetryImageGenerationCommand
} from '../commands/image-generation-commands';
import { ImageGenerationAggregate } from '../../domain/aggregates/image-generation-aggregate';
import { EventStore } from '../../infrastructure/event-store/event-store';
import { createImageGenerationEvent } from '../../domain/events/image-generation-events';

export class RequestImageGenerationHandler implements CommandHandler<RequestImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: RequestImageGenerationCommand): Promise<void> {
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    
    // Load existing events if any
    const events = await this.eventStore.getEvents(command.aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }

    // Apply command
    aggregate.handle(command);

    // Get uncommitted events
    const uncommittedEvents = aggregate.getUncommittedEvents();

    // Save events to store
    await this.eventStore.saveEvents(command.aggregateId, uncommittedEvents, aggregate.getVersion());

    // Mark events as committed
    aggregate.markEventsAsCommitted();
  }
}

export class StartImageGenerationHandler implements CommandHandler<StartImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: StartImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    // Create and apply event
    const event = createImageGenerationEvent.started(command.aggregateId, {
      requestId: command.aggregateId,
      workerId: command.payload.workerId,
      startedAt: new Date(),
      estimatedCompletionTime: command.payload.estimatedCompletionTime
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}

export class UpdateProgressHandler implements CommandHandler<UpdateProgressCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: UpdateProgressCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    const event = createImageGenerationEvent.progress(command.aggregateId, {
      requestId: command.aggregateId,
      progressPercentage: command.payload.progressPercentage,
      currentStep: command.payload.currentStep,
      remainingTime: command.payload.remainingTime
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}

export class CompleteImageGenerationHandler implements CommandHandler<CompleteImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: CompleteImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    const event = createImageGenerationEvent.completed(command.aggregateId, {
      requestId: command.aggregateId,
      imageUrl: command.payload.imageUrl,
      thumbnailUrl: command.payload.thumbnailUrl,
      metadata: command.payload.metadata,
      processingTime: command.payload.processingTime,
      creditsUsed: command.payload.creditsUsed
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}

export class FailImageGenerationHandler implements CommandHandler<FailImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: FailImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    const event = createImageGenerationEvent.failed(command.aggregateId, {
      requestId: command.aggregateId,
      errorCode: command.payload.errorCode,
      errorMessage: command.payload.errorMessage,
      canRetry: command.payload.canRetry,
      refundCredits: command.payload.refundCredits
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}

export class CancelImageGenerationHandler implements CommandHandler<CancelImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: CancelImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    const event = createImageGenerationEvent.cancelled(command.aggregateId, {
      requestId: command.aggregateId,
      cancelledBy: command.payload.cancelledBy,
      reason: command.payload.reason,
      refundCredits: true // Determine based on current state
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}

export class RetryImageGenerationHandler implements CommandHandler<RetryImageGenerationCommand> {
  constructor(private eventStore: EventStore) {}

  async handle(command: RetryImageGenerationCommand): Promise<void> {
    const aggregate = await this.loadAggregate(command.aggregateId);
    
    const event = createImageGenerationEvent.retried(command.aggregateId, {
      requestId: command.aggregateId,
      originalRequestId: command.payload.originalRequestId,
      retryAttempt: 1, // Should be calculated from aggregate state
      maxRetries: 3
    });

    aggregate.apply(event);
    await this.saveAggregate(aggregate);
  }

  private async loadAggregate(aggregateId: string): Promise<ImageGenerationAggregate> {
    const aggregate = new ImageGenerationAggregate(aggregateId);
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      aggregate.loadFromHistory(events);
    }
    return aggregate;
  }

  private async saveAggregate(aggregate: ImageGenerationAggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    await this.eventStore.saveEvents(aggregate.getId(), uncommittedEvents, aggregate.getVersion());
    aggregate.markEventsAsCommitted();
  }
}