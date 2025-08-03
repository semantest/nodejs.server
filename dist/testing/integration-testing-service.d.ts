/**
 * @fileoverview Integration testing service
 * @description Handles end-to-end API testing, load testing, and security testing
 * @author Web-Buddy Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { IntegrationTestRequestedEvent, LoadTestRequestedEvent, SecurityTestRequestedEvent } from '../core/events/integration-testing-events';
import { TestSuite, TestResult, LoadTestConfig, SecurityTestConfig } from './domain/integration-testing-entities';
/**
 * Integration testing service for comprehensive API testing
 */
export declare class IntegrationTestingService extends Application {
    readonly metadata: Map<string, string>;
    private e2eTestRunner;
    private loadTestRunner;
    private securityTestRunner;
    private crossDomainValidator;
    private testReportGenerator;
    /**
     * Handle integration test requests
     */
    handleIntegrationTestRequest(event: IntegrationTestRequestedEvent): Promise<void>;
    /**
     * Handle load test requests
     */
    handleLoadTestRequest(event: LoadTestRequestedEvent): Promise<void>;
    /**
     * Handle security test requests
     */
    handleSecurityTestRequest(event: SecurityTestRequestedEvent): Promise<void>;
    /**
     * Run end-to-end tests
     */
    runEndToEndTests(testSuite: TestSuite, configuration: any): Promise<TestResult>;
    /**
     * Run API tests
     */
    runApiTests(testSuite: TestSuite, configuration: any): Promise<TestResult>;
    /**
     * Run cross-domain tests
     */
    runCrossDomainTests(testSuite: TestSuite, configuration: any): Promise<TestResult>;
    /**
     * Run regression tests
     */
    runRegressionTests(testSuite: TestSuite, configuration: any): Promise<TestResult>;
    /**
     * Run load tests
     */
    runLoadTests(config: LoadTestConfig, endpoints: string[]): Promise<any>;
    /**
     * Run security tests
     */
    runSecurityTests(config: SecurityTestConfig, endpoints: string[]): Promise<any>;
    /**
     * Generate test report
     */
    generateTestReport(testResult: TestResult, configuration: any): Promise<void>;
    /**
     * Generate load test report
     */
    generateLoadTestReport(loadTestResult: any): Promise<void>;
    /**
     * Generate security test report
     */
    generateSecurityTestReport(securityTestResult: any): Promise<void>;
    /**
     * Get test suite templates
     */
    getTestSuiteTemplates(): string[];
    /**
     * Create test suite from template
     */
    createTestSuiteFromTemplate(template: string, configuration: any): Promise<TestSuite>;
    /**
     * Run all API Platform tests
     */
    runApiPlatformTests(): Promise<TestResult>;
    /**
     * Helper methods
     */
    private getTemplateConfiguration;
    private generateTestsFromTemplate;
}
//# sourceMappingURL=integration-testing-service.d.ts.map