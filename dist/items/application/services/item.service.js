"use strict";
/**
 * @fileoverview Item service for business logic
 * @description Handles item operations and history tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemService = void 0;
const item_entity_1 = require("../../domain/entities/item.entity");
class ItemService {
    constructor(repository) {
        this.repository = repository;
    }
    /**
     * Create a new item
     */
    async createItem(dto, userId) {
        const entity = new item_entity_1.ItemEntity({
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
    async getItem(itemId) {
        return this.repository.findById(itemId);
    }
    /**
     * Get all items
     */
    async getAllItems() {
        return this.repository.findAll();
    }
    /**
     * Update an item
     */
    async updateItem(itemId, dto, userId) {
        const existingItem = await this.repository.findById(itemId);
        if (!existingItem) {
            return null;
        }
        // Load existing history
        const existingHistory = await this.repository.getHistory(itemId);
        const existingHistoryCount = existingHistory.length;
        // Create entity from existing data
        const entity = item_entity_1.ItemEntity.fromJSON(existingItem, existingHistory);
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
    async changeItemStatus(itemId, newStatus, userId) {
        const existingItem = await this.repository.findById(itemId);
        if (!existingItem) {
            return null;
        }
        // Load existing history
        const existingHistory = await this.repository.getHistory(itemId);
        // Create entity from existing data
        const entity = item_entity_1.ItemEntity.fromJSON(existingItem, existingHistory);
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
    async deleteItem(itemId, userId) {
        const existingItem = await this.repository.findById(itemId);
        if (!existingItem) {
            return false;
        }
        // Load existing history
        const existingHistory = await this.repository.getHistory(itemId);
        // Create entity from existing data
        const entity = item_entity_1.ItemEntity.fromJSON(existingItem, existingHistory);
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
    async getItemHistory(itemId) {
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
    async getItemHistoryByDateRange(itemId, startDate, endDate) {
        return this.repository.getHistoryByDateRange(itemId, startDate, endDate);
    }
    /**
     * Get item history by action type
     */
    async getItemHistoryByAction(itemId, action) {
        return this.repository.getHistoryByAction(itemId, action);
    }
    /**
     * Get items by status
     */
    async getItemsByStatus(status) {
        return this.repository.findByStatus(status);
    }
}
exports.ItemService = ItemService;
//# sourceMappingURL=item.service.js.map