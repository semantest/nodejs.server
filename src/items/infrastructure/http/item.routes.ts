/**
 * @fileoverview Item routes for Express.js
 * @description Defines REST API endpoints for item operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ItemService } from '../../application/services/item.service';
import { InMemoryItemRepository } from '../repositories/in-memory-item.repository';
import { ItemEntity } from '../../domain/entities/item.entity';

// Initialize repository and service
const itemRepository = new InMemoryItemRepository();
const itemService = new ItemService(itemRepository);

// Create router
export const itemRouter = Router();

/**
 * GET /items
 * Get all items
 */
itemRouter.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await itemService.getAllItems();
    res.json({
      items,
      count: items.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /items/:item_id
 * Get a specific item
 */
itemRouter.get('/items/:item_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { item_id } = req.params;
    const item = await itemService.getItem(item_id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
        itemId: item_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /items
 * Create a new item
 */
itemRouter.post('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, tags, metadata } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        timestamp: new Date().toISOString()
      });
    }

    const item = await itemService.createItem({
      name,
      description,
      tags,
      metadata
    }, userId);

    res.status(201).json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /items/:item_id
 * Update an item
 */
itemRouter.put('/items/:item_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { item_id } = req.params;
    const { name, description, status, tags, metadata } = req.body;
    const userId = req.headers['x-user-id'] as string;

    const item = await itemService.updateItem(item_id, {
      name,
      description,
      status,
      tags,
      metadata
    }, userId);

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
        itemId: item_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /items/:item_id/status
 * Change item status
 */
itemRouter.patch('/items/:item_id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { item_id } = req.params;
    const { status } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!status || !['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: active, inactive, archived',
        timestamp: new Date().toISOString()
      });
    }

    const item = await itemService.changeItemStatus(item_id, status, userId);

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
        itemId: item_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /items/:item_id
 * Delete an item (soft delete)
 */
itemRouter.delete('/items/:item_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { item_id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const success = await itemService.deleteItem(item_id, userId);

    if (!success) {
      return res.status(404).json({
        error: 'Item not found',
        itemId: item_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'Item deleted successfully',
      itemId: item_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /item/:item_id/history
 * Get the history of a specific item
 */
itemRouter.get('/item/:item_id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { item_id } = req.params;
    const { start_date, end_date, action } = req.query;

    // Get full history
    const historyResponse = await itemService.getItemHistory(item_id);

    if (!historyResponse) {
      return res.status(404).json({
        error: 'Item not found',
        itemId: item_id,
        timestamp: new Date().toISOString()
      });
    }

    // Apply filters if provided
    let filteredHistory = historyResponse.history;

    // Filter by date range
    if (start_date || end_date) {
      const startDate = start_date ? new Date(start_date as string) : new Date(0);
      const endDate = end_date ? new Date(end_date as string) : new Date();

      filteredHistory = await itemService.getItemHistoryByDateRange(
        item_id,
        startDate,
        endDate
      );
    }

    // Filter by action
    if (action && ['created', 'updated', 'deleted', 'status_changed'].includes(action as string)) {
      filteredHistory = await itemService.getItemHistoryByAction(
        item_id,
        action as any
      );
    }

    res.json({
      itemId: item_id,
      currentState: historyResponse.currentState,
      history: filteredHistory,
      totalChanges: filteredHistory.length,
      filters: {
        startDate: start_date || null,
        endDate: end_date || null,
        action: action || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /items/status/:status
 * Get items by status
 */
itemRouter.get('/items/status/:status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.params;

    if (!['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: active, inactive, archived',
        timestamp: new Date().toISOString()
      });
    }

    const items = await itemService.getItemsByStatus(status as any);

    res.json({
      items,
      count: items.length,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Seed some test data (for development/testing)
 */
export async function seedTestData(): Promise<void> {
  const testItems = [
    new ItemEntity({
      name: 'Test Item 1',
      description: 'This is a test item',
      tags: ['test', 'sample']
    }),
    new ItemEntity({
      name: 'Test Item 2',
      description: 'Another test item',
      tags: ['demo']
    })
  ];

  for (const item of testItems) {
    await itemRepository.save(item.toJSON());
    
    // Save initial history
    const history = item.getHistory();
    for (const entry of history) {
      await itemRepository.saveHistoryEntry(entry);
    }

    // Simulate some updates
    item.update({ description: 'Updated description' }, 'test-user');
    await itemRepository.update(item.id, item.toJSON());
    
    const newHistory = item.getHistory();
    if (newHistory.length > 1) {
      await itemRepository.saveHistoryEntry(newHistory[newHistory.length - 1]);
    }
  }

  console.log('✅ Test data seeded successfully');
}