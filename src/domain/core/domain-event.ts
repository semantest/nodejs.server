export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  occurredOn: Date;
  payload: Record<string, any>;
}

export abstract class DomainEventBase implements DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventVersion: number = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly payload: Record<string, any>
  ) {
    this.occurredOn = new Date();
  }

  toJSON(): Record<string, any> {
    return {
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      eventVersion: this.eventVersion,
      occurredOn: this.occurredOn.toISOString(),
      payload: this.payload
    };
  }
}