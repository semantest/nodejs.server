import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType } from '../messages/types';

interface MessageHandler {
  (payload: any, message: Message): void;
}

export class SemantestWebSocketClient {
  private ws?: WebSocket;
  private url: string;
  private token: string;
  private messageHandlers = new Map<MessageType, MessageHandler>();
  private correlationHandlers = new Map<string, (message: Message) => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
    this.registerDefaultHandlers();
  }
  
  private registerDefaultHandlers(): void {
    this.on(MessageType.PONG, () => {
      // Handle pong
    });
    
    this.on(MessageType.ERROR, (payload) => {
      console.error('Server error:', payload);
    });
  }
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?token=${this.token}&client-id=${uuidv4()}&version=2.0.0`;
      this.ws = new WebSocket(wsUrl, {
        perMessageDeflate: false,
        maxPayload: 10 * 1024 * 1024
      });
      
      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.send(MessageType.AUTH, {
          type: 'token',
          credentials: this.token,
          clientInfo: {
            name: 'Semantest WebSocket Client',
            version: '2.0.0',
            capabilities: ['browser', 'screenshot', 'console']
          }
        });
      });
      
      this.ws.on('message', (data: Buffer) => {
        try {
          const message: Message = JSON.parse(data.toString());
          
          if (message.type === MessageType.AUTH_SUCCESS) {
            resolve();
          } else if (message.type === MessageType.AUTH_FAILED) {
            reject(new Error(message.payload.message));
          }
          
          // Handle correlation responses
          if (message.correlationId && this.correlationHandlers.has(message.correlationId)) {
            const handler = this.correlationHandlers.get(message.correlationId)!;
            handler(message);
            this.correlationHandlers.delete(message.correlationId);
          }
          
          // Handle message type handlers
          const handler = this.messageHandlers.get(message.type as MessageType);
          if (handler) {
            handler(message.payload, message);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
      
      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} - ${reason}`);
        this.handleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
      
      // Heartbeat
      setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send(MessageType.PING, {});
        }
      }, 30000);
    });
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    }
  }
  
  send(type: MessageType, payload: any): string {
    const message: Message = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload
    };
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
    
    return message.id;
  }
  
  sendAndWait(type: MessageType, payload: any, timeout = 30000): Promise<Message> {
    return new Promise((resolve, reject) => {
      const messageId = this.send(type, payload);
      
      const timer = setTimeout(() => {
        this.correlationHandlers.delete(messageId);
        reject(new Error(`Request timeout for message ${messageId}`));
      }, timeout);
      
      this.correlationHandlers.set(messageId, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }
  
  on(type: MessageType, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }
  
  off(type: MessageType): void {
    this.messageHandlers.delete(type);
  }
  
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
  
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}