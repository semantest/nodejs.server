"use strict";
/**
 * @fileoverview Integration testing events
 * @description Events for integration testing, load testing, and security testing
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestAnalyticsGeneratedEvent = exports.TestCoverageCalculatedEvent = exports.TestPerformanceThresholdExceededEvent = exports.TestArtifactCreatedEvent = exports.TestRetryAttemptedEvent = exports.TestTimeoutExceededEvent = exports.TestAssertionFailedEvent = exports.TestDataPreparedEvent = exports.TestEnvironmentTeardownEvent = exports.TestEnvironmentSetupEvent = exports.TestReportGeneratedEvent = exports.CrossDomainCommunicationTestedEvent = exports.SecurityVulnerabilityDetectedEvent = exports.LoadTestMetricsCollectedEvent = exports.TestStepExecutedEvent = exports.TestCaseCompletedEvent = exports.TestCaseStartedEvent = exports.TestExecutionCompletedEvent = exports.TestExecutionStartedEvent = exports.SecurityTestRequestedEvent = exports.LoadTestRequestedEvent = exports.IntegrationTestRequestedEvent = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Integration test requested event
 */
class IntegrationTestRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(testType, testSuite, configuration, metadata) {
        super();
        this.testType = testType;
        this.testSuite = testSuite;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.IntegrationTestRequestedEvent = IntegrationTestRequestedEvent;
/**
 * Load test requested event
 */
class LoadTestRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(testConfig, endpoints, metadata) {
        super();
        this.testConfig = testConfig;
        this.endpoints = endpoints;
        this.metadata = metadata;
    }
}
exports.LoadTestRequestedEvent = LoadTestRequestedEvent;
/**
 * Security test requested event
 */
class SecurityTestRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(testConfig, endpoints, metadata) {
        super();
        this.testConfig = testConfig;
        this.endpoints = endpoints;
        this.metadata = metadata;
    }
}
exports.SecurityTestRequestedEvent = SecurityTestRequestedEvent;
/**
 * Test execution started event
 */
class TestExecutionStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, testName, testType, configuration, metadata) {
        super();
        this.testId = testId;
        this.testName = testName;
        this.testType = testType;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.TestExecutionStartedEvent = TestExecutionStartedEvent;
/**
 * Test execution completed event
 */
class TestExecutionCompletedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, testName, result, metadata) {
        super();
        this.testId = testId;
        this.testName = testName;
        this.result = result;
        this.metadata = metadata;
    }
}
exports.TestExecutionCompletedEvent = TestExecutionCompletedEvent;
/**
 * Test case started event
 */
class TestCaseStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(testCaseId, testCaseName, testSuiteId, configuration, metadata) {
        super();
        this.testCaseId = testCaseId;
        this.testCaseName = testCaseName;
        this.testSuiteId = testSuiteId;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.TestCaseStartedEvent = TestCaseStartedEvent;
/**
 * Test case completed event
 */
class TestCaseCompletedEvent extends typescript_eda_stubs_1.Event {
    constructor(testCaseId, testCaseName, result, metadata) {
        super();
        this.testCaseId = testCaseId;
        this.testCaseName = testCaseName;
        this.result = result;
        this.metadata = metadata;
    }
}
exports.TestCaseCompletedEvent = TestCaseCompletedEvent;
/**
 * Test step executed event
 */
class TestStepExecutedEvent extends typescript_eda_stubs_1.Event {
    constructor(testStepId, testStepName, testCaseId, result, metadata) {
        super();
        this.testStepId = testStepId;
        this.testStepName = testStepName;
        this.testCaseId = testCaseId;
        this.result = result;
        this.metadata = metadata;
    }
}
exports.TestStepExecutedEvent = TestStepExecutedEvent;
/**
 * Load test metrics collected event
 */
class LoadTestMetricsCollectedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, metrics, metadata) {
        super();
        this.testId = testId;
        this.metrics = metrics;
        this.metadata = metadata;
    }
}
exports.LoadTestMetricsCollectedEvent = LoadTestMetricsCollectedEvent;
/**
 * Security vulnerability detected event
 */
class SecurityVulnerabilityDetectedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, vulnerability, metadata) {
        super();
        this.testId = testId;
        this.vulnerability = vulnerability;
        this.metadata = metadata;
    }
}
exports.SecurityVulnerabilityDetectedEvent = SecurityVulnerabilityDetectedEvent;
/**
 * Cross-domain communication tested event
 */
class CrossDomainCommunicationTestedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, communication, metadata) {
        super();
        this.testId = testId;
        this.communication = communication;
        this.metadata = metadata;
    }
}
exports.CrossDomainCommunicationTestedEvent = CrossDomainCommunicationTestedEvent;
/**
 * Test report generated event
 */
class TestReportGeneratedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, report, metadata) {
        super();
        this.testId = testId;
        this.report = report;
        this.metadata = metadata;
    }
}
exports.TestReportGeneratedEvent = TestReportGeneratedEvent;
/**
 * Test environment setup event
 */
class TestEnvironmentSetupEvent extends typescript_eda_stubs_1.Event {
    constructor(environment, configuration, metadata) {
        super();
        this.environment = environment;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.TestEnvironmentSetupEvent = TestEnvironmentSetupEvent;
/**
 * Test environment teardown event
 */
class TestEnvironmentTeardownEvent extends typescript_eda_stubs_1.Event {
    constructor(environment, cleanup, metadata) {
        super();
        this.environment = environment;
        this.cleanup = cleanup;
        this.metadata = metadata;
    }
}
exports.TestEnvironmentTeardownEvent = TestEnvironmentTeardownEvent;
/**
 * Test data prepared event
 */
class TestDataPreparedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, dataType, data, metadata) {
        super();
        this.testId = testId;
        this.dataType = dataType;
        this.data = data;
        this.metadata = metadata;
    }
}
exports.TestDataPreparedEvent = TestDataPreparedEvent;
/**
 * Test assertion failed event
 */
class TestAssertionFailedEvent extends typescript_eda_stubs_1.Event {
    constructor(testCaseId, testStepId, assertion, metadata) {
        super();
        this.testCaseId = testCaseId;
        this.testStepId = testStepId;
        this.assertion = assertion;
        this.metadata = metadata;
    }
}
exports.TestAssertionFailedEvent = TestAssertionFailedEvent;
/**
 * Test timeout exceeded event
 */
class TestTimeoutExceededEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, testName, timeout, metadata) {
        super();
        this.testId = testId;
        this.testName = testName;
        this.timeout = timeout;
        this.metadata = metadata;
    }
}
exports.TestTimeoutExceededEvent = TestTimeoutExceededEvent;
/**
 * Test retry attempted event
 */
class TestRetryAttemptedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, testName, retry, metadata) {
        super();
        this.testId = testId;
        this.testName = testName;
        this.retry = retry;
        this.metadata = metadata;
    }
}
exports.TestRetryAttemptedEvent = TestRetryAttemptedEvent;
/**
 * Test artifact created event
 */
class TestArtifactCreatedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, artifact, metadata) {
        super();
        this.testId = testId;
        this.artifact = artifact;
        this.metadata = metadata;
    }
}
exports.TestArtifactCreatedEvent = TestArtifactCreatedEvent;
/**
 * Test performance threshold exceeded event
 */
class TestPerformanceThresholdExceededEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, threshold, metadata) {
        super();
        this.testId = testId;
        this.threshold = threshold;
        this.metadata = metadata;
    }
}
exports.TestPerformanceThresholdExceededEvent = TestPerformanceThresholdExceededEvent;
/**
 * Test coverage calculated event
 */
class TestCoverageCalculatedEvent extends typescript_eda_stubs_1.Event {
    constructor(testId, coverage, metadata) {
        super();
        this.testId = testId;
        this.coverage = coverage;
        this.metadata = metadata;
    }
}
exports.TestCoverageCalculatedEvent = TestCoverageCalculatedEvent;
/**
 * Test analytics generated event
 */
class TestAnalyticsGeneratedEvent extends typescript_eda_stubs_1.Event {
    constructor(period, analytics, metadata) {
        super();
        this.period = period;
        this.analytics = analytics;
        this.metadata = metadata;
    }
}
exports.TestAnalyticsGeneratedEvent = TestAnalyticsGeneratedEvent;
//# sourceMappingURL=integration-testing-events.js.map