export interface QueryMetadata {
  correlationId: string;
  userId?: string;
  timestamp: Date;
}

export abstract class Query<TParameters = any, TResult = any> {
  public readonly queryId: string;
  public readonly queryType: string;
  public readonly metadata: QueryMetadata;

  constructor(
    public readonly parameters: TParameters,
    metadata?: Partial<QueryMetadata>
  ) {
    this.queryId = this.generateQueryId();
    this.queryType = this.constructor.name;
    this.metadata = {
      correlationId: metadata?.correlationId || this.generateCorrelationId(),
      userId: metadata?.userId,
      timestamp: metadata?.timestamp || new Date()
    };
  }

  private generateQueryId(): string {
    return `qry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export interface QueryHandler<TQuery extends Query<any, TResult>, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export interface QueryBus {
  execute<TResult>(query: Query<any, TResult>): Promise<TResult>;
  register<TQuery extends Query<any, TResult>, TResult>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void;
}