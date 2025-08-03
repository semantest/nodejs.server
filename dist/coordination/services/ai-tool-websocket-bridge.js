"use strict";
/**
 * Bridge service to connect AI tool events to WebSocket communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIToolWebSocketBridge = void 0;
const events_1 = require("events");
const ai_tool_events_1 = require("../../core/events/ai-tool-events");
class AIToolWebSocketBridge extends events_1.EventEmitter {
    constructor(wsAdapter) {
        super();
        this.wsAdapter = wsAdapter;
        this.setupEventListeners();
    }
    /**
     * Set up listeners for AI tool events
     */
    setupEventListeners() {
        // Listen for AI tool events and broadcast via WebSocket
        this.on(ai_tool_events_1.AIToolActivatingEvent.name, this.handleToolActivating.bind(this));
        this.on(ai_tool_events_1.AIToolActivatedEvent.name, this.handleToolActivated.bind(this));
        this.on(ai_tool_events_1.AIToolActivationFailedEvent.name, this.handleToolActivationFailed.bind(this));
        this.on(ai_tool_events_1.AIToolExecutionStartedEvent.name, this.handleExecutionStarted.bind(this));
        this.on(ai_tool_events_1.AIToolExecutionCompletedEvent.name, this.handleExecutionCompleted.bind(this));
        this.on(ai_tool_events_1.AIToolExecutionFailedEvent.name, this.handleExecutionFailed.bind(this));
    }
    /**
     * Handle AI tool activating event
     */
    async handleToolActivating(event) {
        const wsMessage = {
            type: 'ai:tool:activating',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                method: event.activationMethod,
                metadata: event.metadata
            }
        };
        // Send to specific addon if available, otherwise broadcast
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Handle AI tool activated event
     */
    async handleToolActivated(event) {
        const wsMessage = {
            type: 'ai:tool:activated',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                duration: event.activationDuration,
                confirmationSignals: event.confirmationSignals
            }
        };
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Handle AI tool activation failed event
     */
    async handleToolActivationFailed(event) {
        const wsMessage = {
            type: 'ai:tool:failed',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                error: {
                    code: event.error.code,
                    message: event.error.message,
                    recoverable: event.error.recoverable
                },
                attemptNumber: event.attemptNumber,
                willRetry: event.willRetry
            }
        };
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Handle execution started event
     */
    async handleExecutionStarted(event) {
        const wsMessage = {
            type: 'ai:tool:execution:started',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                executionId: event.executionId
            }
        };
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Handle execution completed event
     */
    async handleExecutionCompleted(event) {
        const wsMessage = {
            type: 'ai:tool:execution:completed',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                executionId: event.executionId,
                executionTime: event.executionTime,
                hasResult: !!event.result
            }
        };
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Handle execution failed event
     */
    async handleExecutionFailed(event) {
        const wsMessage = {
            type: 'ai:tool:execution:failed',
            timestamp: new Date().toISOString(),
            data: {
                toolId: event.toolId,
                addonId: event.addonId,
                queueItemId: event.queueItemId,
                executionId: event.executionId,
                error: {
                    code: event.error.code,
                    message: event.error.message,
                    recoverable: event.error.recoverable
                },
                hasPartialResult: !!event.partialResult
            }
        };
        if (event.addonId) {
            try {
                await this.wsAdapter.sendMessageToExtension(event.addonId, wsMessage);
            }
            catch (error) {
                await this.wsAdapter.broadcastMessage(wsMessage);
            }
        }
        else {
            await this.wsAdapter.broadcastMessage(wsMessage);
        }
    }
    /**
     * Emit an AI tool event (called by queue processor)
     */
    emitAIToolEvent(event) {
        this.emit(event.constructor.name, event);
    }
}
exports.AIToolWebSocketBridge = AIToolWebSocketBridge;
//# sourceMappingURL=ai-tool-websocket-bridge.js.map