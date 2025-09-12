import { DomainEvent } from '../events/image-generation-events';

export abstract class AggregateRoot {
  protected _id: string;
  protected _version: number;
  protected _uncommittedEvents: DomainEvent[] = [];
  protected _eventHandlers: Map<string, (event: DomainEvent) => void> = new Map();

  constructor(id: string) {
    this._id = id;
    this._version = 0;
    this.registerEventHandlers();
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get uncommittedEvents(): DomainEvent[] {
    return this._uncommittedEvents;
  }

  protected abstract registerEventHandlers(): void;

  protected addEvent(event: DomainEvent): void {
    this._uncommittedEvents.push(event);
    this.applyEvent(event);
    this._version++;
  }

  protected applyEvent(event: DomainEvent): void {
    const handler = this._eventHandlers.get(event.eventType);
    if (handler) {
      handler.call(this, event);
    }
  }

  public markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event);
      this._version++;
    });
  }

  protected ensureValidState(): void {
    // Override in derived classes for invariant validation
  }

  protected registerEventHandler(eventType: string, handler: (event: DomainEvent) => void): void {
    this._eventHandlers.set(eventType, handler);
  }
}