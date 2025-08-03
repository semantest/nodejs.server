/**
 * Bridge service to connect AI tool events to WebSocket communication
 */
import { EventEmitter } from 'events';
import { WebSocketServerAdapter } from '../adapters/websocket-server-adapter';
export declare class AIToolWebSocketBridge extends EventEmitter {
    private wsAdapter;
    constructor(wsAdapter: WebSocketServerAdapter);
    /**
     * Set up listeners for AI tool events
     */
    private setupEventListeners;
    /**
     * Handle AI tool activating event
     */
    private handleToolActivating;
    /**
     * Handle AI tool activated event
     */
    private handleToolActivated;
    /**
     * Handle AI tool activation failed event
     */
    private handleToolActivationFailed;
    /**
     * Handle execution started event
     */
    private handleExecutionStarted;
    /**
     * Handle execution completed event
     */
    private handleExecutionCompleted;
    /**
     * Handle execution failed event
     */
    private handleExecutionFailed;
    /**
     * Emit an AI tool event (called by queue processor)
     */
    emitAIToolEvent(event: any): void;
}
//# sourceMappingURL=ai-tool-websocket-bridge.d.ts.map