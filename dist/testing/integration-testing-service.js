"use strict";
/**
 * @fileoverview Integration testing service
 * @description Handles end-to-end API testing, load testing, and security testing
 * @author Web-Buddy Team
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationTestingService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const integration_testing_events_1 = require("../core/events/integration-testing-events");
const e2e_test_runner_1 = require("./adapters/e2e-test-runner");
const load_test_runner_1 = require("./adapters/load-test-runner");
const security_test_runner_1 = require("./adapters/security-test-runner");
const cross_domain_validator_1 = require("./adapters/cross-domain-validator");
const test_report_generator_1 = require("./adapters/test-report-generator");
/**
 * Integration testing service for comprehensive API testing
 */
let IntegrationTestingService = class IntegrationTestingService extends typescript_eda_stubs_1.Application {
    constructor() {
        super(...arguments);
        this.metadata = new Map([
            ['name', 'Web-Buddy Integration Testing Service'],
            ['version', '1.0.0'],
            ['capabilities', 'e2e-testing,load-testing,security-testing,cross-domain-validation'],
            ['supportedFormats', 'jest,mocha,cypress,playwright,postman'],
            ['reportFormats', 'html,json,xml,pdf,junit']
        ]);
    }
    /**
     * Handle integration test requests
     */
    async handleIntegrationTestRequest(event) {
        try {
            const { testType, testSuite, configuration } = event;
            let testResult;
            switch (testType) {
                case 'e2e':
                    testResult = await this.runEndToEndTests(testSuite, configuration);
                    break;
                case 'api':
                    testResult = await this.runApiTests(testSuite, configuration);
                    break;
                case 'cross_domain':
                    testResult = await this.runCrossDomainTests(testSuite, configuration);
                    break;
                case 'regression':
                    testResult = await this.runRegressionTests(testSuite, configuration);
                    break;
                default:
                    throw new Error(`Unsupported integration test type: ${testType}`);
            }
            // Generate test report
            await this.generateTestReport(testResult, configuration);
            console.log(`✅ Integration test completed: ${testType}`);
            console.log(`📊 Results: ${testResult.passed}/${testResult.total} tests passed`);
        }
        catch (error) {
            console.error('❌ Integration test failed:', error);
            throw error;
        }
    }
    /**
     * Handle load test requests
     */
    async handleLoadTestRequest(event) {
        try {
            const { testConfig, endpoints } = event;
            const loadTestResult = await this.runLoadTests(testConfig, endpoints);
            // Generate load test report
            await this.generateLoadTestReport(loadTestResult);
            console.log(`🚀 Load test completed`);
            console.log(`📈 Peak RPS: ${loadTestResult.peakRps}`);
            console.log(`⏱️ Average response time: ${loadTestResult.averageResponseTime}ms`);
        }
        catch (error) {
            console.error('❌ Load test failed:', error);
            throw error;
        }
    }
    /**
     * Handle security test requests
     */
    async handleSecurityTestRequest(event) {
        try {
            const { testConfig, endpoints } = event;
            const securityTestResult = await this.runSecurityTests(testConfig, endpoints);
            // Generate security test report
            await this.generateSecurityTestReport(securityTestResult);
            console.log(`🔒 Security test completed`);
            console.log(`🛡️ Vulnerabilities found: ${securityTestResult.vulnerabilities.length}`);
            console.log(`📋 Security score: ${securityTestResult.securityScore}/100`);
        }
        catch (error) {
            console.error('❌ Security test failed:', error);
            throw error;
        }
    }
    /**
     * Run end-to-end tests
     */
    async runEndToEndTests(testSuite, configuration) {
        console.log(`🧪 Running end-to-end tests for ${testSuite.name}`);
        const testResult = await this.e2eTestRunner.runTests(testSuite, {
            browser: configuration.browser || 'chromium',
            headless: configuration.headless !== false,
            timeout: configuration.timeout || 30000,
            retries: configuration.retries || 2,
            parallel: configuration.parallel || true,
            screenshots: configuration.screenshots !== false,
            videos: configuration.videos || false,
            traces: configuration.traces || false
        });
        return testResult;
    }
    /**
     * Run API tests
     */
    async runApiTests(testSuite, configuration) {
        console.log(`🌐 Running API tests for ${testSuite.name}`);
        const testResult = await this.e2eTestRunner.runApiTests(testSuite, {
            baseUrl: configuration.baseUrl || 'http://localhost:3003',
            timeout: configuration.timeout || 10000,
            retries: configuration.retries || 1,
            validateSchema: configuration.validateSchema !== false,
            validateResponse: configuration.validateResponse !== false,
            checkRateLimit: configuration.checkRateLimit !== false,
            checkSecurity: configuration.checkSecurity !== false
        });
        return testResult;
    }
    /**
     * Run cross-domain tests
     */
    async runCrossDomainTests(testSuite, configuration) {
        console.log(`🌍 Running cross-domain tests for ${testSuite.name}`);
        const testResult = await this.crossDomainValidator.runTests(testSuite, {
            domains: configuration.domains || ['google.com', 'images.google.com'],
            extensions: configuration.extensions || ['extension.chrome'],
            servers: configuration.servers || ['nodejs.server'],
            clients: configuration.clients || ['typescript.client'],
            timeout: configuration.timeout || 30000,
            validateCommunication: configuration.validateCommunication !== false,
            validateDataFlow: configuration.validateDataFlow !== false,
            validateErrorHandling: configuration.validateErrorHandling !== false
        });
        return testResult;
    }
    /**
     * Run regression tests
     */
    async runRegressionTests(testSuite, configuration) {
        console.log(`🔄 Running regression tests for ${testSuite.name}`);
        const testResult = await this.e2eTestRunner.runRegressionTests(testSuite, {
            baselineVersion: configuration.baselineVersion || 'latest',
            currentVersion: configuration.currentVersion || 'current',
            compareMode: configuration.compareMode || 'strict',
            tolerance: configuration.tolerance || 0.1,
            screenshotComparison: configuration.screenshotComparison !== false,
            performanceComparison: configuration.performanceComparison !== false,
            apiComparison: configuration.apiComparison !== false
        });
        return testResult;
    }
    /**
     * Run load tests
     */
    async runLoadTests(config, endpoints) {
        console.log(`🚀 Running load tests on ${endpoints.length} endpoints`);
        const loadTestResult = await this.loadTestRunner.runLoadTests(config, endpoints);
        return loadTestResult;
    }
    /**
     * Run security tests
     */
    async runSecurityTests(config, endpoints) {
        console.log(`🔒 Running security tests on ${endpoints.length} endpoints`);
        const securityTestResult = await this.securityTestRunner.runSecurityTests(config, endpoints);
        return securityTestResult;
    }
    /**
     * Generate test report
     */
    async generateTestReport(testResult, configuration) {
        const reportFormat = configuration.reportFormat || 'html';
        await this.testReportGenerator.generateReport(testResult, {
            format: reportFormat,
            outputPath: configuration.outputPath || './test-reports',
            includeScreenshots: configuration.includeScreenshots !== false,
            includeVideos: configuration.includeVideos || false,
            includeTraces: configuration.includeTraces || false,
            includeMetrics: configuration.includeMetrics !== false,
            includeErrors: configuration.includeErrors !== false,
            timestamp: new Date().toISOString()
        });
        console.log(`📄 Test report generated: ${reportFormat}`);
    }
    /**
     * Generate load test report
     */
    async generateLoadTestReport(loadTestResult) {
        await this.testReportGenerator.generateLoadTestReport(loadTestResult, {
            format: 'html',
            outputPath: './load-test-reports',
            includeGraphs: true,
            includeMetrics: true,
            includeRawData: true,
            timestamp: new Date().toISOString()
        });
        console.log(`📊 Load test report generated`);
    }
    /**
     * Generate security test report
     */
    async generateSecurityTestReport(securityTestResult) {
        await this.testReportGenerator.generateSecurityTestReport(securityTestResult, {
            format: 'html',
            outputPath: './security-test-reports',
            includeVulnerabilities: true,
            includeRecommendations: true,
            includeMitigation: true,
            includeCompliance: true,
            timestamp: new Date().toISOString()
        });
        console.log(`🛡️ Security test report generated`);
    }
    /**
     * Get test suite templates
     */
    getTestSuiteTemplates() {
        return [
            'authentication_flows',
            'api_endpoints',
            'rate_limiting',
            'error_handling',
            'data_validation',
            'security_checks',
            'performance_tests',
            'user_workflows',
            'integration_scenarios',
            'edge_cases'
        ];
    }
    /**
     * Create test suite from template
     */
    async createTestSuiteFromTemplate(template, configuration) {
        const templateConfig = this.getTemplateConfiguration(template);
        return {
            id: `suite_${Date.now()}`,
            name: `${template} Test Suite`,
            description: `Generated test suite for ${template}`,
            version: '1.0.0',
            type: 'integration',
            environment: configuration.environment || 'test',
            tests: await this.generateTestsFromTemplate(template, configuration),
            hooks: templateConfig.hooks || [],
            configuration: {
                timeout: configuration.timeout || 30000,
                retries: configuration.retries || 2,
                parallel: configuration.parallel || true,
                ...templateConfig.configuration
            },
            tags: templateConfig.tags || [template],
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    /**
     * Run all API Platform tests
     */
    async runApiPlatformTests() {
        console.log('🧪 Running comprehensive API Platform tests...');
        const testSuites = [
            await this.createTestSuiteFromTemplate('authentication_flows', { environment: 'test' }),
            await this.createTestSuiteFromTemplate('api_endpoints', { environment: 'test' }),
            await this.createTestSuiteFromTemplate('rate_limiting', { environment: 'test' }),
            await this.createTestSuiteFromTemplate('security_checks', { environment: 'test' }),
            await this.createTestSuiteFromTemplate('integration_scenarios', { environment: 'test' })
        ];
        const results = [];
        for (const suite of testSuites) {
            const result = await this.runEndToEndTests(suite, {
                browser: 'chromium',
                headless: true,
                timeout: 30000,
                retries: 2,
                parallel: true,
                screenshots: true,
                videos: false,
                traces: false
            });
            results.push(result);
        }
        // Aggregate results
        const totalTests = results.reduce((sum, r) => sum + r.total, 0);
        const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
        const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
        const aggregatedResult = {
            id: `api_platform_tests_${Date.now()}`,
            name: 'API Platform Comprehensive Tests',
            description: 'Full test suite for API Platform milestone',
            total: totalTests,
            passed: totalPassed,
            failed: totalFailed,
            skipped: totalSkipped,
            duration: results.reduce((sum, r) => sum + r.duration, 0),
            startTime: new Date(),
            endTime: new Date(),
            success: totalFailed === 0,
            tests: results.flatMap(r => r.tests),
            metrics: {
                coverage: results.reduce((sum, r) => sum + (r.metrics?.coverage || 0), 0) / results.length,
                performance: results.reduce((sum, r) => sum + (r.metrics?.performance || 0), 0) / results.length,
                reliability: results.reduce((sum, r) => sum + (r.metrics?.reliability || 0), 0) / results.length
            },
            artifacts: results.flatMap(r => r.artifacts || [])
        };
        return aggregatedResult;
    }
    /**
     * Helper methods
     */
    getTemplateConfiguration(template) {
        const templates = {
            authentication_flows: {
                hooks: ['beforeEach', 'afterEach'],
                configuration: { timeout: 15000 },
                tags: ['auth', 'security']
            },
            api_endpoints: {
                hooks: ['beforeAll', 'afterAll'],
                configuration: { timeout: 10000 },
                tags: ['api', 'endpoints']
            },
            rate_limiting: {
                hooks: ['beforeEach'],
                configuration: { timeout: 20000 },
                tags: ['rate-limiting', 'performance']
            },
            security_checks: {
                hooks: ['beforeAll', 'afterAll'],
                configuration: { timeout: 30000 },
                tags: ['security', 'vulnerability']
            },
            integration_scenarios: {
                hooks: ['beforeAll', 'afterAll'],
                configuration: { timeout: 45000 },
                tags: ['integration', 'e2e']
            }
        };
        return templates[template] || {};
    }
    async generateTestsFromTemplate(template, configuration) {
        // Mock implementation - in production, this would generate actual test cases
        return [
            {
                id: `test_${template}_1`,
                name: `${template} basic functionality`,
                description: `Test basic functionality for ${template}`,
                steps: [],
                expected: 'success',
                timeout: 10000
            },
            {
                id: `test_${template}_2`,
                name: `${template} error handling`,
                description: `Test error handling for ${template}`,
                steps: [],
                expected: 'error_handled',
                timeout: 10000
            }
        ];
    }
};
exports.IntegrationTestingService = IntegrationTestingService;
__decorate([
    (0, typescript_eda_stubs_1.listen)(integration_testing_events_1.IntegrationTestRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [integration_testing_events_1.IntegrationTestRequestedEvent]),
    __metadata("design:returntype", Promise)
], IntegrationTestingService.prototype, "handleIntegrationTestRequest", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(integration_testing_events_1.LoadTestRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [integration_testing_events_1.LoadTestRequestedEvent]),
    __metadata("design:returntype", Promise)
], IntegrationTestingService.prototype, "handleLoadTestRequest", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(integration_testing_events_1.SecurityTestRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [integration_testing_events_1.SecurityTestRequestedEvent]),
    __metadata("design:returntype", Promise)
], IntegrationTestingService.prototype, "handleSecurityTestRequest", null);
exports.IntegrationTestingService = IntegrationTestingService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(e2e_test_runner_1.EndToEndTestRunner),
    (0, typescript_eda_stubs_1.Enable)(load_test_runner_1.LoadTestRunner),
    (0, typescript_eda_stubs_1.Enable)(security_test_runner_1.SecurityTestRunner),
    (0, typescript_eda_stubs_1.Enable)(cross_domain_validator_1.CrossDomainValidator),
    (0, typescript_eda_stubs_1.Enable)(test_report_generator_1.TestReportGenerator)
], IntegrationTestingService);
//# sourceMappingURL=integration-testing-service.js.map