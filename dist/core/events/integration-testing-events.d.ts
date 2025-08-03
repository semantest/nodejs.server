/**
 * @fileoverview Integration testing events
 * @description Events for integration testing, load testing, and security testing
 * @author Web-Buddy Team
 */
import { Event } from '../../stubs/typescript-eda-stubs';
/**
 * Integration test requested event
 */
export declare class IntegrationTestRequestedEvent extends Event {
    readonly testType: 'e2e' | 'api' | 'cross_domain' | 'regression';
    readonly testSuite: {
        id: string;
        name: string;
        description: string;
        type: string;
        environment: string;
        tests: any[];
        configuration: any;
    };
    readonly configuration: {
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
    };
    readonly metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    };
    constructor(testType: 'e2e' | 'api' | 'cross_domain' | 'regression', testSuite: {
        id: string;
        name: string;
        description: string;
        type: string;
        environment: string;
        tests: any[];
        configuration: any;
    }, configuration: {
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
    }, metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    });
}
/**
 * Load test requested event
 */
export declare class LoadTestRequestedEvent extends Event {
    readonly testConfig: {
        name: string;
        description: string;
        duration: number;
        rampUp: number;
        rampDown: number;
        virtualUsers: number;
        requestsPerSecond: number;
        scenarios: any[];
        thresholds: any;
    };
    readonly endpoints: string[];
    readonly metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    };
    constructor(testConfig: {
        name: string;
        description: string;
        duration: number;
        rampUp: number;
        rampDown: number;
        virtualUsers: number;
        requestsPerSecond: number;
        scenarios: any[];
        thresholds: any;
    }, endpoints: string[], metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    });
}
/**
 * Security test requested event
 */
export declare class SecurityTestRequestedEvent extends Event {
    readonly testConfig: {
        name: string;
        description: string;
        testTypes: any[];
        severity: string;
        compliance: any[];
        authentication: any;
    };
    readonly endpoints: string[];
    readonly metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    };
    constructor(testConfig: {
        name: string;
        description: string;
        testTypes: any[];
        severity: string;
        compliance: any[];
        authentication: any;
    }, endpoints: string[], metadata?: {
        requestId: string;
        userId?: string;
        timestamp: Date;
    });
}
/**
 * Test execution started event
 */
export declare class TestExecutionStartedEvent extends Event {
    readonly testId: string;
    readonly testName: string;
    readonly testType: string;
    readonly configuration: any;
    readonly metadata: {
        requestId: string;
        userId?: string;
        environment: string;
        timestamp: Date;
    };
    constructor(testId: string, testName: string, testType: string, configuration: any, metadata: {
        requestId: string;
        userId?: string;
        environment: string;
        timestamp: Date;
    });
}
/**
 * Test execution completed event
 */
export declare class TestExecutionCompletedEvent extends Event {
    readonly testId: string;
    readonly testName: string;
    readonly result: {
        success: boolean;
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
        startTime: Date;
        endTime: Date;
    };
    readonly metadata: {
        requestId: string;
        userId?: string;
        environment: string;
        timestamp: Date;
    };
    constructor(testId: string, testName: string, result: {
        success: boolean;
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
        startTime: Date;
        endTime: Date;
    }, metadata: {
        requestId: string;
        userId?: string;
        environment: string;
        timestamp: Date;
    });
}
/**
 * Test case started event
 */
export declare class TestCaseStartedEvent extends Event {
    readonly testCaseId: string;
    readonly testCaseName: string;
    readonly testSuiteId: string;
    readonly configuration: any;
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testCaseId: string, testCaseName: string, testSuiteId: string, configuration: any, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test case completed event
 */
export declare class TestCaseCompletedEvent extends Event {
    readonly testCaseId: string;
    readonly testCaseName: string;
    readonly result: {
        status: string;
        duration: number;
        startTime: Date;
        endTime: Date;
        error?: string;
        screenshots?: string[];
        logs?: string[];
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testCaseId: string, testCaseName: string, result: {
        status: string;
        duration: number;
        startTime: Date;
        endTime: Date;
        error?: string;
        screenshots?: string[];
        logs?: string[];
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test step executed event
 */
export declare class TestStepExecutedEvent extends Event {
    readonly testStepId: string;
    readonly testStepName: string;
    readonly testCaseId: string;
    readonly result: {
        status: string;
        duration: number;
        actual: any;
        expected: any;
        error?: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testStepId: string, testStepName: string, testCaseId: string, result: {
        status: string;
        duration: number;
        actual: any;
        expected: any;
        error?: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Load test metrics collected event
 */
export declare class LoadTestMetricsCollectedEvent extends Event {
    readonly testId: string;
    readonly metrics: {
        timestamp: Date;
        activeUsers: number;
        requestsPerSecond: number;
        responseTime: number;
        throughput: number;
        errorRate: number;
        cpuUsage: number;
        memoryUsage: number;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, metrics: {
        timestamp: Date;
        activeUsers: number;
        requestsPerSecond: number;
        responseTime: number;
        throughput: number;
        errorRate: number;
        cpuUsage: number;
        memoryUsage: number;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Security vulnerability detected event
 */
export declare class SecurityVulnerabilityDetectedEvent extends Event {
    readonly testId: string;
    readonly vulnerability: {
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
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, vulnerability: {
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
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Cross-domain communication tested event
 */
export declare class CrossDomainCommunicationTestedEvent extends Event {
    readonly testId: string;
    readonly communication: {
        source: string;
        target: string;
        protocol: string;
        message: any;
        response: any;
        success: boolean;
        duration: number;
        error?: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, communication: {
        source: string;
        target: string;
        protocol: string;
        message: any;
        response: any;
        success: boolean;
        duration: number;
        error?: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test report generated event
 */
export declare class TestReportGeneratedEvent extends Event {
    readonly testId: string;
    readonly report: {
        format: string;
        outputPath: string;
        size: number;
        includeScreenshots: boolean;
        includeVideos: boolean;
        includeMetrics: boolean;
        generatedAt: Date;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, report: {
        format: string;
        outputPath: string;
        size: number;
        includeScreenshots: boolean;
        includeVideos: boolean;
        includeMetrics: boolean;
        generatedAt: Date;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test environment setup event
 */
export declare class TestEnvironmentSetupEvent extends Event {
    readonly environment: string;
    readonly configuration: {
        baseUrl: string;
        database: any;
        redis: any;
        external: any[];
        authentication: any;
        features: any;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(environment: string, configuration: {
        baseUrl: string;
        database: any;
        redis: any;
        external: any[];
        authentication: any;
        features: any;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test environment teardown event
 */
export declare class TestEnvironmentTeardownEvent extends Event {
    readonly environment: string;
    readonly cleanup: {
        database: boolean;
        redis: boolean;
        files: boolean;
        processes: boolean;
        success: boolean;
        duration: number;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(environment: string, cleanup: {
        database: boolean;
        redis: boolean;
        files: boolean;
        processes: boolean;
        success: boolean;
        duration: number;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test data prepared event
 */
export declare class TestDataPreparedEvent extends Event {
    readonly testId: string;
    readonly dataType: string;
    readonly data: {
        records: number;
        size: number;
        format: string;
        source: string;
        destination: string;
        checksum: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, dataType: string, data: {
        records: number;
        size: number;
        format: string;
        source: string;
        destination: string;
        checksum: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test assertion failed event
 */
export declare class TestAssertionFailedEvent extends Event {
    readonly testCaseId: string;
    readonly testStepId: string;
    readonly assertion: {
        type: string;
        expected: any;
        actual: any;
        message: string;
        operator: string;
        stackTrace?: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testCaseId: string, testStepId: string, assertion: {
        type: string;
        expected: any;
        actual: any;
        message: string;
        operator: string;
        stackTrace?: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test timeout exceeded event
 */
export declare class TestTimeoutExceededEvent extends Event {
    readonly testId: string;
    readonly testName: string;
    readonly timeout: {
        configured: number;
        actual: number;
        exceeded: number;
        action: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, testName: string, timeout: {
        configured: number;
        actual: number;
        exceeded: number;
        action: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test retry attempted event
 */
export declare class TestRetryAttemptedEvent extends Event {
    readonly testId: string;
    readonly testName: string;
    readonly retry: {
        attempt: number;
        maxAttempts: number;
        reason: string;
        delay: number;
        success: boolean;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, testName: string, retry: {
        attempt: number;
        maxAttempts: number;
        reason: string;
        delay: number;
        success: boolean;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test artifact created event
 */
export declare class TestArtifactCreatedEvent extends Event {
    readonly testId: string;
    readonly artifact: {
        id: string;
        name: string;
        type: string;
        path: string;
        size: number;
        mimeType: string;
        description?: string;
        createdAt: Date;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, artifact: {
        id: string;
        name: string;
        type: string;
        path: string;
        size: number;
        mimeType: string;
        description?: string;
        createdAt: Date;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test performance threshold exceeded event
 */
export declare class TestPerformanceThresholdExceededEvent extends Event {
    readonly testId: string;
    readonly threshold: {
        name: string;
        type: string;
        expected: number;
        actual: number;
        unit: string;
        severity: string;
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, threshold: {
        name: string;
        type: string;
        expected: number;
        actual: number;
        unit: string;
        severity: string;
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test coverage calculated event
 */
export declare class TestCoverageCalculatedEvent extends Event {
    readonly testId: string;
    readonly coverage: {
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
    };
    readonly metadata: {
        requestId: string;
        timestamp: Date;
    };
    constructor(testId: string, coverage: {
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
    }, metadata: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Test analytics generated event
 */
export declare class TestAnalyticsGeneratedEvent extends Event {
    readonly period: string;
    readonly analytics: {
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
    };
    readonly metadata: {
        timeRange: {
            start: Date;
            end: Date;
        };
        generatedAt: Date;
    };
    constructor(period: string, analytics: {
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
    }, metadata: {
        timeRange: {
            start: Date;
            end: Date;
        };
        generatedAt: Date;
    });
}
//# sourceMappingURL=integration-testing-events.d.ts.map