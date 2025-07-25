/**
 * @fileoverview In-memory implementation of ItemRepository
 * @description Provides in-memory storage for items and their history
 */

import { Item, ItemEntity, ItemHistoryEntry } from '../../domain/entities/item.entity';
import { ItemRepository } from '../../domain/repositories/item.repository';

export class InMemoryItemRepository implements ItemRepository {
  private items: Map<string, Item> = new Map();
  private history: Map<string, ItemHistoryEntry[]> = new Map();

  /**
   * Find an item by ID
   */
  async findById(id: string): Promise<Item | null> {
    const item = this.items.get(id);
    return item || null;
  }

  /**
   * Find all items
   */
  async findAll(): Promise<Item[]> {
    return Array.from(this.items.values());
  }

  /**
   * Find items by status
   */
  async findByStatus(status: Item['status']): Promise<Item[]> {
    return Array.from(this.items.values()).filter(item => item.status === status);
  }

  /**
   * Save a new item
   */
  async save(item: Item): Promise<Item> {
    this.items.set(item.id, { ...item });
    
    // Initialize history array if not exists
    if (!this.history.has(item.id)) {
      this.history.set(item.id, []);
    }

    return { ...item };
  }

  /**
   * Update an existing item
   */
  async update(id: string, updates: Partial<Item>): Promise<Item | null> {
    const existingItem = this.items.get(id);
    if (!existingItem) {
      return null;
    }

    const updatedItem: Item = {
      ...existingItem,
      ...updates,
      id: existingItem.id, // Ensure ID doesn't change
      createdAt: existingItem.createdAt, // Ensure createdAt doesn't change
      updatedAt: new Date(),
      version: existingItem.version + 1
    };

    this.items.set(id, updatedItem);
    return updatedItem;
  }

  /**
   * Delete an item (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) {
      return false;
    }

    // Soft delete by changing status
    const updatedItem: Item = {
      ...item,
      status: 'archived',
      updatedAt: new Date(),
      version: item.version + 1
    };

    this.items.set(id, updatedItem);
    return true;
  }

  /**
   * Get item history
   */
  async getHistory(itemId: string): Promise<ItemHistoryEntry[]> {
    const entries = this.history.get(itemId) || [];
    return [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Save history entry
   */
  async saveHistoryEntry(entry: ItemHistoryEntry): Promise<ItemHistoryEntry> {
    const itemHistory = this.history.get(entry.itemId) || [];
    itemHistory.push(entry);
    this.history.set(entry.itemId, itemHistory);
    return entry;
  }

  /**
   * Get history for multiple items
   */
  async getHistoryBatch(itemIds: string[]): Promise<Map<string, ItemHistoryEntry[]>> {
    const result = new Map<string, ItemHistoryEntry[]>();
    
    for (const itemId of itemIds) {
      const entries = await this.getHistory(itemId);
      result.set(itemId, entries);
    }
    
    return result;
  }

  /**
   * Get history within a date range
   */
  async getHistoryByDateRange(
    itemId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<ItemHistoryEntry[]> {
    const entries = await this.getHistory(itemId);
    
    return entries.filter(entry => {
      const timestamp = entry.timestamp.getTime();
      return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
    });
  }

  /**
   * Get history by action type
   */
  async getHistoryByAction(
    itemId: string, 
    action: ItemHistoryEntry['action']
  ): Promise<ItemHistoryEntry[]> {
    const entries = await this.getHistory(itemId);
    return entries.filter(entry => entry.action === action);
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.items.clear();
    this.history.clear();
  }

  /**
   * Seed with initial data (useful for testing)
   */
  async seed(items: Item[], historyEntries?: Map<string, ItemHistoryEntry[]>): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }

    if (historyEntries) {
      for (const [itemId, entries] of historyEntries) {
        for (const entry of entries) {
          await this.saveHistoryEntry(entry);
        }
      }
    }
  }
}