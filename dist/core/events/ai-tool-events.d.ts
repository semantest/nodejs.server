/**
 * @fileoverview AI Tool activation events for managing AI tool interactions
 * @description Events for AI tool lifecycle management and activation tracking
 * @author Semantest Team
 */
import { Event } from '../../stubs/typescript-eda-stubs';
/**
 * Event triggered when AI tool activation is initiated
 */
export declare class AIToolActivatingEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly activationMethod: ActivationMethod;
    readonly queueItemId?: string;
    readonly metadata?: Record<string, any>;
    readonly type = "AIToolActivating";
    constructor(toolId: string, addonId: string, activationMethod: ActivationMethod, queueItemId?: string, metadata?: Record<string, any>);
}
/**
 * Event triggered when AI tool is successfully activated
 */
export declare class AIToolActivatedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly activationDuration: number;
    readonly confirmationSignals: string[];
    readonly queueItemId?: string;
    readonly type = "AIToolActivated";
    constructor(toolId: string, addonId: string, activationDuration: number, confirmationSignals: string[], queueItemId?: string);
}
/**
 * Event triggered when AI tool activation fails
 */
export declare class AIToolActivationFailedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly error: AIToolError;
    readonly attemptNumber: number;
    readonly willRetry: boolean;
    readonly queueItemId?: string;
    readonly type = "AIToolActivationFailed";
    constructor(toolId: string, addonId: string, error: AIToolError, attemptNumber: number, willRetry: boolean, queueItemId?: string);
}
/**
 * Event triggered when AI tool execution starts
 */
export declare class AIToolExecutionStartedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly input: any;
    readonly executionId: string;
    readonly queueItemId?: string;
    readonly type = "AIToolExecutionStarted";
    constructor(toolId: string, addonId: string, input: any, executionId: string, queueItemId?: string);
}
/**
 * Event triggered when AI tool execution completes
 */
export declare class AIToolExecutionCompletedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly executionId: string;
    readonly result: any;
    readonly executionTime: number;
    readonly queueItemId?: string;
    readonly type = "AIToolExecutionCompleted";
    constructor(toolId: string, addonId: string, executionId: string, result: any, executionTime: number, queueItemId?: string);
}
/**
 * Event triggered when AI tool execution fails
 */
export declare class AIToolExecutionFailedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly executionId: string;
    readonly error: AIToolError;
    readonly queueItemId?: string;
    readonly partialResult?: any;
    readonly type = "AIToolExecutionFailed";
    constructor(toolId: string, addonId: string, executionId: string, error: AIToolError, queueItemId?: string, partialResult?: any);
}
/**
 * Event triggered when AI tool is deactivated
 */
export declare class AIToolDeactivatedEvent extends Event {
    readonly toolId: string;
    readonly addonId: string;
    readonly reason: DeactivationReason;
    readonly sessionDuration: number;
    readonly type = "AIToolDeactivated";
    constructor(toolId: string, addonId: string, reason: DeactivationReason, sessionDuration: number);
}
export type ActivationMethod = 'explicit_prompt' | 'ui_button' | 'api_request' | 'auto_retry' | 'fallback';
export interface AIToolError {
    code: AIToolErrorCode;
    message: string;
    details?: any;
    recoverable: boolean;
    suggestedActions: string[];
}
export type AIToolErrorCode = 'ACTIVATION_TIMEOUT' | 'ACTIVATION_REJECTED' | 'TOOL_NOT_AVAILABLE' | 'INSUFFICIENT_PERMISSIONS' | 'RATE_LIMIT_EXCEEDED' | 'EXECUTION_TIMEOUT' | 'EXECUTION_ERROR' | 'INVALID_INPUT' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
export type DeactivationReason = 'completed' | 'timeout' | 'error' | 'user_cancelled' | 'session_ended' | 'tool_switched';
/**
 * AI Tool registry entry
 */
export interface AIToolDefinition {
    id: string;
    name: string;
    description: string;
    activationPrompt: string;
    confirmationSignals: string[];
    capabilities: string[];
    requiredPermissions: string[];
    timeout: number;
    retryConfig: {
        maxAttempts: number;
        backoffMs: number[];
    };
}
/**
 * AI Tool activation state
 */
export declare enum AIToolState {
    IDLE = "idle",
    ACTIVATING = "activating",
    ACTIVE = "active",
    EXECUTING = "executing",
    DEACTIVATING = "deactivating",
    ERROR = "error"
}
/**
 * AI Tool activation context for queue items
 */
export interface AIToolActivationContext {
    toolId: string;
    state: AIToolState;
    activationAttempts: number;
    lastError?: AIToolError;
    activatedAt?: Date;
    lastActivityAt?: Date;
}
//# sourceMappingURL=ai-tool-events.d.ts.map