/**
 * @fileoverview Item entity with history tracking capabilities
 * @description Represents an item with full history tracking
 */

import { v4 as uuidv4 } from 'uuid';

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

export class ItemEntity implements Item {
  public readonly id: string;
  public name: string;
  public description?: string;
  public status: 'active' | 'inactive' | 'archived';
  public tags?: string[];
  public metadata?: Record<string, any>;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public version: number;
  
  private history: ItemHistoryEntry[] = [];

  constructor(data: Partial<Item> & { name: string }) {
    this.id = data.id || uuidv4();
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
  public update(updates: Partial<Omit<Item, 'id' | 'createdAt' | 'version'>>, userId?: string): void {
    const previousState = this.toJSON();
    const changes: Record<string, any> = {};

    // Track what's changing
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof typeof updates] !== undefined) {
        changes[key] = {
          from: (this as any)[key],
          to: updates[key as keyof typeof updates]
        };
      }
    });

    // Apply updates
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.status !== undefined) this.status = updates.status;
    if (updates.tags !== undefined) this.tags = updates.tags;
    if (updates.metadata !== undefined) this.metadata = updates.metadata;

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
  public changeStatus(newStatus: Item['status'], userId?: string): void {
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
  public delete(userId?: string): void {
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
  public getHistory(): ItemHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Add history entry
   */
  private addHistoryEntry(entry: Omit<ItemHistoryEntry, 'id' | 'itemId' | 'timestamp'>): void {
    this.history.push({
      id: uuidv4(),
      itemId: this.id,
      timestamp: new Date(),
      ...entry
    });
  }

  /**
   * Convert to plain object
   */
  public toJSON(): Item {
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
  public static fromJSON(data: Item, history?: ItemHistoryEntry[]): ItemEntity {
    const entity = new ItemEntity(data);
    if (history) {
      entity.history = history;
    }
    return entity;
  }
}