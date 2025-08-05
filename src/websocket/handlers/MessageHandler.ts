import { Message, MessageType } from '../messages/types';
import { SemantestWebSocketServer } from '../server/WebSocketServer';

export interface AuthenticatedClient {
  id: string;
  ws: any;
  permissions: string[];
  sessionId: string;
  lastActivity: number;
}

export class MessageHandler {
  private handlers = new Map<MessageType, (message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer) => Promise<void>>();
  
  constructor() {
    this.registerHandlers();
  }
  
  private registerHandlers(): void {
    // System messages
    this.handlers.set(MessageType.PING, this.handlePing.bind(this));
    
    // Test messages
    this.handlers.set(MessageType.TEST_EXECUTE, this.handleTestExecute.bind(this));
    
    // Browser messages
    this.handlers.set(MessageType.BROWSER_NAVIGATE, this.handleBrowserNavigate.bind(this));
    this.handlers.set(MessageType.BROWSER_CLICK, this.handleBrowserClick.bind(this));
    this.handlers.set(MessageType.BROWSER_TYPE, this.handleBrowserType.bind(this));
    this.handlers.set(MessageType.BROWSER_SCREENSHOT, this.handleBrowserScreenshot.bind(this));
    
    // Subscription messages
    this.handlers.set(MessageType.SUBSCRIBE, this.handleSubscribe.bind(this));
    this.handlers.set(MessageType.UNSUBSCRIBE, this.handleUnsubscribe.bind(this));
  }
  
  async handle(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    const handler = this.handlers.get(message.type as MessageType);
    
    if (!handler) {
      server.sendError(client.ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      return;
    }
    
    // Check permissions
    if (!this.hasPermission(client, message.type)) {
      server.sendError(client.ws, 'PERMISSION_DENIED', `No permission for operation: ${message.type}`);
      return;
    }
    
    try {
      await handler(message, client, server);
    } catch (error) {
      server.sendError(client.ws, 'HANDLER_ERROR', `Error handling message: ${error.message}`, {
        messageType: message.type,
        messageId: message.id
      });
    }
  }
  
  private hasPermission(client: AuthenticatedClient, messageType: string): boolean {
    const permissionMap: Record<string, string> = {
      [MessageType.TEST_EXECUTE]: 'test:execute',
      [MessageType.BROWSER_NAVIGATE]: 'browser:control',
      [MessageType.BROWSER_CLICK]: 'browser:control',
      [MessageType.BROWSER_TYPE]: 'browser:control',
      [MessageType.BROWSER_SCREENSHOT]: 'browser:control'
    };
    
    const requiredPermission = permissionMap[messageType];
    return !requiredPermission || client.permissions.includes(requiredPermission);
  }
  
  private async handlePing(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    server.sendMessage(client.ws, MessageType.PONG, {}, message.id);
  }
  
  private async handleTestExecute(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    const { testId } = message.payload;
    
    // Send test started
    server.sendMessage(client.ws, MessageType.TEST_STARTED, {
      testId,
      executionId: `exec-${Date.now()}`,
      startTime: Date.now()
    }, message.id);
    
    // TODO: Implement actual test execution
    
    // Simulate test completion
    setTimeout(() => {
      server.sendMessage(client.ws, MessageType.TEST_COMPLETED, {
        testId,
        status: 'passed',
        duration: 5000
      });
    }, 5000);
  }
  
  private async handleBrowserNavigate(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement browser navigation
    console.log('Browser navigate:', message.payload);
  }
  
  private async handleBrowserClick(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement browser click
    console.log('Browser click:', message.payload);
  }
  
  private async handleBrowserType(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement browser type
    console.log('Browser type:', message.payload);
  }
  
  private async handleBrowserScreenshot(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement browser screenshot
    console.log('Browser screenshot:', message.payload);
  }
  
  private async handleSubscribe(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement subscription management
    console.log('Subscribe:', message.payload);
  }
  
  private async handleUnsubscribe(message: Message, client: AuthenticatedClient, server: SemantestWebSocketServer): Promise<void> {
    // TODO: Implement unsubscription
    console.log('Unsubscribe:', message.payload);
  }
}