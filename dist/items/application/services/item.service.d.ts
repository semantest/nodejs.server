/**
 * @fileoverview Item service for business logic
 * @description Handles item operations and history tracking
 */
import { Item, ItemHistoryEntry } from '../../domain/entities/item.entity';
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
export declare class ItemService {
    private readonly repository;
    constructor(repository: ItemRepository);
    /**
     * Create a new item
     */
    createItem(dto: CreateItemDto, userId?: string): Promise<Item>;
    /**
     * Get an item by ID
     */
    getItem(itemId: string): Promise<Item | null>;
    /**
     * Get all items
     */
    getAllItems(): Promise<Item[]>;
    /**
     * Update an item
     */
    updateItem(itemId: string, dto: UpdateItemDto, userId?: string): Promise<Item | null>;
    /**
     * Change item status
     */
    changeItemStatus(itemId: string, newStatus: Item['status'], userId?: string): Promise<Item | null>;
    /**
     * Delete an item (soft delete)
     */
    deleteItem(itemId: string, userId?: string): Promise<boolean>;
    /**
     * Get item history
     */
    getItemHistory(itemId: string): Promise<ItemHistoryResponse | null>;
    /**
     * Get item history within date range
     */
    getItemHistoryByDateRange(itemId: string, startDate: Date, endDate: Date): Promise<ItemHistoryEntry[]>;
    /**
     * Get item history by action type
     */
    getItemHistoryByAction(itemId: string, action: ItemHistoryEntry['action']): Promise<ItemHistoryEntry[]>;
    /**
     * Get items by status
     */
    getItemsByStatus(status: Item['status']): Promise<Item[]>;
}
//# sourceMappingURL=item.service.d.ts.map