/**
 * 🧪 Tests for Item Routes
 * Testing REST API endpoints for item operations
 */

import { Request, Response, NextFunction } from 'express';
import { itemRouter } from '../item.routes';
import { ItemService } from '../../../application/services/item.service';
import { ItemEntity } from '../../../domain/entities/item.entity';

// Mock dependencies
jest.mock('../../../application/services/item.service');
jest.mock('../../../infrastructure/repositories/in-memory-item.repository');

// Helper to extract route handlers
function getRouteHandler(path: string, method: string = 'get') {
  const route = itemRouter.stack.find((layer: any) => {
    return layer.route && layer.route.path === path && layer.route.methods[method];
  });
  return route?.route?.stack.find((s: any) => s.method === method)?.handle;
}

describe('Item Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockItemService: jest.Mocked<ItemService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockNext = jest.fn();
    
    mockReq = {
      params: {},
      body: {},
      query: {},
      headers: {}
    };
    
    mockRes = {
      json: jsonMock,
      status: statusMock
    };

    // Get mocked service instance
    mockItemService = require('../item.routes')['itemService'];
  });

  describe('GET /items', () => {
    it('should return all items', async () => {
      const mockItems = [
        { id: '1', name: 'Item 1', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 },
        { id: '2', name: 'Item 2', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 }
      ];
      
      mockItemService.getAllItems.mockResolvedValue(mockItems);
      
      const handler = getRouteHandler('/items');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getAllItems).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        items: mockItems,
        count: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockItemService.getAllItems.mockRejectedValue(error);
      
      const handler = getRouteHandler('/items');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /items/:item_id', () => {
    it('should return specific item', async () => {
      const mockItem = { id: '123', name: 'Test Item', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 };
      mockReq.params = { item_id: '123' };
      
      mockItemService.getItem.mockResolvedValue(mockItem);
      
      const handler = getRouteHandler('/items/:item_id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getItem).toHaveBeenCalledWith('123');
      expect(jsonMock).toHaveBeenCalledWith({
        item: mockItem,
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent item', async () => {
      mockReq.params = { item_id: 'non-existent' };
      mockItemService.getItem.mockResolvedValue(null);
      
      const handler = getRouteHandler('/items/:item_id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Item not found',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      mockReq.params = { item_id: '123' };
      const error = new Error('Database error');
      mockItemService.getItem.mockRejectedValue(error);
      
      const handler = getRouteHandler('/items/:item_id');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('POST /items', () => {
    it('should create new item', async () => {
      const newItemData = {
        name: 'New Item',
        description: 'A new test item',
        tags: ['test'],
        metadata: { category: 'test' }
      };
      
      const createdItem = {
        id: 'new-123',
        ...newItemData,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };
      
      mockReq.body = newItemData;
      mockReq.headers = { 'x-user-id': 'user-123' };
      
      mockItemService.createItem.mockResolvedValue(createdItem);
      
      const handler = getRouteHandler('/items', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.createItem).toHaveBeenCalledWith(newItemData, 'user-123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        item: createdItem,
        timestamp: expect.any(String)
      });
    });

    it('should return 400 if name is missing', async () => {
      mockReq.body = { description: 'No name' };
      mockReq.headers = { 'x-user-id': 'user-123' };
      
      const handler = getRouteHandler('/items', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Name is required',
        timestamp: expect.any(String)
      });
      expect(mockItemService.createItem).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockReq.body = { name: 'New Item' };
      mockReq.headers = { 'x-user-id': 'user-123' };
      
      const error = new Error('Creation failed');
      mockItemService.createItem.mockRejectedValue(error);
      
      const handler = getRouteHandler('/items', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('PUT /items/:item_id', () => {
    it('should update item', async () => {
      const updateData = {
        name: 'Updated Item',
        description: 'Updated description',
        status: 'inactive' as const,
        tags: ['updated'],
        metadata: { updated: true }
      };
      
      const updatedItem = {
        id: '123',
        ...updateData,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2
      };
      
      mockReq.params = { item_id: '123' };
      mockReq.body = updateData;
      mockReq.headers = { 'x-user-id': 'user-456' };
      
      mockItemService.updateItem.mockResolvedValue(updatedItem);
      
      const handler = getRouteHandler('/items/:item_id', 'put');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.updateItem).toHaveBeenCalledWith('123', updateData, 'user-456');
      expect(jsonMock).toHaveBeenCalledWith({
        item: updatedItem,
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent item', async () => {
      mockReq.params = { item_id: 'non-existent' };
      mockReq.body = { name: 'Updated' };
      mockReq.headers = { 'x-user-id': 'user-456' };
      
      mockItemService.updateItem.mockResolvedValue(null);
      
      const handler = getRouteHandler('/items/:item_id', 'put');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Item not found',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('PATCH /items/:item_id/status', () => {
    it('should change item status', async () => {
      const updatedItem = {
        id: '123',
        name: 'Test Item',
        status: 'archived' as const,
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2
      };
      
      mockReq.params = { item_id: '123' };
      mockReq.body = { status: 'archived' as const };
      mockReq.headers = { 'x-user-id': 'user-789' };
      
      mockItemService.changeItemStatus.mockResolvedValue(updatedItem);
      
      const handler = getRouteHandler('/items/:item_id/status', 'patch');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.changeItemStatus).toHaveBeenCalledWith('123', 'archived', 'user-789');
      expect(jsonMock).toHaveBeenCalledWith({
        item: updatedItem,
        timestamp: expect.any(String)
      });
    });

    it('should return 400 for invalid status', async () => {
      mockReq.params = { item_id: '123' };
      mockReq.body = { status: 'invalid-status' };
      mockReq.headers = { 'x-user-id': 'user-789' };
      
      const handler = getRouteHandler('/items/:item_id/status', 'patch');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: active, inactive, archived',
        timestamp: expect.any(String)
      });
      expect(mockItemService.changeItemStatus).not.toHaveBeenCalled();
    });

    it('should return 400 for missing status', async () => {
      mockReq.params = { item_id: '123' };
      mockReq.body = {};
      mockReq.headers = { 'x-user-id': 'user-789' };
      
      const handler = getRouteHandler('/items/:item_id/status', 'patch');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: active, inactive, archived',
        timestamp: expect.any(String)
      });
    });
  });

  describe('DELETE /items/:item_id', () => {
    it('should delete item', async () => {
      mockReq.params = { item_id: '123' };
      mockReq.headers = { 'x-user-id': 'user-999' };
      
      mockItemService.deleteItem.mockResolvedValue(true);
      
      const handler = getRouteHandler('/items/:item_id', 'delete');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.deleteItem).toHaveBeenCalledWith('123', 'user-999');
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Item deleted successfully',
        itemId: '123',
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent item', async () => {
      mockReq.params = { item_id: 'non-existent' };
      mockReq.headers = { 'x-user-id': 'user-999' };
      
      mockItemService.deleteItem.mockResolvedValue(false);
      
      const handler = getRouteHandler('/items/:item_id', 'delete');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Item not found',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /item/:item_id/history', () => {
    it('should return item history', async () => {
      const mockHistory = {
        itemId: '123',
        currentState: { id: '123', name: 'Test Item', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 },
        history: [
          { id: 'h1', itemId: '123', action: 'created' as const, timestamp: new Date(), userId: 'user-1' },
          { id: 'h2', itemId: '123', action: 'updated' as const, timestamp: new Date(), userId: 'user-2' }
        ],
        totalChanges: 2,
        firstChange: new Date(),
        lastChange: new Date()
      };
      
      mockReq.params = { item_id: '123' };
      mockReq.query = {};
      
      mockItemService.getItemHistory.mockResolvedValue(mockHistory);
      
      const handler = getRouteHandler('/item/:item_id/history');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getItemHistory).toHaveBeenCalledWith('123');
      expect(jsonMock).toHaveBeenCalledWith({
        itemId: '123',
        currentState: mockHistory.currentState,
        history: mockHistory.history,
        totalChanges: 2,
        filters: {
          startDate: null,
          endDate: null,
          action: null
        },
        timestamp: expect.any(String)
      });
    });

    it('should filter history by date range', async () => {
      const mockHistory = {
        itemId: '123',
        currentState: { id: '123', name: 'Test Item', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 },
        history: [{ id: 'h1', itemId: '123', action: 'created' as const, timestamp: new Date() }],
        totalChanges: 1,
        firstChange: new Date(),
        lastChange: new Date()
      };
      
      const filteredHistory = [{ id: 'h1', itemId: '123', action: 'created' as const, timestamp: new Date() }];
      
      mockReq.params = { item_id: '123' };
      mockReq.query = {
        start_date: '2024-01-01',
        end_date: '2024-12-31'
      };
      
      mockItemService.getItemHistory.mockResolvedValue(mockHistory);
      mockItemService.getItemHistoryByDateRange.mockResolvedValue(filteredHistory);
      
      const handler = getRouteHandler('/item/:item_id/history');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getItemHistoryByDateRange).toHaveBeenCalledWith(
        '123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
    });

    it('should filter history by action', async () => {
      const mockHistory = {
        itemId: '123',
        currentState: { id: '123', name: 'Test Item', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 },
        history: [{ id: 'h1', itemId: '123', action: 'updated' as const, timestamp: new Date() }],
        totalChanges: 1,
        firstChange: new Date(),
        lastChange: new Date()
      };
      
      const filteredHistory = [{ id: 'h1', itemId: '123', action: 'updated' as const, timestamp: new Date() }];
      
      mockReq.params = { item_id: '123' };
      mockReq.query = { action: 'updated' as const };
      
      mockItemService.getItemHistory.mockResolvedValue(mockHistory);
      mockItemService.getItemHistoryByAction.mockResolvedValue(filteredHistory);
      
      const handler = getRouteHandler('/item/:item_id/history');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getItemHistoryByAction).toHaveBeenCalledWith('123', 'updated');
    });

    it('should return 404 for non-existent item', async () => {
      mockReq.params = { item_id: 'non-existent' };
      mockReq.query = {};
      
      mockItemService.getItemHistory.mockResolvedValue(null);
      
      const handler = getRouteHandler('/item/:item_id/history');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Item not found',
        itemId: 'non-existent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /items/status/:status', () => {
    it('should return items by status', async () => {
      const mockItems = [
        { id: '1', name: 'Active Item 1', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 },
        { id: '2', name: 'Active Item 2', status: 'active' as const, tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(), version: 1 }
      ];
      
      mockReq.params = { status: 'active' as const };
      
      mockItemService.getItemsByStatus.mockResolvedValue(mockItems);
      
      const handler = getRouteHandler('/items/status/:status');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.getItemsByStatus).toHaveBeenCalledWith('active');
      expect(jsonMock).toHaveBeenCalledWith({
        items: mockItems,
        count: 2,
        status: 'active' as const,
        timestamp: expect.any(String)
      });
    });

    it('should return 400 for invalid status', async () => {
      mockReq.params = { status: 'invalid-status' };
      
      const handler = getRouteHandler('/items/status/:status');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid status. Must be one of: active, inactive, archived',
        timestamp: expect.any(String)
      });
      expect(mockItemService.getItemsByStatus).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should pass unexpected errors to error handler', async () => {
      const error = new Error('Unexpected database error');
      mockItemService.getAllItems.mockRejectedValue(error);
      
      const handler = getRouteHandler('/items');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('User Context', () => {
    it('should use x-user-id header for user context', async () => {
      mockReq.body = { name: 'Test Item' };
      mockReq.headers = { 'x-user-id': 'custom-user-123' };
      
      mockItemService.createItem.mockResolvedValue({
        id: 'new-item',
        name: 'Test Item',
        status: 'active' as const,
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      });
      
      const handler = getRouteHandler('/items', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.createItem).toHaveBeenCalledWith(
        { name: 'Test Item' },
        'custom-user-123'
      );
    });

    it('should handle missing user ID', async () => {
      mockReq.body = { name: 'Test Item' };
      mockReq.headers = {}; // No x-user-id
      
      mockItemService.createItem.mockResolvedValue({
        id: 'new-item',
        name: 'Test Item',
        status: 'active' as const,
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      });
      
      const handler = getRouteHandler('/items', 'post');
      await handler(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockItemService.createItem).toHaveBeenCalledWith(
        { name: 'Test Item' },
        undefined
      );
    });
  });
});