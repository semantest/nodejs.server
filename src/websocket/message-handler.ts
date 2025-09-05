/**
 * WebSocket Message Handler
 * Minimal implementation for TDD - Green phase
 * @author Fran - Backend Engineer
 */

import { WebSocketMessage } from './types';
import { EventEmitter } from 'events';

export class WebSocketMessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Handle incoming WebSocket message
   * Minimal implementation to pass tests
   */
  async handleMessage(message: WebSocketMessage): Promise<void> {
    // Emit event for message type
    this.emit(message.type, message);
  }

  /**
   * Validate message structure
   * Minimal validation to pass tests
   */
  validateMessage(message: any): boolean {
    return !!(
      message &&
      message.id &&
      message.type &&
      message.source &&
      message.target &&
      message.action &&
      message.timestamp
    );
  }
}