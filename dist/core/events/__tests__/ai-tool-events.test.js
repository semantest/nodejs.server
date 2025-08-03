"use strict";
/**
 * Tests for AI Tool events
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ai_tool_events_1 = require("../ai-tool-events");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('AI Tool Events', () => {
    describe('AIToolActivatingEvent', () => {
        it('should create event with all fields', () => {
            const event = new ai_tool_events_1.AIToolActivatingEvent('tool-123', 'addon-456', 'explicit_prompt', 'queue-789', { context: 'test' });
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolActivating');
            expect(event.toolId).toBe('tool-123');
            expect(event.addonId).toBe('addon-456');
            expect(event.queueItemId).toBe('queue-789');
            expect(event.activationMethod).toBe('explicit_prompt');
            expect(event.metadata).toEqual({ context: 'test' });
        });
        it('should create event without optional fields', () => {
            const event = new ai_tool_events_1.AIToolActivatingEvent('tool-123', 'addon-456', 'ui_button');
            expect(event.queueItemId).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
        it('should handle different activation methods', () => {
            const methods = [
                'explicit_prompt',
                'ui_button',
                'api_request',
                'auto_retry',
                'fallback'
            ];
            methods.forEach(method => {
                const event = new ai_tool_events_1.AIToolActivatingEvent('tool', 'addon', method);
                expect(event.activationMethod).toBe(method);
            });
        });
    });
    describe('AIToolActivatedEvent', () => {
        it('should create event with confirmation signals', () => {
            const event = new ai_tool_events_1.AIToolActivatedEvent('tool-123', 'addon-456', 1500, ['signal1', 'signal2'], 'queue-789');
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolActivated');
            expect(event.activationDuration).toBe(1500);
            expect(event.confirmationSignals).toEqual(['signal1', 'signal2']);
        });
    });
    describe('AIToolActivationFailedEvent', () => {
        it('should create event with error details', () => {
            const error = {
                code: 'ACTIVATION_TIMEOUT',
                message: 'Tool activation timed out',
                details: { timeout: 5000 },
                recoverable: true,
                suggestedActions: ['Retry activation', 'Check tool status']
            };
            const event = new ai_tool_events_1.AIToolActivationFailedEvent('tool-123', 'addon-456', error, 1, true, 'queue-789');
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolActivationFailed');
            expect(event.error).toEqual(error);
            expect(event.attemptNumber).toBe(1);
            expect(event.willRetry).toBe(true);
        });
        it('should handle non-recoverable errors', () => {
            const error = {
                code: 'INSUFFICIENT_PERMISSIONS',
                message: 'User lacks required permissions',
                recoverable: false,
                suggestedActions: ['Request permissions']
            };
            const event = new ai_tool_events_1.AIToolActivationFailedEvent('tool-123', 'addon-456', error, 3, false);
            expect(event.error.recoverable).toBe(false);
            expect(event.willRetry).toBe(false);
        });
    });
    describe('AIToolExecutionStartedEvent', () => {
        it('should create event with execution details', () => {
            const input = { command: 'analyze', data: { source: 'test' } };
            const event = new ai_tool_events_1.AIToolExecutionStartedEvent('tool-123', 'addon-456', input, 'exec-001', 'queue-789');
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolExecutionStarted');
            expect(event.input).toEqual(input);
            expect(event.executionId).toBe('exec-001');
        });
    });
    describe('AIToolExecutionCompletedEvent', () => {
        it('should create event with results', () => {
            const result = { status: 'success', data: { analyzed: true } };
            const event = new ai_tool_events_1.AIToolExecutionCompletedEvent('tool-123', 'addon-456', 'exec-001', result, 2500, 'queue-789');
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolExecutionCompleted');
            expect(event.result).toEqual(result);
            expect(event.executionTime).toBe(2500);
        });
    });
    describe('AIToolExecutionFailedEvent', () => {
        it('should create event with partial results', () => {
            const error = {
                code: 'EXECUTION_ERROR',
                message: 'Execution failed midway',
                recoverable: true,
                suggestedActions: ['Retry with smaller input']
            };
            const partialResult = { processed: 50, total: 100 };
            const event = new ai_tool_events_1.AIToolExecutionFailedEvent('tool-123', 'addon-456', 'exec-001', error, 'queue-789', partialResult);
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolExecutionFailed');
            expect(event.error).toEqual(error);
            expect(event.partialResult).toEqual(partialResult);
        });
        it('should create event without partial results', () => {
            const error = {
                code: 'NETWORK_ERROR',
                message: 'Network connection lost',
                recoverable: true,
                suggestedActions: ['Check connection']
            };
            const event = new ai_tool_events_1.AIToolExecutionFailedEvent('tool-123', 'addon-456', 'exec-002', error);
            expect(event.partialResult).toBeUndefined();
        });
    });
    describe('AIToolDeactivatedEvent', () => {
        it('should create event with deactivation reason', () => {
            const event = new ai_tool_events_1.AIToolDeactivatedEvent('tool-123', 'addon-456', 'completed', 300000 // 5 minutes
            );
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(event.type).toBe('AIToolDeactivated');
            expect(event.reason).toBe('completed');
            expect(event.sessionDuration).toBe(300000);
        });
        it('should handle different deactivation reasons', () => {
            const reasons = [
                'completed',
                'timeout',
                'error',
                'user_cancelled',
                'session_ended',
                'tool_switched'
            ];
            reasons.forEach(reason => {
                const event = new ai_tool_events_1.AIToolDeactivatedEvent('tool', 'addon', reason, 1000);
                expect(event.reason).toBe(reason);
            });
        });
    });
    describe('AIToolError type', () => {
        it('should handle all error codes', () => {
            const errorCodes = [
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
                const error = {
                    code,
                    message: `Error: ${code}`,
                    recoverable: true,
                    suggestedActions: []
                };
                expect(error.code).toBe(code);
            });
        });
        it('should create comprehensive error object', () => {
            const error = {
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
            const toolDef = {
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
            expect(ai_tool_events_1.AIToolState.IDLE).toBe('idle');
            expect(ai_tool_events_1.AIToolState.ACTIVATING).toBe('activating');
            expect(ai_tool_events_1.AIToolState.ACTIVE).toBe('active');
            expect(ai_tool_events_1.AIToolState.EXECUTING).toBe('executing');
            expect(ai_tool_events_1.AIToolState.DEACTIVATING).toBe('deactivating');
            expect(ai_tool_events_1.AIToolState.ERROR).toBe('error');
        });
    });
    describe('AIToolActivationContext interface', () => {
        it('should create activation context with error', () => {
            const context = {
                toolId: 'tool-123',
                state: ai_tool_events_1.AIToolState.ERROR,
                activationAttempts: 3,
                lastError: {
                    code: 'ACTIVATION_TIMEOUT',
                    message: 'Failed to activate',
                    recoverable: true,
                    suggestedActions: ['Retry']
                }
            };
            expect(context.state).toBe(ai_tool_events_1.AIToolState.ERROR);
            expect(context.lastError).toBeDefined();
            expect(context.activatedAt).toBeUndefined();
        });
        it('should create active context', () => {
            const now = new Date();
            const context = {
                toolId: 'tool-456',
                state: ai_tool_events_1.AIToolState.ACTIVE,
                activationAttempts: 1,
                activatedAt: now,
                lastActivityAt: now
            };
            expect(context.state).toBe(ai_tool_events_1.AIToolState.ACTIVE);
            expect(context.activatedAt).toEqual(now);
            expect(context.lastError).toBeUndefined();
        });
    });
});
//# sourceMappingURL=ai-tool-events.test.js.map