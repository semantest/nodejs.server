/**
 * WebSocket Event Adapter
 * Real-time event streaming following hexagonal architecture
 * Implements the adapter pattern for WebSocket communication
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { DomainEvent } from '../../domain/events/image-generation-events';
import { EventStore, EventBus } from '../../domain/event-store/event-store.interface';
import { eventStore } from '../event-store/enhanced-event-store';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  aggregateSubscriptions: Set<string>;
  isAuthenticated: boolean;
  lastHeartbeat: Date;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  messageId?: string;
  timestamp: Date;
}

export class WebSocketEventAdapter {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private eventStore: EventStore & EventBus;
  private heartbeatInterval: NodeJS.Timeout;
  private unsubscribers: Map<string, (() => void)[]> = new Map();
  
  constructor(server: Server, port?: number) {
    // Create WebSocket server
    if (port) {
      this.wss = new WebSocketServer({ port });
      console.log(`WebSocket Event Adapter listening on port ${port}`);
    } else {
      this.wss = new WebSocketServer({ server });
      console.log('WebSocket Event Adapter attached to HTTP server');
    }
    
    this.eventStore = eventStore;
    this.setupWebSocketServer();
    this.subscribeToEventStore();
    this.startHeartbeat();
  }
  
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        aggregateSubscriptions: new Set(),
        isAuthenticated: false,
        lastHeartbeat: new Date()
      };
      
      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);
      
      // Send welcome message
      this.sendToClient(client, {
        type: 'connection.established',
        payload: {
          clientId,
          serverTime: new Date(),
          availableEvents: this.getAvailableEventTypes()
        },
        timestamp: new Date()
      });
      
      // Handle client messages
      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(client, data);
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        this.handleClientDisconnect(client);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
      
      // Handle pong for heartbeat
      ws.on('pong', () => {
        client.lastHeartbeat = new Date();
      });
    });
  }
  
  private async handleClientMessage(client: WebSocketClient, data: Buffer): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth.authenticate':
          await this.handleAuthentication(client, message.payload);
          break;
          
        case 'subscription.subscribe':
          await this.handleSubscribe(client, message.payload);
          break;
          
        case 'subscription.unsubscribe':
          await this.handleUnsubscribe(client, message.payload);
          break;
          
        case 'subscription.subscribeToAggregate':
          await this.handleAggregateSubscribe(client, message.payload);
          break;
          
        case 'query.getAggregateState':
          await this.handleGetAggregateState(client, message.payload);
          break;
          
        case 'query.getEventHistory':
          await this.handleGetEventHistory(client, message.payload);
          break;
          
        case 'command.execute':
          await this.handleCommand(client, message.payload);
          break;
          
        case 'ping':
          this.sendToClient(client, {
            type: 'pong',
            payload: { time: new Date() },
            timestamp: new Date()
          });
          break;
          
        default:
          this.sendError(client, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      this.sendError(client, 'Invalid message format');
    }
  }
  
  private async handleAuthentication(client: WebSocketClient, payload: any): Promise<void> {
    // TODO: Implement proper authentication with JWT token validation
    // For now, just mark as authenticated with the provided userId
    if (payload.token || payload.userId) {
      client.isAuthenticated = true;
      client.userId = payload.userId || 'anonymous';
      
      this.sendToClient(client, {
        type: 'auth.success',
        payload: {
          userId: client.userId,
          authenticated: true
        },
        timestamp: new Date()
      });
    } else {
      this.sendError(client, 'Authentication failed: missing credentials');
    }
  }
  
  private async handleSubscribe(client: WebSocketClient, payload: any): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }
    
    const { eventTypes } = payload;
    if (!Array.isArray(eventTypes)) {
      this.sendError(client, 'Invalid subscription request: eventTypes must be an array');
      return;
    }
    
    // Add subscriptions
    eventTypes.forEach(eventType => client.subscriptions.add(eventType));
    
    this.sendToClient(client, {
      type: 'subscription.confirmed',
      payload: {
        eventTypes,
        subscriptions: Array.from(client.subscriptions)
      },
      timestamp: new Date()
    });
  }
  
  private async handleUnsubscribe(client: WebSocketClient, payload: any): Promise<void> {
    const { eventTypes } = payload;
    if (!Array.isArray(eventTypes)) {
      this.sendError(client, 'Invalid unsubscribe request: eventTypes must be an array');
      return;
    }
    
    // Remove subscriptions
    eventTypes.forEach(eventType => client.subscriptions.delete(eventType));
    
    this.sendToClient(client, {
      type: 'subscription.removed',
      payload: {
        eventTypes,
        subscriptions: Array.from(client.subscriptions)
      },
      timestamp: new Date()
    });
  }
  
  private async handleAggregateSubscribe(client: WebSocketClient, payload: any): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }
    
    const { aggregateId } = payload;
    if (!aggregateId) {
      this.sendError(client, 'Invalid subscription: aggregateId required');
      return;
    }
    
    client.aggregateSubscriptions.add(aggregateId);
    
    // Send current state
    const events = await this.eventStore.getEvents(aggregateId);
    const version = await this.eventStore.getAggregateVersion(aggregateId);
    
    this.sendToClient(client, {
      type: 'aggregate.subscribed',
      payload: {
        aggregateId,
        currentVersion: version,
        eventCount: events.length
      },
      timestamp: new Date()
    });
  }
  
  private async handleGetAggregateState(client: WebSocketClient, payload: any): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }
    
    const { aggregateId } = payload;
    const eventStream = await this.eventStore.getEventStream(aggregateId);
    
    this.sendToClient(client, {
      type: 'aggregate.state',
      payload: {
        aggregateId,
        version: eventStream.version,
        events: eventStream.events
      },
      timestamp: new Date()
    });
  }
  
  private async handleGetEventHistory(client: WebSocketClient, payload: any): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }
    
    const { aggregateId, options } = payload;
    const events = await this.eventStore.getEvents(aggregateId, options);
    
    this.sendToClient(client, {
      type: 'events.history',
      payload: {
        aggregateId,
        events,
        count: events.length
      },
      timestamp: new Date()
    });
  }
  
  private async handleCommand(client: WebSocketClient, payload: any): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }
    
    // Commands should be handled by the application layer
    // This is just a pass-through to notify about command reception
    this.sendToClient(client, {
      type: 'command.received',
      payload: {
        commandId: payload.commandId,
        status: 'processing'
      },
      timestamp: new Date()
    });
    
    // TODO: Integrate with command bus/handler
  }
  
  private subscribeToEventStore(): void {
    // Subscribe to all events and broadcast to interested clients
    const unsubscribe = this.eventStore.subscribeToAll(async (event: DomainEvent) => {
      await this.broadcastEvent(event);
    });
    
    // Store unsubscriber for cleanup
    this.unsubscribers.set('global', [unsubscribe]);
  }
  
  private async broadcastEvent(event: DomainEvent): Promise<void> {
    const message: WebSocketMessage = {
      type: 'event.occurred',
      payload: {
        event,
        sequenceNumber: Date.now() // Could be replaced with actual sequence from event store
      },
      timestamp: new Date()
    };
    
    // Send to all clients subscribed to this event type or aggregate
    this.clients.forEach(client => {
      const shouldSend = 
        client.isAuthenticated &&
        (client.subscriptions.has(event.eventType) ||
         client.subscriptions.has('*') ||
         client.aggregateSubscriptions.has(event.aggregateId));
      
      if (shouldSend) {
        this.sendToClient(client, message);
      }
    });
  }
  
  private sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
  
  private sendError(client: WebSocketClient, error: string): void {
    this.sendToClient(client, {
      type: 'error',
      payload: { message: error },
      timestamp: new Date()
    });
  }
  
  private handleClientDisconnect(client: WebSocketClient): void {
    console.log(`Client ${client.id} disconnected`);
    this.clients.delete(client.id);
    
    // Clean up any client-specific subscriptions
    const clientUnsubscribers = this.unsubscribers.get(client.id);
    if (clientUnsubscribers) {
      clientUnsubscribers.forEach(unsub => unsub());
      this.unsubscribers.delete(client.id);
    }
  }
  
  private startHeartbeat(): void {
    // Send ping to all clients every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
          
          // Check if client is still alive (hasn't responded to last ping)
          const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat.getTime();
          if (timeSinceLastHeartbeat > 60000) { // 60 seconds timeout
            console.log(`Client ${client.id} timed out, disconnecting`);
            client.ws.terminate();
            this.handleClientDisconnect(client);
          }
        }
      });
    }, 30000);
  }
  
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private getAvailableEventTypes(): string[] {
    return [
      'ImageGenerationRequested',
      'ImageGenerationValidated',
      'ImageGenerationQueued',
      'ImageGenerationStarted',
      'ImageGenerationProgress',
      'ImageGenerationCompleted',
      'ImageGenerationFailed',
      'ImageGenerationCancelled',
      'ImageGenerationRetried'
    ];
  }
  
  // Public methods for external control
  
  public broadcastToAll(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.isAuthenticated) {
        this.sendToClient(client, message);
      }
    });
  }
  
  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.isAuthenticated && client.userId === userId) {
        this.sendToClient(client, message);
      }
    });
  }
  
  public getConnectedClients(): number {
    return this.clients.size;
  }
  
  public getAuthenticatedClients(): number {
    let count = 0;
    this.clients.forEach(client => {
      if (client.isAuthenticated) count++;
    });
    return count;
  }
  
  public shutdown(): void {
    clearInterval(this.heartbeatInterval);
    
    // Close all client connections
    this.clients.forEach(client => {
      client.ws.close(1000, 'Server shutting down');
    });
    
    // Unsubscribe from all events
    this.unsubscribers.forEach(unsubscribers => {
      unsubscribers.forEach(unsub => unsub());
    });
    
    this.wss.close();
  }
}

// Export a factory function for creating the adapter
export function createWebSocketEventAdapter(server: Server, port?: number): WebSocketEventAdapter {
  return new WebSocketEventAdapter(server, port);
}