/**
 * @fileoverview Tests for item history endpoint
 * @description Test suite for GET /item/:item_id/history
 */

import request from 'supertest';
import express, { Express } from 'express';
import { itemRouter } from '../infrastructure/http/item.routes';
import { InMemoryItemRepository } from '../infrastructure/repositories/in-memory-item.repository';
import { ItemService } from '../application/services/item.service';
import { ItemEntity } from '../domain/entities/item.entity';

describe('Item History Endpoint', () => {
  let app: Express;
  let repository: InMemoryItemRepository;
  let service: ItemService;
  let testItemId: string;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api', itemRouter);

    // Initialize repository and service
    repository = new InMemoryItemRepository();
    service = new ItemService(repository);

    // Create test item with some history
    const testItem = new ItemEntity({
      name: 'Test Item',
      description: 'Initial description',
      tags: ['test']
    });
    
    testItemId = testItem.id;

    // Save initial item
    await repository.save(testItem.toJSON());
    const initialHistory = testItem.getHistory();
    for (const entry of initialHistory) {
      await repository.saveHistoryEntry(entry);
    }

    // Simulate some updates
    testItem.update({ description: 'Updated description' }, 'user-123');
    await repository.update(testItemId, testItem.toJSON());
    const updateHistory = testItem.getHistory();
    if (updateHistory.length > 1) {
      await repository.saveHistoryEntry(updateHistory[updateHistory.length - 1]);
    }

    // Change status
    testItem.changeStatus('inactive', 'user-456');
    await repository.update(testItemId, testItem.toJSON());
    const statusHistory = testItem.getHistory();
    if (statusHistory.length > 2) {
      await repository.saveHistoryEntry(statusHistory[statusHistory.length - 1]);
    }
  });

  afterEach(() => {
    repository.clear();
  });

  describe('GET /api/item/:item_id/history', () => {
    it('should return item history for valid item ID', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      expect(response.body).toHaveProperty('itemId', testItemId);
      expect(response.body).toHaveProperty('currentState');
      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('totalChanges');
      expect(response.body).toHaveProperty('timestamp');

      expect(response.body.currentState).toMatchObject({
        id: testItemId,
        name: 'Test Item',
        description: 'Updated description',
        status: 'inactive'
      });

      expect(response.body.history).toBeInstanceOf(Array);
      expect(response.body.history.length).toBe(3);
      expect(response.body.totalChanges).toBe(3);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/api/item/non-existent-id/history')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Item not found');
      expect(response.body).toHaveProperty('itemId', 'non-existent-id');
    });

    it('should return history entries in reverse chronological order', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      const { history } = response.body;
      
      // Most recent first
      expect(history[0].action).toBe('status_changed');
      expect(history[1].action).toBe('updated');
      expect(history[2].action).toBe('created');
    });

    it('should include change details in history entries', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      const { history } = response.body;
      
      // Check update entry
      const updateEntry = history.find((h: any) => h.action === 'updated');
      expect(updateEntry).toBeDefined();
      expect(updateEntry.changes).toHaveProperty('description');
      expect(updateEntry.changes.description).toMatchObject({
        from: 'Initial description',
        to: 'Updated description'
      });

      // Check status change entry
      const statusEntry = history.find((h: any) => h.action === 'status_changed');
      expect(statusEntry).toBeDefined();
      expect(statusEntry.changes).toHaveProperty('status');
      expect(statusEntry.changes.status).toMatchObject({
        from: 'active',
        to: 'inactive'
      });
    });

    it('should filter history by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .query({
          start_date: yesterday.toISOString(),
          end_date: tomorrow.toISOString()
        })
        .expect(200);

      expect(response.body.history).toBeInstanceOf(Array);
      expect(response.body.filters).toMatchObject({
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
        action: null
      });
    });

    it('should filter history by action type', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .query({ action: 'status_changed' })
        .expect(200);

      expect(response.body.history).toBeInstanceOf(Array);
      expect(response.body.history.length).toBe(1);
      expect(response.body.history[0].action).toBe('status_changed');
      expect(response.body.filters).toMatchObject({
        action: 'status_changed'
      });
    });

    it('should handle invalid action filter gracefully', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .query({ action: 'invalid_action' })
        .expect(200);

      // Should return full history when action is invalid
      expect(response.body.history).toBeInstanceOf(Array);
      expect(response.body.history.length).toBe(3);
    });

    it('should include user information in history entries', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      const { history } = response.body;
      
      const updateEntry = history.find((h: any) => h.action === 'updated');
      expect(updateEntry.userId).toBe('user-123');

      const statusEntry = history.find((h: any) => h.action === 'status_changed');
      expect(statusEntry.userId).toBe('user-456');
    });

    it('should include previous and new state in history entries', async () => {
      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      const { history } = response.body;
      
      const updateEntry = history.find((h: any) => h.action === 'updated');
      expect(updateEntry).toHaveProperty('previousState');
      expect(updateEntry).toHaveProperty('newState');
      expect(updateEntry.previousState.description).toBe('Initial description');
      expect(updateEntry.newState.description).toBe('Updated description');
    });
  });

  describe('Edge Cases', () => {
    it('should handle item with no history beyond creation', async () => {
      // Create new item without updates
      const newItem = new ItemEntity({
        name: 'New Item',
        description: 'No updates yet'
      });

      await repository.save(newItem.toJSON());
      const history = newItem.getHistory();
      for (const entry of history) {
        await repository.saveHistoryEntry(entry);
      }

      const response = await request(app)
        .get(`/api/item/${newItem.id}/history`)
        .expect(200);

      expect(response.body.history.length).toBe(1);
      expect(response.body.history[0].action).toBe('created');
    });

    it('should handle deleted items', async () => {
      // Delete the test item
      const item = await repository.findById(testItemId);
      if (item) {
        const entity = ItemEntity.fromJSON(item);
        entity.delete('user-789');
        await repository.delete(testItemId);
        const deleteHistory = entity.getHistory();
        await repository.saveHistoryEntry(deleteHistory[deleteHistory.length - 1]);
      }

      const response = await request(app)
        .get(`/api/item/${testItemId}/history`)
        .expect(200);

      expect(response.body.currentState.status).toBe('archived');
      expect(response.body.history[0].action).toBe('deleted');
    });
  });
});