/**
 * @fileoverview In-memory implementation of ItemRepository
 * @description Provides in-memory storage for items and their history
 */
import { Item, ItemHistoryEntry } from '../../domain/entities/item.entity';
import { ItemRepository } from '../../domain/repositories/item.repository';
export declare class InMemoryItemRepository implements ItemRepository {
    private items;
    private history;
    /**
     * Find an item by ID
     */
    findById(id: string): Promise<Item | null>;
    /**
     * Find all items
     */
    findAll(): Promise<Item[]>;
    /**
     * Find items by status
     */
    findByStatus(status: Item['status']): Promise<Item[]>;
    /**
     * Save a new item
     */
    save(item: Item): Promise<Item>;
    /**
     * Update an existing item
     */
    update(id: string, updates: Partial<Item>): Promise<Item | null>;
    /**
     * Delete an item (soft delete)
     */
    delete(id: string): Promise<boolean>;
    /**
     * Get item history
     */
    getHistory(itemId: string): Promise<ItemHistoryEntry[]>;
    /**
     * Save history entry
     */
    saveHistoryEntry(entry: ItemHistoryEntry): Promise<ItemHistoryEntry>;
    /**
     * Get history for multiple items
     */
    getHistoryBatch(itemIds: string[]): Promise<Map<string, ItemHistoryEntry[]>>;
    /**
     * Get history within a date range
     */
    getHistoryByDateRange(itemId: string, startDate: Date, endDate: Date): Promise<ItemHistoryEntry[]>;
    /**
     * Get history by action type
     */
    getHistoryByAction(itemId: string, action: ItemHistoryEntry['action']): Promise<ItemHistoryEntry[]>;
    /**
     * Clear all data (useful for testing)
     */
    clear(): void;
    /**
     * Seed with initial data (useful for testing)
     */
    seed(items: Item[], historyEntries?: Map<string, ItemHistoryEntry[]>): Promise<void>;
}
//# sourceMappingURL=in-memory-item.repository.d.ts.map