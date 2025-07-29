/**
 * Tests for AI Tool events
 */

import {
  AIToolActivatingEvent,
  AIToolActivatedEvent,
  AIToolActivationFailedEvent,
  AIToolExecutionStartedEvent,
  AIToolExecutionCompletedEvent,
  AIToolExecutionFailedEvent,
  AIToolDeactivatedEvent,
  ActivationMethod,
  AIToolError,
  AIToolErrorCode,
  DeactivationReason,
  AIToolDefinition,
  AIToolState,
  AIToolActivationContext
} from '../ai-tool-events';
import { Event } from '../../../stubs/typescript-eda-stubs';

describe('AI Tool Events', () => {
  describe('AIToolActivatingEvent', () => {
    it('should create event with all fields', () => {
      const event = new AIToolActivatingEvent(
        'tool-123',
        'addon-456',
        'explicit_prompt',
        'queue-789',
        { context: 'test' }
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolActivating');
      expect(event.toolId).toBe('tool-123');
      expect(event.addonId).toBe('addon-456');
      expect(event.queueItemId).toBe('queue-789');
      expect(event.activationMethod).toBe('explicit_prompt');
      expect(event.metadata).toEqual({ context: 'test' });
    });

    it('should create event without optional fields', () => {
      const event = new AIToolActivatingEvent(
        'tool-123',
        'addon-456',
        'ui_button'
      );

      expect(event.queueItemId).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });

    it('should handle different activation methods', () => {
      const methods: ActivationMethod[] = [
        'explicit_prompt',
        'ui_button',
        'api_request',
        'auto_retry',
        'fallback'
      ];

      methods.forEach(method => {
        const event = new AIToolActivatingEvent('tool', 'addon', undefined, method);
        expect(event.activationMethod).toBe(method);
      });
    });
  });

  describe('AIToolActivatedEvent', () => {
    it('should create event with confirmation signals', () => {
      const event = new AIToolActivatedEvent(
        'tool-123',
        'addon-456',
        'queue-789',
        1500,
        ['signal1', 'signal2']
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolActivated');
      expect(event.activationDuration).toBe(1500);
      expect(event.confirmationSignals).toEqual(['signal1', 'signal2']);
    });
  });

  describe('AIToolActivationFailedEvent', () => {
    it('should create event with error details', () => {
      const error: AIToolError = {
        code: 'ACTIVATION_TIMEOUT',
        message: 'Tool activation timed out',
        details: { timeout: 5000 },
        recoverable: true,
        suggestedActions: ['Retry activation', 'Check tool status']
      };

      const event = new AIToolActivationFailedEvent(
        'tool-123',
        'addon-456',
        'queue-789',
        error,
        1,
        true
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolActivationFailed');
      expect(event.error).toEqual(error);
      expect(event.attemptNumber).toBe(1);
      expect(event.willRetry).toBe(true);
    });

    it('should handle non-recoverable errors', () => {
      const error: AIToolError = {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'User lacks required permissions',
        recoverable: false,
        suggestedActions: ['Request permissions']
      };

      const event = new AIToolActivationFailedEvent(
        'tool-123',
        'addon-456',
        undefined,
        error,
        3,
        false
      );

      expect(event.error.recoverable).toBe(false);
      expect(event.willRetry).toBe(false);
    });
  });

  describe('AIToolExecutionStartedEvent', () => {
    it('should create event with execution details', () => {
      const input = { command: 'analyze', data: { source: 'test' } };
      
      const event = new AIToolExecutionStartedEvent(
        'tool-123',
        'addon-456',
        'queue-789',
        input,
        'exec-001'
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolExecutionStarted');
      expect(event.input).toEqual(input);
      expect(event.executionId).toBe('exec-001');
    });
  });

  describe('AIToolExecutionCompletedEvent', () => {
    it('should create event with results', () => {
      const result = { status: 'success', data: { analyzed: true } };
      
      const event = new AIToolExecutionCompletedEvent(
        'tool-123',
        'addon-456',
        'queue-789',
        'exec-001',
        result,
        2500
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolExecutionCompleted');
      expect(event.result).toEqual(result);
      expect(event.executionTime).toBe(2500);
    });
  });

  describe('AIToolExecutionFailedEvent', () => {
    it('should create event with partial results', () => {
      const error: AIToolError = {
        code: 'EXECUTION_ERROR',
        message: 'Execution failed midway',
        recoverable: true,
        suggestedActions: ['Retry with smaller input']
      };

      const partialResult = { processed: 50, total: 100 };
      
      const event = new AIToolExecutionFailedEvent(
        'tool-123',
        'addon-456',
        'queue-789',
        'exec-001',
        error,
        partialResult
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolExecutionFailed');
      expect(event.error).toEqual(error);
      expect(event.partialResult).toEqual(partialResult);
    });

    it('should create event without partial results', () => {
      const error: AIToolError = {
        code: 'NETWORK_ERROR',
        message: 'Network connection lost',
        recoverable: true,
        suggestedActions: ['Check connection']
      };
      
      const event = new AIToolExecutionFailedEvent(
        'tool-123',
        'addon-456',
        undefined,
        'exec-002',
        error
      );

      expect(event.partialResult).toBeUndefined();
    });
  });

  describe('AIToolDeactivatedEvent', () => {
    it('should create event with deactivation reason', () => {
      const event = new AIToolDeactivatedEvent(
        'tool-123',
        'addon-456',
        'completed',
        300000 // 5 minutes
      );

      expect(event).toBeInstanceOf(Event);
      expect(event.type).toBe('AIToolDeactivated');
      expect(event.reason).toBe('completed');
      expect(event.sessionDuration).toBe(300000);
    });

    it('should handle different deactivation reasons', () => {
      const reasons: DeactivationReason[] = [
        'completed',
        'timeout',
        'error',
        'user_cancelled',
        'session_ended',
        'tool_switched'
      ];

      reasons.forEach(reason => {
        const event = new AIToolDeactivatedEvent('tool', 'addon', reason, 1000);
        expect(event.reason).toBe(reason);
      });
    });
  });

  describe('AIToolError type', () => {
    it('should handle all error codes', () => {
      const errorCodes: AIToolErrorCode[] = [
        'ACTIVATION_TIMEOUT',
        'ACTIVATION_REJECTED',
        'TOOL_NOT_AVAILABLE',
        'INSUFFICIENT_PERMISSIONS',
        'RATE_LIMIT_EXCEEDED',
        'EXECUTION_TIMEOUT',
        'EXECUTION_ERROR',
        'INVALID_INPUT',
        'NETWORK_ERROR',
        'UNKNOWN_ERROR'
      ];

      errorCodes.forEach(code => {
        const error: AIToolError = {
          code,
          message: `Error: ${code}`,
          recoverable: true,
          suggestedActions: []
        };
        expect(error.code).toBe(code);
      });
    });

    it('should create comprehensive error object', () => {
      const error: AIToolError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: {
          limit: 100,
          window: '1m',
          retryAfter: 30
        },
        recoverable: true,
        suggestedActions: ['Wait 30 seconds', 'Upgrade plan']
      };

      expect(error.details).toBeDefined();
      expect(error.suggestedActions).toHaveLength(2);
    });
  });

  describe('AIToolDefinition interface', () => {
    it('should create valid tool definition', () => {
      const toolDef: AIToolDefinition = {
        id: 'analyzer-v2',
        name: 'Code Analyzer',
        description: 'Analyzes code for issues',
        activationPrompt: 'Activate Code Analyzer',
        confirmationSignals: ['Analyzer ready', 'Analysis mode active'],
        capabilities: ['static-analysis', 'security-scan', 'performance-check'],
        requiredPermissions: ['code:read', 'report:write'],
        timeout: 30000,
        retryConfig: {
          maxAttempts: 3,
          backoffMs: [1000, 2000, 4000]
        }
      };

      expect(toolDef.id).toBe('analyzer-v2');
      expect(toolDef.capabilities).toContain('security-scan');
      expect(toolDef.retryConfig.maxAttempts).toBe(3);
      expect(toolDef.retryConfig.backoffMs).toHaveLength(3);
    });
  });

  describe('AIToolState enum', () => {
    it('should have all expected states', () => {
      expect(AIToolState.IDLE).toBe('idle');
      expect(AIToolState.ACTIVATING).toBe('activating');
      expect(AIToolState.ACTIVE).toBe('active');
      expect(AIToolState.EXECUTING).toBe('executing');
      expect(AIToolState.DEACTIVATING).toBe('deactivating');
      expect(AIToolState.ERROR).toBe('error');
    });
  });

  describe('AIToolActivationContext interface', () => {
    it('should create activation context with error', () => {
      const context: AIToolActivationContext = {
        toolId: 'tool-123',
        state: AIToolState.ERROR,
        activationAttempts: 3,
        lastError: {
          code: 'ACTIVATION_TIMEOUT',
          message: 'Failed to activate',
          recoverable: true,
          suggestedActions: ['Retry']
        }
      };

      expect(context.state).toBe(AIToolState.ERROR);
      expect(context.lastError).toBeDefined();
      expect(context.activatedAt).toBeUndefined();
    });

    it('should create active context', () => {
      const now = new Date();
      const context: AIToolActivationContext = {
        toolId: 'tool-456',
        state: AIToolState.ACTIVE,
        activationAttempts: 1,
        activatedAt: now,
        lastActivityAt: now
      };

      expect(context.state).toBe(AIToolState.ACTIVE);
      expect(context.activatedAt).toEqual(now);
      expect(context.lastError).toBeUndefined();
    });
  });
});