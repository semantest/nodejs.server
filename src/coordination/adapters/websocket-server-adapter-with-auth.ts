/**
 * @fileoverview WebSocket server adapter with JWT authentication
 * @description Enhanced WebSocket server with secure JWT-based authentication
 * @author Web-Buddy Team
 */

import { Adapter, AdapterFor, Port } from '../../stubs/typescript-eda-stubs';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { TokenManager } from '../../auth/infrastructure/token-manager';
import { createWebSocketAuthHandler, AuthenticatedUser } from '../../auth/infrastructure/jwt-middleware';

/**
 * Port interface for WebSocket server operations
 */
export abstract class WebSocketServerPort extends Port {
  public readonly name = 'WebSocketServerPort';
  
  public abstract startServer(port: number): Promise<void>;
  public abstract stopServer(): Promise<void>;
  public abstract broadcastMessage(message: any): Promise<void>;
  public abstract sendMessageToExtension(extensionId: string, message: any): Promise<void>;
  public abstract getConnectionCount(): Promise<number>;
  public abstract getConnectionInfo(extensionId: string): Promise<ConnectionInfo | null>;
}

/**
 * WebSocket server adapter with JWT authentication
 * Handles secure browser extension connections and real-time message routing
 */
@AdapterFor(WebSocketServerPort)
export class WebSocketServerAdapterWithAuth extends WebSocketServerPort {
  private server?: WebSocket.Server;
  private connections = new Map<string, ExtensionConnection>();
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private tokenManager?: TokenManager;
  private authHandler?: ReturnType<typeof createWebSocketAuthHandler>;

  /**
   * Initialize with token manager
   */
  public setTokenManager(tokenManager: TokenManager): void {
    this.tokenManager = tokenManager;
    this.authHandler = createWebSocketAuthHandler(tokenManager);
  }

  /**
   * Start the WebSocket server on specified port
   */
  public async startServer(port: number): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ WebSocket server is already running');
      return;
    }

    if (!this.tokenManager || !this.authHandler) {
      throw new Error('Token manager not initialized. Call setTokenManager() first.');
    }

    console.log(`🔌 Starting secure WebSocket server on port ${port}...`);

    try {
      this.server = new WebSocket.Server({
        port: port + 1, // WebSocket on port + 1
        path: '/ws',
        verifyClient: this.verifyClient.bind(this)
      });

      this.setupServerListeners();
      this.startHeartbeatMonitoring();
      
      this.isRunning = true;
      
      console.log(`✅ Secure WebSocket server started on ws://localhost:${port + 1}/ws`);
      
    } catch (error) {
      console.error('❌ Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Verify client authentication before accepting connection
   */
  private async verifyClient(
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (result: boolean, code?: number, statusMessage?: string) => void
  ): Promise<void> {
    try {
      // Extract token from Authorization header or query parameter
      let token: string | null = null;
      
      // Check Authorization header
      const authHeader = info.req.headers.authorization;
      if (authHeader) {
        token = TokenManager.extractTokenFromHeader(authHeader);
      }
      
      // Fallback to query parameter
      if (!token) {
        const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
        token = url.searchParams.get('token');
      }

      if (!token) {
        callback(false, 401, 'Authentication required');
        return;
      }

      // Verify token
      await this.tokenManager!.verifyAccessToken(token);
      callback(true);
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Stop the WebSocket server gracefully
   */
  public async stopServer(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ WebSocket server is not running');
      return;
    }

    console.log('🛑 Stopping WebSocket server...');

    try {
      // Stop heartbeat monitoring
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Close all active connections
      for (const [extensionId, connection] of this.connections) {
        console.log(`🔌 Closing connection to extension ${extensionId}`);
        connection.websocket.close(1000, 'Server shutdown');
      }

      // Close the server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      this.connections.clear();
      this.isRunning = false;
      
      console.log('✅ WebSocket server stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all authenticated connections
   */
  public async broadcastMessage(message: any): Promise<void> {
    const messageString = JSON.stringify(message);
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.websocket.readyState === WebSocket.OPEN && conn.authenticated);

    console.log(`📡 Broadcasting message to ${activeConnections.length} authenticated extensions`);

    const sendPromises = activeConnections.map(async (connection) => {
      try {
        connection.websocket.send(messageString);
        connection.messagesSent++;
        connection.lastActivity = new Date();
      } catch (error) {
        console.error(`❌ Failed to send message to ${connection.extensionId}:`, error);
        connection.websocket.terminate();
      }
    });

    await Promise.allSettled(sendPromises);
  }

  /**
   * Send message to specific authenticated extension
   */
  public async sendMessageToExtension(extensionId: string, message: any): Promise<void> {
    const connection = this.connections.get(extensionId);
    if (!connection) {
      throw new Error(`Extension ${extensionId} not connected`);
    }

    if (!connection.authenticated) {
      throw new Error(`Extension ${extensionId} not authenticated`);
    }

    if (connection.websocket.readyState !== WebSocket.OPEN) {
      throw new Error(`Extension ${extensionId} connection is not open`);
    }

    try {
      const messageString = JSON.stringify(message);
      connection.websocket.send(messageString);
      connection.messagesSent++;
      connection.lastActivity = new Date();
      
      console.log(`📤 Message sent to extension ${extensionId}:`, message.type || 'unknown');
      
    } catch (error) {
      console.error(`❌ Failed to send message to ${extensionId}:`, error);
      throw error;
    }
  }

  /**
   * Get total authenticated connection count
   */
  public async getConnectionCount(): Promise<number> {
    return Array.from(this.connections.values())
      .filter(conn => conn.authenticated).length;
  }

  /**
   * Get connection information for specific extension
   */
  public async getConnectionInfo(extensionId: string): Promise<ConnectionInfo | null> {
    const connection = this.connections.get(extensionId);
    if (!connection || !connection.authenticated) {
      return null;
    }

    return {
      extensionId: connection.extensionId,
      connected: connection.websocket.readyState === WebSocket.OPEN,
      authenticated: connection.authenticated,
      connectedAt: connection.connectedAt,
      lastActivity: connection.lastActivity,
      messagesSent: connection.messagesSent,
      messagesReceived: connection.messagesReceived,
      remoteAddress: connection.remoteAddress,
      userAgent: connection.userAgent,
      userId: connection.user?.userId,
      sessionId: connection.user?.sessionId
    };
  }

  /**
   * Set up WebSocket server event listeners
   */
  private setupServerListeners(): void {
    if (!this.server) return;

    this.server.on('connection', async (websocket: WebSocket, request: IncomingMessage) => {
      await this.handleNewConnection(websocket, request);
    });

    this.server.on('error', (error: Error) => {
      console.error('❌ WebSocket server error:', error);
    });

    this.server.on('close', () => {
      console.log('🔌 WebSocket server closed');
    });
  }

  /**
   * Handle new WebSocket connection with authentication
   */
  private async handleNewConnection(websocket: WebSocket, request: IncomingMessage): Promise<void> {
    const remoteAddress = request.socket.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    
    console.log(`🔌 New WebSocket connection from ${remoteAddress}`);

    try {
      // Authenticate the connection
      const user = await this.authHandler!(websocket, request);
      
      if (!user) {
        console.log('❌ WebSocket authentication failed');
        return; // Connection already closed by auth handler
      }

      // Use extension ID if available, otherwise use user ID
      const connectionId = user.extensionId || user.userId;
      
      const connection: ExtensionConnection = {
        extensionId: connectionId,
        websocket,
        connectedAt: new Date(),
        lastActivity: new Date(),
        messagesSent: 0,
        messagesReceived: 0,
        remoteAddress,
        userAgent,
        authenticated: true,
        user
      };

      // Set up connection event listeners
      this.setupConnectionListeners(connection);

      // Store connection
      this.connections.set(connectionId, connection);

      // Send authentication success
      this.sendMessage(connection, {
        type: 'authentication_success',
        extensionId: connectionId,
        userId: user.userId,
        sessionId: user.sessionId,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Extension ${connectionId} authenticated (User: ${user.userId})`);

    } catch (error) {
      console.error('❌ Error handling new connection:', error);
      websocket.close(1011, 'Server error');
    }
  }

  /**
   * Set up event listeners for authenticated connection
   */
  private setupConnectionListeners(connection: ExtensionConnection): void {
    connection.websocket.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connection, data);
    });

    connection.websocket.on('close', (code: number, reason: string) => {
      this.handleConnectionClose(connection, code, reason);
    });

    connection.websocket.on('error', (error: Error) => {
      console.error(`❌ WebSocket connection error for ${connection.extensionId}:`, error);
    });

    connection.websocket.on('pong', () => {
      connection.lastActivity = new Date();
    });
  }

  /**
   * Handle incoming message from authenticated extension
   */
  private handleMessage(connection: ExtensionConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      connection.messagesReceived++;
      connection.lastActivity = new Date();

      console.log(`📥 Message from ${connection.extensionId} (User: ${connection.user?.userId}):`, 
        message.type || 'unknown');

      // Handle heartbeat
      if (message.type === 'heartbeat') {
        this.handleHeartbeat(connection, message);
        return;
      }

      // Route other messages
      this.routeMessage(connection, message);

    } catch (error) {
      console.error(`❌ Failed to parse message from ${connection.extensionId}:`, error);
      this.sendErrorResponse(connection, 'Invalid message format');
    }
  }

  /**
   * Handle heartbeat from extension
   */
  private handleHeartbeat(connection: ExtensionConnection, message: any): void {
    console.log(`💓 Heartbeat from ${connection.extensionId}`);
    
    // Send heartbeat response
    this.sendMessage(connection, {
      type: 'heartbeat_response',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Route message to appropriate handler
   */
  private routeMessage(connection: ExtensionConnection, message: any): void {
    // In real implementation, this would route to the coordination application
    console.log(`🚀 Routing message type '${message.type}' from ${connection.extensionId}`);
    
    // Add user context to message
    const enrichedMessage = {
      ...message,
      _meta: {
        extensionId: connection.extensionId,
        userId: connection.user?.userId,
        sessionId: connection.user?.sessionId,
        timestamp: new Date().toISOString()
      }
    };

    // Route enriched message
    // this.emit(new MessageReceivedEvent(enrichedMessage));
  }

  /**
   * Handle WebSocket connection close
   */
  private handleConnectionClose(connection: ExtensionConnection, code: number, reason: string): void {
    console.log(`🔌 Connection closed for ${connection.extensionId}: ${code} ${reason}`);
    
    const sessionDuration = Date.now() - connection.connectedAt.getTime();
    
    // Remove from connections
    this.connections.delete(connection.extensionId);

    // Log session info
    console.log(`📊 Session stats for ${connection.extensionId}:`, {
      duration: sessionDuration,
      messagesSent: connection.messagesSent,
      messagesReceived: connection.messagesReceived,
      userId: connection.user?.userId
    });
  }

  /**
   * Send error response to connection
   */
  private sendErrorResponse(connection: ExtensionConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to connection
   */
  private sendMessage(connection: ExtensionConnection, message: any): void {
    if (connection.websocket.readyState === WebSocket.OPEN) {
      connection.websocket.send(JSON.stringify(message));
      connection.messagesSent++;
    }
  }

  /**
   * Start heartbeat monitoring for all connections
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform heartbeat check on authenticated connections
   */
  private performHeartbeatCheck(): void {
    const now = new Date();
    const timeoutThreshold = 60000; // 1 minute timeout

    for (const [extensionId, connection] of this.connections) {
      if (!connection.authenticated) continue;
      
      const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > timeoutThreshold) {
        console.warn(`⚠️ Extension ${extensionId} inactive for ${timeSinceLastActivity}ms`);
        
        if (connection.websocket.readyState === WebSocket.OPEN) {
          connection.websocket.ping();
        } else {
          console.warn(`💀 Removing dead connection for ${extensionId}`);
          this.connections.delete(extensionId);
        }
      }
    }
  }

  /**
   * Get all active authenticated connections
   */
  public getActiveConnections(): ExtensionConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.websocket.readyState === WebSocket.OPEN && conn.authenticated);
  }

  /**
   * Health check for the adapter
   */
  public async isHealthy(): Promise<boolean> {
    return this.isRunning && this.server !== undefined && this.tokenManager !== undefined;
  }

  /**
   * Cleanup the adapter
   */
  public async shutdown(): Promise<void> {
    await this.stopServer();
  }
}

// Supporting interfaces

interface ExtensionConnection {
  extensionId: string;
  websocket: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  messagesSent: number;
  messagesReceived: number;
  remoteAddress: string;
  userAgent: string;
  authenticated: boolean;
  user?: AuthenticatedUser;
}

export interface ConnectionInfo {
  extensionId: string;
  connected: boolean;
  authenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
  messagesSent: number;
  messagesReceived: number;
  remoteAddress: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
}