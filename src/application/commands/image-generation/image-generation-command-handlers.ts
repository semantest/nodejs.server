import { CommandHandlerBase } from '../command-handler';
import {
  RequestImageGenerationCommand,
  QueueImageGenerationCommand,
  StartImageProcessingCommand,
  CompleteImageGenerationCommand,
  FailImageGenerationCommand,
  RetryImageGenerationCommand,
  CancelImageGenerationCommand
} from './image-generation-commands';
import { ImageGenerationAggregate } from '../../../domain/image-generation/image-generation-aggregate';
import { EventStore } from '../../../infrastructure/event-store/event-store';
import { v4 as uuidv4 } from 'uuid';

export class RequestImageGenerationCommandHandler extends CommandHandlerBase<RequestImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: RequestImageGenerationCommand): Promise<void> {
    const aggregateId = uuidv4();
    const aggregate = ImageGenerationAggregate.create(
      aggregateId,
      command.prompt,
      command.userId,
      command.requestId,
      command.options
    );

    await this.eventStore.saveEvents(aggregateId, aggregate.domainEvents, -1);
    aggregate.markEventsAsCommitted();
  }
}

export class QueueImageGenerationCommandHandler extends CommandHandlerBase<QueueImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: QueueImageGenerationCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.queueForProcessing(
      command.queuePosition,
      command.estimatedWaitTime,
      command.priority
    );

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}

export class StartImageProcessingCommandHandler extends CommandHandlerBase<StartImageProcessingCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: StartImageProcessingCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.startProcessing(command.processId, command.workerId);

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}

export class CompleteImageGenerationCommandHandler extends CommandHandlerBase<CompleteImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: CompleteImageGenerationCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.completeGeneration(command.imageUrl, command.metadata);

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}

export class FailImageGenerationCommandHandler extends CommandHandlerBase<FailImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: FailImageGenerationCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.failGeneration(command.error);

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}

export class RetryImageGenerationCommandHandler extends CommandHandlerBase<RetryImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: RetryImageGenerationCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.retry();

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}

export class CancelImageGenerationCommandHandler extends CommandHandlerBase<CancelImageGenerationCommand> {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: CancelImageGenerationCommand): Promise<void> {
    if (!command.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    const events = await this.eventStore.getEvents(command.aggregateId);
    const aggregate = new ImageGenerationAggregate(command.aggregateId);
    aggregate.loadFromHistory(events);

    aggregate.cancel(command.reason, command.cancelledBy);

    await this.eventStore.saveEvents(
      command.aggregateId,
      aggregate.domainEvents,
      aggregate.version
    );
    aggregate.markEventsAsCommitted();
  }
}