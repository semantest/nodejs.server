/**
 * @fileoverview WebSocket Server for Real-time Extension Communication
 * @description Socket.IO server for browser extension event notifications
 * @issue #23 - NewChatRequested real-time events
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { RateLimiterService } from '../../../rate-limiting/rate-limiter-service';
import {
  WSEventType,
  WSEvent,
  WSClientMessage,
  ConnectionAckEvent,
  AuthSuccessEvent,
  NewChatRequestedEvent,
  ImageJobProgressEvent,
  ImageJobCompletedEvent,
  QuotaUpdatedEvent
} from '../schemas/websocket-events.schema';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

interface SocketData {
  userId: string;
  connectionId: string;
  permissions: string[];
  subscriptions: Set<WSEventType>;
  lastActivity: Date;
}

export class WebSocketServer extends EventEmitter {
  private io: SocketIOServer;
  private rateLimiter: RateLimiterService;
  private connections: Map<string, Socket> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    super();
    
    this.rateLimiter = new RateLimiterService();
    
    // Initialize Socket.IO with CORS and options
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Check rate limit
        const allowed = await this.rateLimiter.checkLimit(`ws:${decoded.userId}`, {
          windowMs: 60000,
          max: 100 // 100 connections per minute
        });

        if (!allowed) {
          return next(new Error('Rate limit exceeded'));
        }

        // Attach user data to socket
        const socketData: SocketData = {
          userId: decoded.userId,
          connectionId: uuidv4(),
          permissions: decoded.permissions || [],
          subscriptions: new Set([
            WSEventType.NEW_CHAT_REQUESTED,
            WSEventType.IMAGE_JOB_PROGRESS,
            WSEventType.IMAGE_JOB_COMPLETED,
            WSEventType.QUOTA_UPDATED
          ]),
          lastActivity: new Date()
        };

        socket.data = socketData;
        next();

      } catch (error) {
        logger.error('WebSocket authentication failed', { error });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const { userId, connectionId } = socket.data as SocketData;
      
      logger.info('WebSocket connection established', { userId, connectionId });

      // Track connection
      this.connections.set(connectionId, socket);
      
      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(connectionId);

      // Join user room for targeted events
      socket.join(`user:${userId}`);

      // Send connection acknowledgment
      this.sendConnectionAck(socket);

      // Setup client message handlers
      this.setupClientHandlers(socket);

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket disconnected', { userId, connectionId, reason });
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', { userId, connectionId, error });
      });
    });
  }

  /**
   * Send connection acknowledgment
   */
  private sendConnectionAck(socket: Socket): void {
    const { userId, connectionId } = socket.data as SocketData;

    const event: ConnectionAckEvent = {
      id: uuidv4(),
      type: WSEventType.CONNECTION_ACK,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        connectionId,
        serverTime: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['chat', 'image_generation', 'real_time_updates']
      }
    };

    socket.emit('event', event);

    // Send auth success with quota info
    this.sendAuthSuccess(socket);
  }

  /**
   * Send auth success event
   */
  private async sendAuthSuccess(socket: Socket): Promise<void> {
    const { userId, permissions } = socket.data as SocketData;

    // Get user quota info (mock for now)
    const quotaInfo = {
      dailyLimit: 100,
      remaining: 85,
      resetAt: new Date(Date.now() + 86400000).toISOString()
    };

    const event: AuthSuccessEvent = {
      id: uuidv4(),
      type: WSEventType.AUTH_SUCCESS,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        userId,
        permissions,
        quotaInfo
      }
    };

    socket.emit('event', event);
  }

  /**
   * Setup client message handlers
   */
  private setupClientHandlers(socket: Socket): void {
    const { userId } = socket.data as SocketData;

    // Handle subscription updates
    socket.on('message', async (message: WSClientMessage) => {
      try {
        logger.debug('Received client message', { userId, type: message.type });

        switch (message.type) {
          case 'subscription.update':
            this.handleSubscriptionUpdate(socket, message.data);
            break;
          
          case 'ping':
            socket.emit('pong', { timestamp: new Date().toISOString() });
            break;

          default:
            logger.warn('Unknown message type', { type: message.type });
        }

        // Update last activity
        (socket.data as SocketData).lastActivity = new Date();

      } catch (error) {
        logger.error('Error handling client message', { error, userId });
        socket.emit('error', { message: 'Failed to process message' });
      }
    });
  }

  /**
   * Handle subscription updates
   */
  private handleSubscriptionUpdate(socket: Socket, data: any): void {
    const socketData = socket.data as SocketData;
    
    if (data.subscribe) {
      data.subscribe.forEach((event: WSEventType) => {
        socketData.subscriptions.add(event);
      });
    }

    if (data.unsubscribe) {
      data.unsubscribe.forEach((event: WSEventType) => {
        socketData.subscriptions.delete(event);
      });
    }

    socket.emit('subscription.updated', {
      subscriptions: Array.from(socketData.subscriptions)
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const { userId, connectionId } = socket.data as SocketData;
    
    // Remove from tracking
    this.connections.delete(connectionId);
    
    const userConnections = this.userSockets.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  // ===== Public Methods for Sending Events =====

  /**
   * Send event to specific user
   */
  public sendToUser(userId: string, event: WSEvent): void {
    this.io.to(`user:${userId}`).emit('event', event);
  }

  /**
   * Send event to specific connection
   */
  public sendToConnection(connectionId: string, event: WSEvent): void {
    const socket = this.connections.get(connectionId);
    if (socket) {
      socket.emit('event', event);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  public broadcast(event: WSEvent): void {
    this.io.emit('event', event);
  }

  /**
   * Send new chat requested event
   */
  public notifyNewChatRequested(userId: string, data: Omit<NewChatRequestedEvent['data'], 'timestamp'>): void {
    const event: NewChatRequestedEvent = {
      id: uuidv4(),
      type: WSEventType.NEW_CHAT_REQUESTED,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    };

    this.sendToUser(userId, event);
  }

  /**
   * Send image job progress update
   */
  public notifyImageProgress(userId: string, jobId: string, progress: number, status: any): void {
    const event: ImageJobProgressEvent = {
      id: uuidv4(),
      type: WSEventType.IMAGE_JOB_PROGRESS,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        jobId,
        status,
        progress
      }
    };

    this.sendToUser(userId, event);
  }

  /**
   * Send image job completion
   */
  public notifyImageCompleted(userId: string, jobId: string, result: any): void {
    const event: ImageJobCompletedEvent = {
      id: uuidv4(),
      type: WSEventType.IMAGE_JOB_COMPLETED,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        jobId,
        result,
        processingTime: result.processingTime
      }
    };

    this.sendToUser(userId, event);
  }

  /**
   * Send quota update
   */
  public notifyQuotaUpdate(userId: string, quotaInfo: any): void {
    const event: QuotaUpdatedEvent = {
      id: uuidv4(),
      type: WSEventType.QUOTA_UPDATED,
      timestamp: new Date().toISOString(),
      userId,
      data: {
        ...quotaInfo,
        reason: 'generation'
      }
    };

    this.sendToUser(userId, event);
  }

  /**
   * Get connection stats
   */
  public getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    connectionsPerUser: Record<string, number>;
  } {
    const connectionsPerUser: Record<string, number> = {};
    
    this.userSockets.forEach((connections, userId) => {
      connectionsPerUser[userId] = connections.size;
    });

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userSockets.size,
      connectionsPerUser
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server');
    
    // Notify all clients
    this.broadcast({
      id: uuidv4(),
      type: WSEventType.SERVER_NOTIFICATION,
      timestamp: new Date().toISOString(),
      userId: 'system',
      data: {
        message: 'Server is shutting down for maintenance',
        reconnectIn: 30000
      }
    } as any);

    // Close all connections
    this.io.close();
  }
}