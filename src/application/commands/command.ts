export interface Command {
  commandId: string;
  aggregateId?: string;
  timestamp: Date;
}

export abstract class CommandBase implements Command {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(public readonly aggregateId?: string) {
    this.commandId = this.generateCommandId();
    this.timestamp = new Date();
  }

  private generateCommandId(): string {
    return `${this.constructor.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}