/**
 * 🧪 Tests for Message Routes
 * Testing REST API endpoints for WebSocket message history
 */

import { Request, Response, NextFunction } from 'express';
import { messageRouter, captureMessage } from '../message.routes';
import { InMemoryMessageRepository } from '../../repositories/in-memory-message.repository';
import { StoredMessage } from '../../repositories/message.repository';

// Mock the repository
jest.mock('../../repositories/in-memory-message.repository');

// Helper to extract route handlers
function getRouteHandler(path: string, method: string = 'get') {
  const route = messageRouter.stack.find((layer: any) => {
    return layer.route && layer.route.path === path && layer.route.methods[method];
  });
  return route?.route?.stack.find((s: any) => s.method === method)?.handle;
}

describe('Message Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockRepository: jest.Mocked<InMemoryMessageRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockNext = jest.fn();
    
    mockReq = {
      params: {},
      query: {},
      body: {}
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock
    };

    // Get mocked repository instance
    mockRepository = require('../message.routes')['messageRepository'];
  });

  describe('GET /messages', () => {
    it('should return messages with default pagination', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: { content: 'Test 1' },
          direction: 'send',
          namespace: 'chat',
          addon_id: 'addon-1'
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: { content: 'Test 2' },
          direction: 'receive',
          namespace: 'chat',
          addon_id: 'addon-1'
        }
      ];
      
      mockRepository.findByQuery.mockResolvedValue(mockMessages);
      mockRepository.count.mockResolvedValue(2);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: undefined,
        until: undefined,
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: 100,
        offset: 0
      });
      
      expect(jsonMock).toHaveBeenCalledWith({
        messages: mockMessages,
        pagination: {
          total: 2,
          limit: 100,
          offset: 0
        },
        timestamp: expect.any(String)
      });
    });

    it('should filter messages by date range', async () => {
      mockReq.query = {
        since: '2024-01-01T00:00:00Z',
        until: '2024-12-31T23:59:59Z'
      };
      
      mockRepository.findByQuery.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: new Date('2024-01-01T00:00:00Z'),
        until: new Date('2024-12-31T23:59:59Z'),
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: 100,
        offset: 0
      });
    });

    it('should filter by type, namespace, and addon_id', async () => {
      mockReq.query = {
        type: 'notification',
        namespace: 'alerts',
        addon_id: 'addon-123'
      };
      
      mockRepository.findByQuery.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: undefined,
        until: undefined,
        type: 'notification',
        namespace: 'alerts',
        addon_id: 'addon-123',
        limit: 100,
        offset: 0
      });
    });

    it('should handle custom pagination', async () => {
      mockReq.query = {
        limit: '50',
        offset: '100'
      };
      
      mockRepository.findByQuery.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(200);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: undefined,
        until: undefined,
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: 50,
        offset: 100
      });
      
      expect(jsonMock).toHaveBeenCalledWith({
        messages: [],
        pagination: {
          total: 200,
          limit: 50,
          offset: 100
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockRepository.findByQuery.mockRejectedValue(error);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /messages/recent', () => {
    it('should return recent messages with default limit', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: { content: 'Recent 1' },
          direction: 'send'
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: { content: 'Recent 2' },
          direction: 'receive'
        }
      ];
      
      mockRepository.getRecent.mockResolvedValue(mockMessages);
      
      const handler = getRouteHandler('/messages/recent');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.getRecent).toHaveBeenCalledWith(50);
      expect(jsonMock).toHaveBeenCalledWith({
        messages: mockMessages,
        count: 2,
        timestamp: expect.any(String)
      });
    });

    it('should use custom limit', async () => {
      mockReq.query = { limit: '20' };
      
      mockRepository.getRecent.mockResolvedValue([]);
      
      const handler = getRouteHandler('/messages/recent');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.getRecent).toHaveBeenCalledWith(20);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockRepository.getRecent.mockRejectedValue(error);
      
      const handler = getRouteHandler('/messages/recent');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /messages/:id', () => {
    it('should return specific message', async () => {
      const mockMessage: StoredMessage = {
        id: 'msg-123',
        timestamp: new Date(),
        type: 'text',
        data: { content: 'Specific message' },
        direction: 'send'
      };
      
      mockReq.params = { id: 'msg-123' };
      mockRepository.findById.mockResolvedValue(mockMessage);
      
      const handler = getRouteHandler('/messages/:id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findById).toHaveBeenCalledWith('msg-123');
      expect(jsonMock).toHaveBeenCalledWith({
        message: mockMessage,
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent message', async () => {
      mockReq.params = { id: 'non-existent' };
      mockRepository.findById.mockResolvedValue(null);
      
      const handler = getRouteHandler('/messages/:id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Message not found',
        messageId: 'non-existent',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      mockReq.params = { id: 'msg-123' };
      const error = new Error('Database error');
      mockRepository.findById.mockRejectedValue(error);
      
      const handler = getRouteHandler('/messages/:id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /messages/namespaces', () => {
    it('should return unique namespaces', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          namespace: 'chat'
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          namespace: 'notifications'
        },
        {
          id: '3',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          namespace: 'chat' // Duplicate
        }
      ];
      
      mockRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const handler = getRouteHandler('/messages/namespaces');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({ limit: 1000 });
      expect(jsonMock).toHaveBeenCalledWith({
        namespaces: ['chat', 'notifications'],
        count: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle messages without namespaces', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send'
          // No namespace
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          namespace: 'chat'
        }
      ];
      
      mockRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const handler = getRouteHandler('/messages/namespaces');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        namespaces: ['chat'],
        count: 1,
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockRepository.findByQuery.mockRejectedValue(error);
      
      const handler = getRouteHandler('/messages/namespaces');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /messages/addons', () => {
    it('should return unique addon IDs', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          addon_id: 'addon-1'
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          addon_id: 'addon-2'
        },
        {
          id: '3',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          addon_id: 'addon-1' // Duplicate
        }
      ];
      
      mockRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const handler = getRouteHandler('/messages/addons');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({ limit: 1000 });
      expect(jsonMock).toHaveBeenCalledWith({
        addons: ['addon-1', 'addon-2'],
        count: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle messages without addon IDs', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send'
          // No addon_id
        },
        {
          id: '2',
          timestamp: new Date(),
          type: 'text',
          data: {},
          direction: 'send',
          addon_id: 'addon-1'
        }
      ];
      
      mockRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const handler = getRouteHandler('/messages/addons');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        addons: ['addon-1'],
        count: 1,
        timestamp: expect.any(String)
      });
    });
  });

  describe('DELETE /messages/old', () => {
    it('should delete old messages', async () => {
      mockReq.query = { before: '2024-01-01T00:00:00Z' };
      
      mockRepository.clearOlderThan.mockResolvedValue(100);
      
      const handler = getRouteHandler('/messages/old', 'delete');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.clearOlderThan).toHaveBeenCalledWith(
        new Date('2024-01-01T00:00:00Z')
      );
      expect(jsonMock).toHaveBeenCalledWith({
        deleted: 100,
        before: '2024-01-01T00:00:00.000Z',
        timestamp: expect.any(String)
      });
    });

    it('should return 400 if before parameter is missing', async () => {
      mockReq.query = {};
      
      const handler = getRouteHandler('/messages/old', 'delete');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'before parameter is required (ISO date string)',
        timestamp: expect.any(String)
      });
      expect(mockRepository.clearOlderThan).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockReq.query = { before: '2024-01-01T00:00:00Z' };
      const error = new Error('Database error');
      mockRepository.clearOlderThan.mockRejectedValue(error);
      
      const handler = getRouteHandler('/messages/old', 'delete');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('captureMessage function', () => {
    it('should save message with generated ID and timestamp', () => {
      const messageData = {
        type: 'text',
        data: { content: 'Test message' },
        direction: 'send' as const,
        namespace: 'chat',
        addon_id: 'addon-1'
      };
      
      captureMessage(messageData);
      
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...messageData,
        id: '',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date parameters', async () => {
      mockReq.query = { since: 'invalid-date' };
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      // The Date constructor will create an invalid date, which should be handled
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: expect.any(Date), // Will be Invalid Date
        until: undefined,
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: 100,
        offset: 0
      });
    });

    it('should handle invalid pagination parameters', async () => {
      mockReq.query = {
        limit: 'invalid',
        offset: 'invalid'
      };
      
      mockRepository.findByQuery.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);
      
      const handler = getRouteHandler('/messages');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRepository.findByQuery).toHaveBeenCalledWith({
        since: undefined,
        until: undefined,
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: NaN, // parseInt('invalid') returns NaN
        offset: NaN
      });
    });
  });
});