"use strict";
/*
 * Copyright (C) 2024-present Semantest, rydnr
 *
 * This file is part of @semantest/nodejs.server.
 *
 * @semantest/nodejs.server is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * @semantest/nodejs.server is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @semantest/nodejs.server. If not, see <https://www.gnu.org/licenses/>.
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
exports.AuditService = void 0;
const typescript_eda_application_1 = require("typescript-eda-application");
const typescript_eda_infrastructure_1 = require("typescript-eda-infrastructure");
const cloud_events_1 = require("../core/events/cloud-events");
const audit_entry_1 = require("./domain/audit-entry");
/**
 * Audit Service
 *
 * Provides comprehensive audit logging and compliance tracking for all
 * security-relevant events in the Semantest platform. Ensures compliance
 * with SOC 2, GDPR, and other regulatory requirements.
 */
class AuditService extends typescript_eda_application_1.Application {
    constructor(eventBus, auditRepository, complianceValidator, securityAnalyzer) {
        super(eventBus, new Map([
            ['auditRepository', auditRepository],
            ['complianceValidator', complianceValidator],
            ['securityAnalyzer', securityAnalyzer]
        ]));
        this.auditRepository = auditRepository;
        this.complianceValidator = complianceValidator;
        this.securityAnalyzer = securityAnalyzer;
    }
    /**
     * Handles security validation events for audit logging
     */
    async handleSecurityValidation(event) {
        try {
            // Create audit entry
            const auditEntry = new audit_entry_1.AuditEntry({
                id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                eventType: 'SECURITY_VALIDATION',
                eventSubtype: event.validationType,
                success: event.success,
                userId: event.userId,
                clientId: event.clientId,
                correlationId: event.correlationId,
                ipAddress: event.details.ipAddress || 'unknown',
                userAgent: event.details.userAgent || 'unknown',
                resource: event.details.resource || null,
                action: event.validationType,
                outcome: event.success ? 'SUCCESS' : 'FAILURE',
                details: {
                    validationType: event.validationType,
                    securityLevel: event.securityLevel,
                    ...event.details
                },
                riskScore: this.calculateRiskScore(event),
                complianceFlags: this.getComplianceFlags(event)
            });
            // Store audit entry
            await this.auditRepository.create(auditEntry);
            // Analyze for security threats
            const threats = await this.securityAnalyzer.analyzeEvent(auditEntry);
            if (threats.length > 0) {
                await this.handleSecurityThreats(threats, auditEntry);
            }
            // Check compliance requirements
            const complianceIssues = await this.complianceValidator.validateEvent(auditEntry);
            if (complianceIssues.length > 0) {
                await this.handleComplianceIssues(complianceIssues, auditEntry);
            }
        }
        catch (error) {
            console.error('Failed to audit security event:', error);
            // Audit failures should not break the system
        }
    }
    /**
     * Handles workflow execution events for audit logging
     */
    async handleWorkflowExecution(event) {
        try {
            const auditEntry = new audit_entry_1.AuditEntry({
                id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                eventType: 'WORKFLOW_EXECUTION',
                eventSubtype: event.success ? 'COMPLETED' : 'FAILED',
                success: event.success,
                userId: event.workflow.metadata?.userId || null,
                clientId: event.clientId,
                correlationId: event.correlationId,
                ipAddress: 'internal',
                userAgent: 'semantest-platform',
                resource: `workflow:${event.workflowId}`,
                action: 'EXECUTE',
                outcome: event.success ? 'SUCCESS' : 'FAILURE',
                details: {
                    workflowId: event.workflowId,
                    executionId: event.executionId,
                    domain: event.workflow.domain,
                    performance: event.performance,
                    error: event.error,
                    issues: event.issues
                },
                riskScore: 0, // Workflow executions are not risky by default
                complianceFlags: ['DATA_PROCESSING']
            });
            await this.auditRepository.create(auditEntry);
            // Check for data processing compliance (GDPR)
            if (event.workflow.metadata?.processesPersonalData) {
                await this.validateGDPRCompliance(auditEntry);
            }
        }
        catch (error) {
            console.error('Failed to audit workflow execution:', error);
        }
    }
    /**
     * Handles client connection events
     */
    async handleClientConnected(event) {
        try {
            const auditEntry = new audit_entry_1.AuditEntry({
                id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                eventType: 'CLIENT_CONNECTION',
                eventSubtype: 'CONNECTED',
                success: true,
                userId: null,
                clientId: event.clientId,
                correlationId: event.correlationId,
                ipAddress: event.metadata.ipAddress || 'unknown',
                userAgent: event.metadata.userAgent || 'unknown',
                resource: `client:${event.clientId}`,
                action: 'CONNECT',
                outcome: 'SUCCESS',
                details: {
                    clientType: event.clientType,
                    version: event.version,
                    capabilities: event.capabilities,
                    metadata: event.metadata
                },
                riskScore: 0,
                complianceFlags: ['CLIENT_MANAGEMENT']
            });
            await this.auditRepository.create(auditEntry);
        }
        catch (error) {
            console.error('Failed to audit client connection:', error);
        }
    }
    /**
     * Handles client disconnection events
     */
    async handleClientDisconnected(event) {
        try {
            const auditEntry = new audit_entry_1.AuditEntry({
                id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                eventType: 'CLIENT_CONNECTION',
                eventSubtype: 'DISCONNECTED',
                success: true,
                userId: null,
                clientId: event.clientId,
                correlationId: event.correlationId,
                ipAddress: 'internal',
                userAgent: 'semantest-platform',
                resource: `client:${event.clientId}`,
                action: 'DISCONNECT',
                outcome: 'SUCCESS',
                details: {
                    reason: event.reason,
                    lastSeen: event.lastSeen.toISOString()
                },
                riskScore: event.reason === 'error' ? 25 : 0,
                complianceFlags: ['CLIENT_MANAGEMENT']
            });
            await this.auditRepository.create(auditEntry);
        }
        catch (error) {
            console.error('Failed to audit client disconnection:', error);
        }
    }
    /**
     * Handles workflow submission events
     */
    async handleWorkflowSubmission(event) {
        try {
            const auditEntry = new audit_entry_1.AuditEntry({
                id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                eventType: 'WORKFLOW_SUBMISSION',
                eventSubtype: 'SUBMITTED',
                success: true,
                userId: event.submittedBy.id,
                clientId: null,
                correlationId: event.correlationId,
                ipAddress: 'api-gateway',
                userAgent: 'semantest-api',
                resource: `workflow:${event.workflowId}`,
                action: 'SUBMIT',
                outcome: 'SUCCESS',
                details: {
                    workflowId: event.workflowId,
                    workflowName: event.workflow.name,
                    domain: event.workflow.domain,
                    priority: event.priority,
                    organizationId: event.submittedBy.organizationId
                },
                riskScore: 0,
                complianceFlags: ['WORKFLOW_MANAGEMENT']
            });
            await this.auditRepository.create(auditEntry);
        }
        catch (error) {
            console.error('Failed to audit workflow submission:', error);
        }
    }
    /**
     * Retrieves audit logs with filtering
     */
    async getAuditLogs(filters) {
        return await this.auditRepository.findByFilters(filters);
    }
    /**
     * Generates compliance report
     */
    async generateComplianceReport(options) {
        const entries = await this.auditRepository.findByDateRange(options.startDate, options.endDate);
        const report = await this.complianceValidator.generateReport(entries, options.reportType, options.includeDetails || false);
        // Store report for audit trail
        const reportAudit = new audit_entry_1.AuditEntry({
            id: `audit-report-${Date.now()}`,
            timestamp: new Date(),
            eventType: 'COMPLIANCE_REPORT',
            eventSubtype: options.reportType,
            success: true,
            userId: 'system',
            clientId: null,
            correlationId: `report-${Date.now()}`,
            ipAddress: 'internal',
            userAgent: 'audit-service',
            resource: 'compliance-report',
            action: 'GENERATE',
            outcome: 'SUCCESS',
            details: {
                reportType: options.reportType,
                startDate: options.startDate.toISOString(),
                endDate: options.endDate.toISOString(),
                entriesAnalyzed: entries.length
            },
            riskScore: 0,
            complianceFlags: ['AUDIT_REPORT']
        });
        await this.auditRepository.create(reportAudit);
        return report;
    }
    /**
     * Exports audit logs for external analysis
     */
    async exportAuditLogs(options) {
        const entries = await this.auditRepository.findByDateRange(options.startDate, options.endDate);
        let exportData;
        switch (options.format) {
            case 'JSON':
                exportData = Buffer.from(JSON.stringify(entries, null, 2));
                break;
            case 'CSV':
                exportData = this.convertToCSV(entries);
                break;
            case 'SIEM':
                exportData = this.convertToSIEMFormat(entries);
                break;
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
        // Encrypt if requested
        if (options.encryptionKey) {
            exportData = await this.encryptData(exportData, options.encryptionKey);
        }
        // Audit the export operation
        await this.auditRepository.create(new audit_entry_1.AuditEntry({
            id: `audit-export-${Date.now()}`,
            timestamp: new Date(),
            eventType: 'AUDIT_EXPORT',
            eventSubtype: options.format,
            success: true,
            userId: 'system',
            clientId: null,
            correlationId: `export-${Date.now()}`,
            ipAddress: 'internal',
            userAgent: 'audit-service',
            resource: 'audit-logs',
            action: 'EXPORT',
            outcome: 'SUCCESS',
            details: {
                format: options.format,
                startDate: options.startDate.toISOString(),
                endDate: options.endDate.toISOString(),
                entriesExported: entries.length,
                encrypted: !!options.encryptionKey
            },
            riskScore: 0,
            complianceFlags: ['DATA_EXPORT']
        }));
        return exportData;
    }
    /**
     * Calculates risk score for security events
     */
    calculateRiskScore(event) {
        let score = 0;
        // Failed authentication attempts
        if (event.validationType === 'authentication' && !event.success) {
            score += 50;
        }
        // Failed authorization attempts
        if (event.validationType === 'authorization' && !event.success) {
            score += 30;
        }
        // Rate limit violations
        if (event.validationType === 'rate-limit' && !event.success) {
            score += 40;
        }
        // Input validation failures
        if (event.validationType === 'input-validation' && !event.success) {
            score += 20;
        }
        // Adjust based on security level
        if (event.securityLevel === 'high' && !event.success) {
            score *= 1.5;
        }
        return Math.min(100, Math.round(score));
    }
    /**
     * Determines compliance flags for events
     */
    getComplianceFlags(event) {
        const flags = [];
        // Authentication events
        if (event.validationType === 'authentication') {
            flags.push('AUTH_TRACKING');
            if (!event.success) {
                flags.push('FAILED_AUTH');
            }
        }
        // Authorization events
        if (event.validationType === 'authorization') {
            flags.push('ACCESS_CONTROL');
            if (!event.success) {
                flags.push('UNAUTHORIZED_ACCESS');
            }
        }
        // Rate limiting
        if (event.validationType === 'rate-limit') {
            flags.push('RATE_LIMITING');
            if (!event.success) {
                flags.push('RATE_LIMIT_EXCEEDED');
            }
        }
        return flags;
    }
    /**
     * Handles detected security threats
     */
    async handleSecurityThreats(threats, auditEntry) {
        // Log threats
        console.warn('Security threats detected:', {
            auditId: auditEntry.id,
            threats: threats.map(t => t.type),
            riskScore: auditEntry.riskScore
        });
        // Create alert audit entries
        for (const threat of threats) {
            await this.auditRepository.create(new audit_entry_1.AuditEntry({
                id: `audit-threat-${Date.now()}`,
                timestamp: new Date(),
                eventType: 'SECURITY_ALERT',
                eventSubtype: threat.type,
                success: false,
                userId: auditEntry.userId,
                clientId: auditEntry.clientId,
                correlationId: auditEntry.correlationId,
                ipAddress: auditEntry.ipAddress,
                userAgent: auditEntry.userAgent,
                resource: auditEntry.resource,
                action: 'THREAT_DETECTED',
                outcome: 'ALERT',
                details: {
                    originalAuditId: auditEntry.id,
                    threatType: threat.type,
                    severity: threat.severity,
                    description: threat.description,
                    recommendations: threat.recommendations
                },
                riskScore: threat.riskScore || 75,
                complianceFlags: ['SECURITY_INCIDENT']
            }));
        }
    }
    /**
     * Handles compliance issues
     */
    async handleComplianceIssues(issues, auditEntry) {
        for (const issue of issues) {
            await this.auditRepository.create(new audit_entry_1.AuditEntry({
                id: `audit-compliance-${Date.now()}`,
                timestamp: new Date(),
                eventType: 'COMPLIANCE_VIOLATION',
                eventSubtype: issue.regulation,
                success: false,
                userId: auditEntry.userId,
                clientId: auditEntry.clientId,
                correlationId: auditEntry.correlationId,
                ipAddress: auditEntry.ipAddress,
                userAgent: auditEntry.userAgent,
                resource: auditEntry.resource,
                action: 'COMPLIANCE_CHECK',
                outcome: 'VIOLATION',
                details: {
                    originalAuditId: auditEntry.id,
                    regulation: issue.regulation,
                    requirement: issue.requirement,
                    violation: issue.violation,
                    remediation: issue.remediation
                },
                riskScore: issue.severity * 20,
                complianceFlags: [issue.regulation, 'COMPLIANCE_ISSUE']
            }));
        }
    }
    /**
     * Validates GDPR compliance for data processing
     */
    async validateGDPRCompliance(auditEntry) {
        const gdprChecks = await this.complianceValidator.validateGDPR(auditEntry);
        if (!gdprChecks.compliant) {
            await this.handleComplianceIssues(gdprChecks.violations.map(v => ({
                regulation: 'GDPR',
                requirement: v.article,
                violation: v.description,
                remediation: v.remediation,
                severity: v.severity
            })), auditEntry);
        }
    }
    /**
     * Converts audit entries to CSV format
     */
    convertToCSV(entries) {
        const headers = [
            'ID', 'Timestamp', 'Event Type', 'Event Subtype', 'Success',
            'User ID', 'Client ID', 'IP Address', 'Resource', 'Action',
            'Outcome', 'Risk Score', 'Compliance Flags'
        ].join(',');
        const rows = entries.map(entry => [
            entry.id,
            entry.timestamp.toISOString(),
            entry.eventType,
            entry.eventSubtype,
            entry.success,
            entry.userId || '',
            entry.clientId || '',
            entry.ipAddress,
            entry.resource || '',
            entry.action,
            entry.outcome,
            entry.riskScore,
            entry.complianceFlags.join(';')
        ].map(v => `"${v}"`).join(','));
        return Buffer.from([headers, ...rows].join('\n'));
    }
    /**
     * Converts audit entries to SIEM format
     */
    convertToSIEMFormat(entries) {
        const siemEvents = entries.map(entry => ({
            '@timestamp': entry.timestamp.toISOString(),
            'event.kind': 'event',
            'event.category': entry.eventType.toLowerCase(),
            'event.type': entry.eventSubtype.toLowerCase(),
            'event.outcome': entry.outcome.toLowerCase(),
            'user.id': entry.userId,
            'client.id': entry.clientId,
            'source.ip': entry.ipAddress,
            'user_agent.original': entry.userAgent,
            'event.risk_score': entry.riskScore,
            'labels': entry.complianceFlags,
            'semantest.correlation_id': entry.correlationId,
            'semantest.details': entry.details
        }));
        return Buffer.from(siemEvents.map(e => JSON.stringify(e)).join('\n'));
    }
    /**
     * Encrypts data (placeholder - implement actual encryption)
     */
    async encryptData(data, key) {
        // TODO: Implement actual encryption using crypto module
        console.log('Encrypting data with key length:', key.length);
        return data; // Placeholder
    }
    /**
     * Gets service health status
     */
    async getHealthStatus() {
        try {
            const recentEntries = await this.auditRepository.getRecentEntryCount();
            const storageStatus = await this.auditRepository.getStorageStatus();
            return {
                status: 'healthy',
                details: {
                    recentEntries,
                    storageStatus,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
}
exports.AuditService = AuditService;
__decorate([
    (0, typescript_eda_infrastructure_1.Listen)('SecurityValidationEvent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cloud_events_1.SecurityValidationEvent]),
    __metadata("design:returntype", Promise)
], AuditService.prototype, "handleSecurityValidation", null);
__decorate([
    (0, typescript_eda_infrastructure_1.Listen)('WorkflowExecutionCompletedEvent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cloud_events_1.WorkflowExecutionCompletedEvent]),
    __metadata("design:returntype", Promise)
], AuditService.prototype, "handleWorkflowExecution", null);
__decorate([
    (0, typescript_eda_infrastructure_1.Listen)('ClientConnectedEvent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cloud_events_1.ClientConnectedEvent]),
    __metadata("design:returntype", Promise)
], AuditService.prototype, "handleClientConnected", null);
__decorate([
    (0, typescript_eda_infrastructure_1.Listen)('ClientDisconnectedEvent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cloud_events_1.ClientDisconnectedEvent]),
    __metadata("design:returntype", Promise)
], AuditService.prototype, "handleClientDisconnected", null);
__decorate([
    (0, typescript_eda_infrastructure_1.Listen)('AutomationWorkflowSubmittedEvent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cloud_events_1.AutomationWorkflowSubmittedEvent]),
    __metadata("design:returntype", Promise)
], AuditService.prototype, "handleWorkflowSubmission", null);
//# sourceMappingURL=audit-service.js.map