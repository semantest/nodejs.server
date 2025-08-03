"use strict";
/**
 * Tests for Item Entity
 * Testing item creation, updates, history tracking, and status changes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const item_entity_1 = require("../item.entity");
const uuid_1 = require("uuid");
// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn()
}));
describe('ItemEntity', () => {
    let mockUuid;
    let uuidCounter;
    beforeEach(() => {
        mockUuid = uuid_1.v4;
        uuidCounter = 0;
        mockUuid.mockImplementation(() => `test-uuid-${++uuidCounter}`);
        jest.clearAllMocks();
    });
    describe('Constructor', () => {
        it('should create item with provided data', () => {
            const data = {
                id: 'item-123',
                name: 'Test Item',
                description: 'Test description',
                status: 'active',
                tags: ['tag1', 'tag2'],
                metadata: { key: 'value' },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                version: 1
            };
            const item = new item_entity_1.ItemEntity(data);
            expect(item.id).toBe('item-123');
            expect(item.name).toBe('Test Item');
            expect(item.description).toBe('Test description');
            expect(item.status).toBe('active');
            expect(item.tags).toEqual(['tag1', 'tag2']);
            expect(item.metadata).toEqual({ key: 'value' });
            expect(item.createdAt).toEqual(data.createdAt);
            expect(item.updatedAt).toEqual(data.updatedAt);
            expect(item.version).toBe(1);
        });
        it('should generate id if not provided', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            expect(item.id).toBe('test-uuid-1');
            expect(mockUuid).toHaveBeenCalledTimes(2); // Once for id, once for history entry
        });
        it('should use default values when not provided', () => {
            const now = new Date('2024-01-15T10:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => now);
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            expect(item.status).toBe('active');
            expect(item.tags).toEqual([]);
            expect(item.metadata).toEqual({});
            expect(item.createdAt).toEqual(now);
            expect(item.updatedAt).toEqual(now);
            expect(item.version).toBe(1);
            jest.restoreAllMocks();
        });
        it('should add creation history entry', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            const history = item.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].action).toBe('created');
            expect(history[0].itemId).toBe(item.id);
            expect(history[0].newState).toEqual(item.toJSON());
            expect(history[0].previousState).toBeUndefined();
            expect(history[0].changes).toBeUndefined();
        });
    });
    describe('update', () => {
        let item;
        beforeEach(() => {
            item = new item_entity_1.ItemEntity({
                name: 'Original Name',
                description: 'Original description',
                status: 'active',
                tags: ['tag1'],
                metadata: { original: true }
            });
            // Reset uuid counter after creation
            uuidCounter = 2;
        });
        it('should update name', () => {
            item.update({ name: 'Updated Name' });
            expect(item.name).toBe('Updated Name');
            expect(item.version).toBe(2);
            expect(item.updatedAt).toBeInstanceOf(Date);
        });
        it('should update description', () => {
            item.update({ description: 'Updated description' });
            expect(item.description).toBe('Updated description');
            expect(item.version).toBe(2);
        });
        it('should update status', () => {
            item.update({ status: 'inactive' });
            expect(item.status).toBe('inactive');
            expect(item.version).toBe(2);
        });
        it('should update tags', () => {
            item.update({ tags: ['tag2', 'tag3'] });
            expect(item.tags).toEqual(['tag2', 'tag3']);
            expect(item.version).toBe(2);
        });
        it('should update metadata', () => {
            item.update({ metadata: { updated: true } });
            expect(item.metadata).toEqual({ updated: true });
            expect(item.version).toBe(2);
        });
        it('should update multiple fields at once', () => {
            const updates = {
                name: 'New Name',
                description: 'New description',
                status: 'inactive',
                tags: ['new-tag'],
                metadata: { new: true }
            };
            item.update(updates);
            expect(item.name).toBe('New Name');
            expect(item.description).toBe('New description');
            expect(item.status).toBe('inactive');
            expect(item.tags).toEqual(['new-tag']);
            expect(item.metadata).toEqual({ new: true });
            expect(item.version).toBe(2);
        });
        it('should track changes in history', () => {
            const previousState = item.toJSON();
            item.update({ name: 'Updated Name', status: 'inactive' }, 'user-123');
            const history = item.getHistory();
            const updateEntry = history[history.length - 1];
            expect(updateEntry.action).toBe('updated');
            expect(updateEntry.itemId).toBe(item.id);
            expect(updateEntry.userId).toBe('user-123');
            expect(updateEntry.previousState).toEqual(previousState);
            expect(updateEntry.newState).toEqual(item.toJSON());
            expect(updateEntry.changes).toEqual({
                name: { from: 'Original Name', to: 'Updated Name' },
                status: { from: 'active', to: 'inactive' }
            });
        });
        it('should handle undefined values correctly', () => {
            const originalName = item.name;
            item.update({ name: undefined });
            expect(item.name).toBe(originalName);
            expect(item.version).toBe(2); // Version still increments
        });
        it('should increment version even for no-op updates', () => {
            const originalVersion = item.version;
            item.update({});
            expect(item.version).toBe(originalVersion + 1);
        });
    });
    describe('changeStatus', () => {
        let item;
        beforeEach(() => {
            item = new item_entity_1.ItemEntity({ name: 'Test Item', status: 'active' });
            uuidCounter = 2;
        });
        it('should change status from active to inactive', () => {
            item.changeStatus('inactive');
            expect(item.status).toBe('inactive');
            expect(item.version).toBe(2);
        });
        it('should change status from active to archived', () => {
            item.changeStatus('archived');
            expect(item.status).toBe('archived');
            expect(item.version).toBe(2);
        });
        it('should not update if status is the same', () => {
            const originalVersion = item.version;
            const originalUpdatedAt = item.updatedAt;
            item.changeStatus('active');
            expect(item.status).toBe('active');
            expect(item.version).toBe(originalVersion);
            expect(item.updatedAt).toBe(originalUpdatedAt);
        });
        it('should track status change in history', () => {
            item.changeStatus('inactive', 'user-456');
            const history = item.getHistory();
            const statusEntry = history[history.length - 1];
            expect(statusEntry.action).toBe('status_changed');
            expect(statusEntry.userId).toBe('user-456');
            expect(statusEntry.changes).toEqual({
                status: { from: 'active', to: 'inactive' }
            });
            expect(statusEntry.metadata).toEqual({
                statusTransition: 'active -> inactive'
            });
        });
        it('should handle all status transitions', () => {
            // active -> inactive
            item.changeStatus('inactive');
            expect(item.status).toBe('inactive');
            // inactive -> archived
            item.changeStatus('archived');
            expect(item.status).toBe('archived');
            // Create new item to test other transitions
            const item2 = new item_entity_1.ItemEntity({ name: 'Test Item 2', status: 'inactive' });
            // inactive -> active
            item2.changeStatus('active');
            expect(item2.status).toBe('active');
        });
    });
    describe('delete', () => {
        let item;
        beforeEach(() => {
            item = new item_entity_1.ItemEntity({ name: 'Test Item', status: 'active' });
            uuidCounter = 2;
        });
        it('should soft delete by setting status to archived', () => {
            item.delete();
            expect(item.status).toBe('archived');
            expect(item.version).toBe(2);
        });
        it('should track deletion in history', () => {
            const previousState = item.toJSON();
            item.delete('user-789');
            const history = item.getHistory();
            const deleteEntry = history[history.length - 1];
            expect(deleteEntry.action).toBe('deleted');
            expect(deleteEntry.userId).toBe('user-789');
            expect(deleteEntry.previousState).toEqual(previousState);
            expect(deleteEntry.newState?.status).toBe('archived');
        });
        it('should work even if already archived', () => {
            item.status = 'archived';
            const originalVersion = item.version;
            item.delete();
            expect(item.status).toBe('archived');
            expect(item.version).toBe(originalVersion + 1);
        });
    });
    describe('getHistory', () => {
        it('should return copy of history array', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            const history1 = item.getHistory();
            const history2 = item.getHistory();
            expect(history1).not.toBe(history2); // Different array references
            expect(history1).toEqual(history2); // Same content
        });
        it('should track all operations in order', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            item.update({ name: 'Updated Name' });
            item.changeStatus('inactive');
            item.delete();
            const history = item.getHistory();
            expect(history).toHaveLength(4);
            expect(history[0].action).toBe('created');
            expect(history[1].action).toBe('updated');
            expect(history[2].action).toBe('status_changed');
            expect(history[3].action).toBe('deleted');
        });
        it('should maintain chronological order', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            // Perform several operations
            item.update({ description: 'Description 1' });
            item.update({ description: 'Description 2' });
            item.changeStatus('inactive');
            const history = item.getHistory();
            // Check timestamps are in order
            for (let i = 1; i < history.length; i++) {
                expect(history[i].timestamp.getTime()).toBeGreaterThanOrEqual(history[i - 1].timestamp.getTime());
            }
        });
    });
    describe('toJSON', () => {
        it('should return plain object representation', () => {
            const item = new item_entity_1.ItemEntity({
                id: 'item-123',
                name: 'Test Item',
                description: 'Test description',
                status: 'active',
                tags: ['tag1', 'tag2'],
                metadata: { key: 'value' },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                version: 1
            });
            const json = item.toJSON();
            expect(json).toEqual({
                id: 'item-123',
                name: 'Test Item',
                description: 'Test description',
                status: 'active',
                tags: ['tag1', 'tag2'],
                metadata: { key: 'value' },
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                version: 1
            });
            // Verify it's a plain object, not an ItemEntity instance
            expect(json).not.toBeInstanceOf(item_entity_1.ItemEntity);
        });
        it('should not include history in JSON representation', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            item.update({ name: 'Updated' });
            const json = item.toJSON();
            expect(json).not.toHaveProperty('history');
            expect(Object.keys(json)).toEqual([
                'id', 'name', 'description', 'status', 'tags',
                'metadata', 'createdAt', 'updatedAt', 'version'
            ]);
        });
    });
    describe('fromJSON', () => {
        it('should create entity from plain object', () => {
            const data = {
                id: 'item-123',
                name: 'Test Item',
                description: 'Test description',
                status: 'active',
                tags: ['tag1', 'tag2'],
                metadata: { key: 'value' },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                version: 5
            };
            const item = item_entity_1.ItemEntity.fromJSON(data);
            expect(item).toBeInstanceOf(item_entity_1.ItemEntity);
            expect(item.id).toBe('item-123');
            expect(item.name).toBe('Test Item');
            expect(item.version).toBe(5);
            expect(item.toJSON()).toEqual(data);
        });
        it('should restore history if provided', () => {
            const data = {
                id: 'item-123',
                name: 'Test Item',
                status: 'active',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                version: 2
            };
            const history = [
                {
                    id: 'history-1',
                    itemId: 'item-123',
                    action: 'created',
                    timestamp: new Date('2024-01-01'),
                    newState: data
                },
                {
                    id: 'history-2',
                    itemId: 'item-123',
                    action: 'updated',
                    timestamp: new Date('2024-01-02'),
                    changes: { name: { from: 'Old', to: 'Test Item' } }
                }
            ];
            const item = item_entity_1.ItemEntity.fromJSON(data, history);
            // The fromJSON method replaces the history array entirely
            expect(item.getHistory()).toHaveLength(2);
            const restoredHistory = item.getHistory();
            // History should match what was provided
            expect(restoredHistory[0]).toEqual(history[0]);
            expect(restoredHistory[1]).toEqual(history[1]);
        });
    });
    describe('History Entry Details', () => {
        it('should include all required fields in history entries', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            const history = item.getHistory()[0];
            expect(history).toHaveProperty('id');
            expect(history).toHaveProperty('itemId');
            expect(history).toHaveProperty('action');
            expect(history).toHaveProperty('timestamp');
            expect(history.id).toBe('test-uuid-2');
            expect(history.itemId).toBe(item.id);
            expect(history.timestamp).toBeInstanceOf(Date);
        });
        it('should generate unique ids for history entries', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test Item' });
            item.update({ name: 'Update 1' });
            item.update({ name: 'Update 2' });
            item.changeStatus('inactive');
            const history = item.getHistory();
            const historyIds = history.map(h => h.id);
            const uniqueIds = new Set(historyIds);
            expect(uniqueIds.size).toBe(historyIds.length);
        });
    });
    describe('Edge Cases', () => {
        it('should handle empty string name', () => {
            const item = new item_entity_1.ItemEntity({ name: '' });
            expect(item.name).toBe('');
        });
        it('should handle very long names', () => {
            const longName = 'a'.repeat(1000);
            const item = new item_entity_1.ItemEntity({ name: longName });
            expect(item.name).toBe(longName);
        });
        it('should handle complex metadata', () => {
            const complexMetadata = {
                nested: {
                    deeply: {
                        nested: {
                            value: 123
                        }
                    }
                },
                array: [1, 2, 3],
                boolean: true,
                null: null
            };
            const item = new item_entity_1.ItemEntity({
                name: 'Test',
                metadata: complexMetadata
            });
            expect(item.metadata).toEqual(complexMetadata);
        });
        it('should handle rapid successive updates', () => {
            const item = new item_entity_1.ItemEntity({ name: 'Test' });
            for (let i = 0; i < 10; i++) {
                item.update({ name: `Update ${i}` });
            }
            expect(item.name).toBe('Update 9');
            expect(item.version).toBe(11); // 1 initial + 10 updates
            expect(item.getHistory()).toHaveLength(11); // 1 creation + 10 updates
        });
    });
});
//# sourceMappingURL=item.entity.test.js.map