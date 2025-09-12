import WebSocket from 'ws';
import { EventStore, FileSystemEventStore } from '../event-store/event-store';
import { CommandBus } from '../../application/commands/base-command';
import { QueryBus } from '../../application/queries/base-query';
import {
  RequestImageGenerationCommand,
  StartImageGenerationCommand,
  UpdateProgressCommand,
  CompleteImageGenerationCommand,
  FailImageGenerationCommand,
  CancelImageGenerationCommand
} from '../../application/commands/image-generation-commands';
import {
  GetImageGenerationStatusQuery,
  GetQueuePositionQuery,
  GetUserGenerationHistoryQuery,
  GetSystemMetricsQuery
} from '../../application/queries/image-generation-queries';
import { DomainEvent } from '../../domain/events/image-generation-events';

interface ClientConnection {
  ws: WebSocket;
  id: string;
  type: 'extension' | 'client' | 'admin';
  authenticated: boolean;
  metadata: Record<string, any>;
  subscriptions: Set<string>;
}

interface WebSocketMessage {
  type: string;
  correlationId?: string;
  payload?: any;
  metadata?: any;
}

export class WebSocketEventSourcedAdapter {
  private wss: WebSocket.Server;
  private eventStore: EventStore;
  private commandBus: CommandBus;
  private queryBus: QueryBus;
  private connections: Map<string, ClientConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(
    port: number,
    eventStore: EventStore,
    commandBus: CommandBus,
    queryBus: QueryBus
  ) {
    this.wss = new WebSocket.Server({ port, path: '/ws-events' });
    this.eventStore = eventStore;
    this.commandBus = commandBus;
    this.queryBus = queryBus;
    
    this.setupWebSocketServer();
    this.setupEventListeners();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        ws,
        id: clientId,
        type: 'client',
        authenticated: false,
        metadata: {},
        subscriptions: new Set()
      };
      
      this.connections.set(clientId, client);
      console.log(`✅ New WebSocket connection: ${clientId}`);
      
      // Send welcome message
      this.sendToClient(client, {
        type: 'welcome',
        payload: {
          clientId,
          message: 'Connected to Event-Sourced WebSocket Server',
          capabilities: ['commands', 'queries', 'subscriptions', 'events']
        }
      });
      
      // Handle messages
      ws.on('message', async (message: string) => {
        await this.handleMessage(clientId, message);
      });
      
      // Handle disconnection
      ws.on('close', () => {
        console.log(`❌ Disconnected: ${clientId}`);
        this.connections.delete(clientId);
        this.cleanupSubscriptions(clientId);
      });
      
      // Handle errors
      ws.on('error', (error: Error) => {
        console.error(`⚠️ WebSocket error for ${clientId}:`, error);
      });
    });
  }

  private async handleMessage(clientId: string, message: string): Promise<void> {
    const client = this.connections.get(clientId);
    if (!client) return;
    
    try {
      const data: WebSocketMessage = JSON.parse(message);
      console.log(`📨 Received [${data.type}] from ${clientId}`);
      
      switch (data.type) {
        case 'authenticate':
          await this.handleAuthentication(client, data);
          break;
          
        case 'command':
          await this.handleCommand(client, data);
          break;
          
        case 'query':
          await this.handleQuery(client, data);
          break;
          
        case 'subscribe':
          await this.handleSubscribe(client, data);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscribe(client, data);
          break;
          
        // Specific command shortcuts
        case 'request_image_generation':
          await this.handleRequestImageGeneration(client, data);
          break;
          
        case 'image_generation_progress':
          await this.handleImageGenerationProgress(client, data);
          break;
          
        case 'image_generation_completed':
          await this.handleImageGenerationCompleted(client, data);
          break;
          
        case 'ping':
          this.sendToClient(client, { type: 'pong', correlationId: data.correlationId });
          break;
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
          this.sendToClient(client, {
            type: 'error',
            correlationId: data.correlationId,
            payload: { message: `Unknown message type: ${data.type}` }
          });
      }
    } catch (error) {
      console.error(`Error processing message from ${clientId}:`, error);
      this.sendToClient(client, {
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async handleAuthentication(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    client.type = data.payload?.clientType || 'client';
    client.authenticated = true;
    client.metadata = data.payload?.metadata || {};
    
    this.sendToClient(client, {
      type: 'authentication_success',
      correlationId: data.correlationId,
      payload: {
        clientId: client.id,
        message: `Authenticated as ${client.type}`
      }
    });
    
    console.log(`🔐 ${client.id} authenticated as ${client.type}`);
  }

  private async handleCommand(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    const { commandType, aggregateId, payload } = data.payload || {};
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    try {
      let command;
      
      switch (commandType) {
        case 'RequestImageGeneration':
          command = new RequestImageGenerationCommand(
            aggregateId,
            payload,
            { correlationId, userId: client.metadata.userId }
          );
          break;
          
        case 'StartImageGeneration':
          command = new StartImageGenerationCommand(
            aggregateId,
            payload,
            { correlationId }
          );
          break;
          
        case 'UpdateProgress':
          command = new UpdateProgressCommand(
            aggregateId,
            payload,
            { correlationId }
          );
          break;
          
        case 'CompleteImageGeneration':
          command = new CompleteImageGenerationCommand(
            aggregateId,
            payload,
            { correlationId }
          );
          break;
          
        case 'FailImageGeneration':
          command = new FailImageGenerationCommand(
            aggregateId,
            payload,
            { correlationId }
          );
          break;
          
        case 'CancelImageGeneration':
          command = new CancelImageGenerationCommand(
            aggregateId,
            payload,
            { correlationId, userId: client.metadata.userId }
          );
          break;
          
        default:
          throw new Error(`Unknown command type: ${commandType}`);
      }
      
      await this.commandBus.dispatch(command);
      
      this.sendToClient(client, {
        type: 'command_accepted',
        correlationId,
        payload: {
          commandId: command.commandId,
          aggregateId
        }
      });
      
    } catch (error) {
      this.sendToClient(client, {
        type: 'command_rejected',
        correlationId,
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  private async handleQuery(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    const { queryType, parameters } = data.payload || {};
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    try {
      let query;
      let result;
      
      switch (queryType) {
        case 'GetImageGenerationStatus':
          query = new GetImageGenerationStatusQuery(
            parameters.requestId,
            { correlationId }
          );
          result = await this.queryBus.execute(query);
          break;
          
        case 'GetQueuePosition':
          query = new GetQueuePositionQuery(
            parameters.requestId,
            { correlationId }
          );
          result = await this.queryBus.execute(query);
          break;
          
        case 'GetUserGenerationHistory':
          query = new GetUserGenerationHistoryQuery(
            parameters.userId,
            parameters.page,
            parameters.pageSize,
            { correlationId }
          );
          result = await this.queryBus.execute(query);
          break;
          
        case 'GetSystemMetrics':
          query = new GetSystemMetricsQuery({ correlationId });
          result = await this.queryBus.execute(query);
          break;
          
        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }
      
      this.sendToClient(client, {
        type: 'query_result',
        correlationId,
        payload: result
      });
      
    } catch (error) {
      this.sendToClient(client, {
        type: 'query_error',
        correlationId,
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  private async handleSubscribe(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    const { eventTypes, aggregateIds } = data.payload || {};
    
    if (eventTypes) {
      for (const eventType of eventTypes) {
        client.subscriptions.add(`event:${eventType}`);
        this.addSubscription(`event:${eventType}`, client.id);
      }
    }
    
    if (aggregateIds) {
      for (const aggregateId of aggregateIds) {
        client.subscriptions.add(`aggregate:${aggregateId}`);
        this.addSubscription(`aggregate:${aggregateId}`, client.id);
      }
    }
    
    this.sendToClient(client, {
      type: 'subscription_confirmed',
      correlationId: data.correlationId,
      payload: {
        eventTypes,
        aggregateIds
      }
    });
    
    console.log(`📡 ${client.id} subscribed to:`, Array.from(client.subscriptions));
  }

  private async handleUnsubscribe(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    const { eventTypes, aggregateIds } = data.payload || {};
    
    if (eventTypes) {
      for (const eventType of eventTypes) {
        client.subscriptions.delete(`event:${eventType}`);
        this.removeSubscription(`event:${eventType}`, client.id);
      }
    }
    
    if (aggregateIds) {
      for (const aggregateId of aggregateIds) {
        client.subscriptions.delete(`aggregate:${aggregateId}`);
        this.removeSubscription(`aggregate:${aggregateId}`, client.id);
      }
    }
    
    this.sendToClient(client, {
      type: 'unsubscription_confirmed',
      correlationId: data.correlationId,
      payload: {
        eventTypes,
        aggregateIds
      }
    });
  }

  private async handleRequestImageGeneration(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    const aggregateId = this.generateAggregateId();
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    const command = new RequestImageGenerationCommand(
      aggregateId,
      {
        userId: client.metadata.userId || client.id,
        prompt: data.payload.prompt,
        style: data.payload.style,
        dimensions: data.payload.dimensions,
        priority: data.payload.priority || 'normal',
        fileName: data.payload.fileName,
        downloadFolder: data.payload.downloadFolder
      },
      { correlationId, userId: client.metadata.userId }
    );
    
    try {
      await this.commandBus.dispatch(command);
      
      this.sendToClient(client, {
        type: 'image_generation_requested',
        correlationId,
        payload: {
          requestId: aggregateId,
          message: 'Image generation request accepted'
        }
      });
      
      // Auto-subscribe client to this aggregate's events
      client.subscriptions.add(`aggregate:${aggregateId}`);
      this.addSubscription(`aggregate:${aggregateId}`, client.id);
      
    } catch (error) {
      this.sendToClient(client, {
        type: 'error',
        correlationId,
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  private async handleImageGenerationProgress(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    if (client.type !== 'extension') {
      this.sendToClient(client, {
        type: 'error',
        correlationId: data.correlationId,
        payload: { message: 'Only extensions can report progress' }
      });
      return;
    }
    
    const command = new UpdateProgressCommand(
      data.payload.requestId,
      {
        progressPercentage: data.payload.progress,
        currentStep: data.payload.currentStep,
        remainingTime: data.payload.remainingTime
      },
      { correlationId: data.correlationId }
    );
    
    await this.commandBus.dispatch(command);
  }

  private async handleImageGenerationCompleted(client: ClientConnection, data: WebSocketMessage): Promise<void> {
    if (client.type !== 'extension') {
      this.sendToClient(client, {
        type: 'error',
        correlationId: data.correlationId,
        payload: { message: 'Only extensions can complete generation' }
      });
      return;
    }
    
    const command = new CompleteImageGenerationCommand(
      data.payload.requestId,
      {
        imageUrl: data.payload.imageUrl,
        thumbnailUrl: data.payload.thumbnailUrl,
        metadata: data.payload.metadata,
        processingTime: data.payload.processingTime,
        creditsUsed: data.payload.creditsUsed
      },
      { correlationId: data.correlationId }
    );
    
    await this.commandBus.dispatch(command);
  }

  private setupEventListeners(): void {
    // Listen to domain events and broadcast to subscribers
    // This would be connected to your event bus
    // For now, we'll create a simple event emitter pattern
  }

  public broadcastEvent(event: DomainEvent): void {
    // Broadcast to subscribers of this event type
    const eventSubscribers = this.subscriptions.get(`event:${event.eventType}`) || new Set();
    const aggregateSubscribers = this.subscriptions.get(`aggregate:${event.aggregateId}`) || new Set();
    
    const allSubscribers = new Set([...eventSubscribers, ...aggregateSubscribers]);
    
    for (const clientId of allSubscribers) {
      const client = this.connections.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client, {
          type: 'event',
          payload: {
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            payload: event.payload,
            metadata: event.metadata
          }
        });
      }
    }
  }

  private sendToClient(client: ClientConnection, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private addSubscription(topic: string, clientId: string): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(clientId);
  }

  private removeSubscription(topic: string, clientId: string): void {
    const subscribers = this.subscriptions.get(topic);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(topic);
      }
    }
  }

  private cleanupSubscriptions(clientId: string): void {
    for (const [topic, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(topic);
      }
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAggregateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public async start(): Promise<void> {
    console.log(`🚀 WebSocket Event-Sourced Server started on ws://localhost:${this.wss.options.port}${this.wss.options.path}`);
  }

  public async stop(): Promise<void> {
    // Close all connections
    for (const client of this.connections.values()) {
      client.ws.close();
    }
    
    // Close server
    this.wss.close();
    
    console.log('🛑 WebSocket Event-Sourced Server stopped');
  }
}