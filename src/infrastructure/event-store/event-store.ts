import { DomainEvent } from '../../domain/core/domain-event';

export interface EventStore {
  saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, limit?: number, offset?: number): Promise<DomainEvent[]>;
  getEventsAfter(timestamp: Date, limit?: number): Promise<DomainEvent[]>;
}

export interface StoredEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  eventData: string;
  occurredOn: Date;
  sequenceNumber: number;
}

export abstract class EventStoreBase implements EventStore {
  abstract saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void>;
  abstract getEvents(aggregateId: string): Promise<DomainEvent[]>;
  abstract getEventsByType(eventType: string, limit?: number, offset?: number): Promise<DomainEvent[]>;
  abstract getEventsAfter(timestamp: Date, limit?: number): Promise<DomainEvent[]>;
  
  protected serializeEvent(event: DomainEvent): string {
    return JSON.stringify({
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredOn: event.occurredOn,
      payload: event.payload
    });
  }
  
  protected deserializeEvent(data: string): DomainEvent {
    const parsed = JSON.parse(data);
    return {
      aggregateId: parsed.aggregateId,
      eventType: parsed.eventType,
      eventVersion: parsed.eventVersion,
      occurredOn: new Date(parsed.occurredOn),
      payload: parsed.payload
    };
  }
}