import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType, AuthPayload, AuthSuccessPayload, ErrorPayload } from './types';

interface AuthenticatedClient {
  id: string;
  ws: WebSocket;
  sessionId: string;
  permissions: string[];
  isAlive: boolean;
}

export class SemantestWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<string, AuthenticatedClient>();
  private messageHandlers = new Map<string, (message: Message, client: AuthenticatedClient) => Promise<void>>();
  
  constructor(port: number) {
    this.wss = new WebSocketServer({ 
      port,
      clientTracking: true,
      perMessageDeflate: false
    });
    
    this.setupHandlers();
    this.startHeartbeat();
    
    this.wss.on('connection', (ws: WebSocket, req) => {
      const token = this.extractToken(req.url || '');
      
      if (!token) {
        ws.close(1008, 'Missing authentication token');
        return;
      }
      
      this.handleConnection(ws, token);
    });
  }
  
  private extractToken(url: string): string | null {
    const match = url.match(/[?&]token=([^&]+)/);
    return match ? match[1] : null;
  }
  
  private async handleConnection(ws: WebSocket, token: string) {
    ws.on('message', async (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        if (message.type === MessageType.AUTH) {
          await this.handleAuth(message, ws);
        } else {
          const client = this.getClientByWebSocket(ws);
          if (!client) {
            this.sendError(ws, 'UNAUTHORIZED', 'Not authenticated');
            return;
          }
          
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            await handler(message, client);
          } else {
            this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
          }
        }
      } catch (error) {
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });
    
    ws.on('pong', () => {
      const client = this.getClientByWebSocket(ws);
      if (client) {
        client.isAlive = true;
      }
    });
    
    ws.on('close', () => {
      const client = this.getClientByWebSocket(ws);
      if (client) {
        this.clients.delete(client.id);
        console.log(`Client ${client.id} disconnected`);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  private async handleAuth(message: Message, ws: WebSocket) {
    const payload = message.payload as AuthPayload;
    
    // TODO: Implement actual token validation
    const isValid = await this.validateToken(payload.credentials);
    
    if (isValid) {
      const sessionId = uuidv4();
      const client: AuthenticatedClient = {
        id: uuidv4(),
        ws,
        sessionId,
        permissions: ['test:execute', 'test:monitor', 'browser:control'],
        isAlive: true
      };
      
      this.clients.set(client.id, client);
      
      this.sendMessage(ws, MessageType.AUTH_SUCCESS, {
        sessionId,
        expiresAt: Date.now() + 86400000, // 24 hours
        permissions: client.permissions
      } as AuthSuccessPayload, message.id);
      
      this.sendMessage(ws, MessageType.SYSTEM_READY, {
        version: '2.0.0',
        capabilities: [
          'test-orchestration',
          'browser-automation',
          'parallel-execution',
          'real-time-monitoring'
        ],
        limits: {
          maxConcurrentTests: 10,
          maxTestDuration: 3600000,
          maxPayloadSize: 10485760
        }
      });
    } else {
      this.sendMessage(ws, MessageType.AUTH_FAILED, {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired'
      } as ErrorPayload, message.id);
      ws.close(1008, 'Authentication failed');
    }
  }
  
  private async validateToken(token: string): Promise<boolean> {
    // TODO: Implement real token validation
    return token.length > 0;
  }
  
  private setupHandlers() {
    // Ping handler
    this.messageHandlers.set(MessageType.PING, async (message, client) => {
      this.sendMessage(client.ws, MessageType.PONG, {}, message.id);
    });
    
    // TODO: Add more handlers
  }
  
  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client.id);
          return;
        }
        
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
  }
  
  private getClientByWebSocket(ws: WebSocket): AuthenticatedClient | undefined {
    for (const [, client] of this.clients) {
      if (client.ws === ws) {
        return client;
      }
    }
    return undefined;
  }
  
  public sendMessage(ws: WebSocket, type: MessageType, payload: any, correlationId?: string): void {
    const message: Message = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload,
      ...(correlationId && { correlationId })
    };
    
    ws.send(JSON.stringify(message));
  }
  
  private sendError(ws: WebSocket, code: string, message: string, details?: any): void {
    this.sendMessage(ws, MessageType.ERROR, {
      code,
      message,
      details,
      fatal: false
    } as ErrorPayload);
  }
  
  public broadcast(type: MessageType, payload: any, filter?: (client: AuthenticatedClient) => boolean): void {
    const message: Message = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload
    };
    
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (filter && !filter(client)) return;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }
}