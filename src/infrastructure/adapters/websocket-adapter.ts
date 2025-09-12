import WebSocket from 'ws';
import { EventStore } from '../event-store/event-store';
import { ProjectionStore } from '../projection-store/projection-store';
import { RequestImageGenerationCommand } from '../../application/commands/image-generation/image-generation-commands';
import { RequestImageGenerationCommandHandler } from '../../application/commands/image-generation/image-generation-command-handlers';
import { GetImageGenerationStatusQuery } from '../../application/queries/image-generation/image-generation-queries';
import { GetImageGenerationStatusQueryHandler } from '../../application/queries/image-generation/image-generation-query-handlers';

export class WebSocketAdapter {
  private wss: WebSocket.Server;
  private commandHandler: RequestImageGenerationCommandHandler;
  private queryHandler: GetImageGenerationStatusQueryHandler;

  constructor(
    port: number,
    private readonly eventStore: EventStore,
    private readonly projectionStore: ProjectionStore
  ) {
    this.wss = new WebSocket.Server({ port });
    this.commandHandler = new RequestImageGenerationCommandHandler(eventStore);
    this.queryHandler = new GetImageGenerationStatusQueryHandler(projectionStore);
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection established');

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Image Generation Service'
      }));
    });
  }

  private async handleMessage(ws: WebSocket, message: any): Promise<void> {
    switch (message.type) {
      case 'requestImageGeneration':
        await this.handleRequestImageGeneration(ws, message);
        break;
      case 'getStatus':
        await this.handleGetStatus(ws, message);
        break;
      case 'subscribe':
        await this.handleSubscribe(ws, message);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${message.type}`
        }));
    }
  }

  private async handleRequestImageGeneration(ws: WebSocket, message: any): Promise<void> {
    try {
      const command = new RequestImageGenerationCommand(
        message.prompt,
        message.userId,
        message.requestId || this.generateRequestId(),
        message.options
      );

      await this.commandHandler.handle(command);

      ws.send(JSON.stringify({
        type: 'imageGenerationRequested',
        requestId: command.requestId,
        message: 'Image generation request received'
      }));
    } catch (error: any) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  }

  private async handleGetStatus(ws: WebSocket, message: any): Promise<void> {
    try {
      const query = new GetImageGenerationStatusQuery(message.aggregateId);
      const result = await this.queryHandler.handle(query);

      ws.send(JSON.stringify({
        type: 'statusUpdate',
        data: result
      }));
    } catch (error: any) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  }

  private async handleSubscribe(ws: WebSocket, message: any): Promise<void> {
    // Subscribe to events for a specific aggregate
    const aggregateId = message.aggregateId;
    
    // In a real implementation, you would set up event subscriptions here
    // For now, we'll just acknowledge the subscription
    ws.send(JSON.stringify({
      type: 'subscribed',
      aggregateId,
      message: `Subscribed to updates for ${aggregateId}`
    }));
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  close(): void {
    this.wss.close();
  }
}