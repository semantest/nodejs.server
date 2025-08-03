"use strict";
/**
 * @fileoverview Tests for item history endpoint
 * @description Test suite for GET /item/:item_id/history
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const item_entity_1 = require("../domain/entities/item.entity");
const item_service_1 = require("../application/services/item.service");
const in_memory_item_repository_1 = require("../infrastructure/repositories/in-memory-item.repository");
describe('Item History Endpoint', () => {
    let app;
    let testItemId;
    let itemService;
    let itemRepository;
    beforeEach(async () => {
        // Create a new repository instance for each test
        itemRepository = new in_memory_item_repository_1.InMemoryItemRepository();
        itemService = new item_service_1.ItemService(itemRepository);
        // Create Express app with custom route handlers that use our test instances
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Register routes with our test service
        app.get('/api/item/:item_id/history', async (req, res) => {
            try {
                const { item_id } = req.params;
                const { start_date, end_date, action } = req.query;
                // Get full history
                const historyResponse = await itemService.getItemHistory(item_id);
                if (!historyResponse) {
                    return res.status(404).json({
                        error: 'Item not found',
                        itemId: item_id,
                        timestamp: new Date().toISOString()
                    });
                }
                // Apply filters if provided
                let filteredHistory = historyResponse.history;
                // Filter by date range
                if (start_date || end_date) {
                    const startDate = start_date ? new Date(start_date) : new Date(0);
                    const endDate = end_date ? new Date(end_date) : new Date();
                    filteredHistory = await itemService.getItemHistoryByDateRange(item_id, startDate, endDate);
                }
                // Filter by action
                if (action && ['created', 'updated', 'deleted', 'status_changed'].includes(action)) {
                    filteredHistory = await itemService.getItemHistoryByAction(item_id, action);
                }
                res.json({
                    itemId: item_id,
                    currentState: historyResponse.currentState,
                    history: filteredHistory,
                    totalChanges: filteredHistory.length,
                    filters: {
                        startDate: start_date || null,
                        endDate: end_date || null,
                        action: action || null
                    },
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Create test item with some history
        const testItem = new item_entity_1.ItemEntity({
            name: 'Test Item',
            description: 'Initial description',
            tags: ['test']
        });
        testItemId = testItem.id;
        // Save initial item
        await itemRepository.save(testItem.toJSON());
        const initialHistory = testItem.getHistory();
        for (const entry of initialHistory) {
            await itemRepository.saveHistoryEntry(entry);
        }
        // Simulate some updates
        testItem.update({ description: 'Updated description' }, 'user-123');
        await itemRepository.update(testItemId, testItem.toJSON());
        const updateHistory = testItem.getHistory();
        if (updateHistory.length > 1) {
            await itemRepository.saveHistoryEntry(updateHistory[updateHistory.length - 1]);
        }
        // Change status
        testItem.changeStatus('inactive', 'user-456');
        await itemRepository.update(testItemId, testItem.toJSON());
        const statusHistory = testItem.getHistory();
        if (statusHistory.length > 2) {
            await itemRepository.saveHistoryEntry(statusHistory[statusHistory.length - 1]);
        }
    });
    afterEach(() => {
        itemRepository.clear();
    });
    describe('GET /api/item/:item_id/history', () => {
        it('should return item history for valid item ID', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            expect(response.body).toHaveProperty('itemId', testItemId);
            expect(response.body).toHaveProperty('currentState');
            expect(response.body).toHaveProperty('history');
            expect(response.body).toHaveProperty('totalChanges');
            expect(response.body.history).toBeInstanceOf(Array);
            expect(response.body.history.length).toBeGreaterThan(0);
        });
        it('should return 404 for non-existent item', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/item/non-existent-id/history')
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
        });
        it('should return history entries in reverse chronological order', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            const { history } = response.body;
            // Check that history is in reverse chronological order
            for (let i = 1; i < history.length; i++) {
                const current = new Date(history[i].timestamp);
                const previous = new Date(history[i - 1].timestamp);
                expect(previous.getTime()).toBeGreaterThanOrEqual(current.getTime());
            }
        });
        it('should include change details in history entries', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            const { history } = response.body;
            // Find the update entry
            const updateEntry = history.find((h) => h.action === 'updated');
            expect(updateEntry).toBeDefined();
            expect(updateEntry).toHaveProperty('changes');
            expect(updateEntry.changes).toHaveProperty('description');
            expect(updateEntry.changes.description).toEqual({
                from: 'Initial description',
                to: 'Updated description'
            });
        });
        it('should filter history by date range', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .query({
                start_date: yesterday.toISOString(),
                end_date: tomorrow.toISOString()
            })
                .expect(200);
            expect(response.body.history).toBeInstanceOf(Array);
            expect(response.body.filters).toMatchObject({
                startDate: yesterday.toISOString(),
                endDate: tomorrow.toISOString()
            });
        });
        it('should filter history by action type', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .query({ action: 'status_changed' })
                .expect(200);
            expect(response.body.history).toBeInstanceOf(Array);
            expect(response.body.history.length).toBe(1);
            expect(response.body.history[0].action).toBe('status_changed');
            expect(response.body.filters.action).toBe('status_changed');
        });
        it('should handle invalid action filter gracefully', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .query({ action: 'invalid_action' })
                .expect(200);
            // Should return full history when action is invalid
            expect(response.body.history).toBeInstanceOf(Array);
            expect(response.body.history.length).toBeGreaterThan(1);
        });
        it('should include user information in history entries', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            const { history } = response.body;
            // Check user information in entries
            const updateEntry = history.find((h) => h.action === 'updated');
            expect(updateEntry).toHaveProperty('userId', 'user-123');
            const statusEntry = history.find((h) => h.action === 'status_changed');
            expect(statusEntry).toHaveProperty('userId', 'user-456');
        });
        it('should include previous and new state in history entries', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            const { history } = response.body;
            const statusEntry = history.find((h) => h.action === 'status_changed');
            expect(statusEntry).toBeDefined();
            expect(statusEntry.changes).toHaveProperty('status');
            expect(statusEntry.changes.status).toEqual({
                from: 'active',
                to: 'inactive'
            });
        });
    });
    describe('Edge Cases', () => {
        it('should handle item with no history beyond creation', async () => {
            const newItem = new item_entity_1.ItemEntity({
                name: 'New Item',
                description: 'No updates yet'
            });
            await itemRepository.save(newItem.toJSON());
            const history = newItem.getHistory();
            for (const entry of history) {
                await itemRepository.saveHistoryEntry(entry);
            }
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${newItem.id}/history`)
                .expect(200);
            expect(response.body.history.length).toBe(1);
            expect(response.body.history[0].action).toBe('created');
        });
        it('should handle deleted items', async () => {
            // Get the test item
            const item = await itemRepository.findById(testItemId);
            if (item) {
                const entity = item_entity_1.ItemEntity.fromJSON(item);
                entity.delete('user-789');
                await itemRepository.update(testItemId, entity.toJSON());
                const deleteHistory = entity.getHistory();
                if (deleteHistory.length > 0) {
                    await itemRepository.saveHistoryEntry(deleteHistory[deleteHistory.length - 1]);
                }
            }
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .expect(200);
            expect(response.body.currentState.status).toBe('archived');
            // History is in reverse chronological order, so find the deleted action
            const deletedEntry = response.body.history.find((h) => h.action === 'deleted');
            expect(deletedEntry).toBeDefined();
            expect(deletedEntry.action).toBe('deleted');
        });
        it('should handle empty query parameters', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .query({})
                .expect(200);
            expect(response.body.filters).toEqual({
                startDate: null,
                endDate: null,
                action: null
            });
        });
        it('should handle malformed date parameters', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/item/${testItemId}/history`)
                .query({
                start_date: 'invalid-date',
                end_date: 'also-invalid'
            })
                .expect(200);
            // Should still return results, but dates might be parsed as Invalid Date
            expect(response.body).toHaveProperty('history');
            expect(response.body.filters.startDate).toBe('invalid-date');
        });
    });
});
//# sourceMappingURL=item-history.test.js.map