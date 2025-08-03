"use strict";
/**
 * Enterprise Security Incident Response Service
 * Automated threat detection and response system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentResponseService = exports.IncidentResponseService = void 0;
const events_1 = require("events");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
const performance_metrics_1 = require("../monitoring/infrastructure/performance-metrics");
class IncidentResponseService extends events_1.EventEmitter {
    constructor() {
        super();
        this.incidents = new Map();
        this.threatRules = new Map();
        this.isInitialized = false;
        this.processingQueue = [];
        this.maxConcurrentProcessing = 5;
        this.currentProcessing = 0;
        this.setupDefaultThreatRules();
        this.setupCleanupSchedule();
    }
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Incident response service already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing incident response service');
        try {
            // Load saved incidents and rules
            await this.loadPersistedData();
            // Start processing queue
            this.startProcessingQueue();
            this.isInitialized = true;
            structured_logger_1.logger.info('Incident response service initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize incident response service', error);
            throw error;
        }
    }
    /**
     * Analyze audit entry for security threats
     */
    async analyzeAuditEntry(auditEntry) {
        const detectedIncidents = [];
        for (const [ruleId, rule] of this.threatRules) {
            if (!rule.enabled)
                continue;
            // Check cooldown period
            if (rule.lastTriggered &&
                (Date.now() - rule.lastTriggered.getTime()) < rule.cooldownPeriod * 1000) {
                continue;
            }
            if (this.evaluateRule(rule, auditEntry)) {
                const incident = await this.createIncident(rule, auditEntry);
                detectedIncidents.push(incident);
                // Update rule statistics
                rule.lastTriggered = new Date();
                rule.triggerCount++;
                // Execute automated actions
                await this.executeAutomatedActions(rule, incident);
            }
        }
        return detectedIncidents;
    }
    /**
     * Create security incident
     */
    async createIncident(rule, auditEntry, manualData) {
        const incident = {
            id: this.generateIncidentId(),
            title: manualData?.title || `${rule.name} - ${auditEntry.eventType}`,
            description: manualData?.description || `Security incident detected by rule: ${rule.name}`,
            severity: manualData?.severity || rule.severity,
            status: 'detected',
            type: this.inferIncidentType(rule, auditEntry),
            detectedAt: new Date(),
            updatedAt: new Date(),
            affectedSystems: manualData?.affectedSystems || [auditEntry.resource || 'unknown'],
            affectedUsers: manualData?.affectedUsers || (auditEntry.userId ? [auditEntry.userId] : []),
            evidenceIds: [auditEntry.id],
            responseActions: [],
            priority: this.calculatePriority(rule.severity, auditEntry.riskScore),
            tags: manualData?.tags || [rule.name, auditEntry.eventType],
            metadata: {
                ruleId: rule.id,
                correlationId: auditEntry.correlationId,
                ipAddress: auditEntry.ipAddress,
                userAgent: auditEntry.userAgent,
                originalAuditEntry: auditEntry,
                ...manualData?.metadata
            }
        };
        this.incidents.set(incident.id, incident);
        // Track incident creation
        performance_metrics_1.performanceMetrics.increment('security.incidents.created', 1, {
            severity: incident.severity,
            type: incident.type,
            ruleId: rule.id
        });
        structured_logger_1.logger.warn('Security incident created', {
            incidentId: incident.id,
            title: incident.title,
            severity: incident.severity,
            type: incident.type,
            ruleId: rule.id
        });
        this.emit('incidentCreated', incident);
        return incident;
    }
    /**
     * Update incident status
     */
    async updateIncident(incidentId, updates, updatedBy) {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        const updatedIncident = {
            ...incident,
            ...updates,
            updatedAt: new Date()
        };
        // Set resolved time if status changed to resolved
        if (updates.status === 'resolved' && incident.status !== 'resolved') {
            updatedIncident.resolvedAt = new Date();
        }
        this.incidents.set(incidentId, updatedIncident);
        // Log status change
        if (updates.status && updates.status !== incident.status) {
            const action = {
                id: this.generateActionId(),
                type: 'notify_admin',
                description: `Status changed from ${incident.status} to ${updates.status}`,
                executedAt: new Date(),
                executedBy: updatedBy,
                success: true,
                rollbackPossible: false
            };
            updatedIncident.responseActions.push(action);
        }
        // Track incident update
        performance_metrics_1.performanceMetrics.increment('security.incidents.updated', 1, {
            severity: updatedIncident.severity,
            status: updatedIncident.status
        });
        structured_logger_1.logger.info('Security incident updated', {
            incidentId,
            status: updatedIncident.status,
            updatedBy
        });
        this.emit('incidentUpdated', updatedIncident);
        return updatedIncident;
    }
    /**
     * Execute security action
     */
    async executeAction(incidentId, actionType, parameters, executedBy) {
        const incident = this.incidents.get(incidentId);
        if (!incident) {
            throw new Error(`Incident not found: ${incidentId}`);
        }
        const action = {
            id: this.generateActionId(),
            type: actionType,
            description: `Manual action: ${actionType}`,
            executedAt: new Date(),
            executedBy,
            success: false,
            rollbackPossible: false
        };
        try {
            switch (actionType) {
                case 'block_ip':
                    await this.blockIP(parameters.ipAddress);
                    action.success = true;
                    action.result = `IP ${parameters.ipAddress} blocked`;
                    action.rollbackPossible = true;
                    action.rollbackInstructions = `Unblock IP ${parameters.ipAddress}`;
                    break;
                case 'disable_user':
                    await this.disableUser(parameters.userId);
                    action.success = true;
                    action.result = `User ${parameters.userId} disabled`;
                    action.rollbackPossible = true;
                    action.rollbackInstructions = `Re-enable user ${parameters.userId}`;
                    break;
                case 'isolate_system':
                    await this.isolateSystem(parameters.systemId);
                    action.success = true;
                    action.result = `System ${parameters.systemId} isolated`;
                    action.rollbackPossible = true;
                    action.rollbackInstructions = `Remove isolation from system ${parameters.systemId}`;
                    break;
                case 'rotate_keys':
                    await this.rotateKeys(parameters.keyType, parameters.scope);
                    action.success = true;
                    action.result = `Keys rotated for ${parameters.keyType}`;
                    action.rollbackPossible = false;
                    break;
                case 'notify_admin':
                    await this.notifyAdmin(parameters.message, parameters.urgency);
                    action.success = true;
                    action.result = 'Admin notification sent';
                    action.rollbackPossible = false;
                    break;
                case 'create_ticket':
                    const ticketId = await this.createTicket(parameters.title, parameters.description);
                    action.success = true;
                    action.result = `Ticket created: ${ticketId}`;
                    action.rollbackPossible = false;
                    break;
                case 'backup_data':
                    await this.backupData(parameters.dataType, parameters.scope);
                    action.success = true;
                    action.result = `Data backup completed for ${parameters.dataType}`;
                    action.rollbackPossible = false;
                    break;
                default:
                    throw new Error(`Unknown action type: ${actionType}`);
            }
            // Update incident
            incident.responseActions.push(action);
            incident.updatedAt = new Date();
            this.incidents.set(incidentId, incident);
            // Track action execution
            performance_metrics_1.performanceMetrics.increment('security.actions.executed', 1, {
                actionType,
                success: action.success.toString()
            });
            structured_logger_1.logger.info('Security action executed', {
                incidentId,
                actionType,
                success: action.success,
                executedBy
            });
            this.emit('actionExecuted', { incident, action });
            return action;
        }
        catch (error) {
            action.success = false;
            action.result = error.message;
            incident.responseActions.push(action);
            incident.updatedAt = new Date();
            this.incidents.set(incidentId, incident);
            structured_logger_1.logger.error('Security action failed', {
                incidentId,
                actionType,
                error: error.message,
                executedBy
            });
            throw error;
        }
    }
    /**
     * Get security dashboard data
     */
    getDashboard() {
        const incidents = Array.from(this.incidents.values());
        const activeIncidents = incidents.filter(i => i.status !== 'closed');
        // Group by type
        const incidentsByType = incidents.reduce((acc, incident) => {
            acc[incident.type] = (acc[incident.type] || 0) + 1;
            return acc;
        }, {});
        // Group by severity
        const incidentsBySeverity = incidents.reduce((acc, incident) => {
            acc[incident.severity] = (acc[incident.severity] || 0) + 1;
            return acc;
        }, {});
        // Calculate average resolution time
        const resolvedIncidents = incidents.filter(i => i.resolvedAt);
        const averageResolutionTime = resolvedIncidents.length > 0
            ? resolvedIncidents.reduce((sum, incident) => {
                return sum + (incident.resolvedAt.getTime() - incident.detectedAt.getTime());
            }, 0) / resolvedIncidents.length
            : 0;
        // Count automated actions today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const automatedActionsToday = incidents.reduce((count, incident) => {
            return count + incident.responseActions.filter(action => action.executedAt >= today && action.executedBy === 'system').length;
        }, 0);
        // Calculate system health score
        const systemHealthScore = this.calculateSystemHealthScore(incidents);
        return {
            activeIncidents,
            totalIncidents: incidents.length,
            incidentsByType,
            incidentsBySeverity,
            averageResolutionTime,
            threatRulesActive: Array.from(this.threatRules.values()).filter(r => r.enabled).length,
            automatedActionsToday,
            systemHealthScore,
            lastUpdated: new Date()
        };
    }
    /**
     * Get incident by ID
     */
    getIncident(incidentId) {
        return this.incidents.get(incidentId) || null;
    }
    /**
     * List incidents with filters
     */
    listIncidents(filters) {
        let incidents = Array.from(this.incidents.values());
        // Apply filters
        if (filters.status) {
            incidents = incidents.filter(i => i.status === filters.status);
        }
        if (filters.severity) {
            incidents = incidents.filter(i => i.severity === filters.severity);
        }
        if (filters.type) {
            incidents = incidents.filter(i => i.type === filters.type);
        }
        if (filters.startDate) {
            incidents = incidents.filter(i => i.detectedAt >= filters.startDate);
        }
        if (filters.endDate) {
            incidents = incidents.filter(i => i.detectedAt <= filters.endDate);
        }
        // Sort by priority and detection time
        incidents.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return b.detectedAt.getTime() - a.detectedAt.getTime();
        });
        // Apply pagination
        const start = filters.offset || 0;
        const end = filters.limit ? start + filters.limit : incidents.length;
        return incidents.slice(start, end);
    }
    setupDefaultThreatRules() {
        // Failed authentication attempts
        this.threatRules.set('failed-auth-attempts', {
            id: 'failed-auth-attempts',
            name: 'Multiple Failed Authentication Attempts',
            description: 'Detects multiple failed authentication attempts from the same IP',
            enabled: true,
            severity: 'high',
            conditions: [
                {
                    field: 'eventType',
                    operator: 'equals',
                    value: 'SECURITY_VALIDATION'
                },
                {
                    field: 'eventSubtype',
                    operator: 'equals',
                    value: 'authentication'
                },
                {
                    field: 'success',
                    operator: 'equals',
                    value: false
                },
                {
                    field: 'ipAddress',
                    operator: 'equals',
                    value: '{{dynamic}}', // Will be replaced with actual IP
                    timeWindow: 300, // 5 minutes
                    threshold: 5
                }
            ],
            actions: [
                {
                    type: 'block_ip',
                    parameters: { duration: 3600 }, // 1 hour
                    enabled: true,
                    requiresApproval: false
                },
                {
                    type: 'notify_admin',
                    parameters: { urgency: 'high' },
                    enabled: true,
                    requiresApproval: false
                }
            ],
            cooldownPeriod: 300,
            triggerCount: 0,
            falsePositiveRate: 0.05
        });
        // Privilege escalation attempts
        this.threatRules.set('privilege-escalation', {
            id: 'privilege-escalation',
            name: 'Privilege Escalation Attempt',
            description: 'Detects attempts to access resources with insufficient privileges',
            enabled: true,
            severity: 'critical',
            conditions: [
                {
                    field: 'eventType',
                    operator: 'equals',
                    value: 'SECURITY_VALIDATION'
                },
                {
                    field: 'eventSubtype',
                    operator: 'equals',
                    value: 'authorization'
                },
                {
                    field: 'success',
                    operator: 'equals',
                    value: false
                },
                {
                    field: 'riskScore',
                    operator: 'greater_than',
                    value: 70
                }
            ],
            actions: [
                {
                    type: 'disable_user',
                    parameters: { temporary: true, duration: 1800 }, // 30 minutes
                    enabled: true,
                    requiresApproval: false
                },
                {
                    type: 'notify_admin',
                    parameters: { urgency: 'critical' },
                    enabled: true,
                    requiresApproval: false
                }
            ],
            cooldownPeriod: 60,
            triggerCount: 0,
            falsePositiveRate: 0.02
        });
        // Suspicious data access patterns
        this.threatRules.set('suspicious-data-access', {
            id: 'suspicious-data-access',
            name: 'Suspicious Data Access Pattern',
            description: 'Detects unusual data access patterns that might indicate data exfiltration',
            enabled: true,
            severity: 'medium',
            conditions: [
                {
                    field: 'eventType',
                    operator: 'equals',
                    value: 'WORKFLOW_EXECUTION'
                },
                {
                    field: 'details.domain',
                    operator: 'contains',
                    value: 'data'
                },
                {
                    field: 'userId',
                    operator: 'equals',
                    value: '{{dynamic}}',
                    timeWindow: 1800, // 30 minutes
                    threshold: 10
                }
            ],
            actions: [
                {
                    type: 'backup_data',
                    parameters: { scope: 'affected_datasets' },
                    enabled: true,
                    requiresApproval: false
                },
                {
                    type: 'notify_admin',
                    parameters: { urgency: 'medium' },
                    enabled: true,
                    requiresApproval: false
                }
            ],
            cooldownPeriod: 1800,
            triggerCount: 0,
            falsePositiveRate: 0.10
        });
        structured_logger_1.logger.info('Default threat rules configured', {
            ruleCount: this.threatRules.size
        });
    }
    evaluateRule(rule, auditEntry) {
        for (const condition of rule.conditions) {
            if (!this.evaluateCondition(condition, auditEntry)) {
                return false;
            }
        }
        return true;
    }
    evaluateCondition(condition, auditEntry) {
        const fieldValue = this.getFieldValue(condition.field, auditEntry);
        switch (condition.operator) {
            case 'equals':
                return fieldValue === condition.value;
            case 'contains':
                return String(fieldValue).includes(String(condition.value));
            case 'greater_than':
                return Number(fieldValue) > Number(condition.value);
            case 'less_than':
                return Number(fieldValue) < Number(condition.value);
            case 'matches_regex':
                return new RegExp(condition.value).test(String(fieldValue));
            case 'in_range':
                const [min, max] = condition.value;
                return Number(fieldValue) >= min && Number(fieldValue) <= max;
            default:
                return false;
        }
    }
    getFieldValue(field, auditEntry) {
        const fieldParts = field.split('.');
        let value = auditEntry;
        for (const part of fieldParts) {
            if (value && typeof value === 'object') {
                value = value[part];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    async executeAutomatedActions(rule, incident) {
        for (const actionConfig of rule.actions) {
            if (!actionConfig.enabled)
                continue;
            if (actionConfig.requiresApproval) {
                // Queue for manual approval
                await this.queueForApproval(incident, actionConfig);
            }
            else {
                // Execute immediately
                try {
                    await this.executeAction(incident.id, actionConfig.type, actionConfig.parameters, 'system');
                }
                catch (error) {
                    structured_logger_1.logger.error('Automated action failed', {
                        incidentId: incident.id,
                        actionType: actionConfig.type,
                        error: error.message
                    });
                }
            }
        }
    }
    async queueForApproval(incident, actionConfig) {
        structured_logger_1.logger.info('Action queued for approval', {
            incidentId: incident.id,
            actionType: actionConfig.type
        });
        // In a real system, this would integrate with an approval workflow
        this.emit('actionRequiresApproval', { incident, actionConfig });
    }
    inferIncidentType(rule, auditEntry) {
        if (rule.id.includes('auth'))
            return 'unauthorized_access';
        if (rule.id.includes('privilege'))
            return 'unauthorized_access';
        if (rule.id.includes('data'))
            return 'data_breach';
        if (rule.id.includes('compliance'))
            return 'compliance_violation';
        if (auditEntry.eventType === 'SECURITY_VALIDATION')
            return 'unauthorized_access';
        return 'unauthorized_access';
    }
    calculatePriority(severity, riskScore) {
        let priority = 3; // Default medium priority
        switch (severity) {
            case 'critical':
                priority = 5;
                break;
            case 'high':
                priority = 4;
                break;
            case 'medium':
                priority = 3;
                break;
            case 'low':
                priority = 2;
                break;
        }
        // Adjust based on risk score
        if (riskScore > 80)
            priority = Math.min(5, priority + 1);
        if (riskScore < 30)
            priority = Math.max(1, priority - 1);
        return priority;
    }
    calculateSystemHealthScore(incidents) {
        let score = 100;
        // Recent critical incidents
        const recentCritical = incidents.filter(i => i.severity === 'critical' &&
            i.detectedAt > new Date(Date.now() - 24 * 60 * 60 * 1000));
        score -= recentCritical.length * 20;
        // Recent high severity incidents
        const recentHigh = incidents.filter(i => i.severity === 'high' &&
            i.detectedAt > new Date(Date.now() - 24 * 60 * 60 * 1000));
        score -= recentHigh.length * 10;
        // Unresolved incidents
        const unresolved = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
        score -= unresolved.length * 5;
        return Math.max(0, Math.min(100, score));
    }
    // Mock action implementations - would integrate with actual systems
    async blockIP(ipAddress) {
        structured_logger_1.logger.info('Blocking IP address', { ipAddress });
        // Integration with firewall/WAF
    }
    async disableUser(userId) {
        structured_logger_1.logger.info('Disabling user account', { userId });
        // Integration with identity provider
    }
    async isolateSystem(systemId) {
        structured_logger_1.logger.info('Isolating system', { systemId });
        // Integration with infrastructure management
    }
    async rotateKeys(keyType, scope) {
        structured_logger_1.logger.info('Rotating keys', { keyType, scope });
        // Integration with key management system
    }
    async notifyAdmin(message, urgency) {
        structured_logger_1.logger.info('Notifying admin', { message, urgency });
        // Integration with notification system
    }
    async createTicket(title, description) {
        const ticketId = `TICKET-${Date.now()}`;
        structured_logger_1.logger.info('Creating support ticket', { ticketId, title });
        // Integration with ticketing system
        return ticketId;
    }
    async backupData(dataType, scope) {
        structured_logger_1.logger.info('Backing up data', { dataType, scope });
        // Integration with backup system
    }
    async loadPersistedData() {
        // Load from database/file storage
        structured_logger_1.logger.info('Loading persisted incident data');
    }
    startProcessingQueue() {
        setInterval(() => {
            this.processQueue();
        }, 1000);
    }
    async processQueue() {
        if (this.currentProcessing >= this.maxConcurrentProcessing) {
            return;
        }
        const incidentId = this.processingQueue.shift();
        if (!incidentId) {
            return;
        }
        this.currentProcessing++;
        try {
            const incident = this.incidents.get(incidentId);
            if (incident) {
                await this.processIncident(incident);
            }
        }
        catch (error) {
            structured_logger_1.logger.error('Error processing incident', { incidentId, error: error.message });
        }
        finally {
            this.currentProcessing--;
        }
    }
    async processIncident(incident) {
        structured_logger_1.logger.debug('Processing incident', { incidentId: incident.id });
        // Custom incident processing logic
    }
    setupCleanupSchedule() {
        // Clean up closed incidents older than 30 days
        setInterval(() => {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            for (const [id, incident] of this.incidents) {
                if (incident.status === 'closed' && incident.updatedAt < cutoff) {
                    this.incidents.delete(id);
                }
            }
        }, 24 * 60 * 60 * 1000); // Daily cleanup
    }
    generateIncidentId() {
        return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateActionId() {
        return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        structured_logger_1.logger.info('Shutting down incident response service');
        this.removeAllListeners();
    }
}
exports.IncidentResponseService = IncidentResponseService;
exports.incidentResponseService = new IncidentResponseService();
//# sourceMappingURL=incident-response.service.js.map