export interface CommandMetadata {
  correlationId: string;
  causationId?: string;
  userId?: string;
  timestamp: Date;
}

export abstract class Command<T = any> {
  public readonly commandId: string;
  public readonly commandType: string;
  public readonly aggregateId: string;
  public readonly metadata: CommandMetadata;

  constructor(
    aggregateId: string,
    public readonly payload: T,
    metadata?: Partial<CommandMetadata>
  ) {
    this.commandId = this.generateCommandId();
    this.commandType = this.constructor.name;
    this.aggregateId = aggregateId;
    this.metadata = {
      correlationId: metadata?.correlationId || this.generateCorrelationId(),
      causationId: metadata?.causationId,
      userId: metadata?.userId,
      timestamp: metadata?.timestamp || new Date()
    };
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export interface CommandBus {
  dispatch<T extends Command>(command: T): Promise<void>;
  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void;
}