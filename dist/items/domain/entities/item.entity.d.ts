/**
 * @fileoverview Item entity with history tracking capabilities
 * @description Represents an item with full history tracking
 */
export interface ItemHistoryEntry {
    id: string;
    itemId: string;
    action: 'created' | 'updated' | 'deleted' | 'status_changed';
    changes?: Record<string, any>;
    previousState?: Partial<Item>;
    newState?: Partial<Item>;
    timestamp: Date;
    userId?: string;
    metadata?: Record<string, any>;
}
export interface Item {
    id: string;
    name: string;
    description?: string;
    status: 'active' | 'inactive' | 'archived';
    tags?: string[];
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export declare class ItemEntity implements Item {
    readonly id: string;
    name: string;
    description?: string;
    status: 'active' | 'inactive' | 'archived';
    tags?: string[];
    metadata?: Record<string, any>;
    readonly createdAt: Date;
    updatedAt: Date;
    version: number;
    private history;
    constructor(data: Partial<Item> & {
        name: string;
    });
    /**
     * Update item properties and track changes
     */
    update(updates: Partial<Omit<Item, 'id' | 'createdAt' | 'version'>>, userId?: string): void;
    /**
     * Change item status with history tracking
     */
    changeStatus(newStatus: Item['status'], userId?: string): void;
    /**
     * Mark item as deleted (soft delete)
     */
    delete(userId?: string): void;
    /**
     * Get item history
     */
    getHistory(): ItemHistoryEntry[];
    /**
     * Add history entry
     */
    private addHistoryEntry;
    /**
     * Convert to plain object
     */
    toJSON(): Item;
    /**
     * Create from plain object
     */
    static fromJSON(data: Item, history?: ItemHistoryEntry[]): ItemEntity;
}
//# sourceMappingURL=item.entity.d.ts.map