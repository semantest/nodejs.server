/**
 * WebSocket Message Router
 * Minimal implementation for TDD - Green phase
 * @author Fran - Backend Engineer
 */

import { WebSocket } from 'ws';
import { WebSocketMessage, MessageTarget } from './types';
import { WebSocketConnectionManager } from './connection-manager';
import { EventEmitter } from 'events';

export class MessageRouter extends EventEmitter {
  private connectionManager: WebSocketConnectionManager;

  constructor(connectionManager: WebSocketConnectionManager) {
    super();
    this.connectionManager = connectionManager;
  }

  /**
   * Route message to appropriate target
   * Minimal implementation to pass tests
   */
  async routeMessage(message: WebSocketMessage): Promise<void> {
    switch (message.target) {
      case MessageTarget.EXTENSION:
        await this.routeToExtension(message);
        break;
      case MessageTarget.CLI:
        await this.routeToCLI(message);
        break;
      case MessageTarget.SERVER:
        await this.handleServerMessage(message);
        break;
      default:
        throw new Error(`Unknown target: ${message.target}`);
    }
  }

  private async routeToExtension(message: WebSocketMessage): Promise<void> {
    // Find extension connections and send message
    const connections = this.connectionManager.getAllConnections();
    connections.forEach((ws, id) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private async routeToCLI(message: WebSocketMessage): Promise<void> {
    // Route to CLI connections
    const connections = this.connectionManager.getAllConnections();
    connections.forEach((ws, id) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private async handleServerMessage(message: WebSocketMessage): Promise<void> {
    // Handle messages targeted at server
    this.emit('server.message', message);
  }
}