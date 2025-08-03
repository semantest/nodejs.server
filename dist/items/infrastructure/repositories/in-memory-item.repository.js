"use strict";
/**
 * @fileoverview In-memory implementation of ItemRepository
 * @description Provides in-memory storage for items and their history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryItemRepository = void 0;
class InMemoryItemRepository {
    constructor() {
        this.items = new Map();
        this.history = new Map();
    }
    /**
     * Find an item by ID
     */
    async findById(id) {
        const item = this.items.get(id);
        return item || null;
    }
    /**
     * Find all items
     */
    async findAll() {
        return Array.from(this.items.values());
    }
    /**
     * Find items by status
     */
    async findByStatus(status) {
        return Array.from(this.items.values()).filter(item => item.status === status);
    }
    /**
     * Save a new item
     */
    async save(item) {
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
    async update(id, updates) {
        const existingItem = this.items.get(id);
        if (!existingItem) {
            return null;
        }
        const updatedItem = {
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
    async delete(id) {
        const item = this.items.get(id);
        if (!item) {
            return false;
        }
        // Soft delete by changing status
        const updatedItem = {
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
    async getHistory(itemId) {
        const entries = this.history.get(itemId) || [];
        return [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Save history entry
     */
    async saveHistoryEntry(entry) {
        const itemHistory = this.history.get(entry.itemId) || [];
        itemHistory.push(entry);
        this.history.set(entry.itemId, itemHistory);
        return entry;
    }
    /**
     * Get history for multiple items
     */
    async getHistoryBatch(itemIds) {
        const result = new Map();
        for (const itemId of itemIds) {
            const entries = await this.getHistory(itemId);
            result.set(itemId, entries);
        }
        return result;
    }
    /**
     * Get history within a date range
     */
    async getHistoryByDateRange(itemId, startDate, endDate) {
        const entries = await this.getHistory(itemId);
        return entries.filter(entry => {
            const timestamp = entry.timestamp.getTime();
            return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
        });
    }
    /**
     * Get history by action type
     */
    async getHistoryByAction(itemId, action) {
        const entries = await this.getHistory(itemId);
        return entries.filter(entry => entry.action === action);
    }
    /**
     * Clear all data (useful for testing)
     */
    clear() {
        this.items.clear();
        this.history.clear();
    }
    /**
     * Seed with initial data (useful for testing)
     */
    async seed(items, historyEntries) {
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
exports.InMemoryItemRepository = InMemoryItemRepository;
//# sourceMappingURL=in-memory-item.repository.js.map