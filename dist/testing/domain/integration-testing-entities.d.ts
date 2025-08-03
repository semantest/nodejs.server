/**
 * @fileoverview Domain entities for integration testing
 * @description Type definitions for test suites, results, and configurations
 * @author Web-Buddy Team
 */
/**
 * Test suite definition
 */
export interface TestSuite {
    id: string;
    name: string;
    description: string;
    version: string;
    type: 'unit' | 'integration' | 'e2e' | 'load' | 'security';
    environment: 'development' | 'test' | 'staging' | 'production';
    tests: TestCase[];
    hooks: TestHook[];
    configuration: TestConfiguration;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Test case definition
 */
export interface TestCase {
    id: string;
    name: string;
    description: string;
    steps: TestStep[];
    expected: any;
    timeout: number;
    retries: number;
    tags: string[];
    dependencies: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Test step definition
 */
export interface TestStep {
    id: string;
    name: string;
    description: string;
    action: string;
    parameters: Record<string, any>;
    expected: any;
    timeout: number;
    order: number;
    isOptional: boolean;
    continueOnFailure: boolean;
}
/**
 * Test hook definition
 */
export interface TestHook {
    id: string;
    name: string;
    type: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';
    action: string;
    parameters: Record<string, any>;
    timeout: number;
    order: number;
    isEnabled: boolean;
}
/**
 * Test configuration
 */
export interface TestConfiguration {
    timeout: number;
    retries: number;
    parallel: boolean;
    failFast: boolean;
    verbose: boolean;
    screenshots: boolean;
    videos: boolean;
    traces: boolean;
    coverage: boolean;
    browser?: string;
    headless?: boolean;
    baseUrl?: string;
    environment?: Record<string, any>;
    globals?: Record<string, any>;
}
/**
 * Test result
 */
export interface TestResult {
    id: string;
    name: string;
    description: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    startTime: Date;
    endTime: Date;
    success: boolean;
    tests: TestCaseResult[];
    metrics?: TestMetrics;
    artifacts?: TestArtifact[];
    errors?: TestError[];
    warnings?: TestWarning[];
}
/**
 * Test case result
 */
export interface TestCaseResult {
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
    duration: number;
    startTime: Date;
    endTime: Date;
    steps: TestStepResult[];
    error?: TestError;
    warnings?: TestWarning[];
    artifacts?: TestArtifact[];
    metrics?: Record<string, any>;
}
/**
 * Test step result
 */
export interface TestStepResult {
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
    duration: number;
    startTime: Date;
    endTime: Date;
    actual: any;
    expected: any;
    error?: TestError;
    screenshots?: string[];
    logs?: string[];
}
/**
 * Test error
 */
export interface TestError {
    message: string;
    type: string;
    stack?: string;
    code?: string;
    details?: Record<string, any>;
    screenshot?: string;
    video?: string;
    trace?: string;
}
/**
 * Test warning
 */
export interface TestWarning {
    message: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    details?: Record<string, any>;
}
/**
 * Test artifact
 */
export interface TestArtifact {
    id: string;
    name: string;
    type: 'screenshot' | 'video' | 'trace' | 'log' | 'report' | 'data';
    path: string;
    size: number;
    mimeType: string;
    description?: string;
    createdAt: Date;
}
/**
 * Test metrics
 */
export interface TestMetrics {
    coverage?: number;
    performance?: number;
    reliability?: number;
    security?: number;
    accessibility?: number;
    responseTime?: number;
    throughput?: number;
    errorRate?: number;
    memoryUsage?: number;
    cpuUsage?: number;
}
/**
 * Load test configuration
 */
export interface LoadTestConfig {
    name: string;
    description: string;
    duration: number;
    rampUp: number;
    rampDown: number;
    virtualUsers: number;
    requestsPerSecond: number;
    thresholds: LoadTestThresholds;
    scenarios: LoadTestScenario[];
    environment: Record<string, any>;
}
/**
 * Load test scenario
 */
export interface LoadTestScenario {
    id: string;
    name: string;
    description: string;
    weight: number;
    steps: LoadTestStep[];
    thinkTime: number;
    pacing: number;
}
/**
 * Load test step
 */
export interface LoadTestStep {
    id: string;
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers: Record<string, string>;
    body?: string;
    parameters?: Record<string, any>;
    validation: LoadTestValidation[];
    timeout: number;
}
/**
 * Load test validation
 */
export interface LoadTestValidation {
    type: 'status' | 'response_time' | 'body' | 'header' | 'json_path';
    condition: string;
    value: any;
    message?: string;
}
/**
 * Load test thresholds
 */
export interface LoadTestThresholds {
    responseTime: {
        p50: number;
        p95: number;
        p99: number;
        max: number;
    };
    throughput: {
        min: number;
        max: number;
    };
    errorRate: {
        max: number;
    };
    availability: {
        min: number;
    };
}
/**
 * Load test result
 */
export interface LoadTestResult {
    id: string;
    name: string;
    description: string;
    duration: number;
    startTime: Date;
    endTime: Date;
    success: boolean;
    virtualUsers: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecond: number;
    peakRps: number;
    averageResponseTime: number;
    responseTimePercentiles: {
        p50: number;
        p95: number;
        p99: number;
        max: number;
    };
    throughput: number;
    errorRate: number;
    availability: number;
    scenarios: LoadTestScenarioResult[];
    errors: LoadTestError[];
    metrics: LoadTestMetrics;
}
/**
 * Load test scenario result
 */
export interface LoadTestScenarioResult {
    id: string;
    name: string;
    requests: number;
    successRate: number;
    averageResponseTime: number;
    throughput: number;
    errors: number;
}
/**
 * Load test error
 */
export interface LoadTestError {
    type: string;
    message: string;
    count: number;
    percentage: number;
    samples: LoadTestErrorSample[];
}
/**
 * Load test error sample
 */
export interface LoadTestErrorSample {
    timestamp: Date;
    url: string;
    method: string;
    statusCode: number;
    responseTime: number;
    error: string;
}
/**
 * Load test metrics
 */
export interface LoadTestMetrics {
    timestamp: Date;
    activeUsers: number;
    requestsPerSecond: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
}
/**
 * Security test configuration
 */
export interface SecurityTestConfig {
    name: string;
    description: string;
    testTypes: SecurityTestType[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    compliance: ComplianceFramework[];
    authentication: SecurityTestAuth;
    environment: Record<string, any>;
}
/**
 * Security test type
 */
export interface SecurityTestType {
    id: string;
    name: string;
    description: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    tests: SecurityTest[];
    isEnabled: boolean;
}
/**
 * Security test
 */
export interface SecurityTest {
    id: string;
    name: string;
    description: string;
    method: string;
    payload?: string;
    headers?: Record<string, string>;
    expected: SecurityTestExpected;
    timeout: number;
}
/**
 * Security test expected result
 */
export interface SecurityTestExpected {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    shouldFail?: boolean;
    vulnerability?: string;
}
/**
 * Security test authentication
 */
export interface SecurityTestAuth {
    type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2';
    credentials?: Record<string, string>;
    headers?: Record<string, string>;
}
/**
 * Compliance framework
 */
export interface ComplianceFramework {
    id: string;
    name: string;
    version: string;
    requirements: ComplianceRequirement[];
}
/**
 * Compliance requirement
 */
export interface ComplianceRequirement {
    id: string;
    name: string;
    description: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    tests: string[];
    isRequired: boolean;
}
/**
 * Security test result
 */
export interface SecurityTestResult {
    id: string;
    name: string;
    description: string;
    total: number;
    passed: number;
    failed: number;
    vulnerabilities: SecurityVulnerability[];
    compliance: ComplianceResult[];
    securityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: SecurityRecommendation[];
    startTime: Date;
    endTime: Date;
    duration: number;
}
/**
 * Security vulnerability
 */
export interface SecurityVulnerability {
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    cwe?: string;
    cvss?: number;
    endpoint: string;
    method: string;
    impact: string;
    likelihood: string;
    evidence: string;
    remediation: string;
    references: string[];
    discoveredAt: Date;
}
/**
 * Compliance result
 */
export interface ComplianceResult {
    frameworkId: string;
    frameworkName: string;
    totalRequirements: number;
    passedRequirements: number;
    failedRequirements: number;
    complianceScore: number;
    status: 'compliant' | 'non_compliant' | 'partial';
    failedTests: string[];
    recommendations: string[];
}
/**
 * Security recommendation
 */
export interface SecurityRecommendation {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    priority: number;
    implementation: string;
    resources: string[];
}
/**
 * Cross-domain test configuration
 */
export interface CrossDomainTestConfig {
    name: string;
    description: string;
    domains: string[];
    extensions: string[];
    servers: string[];
    clients: string[];
    communication: CommunicationTest[];
    dataFlow: DataFlowTest[];
    errorHandling: ErrorHandlingTest[];
    timeout: number;
}
/**
 * Communication test
 */
export interface CommunicationTest {
    id: string;
    name: string;
    source: string;
    target: string;
    protocol: string;
    message: any;
    expected: any;
    timeout: number;
}
/**
 * Data flow test
 */
export interface DataFlowTest {
    id: string;
    name: string;
    flow: DataFlowStep[];
    validation: DataFlowValidation[];
    timeout: number;
}
/**
 * Data flow step
 */
export interface DataFlowStep {
    id: string;
    source: string;
    target: string;
    data: any;
    transformation?: string;
    validation?: string;
}
/**
 * Data flow validation
 */
export interface DataFlowValidation {
    type: 'data_integrity' | 'data_format' | 'data_consistency';
    condition: string;
    expected: any;
    message?: string;
}
/**
 * Error handling test
 */
export interface ErrorHandlingTest {
    id: string;
    name: string;
    scenario: string;
    errorType: string;
    trigger: ErrorTrigger;
    expected: ErrorExpected;
    timeout: number;
}
/**
 * Error trigger
 */
export interface ErrorTrigger {
    type: 'network' | 'timeout' | 'invalid_data' | 'permission' | 'rate_limit';
    parameters: Record<string, any>;
}
/**
 * Error expected result
 */
export interface ErrorExpected {
    errorCode?: string;
    errorMessage?: string;
    recovery?: string;
    fallback?: string;
    userNotification?: boolean;
    logging?: boolean;
}
/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
    name: string;
    description: string;
    baseUrl: string;
    database: DatabaseConfig;
    redis: RedisConfig;
    external: ExternalServiceConfig[];
    authentication: AuthenticationConfig;
    features: FeatureFlags;
    variables: Record<string, any>;
}
/**
 * Database configuration
 */
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    pool: {
        min: number;
        max: number;
        timeout: number;
    };
}
/**
 * Redis configuration
 */
export interface RedisConfig {
    host: string;
    port: number;
    database: number;
    password?: string;
    ssl: boolean;
    timeout: number;
}
/**
 * External service configuration
 */
export interface ExternalServiceConfig {
    name: string;
    baseUrl: string;
    apiKey?: string;
    timeout: number;
    retries: number;
    mock: boolean;
    mockData?: Record<string, any>;
}
/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
    type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2';
    credentials: Record<string, string>;
    endpoints: {
        login: string;
        logout: string;
        refresh: string;
    };
}
/**
 * Feature flags
 */
export interface FeatureFlags {
    [key: string]: boolean;
}
/**
 * Test report configuration
 */
export interface TestReportConfig {
    format: 'html' | 'json' | 'xml' | 'pdf' | 'junit';
    outputPath: string;
    includeScreenshots: boolean;
    includeVideos: boolean;
    includeTraces: boolean;
    includeMetrics: boolean;
    includeErrors: boolean;
    includeWarnings: boolean;
    includeArtifacts: boolean;
    theme: 'light' | 'dark';
    branding: {
        logo?: string;
        title?: string;
        company?: string;
    };
    timestamp: string;
}
/**
 * Test constants
 */
export declare const TEST_TYPES: {
    readonly UNIT: "unit";
    readonly INTEGRATION: "integration";
    readonly E2E: "e2e";
    readonly LOAD: "load";
    readonly SECURITY: "security";
};
export declare const TEST_STATUS: {
    readonly PASSED: "passed";
    readonly FAILED: "failed";
    readonly SKIPPED: "skipped";
    readonly TIMEOUT: "timeout";
    readonly ERROR: "error";
};
export declare const SECURITY_SEVERITY: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export declare const COMPLIANCE_FRAMEWORKS: {
    readonly OWASP: "owasp";
    readonly NIST: "nist";
    readonly ISO27001: "iso27001";
    readonly SOC2: "soc2";
    readonly GDPR: "gdpr";
};
//# sourceMappingURL=integration-testing-entities.d.ts.map