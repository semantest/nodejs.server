"use strict";
/**
 * @fileoverview Item entity with history tracking capabilities
 * @description Represents an item with full history tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemEntity = void 0;
const uuid_1 = require("uuid");
class ItemEntity {
    constructor(data) {
        this.history = [];
        this.id = data.id || (0, uuid_1.v4)();
        this.name = data.name;
        this.description = data.description;
        this.status = data.status || 'active';
        this.tags = data.tags || [];
        this.metadata = data.metadata || {};
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.version = data.version || 1;
        // Add creation history entry
        this.addHistoryEntry({
            action: 'created',
            newState: this.toJSON()
        });
    }
    /**
     * Update item properties and track changes
     */
    update(updates, userId) {
        const previousState = this.toJSON();
        const changes = {};
        // Track what's changing
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                changes[key] = {
                    from: this[key],
                    to: updates[key]
                };
            }
        });
        // Apply updates
        if (updates.name !== undefined)
            this.name = updates.name;
        if (updates.description !== undefined)
            this.description = updates.description;
        if (updates.status !== undefined)
            this.status = updates.status;
        if (updates.tags !== undefined)
            this.tags = updates.tags;
        if (updates.metadata !== undefined)
            this.metadata = updates.metadata;
        this.updatedAt = new Date();
        this.version += 1;
        // Add history entry
        this.addHistoryEntry({
            action: 'updated',
            changes,
            previousState,
            newState: this.toJSON(),
            userId
        });
    }
    /**
     * Change item status with history tracking
     */
    changeStatus(newStatus, userId) {
        const previousStatus = this.status;
        if (previousStatus === newStatus) {
            return;
        }
        const previousState = this.toJSON();
        this.status = newStatus;
        this.updatedAt = new Date();
        this.version += 1;
        this.addHistoryEntry({
            action: 'status_changed',
            changes: {
                status: { from: previousStatus, to: newStatus }
            },
            previousState,
            newState: this.toJSON(),
            userId,
            metadata: {
                statusTransition: `${previousStatus} -> ${newStatus}`
            }
        });
    }
    /**
     * Mark item as deleted (soft delete)
     */
    delete(userId) {
        const previousState = this.toJSON();
        this.status = 'archived';
        this.updatedAt = new Date();
        this.version += 1;
        this.addHistoryEntry({
            action: 'deleted',
            previousState,
            newState: this.toJSON(),
            userId
        });
    }
    /**
     * Get item history
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Add history entry
     */
    addHistoryEntry(entry) {
        this.history.push({
            id: (0, uuid_1.v4)(),
            itemId: this.id,
            timestamp: new Date(),
            ...entry
        });
    }
    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.status,
            tags: this.tags,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            version: this.version
        };
    }
    /**
     * Create from plain object
     */
    static fromJSON(data, history) {
        const entity = Object.create(ItemEntity.prototype);
        entity.id = data.id;
        entity.name = data.name;
        entity.description = data.description;
        entity.status = data.status;
        entity.tags = data.tags || [];
        entity.metadata = data.metadata || {};
        entity.createdAt = data.createdAt;
        entity.updatedAt = data.updatedAt;
        entity.version = data.version;
        entity.history = history || [];
        return entity;
    }
}
exports.ItemEntity = ItemEntity;
//# sourceMappingURL=item.entity.js.map