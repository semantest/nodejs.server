export interface Query {
  queryId: string;
  timestamp: Date;
}

export abstract class QueryBase implements Query {
  public readonly queryId: string;
  public readonly timestamp: Date;

  constructor() {
    this.queryId = this.generateQueryId();
    this.timestamp = new Date();
  }

  private generateQueryId(): string {
    return `${this.constructor.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}