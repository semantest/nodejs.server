/**
 * Tests for Item Repository interface
 * Testing type definitions and interface contracts
 */

import { ItemRepository } from '../item.repository';
import { Item, ItemHistoryEntry } from '../../entities/item.entity';

describe('Item Repository Interface', () => {
  // Create a mock implementation to test the interface
  class MockItemRepository implements ItemRepository {
    private items: Map<string, Item> = new Map();
    private history: Map<string, ItemHistoryEntry[]> = new Map();

    async findById(id: string): Promise<Item | null> {
      return this.items.get(id) || null;
    }

    async findAll(): Promise<Item[]> {
      return Array.from(this.items.values());
    }

    async findByStatus(status: Item['status']): Promise<Item[]> {
      return Array.from(this.items.values()).filter(item => item.status === status);
    }

    async save(item: Item): Promise<Item> {
      this.items.set(item.id, item);
      return item;
    }

    async update(id: string, updates: Partial<Item>): Promise<Item | null> {
      const item = this.items.get(id);
      if (!item) return null;
      
      const updated = { ...item, ...updates };
      this.items.set(id, updated);
      return updated;
    }

    async delete(id: string): Promise<boolean> {
      const item = this.items.get(id);
      if (!item) return false;
      
      const softDeleted = { ...item, status: 'archived' as Item['status'] };
      this.items.set(id, softDeleted);
      return true;
    }

    async getHistory(itemId: string): Promise<ItemHistoryEntry[]> {
      return this.history.get(itemId) || [];
    }

    async saveHistoryEntry(entry: ItemHistoryEntry): Promise<ItemHistoryEntry> {
      const itemHistory = this.history.get(entry.itemId) || [];
      itemHistory.push(entry);
      this.history.set(entry.itemId, itemHistory);
      return entry;
    }

    async getHistoryBatch(itemIds: string[]): Promise<Map<string, ItemHistoryEntry[]>> {
      const result = new Map<string, ItemHistoryEntry[]>();
      for (const id of itemIds) {
        result.set(id, this.history.get(id) || []);
      }
      return result;
    }

    async getHistoryByDateRange(
      itemId: string,
      startDate: Date,
      endDate: Date
    ): Promise<ItemHistoryEntry[]> {
      const history = this.history.get(itemId) || [];
      return history.filter(entry => 
        entry.timestamp >= startDate && entry.timestamp <= endDate
      );
    }

    async getHistoryByAction(
      itemId: string,
      action: ItemHistoryEntry['action']
    ): Promise<ItemHistoryEntry[]> {
      const history = this.history.get(itemId) || [];
      return history.filter(entry => entry.action === action);
    }
  }

  let repository: ItemRepository;

  beforeEach(() => {
    repository = new MockItemRepository();
  });

  describe('Item CRUD operations', () => {
    const testItem: Item = {
      id: 'item-123',
      name: 'Test Item',
      description: 'A test item',
      status: 'active',
      metadata: { key: 'value' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      version: 1
    };

    it('should save and find item by id', async () => {
      await repository.save(testItem);
      const found = await repository.findById('item-123');
      
      expect(found).toEqual(testItem);
    });

    it('should return null for non-existent item', async () => {
      const found = await repository.findById('non-existent');
      
      expect(found).toBeNull();
    });

    it('should find all items', async () => {
      const item1: Item = { ...testItem, id: 'item-1' };
      const item2: Item = { ...testItem, id: 'item-2', name: 'Item 2' };
      
      await repository.save(item1);
      await repository.save(item2);
      
      const all = await repository.findAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(item1);
      expect(all).toContainEqual(item2);
    });

    it('should find items by status', async () => {
      const activeItem: Item = { ...testItem, id: 'active-1', status: 'active' };
      const inactiveItem: Item = { ...testItem, id: 'inactive-1', status: 'inactive' };
      const archivedItem: Item = { ...testItem, id: 'archived-1', status: 'archived' };
      
      await repository.save(activeItem);
      await repository.save(inactiveItem);
      await repository.save(archivedItem);
      
      const active = await repository.findByStatus('active');
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active-1');
      
      const inactive = await repository.findByStatus('inactive');
      expect(inactive).toHaveLength(1);
      expect(inactive[0].id).toBe('inactive-1');
    });

    it('should update existing item', async () => {
      await repository.save(testItem);
      
      const updated = await repository.update('item-123', {
        name: 'Updated Name',
        status: 'inactive'
      });
      
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.status).toBe('inactive');
      expect(updated!.id).toBe('item-123');
    });

    it('should return null when updating non-existent item', async () => {
      const updated = await repository.update('non-existent', {
        name: 'New Name'
      });
      
      expect(updated).toBeNull();
    });

    it('should soft delete item', async () => {
      await repository.save(testItem);
      
      const deleted = await repository.delete('item-123');
      expect(deleted).toBe(true);
      
      const found = await repository.findById('item-123');
      expect(found).not.toBeNull();
      expect(found!.status).toBe('archived');
    });

    it('should return false when deleting non-existent item', async () => {
      const deleted = await repository.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('History operations', () => {
    const historyEntry: ItemHistoryEntry = {
      id: 'history-1',
      itemId: 'item-123',
      action: 'updated',
      userId: 'user-456',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      changes: {
        name: { from: 'Old Name', to: 'New Name' }
      },
      metadata: { reason: 'correction' }
    };

    it('should save and retrieve history entry', async () => {
      await repository.saveHistoryEntry(historyEntry);
      
      const history = await repository.getHistory('item-123');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(historyEntry);
    });

    it('should return empty array for item with no history', async () => {
      const history = await repository.getHistory('no-history');
      expect(history).toEqual([]);
    });

    it('should get history batch for multiple items', async () => {
      const entry1: ItemHistoryEntry = { ...historyEntry, id: 'h1', itemId: 'item-1' };
      const entry2: ItemHistoryEntry = { ...historyEntry, id: 'h2', itemId: 'item-2' };
      const entry3: ItemHistoryEntry = { ...historyEntry, id: 'h3', itemId: 'item-2' };
      
      await repository.saveHistoryEntry(entry1);
      await repository.saveHistoryEntry(entry2);
      await repository.saveHistoryEntry(entry3);
      
      const batch = await repository.getHistoryBatch(['item-1', 'item-2', 'item-3']);
      
      expect(batch.size).toBe(3);
      expect(batch.get('item-1')).toHaveLength(1);
      expect(batch.get('item-2')).toHaveLength(2);
      expect(batch.get('item-3')).toEqual([]);
    });

    it('should filter history by date range', async () => {
      const entry1: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h1', 
        timestamp: new Date('2024-01-01T10:00:00Z') 
      };
      const entry2: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h2', 
        timestamp: new Date('2024-01-02T10:00:00Z') 
      };
      const entry3: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h3', 
        timestamp: new Date('2024-01-03T10:00:00Z') 
      };
      
      await repository.saveHistoryEntry(entry1);
      await repository.saveHistoryEntry(entry2);
      await repository.saveHistoryEntry(entry3);
      
      const rangeHistory = await repository.getHistoryByDateRange(
        'item-123',
        new Date('2024-01-01T12:00:00Z'),
        new Date('2024-01-02T12:00:00Z')
      );
      
      expect(rangeHistory).toHaveLength(1);
      expect(rangeHistory[0].id).toBe('h2');
    });

    it('should filter history by action', async () => {
      const createEntry: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h1', 
        action: 'created' 
      };
      const updateEntry1: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h2', 
        action: 'updated' 
      };
      const updateEntry2: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h3', 
        action: 'updated' 
      };
      const deleteEntry: ItemHistoryEntry = { 
        ...historyEntry, 
        id: 'h4', 
        action: 'deleted' 
      };
      
      await repository.saveHistoryEntry(createEntry);
      await repository.saveHistoryEntry(updateEntry1);
      await repository.saveHistoryEntry(updateEntry2);
      await repository.saveHistoryEntry(deleteEntry);
      
      const updates = await repository.getHistoryByAction('item-123', 'updated');
      expect(updates).toHaveLength(2);
      expect(updates.map(e => e.id)).toEqual(['h2', 'h3']);
      
      const creates = await repository.getHistoryByAction('item-123', 'created');
      expect(creates).toHaveLength(1);
      expect(creates[0].id).toBe('h1');
    });
  });

  describe('Item status types', () => {
    it('should handle all valid status values', async () => {
      const statuses: Item['status'][] = ['active', 'inactive', 'archived'];
      
      for (const status of statuses) {
        const item: Item = {
          id: `item-${status}`,
          name: `${status} Item`,
          description: 'Test',
          status: status,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        };
        
        await repository.save(item);
      }
      
      expect(await repository.findByStatus('active')).toHaveLength(1);
      expect(await repository.findByStatus('inactive')).toHaveLength(1);
      expect(await repository.findByStatus('archived')).toHaveLength(1);
    });
  });

  describe('History action types', () => {
    it('should handle all valid action types', () => {
      const actions: ItemHistoryEntry['action'][] = ['created', 'updated', 'deleted'];
      
      actions.forEach(action => {
        const entry: ItemHistoryEntry = {
          id: `history-${action}`,
          itemId: 'item-123',
          action: action,
          userId: 'user-456',
          timestamp: new Date(),
          changes: {},
          metadata: {}
        };
        
        expect(entry.action).toBe(action);
      });
    });
  });
});