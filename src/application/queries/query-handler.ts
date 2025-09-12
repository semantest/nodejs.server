import { Query } from './query';

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export abstract class QueryHandlerBase<TQuery extends Query, TResult> implements QueryHandler<TQuery, TResult> {
  abstract handle(query: TQuery): Promise<TResult>;
}