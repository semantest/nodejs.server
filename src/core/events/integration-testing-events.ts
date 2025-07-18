/**
 * @fileoverview Integration testing events
 * @description Events for integration testing, load testing, and security testing
 * @author Web-Buddy Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Integration test requested event
 */
export class IntegrationTestRequestedEvent extends Event {
  constructor(
    public readonly testType: 'e2e' | 'api' | 'cross_domain' | 'regression',
    public readonly testSuite: {
      id: string;
      name: string;
      description: string;
      type: string;
      environment: string;
      tests: any[];
      configuration: any;
    },
    public readonly configuration: {
      browser?: string;
      headless?: boolean;
      timeout?: number;
      retries?: number;
      parallel?: boolean;
      screenshots?: boolean;
      videos?: boolean;
      traces?: boolean;
      baseUrl?: string;
      reportFormat?: string;
      outputPath?: string;
    },
    public readonly metadata?: {
      requestId: string;
      userId?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Load test requested event
 */
export class LoadTestRequestedEvent extends Event {
  constructor(
    public readonly testConfig: {
      name: string;
      description: string;
      duration: number;
      rampUp: number;
      rampDown: number;
      virtualUsers: number;
      requestsPerSecond: number;
      scenarios: any[];
      thresholds: any;
    },
    public readonly endpoints: string[],
    public readonly metadata?: {
      requestId: string;
      userId?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Security test requested event
 */
export class SecurityTestRequestedEvent extends Event {
  constructor(
    public readonly testConfig: {
      name: string;
      description: string;
      testTypes: any[];
      severity: string;
      compliance: any[];
      authentication: any;
    },
    public readonly endpoints: string[],
    public readonly metadata?: {
      requestId: string;
      userId?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test execution started event
 */
export class TestExecutionStartedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly testName: string,
    public readonly testType: string,
    public readonly configuration: any,
    public readonly metadata: {
      requestId: string;
      userId?: string;
      environment: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test execution completed event
 */
export class TestExecutionCompletedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly testName: string,
    public readonly result: {
      success: boolean;
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
      startTime: Date;
      endTime: Date;
    },
    public readonly metadata: {
      requestId: string;
      userId?: string;
      environment: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test case started event
 */
export class TestCaseStartedEvent extends Event {
  constructor(
    public readonly testCaseId: string,
    public readonly testCaseName: string,
    public readonly testSuiteId: string,
    public readonly configuration: any,
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test case completed event
 */
export class TestCaseCompletedEvent extends Event {
  constructor(
    public readonly testCaseId: string,
    public readonly testCaseName: string,
    public readonly result: {
      status: string;
      duration: number;
      startTime: Date;
      endTime: Date;
      error?: string;
      screenshots?: string[];
      logs?: string[];
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test step executed event
 */
export class TestStepExecutedEvent extends Event {
  constructor(
    public readonly testStepId: string,
    public readonly testStepName: string,
    public readonly testCaseId: string,
    public readonly result: {
      status: string;
      duration: number;
      actual: any;
      expected: any;
      error?: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Load test metrics collected event
 */
export class LoadTestMetricsCollectedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly metrics: {
      timestamp: Date;
      activeUsers: number;
      requestsPerSecond: number;
      responseTime: number;
      throughput: number;
      errorRate: number;
      cpuUsage: number;
      memoryUsage: number;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Security vulnerability detected event
 */
export class SecurityVulnerabilityDetectedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly vulnerability: {
      id: string;
      name: string;
      severity: string;
      category: string;
      endpoint: string;
      method: string;
      description: string;
      impact: string;
      remediation: string;
      cvss?: number;
      cwe?: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Cross-domain communication tested event
 */
export class CrossDomainCommunicationTestedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly communication: {
      source: string;
      target: string;
      protocol: string;
      message: any;
      response: any;
      success: boolean;
      duration: number;
      error?: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test report generated event
 */
export class TestReportGeneratedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly report: {
      format: string;
      outputPath: string;
      size: number;
      includeScreenshots: boolean;
      includeVideos: boolean;
      includeMetrics: boolean;
      generatedAt: Date;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test environment setup event
 */
export class TestEnvironmentSetupEvent extends Event {
  constructor(
    public readonly environment: string,
    public readonly configuration: {
      baseUrl: string;
      database: any;
      redis: any;
      external: any[];
      authentication: any;
      features: any;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test environment teardown event
 */
export class TestEnvironmentTeardownEvent extends Event {
  constructor(
    public readonly environment: string,
    public readonly cleanup: {
      database: boolean;
      redis: boolean;
      files: boolean;
      processes: boolean;
      success: boolean;
      duration: number;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test data prepared event
 */
export class TestDataPreparedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly dataType: string,
    public readonly data: {
      records: number;
      size: number;
      format: string;
      source: string;
      destination: string;
      checksum: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test assertion failed event
 */
export class TestAssertionFailedEvent extends Event {
  constructor(
    public readonly testCaseId: string,
    public readonly testStepId: string,
    public readonly assertion: {
      type: string;
      expected: any;
      actual: any;
      message: string;
      operator: string;
      stackTrace?: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test timeout exceeded event
 */
export class TestTimeoutExceededEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly testName: string,
    public readonly timeout: {
      configured: number;
      actual: number;
      exceeded: number;
      action: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test retry attempted event
 */
export class TestRetryAttemptedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly testName: string,
    public readonly retry: {
      attempt: number;
      maxAttempts: number;
      reason: string;
      delay: number;
      success: boolean;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test artifact created event
 */
export class TestArtifactCreatedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly artifact: {
      id: string;
      name: string;
      type: string;
      path: string;
      size: number;
      mimeType: string;
      description?: string;
      createdAt: Date;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test performance threshold exceeded event
 */
export class TestPerformanceThresholdExceededEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly threshold: {
      name: string;
      type: string;
      expected: number;
      actual: number;
      unit: string;
      severity: string;
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test coverage calculated event
 */
export class TestCoverageCalculatedEvent extends Event {
  constructor(
    public readonly testId: string,
    public readonly coverage: {
      type: string;
      percentage: number;
      lines: {
        total: number;
        covered: number;
        missed: number;
      };
      functions: {
        total: number;
        covered: number;
        missed: number;
      };
      branches: {
        total: number;
        covered: number;
        missed: number;
      };
      statements: {
        total: number;
        covered: number;
        missed: number;
      };
    },
    public readonly metadata: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Test analytics generated event
 */
export class TestAnalyticsGeneratedEvent extends Event {
  constructor(
    public readonly period: string,
    public readonly analytics: {
      totalTests: number;
      successRate: number;
      averageDuration: number;
      totalDuration: number;
      flakiness: number;
      topFailures: Array<{
        testName: string;
        failures: number;
        failureRate: number;
      }>;
      performance: {
        averageResponseTime: number;
        throughput: number;
        errorRate: number;
      };
      coverage: {
        average: number;
        trend: string;
      };
    },
    public readonly metadata: {
      timeRange: {
        start: Date;
        end: Date;
      };
      generatedAt: Date;
    }
  ) {
    super();
  }
}