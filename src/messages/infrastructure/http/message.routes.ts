/**
 * Message API routes for popup viewer
 * Provides REST endpoints to query WebSocket message history
 */

import { Router, Request, Response, NextFunction } from 'express';
import { InMemoryMessageRepository } from '../repositories/in-memory-message.repository';
import { StoredMessage } from '../repositories/message.repository';

// Initialize repository
const messageRepository = new InMemoryMessageRepository();

// Create router
export const messageRouter = Router();

/**
 * GET /messages
 * Get messages with optional filtering
 */
messageRouter.get('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      since, 
      until, 
      type, 
      namespace, 
      addon_id, 
      limit = '100', 
      offset = '0' 
    } = req.query;

    const messages = await messageRepository.findByQuery({
      since: since ? new Date(since as string) : undefined,
      until: until ? new Date(until as string) : undefined,
      type: type as string,
      namespace: namespace as string,
      addon_id: addon_id as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    });

    const total = await messageRepository.count({
      since: since ? new Date(since as string) : undefined,
      until: until ? new Date(until as string) : undefined,
      type: type as string,
      namespace: namespace as string,
      addon_id: addon_id as string
    });

    res.json({
      messages,
      pagination: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /messages/recent
 * Get recent messages (optimized for popup viewer)
 */
messageRouter.get('/messages/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '50' } = req.query;
    
    const messages = await messageRepository.getRecent(parseInt(limit as string, 10));

    res.json({
      messages,
      count: messages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /messages/:id
 * Get a specific message by ID
 */
messageRouter.get('/messages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const message = await messageRepository.findById(id);
    
    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        messageId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /messages/namespaces
 * Get available namespaces
 */
messageRouter.get('/messages/namespaces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allMessages = await messageRepository.findByQuery({ limit: 1000 });
    
    const namespaces = new Set<string>();
    allMessages.forEach(msg => {
      if (msg.namespace) {
        namespaces.add(msg.namespace);
      }
    });

    res.json({
      namespaces: Array.from(namespaces).sort(),
      count: namespaces.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /messages/addons
 * Get addon IDs that have sent messages
 */
messageRouter.get('/messages/addons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allMessages = await messageRepository.findByQuery({ limit: 1000 });
    
    const addons = new Set<string>();
    allMessages.forEach(msg => {
      if (msg.addon_id) {
        addons.add(msg.addon_id);
      }
    });

    res.json({
      addons: Array.from(addons).sort(),
      count: addons.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /messages/old
 * Clean up old messages
 */
messageRouter.delete('/messages/old', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { before } = req.query;
    
    if (!before) {
      return res.status(400).json({
        error: 'before parameter is required (ISO date string)',
        timestamp: new Date().toISOString()
      });
    }

    const beforeDate = new Date(before as string);
    const deletedCount = await messageRepository.clearOlderThan(beforeDate);

    res.json({
      deleted: deletedCount,
      before: beforeDate.toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Middleware to capture WebSocket messages
 * This should be called by the WebSocket server when messages are sent/received
 */
export function captureMessage(message: Omit<StoredMessage, 'id' | 'timestamp'>): void {
  messageRepository.save({
    ...message,
    id: '',
    timestamp: new Date()
  });
}

// Export repository for WebSocket integration
export { messageRepository };