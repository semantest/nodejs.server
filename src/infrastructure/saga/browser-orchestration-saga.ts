/**
 * Browser Orchestration Saga
 * Manages the complex workflow of automating ChatGPT for image generation
 * Following Smalltalk's message-passing philosophy with event-driven choreography
 */

import { SagaDefinition, SagaStep } from './saga-manager';
import { DomainEvent } from '../../domain/core/domain-event';
import { WebSocket } from 'ws';

export interface BrowserSession {
  id: string;
  browserId: string;
  tabId: string;
  status: 'idle' | 'busy' | 'error';
  currentUrl?: string;
  chatGptSessionId?: string;
}

export interface BrowserCommand {
  type: 'navigate' | 'type' | 'click' | 'wait' | 'screenshot' | 'extract';
  target?: string;
  value?: string;
  timeout?: number;
}

export interface BrowserResponse {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
}

/**
 * Browser Orchestration Service
 * Coordinates browser automation through WebSocket communication with extension
 */
export class BrowserOrchestrationService {
  private sessions: Map<string, BrowserSession> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  
  constructor(
    private readonly wsUrl: string = 'ws://localhost:8081'
  ) {}

  /**
   * Initialize browser session for image generation
   */
  async initializeBrowserSession(aggregateId: string): Promise<BrowserSession> {
    const session: BrowserSession = {
      id: aggregateId,
      browserId: this.generateBrowserId(),
      tabId: '',
      status: 'idle'
    };
    
    this.sessions.set(aggregateId, session);
    
    // Connect to browser extension via WebSocket
    await this.connectToBrowser(session);
    
    return session;
  }

  /**
   * Connect to browser extension
   */
  private async connectToBrowser(session: BrowserSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      
      ws.on('open', () => {
        console.log(`Connected to browser extension for session ${session.id}`);
        this.wsConnections.set(session.id, ws);
        
        // Send initialization message
        ws.send(JSON.stringify({
          type: 'init',
          sessionId: session.id,
          browserId: session.browserId
        }));
        
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for session ${session.id}:`, error);
        session.status = 'error';
        reject(error);
      });
      
      ws.on('message', (data) => {
        this.handleBrowserMessage(session, data.toString());
      });
    });
  }

  /**
   * Handle messages from browser extension
   */
  private handleBrowserMessage(session: BrowserSession, message: string): void {
    try {
      const msg = JSON.parse(message);
      console.log(`Browser message for session ${session.id}:`, msg);
      
      // Update session state based on message
      if (msg.type === 'status') {
        session.status = msg.status;
      } else if (msg.type === 'navigation') {
        session.currentUrl = msg.url;
      } else if (msg.type === 'chatgpt_ready') {
        session.chatGptSessionId = msg.sessionId;
      }
    } catch (error) {
      console.error('Failed to parse browser message:', error);
    }
  }

  /**
   * Send command to browser
   */
  async sendBrowserCommand(
    sessionId: string, 
    command: BrowserCommand
  ): Promise<BrowserResponse> {
    const ws = this.wsConnections.get(sessionId);
    if (!ws) {
      throw new Error(`No WebSocket connection for session ${sessionId}`);
    }
    
    return new Promise((resolve, reject) => {
      const timeout = command.timeout || 30000;
      const timer = setTimeout(() => {
        reject(new Error(`Command timeout: ${command.type}`));
      }, timeout);
      
      // Set up one-time response handler
      const responseHandler = (data: any) => {
        clearTimeout(timer);
        const response = JSON.parse(data.toString());
        if (response.commandId === command.type) {
          resolve(response);
        }
      };
      
      ws.once('message', responseHandler);
      
      // Send command
      ws.send(JSON.stringify({
        ...command,
        sessionId,
        timestamp: Date.now()
      }));
    });
  }

  /**
   * Navigate to ChatGPT
   */
  async navigateToChatGPT(sessionId: string): Promise<void> {
    const response = await this.sendBrowserCommand(sessionId, {
      type: 'navigate',
      value: 'https://chat.openai.com',
      timeout: 10000
    });
    
    if (!response.success) {
      throw new Error(`Failed to navigate to ChatGPT: ${response.error}`);
    }
    
    // Wait for ChatGPT to be ready
    await this.waitForChatGPTReady(sessionId);
  }

  /**
   * Wait for ChatGPT interface to be ready
   */
  async waitForChatGPTReady(sessionId: string): Promise<void> {
    const response = await this.sendBrowserCommand(sessionId, {
      type: 'wait',
      target: 'textarea[placeholder*="Message"]',
      timeout: 15000
    });
    
    if (!response.success) {
      throw new Error('ChatGPT interface not ready');
    }
  }

  /**
   * Send prompt to ChatGPT
   */
  async sendPromptToChatGPT(sessionId: string, prompt: string): Promise<void> {
    // Type the prompt
    await this.sendBrowserCommand(sessionId, {
      type: 'type',
      target: 'textarea[placeholder*="Message"]',
      value: prompt
    });
    
    // Click send button
    await this.sendBrowserCommand(sessionId, {
      type: 'click',
      target: 'button[data-testid="send-button"]'
    });
    
    // Wait for response to start
    await this.sendBrowserCommand(sessionId, {
      type: 'wait',
      target: '.result-streaming',
      timeout: 5000
    });
  }

  /**
   * Wait for and extract generated image
   */
  async extractGeneratedImage(sessionId: string): Promise<string> {
    // Wait for image generation to complete
    await this.sendBrowserCommand(sessionId, {
      type: 'wait',
      target: 'img[alt*="Generated image"]',
      timeout: 120000 // 2 minutes for image generation
    });
    
    // Extract image URL
    const response = await this.sendBrowserCommand(sessionId, {
      type: 'extract',
      target: 'img[alt*="Generated image"]'
    });
    
    if (!response.success || !response.data?.src) {
      throw new Error('Failed to extract generated image');
    }
    
    return response.data.src;
  }

  /**
   * Clean up browser session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const ws = this.wsConnections.get(sessionId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(sessionId);
    }
    this.sessions.delete(sessionId);
  }

  private generateBrowserId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Create the browser orchestration saga definition
 */
export function createBrowserOrchestrationSaga(
  orchestrationService: BrowserOrchestrationService
): SagaDefinition {
  return {
    name: 'ChatGPTImageGeneration',
    triggerEventType: 'ImageGenerationRequested',
    timeoutMs: 300000, // 5 minute overall timeout
    steps: [
      {
        name: 'InitializeBrowser',
        eventType: 'BrowserSessionInitialized',
        execute: async (event: DomainEvent) => {
          console.log('Initializing browser session...');
          const session = await orchestrationService.initializeBrowserSession(
            event.aggregateId
          );
          console.log(`Browser session initialized: ${session.id}`);
        },
        compensate: async (event: DomainEvent) => {
          console.log('Cleaning up browser session...');
          await orchestrationService.cleanupSession(event.aggregateId);
        },
        timeout: 30000
      },
      {
        name: 'NavigateToChatGPT',
        eventType: 'NavigatedToChatGPT',
        execute: async (event: DomainEvent) => {
          console.log('Navigating to ChatGPT...');
          await orchestrationService.navigateToChatGPT(event.aggregateId);
        },
        timeout: 20000
      },
      {
        name: 'SendImagePrompt',
        eventType: 'PromptSentToChatGPT',
        execute: async (event: DomainEvent) => {
          console.log('Sending image generation prompt...');
          const prompt = event.payload?.prompt || 'Generate an image';
          const imagePrompt = `Please generate an image: ${prompt}`;
          await orchestrationService.sendPromptToChatGPT(
            event.aggregateId,
            imagePrompt
          );
        },
        timeout: 30000
      },
      {
        name: 'WaitForImageGeneration',
        eventType: 'ImageGeneratedByChatGPT',
        execute: async (event: DomainEvent) => {
          console.log('Waiting for image generation...');
          const imageUrl = await orchestrationService.extractGeneratedImage(
            event.aggregateId
          );
          console.log(`Image generated: ${imageUrl}`);
          
          // Store the image URL in the event payload for downstream processing
          event.payload = { ...event.payload, generatedImageUrl: imageUrl };
        },
        timeout: 150000 // 2.5 minutes for generation
      },
      {
        name: 'ProcessGeneratedImage',
        eventType: 'ImageProcessingCompleted',
        execute: async (event: DomainEvent) => {
          console.log('Processing generated image...');
          const imageUrl = event.payload?.generatedImageUrl;
          
          // Here you would:
          // 1. Download the image
          // 2. Store it in your system
          // 3. Generate thumbnails
          // 4. Update the aggregate state
          
          console.log(`Image processed and stored: ${imageUrl}`);
        },
        compensate: async (event: DomainEvent) => {
          console.log('Cleaning up processed image...');
          // Delete stored images if needed
        },
        timeout: 30000
      },
      {
        name: 'CleanupBrowserSession',
        eventType: 'BrowserSessionClosed',
        execute: async (event: DomainEvent) => {
          console.log('Closing browser session...');
          await orchestrationService.cleanupSession(event.aggregateId);
        },
        timeout: 10000
      }
    ]
  };
}

/**
 * Browser event types for the saga
 */
export enum BrowserOrchestrationEvents {
  BrowserSessionInitialized = 'BrowserSessionInitialized',
  NavigatedToChatGPT = 'NavigatedToChatGPT',
  PromptSentToChatGPT = 'PromptSentToChatGPT',
  ImageGeneratedByChatGPT = 'ImageGeneratedByChatGPT',
  ImageProcessingCompleted = 'ImageProcessingCompleted',
  BrowserSessionClosed = 'BrowserSessionClosed',
  BrowserOrchestrationFailed = 'BrowserOrchestrationFailed'
}