/**
 * Tests for InMemoryMessageRepository
 * Testing message storage and retrieval functionality
 */

import { InMemoryMessageRepository } from '../in-memory-message.repository';
import { StoredMessage, MessageQuery } from '../message.repository';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

describe('InMemoryMessageRepository', () => {
  let repository: InMemoryMessageRepository;
  let mockUuid: jest.Mock;

  beforeEach(() => {
    repository = new InMemoryMessageRepository();
    mockUuid = (uuidv4 as jest.Mock);
    mockUuid.mockReturnValue('test-uuid-123');
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('should save a message with provided id', async () => {
      const message: StoredMessage = {
        id: 'msg-1',
        timestamp: new Date('2024-01-01'),
        type: 'test',
        direction: 'incoming',
        payload: { data: 'test' }
      };

      const saved = await repository.save(message);

      expect(saved).toEqual(message);
      expect(saved.id).toBe('msg-1');
      expect(mockUuid).not.toHaveBeenCalled();
    });

    it('should generate id if not provided', async () => {
      const message: StoredMessage = {
        id: '',
        timestamp: new Date('2024-01-01'),
        type: 'test',
        direction: 'outgoing',
        payload: { data: 'test' }
      };

      const saved = await repository.save(message);

      expect(saved.id).toBe('test-uuid-123');
      expect(mockUuid).toHaveBeenCalled();
    });

    it('should use current timestamp if not provided', async () => {
      const now = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now);

      const message: StoredMessage = {
        id: 'msg-1',
        timestamp: null as any,
        type: 'test',
        direction: 'incoming',
        payload: { data: 'test' }
      };

      const saved = await repository.save(message);

      expect(saved.timestamp).toEqual(now);
      
      // Restore Date mock
      jest.restoreAllMocks();
    });

    it('should maintain max message limit', async () => {
      repository.setMaxMessages(3);

      const messages: StoredMessage[] = [];
      for (let i = 0; i < 5; i++) {
        const msg = await repository.save({
          id: `msg-${i}`,
          timestamp: new Date(`2024-01-0${i + 1}`),
          type: 'test',
          direction: 'incoming',
          payload: { index: i }
        });
        messages.push(msg);
      }

      // Should only have last 3 messages
      const all = await repository.getRecent(10);
      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('msg-4');
      expect(all[1].id).toBe('msg-3');
      expect(all[2].id).toBe('msg-2');

      // First 2 messages should be deleted
      const msg0 = await repository.findById('msg-0');
      const msg1 = await repository.findById('msg-1');
      expect(msg0).toBeNull();
      expect(msg1).toBeNull();
    });

    it('should save messages with metadata', async () => {
      const message: StoredMessage = {
        id: 'msg-1',
        timestamp: new Date('2024-01-01'),
        type: 'websocket',
        namespace: 'chat',
        addon_id: 'addon-123',
        direction: 'incoming',
        payload: { text: 'Hello' },
        metadata: {
          clientId: 'client-456',
          sessionId: 'session-789',
          tags: ['important', 'urgent']
        }
      };

      const saved = await repository.save(message);

      expect(saved).toEqual(message);
      expect(saved.metadata).toEqual(message.metadata);
    });
  });

  describe('findById', () => {
    it('should find message by id', async () => {
      const message: StoredMessage = {
        id: 'msg-1',
        timestamp: new Date(),
        type: 'test',
        direction: 'incoming',
        payload: { data: 'test' }
      };

      await repository.save(message);
      const found = await repository.findById('msg-1');

      expect(found).toEqual(message);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getRecent', () => {
    beforeEach(async () => {
      // Save 5 messages
      for (let i = 0; i < 5; i++) {
        await repository.save({
          id: `msg-${i}`,
          timestamp: new Date(`2024-01-0${i + 1}T10:00:00Z`),
          type: 'test',
          direction: 'incoming',
          payload: { index: i }
        });
      }
    });

    it('should get recent messages in newest-first order', async () => {
      const recent = await repository.getRecent(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].id).toBe('msg-4');
      expect(recent[1].id).toBe('msg-3');
      expect(recent[2].id).toBe('msg-2');
    });

    it('should handle limit larger than total messages', async () => {
      const recent = await repository.getRecent(10);

      expect(recent).toHaveLength(5);
      expect(recent[0].id).toBe('msg-4');
      expect(recent[4].id).toBe('msg-0');
    });

    it('should return empty array for limit 0', async () => {
      const recent = await repository.getRecent(0);
      expect(recent).toEqual([]);
    });
  });

  describe('findByQuery', () => {
    beforeEach(async () => {
      // Save diverse messages
      await repository.save({
        id: 'msg-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        type: 'chat',
        namespace: 'room1',
        addon_id: 'addon1',
        direction: 'incoming',
        payload: { text: 'Hello' }
      });

      await repository.save({
        id: 'msg-2',
        timestamp: new Date('2024-01-02T10:00:00Z'),
        type: 'notification',
        namespace: 'room1',
        addon_id: 'addon2',
        direction: 'outgoing',
        payload: { alert: 'New message' }
      });

      await repository.save({
        id: 'msg-3',
        timestamp: new Date('2024-01-03T10:00:00Z'),
        type: 'chat',
        namespace: 'room2',
        addon_id: 'addon1',
        direction: 'incoming',
        payload: { text: 'Hi there' }
      });

      await repository.save({
        id: 'msg-4',
        timestamp: new Date('2024-01-04T10:00:00Z'),
        type: 'system',
        namespace: 'room2',
        direction: 'outgoing',
        payload: { event: 'user_joined' }
      });
    });

    it('should filter by date range', async () => {
      const query: MessageQuery = {
        since: new Date('2024-01-02T00:00:00Z'),
        until: new Date('2024-01-03T23:59:59Z')
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(2);
      // Results are sorted by timestamp desc (newest first)
      expect(results[0].id).toBe('msg-3'); // 2024-01-03
      expect(results[1].id).toBe('msg-2'); // 2024-01-02
    });

    it('should filter by type', async () => {
      const query: MessageQuery = {
        type: 'chat'
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(2);
      // Results are sorted by timestamp desc (newest first)
      expect(results[0].id).toBe('msg-3'); // 2024-01-03
      expect(results[1].id).toBe('msg-1'); // 2024-01-01
    });

    it('should filter by namespace', async () => {
      const query: MessageQuery = {
        namespace: 'room2'
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(2);
      // Results are sorted by timestamp desc (newest first)
      expect(results[0].id).toBe('msg-4'); // 2024-01-04
      expect(results[1].id).toBe('msg-3'); // 2024-01-03
    });

    it('should filter by addon_id', async () => {
      const query: MessageQuery = {
        addon_id: 'addon1'
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(2);
      // Results are sorted by timestamp desc (newest first)
      expect(results[0].id).toBe('msg-3'); // 2024-01-03
      expect(results[1].id).toBe('msg-1'); // 2024-01-01
    });

    it('should combine multiple filters', async () => {
      const query: MessageQuery = {
        type: 'chat',
        namespace: 'room1'
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-1');
    });

    it('should apply pagination', async () => {
      const query: MessageQuery = {
        limit: 2,
        offset: 1
      };

      const results = await repository.findByQuery(query);

      expect(results).toHaveLength(2);
      // After sorting by timestamp desc: msg-4, msg-3, msg-2, msg-1
      // With offset 1, we skip msg-4 and get msg-3, msg-2
      expect(results[0].id).toBe('msg-3');
      expect(results[1].id).toBe('msg-2');
    });

    it('should use default limit and offset', async () => {
      // Add many messages to test default limit
      for (let i = 5; i <= 150; i++) {
        await repository.save({
          id: `msg-${i}`,
          timestamp: new Date(`2024-01-${(5 + Math.floor(i / 30)).toString().padStart(2, '0')}T${(i % 24).toString().padStart(2, '0')}:00:00Z`),
          type: 'test',
          direction: 'incoming',
          payload: { index: i }
        });
      }

      const results = await repository.findByQuery({});

      expect(results).toHaveLength(100); // Default limit
      expect(results[0].id).toBe('msg-150'); // Newest first
    });

    it('should return empty array when no matches', async () => {
      const query: MessageQuery = {
        type: 'non-existent'
      };

      const results = await repository.findByQuery(query);

      expect(results).toEqual([]);
    });
  });

  describe('clearOlderThan', () => {
    beforeEach(async () => {
      // Save messages with different timestamps
      await repository.save({
        id: 'old-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'old-2',
        timestamp: new Date('2024-01-05T10:00:00Z'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'recent-1',
        timestamp: new Date('2024-01-10T10:00:00Z'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'recent-2',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });
    });

    it('should clear messages older than date', async () => {
      const cutoffDate = new Date('2024-01-07T00:00:00Z');
      const cleared = await repository.clearOlderThan(cutoffDate);

      // The implementation keeps messages where timestamp > date
      // So it will keep recent-1 (2024-01-10) and recent-2 (2024-01-15)
      expect(cleared).toBe(2); // old-1 and old-2
      
      const remaining = await repository.getRecent(10);
      expect(remaining).toHaveLength(2);
      expect(remaining[0].id).toBe('recent-2');
      expect(remaining[1].id).toBe('recent-1');

      // Verify old messages are gone
      const old1 = await repository.findById('old-1');
      const old2 = await repository.findById('old-2');
      expect(old1).toBeNull();
      expect(old2).toBeNull();
    });

    it('should clear all messages if date is in future', async () => {
      const futureDate = new Date('2025-01-01T00:00:00Z');
      const cleared = await repository.clearOlderThan(futureDate);

      expect(cleared).toBe(4);
      
      const remaining = await repository.getRecent(10);
      expect(remaining).toEqual([]);
    });

    it('should clear no messages if date is in past', async () => {
      const pastDate = new Date('2023-01-01T00:00:00Z');
      const cleared = await repository.clearOlderThan(pastDate);

      // All messages have timestamps in 2024, which are > 2023
      // So all messages will be kept
      expect(cleared).toBe(0);
      
      const remaining = await repository.getRecent(10);
      expect(remaining).toHaveLength(4);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await repository.save({
        id: 'msg-1',
        timestamp: new Date('2024-01-01'),
        type: 'chat',
        namespace: 'room1',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'msg-2',
        timestamp: new Date('2024-01-02'),
        type: 'notification',
        namespace: 'room1',
        direction: 'outgoing',
        payload: {}
      });

      await repository.save({
        id: 'msg-3',
        timestamp: new Date('2024-01-03'),
        type: 'chat',
        namespace: 'room2',
        direction: 'incoming',
        payload: {}
      });
    });

    it('should count all messages without query', async () => {
      const count = await repository.count();
      expect(count).toBe(3);
    });

    it('should count messages matching query', async () => {
      const count = await repository.count({ type: 'chat' });
      expect(count).toBe(2);
    });

    it('should count messages with multiple filters', async () => {
      const count = await repository.count({ 
        type: 'chat',
        namespace: 'room1'
      });
      expect(count).toBe(1);
    });

    it('should return 0 for no matches', async () => {
      const count = await repository.count({ type: 'non-existent' });
      expect(count).toBe(0);
    });

    it('should count with date range', async () => {
      const count = await repository.count({
        since: new Date('2024-01-02T00:00:00Z'),
        until: new Date('2024-01-02T23:59:59Z')
      });
      expect(count).toBe(1); // Only msg-2 falls within this range
    });
  });

  describe('clear', () => {
    it('should clear all messages', async () => {
      await repository.save({
        id: 'msg-1',
        timestamp: new Date(),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'msg-2',
        timestamp: new Date(),
        type: 'test',
        direction: 'outgoing',
        payload: {}
      });

      repository.clear();

      const count = await repository.count();
      expect(count).toBe(0);

      const recent = await repository.getRecent(10);
      expect(recent).toEqual([]);
    });
  });

  describe('setMaxMessages', () => {
    it('should update max message limit', async () => {
      repository.setMaxMessages(2);

      await repository.save({
        id: 'msg-1',
        timestamp: new Date('2024-01-01'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'msg-2',
        timestamp: new Date('2024-01-02'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      await repository.save({
        id: 'msg-3',
        timestamp: new Date('2024-01-03'),
        type: 'test',
        direction: 'incoming',
        payload: {}
      });

      const count = await repository.count();
      expect(count).toBe(2);

      const msg1 = await repository.findById('msg-1');
      expect(msg1).toBeNull();
    });
  });
});