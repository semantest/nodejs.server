"use strict";
/**
 * 🧪 Tests for Item Routes
 * Testing REST API endpoints for item operations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
// First, set up the mocks before any imports
const mockItemService = {
    createItem: jest.fn(),
    getItem: jest.fn(),
    getAllItems: jest.fn(),
    updateItem: jest.fn(),
    changeItemStatus: jest.fn(),
    deleteItem: jest.fn(),
    getItemHistory: jest.fn(),
    getItemHistoryByDateRange: jest.fn(),
    getItemHistoryByAction: jest.fn(),
    getItemsByStatus: jest.fn()
};
// Mock the ItemService constructor
jest.mock('../../../application/services/item.service', () => ({
    ItemService: jest.fn().mockImplementation(() => mockItemService)
}));
// Mock the repository
jest.mock('../../../infrastructure/repositories/in-memory-item.repository');
describe('Item Routes', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        // Set up Express app with routes
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Import routes after mocks are set up - this ensures the mock is used
        const { itemRouter } = require('../item.routes');
        app.use(itemRouter);
        // Add error handler
        app.use((err, req, res, next) => {
            res.status(500).json({ error: err.message });
        });
    });
    afterEach(() => {
        jest.resetModules();
    });
    describe('GET /items', () => {
        it('should return all items', async () => {
            const mockItems = [
                {
                    id: '1',
                    name: 'Item 1',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                },
                {
                    id: '2',
                    name: 'Item 2',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                }
            ];
            mockItemService.getAllItems.mockResolvedValue(mockItems);
            const response = await (0, supertest_1.default)(app)
                .get('/items')
                .expect(200);
            expect(mockItemService.getAllItems).toHaveBeenCalled();
            expect(response.body.items).toHaveLength(2);
            expect(response.body.count).toBe(2);
            expect(response.body).toHaveProperty('timestamp');
            // Check items structure without strict date matching
            response.body.items.forEach((item, index) => {
                expect(item.id).toBe(mockItems[index].id);
                expect(item.name).toBe(mockItems[index].name);
                expect(item.status).toBe(mockItems[index].status);
            });
        });
        it('should handle errors', async () => {
            const error = new Error('Database error');
            mockItemService.getAllItems.mockRejectedValue(error);
            const response = await (0, supertest_1.default)(app)
                .get('/items')
                .expect(500);
            expect(mockItemService.getAllItems).toHaveBeenCalled();
            expect(response.body).toHaveProperty('error', 'Database error');
        });
    });
    describe('GET /items/:item_id', () => {
        it('should return specific item', async () => {
            const mockItem = {
                id: '123',
                name: 'Test Item',
                status: 'active',
                tags: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            };
            mockItemService.getItem.mockResolvedValue(mockItem);
            const response = await (0, supertest_1.default)(app)
                .get('/items/123')
                .expect(200);
            expect(mockItemService.getItem).toHaveBeenCalledWith('123');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body.item.id).toBe(mockItem.id);
            expect(response.body.item.name).toBe(mockItem.name);
            expect(response.body.item.status).toBe(mockItem.status);
        });
        it('should return 404 for non-existent item', async () => {
            mockItemService.getItem.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app)
                .get('/items/non-existent')
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
            expect(response.body).toHaveProperty('itemId', 'non-existent');
        });
        it('should handle errors', async () => {
            const error = new Error('Database error');
            mockItemService.getItem.mockRejectedValue(error);
            const response = await (0, supertest_1.default)(app)
                .get('/items/123')
                .expect(500);
            expect(mockItemService.getItem).toHaveBeenCalledWith('123');
            expect(response.body).toHaveProperty('error', 'Database error');
        });
    });
    describe('POST /items', () => {
        it('should create new item', async () => {
            const newItemData = {
                name: 'New Item',
                description: 'A new test item',
                tags: ['test'],
                metadata: { category: 'test' }
            };
            const createdItem = {
                id: 'new-123',
                ...newItemData,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            };
            mockItemService.createItem.mockResolvedValue(createdItem);
            const response = await (0, supertest_1.default)(app)
                .post('/items')
                .set('x-user-id', 'user-123')
                .send(newItemData)
                .expect(201);
            expect(mockItemService.createItem).toHaveBeenCalledWith(newItemData, 'user-123');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body.item.id).toBe(createdItem.id);
            expect(response.body.item.name).toBe(createdItem.name);
            expect(response.body.item.status).toBe(createdItem.status);
            expect(response.body.item.description).toBe(createdItem.description);
        });
        it('should return 400 if name is missing', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/items')
                .set('x-user-id', 'user-123')
                .send({ description: 'No name' })
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Name is required');
            expect(mockItemService.createItem).not.toHaveBeenCalled();
        });
        it('should handle errors', async () => {
            const error = new Error('Creation failed');
            mockItemService.createItem.mockRejectedValue(error);
            const response = await (0, supertest_1.default)(app)
                .post('/items')
                .set('x-user-id', 'user-123')
                .send({ name: 'New Item' })
                .expect(500);
            expect(response.body).toHaveProperty('error', 'Creation failed');
        });
    });
    describe('PUT /items/:item_id', () => {
        it('should update item', async () => {
            const updateData = {
                name: 'Updated Item',
                description: 'Updated description',
                status: 'inactive',
                tags: ['updated'],
                metadata: { updated: true }
            };
            const updatedItem = {
                id: '123',
                ...updateData,
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 2
            };
            mockItemService.updateItem.mockResolvedValue(updatedItem);
            const response = await (0, supertest_1.default)(app)
                .put('/items/123')
                .set('x-user-id', 'user-456')
                .send(updateData)
                .expect(200);
            expect(mockItemService.updateItem).toHaveBeenCalledWith('123', updateData, 'user-456');
            expect(response.body.item.id).toBe(updatedItem.id);
            expect(response.body.item.name).toBe(updatedItem.name);
            expect(response.body.item.status).toBe(updatedItem.status);
            expect(response.body.item.description).toBe(updatedItem.description);
        });
        it('should return 404 for non-existent item', async () => {
            mockItemService.updateItem.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app)
                .put('/items/non-existent')
                .set('x-user-id', 'user-456')
                .send({ name: 'Updated' })
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
        });
    });
    describe('PATCH /items/:item_id/status', () => {
        it('should change item status', async () => {
            const updatedItem = {
                id: '123',
                name: 'Test Item',
                status: 'archived',
                tags: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 2
            };
            mockItemService.changeItemStatus.mockResolvedValue(updatedItem);
            const response = await (0, supertest_1.default)(app)
                .patch('/items/123/status')
                .set('x-user-id', 'user-789')
                .send({ status: 'archived' })
                .expect(200);
            expect(mockItemService.changeItemStatus).toHaveBeenCalledWith('123', 'archived', 'user-789');
            expect(response.body.item.id).toBe(updatedItem.id);
            expect(response.body.item.name).toBe(updatedItem.name);
            expect(response.body.item.status).toBe(updatedItem.status);
        });
        it('should return 400 for invalid status', async () => {
            const response = await (0, supertest_1.default)(app)
                .patch('/items/123/status')
                .set('x-user-id', 'user-789')
                .send({ status: 'invalid-status' })
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid status. Must be one of: active, inactive, archived');
            expect(mockItemService.changeItemStatus).not.toHaveBeenCalled();
        });
        it('should return 400 for missing status', async () => {
            const response = await (0, supertest_1.default)(app)
                .patch('/items/123/status')
                .set('x-user-id', 'user-789')
                .send({})
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid status. Must be one of: active, inactive, archived');
        });
        it('should return 404 for non-existent item', async () => {
            mockItemService.changeItemStatus.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app)
                .patch('/items/non-existent/status')
                .set('x-user-id', 'user-789')
                .send({ status: 'archived' })
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
        });
    });
    describe('DELETE /items/:item_id', () => {
        it('should delete item', async () => {
            mockItemService.deleteItem.mockResolvedValue(true);
            const response = await (0, supertest_1.default)(app)
                .delete('/items/123')
                .set('x-user-id', 'user-999')
                .expect(200);
            expect(mockItemService.deleteItem).toHaveBeenCalledWith('123', 'user-999');
            expect(response.body).toHaveProperty('message', 'Item deleted successfully');
            expect(response.body).toHaveProperty('itemId', '123');
        });
        it('should return 404 for non-existent item', async () => {
            mockItemService.deleteItem.mockResolvedValue(false);
            const response = await (0, supertest_1.default)(app)
                .delete('/items/non-existent')
                .set('x-user-id', 'user-999')
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
        });
    });
    describe('GET /item/:item_id/history', () => {
        it('should return item history', async () => {
            const mockHistory = {
                itemId: '123',
                currentState: {
                    id: '123',
                    name: 'Test Item',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                },
                history: [
                    {
                        id: 'h1',
                        itemId: '123',
                        action: 'created',
                        timestamp: new Date(),
                        userId: 'user-1'
                    },
                    {
                        id: 'h2',
                        itemId: '123',
                        action: 'updated',
                        timestamp: new Date(),
                        userId: 'user-2'
                    }
                ],
                totalChanges: 2,
                firstChange: new Date(),
                lastChange: new Date()
            };
            mockItemService.getItemHistory.mockResolvedValue(mockHistory);
            const response = await (0, supertest_1.default)(app)
                .get('/item/123/history')
                .expect(200);
            expect(mockItemService.getItemHistory).toHaveBeenCalledWith('123');
            expect(response.body).toHaveProperty('itemId', '123');
            expect(response.body).toHaveProperty('currentState');
            expect(response.body).toHaveProperty('history');
            expect(response.body.history).toHaveLength(2);
        });
        it('should filter history by date range', async () => {
            const mockHistory = {
                itemId: '123',
                currentState: {
                    id: '123',
                    name: 'Test Item',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                },
                history: [{
                        id: 'h1',
                        itemId: '123',
                        action: 'created',
                        timestamp: new Date()
                    }],
                totalChanges: 1,
                firstChange: new Date(),
                lastChange: new Date()
            };
            const filteredHistory = [{
                    id: 'h1',
                    itemId: '123',
                    action: 'created',
                    timestamp: new Date()
                }];
            mockItemService.getItemHistory.mockResolvedValue(mockHistory);
            mockItemService.getItemHistoryByDateRange.mockResolvedValue(filteredHistory);
            const response = await (0, supertest_1.default)(app)
                .get('/item/123/history')
                .query({ start_date: '2024-01-01', end_date: '2024-12-31' })
                .expect(200);
            expect(mockItemService.getItemHistoryByDateRange).toHaveBeenCalledWith('123', new Date('2024-01-01'), new Date('2024-12-31'));
            expect(response.body.history).toHaveLength(1);
            expect(response.body.history[0].id).toBe(filteredHistory[0].id);
            expect(response.body.history[0].action).toBe(filteredHistory[0].action);
        });
        it('should filter history by action', async () => {
            const mockHistory = {
                itemId: '123',
                currentState: {
                    id: '123',
                    name: 'Test Item',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                },
                history: [{
                        id: 'h1',
                        itemId: '123',
                        action: 'updated',
                        timestamp: new Date()
                    }],
                totalChanges: 1,
                firstChange: new Date(),
                lastChange: new Date()
            };
            const filteredHistory = [{
                    id: 'h1',
                    itemId: '123',
                    action: 'updated',
                    timestamp: new Date()
                }];
            mockItemService.getItemHistory.mockResolvedValue(mockHistory);
            mockItemService.getItemHistoryByAction.mockResolvedValue(filteredHistory);
            const response = await (0, supertest_1.default)(app)
                .get('/item/123/history')
                .query({ action: 'updated' })
                .expect(200);
            expect(mockItemService.getItemHistoryByAction).toHaveBeenCalledWith('123', 'updated');
            expect(response.body.history).toHaveLength(1);
            expect(response.body.history[0].id).toBe(filteredHistory[0].id);
            expect(response.body.history[0].action).toBe(filteredHistory[0].action);
        });
        it('should return 404 for non-existent item', async () => {
            mockItemService.getItemHistory.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app)
                .get('/item/non-existent/history')
                .expect(404);
            expect(response.body).toHaveProperty('error', 'Item not found');
        });
    });
    describe('GET /items/status/:status', () => {
        it('should return items by status', async () => {
            const mockItems = [
                {
                    id: '1',
                    name: 'Active Item 1',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                },
                {
                    id: '2',
                    name: 'Active Item 2',
                    status: 'active',
                    tags: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                }
            ];
            mockItemService.getItemsByStatus.mockResolvedValue(mockItems);
            const response = await (0, supertest_1.default)(app)
                .get('/items/status/active')
                .expect(200);
            expect(mockItemService.getItemsByStatus).toHaveBeenCalledWith('active');
            expect(response.body.items).toHaveLength(2);
            expect(response.body.count).toBe(2);
            expect(response.body.status).toBe('active');
            // Check items structure without strict date matching
            response.body.items.forEach((item, index) => {
                expect(item.id).toBe(mockItems[index].id);
                expect(item.name).toBe(mockItems[index].name);
                expect(item.status).toBe(mockItems[index].status);
            });
        });
        it('should return 400 for invalid status', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/items/status/invalid-status')
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid status. Must be one of: active, inactive, archived');
            expect(mockItemService.getItemsByStatus).not.toHaveBeenCalled();
        });
    });
    describe('Error Handling', () => {
        it('should handle unexpected errors', async () => {
            const error = new Error('Unexpected database error');
            mockItemService.getAllItems.mockRejectedValue(error);
            const response = await (0, supertest_1.default)(app)
                .get('/items')
                .expect(500);
            expect(response.body).toHaveProperty('error', 'Unexpected database error');
        });
    });
    describe('User Context', () => {
        it('should use x-user-id header for user context', async () => {
            const createdItem = {
                id: 'new-item',
                name: 'Test Item',
                status: 'active',
                tags: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            };
            mockItemService.createItem.mockResolvedValue(createdItem);
            await (0, supertest_1.default)(app)
                .post('/items')
                .set('x-user-id', 'custom-user-123')
                .send({ name: 'Test Item' })
                .expect(201);
            expect(mockItemService.createItem).toHaveBeenCalledWith({ name: 'Test Item' }, 'custom-user-123');
        });
        it('should handle missing user ID', async () => {
            const createdItem = {
                id: 'new-item',
                name: 'Test Item',
                status: 'active',
                tags: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
                version: 1
            };
            mockItemService.createItem.mockResolvedValue(createdItem);
            await (0, supertest_1.default)(app)
                .post('/items')
                .send({ name: 'Test Item' })
                .expect(201);
            expect(mockItemService.createItem).toHaveBeenCalledWith({ name: 'Test Item' }, undefined);
        });
    });
});
//# sourceMappingURL=item.routes.test.js.map