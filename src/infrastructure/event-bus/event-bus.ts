/**
 * Event Bus Implementation
 * Provides publish-subscribe mechanism for domain events
 * Inspired by Smalltalk's message-passing architecture
 */

import { DomainEvent } from '../../domain/core/domain-event';
import { EventStore } from '../event-store/event-store';
import { EventEmitter } from 'events';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  eventType: string;
  handle: (event: T) => Promise<void>;
  options?: EventHandlerOptions;
}

export interface EventHandlerOptions {
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  priority?: number; // Higher priority handlers execute first
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  createdAt: Date;
}

export interface EventBusMetrics {
  eventsPublished: number;
  eventsProcessed: number;
  eventsFailed: number;
  averageProcessingTime: number;
  activeSubscriptions: number;
}

/**
 * In-Memory Event Bus with persistence support
 */
export class InMemoryEventBus extends EventEmitter {
  private subscriptions: Map<string, EventHandler[]> = new Map();
  private deadLetterQueue: DomainEvent[] = [];
  private metrics: EventBusMetrics = {
    eventsPublished: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    averageProcessingTime: 0,
    activeSubscriptions: 0
  };
  private processingTimes: number[] = [];

  constructor(
    private readonly eventStore?: EventStore,
    private readonly maxDeadLetterQueueSize: number = 1000
  ) {
    super();
    this.setMaxListeners(100); // Support many subscribers
  }

  /**
   * Publish an event to all subscribers
   */
  async publish(event: DomainEvent): Promise<void> {
    this.metrics.eventsPublished++;
    
    // Persist event if event store is configured
    if (this.eventStore) {
      await this.eventStore.saveEvents(
        event.aggregateId,
        [event],
        event.eventVersion
      );
    }

    // Get handlers for this event type
    const handlers = this.subscriptions.get(event.eventType) || [];
    const wildcardHandlers = this.subscriptions.get('*') || [];
    const allHandlers = [...handlers, ...wildcardHandlers];

    // Sort by priority
    allHandlers.sort((a, b) => 
      (b.options?.priority || 0) - (a.options?.priority || 0)
    );

    // Execute handlers
    const startTime = Date.now();
    const results = await Promise.allSettled(
      allHandlers.map(handler => this.executeHandler(handler, event))
    );

    // Track metrics
    const processingTime = Date.now() - startTime;
    this.updateMetrics(processingTime, results);

    // Handle failed events
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`Failed to process event ${event.eventType}:`, failures);
      await this.handleFailedEvent(event, failures);
    }

    // Emit internal event for monitoring
    this.emit('event:published', event);
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => Promise<void>,
    options?: EventHandlerOptions
  ): EventSubscription {
    const eventHandler: EventHandler = {
      eventType,
      handle: handler as any,
      options
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(eventHandler);
    this.metrics.activeSubscriptions++;

    const subscription: EventSubscription = {
      id: this.generateSubscriptionId(),
      eventType,
      handler: eventHandler,
      createdAt: new Date()
    };

    // Emit subscription event
    this.emit('subscription:created', subscription);

    return subscription;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    let found = false;
    
    this.subscriptions.forEach((handlers, eventType) => {
      const index = handlers.findIndex(h => 
        h.eventType === eventType && h.handle.toString().includes(subscriptionId)
      );
      
      if (index !== -1) {
        handlers.splice(index, 1);
        this.metrics.activeSubscriptions--;
        found = true;
        
        if (handlers.length === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    });

    if (found) {
      this.emit('subscription:removed', subscriptionId);
    }

    return found;
  }

  /**
   * Execute a handler with retry logic
   */
  private async executeHandler(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    const options = handler.options || {};
    const maxRetries = options.retryOnFailure ? (options.maxRetries || 3) : 0;
    const retryDelay = options.retryDelay || 1000;
    const timeout = options.timeout || 30000;

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Handler timeout')), timeout)
        );

        await Promise.race([
          handler.handle(event),
          timeoutPromise
        ]);

        this.metrics.eventsProcessed++;
        return; // Success
      } catch (error: any) {
        lastError = error;
        console.error(`Handler failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    // All retries failed
    this.metrics.eventsFailed++;
    throw lastError;
  }

  /**
   * Handle failed events by adding to dead letter queue
   */
  private async handleFailedEvent(
    event: DomainEvent,
    failures: PromiseRejectedResult[]
  ): Promise<void> {
    // Add to dead letter queue
    this.deadLetterQueue.push({
      ...event,
      metadata: {
        ...event.metadata,
        failureReasons: failures.map(f => f.reason?.message || 'Unknown error'),
        failedAt: new Date()
      }
    });

    // Trim dead letter queue if needed
    if (this.deadLetterQueue.length > this.maxDeadLetterQueueSize) {
      this.deadLetterQueue.shift();
    }

    // Emit failure event for monitoring
    this.emit('event:failed', { event, failures });
  }

  /**
   * Process dead letter queue
   */
  async processDeadLetterQueue(): Promise<void> {
    const events = [...this.deadLetterQueue];
    this.deadLetterQueue = [];

    for (const event of events) {
      try {
        await this.publish(event);
        console.log(`Successfully reprocessed dead letter event: ${event.eventType}`);
      } catch (error) {
        console.error(`Failed to reprocess dead letter event: ${event.eventType}`, error);
        this.deadLetterQueue.push(event);
      }
    }
  }

  /**
   * Update metrics after processing
   */
  private updateMetrics(
    processingTime: number,
    results: PromiseSettledResult<void>[]
  ): void {
    this.processingTimes.push(processingTime);
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }

    // Calculate average
    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * Get current metrics
   */
  getMetrics(): EventBusMetrics {
    return { ...this.metrics };
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): DomainEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.metrics.activeSubscriptions = 0;
    this.emit('subscriptions:cleared');
  }

  /**
   * Replay events from event store
   */
  async replayEvents(
    fromDate?: Date,
    toDate?: Date,
    eventTypes?: string[]
  ): Promise<void> {
    if (!this.eventStore) {
      throw new Error('Event store not configured');
    }

    const events = await this.eventStore.getEventsAfter(
      fromDate || new Date(0)
    );

    for (const event of events) {
      // Filter by date range
      if (toDate && event.occurredAt > toDate) {
        continue;
      }

      // Filter by event type
      if (eventTypes && !eventTypes.includes(event.eventType)) {
        continue;
      }

      // Republish event
      await this.publish(event);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Distributed Event Bus using Redis or similar
 * This would be used in production for multi-instance deployments
 */
export class DistributedEventBus extends InMemoryEventBus {
  constructor(
    private readonly redisClient?: any, // Redis client would go here
    eventStore?: EventStore
  ) {
    super(eventStore);
    this.initializeRedisSubscriptions();
  }

  private initializeRedisSubscriptions(): void {
    if (!this.redisClient) {
      console.warn('Redis client not configured, falling back to in-memory');
      return;
    }

    // Subscribe to Redis pub/sub channels
    // Implementation would go here
  }

  async publish(event: DomainEvent): Promise<void> {
    // Publish to Redis for distribution
    if (this.redisClient) {
      await this.redisClient.publish(
        `events:${event.eventType}`,
        JSON.stringify(event)
      );
    }

    // Also handle locally
    await super.publish(event);
  }
}

/**
 * Event Bus Factory
 */
export class EventBusFactory {
  static createInMemory(eventStore?: EventStore): InMemoryEventBus {
    return new InMemoryEventBus(eventStore);
  }

  static createDistributed(
    redisClient?: any,
    eventStore?: EventStore
  ): DistributedEventBus {
    return new DistributedEventBus(redisClient, eventStore);
  }
}