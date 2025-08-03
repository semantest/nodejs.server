/**
 * @fileoverview Chat session HTTP routes
 * @description REST endpoints for chat session management
 * @author Semantest Team
 */

import { Router, Request, Response } from 'express';
import { ChatService } from '../../application/services/chat.service';
import { NewChatRequestedEvent } from '../../../core/events/chat-events';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { v4 as uuidv4 } from 'uuid';
import { imageGenerationRouter } from './image-generation.routes';

export const chatRouter = Router();
const chatService = new ChatService();

// Mount image generation routes
chatRouter.use('/images', imageGenerationRouter);

// In a real implementation, this would be injected
const eventBus = {
  publish: async (event: any) => {
    logger.info('Event published', { 
      metadata: { 
        eventType: event.type,
        eventData: event
      } 
    });
  }
};

/**
 * POST /api/chat/sessions
 * Create a new chat session with optional initial prompt
 */
chatRouter.post('/chat/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, initialPrompt, metadata } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'userId is required' 
      });
    }

    logger.info('Creating new chat session', {
      metadata: {
        userId,
        hasInitialPrompt: !!initialPrompt,
        metadata
      }
    });

    // Create and publish the event
    const event = new NewChatRequestedEvent(
      userId,
      initialPrompt || '',
      metadata
    );
    
    await eventBus.publish(event);

    // For now, handle synchronously (in production, this would be async via event handler)
    const sessionId = uuidv4();
    const session = await chatService.createSession({
      id: sessionId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      messages: [],
      status: 'active'
    });

    // Process initial prompt if provided
    if (initialPrompt) {
      const initialMessage = {
        id: uuidv4(),
        sessionId: session.id,
        content: initialPrompt,
        role: 'user' as const,
        timestamp: new Date()
      };
      
      await chatService.addMessage(session.id, initialMessage);
      
      // Generate response
      const response = await chatService.generateResponse(
        session.id, 
        initialPrompt, 
        metadata
      );
      
      const responseMessage = {
        id: uuidv4(),
        sessionId: session.id,
        content: response,
        role: 'assistant' as const,
        timestamp: new Date()
      };
      
      await chatService.addMessage(session.id, responseMessage);
    }

    // Get the complete session with messages
    const completeSession = await chatService.getSession(session.id);

    res.status(201).json({
      success: true,
      session: completeSession
    });

  } catch (error) {
    logger.error('Failed to create chat session', error as Error);
    res.status(500).json({ 
      error: 'Failed to create chat session',
      message: (error as Error).message 
    });
  }
});

/**
 * GET /api/chat/sessions/:sessionId
 * Get a specific chat session with all messages
 */
chatRouter.get('/chat/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = await chatService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    res.json({
      success: true,
      session
    });

  } catch (error) {
    logger.error('Failed to get chat session', error as Error);
    res.status(500).json({ 
      error: 'Failed to get chat session' 
    });
  }
});

/**
 * POST /api/chat/sessions/:sessionId/messages
 * Send a message to a chat session
 */
chatRouter.post('/chat/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { content, userId } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        error: 'content is required' 
      });
    }

    const session = await chatService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    // Add user message
    const userMessage = {
      id: uuidv4(),
      sessionId,
      content,
      role: 'user' as const,
      timestamp: new Date()
    };
    
    await chatService.addMessage(sessionId, userMessage);

    // Generate AI response
    const response = await chatService.generateResponse(sessionId, content);
    
    const assistantMessage = {
      id: uuidv4(),
      sessionId,
      content: response,
      role: 'assistant' as const,
      timestamp: new Date()
    };
    
    await chatService.addMessage(sessionId, assistantMessage);

    res.json({
      success: true,
      userMessage,
      assistantMessage
    });

  } catch (error) {
    logger.error('Failed to send message', error as Error);
    res.status(500).json({ 
      error: 'Failed to send message' 
    });
  }
});

/**
 * GET /api/chat/users/:userId/sessions
 * Get all chat sessions for a user
 */
chatRouter.get('/chat/users/:userId/sessions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const sessions = await chatService.getUserSessions(userId);
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });

  } catch (error) {
    logger.error('Failed to get user sessions', error as Error);
    res.status(500).json({ 
      error: 'Failed to get user sessions' 
    });
  }
});

/**
 * DELETE /api/chat/sessions/:sessionId
 * Close/delete a chat session
 */
chatRouter.delete('/chat/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    
    const session = await chatService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    await chatService.closeSession(sessionId, reason);
    
    res.json({
      success: true,
      message: 'Session closed successfully'
    });

  } catch (error) {
    logger.error('Failed to close session', error as Error);
    res.status(500).json({ 
      error: 'Failed to close session' 
    });
  }
});