import { EventStoreBase, StoredEvent } from './event-store';
import { DomainEvent } from '../../domain/core/domain-event';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryEventStore extends EventStoreBase {
  private events: Map<string, StoredEvent[]> = new Map();
  private allEvents: StoredEvent[] = [];
  private sequenceNumber: number = 0;

  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const existingEvents = this.events.get(aggregateId) || [];
    
    if (expectedVersion !== -1 && existingEvents.length !== expectedVersion) {
      throw new Error(`Concurrency violation. Expected version ${expectedVersion} but current version is ${existingEvents.length}`);
    }

    const storedEvents: StoredEvent[] = events.map(event => {
      const storedEvent: StoredEvent = {
        id: uuidv4(),
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        eventData: this.serializeEvent(event),
        occurredOn: event.occurredOn,
        sequenceNumber: ++this.sequenceNumber
      };
      return storedEvent;
    });

    this.events.set(aggregateId, [...existingEvents, ...storedEvents]);
    this.allEvents.push(...storedEvents);
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const storedEvents = this.events.get(aggregateId) || [];
    return storedEvents.map(se => this.deserializeEvent(se.eventData));
  }

  async getEventsByType(eventType: string, limit: number = 100, offset: number = 0): Promise<DomainEvent[]> {
    const filteredEvents = this.allEvents
      .filter(e => e.eventType === eventType)
      .slice(offset, offset + limit);
    
    return filteredEvents.map(se => this.deserializeEvent(se.eventData));
  }

  async getEventsAfter(timestamp: Date, limit: number = 100): Promise<DomainEvent[]> {
    const filteredEvents = this.allEvents
      .filter(e => e.occurredOn > timestamp)
      .slice(0, limit);
    
    return filteredEvents.map(se => this.deserializeEvent(se.eventData));
  }

  clear(): void {
    this.events.clear();
    this.allEvents = [];
    this.sequenceNumber = 0;
  }
}