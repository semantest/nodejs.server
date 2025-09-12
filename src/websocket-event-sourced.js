/**
 * Event-Sourced WebSocket Server
 * Integrates event store with WebSocket communication
 */

const WebSocket = require('ws');
const EventStore = require('../../images.google.com/infrastructure/event-store/event-store');
const { SagaManager } = require('../../images.google.com/infrastructure/saga/saga');
const { DomainEvent } = require('../../images.google.com/domain/events/event');

class EventSourcedWebSocketServer {
  constructor(port = 8082, options = {}) {
    this.port = port;
    this.path = options.path || '/ws-events';
    
    // Initialize event store
    this.eventStore = new EventStore({
      storePath: options.storePath || './data/events',
      snapshotPath: options.snapshotPath || './data/snapshots',
      snapshotFrequency: options.snapshotFrequency || 100
    });
    
    // Initialize saga manager
    this.sagaManager = new SagaManager(this.eventStore);
    
    // WebSocket server
    this.wss = null;
    
    // Connection tracking
    this.connections = new Map();
    this.subscriptions = new Map(); // clientId -> Set of event types
    
    // Request tracking for correlation
    this.pendingRequests = new Map();
    
    // Register built-in sagas
    this.registerSagas();
  }
  
  /**
   * Start the server
   */
  async start() {
    // Initialize event store
    await this.eventStore.initialize();
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({
      port: this.port,
      path: this.path
    });
    
    console.log(`🚀 Event-Sourced WebSocket Server starting on port ${this.port}...`);
    
    // Set up event store listeners
    this.setupEventStoreListeners();
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    
    // Set up projections
    this.setupProjections();
    
    console.log(`✅ Event-Sourced WebSocket Server running on ws://localhost:${this.port}${this.path}`);
    
    return this;
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;
    
    console.log(`✅ New connection: ${clientId} from ${clientIp}`);
    
    // Store connection
    const client = {
      ws,
      id: clientId,
      type: null,
      authenticated: false,
      metadata: {},
      subscriptions: new Set()
    };
    
    this.connections.set(clientId, client);
    
    // Handle messages
    ws.on('message', async (message) => {
      await this.handleMessage(clientId, message);
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log(`❌ Disconnected: ${clientId}`);
      this.connections.delete(clientId);
      this.subscriptions.delete(clientId);
    });
    
    // Handle errors
    ws.on('error', (err) => {
      console.error(`⚠️ WebSocket error for ${clientId}:`, err);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      message: 'Connected to Event-Sourced WebSocket Server',
      port: this.port,
      capabilities: ['event-sourcing', 'sagas', 'projections', 'subscriptions']
    }));
  }
  
  /**
   * Handle incoming message
   */
  async handleMessage(clientId, message) {
    const client = this.connections.get(clientId);
    
    try {
      const data = JSON.parse(message.toString());
      
      console.log(`📨 Received [${data.type}] from ${clientId}`);
      
      // Handle different message types
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
          await this.handleSubscription(client, data);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscribe(client, data);
          break;
          
        case 'replay':
          await this.handleReplay(client, data);
          break;
          
        // Domain-specific events
        case 'ImageGenerationRequestedEvent':
        case 'generate_image_request':
          await this.handleImageGenerationRequest(client, data);
          break;
          
        case 'image_generated':
        case 'ImageGeneratedEvent':
          await this.handleImageGenerated(client, data);
          break;
          
        case 'ping':
        case 'heartbeat':
          client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          // Try to handle as a domain event
          if (data.eventType) {
            await this.handleDomainEvent(client, data);
          } else {
            console.warn(`Unknown message type: ${data.type}`);
          }
      }
    } catch (err) {
      console.error(`❌ Error processing message from ${clientId}:`, err);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: err.message,
        correlationId: data?.correlationId
      }));
    }
  }
  
  /**
   * Handle authentication
   */
  async handleAuthentication(client, data) {
    client.type = data.clientType || 'unknown';
    client.authenticated = true;
    client.metadata = data.metadata || {};
    
    client.ws.send(JSON.stringify({
      type: 'authentication_success',
      clientId: client.id,
      message: `Authenticated as ${client.type}`
    }));
    
    console.log(`🔐 ${client.id} authenticated as ${client.type}`);
  }
  
  /**
   * Handle command (write operation)
   */
  async handleCommand(client, data) {
    const { aggregateId, commandType, payload, expectedVersion } = data;
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    try {
      // Create domain event from command
      const event = new DomainEvent(
        aggregateId,
        commandType,
        payload,
        {
          correlationId,
          causationId: data.commandId,
          userId: client.metadata.userId || client.id
        }
      );
      
      // Append to event store
      const [envelope] = await this.eventStore.appendEvents(
        aggregateId,
        [event],
        expectedVersion
      );
      
      // Send acknowledgment
      client.ws.send(JSON.stringify({
        type: 'command_accepted',
        commandId: data.commandId,
        eventId: event.eventId,
        correlationId,
        streamPosition: envelope.streamPosition,
        globalPosition: envelope.globalPosition
      }));
      
    } catch (err) {
      client.ws.send(JSON.stringify({
        type: 'command_rejected',
        commandId: data.commandId,
        correlationId,
        error: err.message
      }));
    }
  }
  
  /**
   * Handle query (read operation)
   */
  async handleQuery(client, data) {
    const { queryType, parameters } = data;
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    try {
      let result;
      
      switch (queryType) {
        case 'stream':
          result = await this.eventStore.readStream(
            parameters.streamId,
            parameters.fromVersion,
            parameters.toVersion
          );
          break;
          
        case 'correlation':
          result = await this.eventStore.getEventsByCorrelationId(
            parameters.correlationId
          );
          break;
          
        case 'projection':
          result = this.eventStore.getProjectionState(parameters.projectionName);
          break;
          
        case 'snapshot':
          result = await this.eventStore.getSnapshot(parameters.aggregateId);
          break;
          
        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }
      
      client.ws.send(JSON.stringify({
        type: 'query_result',
        queryId: data.queryId,
        correlationId,
        result
      }));
      
    } catch (err) {
      client.ws.send(JSON.stringify({
        type: 'query_error',
        queryId: data.queryId,
        correlationId,
        error: err.message
      }));
    }
  }
  
  /**
   * Handle subscription
   */
  async handleSubscription(client, data) {
    const { eventTypes, streams } = data;
    
    if (!this.subscriptions.has(client.id)) {
      this.subscriptions.set(client.id, new Set());
    }
    
    const clientSubs = this.subscriptions.get(client.id);
    
    // Subscribe to event types
    if (eventTypes) {
      eventTypes.forEach(type => {
        clientSubs.add(`eventType:${type}`);
        client.subscriptions.add(type);
      });
    }
    
    // Subscribe to streams
    if (streams) {
      streams.forEach(stream => {
        clientSubs.add(`stream:${stream}`);
      });
    }
    
    client.ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      eventTypes,
      streams
    }));
    
    console.log(`📡 ${client.id} subscribed to:`, Array.from(clientSubs));
  }
  
  /**
   * Handle unsubscribe
   */
  async handleUnsubscribe(client, data) {
    const { eventTypes, streams } = data;
    const clientSubs = this.subscriptions.get(client.id);
    
    if (!clientSubs) return;
    
    // Unsubscribe from event types
    if (eventTypes) {
      eventTypes.forEach(type => {
        clientSubs.delete(`eventType:${type}`);
        client.subscriptions.delete(type);
      });
    }
    
    // Unsubscribe from streams
    if (streams) {
      streams.forEach(stream => {
        clientSubs.delete(`stream:${stream}`);
      });
    }
    
    client.ws.send(JSON.stringify({
      type: 'unsubscribe_confirmed',
      eventTypes,
      streams
    }));
  }
  
  /**
   * Handle replay request
   */
  async handleReplay(client, data) {
    const { fromPosition, limit, filter } = data;
    const correlationId = data.correlationId || this.generateCorrelationId();
    
    try {
      const events = await this.eventStore.readAllEvents(fromPosition, limit);
      
      // Apply filter if provided
      const filtered = filter 
        ? events.filter(e => this.matchesFilter(e, filter))
        : events;
      
      // Send events in batches
      const batchSize = 100;
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        
        client.ws.send(JSON.stringify({
          type: 'replay_batch',
          correlationId,
          batch,
          batchNumber: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(filtered.length / batchSize),
          isLast: i + batchSize >= filtered.length
        }));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
    } catch (err) {
      client.ws.send(JSON.stringify({
        type: 'replay_error',
        correlationId,
        error: err.message
      }));
    }
  }
  
  /**
   * Handle domain event
   */
  async handleDomainEvent(client, data) {
    const event = new DomainEvent(
      data.aggregateId,
      data.eventType,
      data.payload,
      data.metadata || {}
    );
    
    // Store in event store
    await this.eventStore.appendEvents(data.aggregateId, [event]);
    
    // Trigger any sagas
    await this.sagaManager.handleEvent(event);
    
    client.ws.send(JSON.stringify({
      type: 'event_stored',
      eventId: event.eventId,
      correlationId: event.metadata.correlationId
    }));
  }
  
  /**
   * Handle image generation request
   */
  async handleImageGenerationRequest(client, data) {
    const correlationId = data.correlationId || this.generateCorrelationId();
    const requestId = data.requestId || `req_${Date.now()}`;
    
    // Create domain event
    const event = new DomainEvent(
      requestId,
      'ImageGenerationRequested',
      {
        prompt: data.prompt,
        fileName: data.fileName,
        downloadFolder: data.downloadFolder,
        domainName: data.domainName || 'chatgpt.com',
        model: data.model || 'dall-e-3',
        parameters: data.parameters || {}
      },
      {
        correlationId,
        userId: data.userId || client.id
      }
    );
    
    // Store event
    await this.eventStore.appendEvents(requestId, [event]);
    
    // Store pending request
    this.pendingRequests.set(requestId, {
      clientId: client.id,
      correlationId,
      timestamp: Date.now()
    });
    
    // Start image generation saga
    await this.sagaManager.startSaga('ImageGenerationSaga', correlationId, {
      requestId,
      event
    });
    
    console.log(`🎨 Image generation saga started: ${requestId}`);
  }
  
  /**
   * Handle image generated event
   */
  async handleImageGenerated(client, data) {
    const requestId = data.requestId;
    const correlationId = data.correlationId;
    
    // Create domain event
    const event = new DomainEvent(
      requestId,
      'ImageGenerated',
      {
        imageUrl: data.imageUrl,
        imagePath: data.imagePath,
        metadata: data.metadata || {}
      },
      {
        correlationId,
        causationId: requestId
      }
    );
    
    // Store event
    await this.eventStore.appendEvents(requestId, [event]);
    
    // Find original requester
    const request = this.pendingRequests.get(requestId);
    if (request) {
      const requester = this.connections.get(request.clientId);
      if (requester && requester.ws.readyState === WebSocket.OPEN) {
        requester.ws.send(JSON.stringify({
          type: 'ImageGeneratedEvent',
          requestId,
          imageUrl: data.imageUrl,
          imagePath: data.imagePath,
          metadata: data.metadata,
          correlationId
        }));
      }
      
      this.pendingRequests.delete(requestId);
    }
    
    console.log(`✅ Image generated and event stored: ${requestId}`);
  }
  
  /**
   * Set up event store listeners
   */
  setupEventStoreListeners() {
    // Listen for all events appended to the store
    this.eventStore.on('eventAppended', (envelope) => {
      this.broadcastEvent(envelope);
    });
    
    // Listen for snapshot requirements
    this.eventStore.on('snapshotRequired', async (streamId, version) => {
      console.log(`📸 Snapshot required for ${streamId} at version ${version}`);
      // Could trigger snapshot creation saga here
    });
  }
  
  /**
   * Broadcast event to subscribed clients
   */
  broadcastEvent(envelope) {
    const event = envelope.event;
    
    // Broadcast to clients subscribed to this event type
    this.connections.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      
      const subs = this.subscriptions.get(client.id);
      if (!subs) return;
      
      // Check if client is subscribed to this event
      const isSubscribed = 
        subs.has(`eventType:${event.eventType}`) ||
        subs.has(`stream:${event.aggregateId}`);
      
      if (isSubscribed) {
        client.ws.send(JSON.stringify({
          type: 'event',
          envelope: envelope.toJSON()
        }));
      }
    });
  }
  
  /**
   * Set up projections
   */
  setupProjections() {
    // Image generation statistics projection
    this.eventStore.createProjection('ImageGenerationStats', {
      ImageGenerationRequested: (state, event) => {
        state.totalRequests = (state.totalRequests || 0) + 1;
        state.pendingRequests = (state.pendingRequests || 0) + 1;
        state.lastRequestAt = event.metadata.timestamp;
        return state;
      },
      ImageGenerated: (state, event) => {
        state.completedRequests = (state.completedRequests || 0) + 1;
        state.pendingRequests = Math.max(0, (state.pendingRequests || 0) - 1);
        state.lastCompletedAt = event.metadata.timestamp;
        return state;
      },
      ImageGenerationFailed: (state, event) => {
        state.failedRequests = (state.failedRequests || 0) + 1;
        state.pendingRequests = Math.max(0, (state.pendingRequests || 0) - 1);
        return state;
      }
    });
    
    // Client activity projection
    this.eventStore.createProjection('ClientActivity', {
      '*': (state, event) => {
        const userId = event.metadata.userId;
        if (!userId) return state;
        
        if (!state[userId]) {
          state[userId] = {
            eventCount: 0,
            lastActivity: null,
            eventTypes: {}
          };
        }
        
        state[userId].eventCount++;
        state[userId].lastActivity = event.metadata.timestamp;
        state[userId].eventTypes[event.eventType] = 
          (state[userId].eventTypes[event.eventType] || 0) + 1;
        
        return state;
      }
    });
  }
  
  /**
   * Register sagas
   */
  registerSagas() {
    // Image Generation Saga
    this.sagaManager.registerSaga('ImageGenerationSaga', (saga) => {
      saga
        .addStep('ValidateRequest', async (context, eventStore) => {
          const { event } = context;
          console.log(`Validating image generation request: ${event.payload.prompt}`);
          
          // Validation logic
          if (!event.payload.prompt) {
            throw new Error('Prompt is required');
          }
          
          return { validated: true };
        })
        .addStep('FindAvailableExtension', async (context, eventStore) => {
          // Find an available browser extension
          let extensionClient = null;
          
          this.connections.forEach((client) => {
            if (client.type === 'extension' && 
                client.authenticated && 
                client.ws.readyState === WebSocket.OPEN) {
              extensionClient = client;
            }
          });
          
          if (!extensionClient) {
            throw new Error('No available extension to handle request');
          }
          
          context.extensionClient = extensionClient;
          return { extensionId: extensionClient.id };
        })
        .addStep('SendToExtension', async (context, eventStore) => {
          const { extensionClient, event, requestId } = context;
          
          // Send request to extension
          extensionClient.ws.send(JSON.stringify({
            type: 'generate_image',
            requestId,
            prompt: event.payload.prompt,
            fileName: event.payload.fileName,
            downloadFolder: event.payload.downloadFolder,
            domainName: event.payload.domainName,
            model: event.payload.model,
            parameters: event.payload.parameters,
            correlationId: event.metadata.correlationId
          }));
          
          console.log(`➡️ Sent to extension ${extensionClient.id}`);
          
          // Record event
          const sentEvent = new DomainEvent(
            requestId,
            'ImageGenerationSentToExtension',
            { extensionId: extensionClient.id },
            { correlationId: event.metadata.correlationId }
          );
          
          await eventStore.appendEvents(requestId, [sentEvent]);
          
          return { sentAt: new Date().toISOString() };
        }, 
        // Compensation for SendToExtension
        async (data, context, eventStore) => {
          console.log('Compensating: Cancelling image generation request');
          
          const cancelEvent = new DomainEvent(
            context.requestId,
            'ImageGenerationCancelled',
            { reason: 'Saga compensation' },
            { correlationId: context.event.metadata.correlationId }
          );
          
          await eventStore.appendEvents(context.requestId, [cancelEvent]);
        });
    });
    
    // Cleanup Saga (runs periodically)
    this.sagaManager.registerSaga('CleanupSaga', (saga) => {
      saga
        .addStep('RemoveOldRequests', async (context, eventStore) => {
          const now = Date.now();
          const timeout = 5 * 60 * 1000; // 5 minutes
          
          let cleaned = 0;
          this.pendingRequests.forEach((request, id) => {
            if (now - request.timestamp > timeout) {
              this.pendingRequests.delete(id);
              cleaned++;
            }
          });
          
          return { cleaned };
        });
    });
  }
  
  /**
   * Check if event matches filter
   */
  matchesFilter(event, filter) {
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }
    
    if (filter.aggregateIds && !filter.aggregateIds.includes(event.aggregateId)) {
      return false;
    }
    
    if (filter.correlationId && event.metadata.correlationId !== filter.correlationId) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Shutdown the server
   */
  async shutdown() {
    console.log('🛑 Shutting down Event-Sourced WebSocket Server...');
    
    // Close all connections
    this.connections.forEach((client) => {
      client.ws.close();
    });
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    console.log('✅ Server shutdown complete');
  }
}

// Export the class
module.exports = EventSourcedWebSocketServer;

// If running directly, start the server
if (require.main === module) {
  const server = new EventSourcedWebSocketServer(8082, {
    path: '/ws-events',
    storePath: './data/events',
    snapshotPath: './data/snapshots'
  });
  
  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });
}