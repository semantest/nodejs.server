/**
 * Enterprise Security Incident Response Service
 * Automated threat detection and response system
 */

import { EventEmitter } from 'events';
import { logger } from '../monitoring/infrastructure/structured-logger';
import { performanceMetrics } from '../monitoring/infrastructure/performance-metrics';
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
  priority: number; // 1-5 scale
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
  cooldownPeriod: number; // in seconds
  lastTriggered?: Date;
  triggerCount: number;
  falsePositiveRate: number;
}

export interface ThreatCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex' | 'in_range';
  value: any;
  timeWindow?: number; // in seconds
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

export class IncidentResponseService extends EventEmitter {
  private incidents: Map<string, SecurityIncident> = new Map();
  private threatRules: Map<string, ThreatRule> = new Map();
  private isInitialized = false;
  private processingQueue: string[] = [];
  private maxConcurrentProcessing = 5;
  private currentProcessing = 0;

  constructor() {
    super();
    this.setupDefaultThreatRules();
    this.setupCleanupSchedule();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Incident response service already initialized');
      return;
    }

    logger.info('Initializing incident response service');

    try {
      // Load saved incidents and rules
      await this.loadPersistedData();
      
      // Start processing queue
      this.startProcessingQueue();
      
      this.isInitialized = true;
      logger.info('Incident response service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize incident response service', error);
      throw error;
    }
  }

  /**
   * Analyze audit entry for security threats
   */
  async analyzeAuditEntry(auditEntry: AuditEntry): Promise<SecurityIncident[]> {
    const detectedIncidents: SecurityIncident[] = [];

    for (const [ruleId, rule] of this.threatRules) {
      if (!rule.enabled) continue;

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
  async createIncident(
    rule: ThreatRule,
    auditEntry: AuditEntry,
    manualData?: Partial<SecurityIncident>
  ): Promise<SecurityIncident> {
    const incident: SecurityIncident = {
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
    performanceMetrics.increment('security.incidents.created', 1, {
      severity: incident.severity,
      type: incident.type,
      ruleId: rule.id
    });

    logger.warn('Security incident created', {
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
  async updateIncident(
    incidentId: string,
    updates: Partial<SecurityIncident>,
    updatedBy: string
  ): Promise<SecurityIncident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const updatedIncident: SecurityIncident = {
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
      const action: SecurityAction = {
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
    performanceMetrics.increment('security.incidents.updated', 1, {
      severity: updatedIncident.severity,
      status: updatedIncident.status
    });

    logger.info('Security incident updated', {
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
  async executeAction(
    incidentId: string,
    actionType: SecurityAction['type'],
    parameters: Record<string, any>,
    executedBy: string
  ): Promise<SecurityAction> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const action: SecurityAction = {
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
      performanceMetrics.increment('security.actions.executed', 1, {
        actionType,
        success: action.success.toString()
      });

      logger.info('Security action executed', {
        incidentId,
        actionType,
        success: action.success,
        executedBy
      });

      this.emit('actionExecuted', { incident, action });
      return action;

    } catch (error) {
      action.success = false;
      action.result = error.message;
      
      incident.responseActions.push(action);
      incident.updatedAt = new Date();
      this.incidents.set(incidentId, incident);

      logger.error('Security action failed', {
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
  getDashboard(): SecurityDashboard {
    const incidents = Array.from(this.incidents.values());
    const activeIncidents = incidents.filter(i => i.status !== 'closed');
    
    // Group by type
    const incidentsByType = incidents.reduce((acc, incident) => {
      acc[incident.type] = (acc[incident.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by severity
    const incidentsBySeverity = incidents.reduce((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average resolution time
    const resolvedIncidents = incidents.filter(i => i.resolvedAt);
    const averageResolutionTime = resolvedIncidents.length > 0 
      ? resolvedIncidents.reduce((sum, incident) => {
          return sum + (incident.resolvedAt!.getTime() - incident.detectedAt.getTime());
        }, 0) / resolvedIncidents.length
      : 0;

    // Count automated actions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const automatedActionsToday = incidents.reduce((count, incident) => {
      return count + incident.responseActions.filter(action => 
        action.executedAt >= today && action.executedBy === 'system'
      ).length;
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
  getIncident(incidentId: string): SecurityIncident | null {
    return this.incidents.get(incidentId) || null;
  }

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
  }): SecurityIncident[] {
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
      incidents = incidents.filter(i => i.detectedAt >= filters.startDate!);
    }
    if (filters.endDate) {
      incidents = incidents.filter(i => i.detectedAt <= filters.endDate!);
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

  private setupDefaultThreatRules(): void {
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

    logger.info('Default threat rules configured', {
      ruleCount: this.threatRules.size
    });
  }

  private evaluateRule(rule: ThreatRule, auditEntry: AuditEntry): boolean {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, auditEntry)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(condition: ThreatCondition, auditEntry: AuditEntry): boolean {
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

  private getFieldValue(field: string, auditEntry: AuditEntry): any {
    const fieldParts = field.split('.');
    let value: any = auditEntry;
    
    for (const part of fieldParts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private async executeAutomatedActions(rule: ThreatRule, incident: SecurityIncident): Promise<void> {
    for (const actionConfig of rule.actions) {
      if (!actionConfig.enabled) continue;
      
      if (actionConfig.requiresApproval) {
        // Queue for manual approval
        await this.queueForApproval(incident, actionConfig);
      } else {
        // Execute immediately
        try {
          await this.executeAction(
            incident.id,
            actionConfig.type,
            actionConfig.parameters,
            'system'
          );
        } catch (error) {
          logger.error('Automated action failed', {
            incidentId: incident.id,
            actionType: actionConfig.type,
            error: error.message
          });
        }
      }
    }
  }

  private async queueForApproval(incident: SecurityIncident, actionConfig: AutomatedAction): Promise<void> {
    logger.info('Action queued for approval', {
      incidentId: incident.id,
      actionType: actionConfig.type
    });
    
    // In a real system, this would integrate with an approval workflow
    this.emit('actionRequiresApproval', { incident, actionConfig });
  }

  private inferIncidentType(rule: ThreatRule, auditEntry: AuditEntry): SecurityIncident['type'] {
    if (rule.id.includes('auth')) return 'unauthorized_access';
    if (rule.id.includes('privilege')) return 'unauthorized_access';
    if (rule.id.includes('data')) return 'data_breach';
    if (rule.id.includes('compliance')) return 'compliance_violation';
    if (auditEntry.eventType === 'SECURITY_VALIDATION') return 'unauthorized_access';
    return 'unauthorized_access';
  }

  private calculatePriority(severity: string, riskScore: number): number {
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
    if (riskScore > 80) priority = Math.min(5, priority + 1);
    if (riskScore < 30) priority = Math.max(1, priority - 1);
    
    return priority;
  }

  private calculateSystemHealthScore(incidents: SecurityIncident[]): number {
    let score = 100;
    
    // Recent critical incidents
    const recentCritical = incidents.filter(i => 
      i.severity === 'critical' && 
      i.detectedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    score -= recentCritical.length * 20;
    
    // Recent high severity incidents
    const recentHigh = incidents.filter(i => 
      i.severity === 'high' && 
      i.detectedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    score -= recentHigh.length * 10;
    
    // Unresolved incidents
    const unresolved = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
    score -= unresolved.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  // Mock action implementations - would integrate with actual systems
  private async blockIP(ipAddress: string): Promise<void> {
    logger.info('Blocking IP address', { ipAddress });
    // Integration with firewall/WAF
  }

  private async disableUser(userId: string): Promise<void> {
    logger.info('Disabling user account', { userId });
    // Integration with identity provider
  }

  private async isolateSystem(systemId: string): Promise<void> {
    logger.info('Isolating system', { systemId });
    // Integration with infrastructure management
  }

  private async rotateKeys(keyType: string, scope: string): Promise<void> {
    logger.info('Rotating keys', { keyType, scope });
    // Integration with key management system
  }

  private async notifyAdmin(message: string, urgency: string): Promise<void> {
    logger.info('Notifying admin', { message, urgency });
    // Integration with notification system
  }

  private async createTicket(title: string, description: string): Promise<string> {
    const ticketId = `TICKET-${Date.now()}`;
    logger.info('Creating support ticket', { ticketId, title });
    // Integration with ticketing system
    return ticketId;
  }

  private async backupData(dataType: string, scope: string): Promise<void> {
    logger.info('Backing up data', { dataType, scope });
    // Integration with backup system
  }

  private async loadPersistedData(): Promise<void> {
    // Load from database/file storage
    logger.info('Loading persisted incident data');
  }

  private startProcessingQueue(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  private async processQueue(): Promise<void> {
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
    } catch (error) {
      logger.error('Error processing incident', { incidentId, error: error.message });
    } finally {
      this.currentProcessing--;
    }
  }

  private async processIncident(incident: SecurityIncident): Promise<void> {
    logger.debug('Processing incident', { incidentId: incident.id });
    // Custom incident processing logic
  }

  private setupCleanupSchedule(): void {
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

  private generateIncidentId(): string {
    return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down incident response service');
    this.removeAllListeners();
  }
}

export const incidentResponseService = new IncidentResponseService();