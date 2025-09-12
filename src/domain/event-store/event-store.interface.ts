/**
 * Event Store Interface
 * Defines the contract for persisting and retrieving events
 * Following Event Sourcing principles
 */

import { DomainEvent } from '../events/image-generation-events';

export interface EventStream {
  aggregateId: string;
  events: DomainEvent[];
  version: number;
}

export interface EventStoreOptions {
  fromVersion?: number;
  toVersion?: number;
  fromDate?: Date;
  toDate?: Date;
  eventTypes?: string[];
  limit?: number;
}

export interface EventStore {
  /**
   * Append events to the event stream
   * Events are immutable once stored
   */
  appendEvents(aggregateId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  
  /**
   * Load all events for an aggregate
   */
  getEvents(aggregateId: string, options?: EventStoreOptions): Promise<DomainEvent[]>;
  
  /**
   * Get the current version of an aggregate
   */
  getAggregateVersion(aggregateId: string): Promise<number>;
  
  /**
   * Get event stream including metadata
   */
  getEventStream(aggregateId: string): Promise<EventStream>;
  
  /**
   * Subscribe to events (for projections and read models)
   */
  subscribe(
    eventTypes: string[],
    handler: (event: DomainEvent) => Promise<void>
  ): () => void;
  
  /**
   * Get all events across all aggregates (for rebuilding projections)
   */
  getAllEvents(options?: {
    fromDate?: Date;
    toDate?: Date;
    eventTypes?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DomainEvent[]>;
  
  /**
   * Create a snapshot of aggregate state (optimization)
   */
  saveSnapshot(aggregateId: string, snapshot: any, version: number): Promise<void>;
  
  /**
   * Load the latest snapshot for an aggregate
   */
  getSnapshot(aggregateId: string): Promise<{ snapshot: any; version: number } | null>;
}

/**
 * Event Publisher for notifying subscribers
 */
export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

/**
 * Event Bus for inter-module communication
 */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): () => void;
  subscribeToAll(handler: (event: DomainEvent) => Promise<void>): () => void;
}