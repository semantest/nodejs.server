/**
 * 🧪 Tests for Message Routes
 * Testing REST API endpoints for WebSocket message history
 */

import request from 'supertest';
import express, { Express } from 'express';
import { StoredMessage } from '../../repositories/message.repository';

// First, set up the mocks before any imports
const mockMessageRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findByQuery: jest.fn(),
  getRecent: jest.fn(),
  count: jest.fn(),
  clearOlderThan: jest.fn(),
  clear: jest.fn()
};

// Mock the repository module
jest.mock('../../repositories/in-memory-message.repository', () => ({
  InMemoryMessageRepository: jest.fn().mockImplementation(() => mockMessageRepository)
}));

describe('Message Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up - this ensures the mock is used
    const { messageRouter } = require('../message.routes');
    app.use(messageRouter);
    
    // Add error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Route error:', err);
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('GET /messages', () => {
    it('should return all messages with default pagination', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          type: 'tool_use',
          payload: { tool: 'test' },
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1'
        },
        {
          id: '2',
          type: 'tool_result',
          payload: { result: 'success' },
          direction: 'outgoing' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1'
        }
      ];
      
      mockMessageRepository.findByQuery.mockResolvedValue(mockMessages);
      mockMessageRepository.count.mockResolvedValue(2);
      
      const response = await request(app)
        .get('/messages')
        .expect(200);
      
      expect(mockMessageRepository.findByQuery).toHaveBeenCalledWith({
        since: undefined,
        until: undefined,
        type: undefined,
        namespace: undefined,
        addon_id: undefined,
        limit: 100,
        offset: 0
      });
      expect(mockMessageRepository.count).toHaveBeenCalled();
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 2,
        limit: 100,
        offset: 0
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should filter messages by query parameters', async () => {
      const mockMessages: StoredMessage[] = [];
      const since = '2024-01-01T00:00:00Z';
      const until = '2024-12-31T23:59:59Z';
      
      mockMessageRepository.findByQuery.mockResolvedValue(mockMessages);
      mockMessageRepository.count.mockResolvedValue(0);
      
      const response = await request(app)
        .get('/messages')
        .query({
          since,
          until,
          type: 'tool_use',
          namespace: 'test',
          addon_id: 'addon-1',
          limit: '50',
          offset: '10'
        })
        .expect(200);
      
      expect(mockMessageRepository.findByQuery).toHaveBeenCalledWith({
        since: new Date(since),
        until: new Date(until),
        type: 'tool_use',
        namespace: 'test',
        addon_id: 'addon-1',
        limit: 50,
        offset: 10
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.findByQuery.mockRejectedValue(error);
      
      const response = await request(app)
        .get('/messages')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /messages/recent', () => {
    it('should return recent messages with default limit', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          type: 'tool_use',
          payload: { tool: 'test' },
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1'
        }
      ];
      
      mockMessageRepository.getRecent.mockResolvedValue(mockMessages);
      
      const response = await request(app)
        .get('/messages/recent')
        .expect(200);
      
      expect(mockMessageRepository.getRecent).toHaveBeenCalledWith(50);
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.count).toBe(1);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should accept custom limit', async () => {
      mockMessageRepository.getRecent.mockResolvedValue([]);
      
      await request(app)
        .get('/messages/recent')
        .query({ limit: '25' })
        .expect(200);
      
      expect(mockMessageRepository.getRecent).toHaveBeenCalledWith(25);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.getRecent.mockRejectedValue(error);
      
      const response = await request(app)
        .get('/messages/recent')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /messages/:id', () => {
    it('should return specific message', async () => {
      const mockMessage: StoredMessage = {
        id: 'msg-123',
        type: 'tool_use',
        payload: { tool: 'test' },
        direction: 'incoming' as const,
        timestamp: new Date(),
        namespace: 'test',
        addon_id: 'addon-1'
      };
      
      mockMessageRepository.findById.mockResolvedValue(mockMessage);
      
      const response = await request(app)
        .get('/messages/msg-123')
        .expect(200);
      
      expect(mockMessageRepository.findById).toHaveBeenCalledWith('msg-123');
      expect(response.body.message).toEqual({
        ...mockMessage,
        timestamp: mockMessage.timestamp.toISOString()
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 404 for non-existent message', async () => {
      mockMessageRepository.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/messages/non-existent')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Message not found');
      expect(response.body).toHaveProperty('messageId', 'non-existent');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.findById.mockRejectedValue(error);
      
      const response = await request(app)
        .get('/messages/msg-123')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /messages/namespaces', () => {
    it('should return unique namespaces', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1'
        },
        {
          id: '2',
          type: 'tool_result',
          payload: {},
          direction: 'outgoing' as const,
          timestamp: new Date(),
          namespace: 'production',
          addon_id: 'addon-2'
        },
        {
          id: '3',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test', // duplicate
          addon_id: 'addon-1'
        },
        {
          id: '4',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          // no namespace
          addon_id: 'addon-3'
        }
      ];
      
      mockMessageRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const response = await request(app)
        .get('/messages/namespaces');
      
      if (response.status !== 200) {
        console.error('Namespaces error:', response.body);
      }
      
      expect(response.status).toBe(200);
      expect(mockMessageRepository.findByQuery).toHaveBeenCalledWith({ limit: 1000 });
      expect(response.body.namespaces).toEqual(['production', 'test']);
      expect(response.body.count).toBe(2);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return empty array when no namespaces', async () => {
      mockMessageRepository.findByQuery.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/messages/namespaces')
        .expect(200);
      
      expect(response.body.namespaces).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.findByQuery.mockRejectedValue(error);
      
      const response = await request(app)
        .get('/messages/namespaces')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('GET /messages/addons', () => {
    it('should return unique addon IDs', async () => {
      const mockMessages: StoredMessage[] = [
        {
          id: '1',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1'
        },
        {
          id: '2',
          type: 'tool_result',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-2'
        },
        {
          id: '3',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test',
          addon_id: 'addon-1' // duplicate
        },
        {
          id: '4',
          type: 'tool_use',
          payload: {},
          direction: 'incoming' as const,
          timestamp: new Date(),
          namespace: 'test'
          // no addon_id
        }
      ];
      
      mockMessageRepository.findByQuery.mockResolvedValue(mockMessages);
      
      const response = await request(app)
        .get('/messages/addons')
        .expect(200);
      
      expect(mockMessageRepository.findByQuery).toHaveBeenCalledWith({ limit: 1000 });
      expect(response.body.addons).toEqual(['addon-1', 'addon-2']);
      expect(response.body.count).toBe(2);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return empty array when no addons', async () => {
      mockMessageRepository.findByQuery.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/messages/addons')
        .expect(200);
      
      expect(response.body.addons).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.findByQuery.mockRejectedValue(error);
      
      const response = await request(app)
        .get('/messages/addons')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });

  describe('DELETE /messages/old', () => {
    it('should delete old messages', async () => {
      const beforeDate = '2024-01-01T00:00:00Z';
      mockMessageRepository.clearOlderThan.mockResolvedValue(10);
      
      const response = await request(app)
        .delete('/messages/old')
        .query({ before: beforeDate })
        .expect(200);
      
      expect(mockMessageRepository.clearOlderThan).toHaveBeenCalledWith(new Date(beforeDate));
      expect(response.body.deleted).toBe(10);
      expect(response.body.before).toBe(beforeDate);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 400 if before parameter is missing', async () => {
      const response = await request(app)
        .delete('/messages/old')
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'before parameter is required (ISO date string)');
      expect(mockMessageRepository.clearOlderThan).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockMessageRepository.clearOlderThan.mockRejectedValue(error);
      
      const response = await request(app)
        .delete('/messages/old')
        .query({ before: '2024-01-01T00:00:00Z' })
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Database error');
    });
  });
});

describe('captureMessage function', () => {
  it('should save message to repository', () => {
    jest.resetModules();
    const { captureMessage, messageRepository } = require('../message.routes');
    
    const message = {
      type: 'tool_use',
      payload: { tool: 'test' },
      direction: 'incoming' as const,
      namespace: 'test',
      addon_id: 'addon-1'
    };
    
    captureMessage(message);
    
    expect(messageRepository.save).toHaveBeenCalledWith({
      ...message,
      id: '',
      timestamp: expect.any(Date)
    });
  });
});