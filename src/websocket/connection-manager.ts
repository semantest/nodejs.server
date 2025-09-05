/**
 * WebSocket Connection Manager
 * Minimal implementation for TDD - Green phase
 * @author Fran - Backend Engineer
 */

import { WebSocket } from 'ws';
import { ClientConnection } from './types';
import { EventEmitter } from 'events';

export class WebSocketConnectionManager extends EventEmitter {
  private connections: Map<string, WebSocket>;
  private clientInfo: Map<string, ClientConnection>;

  constructor() {
    super();
    this.connections = new Map();
    this.clientInfo = new Map();
  }

  /**
   * Register new client connection
   * Minimal implementation to pass tests
   */
  addConnection(id: string, ws: WebSocket, clientType: 'cli' | 'extension'): void {
    this.connections.set(id, ws);
    
    const clientInfo: ClientConnection = {
      id,
      type: clientType,
      authenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.clientInfo.set(id, clientInfo);
    this.emit('client.connected', clientInfo);
  }

  /**
   * Remove client connection
   */
  removeConnection(id: string): void {
    this.connections.delete(id);
    const client = this.clientInfo.get(id);
    this.clientInfo.delete(id);
    
    if (client) {
      this.emit('client.disconnected', client);
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): WebSocket | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all connections
   */
  getAllConnections(): Map<string, WebSocket> {
    return this.connections;
  }
}