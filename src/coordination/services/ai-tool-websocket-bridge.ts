/**
 * Bridge service to connect AI tool events to WebSocket communication
 */

import { EventEmitter } from 'events';
import { WebSocketServerAdapter } from '../adapters/websocket-server-adapter';
import { 
  AIToolActivatingEvent,
  AIToolActivatedEvent,
  AIToolActivationFailedEvent,
  AIToolExecutionStartedEvent,
  AIToolExecutionCompletedEvent,
  AIToolExecutionFailedEvent
} from '../../core/events/ai-tool-events';

export class AIToolWebSocketBridge extends EventEmitter {
  constructor(
    private wsAdapter: WebSocketServerAdapter
  ) {
    super();
    this.setupEventListeners();
  }

  /**
   * Set up listeners for AI tool events
   */
  private setupEventListeners(): void {
    // Listen for AI tool events and broadcast via WebSocket
    this.on(AIToolActivatingEvent.name, this.handleToolActivating.bind(this));
    this.on(AIToolActivatedEvent.name, this.handleToolActivated.bind(this));
    this.on(AIToolActivationFailedEvent.name, this.handleToolActivationFailed.bind(this));
    this.on(AIToolExecutionStartedEvent.name, this.handleExecutionStarted.bind(this));
    this.on(AIToolExecutionCompletedEvent.name, this.handleExecutionCompleted.bind(this));
    this.on(AIToolExecutionFailedEvent.name, this.handleExecutionFailed.bind(this));
  }

  /**
   * Handle AI tool activating event
   */
  private async handleToolActivating(event: AIToolActivatingEvent): Promise<void> {
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
      } catch (error) {
        console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Handle AI tool activated event
   */
  private async handleToolActivated(event: AIToolActivatedEvent): Promise<void> {
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
      } catch (error) {
        console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Handle AI tool activation failed event
   */
  private async handleToolActivationFailed(event: AIToolActivationFailedEvent): Promise<void> {
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
      } catch (error) {
        console.error(`Failed to send to addon ${event.addonId}, broadcasting instead`);
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Handle execution started event
   */
  private async handleExecutionStarted(event: AIToolExecutionStartedEvent): Promise<void> {
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
      } catch (error) {
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Handle execution completed event
   */
  private async handleExecutionCompleted(event: AIToolExecutionCompletedEvent): Promise<void> {
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
      } catch (error) {
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Handle execution failed event
   */
  private async handleExecutionFailed(event: AIToolExecutionFailedEvent): Promise<void> {
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
      } catch (error) {
        await this.wsAdapter.broadcastMessage(wsMessage);
      }
    } else {
      await this.wsAdapter.broadcastMessage(wsMessage);
    }
  }

  /**
   * Emit an AI tool event (called by queue processor)
   */
  public emitAIToolEvent(event: any): void {
    this.emit(event.constructor.name, event);
  }
}