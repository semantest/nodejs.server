import { QueryBase } from '../query';

export class GetImageGenerationStatusQuery extends QueryBase {
  constructor(public readonly aggregateId: string) {
    super();
  }
}

export class GetQueuePositionQuery extends QueryBase {
  constructor(public readonly aggregateId: string) {
    super();
  }
}

export class GetUserImageGenerationsQuery extends QueryBase {
  constructor(
    public readonly userId: string,
    public readonly limit: number = 10,
    public readonly offset: number = 0,
    public readonly status?: string
  ) {
    super();
  }
}

export class GetImageGenerationHistoryQuery extends QueryBase {
  constructor(public readonly aggregateId: string) {
    super();
  }
}

export class GetQueueStatusQuery extends QueryBase {
  constructor() {
    super();
  }
}