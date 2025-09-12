import { v4 as uuidv4 } from 'uuid';

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  userId?: string;
  timestamp: Date;
  version: number;
}

export abstract class DomainEvent<T = any> {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly timestamp: Date;
  public readonly metadata: EventMetadata;

  constructor(
    aggregateId: string,
    public readonly payload: T,
    metadata?: Partial<EventMetadata>
  ) {
    this.eventId = uuidv4();
    this.eventType = this.constructor.name;
    this.aggregateId = aggregateId;
    this.timestamp = new Date();
    this.metadata = {
      correlationId: metadata?.correlationId || uuidv4(),
      causationId: metadata?.causationId,
      userId: metadata?.userId,
      timestamp: this.timestamp,
      version: metadata?.version || 1
    };
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      timestamp: this.timestamp.toISOString(),
      payload: this.payload,
      metadata: {
        ...this.metadata,
        timestamp: this.metadata.timestamp.toISOString()
      }
    };
  }

  static fromJSON(data: any): DomainEvent {
    throw new Error('fromJSON must be implemented by subclasses');
  }
}