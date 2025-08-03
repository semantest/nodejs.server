/**
 * Enterprise Security Module
 * Comprehensive security services for enterprise deployment
 */
export { AuditService } from './audit-service';
export { IncidentResponseService, incidentResponseService, SecurityIncident, SecurityAction, ThreatRule, SecurityDashboard } from './incident-response.service';
export { ComplianceFrameworkService, complianceFrameworkService, ComplianceFramework, ComplianceRequirement, ComplianceFinding, ComplianceReport, ComplianceMetrics } from './compliance-framework.service';
export { VulnerabilityScanner, vulnerabilityScanner, Vulnerability, ScanConfiguration, ScanResult, SecurityReport } from './vulnerability-scanner.service';
import { Express } from 'express';
/**
 * Initialize enterprise security module
 */
export declare function initializeEnterpriseSecurityModule(app: Express): Promise<void>;
/**
 * Shutdown enterprise security module
 */
export declare function shutdownEnterpriseSecurityModule(): Promise<void>;
//# sourceMappingURL=index.d.ts.map