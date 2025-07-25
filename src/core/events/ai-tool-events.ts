/**
 * @fileoverview AI Tool activation events for managing AI tool interactions
 * @description Events for AI tool lifecycle management and activation tracking
 * @author Semantest Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Event triggered when AI tool activation is initiated
 */
export class AIToolActivatingEvent extends Event {
  public readonly type = 'AIToolActivating';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly activationMethod: ActivationMethod,
    public readonly metadata?: Record<string, any>
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool is successfully activated
 */
export class AIToolActivatedEvent extends Event {
  public readonly type = 'AIToolActivated';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly activationDuration: number,
    public readonly confirmationSignals: string[]
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool activation fails
 */
export class AIToolActivationFailedEvent extends Event {
  public readonly type = 'AIToolActivationFailed';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly error: AIToolError,
    public readonly attemptNumber: number,
    public readonly willRetry: boolean
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool execution starts
 */
export class AIToolExecutionStartedEvent extends Event {
  public readonly type = 'AIToolExecutionStarted';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly input: any,
    public readonly executionId: string
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool execution completes
 */
export class AIToolExecutionCompletedEvent extends Event {
  public readonly type = 'AIToolExecutionCompleted';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly executionId: string,
    public readonly result: any,
    public readonly executionTime: number
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool execution fails
 */
export class AIToolExecutionFailedEvent extends Event {
  public readonly type = 'AIToolExecutionFailed';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly queueItemId?: string,
    public readonly executionId: string,
    public readonly error: AIToolError,
    public readonly partialResult?: any
  ) {
    super();
  }
}

/**
 * Event triggered when AI tool is deactivated
 */
export class AIToolDeactivatedEvent extends Event {
  public readonly type = 'AIToolDeactivated';
  
  constructor(
    public readonly toolId: string,
    public readonly addonId: string,
    public readonly reason: DeactivationReason,
    public readonly sessionDuration: number
  ) {
    super();
  }
}

// Supporting types

export type ActivationMethod = 
  | 'explicit_prompt'
  | 'ui_button'
  | 'api_request'
  | 'auto_retry'
  | 'fallback';

export interface AIToolError {
  code: AIToolErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestedActions: string[];
}

export type AIToolErrorCode = 
  | 'ACTIVATION_TIMEOUT'
  | 'ACTIVATION_REJECTED'
  | 'TOOL_NOT_AVAILABLE'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_ERROR'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export type DeactivationReason = 
  | 'completed'
  | 'timeout'
  | 'error'
  | 'user_cancelled'
  | 'session_ended'
  | 'tool_switched';

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
export enum AIToolState {
  IDLE = 'idle',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  EXECUTING = 'executing',
  DEACTIVATING = 'deactivating',
  ERROR = 'error'
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