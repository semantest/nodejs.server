/**
 * Enterprise Security Incident Response Service
 * Automated threat detection and response system
 */
import { EventEmitter } from 'events';
import { AuditEntry } from './domain/audit-entry';
export interface SecurityIncident {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'detected' | 'investigating' | 'contained' | 'resolved' | 'closed';
    type: 'unauthorized_access' | 'malware' | 'data_breach' | 'ddos' | 'insider_threat' | 'compliance_violation';
    detectedAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
    affectedSystems: string[];
    affectedUsers: string[];
    evidenceIds: string[];
    responseActions: SecurityAction[];
    assignedTo?: string;
    priority: number;
    tags: string[];
    metadata: Record<string, any>;
}
export interface SecurityAction {
    id: string;
    type: 'block_ip' | 'disable_user' | 'isolate_system' | 'rotate_keys' | 'notify_admin' | 'create_ticket' | 'backup_data';
    description: string;
    executedAt: Date;
    executedBy: string;
    success: boolean;
    result?: string;
    rollbackPossible: boolean;
    rollbackInstructions?: string;
}
export interface ThreatRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: SecurityIncident['severity'];
    conditions: ThreatCondition[];
    actions: AutomatedAction[];
    cooldownPeriod: number;
    lastTriggered?: Date;
    triggerCount: number;
    falsePositiveRate: number;
}
export interface ThreatCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex' | 'in_range';
    value: any;
    timeWindow?: number;
    threshold?: number;
}
export interface AutomatedAction {
    type: SecurityAction['type'];
    parameters: Record<string, any>;
    enabled: boolean;
    requiresApproval: boolean;
}
export interface SecurityDashboard {
    activeIncidents: SecurityIncident[];
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
    averageResolutionTime: number;
    threatRulesActive: number;
    automatedActionsToday: number;
    systemHealthScore: number;
    lastUpdated: Date;
}
export declare class IncidentResponseService extends EventEmitter {
    private incidents;
    private threatRules;
    private isInitialized;
    private processingQueue;
    private maxConcurrentProcessing;
    private currentProcessing;
    constructor();
    initialize(): Promise<void>;
    /**
     * Analyze audit entry for security threats
     */
    analyzeAuditEntry(auditEntry: AuditEntry): Promise<SecurityIncident[]>;
    /**
     * Create security incident
     */
    createIncident(rule: ThreatRule, auditEntry: AuditEntry, manualData?: Partial<SecurityIncident>): Promise<SecurityIncident>;
    /**
     * Update incident status
     */
    updateIncident(incidentId: string, updates: Partial<SecurityIncident>, updatedBy: string): Promise<SecurityIncident>;
    /**
     * Execute security action
     */
    executeAction(incidentId: string, actionType: SecurityAction['type'], parameters: Record<string, any>, executedBy: string): Promise<SecurityAction>;
    /**
     * Get security dashboard data
     */
    getDashboard(): SecurityDashboard;
    /**
     * Get incident by ID
     */
    getIncident(incidentId: string): SecurityIncident | null;
    /**
     * List incidents with filters
     */
    listIncidents(filters: {
        status?: SecurityIncident['status'];
        severity?: SecurityIncident['severity'];
        type?: SecurityIncident['type'];
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): SecurityIncident[];
    private setupDefaultThreatRules;
    private evaluateRule;
    private evaluateCondition;
    private getFieldValue;
    private executeAutomatedActions;
    private queueForApproval;
    private inferIncidentType;
    private calculatePriority;
    private calculateSystemHealthScore;
    private blockIP;
    private disableUser;
    private isolateSystem;
    private rotateKeys;
    private notifyAdmin;
    private createTicket;
    private backupData;
    private loadPersistedData;
    private startProcessingQueue;
    private processQueue;
    private processIncident;
    private setupCleanupSchedule;
    private generateIncidentId;
    private generateActionId;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
export declare const incidentResponseService: IncidentResponseService;
//# sourceMappingURL=incident-response.service.d.ts.map