import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType } from './types';

export class SemantestWebSocketClient {
  private ws?: WebSocket;
  private messageHandlers = new Map<string, (payload: any) => void>();
  
  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${url}?token=${token}`);
      
      this.ws.on('open', () => {
        this.send(MessageType.AUTH, {
          type: 'token',
          credentials: token,
          clientInfo: {
            name: 'Test Client',
            version: '1.0.0',
            capabilities: ['browser', 'screenshot', 'console']
          }
        });
      });
      
      this.ws.on('message', (data: Buffer) => {
        const message: Message = JSON.parse(data.toString());
        
        if (message.type === MessageType.AUTH_SUCCESS) {
          resolve();
        } else if (message.type === MessageType.AUTH_FAILED) {
          reject(new Error(message.payload.message));
        }
        
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message.payload);
        }
      });
      
      this.ws.on('error', reject);
    });
  }
  
  send(type: MessageType, payload: any): void {
    if (!this.ws) throw new Error('Not connected');
    
    const message: Message = {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      payload
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  on(type: MessageType, handler: (payload: any) => void): void {
    this.messageHandlers.set(type, handler);
  }
  
  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}