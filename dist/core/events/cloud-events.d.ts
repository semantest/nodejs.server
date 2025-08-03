import { Event } from 'typescript-eda-domain';
import { AutomationWorkflow } from '../cloud/domain/automation-workflow';
/**
 * Base interface for user identification
 */
export interface UserId {
    id: string;
    organizationId?: string;
}
/**
 * Client capability definition
 */
export interface ClientCapability {
    name: string;
    version: string;
    description?: string;
    parameters?: Record<string, any>;
}
/**
 * Workflow execution performance metrics
 */
export interface WorkflowPerformance {
    executionTime: number;
    resourceUsage: Record<string, number>;
    errorRate: number;
    stepSuccessRate: number;
}
/**
 * Event fired when an automation workflow is submitted for execution
 */
export declare class AutomationWorkflowSubmittedEvent extends Event {
    readonly workflowId: string;
    readonly workflow: AutomationWorkflow;
    readonly submittedBy: UserId;
    readonly priority: 'low' | 'normal' | 'high';
    private readonly _correlationId;
    readonly type = "AutomationWorkflowSubmittedEvent";
    constructor(workflowId: string, workflow: AutomationWorkflow, submittedBy: UserId, priority: 'low' | 'normal' | 'high', _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a workflow is successfully scheduled for execution
 */
export declare class WorkflowScheduledEvent extends Event {
    readonly workflowId: string;
    readonly executionId: string;
    readonly assignedClientId: string;
    private readonly _correlationId;
    readonly scheduledAt: Date;
    readonly type = "WorkflowScheduledEvent";
    constructor(workflowId: string, executionId: string, assignedClientId: string, _correlationId: string, scheduledAt?: Date);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a workflow is rejected due to validation or permission issues
 */
export declare class WorkflowRejectedEvent extends Event {
    readonly workflowId: string;
    readonly reasons: string[];
    private readonly _correlationId;
    readonly rejectedAt: Date;
    readonly type = "WorkflowRejectedEvent";
    constructor(workflowId: string, reasons: string[], _correlationId: string, rejectedAt?: Date);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a workflow is queued due to no available clients
 */
export declare class WorkflowQueuedEvent extends Event {
    readonly workflowId: string;
    readonly reason: string;
    private readonly _correlationId;
    readonly queuedAt: Date;
    readonly type = "WorkflowQueuedEvent";
    constructor(workflowId: string, reason: string, _correlationId: string, queuedAt?: Date);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a client sends a heartbeat with status and capabilities
 */
export declare class ClientHeartbeatEvent extends Event {
    readonly clientId: string;
    readonly status: 'available' | 'busy' | 'offline' | 'maintenance';
    readonly capabilities: ClientCapability[];
    readonly currentLoad: number;
    readonly performance: {
        averageExecutionTime: number;
        successRate: number;
        uptime: number;
    };
    private readonly _correlationId;
    readonly type = "ClientHeartbeatEvent";
    constructor(clientId: string, status: 'available' | 'busy' | 'offline' | 'maintenance', capabilities: ClientCapability[], currentLoad: number, performance: {
        averageExecutionTime: number;
        successRate: number;
        uptime: number;
    }, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a workflow execution is completed
 */
export declare class WorkflowExecutionCompletedEvent extends Event {
    readonly workflowId: string;
    readonly executionId: string;
    readonly clientId: string;
    readonly success: boolean;
    readonly workflow: AutomationWorkflow;
    readonly performance: WorkflowPerformance;
    readonly result?: any;
    readonly error?: string;
    readonly issues: string[];
    readonly suggestedImprovements: string[];
    readonly userFeedback?: {
        satisfaction: number;
        comments?: string;
    };
    private readonly _correlationId;
    readonly type = "WorkflowExecutionCompletedEvent";
    constructor(workflowId: string, executionId: string, clientId: string, success: boolean, workflow: AutomationWorkflow, performance: WorkflowPerformance, result?: any, error?: string, issues: string[], suggestedImprovements: string[], userFeedback?: {
        satisfaction: number;
        comments?: string;
    }, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when an AI workflow generation is requested
 */
export declare class AIWorkflowRequestedEvent extends Event {
    readonly requestId: string;
    readonly workflowType: string;
    readonly objective: string;
    readonly domain: string;
    readonly requirements: Record<string, any>;
    readonly availableCapabilities: ClientCapability[];
    readonly constraints: Record<string, any>;
    readonly examples: any[];
    readonly preferences: Record<string, any>;
    readonly optimizationGoals: string[];
    readonly workflow?: AutomationWorkflow;
    private readonly _correlationId;
    readonly type = "AIWorkflowRequestedEvent";
    constructor(requestId: string, workflowType: string, objective: string, domain: string, requirements: Record<string, any>, availableCapabilities: ClientCapability[], constraints: Record<string, any>, examples: any[], preferences: Record<string, any>, optimizationGoals: string[], workflow?: AutomationWorkflow, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when an AI workflow is successfully generated
 */
export declare class AIWorkflowGeneratedEvent extends Event {
    readonly requestId: string;
    readonly generatedWorkflow: AutomationWorkflow;
    readonly modelId: string;
    readonly confidence: number;
    readonly generationTime: number;
    private readonly _correlationId;
    readonly type = "AIWorkflowGeneratedEvent";
    constructor(requestId: string, generatedWorkflow: AutomationWorkflow, modelId: string, confidence: number, generationTime: number, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when AI workflow generation fails
 */
export declare class AIWorkflowGenerationFailedEvent extends Event {
    readonly requestId: string;
    readonly errors: string[];
    private readonly _correlationId;
    readonly attemptCount: number;
    readonly maxAttempts: number;
    readonly type = "AIWorkflowGenerationFailedEvent";
    constructor(requestId: string, errors: string[], _correlationId: string, attemptCount?: number, maxAttempts?: number);
    get correlationId(): string;
    get canRetry(): boolean;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a client connects to the cloud service
 */
export declare class ClientConnectedEvent extends Event {
    readonly clientId: string;
    readonly clientType: string;
    readonly version: string;
    readonly capabilities: ClientCapability[];
    readonly metadata: Record<string, any>;
    private readonly _correlationId;
    readonly type = "ClientConnectedEvent";
    constructor(clientId: string, clientType: string, version: string, capabilities: ClientCapability[], metadata: Record<string, any>, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when a client disconnects from the cloud service
 */
export declare class ClientDisconnectedEvent extends Event {
    readonly clientId: string;
    readonly reason: 'graceful' | 'timeout' | 'error' | 'maintenance';
    readonly lastSeen: Date;
    private readonly _correlationId;
    readonly type = "ClientDisconnectedEvent";
    constructor(clientId: string, reason: 'graceful' | 'timeout' | 'error' | 'maintenance', lastSeen: Date, _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
/**
 * Event fired when system security validation is performed
 */
export declare class SecurityValidationEvent extends Event {
    readonly validationType: 'authentication' | 'authorization' | 'input-validation' | 'rate-limit';
    readonly success: boolean;
    readonly userId?: string;
    readonly clientId?: string;
    readonly details: Record<string, any>;
    readonly securityLevel: 'low' | 'medium' | 'high';
    private readonly _correlationId;
    readonly type = "SecurityValidationEvent";
    constructor(validationType: 'authentication' | 'authorization' | 'input-validation' | 'rate-limit', success: boolean, userId?: string, clientId?: string, details: Record<string, any>, securityLevel: 'low' | 'medium' | 'high', _correlationId: string);
    get correlationId(): string;
    toJSON(): Record<string, unknown>;
}
//# sourceMappingURL=cloud-events.d.ts.map