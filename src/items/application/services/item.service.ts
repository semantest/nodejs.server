/**
 * @fileoverview Item service for business logic
 * @description Handles item operations and history tracking
 */

import { ItemEntity, Item, ItemHistoryEntry } from '../../domain/entities/item.entity';
import { ItemRepository } from '../../domain/repositories/item.repository';

export interface CreateItemDto {
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateItemDto {
  name?: string;
  description?: string;
  status?: Item['status'];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ItemHistoryResponse {
  itemId: string;
  currentState: Item;
  history: ItemHistoryEntry[];
  totalChanges: number;
  firstChange: Date | null;
  lastChange: Date | null;
}

export class ItemService {
  constructor(private readonly repository: ItemRepository) {}

  /**
   * Create a new item
   */
  async createItem(dto: CreateItemDto, userId?: string): Promise<Item> {
    const entity = new ItemEntity({
      name: dto.name,
      description: dto.description,
      tags: dto.tags,
      metadata: dto.metadata
    });

    // Save the item
    const savedItem = await this.repository.save(entity.toJSON());

    // Save the creation history
    const history = entity.getHistory();
    if (history.length > 0) {
      await this.repository.saveHistoryEntry({
        ...history[0],
        userId
      });
    }

    return savedItem;
  }

  /**
   * Get an item by ID
   */
  async getItem(itemId: string): Promise<Item | null> {
    return this.repository.findById(itemId);
  }

  /**
   * Get all items
   */
  async getAllItems(): Promise<Item[]> {
    return this.repository.findAll();
  }

  /**
   * Update an item
   */
  async updateItem(itemId: string, dto: UpdateItemDto, userId?: string): Promise<Item | null> {
    const existingItem = await this.repository.findById(itemId);
    if (!existingItem) {
      return null;
    }

    // Load existing history
    const existingHistory = await this.repository.getHistory(itemId);
    const existingHistoryCount = existingHistory.length;
    
    // Create entity from existing data
    const entity = ItemEntity.fromJSON(existingItem, existingHistory);
    
    // Apply updates
    entity.update(dto, userId);

    // Save updated item
    const updatedItem = await this.repository.update(itemId, entity.toJSON());

    // Save new history entries
    const newHistory = entity.getHistory();
    const newEntryCount = newHistory.length - existingHistoryCount;
    if (newEntryCount > 0) {
      // Save only the new entries
      const newEntries = newHistory.slice(-newEntryCount);
      for (const entry of newEntries) {
        await this.repository.saveHistoryEntry(entry);
      }
    }

    return updatedItem;
  }

  /**
   * Change item status
   */
  async changeItemStatus(
    itemId: string, 
    newStatus: Item['status'], 
    userId?: string
  ): Promise<Item | null> {
    const existingItem = await this.repository.findById(itemId);
    if (!existingItem) {
      return null;
    }

    // Load existing history
    const existingHistory = await this.repository.getHistory(itemId);
    
    // Create entity from existing data
    const entity = ItemEntity.fromJSON(existingItem, existingHistory);
    
    // Change status
    entity.changeStatus(newStatus, userId);

    // Save updated item
    const updatedItem = await this.repository.update(itemId, entity.toJSON());

    // Save new history entry
    const newHistory = entity.getHistory();
    const lastHistoryEntry = newHistory[newHistory.length - 1];
    if (lastHistoryEntry) {
      await this.repository.saveHistoryEntry(lastHistoryEntry);
    }

    return updatedItem;
  }

  /**
   * Delete an item (soft delete)
   */
  async deleteItem(itemId: string, userId?: string): Promise<boolean> {
    const existingItem = await this.repository.findById(itemId);
    if (!existingItem) {
      return false;
    }

    // Load existing history
    const existingHistory = await this.repository.getHistory(itemId);
    
    // Create entity from existing data
    const entity = ItemEntity.fromJSON(existingItem, existingHistory);
    
    // Mark as deleted
    entity.delete(userId);

    // Save deletion
    const success = await this.repository.delete(itemId);

    // Save deletion history
    const newHistory = entity.getHistory();
    const lastHistoryEntry = newHistory[newHistory.length - 1];
    if (lastHistoryEntry && success) {
      await this.repository.saveHistoryEntry(lastHistoryEntry);
    }

    return success;
  }

  /**
   * Get item history
   */
  async getItemHistory(itemId: string): Promise<ItemHistoryResponse | null> {
    const item = await this.repository.findById(itemId);
    if (!item) {
      return null;
    }

    const history = await this.repository.getHistory(itemId);
    
    return {
      itemId,
      currentState: item,
      history,
      totalChanges: history.length,
      firstChange: history.length > 0 ? history[history.length - 1].timestamp : null,
      lastChange: history.length > 0 ? history[0].timestamp : null
    };
  }

  /**
   * Get item history within date range
   */
  async getItemHistoryByDateRange(
    itemId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ItemHistoryEntry[]> {
    return this.repository.getHistoryByDateRange(itemId, startDate, endDate);
  }

  /**
   * Get item history by action type
   */
  async getItemHistoryByAction(
    itemId: string,
    action: ItemHistoryEntry['action']
  ): Promise<ItemHistoryEntry[]> {
    return this.repository.getHistoryByAction(itemId, action);
  }

  /**
   * Get items by status
   */
  async getItemsByStatus(status: Item['status']): Promise<Item[]> {
    return this.repository.findByStatus(status);
  }
}