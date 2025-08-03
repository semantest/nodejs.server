"use strict";
/**
 * @fileoverview Domain entities for integration testing
 * @description Type definitions for test suites, results, and configurations
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLIANCE_FRAMEWORKS = exports.SECURITY_SEVERITY = exports.TEST_STATUS = exports.TEST_TYPES = void 0;
/**
 * Test constants
 */
exports.TEST_TYPES = {
    UNIT: 'unit',
    INTEGRATION: 'integration',
    E2E: 'e2e',
    LOAD: 'load',
    SECURITY: 'security'
};
exports.TEST_STATUS = {
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    TIMEOUT: 'timeout',
    ERROR: 'error'
};
exports.SECURITY_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};
exports.COMPLIANCE_FRAMEWORKS = {
    OWASP: 'owasp',
    NIST: 'nist',
    ISO27001: 'iso27001',
    SOC2: 'soc2',
    GDPR: 'gdpr'
};
//# sourceMappingURL=integration-testing-entities.js.map