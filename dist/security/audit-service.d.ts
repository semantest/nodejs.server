import { Application } from 'typescript-eda-application';
import { EventBus } from 'typescript-eda-infrastructure';
import { SecurityValidationEvent, WorkflowExecutionCompletedEvent, ClientConnectedEvent, ClientDisconnectedEvent, AutomationWorkflowSubmittedEvent } from '../core/events/cloud-events';
import { AuditRepository } from './domain/audit-repository';
import { AuditEntry } from './domain/audit-entry';
import { ComplianceValidator } from './compliance-validator';
import { SecurityEventAnalyzer } from './security-event-analyzer';
/**
 * Audit Service
 *
 * Provides comprehensive audit logging and compliance tracking for all
 * security-relevant events in the Semantest platform. Ensures compliance
 * with SOC 2, GDPR, and other regulatory requirements.
 */
export declare class AuditService extends Application {
    private auditRepository;
    private complianceValidator;
    private securityAnalyzer;
    constructor(eventBus: EventBus, auditRepository: AuditRepository, complianceValidator: ComplianceValidator, securityAnalyzer: SecurityEventAnalyzer);
    /**
     * Handles security validation events for audit logging
     */
    handleSecurityValidation(event: SecurityValidationEvent): Promise<void>;
    /**
     * Handles workflow execution events for audit logging
     */
    handleWorkflowExecution(event: WorkflowExecutionCompletedEvent): Promise<void>;
    /**
     * Handles client connection events
     */
    handleClientConnected(event: ClientConnectedEvent): Promise<void>;
    /**
     * Handles client disconnection events
     */
    handleClientDisconnected(event: ClientDisconnectedEvent): Promise<void>;
    /**
     * Handles workflow submission events
     */
    handleWorkflowSubmission(event: AutomationWorkflowSubmittedEvent): Promise<void>;
    /**
     * Retrieves audit logs with filtering
     */
    getAuditLogs(filters: {
        startDate?: Date;
        endDate?: Date;
        userId?: string;
        clientId?: string;
        eventType?: string;
        outcome?: string;
        minRiskScore?: number;
        complianceFlag?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        entries: AuditEntry[];
        total: number;
    }>;
    /**
     * Generates compliance report
     */
    generateComplianceReport(options: {
        reportType: 'SOC2' | 'GDPR' | 'HIPAA' | 'CUSTOM';
        startDate: Date;
        endDate: Date;
        includeDetails?: boolean;
    }): Promise<any>;
    /**
     * Exports audit logs for external analysis
     */
    exportAuditLogs(options: {
        format: 'JSON' | 'CSV' | 'SIEM';
        startDate: Date;
        endDate: Date;
        encryptionKey?: string;
    }): Promise<Buffer>;
    /**
     * Calculates risk score for security events
     */
    private calculateRiskScore;
    /**
     * Determines compliance flags for events
     */
    private getComplianceFlags;
    /**
     * Handles detected security threats
     */
    private handleSecurityThreats;
    /**
     * Handles compliance issues
     */
    private handleComplianceIssues;
    /**
     * Validates GDPR compliance for data processing
     */
    private validateGDPRCompliance;
    /**
     * Converts audit entries to CSV format
     */
    private convertToCSV;
    /**
     * Converts audit entries to SIEM format
     */
    private convertToSIEMFormat;
    /**
     * Encrypts data (placeholder - implement actual encryption)
     */
    private encryptData;
    /**
     * Gets service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
}
//# sourceMappingURL=audit-service.d.ts.map