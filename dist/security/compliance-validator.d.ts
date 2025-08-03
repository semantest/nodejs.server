import { AuditEntry } from './domain/audit-entry';
/**
 * Compliance Validator
 *
 * Validates audit entries against various regulatory compliance requirements
 * including SOC 2, GDPR, HIPAA, and custom organizational policies.
 */
export declare class ComplianceValidator {
    private readonly regulations;
    constructor();
    /**
     * Validates an audit entry for compliance issues
     */
    validateEvent(entry: AuditEntry): Promise<ComplianceIssue[]>;
    /**
     * Validates GDPR compliance specifically
     */
    validateGDPR(entry: AuditEntry): Promise<GDPRValidationResult>;
    /**
     * Generates compliance report
     */
    generateReport(entries: AuditEntry[], reportType: 'SOC2' | 'GDPR' | 'HIPAA' | 'CUSTOM', includeDetails: boolean): Promise<ComplianceReport>;
    /**
     * Initializes compliance regulations
     */
    private initializeRegulations;
    /**
     * Generates recommendations based on violations
     */
    private generateRecommendations;
    /**
     * Generates executive summary
     */
    private generateExecutiveSummary;
}
interface ComplianceIssue {
    regulation: string;
    requirement: string;
    violation: string;
    severity: number;
    remediation: string;
}
interface GDPRValidationResult {
    compliant: boolean;
    violations: {
        article: string;
        description: string;
        remediation: string;
        severity: number;
    }[];
}
interface ComplianceViolation {
    auditEntryId: string;
    timestamp: Date;
    regulation: string;
    requirement: string;
    violation: string;
    severity: number;
    remediation: string;
    details?: any;
}
interface ComplianceStatistics {
    totalEvents: number;
    compliantEvents: number;
    violationsByType: Record<string, number>;
    riskDistribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}
interface ComplianceReport {
    reportId: string;
    reportType: string;
    generatedAt: Date;
    periodStart: Date;
    periodEnd: Date;
    summary: {
        totalEvents: number;
        compliantEvents: number;
        violations: number;
        complianceRate: number;
        highestRisk: number;
    };
    statistics: ComplianceStatistics;
    violations: ComplianceViolation[];
    recommendations: string[];
    executiveSummary: string;
}
export {};
//# sourceMappingURL=compliance-validator.d.ts.map