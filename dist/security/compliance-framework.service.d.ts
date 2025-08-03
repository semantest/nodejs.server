/**
 * Enterprise Compliance Framework Service
 * Comprehensive compliance management for SOC2, GDPR, HIPAA, PCI-DSS
 */
import { EventEmitter } from 'events';
export interface ComplianceFramework {
    id: string;
    name: string;
    description: string;
    version: string;
    enabled: boolean;
    requirements: ComplianceRequirement[];
    assessmentSchedule: string;
    lastAssessment?: Date;
    nextAssessment?: Date;
    complianceScore: number;
    status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'unknown';
}
export interface ComplianceRequirement {
    id: string;
    frameworkId: string;
    section: string;
    title: string;
    description: string;
    category: 'access_control' | 'data_protection' | 'monitoring' | 'incident_response' | 'governance';
    priority: 'low' | 'medium' | 'high' | 'critical';
    automatedCheck: boolean;
    checkFunction?: string;
    evidenceRequired: string[];
    status: 'compliant' | 'non_compliant' | 'not_applicable' | 'pending';
    lastChecked?: Date;
    nextCheck?: Date;
    findings: ComplianceFinding[];
    remediation?: string;
}
export interface ComplianceFinding {
    id: string;
    requirementId: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    evidence: string[];
    recommendation: string;
    status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
    detectedAt: Date;
    resolvedAt?: Date;
    assignedTo?: string;
    dueDate?: Date;
    metadata: Record<string, any>;
}
export interface ComplianceReport {
    id: string;
    frameworkId: string;
    type: 'assessment' | 'audit' | 'certification' | 'gap_analysis';
    title: string;
    description: string;
    generatedAt: Date;
    period: {
        start: Date;
        end: Date;
    };
    overallScore: number;
    status: 'draft' | 'final' | 'certified';
    summary: {
        totalRequirements: number;
        compliantRequirements: number;
        nonCompliantRequirements: number;
        pendingRequirements: number;
        criticalFindings: number;
        highFindings: number;
        mediumFindings: number;
        lowFindings: number;
    };
    findings: ComplianceFinding[];
    recommendations: string[];
    evidence: string[];
    signedBy?: string;
    signedAt?: Date;
    metadata: Record<string, any>;
}
export interface ComplianceMetrics {
    overallComplianceScore: number;
    frameworkScores: Record<string, number>;
    trendData: Array<{
        date: Date;
        score: number;
    }>;
    criticalFindings: number;
    openFindings: number;
    overdueFindings: number;
    recentAssessments: number;
    upcomingAssessments: number;
    riskScore: number;
    lastUpdated: Date;
}
export declare class ComplianceFrameworkService extends EventEmitter {
    private frameworks;
    private requirements;
    private findings;
    private reports;
    private isInitialized;
    private assessmentSchedules;
    constructor();
    initialize(): Promise<void>;
    /**
     * Run compliance assessment
     */
    runAssessment(frameworkId: string, triggeredBy?: string): Promise<ComplianceReport>;
    /**
     * Assess individual requirement
     */
    private assessRequirement;
    /**
     * Execute automated compliance check
     */
    private executeCheck;
    /**
     * Get compliance metrics
     */
    getMetrics(): ComplianceMetrics;
    /**
     * Get compliance report
     */
    getReport(reportId: string): ComplianceReport | null;
    /**
     * List compliance reports
     */
    listReports(filters: {
        frameworkId?: string;
        type?: ComplianceReport['type'];
        status?: ComplianceReport['status'];
        startDate?: Date;
        endDate?: Date;
    }): ComplianceReport[];
    /**
     * Get compliance findings
     */
    getFindings(filters: {
        frameworkId?: string;
        severity?: ComplianceFinding['severity'];
        status?: ComplianceFinding['status'];
        assignedTo?: string;
        overdue?: boolean;
    }): ComplianceFinding[];
    /**
     * Update finding status
     */
    updateFinding(findingId: string, updates: Partial<ComplianceFinding>, updatedBy: string): Promise<ComplianceFinding>;
    private setupFrameworks;
    private loadSOC2Requirements;
    private loadGDPRRequirements;
    private loadHIPAARequirements;
    private loadPCIRequirements;
    private checkAccessControls;
    private checkDataEncryption;
    private checkAuditLogging;
    private checkIncidentResponse;
    private checkBackupProcedures;
    private checkUserManagement;
    private checkNetworkSecurity;
    private checkVulnerabilityManagement;
    private mapPriorityToSeverity;
    private determineFrameworkStatus;
    private generateRecommendations;
    private calculateRiskScore;
    private scheduleAssessments;
    private generateReportId;
    private generateFindingId;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
export declare const complianceFrameworkService: ComplianceFrameworkService;
//# sourceMappingURL=compliance-framework.service.d.ts.map