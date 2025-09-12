/**
 * Enhanced Event Store with Event Bus
 * Implements Event Sourcing with real-time event streaming capabilities
 * Following Smalltalk-inspired message passing philosophy
 */

import { EventEmitter } from 'events';
import { DomainEvent } from '../../domain/events/image-generation-events';
import { 
  EventStore, 
  EventStream, 
  EventStoreOptions, 
  EventBus,
  EventPublisher 
} from '../../domain/event-store/event-store.interface';

interface StoredEvent {
  sequenceNumber: number;
  aggregateId: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  payload: any;
  metadata?: Record<string, any>;
}

interface AggregateInfo {
  version: number;
  lastEventSequence: number;
  createdAt: Date;
  lastModifiedAt: Date;
}

interface Snapshot {
  aggregateId: string;
  data: any;
  version: number;
  createdAt: Date;
}

export class EnhancedEventStore implements EventStore, EventBus, EventPublisher {
  private events: Map<string, StoredEvent[]> = new Map();
  private globalEventStream: StoredEvent[] = [];
  private aggregateInfo: Map<string, AggregateInfo> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private sequenceCounter = 0;
  
  // Optimistic concurrency control
  async appendEvents(
    aggregateId: string, 
    events: DomainEvent[], 
    expectedVersion?: number
  ): Promise<void> {
    // Check for version conflicts
    const currentVersion = await this.getAggregateVersion(aggregateId);
    
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`
      );
    }
    
    // Store events
    const aggregateEvents = this.events.get(aggregateId) || [];
    const newStoredEvents: StoredEvent[] = [];
    
    for (const event of events) {
      const storedEvent: StoredEvent = {
        sequenceNumber: ++this.sequenceCounter,
        aggregateId: event.aggregateId,
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        occurredAt: event.occurredAt,
        payload: event.payload,
        metadata: event.metadata
      };
      
      aggregateEvents.push(storedEvent);
      this.globalEventStream.push(storedEvent);
      newStoredEvents.push(storedEvent);
    }
    
    this.events.set(aggregateId, aggregateEvents);
    
    // Update aggregate info
    const info = this.aggregateInfo.get(aggregateId) || {
      version: 0,
      lastEventSequence: 0,
      createdAt: new Date(),
      lastModifiedAt: new Date()
    };
    
    info.version = currentVersion + events.length;
    info.lastEventSequence = this.sequenceCounter;
    info.lastModifiedAt = new Date();
    
    this.aggregateInfo.set(aggregateId, info);
    
    // Publish events to subscribers
    await this.publish(events);
  }
  
  async getEvents(
    aggregateId: string, 
    options?: EventStoreOptions
  ): Promise<DomainEvent[]> {
    const aggregateEvents = this.events.get(aggregateId) || [];
    let filteredEvents = [...aggregateEvents];
    
    // Apply filters
    if (options?.fromVersion !== undefined) {
      const fromIndex = options.fromVersion - 1;
      filteredEvents = filteredEvents.slice(fromIndex);
    }
    
    if (options?.toVersion !== undefined) {
      const toIndex = options.toVersion;
      filteredEvents = filteredEvents.slice(0, toIndex);
    }
    
    if (options?.fromDate) {
      filteredEvents = filteredEvents.filter(e => e.occurredAt >= options.fromDate!);
    }
    
    if (options?.toDate) {
      filteredEvents = filteredEvents.filter(e => e.occurredAt <= options.toDate!);
    }
    
    if (options?.eventTypes && options.eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(e => options.eventTypes!.includes(e.eventType));
    }
    
    if (options?.limit) {
      filteredEvents = filteredEvents.slice(0, options.limit);
    }
    
    // Convert stored events back to domain events
    return filteredEvents.map(this.storedEventToDomainEvent);
  }
  
  async getAggregateVersion(aggregateId: string): Promise<number> {
    const info = this.aggregateInfo.get(aggregateId);
    return info?.version || 0;
  }
  
  async getEventStream(aggregateId: string): Promise<EventStream> {
    const events = await this.getEvents(aggregateId);
    const version = await this.getAggregateVersion(aggregateId);
    
    return {
      aggregateId,
      events,
      version
    };
  }
  
  subscribe(
    eventTypes: string[], 
    handler: (event: DomainEvent) => Promise<void>
  ): () => void {
    const wrappedHandler = async (event: DomainEvent) => {
      if (eventTypes.includes(event.eventType)) {
        await handler(event);
      }
    };
    
    this.eventEmitter.on('event', wrappedHandler);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('event', wrappedHandler);
    };
  }
  
  subscribeToAll(handler: (event: DomainEvent) => Promise<void>): () => void {
    this.eventEmitter.on('event', handler);
    
    return () => {
      this.eventEmitter.off('event', handler);
    };
  }
  
  async getAllEvents(options?: {
    fromDate?: Date;
    toDate?: Date;
    eventTypes?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DomainEvent[]> {
    let events = [...this.globalEventStream];
    
    if (options?.fromDate) {
      events = events.filter(e => e.occurredAt >= options.fromDate!);
    }
    
    if (options?.toDate) {
      events = events.filter(e => e.occurredAt <= options.toDate!);
    }
    
    if (options?.eventTypes && options.eventTypes.length > 0) {
      events = events.filter(e => options.eventTypes!.includes(e.eventType));
    }
    
    if (options?.offset) {
      events = events.slice(options.offset);
    }
    
    if (options?.limit) {
      events = events.slice(0, options.limit);
    }
    
    return events.map(this.storedEventToDomainEvent);
  }
  
  async saveSnapshot(aggregateId: string, snapshot: any, version: number): Promise<void> {
    this.snapshots.set(aggregateId, {
      aggregateId,
      data: snapshot,
      version,
      createdAt: new Date()
    });
  }
  
  async getSnapshot(aggregateId: string): Promise<{ snapshot: any; version: number } | null> {
    const snapshot = this.snapshots.get(aggregateId);
    
    if (!snapshot) {
      return null;
    }
    
    return {
      snapshot: snapshot.data,
      version: snapshot.version
    };
  }
  
  // EventPublisher implementation
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      // Emit event asynchronously to all subscribers
      setImmediate(() => {
        this.eventEmitter.emit('event', event);
        // Also emit by event type for more granular subscriptions
        this.eventEmitter.emit(event.eventType, event);
      });
    }
  }
  
  // EventBus implementation
  async publish(event: DomainEvent): Promise<void> {
    setImmediate(() => {
      this.eventEmitter.emit('event', event);
      this.eventEmitter.emit(event.eventType, event);
    });
  }
  
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): () => void {
    this.eventEmitter.on(eventType, handler);
    
    return () => {
      this.eventEmitter.off(eventType, handler);
    };
  }
  
  // Helper methods
  private storedEventToDomainEvent(stored: StoredEvent): DomainEvent {
    return {
      aggregateId: stored.aggregateId,
      eventId: stored.eventId,
      eventType: stored.eventType,
      eventVersion: stored.eventVersion,
      occurredAt: stored.occurredAt,
      payload: stored.payload,
      metadata: stored.metadata
    };
  }
  
  // Query methods for projections
  async getEventsByAggregateType(
    aggregateType: string, 
    limit?: number
  ): Promise<DomainEvent[]> {
    // Filter events by aggregate type pattern (e.g., "img-gen-*" for image generation)
    const events = this.globalEventStream
      .filter(e => e.aggregateId.startsWith(aggregateType))
      .slice(0, limit || 100);
    
    return events.map(this.storedEventToDomainEvent);
  }
  
  async getEventsBySequence(
    fromSequence: number, 
    toSequence?: number
  ): Promise<DomainEvent[]> {
    const events = this.globalEventStream
      .filter(e => {
        const inRange = e.sequenceNumber >= fromSequence;
        const belowMax = toSequence ? e.sequenceNumber <= toSequence : true;
        return inRange && belowMax;
      });
    
    return events.map(this.storedEventToDomainEvent);
  }
  
  // Statistics and monitoring
  getStatistics(): {
    totalEvents: number;
    totalAggregates: number;
    eventTypes: Map<string, number>;
    lastSequenceNumber: number;
  } {
    const eventTypes = new Map<string, number>();
    
    for (const event of this.globalEventStream) {
      const count = eventTypes.get(event.eventType) || 0;
      eventTypes.set(event.eventType, count + 1);
    }
    
    return {
      totalEvents: this.globalEventStream.length,
      totalAggregates: this.events.size,
      eventTypes,
      lastSequenceNumber: this.sequenceCounter
    };
  }
  
  // Event replay for rebuilding projections
  async replayEvents(
    handler: (event: DomainEvent) => Promise<void>,
    options?: {
      fromSequence?: number;
      batchSize?: number;
      delayMs?: number;
    }
  ): Promise<void> {
    const batchSize = options?.batchSize || 100;
    const delayMs = options?.delayMs || 10;
    const fromSequence = options?.fromSequence || 0;
    
    const events = this.globalEventStream
      .filter(e => e.sequenceNumber >= fromSequence)
      .map(this.storedEventToDomainEvent);
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      for (const event of batch) {
        await handler(event);
      }
      
      // Add delay between batches to prevent overwhelming the system
      if (delayMs > 0 && i + batchSize < events.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
}

// Singleton instance for the application
export const eventStore = new EnhancedEventStore();