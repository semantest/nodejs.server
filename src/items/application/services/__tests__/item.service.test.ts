/**
 * 🧪 Tests for ItemService
 * Implementing comprehensive tests to reach 60% coverage
 */

import { ItemService, CreateItemDto, UpdateItemDto, ItemHistoryResponse } from '../item.service';
import { ItemRepository } from '../../../domain/repositories/item.repository';
import { Item, ItemHistoryEntry, ItemEntity } from '../../../domain/entities/item.entity';

// Mock the repository
jest.mock('../../../domain/repositories/item.repository');

describe('ItemService', () => {
  let itemService: ItemService;
  let mockRepository: jest.Mocked<ItemRepository>;

  beforeEach(() => {
    // Create a mock repository with all required methods
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByStatus: jest.fn(),
      saveHistoryEntry: jest.fn(),
      getHistory: jest.fn(),
      getHistoryByDateRange: jest.fn(),
      getHistoryByAction: jest.fn()
    } as unknown as jest.Mocked<ItemRepository>;

    itemService = new ItemService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createItem', () => {
    it('should create a new item successfully', async () => {
      const createDto: CreateItemDto = {
        name: 'Test Item',
        description: 'Test Description',
        tags: ['test', 'item'],
        metadata: { category: 'test' }
      };

      const savedItem: Item = {
        id: 'item-123',
        name: 'Test Item',
        description: 'Test Description',
        status: 'active',
        tags: ['test', 'item'],
        metadata: { category: 'test' },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.save.mockResolvedValue(savedItem);
      mockRepository.saveHistoryEntry.mockResolvedValue(undefined);

      const result = await itemService.createItem(createDto, 'user-123');

      expect(result).toEqual(savedItem);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Item',
          description: 'Test Description',
          tags: ['test', 'item'],
          metadata: { category: 'test' }
        })
      );
      expect(mockRepository.saveHistoryEntry).toHaveBeenCalled();
    });

    it('should create item without optional fields', async () => {
      const createDto: CreateItemDto = {
        name: 'Minimal Item'
      };

      const savedItem: Item = {
        id: 'item-456',
        name: 'Minimal Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.save.mockResolvedValue(savedItem);

      const result = await itemService.createItem(createDto);

      expect(result).toEqual(savedItem);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Item'
        })
      );
    });
  });

  describe('getItem', () => {
    it('should return an item by ID', async () => {
      const item: Item = {
        id: 'item-123',
        name: 'Test Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.findById.mockResolvedValue(item);

      const result = await itemService.getItem('item-123');

      expect(result).toEqual(item);
      expect(mockRepository.findById).toHaveBeenCalledWith('item-123');
    });

    it('should return null when item not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await itemService.getItem('non-existent');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('getAllItems', () => {
    it('should return all items', async () => {
      const items: Item[] = [
        {
          id: 'item-1',
          name: 'Item 1',
          status: 'active',
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        version: 1
        },
        {
          id: 'item-2',
          name: 'Item 2',
          status: 'inactive',
          tags: ['important'],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        version: 1
        }
      ];

      mockRepository.findAll.mockResolvedValue(items);

      const result = await itemService.getAllItems();

      expect(result).toEqual(items);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no items exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await itemService.getAllItems();

      expect(result).toEqual([]);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('should update an existing item', async () => {
      const existingItem: Item = {
        id: 'item-123',
        name: 'Old Name',
        description: 'Old Description',
        status: 'active',
        tags: ['old'],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      const updateDto: UpdateItemDto = {
        name: 'New Name',
        description: 'New Description',
        tags: ['new', 'updated']
      };

      const updatedItem: Item = {
        ...existingItem,
        name: 'New Name',
        description: 'New Description',
        tags: ['new', 'updated'],
        updatedAt: new Date(),
        version: 1
      };

      const history: ItemHistoryEntry[] = [];

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.getHistory.mockResolvedValue(history);
      mockRepository.update.mockResolvedValue(updatedItem);
      mockRepository.saveHistoryEntry.mockResolvedValue(undefined);

      const result = await itemService.updateItem('item-123', updateDto, 'user-123');

      expect(result).toEqual(updatedItem);
      expect(mockRepository.findById).toHaveBeenCalledWith('item-123');
      expect(mockRepository.update).toHaveBeenCalledWith('item-123', expect.any(Object));
      expect(mockRepository.saveHistoryEntry).toHaveBeenCalled();
    });

    it('should return null when updating non-existent item', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await itemService.updateItem('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      const existingItem: Item = {
        id: 'item-123',
        name: 'Original Name',
        description: 'Original Description',
        status: 'active',
        tags: ['original'],
        metadata: { key: 'value' },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      const updateDto: UpdateItemDto = {
        description: 'Updated Description Only'
      };

      const updatedItem: Item = {
        ...existingItem,
        description: 'Updated Description Only',
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.getHistory.mockResolvedValue([]);
      mockRepository.update.mockResolvedValue(updatedItem);

      const result = await itemService.updateItem('item-123', updateDto);

      expect(result).toEqual(updatedItem);
    });
  });

  describe('changeItemStatus', () => {
    it('should change item status', async () => {
      const existingItem: Item = {
        id: 'item-123',
        name: 'Test Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      const updatedItem: Item = {
        ...existingItem,
        status: 'inactive',
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.getHistory.mockResolvedValue([]);
      mockRepository.update.mockResolvedValue(updatedItem);
      mockRepository.saveHistoryEntry.mockResolvedValue(undefined);

      const result = await itemService.changeItemStatus('item-123', 'inactive', 'user-123');

      expect(result).toEqual(updatedItem);
      expect(mockRepository.update).toHaveBeenCalledWith('item-123', expect.any(Object));
      expect(mockRepository.saveHistoryEntry).toHaveBeenCalled();
    });

    it('should return null when changing status of non-existent item', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await itemService.changeItemStatus('non-existent', 'inactive');

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('should soft delete an existing item', async () => {
      const existingItem: Item = {
        id: 'item-123',
        name: 'Test Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.getHistory.mockResolvedValue([]);
      mockRepository.delete.mockResolvedValue(true);
      mockRepository.saveHistoryEntry.mockResolvedValue(undefined);

      const result = await itemService.deleteItem('item-123', 'user-123');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('item-123');
      expect(mockRepository.saveHistoryEntry).toHaveBeenCalled();
    });

    it('should return false when deleting non-existent item', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await itemService.deleteItem('non-existent');

      expect(result).toBe(false);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getItemHistory', () => {
    it('should return item history', async () => {
      const item: Item = {
        id: 'item-123',
        name: 'Test Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        version: 2
      };

      const history: ItemHistoryEntry[] = [
        {
          id: 'history-1',
          itemId: 'item-123',
          action: 'updated',
          changes: { name: { from: 'Old Name', to: 'Test Item' } },
          timestamp: new Date('2024-01-15'),
          userId: 'user-123'
        },
        {
          id: 'history-2',
          itemId: 'item-123',
          action: 'created',
          changes: {},
          timestamp: new Date('2024-01-01')
        }
      ];

      mockRepository.findById.mockResolvedValue(item);
      mockRepository.getHistory.mockResolvedValue(history);

      const result = await itemService.getItemHistory('item-123');

      expect(result).toEqual({
        itemId: 'item-123',
        currentState: item,
        history,
        totalChanges: 2,
        firstChange: new Date('2024-01-01'),
        lastChange: new Date('2024-01-15')
      });
    });

    it('should return null for non-existent item', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await itemService.getItemHistory('non-existent');

      expect(result).toBeNull();
      expect(mockRepository.getHistory).not.toHaveBeenCalled();
    });

    it('should handle empty history', async () => {
      const item: Item = {
        id: 'item-123',
        name: 'Test Item',
        status: 'active',
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      mockRepository.findById.mockResolvedValue(item);
      mockRepository.getHistory.mockResolvedValue([]);

      const result = await itemService.getItemHistory('item-123');

      expect(result).toEqual({
        itemId: 'item-123',
        currentState: item,
        history: [],
        totalChanges: 0,
        firstChange: null,
        lastChange: null
      });
    });
  });

  describe('getItemHistoryByDateRange', () => {
    it('should return history within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const history: ItemHistoryEntry[] = [
        {
          id: 'history-1',
          itemId: 'item-123',
          action: 'updated',
          changes: {},
          timestamp: new Date('2024-01-15')
        }
      ];

      mockRepository.getHistoryByDateRange.mockResolvedValue(history);

      const result = await itemService.getItemHistoryByDateRange('item-123', startDate, endDate);

      expect(result).toEqual(history);
      expect(mockRepository.getHistoryByDateRange).toHaveBeenCalledWith('item-123', startDate, endDate);
    });
  });

  describe('getItemHistoryByAction', () => {
    it('should return history by action type', async () => {
      const history: ItemHistoryEntry[] = [
        {
          id: 'history-1',
          itemId: 'item-123',
          action: 'status_changed',
          changes: { status: { from: 'active', to: 'inactive' } },
          timestamp: new Date()
        }
      ];

      mockRepository.getHistoryByAction.mockResolvedValue(history);

      const result = await itemService.getItemHistoryByAction('item-123', 'status_changed');

      expect(result).toEqual(history);
      expect(mockRepository.getHistoryByAction).toHaveBeenCalledWith('item-123', 'status_changed');
    });
  });

  describe('getItemsByStatus', () => {
    it('should return items by status', async () => {
      const activeItems: Item[] = [
        {
          id: 'item-1',
          name: 'Active Item 1',
          status: 'active',
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        version: 1
        },
        {
          id: 'item-2',
          name: 'Active Item 2',
          status: 'active',
          tags: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        version: 1
        }
      ];

      mockRepository.findByStatus.mockResolvedValue(activeItems);

      const result = await itemService.getItemsByStatus('active');

      expect(result).toEqual(activeItems);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith('active');
    });

    it('should return empty array when no items match status', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      const result = await itemService.getItemsByStatus('archived');

      expect(result).toEqual([]);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith('archived');
    });
  });
});