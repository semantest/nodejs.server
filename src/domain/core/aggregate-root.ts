import { DomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;

  constructor(protected readonly id: string) {}

  get aggregateId(): string {
    return this.id;
  }

  get version(): number {
    return this._version;
  }

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  abstract applyEvent(event: DomainEvent): void;

  loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event);
      this._version++;
    });
  }

  markEventsAsCommitted(): void {
    this._domainEvents = [];
  }
}