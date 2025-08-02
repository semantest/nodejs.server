/**
 * @fileoverview Handler for NewChatRequested events
 * @description Creates new chat sessions with initial prompt payload (Issue #23)
 * @author Semantest Team
 */

import { EventHandler } from '../../../stubs/typescript-eda-stubs';
import { 
  NewChatRequestedEvent, 
  ChatSessionCreatedEvent,
  ChatSessionErrorEvent,
  ChatSession,
  ChatMessage
} from '../../../core/events/chat-events';
import { ChatService } from '../../application/services/chat.service';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles NewChatRequested events by creating new chat sessions
 * with the provided initial prompt
 */
export class NewChatRequestedHandler implements EventHandler<NewChatRequestedEvent> {
  constructor(
    private readonly chatService: ChatService,
    private readonly eventBus: any // Replace with actual event bus type
  ) {}

  async handle(event: NewChatRequestedEvent): Promise<void> {
    const startTime = Date.now();
    const sessionId = uuidv4();
    
    logger.info('Processing NewChatRequested event', {
      metadata: {
        userId: event.userId,
        sessionId,
        hasInitialPrompt: !!event.initialPrompt,
        metadata: event.metadata
      }
    });

    try {
      // Create new chat session
      const session: ChatSession = {
        id: sessionId,
        userId: event.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: event.metadata,
        messages: [],
        status: 'active'
      };

      // Save the session
      await this.chatService.createSession(session);

      // If there's an initial prompt, create the first message
      if (event.initialPrompt) {
        const initialMessage: ChatMessage = {
          id: uuidv4(),
          sessionId: sessionId,
          content: event.initialPrompt,
          role: 'user',
          timestamp: new Date(),
          metadata: {
            isInitialPrompt: true
          }
        };

        await this.chatService.addMessage(sessionId, initialMessage);
        
        // Process the initial prompt to get a response
        await this.processInitialPrompt(sessionId, event.initialPrompt, event.metadata);
      }

      // Emit success event
      const successEvent = new ChatSessionCreatedEvent(
        sessionId,
        event.userId,
        new Date(),
        event.initialPrompt
      );
      
      await this.eventBus.publish(successEvent);

      const duration = Date.now() - startTime;
      logger.info('Chat session created successfully', {
        metadata: {
          sessionId,
          userId: event.userId,
          duration,
          hasInitialPrompt: !!event.initialPrompt
        }
      });

    } catch (error) {
      logger.error('Failed to create chat session', {
        error: error as Error,
        metadata: {
          userId: event.userId,
          sessionId
        }
      });

      // Emit error event
      const errorEvent = new ChatSessionErrorEvent(
        sessionId,
        error as Error,
        new Date()
      );
      
      await this.eventBus.publish(errorEvent);
      
      throw error;
    }
  }

  /**
   * Process the initial prompt to generate a response
   */
  private async processInitialPrompt(
    sessionId: string, 
    prompt: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Generate response based on the initial prompt
      const response = await this.chatService.generateResponse(sessionId, prompt, metadata);
      
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        sessionId: sessionId,
        content: response,
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          generatedFrom: 'initial_prompt'
        }
      };

      await this.chatService.addMessage(sessionId, assistantMessage);
      
    } catch (error) {
      logger.error('Failed to process initial prompt', {
        error: error as Error,
        metadata: {
          sessionId,
          promptLength: prompt.length
        }
      });
      // Don't throw here - session is still created even if initial response fails
    }
  }
}