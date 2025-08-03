/**
 * @fileoverview Item repository interface
 * @description Defines the contract for item persistence operations
 */
import { Item, ItemHistoryEntry } from '../entities/item.entity';
export interface ItemRepository {
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
    update(id: string, item: Partial<Item>): Promise<Item | null>;
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
}
//# sourceMappingURL=item.repository.d.ts.map