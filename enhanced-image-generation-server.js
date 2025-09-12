#!/usr/bin/env node
/**
 * Enhanced Image Generation WebSocket Server
 * Combines HTTP event receiver with advanced WebSocket orchestration
 * 
 * CRITICAL MISSION: Orchestrate complete ChatGPT image generation workflow
 * CLI (8080) → Server → Extension → ChatGPT → Download → Response
 * 
 * @author CODE-ANALYZER Agent - Hive Mind
 * @version 2.0.0
 */

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const EventStore = require('../images.google.com/infrastructure/event-store/event-store');
const { SagaManager } = require('../images.google.com/infrastructure/saga/saga');
const { DomainEvent } = require('../images.google.com/domain/events/event');
const { CorrelationTracker, CorrelationMiddleware } = require('../images.google.com/infrastructure/middleware/correlation-tracker');
const ImageGenerationSaga = require('../images.google.com/infrastructure/saga/image-generation-saga');

class EnhancedImageGenerationServer {
  constructor(options = {}) {
    // Server configuration
    this.httpPort = options.httpPort || 8080;
    this.wsPort = options.wsPort || 8081;
    this.wsPath = options.wsPath || '/ws-events';
    
    // Security configuration
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
    this.allowedDownloadPaths = options.allowedDownloadPaths || [
      '/tmp',
      path.resolve('./images'),
      path.resolve('./downloads')
    ];
    
    // Initialize core components
    this.eventStore = new EventStore({
      storePath: options.storePath || './data/events',
      snapshotPath: options.snapshotPath || './data/snapshots',
      snapshotFrequency: options.snapshotFrequency || 100
    });
    
    this.correlationTracker = new CorrelationTracker();
    this.correlationMiddleware = new CorrelationMiddleware(this.correlationTracker);
    this.sagaManager = new SagaManager(this.eventStore);
    
    // Server instances
    this.httpServer = null;
    this.wss = null;
    
    // Connection management
    this.connections = new Map();
    this.subscriptions = new Map();
    this.pendingRequests = new Map();
    
    // Performance metrics
    this.metrics = {
      requestsReceived: 0,
      imagesGenerated: 0,
      errors: 0,
      averageProcessingTime: 0,
      startTime: Date.now()
    };
    
    // Initialize components
    this.setupSagaManager();
    this.registerSagas();
    this.setupCleanupJobs();
  }
  
  /**
   * Start the unified server
   */
  async start() {
    console.log('🚀 Enhanced Image Generation Server Starting...');
    console.log(`   HTTP Port: ${this.httpPort} (CLI Events)`);
    console.log(`   WebSocket Port: ${this.wsPort} (Extension Communication)`);
    
    // Initialize event store
    await this.eventStore.initialize();
    console.log('✅ Event Store initialized');
    
    // Start HTTP server for CLI events
    await this.startHttpServer();
    
    // Start WebSocket server for extensions
    await this.startWebSocketServer();
    
    // Setup projections
    this.setupProjections();
    
    console.log('🎯 MISSION READY: Image Generation Orchestration Active');
    console.log(`   Test: curl -X POST http://localhost:${this.httpPort}/events -d '{"type":"ImageGenerationRequestedEvent","payload":{"prompt":"test"}}'`);
    
    return this;
  }
  
  /**
   * Start HTTP server for CLI events
   */
  async startHttpServer() {
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });
    
    await new Promise((resolve) => {
      this.httpServer.listen(this.httpPort, () => {
        console.log(`🌐 HTTP Server listening on port ${this.httpPort}`);
        resolve();
      });
    });
  }
  
  /**
   * Start WebSocket server for extensions
   */
  async startWebSocketServer() {
    this.wss = new WebSocket.Server({
      port: this.wsPort,
      path: this.wsPath
    });
    
    // Setup event store listeners
    this.setupEventStoreListeners();
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws, req) => this.handleWebSocketConnection(ws, req));
    
    console.log(`🔌 WebSocket Server listening on ws://localhost:${this.wsPort}${this.wsPath}`);
  }
  
  /**
   * Handle HTTP requests from CLI
   */
  async handleHttpRequest(req, res) {
    const startTime = Date.now();
    
    // CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    console.log(`📥 HTTP ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    
    if (req.url === '/events' && req.method === 'POST') {
      await this.handleEventFromCLI(req, res, startTime);
    } else if (req.url === '/health' && req.method === 'GET') {
      await this.handleHealthCheck(req, res);
    } else if (req.url === '/metrics' && req.method === 'GET') {
      await this.handleMetrics(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Enhanced Image Generation Server - Endpoint not found');
    }
  }
  
  /**
   * Handle event from CLI
   */
  async handleEventFromCLI(req, res, startTime) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
      // Security: Prevent oversized requests
      if (body.length > this.maxFileSize) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('Request too large');
        return;
      }
    });
    
    req.on('end', async () => {
      try {
        const event = JSON.parse(body);
        
        // Security: Input validation
        if (!this.validateEventInput(event)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid event structure' }));
          return;
        }
        
        console.log('🎯 Received CLI event:', event.type);
        this.metrics.requestsReceived++;
        
        // Process through correlation middleware
        const correlationId = this.correlationTracker.ensureCorrelationId(event);
        event.correlationId = correlationId;
        
        // Handle the event
        await this.processCliEvent(event);
        
        // Calculate processing time
        const processingTime = Date.now() - startTime;
        this.updateMetrics('processingTime', processingTime);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'accepted',
          correlationId,
          processingTime: `${processingTime}ms`,
          message: 'Event forwarded to orchestration engine'
        }));
        
      } catch (error) {
        console.error('❌ Error processing CLI event:', error);
        this.metrics.errors++;
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid JSON or processing error',
          message: error.message 
        }));
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ HTTP request error:', error);
      res.writeHead(500);
      res.end();
    });
  }
  
  /**
   * Handle health check
   */
  async handleHealthCheck(req, res) {
    const stats = this.correlationTracker.getStats();
    const uptime = Date.now() - this.metrics.startTime;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(uptime / 1000)}s`,
      components: {
        httpServer: 'running',
        webSocketServer: 'running',
        eventStore: 'running',
        sagaManager: 'running'
      },
      connections: {
        active: this.connections.size,
        extensions: Array.from(this.connections.values())
          .filter(c => c.type === 'extension' && c.authenticated).length
      },
      correlations: stats,
      metrics: this.metrics
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }
  
  /**
   * Handle metrics endpoint
   */
  async handleMetrics(req, res) {
    const sagaStats = await this.sagaManager.getStats();
    const eventStoreStats = this.eventStore.getStats();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      requests: this.metrics,
      sagas: sagaStats,
      eventStore: eventStoreStats,
      correlations: this.correlationTracker.getStats()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }
  
  /**
   * Process CLI event
   */
  async processCliEvent(event) {
    switch (event.type) {
      case 'ImageGenerationRequestedEvent':
      case 'generate_image_request':
        await this.handleImageGenerationRequest(event);
        break;
        
      case 'ping':
        await this.broadcastToExtensions({
          type: 'pong',
          timestamp: Date.now(),
          correlationId: event.correlationId
        });
        break;
        
      default:
        console.warn(`Unknown CLI event type: ${event.type}`);
        // Still try to process as domain event
        await this.processDomainEvent(event);
    }
  }
  
  /**
   * Handle image generation request from CLI
   */
  async handleImageGenerationRequest(event) {
    const { payload, correlationId } = event;
    const requestId = `img_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎨 Processing image generation request: "${payload.prompt}"`);
    
    // Security: Validate and sanitize download path
    const sanitizedPath = await this.validateAndSanitizePath(
      payload.outputPath || payload.downloadFolder || '/tmp'
    );
    
    // Create domain event
    const domainEvent = new DomainEvent(
      requestId,
      'ImageGenerationRequested',
      {
        prompt: payload.prompt,
        fileName: payload.fileName || `generated_${Date.now()}.png`,
        downloadFolder: sanitizedPath,
        domainName: payload.domainName || 'chatgpt.com',
        model: payload.model || 'dall-e-3',
        parameters: payload.parameters || {},
        originalRequestId: event.requestId,
        source: 'cli'
      },
      {
        correlationId,
        userId: event.userId || 'cli_user',
        timestamp: new Date().toISOString()
      }
    );
    
    // Track the event
    this.correlationTracker.trackEvent(correlationId, domainEvent);
    
    // Store in event store
    await this.eventStore.appendEvents(requestId, [domainEvent]);
    
    // Store pending request for tracking
    this.pendingRequests.set(requestId, {
      correlationId,
      startTime: Date.now(),
      source: 'cli',
      originalEvent: event
    });
    
    // Start the comprehensive image generation saga
    await this.sagaManager.startSaga('ImageGenerationWorkflow', correlationId, {
      requestId,
      triggerEvent: domainEvent
    });
    
    console.log(`✅ Image generation saga initiated: ${requestId}`);
  }
  
  /**
   * Handle WebSocket connection from extensions
   */
  handleWebSocketConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;
    
    console.log(`✅ Extension connected: ${clientId} from ${clientIp}`);
    
    // Create client object
    const client = {
      ws,
      id: clientId,
      type: null,
      authenticated: false,
      metadata: {},
      subscriptions: new Set(),
      connectedAt: Date.now()
    };
    
    this.connections.set(clientId, client);
    
    // Send enhanced welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      message: 'Connected to Enhanced Image Generation Server',
      serverVersion: '2.0.0',
      capabilities: [
        'image-generation-orchestration',
        'event-sourcing',
        'saga-coordination',
        'correlation-tracking',
        'real-time-subscriptions'
      ],
      ports: {
        http: this.httpPort,
        websocket: this.wsPort
      }
    }));
    
    // Handle messages
    ws.on('message', async (message) => {
      await this.handleWebSocketMessage(clientId, message);
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log(`❌ Extension disconnected: ${clientId}`);
      this.connections.delete(clientId);
      this.subscriptions.delete(clientId);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error(`⚠️ WebSocket error for ${clientId}:`, error);
      this.connections.delete(clientId);
    });
  }
  
  /**
   * Handle WebSocket message from extension
   */
  async handleWebSocketMessage(clientId, message) {
    const client = this.connections.get(clientId);
    
    try {
      const data = JSON.parse(message.toString());
      
      // Process through correlation middleware
      const processedData = this.correlationMiddleware.processIncoming(data, clientId);
      
      console.log(`📨 Extension message [${processedData.type}] from ${clientId}`);
      
      // Handle different message types
      switch (processedData.type) {
        case 'authenticate':
          await this.handleExtensionAuthentication(client, processedData);
          break;
          
        case 'image_generated':
        case 'ImageGeneratedEvent':
          await this.handleImageGenerated(client, processedData);
          break;
          
        case 'image_generation_failed':
        case 'ImageGenerationFailedEvent':
          await this.handleImageGenerationFailed(client, processedData);
          break;
          
        case 'image_generation_initiated':
        case 'ImageGenerationInitiated':
          await this.handleImageGenerationInitiated(client, processedData);
          break;
          
        case 'subscribe':
          await this.handleSubscription(client, processedData);
          break;
          
        case 'heartbeat':
        case 'ping':
          client.ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: Date.now(),
            correlationId: processedData.correlationId
          }));
          break;
          
        default:
          console.warn(`Unknown extension message type: ${processedData.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing extension message from ${clientId}:`, error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: error.message,
        timestamp: Date.now()
      }));
    }
  }
  
  /**
   * Handle extension authentication
   */
  async handleExtensionAuthentication(client, data) {
    client.type = 'extension';
    client.authenticated = true;
    client.metadata = {
      ...data.metadata,
      version: data.version || 'unknown',
      userAgent: data.userAgent || 'unknown'
    };
    
    client.ws.send(JSON.stringify({
      type: 'authentication_success',
      clientId: client.id,
      message: 'Extension authenticated successfully',
      serverCapabilities: [
        'image-generation-coordination',
        'event-tracking',
        'progress-monitoring'
      ]
    }));
    
    console.log(`🔐 Extension authenticated: ${client.id} v${client.metadata.version}`);
  }
  
  /**
   * Handle image generated from extension
   */
  async handleImageGenerated(client, data) {
    const { requestId, imageUrl, imagePath, correlationId } = data;
    
    console.log(`📸 Image generated: ${requestId}`);
    
    // Create domain event
    const event = new DomainEvent(
      requestId,
      'ImageGenerated',
      {
        imageUrl,
        imagePath,
        extensionId: client.id,
        generatedAt: new Date().toISOString(),
        metadata: data.metadata || {}
      },
      {
        correlationId,
        causationId: requestId
      }
    );
    
    // Track the event
    this.correlationTracker.trackEvent(correlationId, event);
    
    // Store in event store
    await this.eventStore.appendEvents(requestId, [event]);
    
    // Update metrics
    this.metrics.imagesGenerated++;
    
    // Saga will handle further processing (download, notification, etc.)
    console.log(`✅ Image generation event recorded: ${requestId}`);
  }
  
  /**
   * Handle image generation initiated from extension
   */
  async handleImageGenerationInitiated(client, data) {
    const { requestId, correlationId } = data;
    
    console.log(`🔄 Image generation initiated: ${requestId}`);
    
    // Create domain event
    const event = new DomainEvent(
      requestId,
      'ImageGenerationInitiated',
      {
        extensionId: client.id,
        initiatedAt: new Date().toISOString(),
        estimatedTime: data.estimatedTime || null
      },
      { correlationId }
    );
    
    // Store in event store
    await this.eventStore.appendEvents(requestId, [event]);
    
    console.log(`✅ Image generation initiated event recorded: ${requestId}`);
  }
  
  /**
   * Handle image generation failed from extension
   */
  async handleImageGenerationFailed(client, data) {
    const { requestId, error, correlationId } = data;
    
    console.error(`💥 Image generation failed: ${requestId} - ${error}`);
    
    // Create domain event
    const event = new DomainEvent(
      requestId,
      'ImageGenerationFailed',
      {
        error,
        extensionId: client.id,
        failedAt: new Date().toISOString()
      },
      { correlationId }
    );
    
    // Store in event store
    await this.eventStore.appendEvents(requestId, [event]);
    
    this.metrics.errors++;
    
    console.log(`❌ Image generation failure recorded: ${requestId}`);
  }
  
  /**
   * Setup saga manager with correlation tracking
   */
  setupSagaManager() {
    const originalStartSaga = this.sagaManager.startSaga.bind(this.sagaManager);
    
    this.sagaManager.startSaga = async (name, correlationId, context = {}) => {
      // Ensure correlation exists
      if (!this.correlationTracker.getCorrelation(correlationId)) {
        this.correlationTracker.createCorrelation({ sagaName: name });
      }
      
      // Start the saga
      const result = await originalStartSaga(name, correlationId, context);
      
      // Track the saga
      const saga = this.sagaManager.getSagaByCorrelationId(correlationId);
      if (saga) {
        this.correlationTracker.trackSaga(correlationId, saga.sagaId);
      }
      
      return result;
    };
  }
  
  /**
   * Register all sagas
   */
  registerSagas() {
    // Register the comprehensive image generation saga
    ImageGenerationSaga.define(this.sagaManager, this);
    
    console.log('✅ Image generation sagas registered');
  }
  
  /**
   * Setup event store listeners
   */
  setupEventStoreListeners() {
    // Listen for all events appended to the store
    this.eventStore.on('eventAppended', (envelope) => {
      this.broadcastEvent(envelope);
    });
  }
  
  /**
   * Setup projections
   */
  setupProjections() {
    // Enhanced image generation statistics projection
    this.eventStore.createProjection('ImageGenerationStats', {
      ImageGenerationRequested: (state, event) => {
        state.totalRequests = (state.totalRequests || 0) + 1;
        state.pendingRequests = (state.pendingRequests || 0) + 1;
        state.requestsPerHour = this.calculateRequestsPerHour(state);
        state.lastRequestAt = event.metadata.timestamp;
        return state;
      },
      ImageGenerated: (state, event) => {
        state.completedRequests = (state.completedRequests || 0) + 1;
        state.pendingRequests = Math.max(0, (state.pendingRequests || 0) - 1);
        state.successRate = this.calculateSuccessRate(state);
        state.lastCompletedAt = event.metadata.timestamp;
        return state;
      },
      ImageGenerationFailed: (state, event) => {
        state.failedRequests = (state.failedRequests || 0) + 1;
        state.pendingRequests = Math.max(0, (state.pendingRequests || 0) - 1);
        state.successRate = this.calculateSuccessRate(state);
        state.lastFailureAt = event.metadata.timestamp;
        return state;
      }
    });
    
    console.log('✅ Projections setup complete');
  }
  
  /**
   * Broadcast event to subscribed clients
   */
  broadcastEvent(envelope) {
    const event = envelope.event;
    
    this.connections.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN || !client.authenticated) return;
      
      const subs = this.subscriptions.get(client.id);
      if (!subs) return;
      
      // Check if client is subscribed to this event type
      const isSubscribed = 
        subs.has(`eventType:${event.eventType}`) ||
        subs.has(`stream:${event.aggregateId}`);
      
      if (isSubscribed) {
        const message = this.correlationMiddleware.processOutgoing({
          type: 'event',
          envelope: envelope.toJSON()
        }, client.id);
        
        client.ws.send(JSON.stringify(message));
      }
    });
  }
  
  /**
   * Broadcast message to all extensions
   */
  broadcastToExtensions(message) {
    const extensionClients = Array.from(this.connections.values())
      .filter(client => 
        client.type === 'extension' && 
        client.authenticated && 
        client.ws.readyState === WebSocket.OPEN
      );
    
    console.log(`📤 Broadcasting to ${extensionClients.length} extension(s)`);
    
    const messageStr = JSON.stringify(message);
    extensionClients.forEach(client => {
      client.ws.send(messageStr);
    });
  }
  
  /**
   * Handle subscription from client
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
      streams,
      totalSubscriptions: clientSubs.size
    }));
    
    console.log(`📡 ${client.id} subscribed to: ${Array.from(clientSubs).join(', ')}`);
  }
  
  /**
   * Setup cleanup jobs
   */
  setupCleanupJobs() {
    // Clean up stale pending requests every 5 minutes
    setInterval(() => {
      this.cleanupStaleRequests();
    }, 5 * 60 * 1000);
    
    // Clean up old connections every minute
    setInterval(() => {
      this.cleanupDeadConnections();
    }, 60 * 1000);
  }
  
  /**
   * Clean up stale requests
   */
  cleanupStaleRequests() {
    const now = Date.now();
    const staleTimeout = 30 * 60 * 1000; // 30 minutes
    const toDelete = [];
    
    this.pendingRequests.forEach((request, requestId) => {
      if (now - request.startTime > staleTimeout) {
        toDelete.push(requestId);
      }
    });
    
    toDelete.forEach(requestId => {
      this.pendingRequests.delete(requestId);
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} stale requests`);
    }
  }
  
  /**
   * Clean up dead connections
   */
  cleanupDeadConnections() {
    const toDelete = [];
    
    this.connections.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.CLOSED) {
        toDelete.push(clientId);
      }
    });
    
    toDelete.forEach(clientId => {
      this.connections.delete(clientId);
      this.subscriptions.delete(clientId);
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} dead connections`);
    }
  }
  
  /**
   * Validate event input for security
   */
  validateEventInput(event) {
    if (!event || typeof event !== 'object') return false;
    if (!event.type || typeof event.type !== 'string') return false;
    if (event.type.length > 100) return false; // Reasonable limit
    
    // Additional validation for image generation events
    if (event.type === 'ImageGenerationRequestedEvent') {
      if (!event.payload || !event.payload.prompt) return false;
      if (event.payload.prompt.length > 2000) return false; // Reasonable prompt limit
    }
    
    return true;
  }
  
  /**
   * Validate and sanitize file path for security
   */
  async validateAndSanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '/tmp';
    }
    
    // Resolve to absolute path
    const resolvedPath = path.resolve(inputPath);
    
    // Check if path is in allowed directories
    const isAllowed = this.allowedDownloadPaths.some(allowedPath => {
      return resolvedPath.startsWith(path.resolve(allowedPath));
    });
    
    if (!isAllowed) {
      console.warn(`⚠️ Path rejected for security: ${inputPath} -> ${resolvedPath}`);
      return '/tmp';
    }
    
    // Ensure directory exists
    try {
      await fs.access(resolvedPath);
    } catch (err) {
      await fs.mkdir(resolvedPath, { recursive: true });
      console.log(`📁 Created directory: ${resolvedPath}`);
    }
    
    return resolvedPath;
  }
  
  /**
   * Update metrics
   */
  updateMetrics(metric, value) {
    if (metric === 'processingTime') {
      const current = this.metrics.averageProcessingTime;
      const count = this.metrics.requestsReceived;
      this.metrics.averageProcessingTime = ((current * (count - 1)) + value) / count;
    }
  }
  
  /**
   * Calculate success rate
   */
  calculateSuccessRate(state) {
    const total = (state.completedRequests || 0) + (state.failedRequests || 0);
    if (total === 0) return 100;
    return Math.round(((state.completedRequests || 0) / total) * 100);
  }
  
  /**
   * Calculate requests per hour
   */
  calculateRequestsPerHour(state) {
    const uptime = Date.now() - this.metrics.startTime;
    const hours = uptime / (1000 * 60 * 60);
    return Math.round((state.totalRequests || 0) / Math.max(hours, 0.1));
  }
  
  /**
   * Generate client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Process domain event
   */
  async processDomainEvent(event) {
    const domainEvent = new DomainEvent(
      event.aggregateId || `unknown_${Date.now()}`,
      event.eventType || event.type,
      event.payload || {},
      {
        ...event.metadata,
        correlationId: event.correlationId,
        source: 'cli'
      }
    );
    
    await this.eventStore.appendEvents(domainEvent.aggregateId, [domainEvent]);
    console.log(`✅ Domain event processed: ${domainEvent.eventType}`);
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down Enhanced Image Generation Server...');
    
    // Close all WebSocket connections
    this.connections.forEach((client) => {
      client.ws.close();
    });
    
    // Close servers
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    console.log('✅ Server shutdown complete');
  }
}

// Export the class
module.exports = EnhancedImageGenerationServer;

// If running directly, start the server
if (require.main === module) {
  const server = new EnhancedImageGenerationServer({
    httpPort: process.env.HTTP_PORT || 8080,
    wsPort: process.env.WS_PORT || 8081,
    storePath: process.env.EVENT_STORE_PATH || './data/events',
    snapshotPath: process.env.SNAPSHOT_PATH || './data/snapshots',
    allowedDownloadPaths: [
      '/tmp',
      path.resolve('./images'),
      path.resolve('./downloads'),
      path.resolve('./temp')
    ]
  });
  
  server.start().catch(err => {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    console.log('\n👋 Received shutdown signal...');
    await server.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    server.shutdown().finally(() => process.exit(1));
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
  });
}