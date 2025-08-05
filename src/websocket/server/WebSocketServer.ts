import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType, AuthPayload, ErrorPayload } from '../messages/types';
import { MessageHandler } from '../handlers/MessageHandler';
import { AuthHandler } from '../handlers/AuthHandler';

interface AuthenticatedClient {
  id: string;
  ws: WebSocket;
  permissions: string[];
  sessionId: string;
  lastActivity: number;
}

export class SemantestWebSocketServer {
  private wss: WSServer;
  private clients = new Map<string, AuthenticatedClient>();
  private messageHandler: MessageHandler;
  private authHandler: AuthHandler;
  
  constructor(port: number) {
    this.wss = new WSServer({ 
      port,
      perMessageDeflate: false,
      maxPayload: 10 * 1024 * 1024 // 10MB
    });
    
    this.messageHandler = new MessageHandler();
    this.authHandler = new AuthHandler();
    
    this.setupServer();
  }
  
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const token = this.extractToken(req.url);
      
      if (!token) {
        ws.close(1008, 'Missing authentication token');
        return;
      }
      
      this.handleConnection(ws, token);
    });
    
    // Heartbeat interval
    setInterval(() => {
      this.clients.forEach((client) => {
        if (Date.now() - client.lastActivity > 60000) {
          client.ws.terminate();
          this.clients.delete(client.id);
        }
      });
    }, 30000);
  }
  
  private extractToken(url?: string): string | null {
    if (!url) return null;
    const params = new URLSearchParams(url.split('?')[1]);
    return params.get('token');
  }
  
  private async handleConnection(ws: WebSocket, token: string): Promise<void> {
    let authenticated = false;
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        if (message.type === MessageType.AUTH && !authenticated) {
          const authResult = await this.authHandler.authenticate(message.payload as AuthPayload);
          
          if (authResult.success) {
            const client: AuthenticatedClient = {
              id: uuidv4(),
              ws,
              permissions: authResult.permissions,
              sessionId: authResult.sessionId,
              lastActivity: Date.now()
            };
            
            this.clients.set(client.id, client);
            authenticated = true;
            
            this.sendMessage(ws, MessageType.AUTH_SUCCESS, {
              sessionId: client.sessionId,
              permissions: client.permissions,
              expiresAt: Date.now() + 86400000 // 24 hours
            });
            
            this.sendMessage(ws, MessageType.SYSTEM_READY, {
              version: '2.0.0',
              capabilities: ['test-orchestration', 'browser-automation'],
              limits: {
                maxConcurrentTests: 10,
                maxTestDuration: 3600000,
                maxPayloadSize: 10485760
              }
            });
          } else {
            this.sendMessage(ws, MessageType.AUTH_FAILED, {
              code: 'INVALID_TOKEN',
              message: 'Invalid authentication token'
            });
            ws.close(1008, 'Authentication failed');
          }
        } else if (authenticated) {
          const client = [...this.clients.values()].find(c => c.ws === ws);
          if (client) {
            client.lastActivity = Date.now();
            await this.messageHandler.handle(message, client, this);
          }
        } else {
          ws.close(1008, 'Not authenticated');
        }
      } catch (error) {
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });
    
    ws.on('close', () => {
      const client = [...this.clients.values()].find(c => c.ws === ws);
      if (client) {
        this.clients.delete(client.id);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  sendMessage(ws: WebSocket, type: MessageType, payload: any, correlationId?: string): void {
    const message: Message = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload,
      ...(correlationId && { correlationId })
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  sendError(ws: WebSocket, code: string, message: string, details?: any): void {
    const errorPayload: ErrorPayload = {
      code,
      message,
      details,
      fatal: false
    };
    
    this.sendMessage(ws, MessageType.ERROR, errorPayload);
  }
  
  broadcast(type: MessageType, payload: any, filter?: (client: AuthenticatedClient) => boolean): void {
    this.clients.forEach((client) => {
      if (!filter || filter(client)) {
        this.sendMessage(client.ws, type, payload);
      }
    });
  }
  
  getClient(clientId: string): AuthenticatedClient | undefined {
    return this.clients.get(clientId);
  }
}