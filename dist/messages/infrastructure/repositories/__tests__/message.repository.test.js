"use strict";
/**
 * Tests for Message Repository interfaces and types
 * Testing type definitions and interface contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
describe('Message Repository Types', () => {
    describe('StoredMessage interface', () => {
        it('should create valid stored message with required fields', () => {
            const message = {
                id: 'msg-123',
                timestamp: new Date('2024-01-01T10:00:00Z'),
                type: 'event',
                direction: 'incoming',
                payload: { data: 'test' }
            };
            expect(message.id).toBe('msg-123');
            expect(message.timestamp).toEqual(new Date('2024-01-01T10:00:00Z'));
            expect(message.type).toBe('event');
            expect(message.direction).toBe('incoming');
            expect(message.payload).toEqual({ data: 'test' });
        });
        it('should create stored message with optional fields', () => {
            const message = {
                id: 'msg-456',
                timestamp: new Date(),
                type: 'command',
                namespace: 'auth',
                addon_id: 'addon-789',
                direction: 'outgoing',
                payload: { command: 'login' },
                metadata: {
                    clientId: 'client-123',
                    sessionId: 'session-456',
                    tags: ['important', 'auth']
                }
            };
            expect(message.namespace).toBe('auth');
            expect(message.addon_id).toBe('addon-789');
            expect(message.metadata?.clientId).toBe('client-123');
            expect(message.metadata?.sessionId).toBe('session-456');
            expect(message.metadata?.tags).toEqual(['important', 'auth']);
        });
        it('should handle different direction values', () => {
            const incoming = {
                id: '1',
                timestamp: new Date(),
                type: 'test',
                direction: 'incoming',
                payload: {}
            };
            const outgoing = {
                id: '2',
                timestamp: new Date(),
                type: 'test',
                direction: 'outgoing',
                payload: {}
            };
            expect(incoming.direction).toBe('incoming');
            expect(outgoing.direction).toBe('outgoing');
        });
        it('should handle complex payload types', () => {
            const message = {
                id: 'complex-1',
                timestamp: new Date(),
                type: 'data',
                direction: 'incoming',
                payload: {
                    nested: {
                        deeply: {
                            value: 123
                        }
                    },
                    array: [1, 2, 3],
                    boolean: true,
                    null: null
                }
            };
            expect(message.payload.nested.deeply.value).toBe(123);
            expect(message.payload.array).toHaveLength(3);
            expect(message.payload.boolean).toBe(true);
            expect(message.payload.null).toBeNull();
        });
    });
    describe('MessageQuery interface', () => {
        it('should create empty query', () => {
            const query = {};
            expect(query.since).toBeUndefined();
            expect(query.until).toBeUndefined();
            expect(query.type).toBeUndefined();
        });
        it('should create query with all fields', () => {
            const query = {
                since: new Date('2024-01-01'),
                until: new Date('2024-01-31'),
                type: 'event',
                namespace: 'auth',
                addon_id: 'addon-123',
                limit: 100,
                offset: 50
            };
            expect(query.since).toEqual(new Date('2024-01-01'));
            expect(query.until).toEqual(new Date('2024-01-31'));
            expect(query.type).toBe('event');
            expect(query.namespace).toBe('auth');
            expect(query.addon_id).toBe('addon-123');
            expect(query.limit).toBe(100);
            expect(query.offset).toBe(50);
        });
        it('should create partial queries', () => {
            const typeQuery = { type: 'error' };
            const dateQuery = {
                since: new Date('2024-01-01'),
                until: new Date('2024-01-02')
            };
            const paginationQuery = { limit: 10, offset: 20 };
            expect(typeQuery.type).toBe('error');
            expect(dateQuery.since).toBeDefined();
            expect(dateQuery.until).toBeDefined();
            expect(paginationQuery.limit).toBe(10);
            expect(paginationQuery.offset).toBe(20);
        });
    });
    describe('MessageRepository interface', () => {
        // Create a mock implementation to test the interface
        class MockMessageRepository {
            constructor() {
                this.messages = [];
            }
            async save(message) {
                this.messages.push(message);
                return message;
            }
            async findByQuery(query) {
                let results = [...this.messages];
                if (query.since) {
                    results = results.filter(m => m.timestamp >= query.since);
                }
                if (query.until) {
                    results = results.filter(m => m.timestamp <= query.until);
                }
                if (query.type) {
                    results = results.filter(m => m.type === query.type);
                }
                if (query.namespace) {
                    results = results.filter(m => m.namespace === query.namespace);
                }
                if (query.addon_id) {
                    results = results.filter(m => m.addon_id === query.addon_id);
                }
                if (query.offset) {
                    results = results.slice(query.offset);
                }
                if (query.limit) {
                    results = results.slice(0, query.limit);
                }
                return results;
            }
            async findById(id) {
                return this.messages.find(m => m.id === id) || null;
            }
            async getRecent(limit) {
                return this.messages
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .slice(0, limit);
            }
            async clearOlderThan(date) {
                const before = this.messages.length;
                this.messages = this.messages.filter(m => m.timestamp >= date);
                return before - this.messages.length;
            }
            async count(query) {
                if (!query)
                    return this.messages.length;
                const results = await this.findByQuery(query);
                return results.length;
            }
        }
        let repository;
        beforeEach(() => {
            repository = new MockMessageRepository();
        });
        it('should implement save method', async () => {
            const message = {
                id: 'test-1',
                timestamp: new Date(),
                type: 'test',
                direction: 'incoming',
                payload: { test: true }
            };
            const saved = await repository.save(message);
            expect(saved).toEqual(message);
        });
        it('should implement findByQuery method', async () => {
            const message1 = {
                id: '1',
                timestamp: new Date('2024-01-01'),
                type: 'event',
                namespace: 'auth',
                direction: 'incoming',
                payload: {}
            };
            const message2 = {
                id: '2',
                timestamp: new Date('2024-01-02'),
                type: 'command',
                namespace: 'data',
                direction: 'outgoing',
                payload: {}
            };
            await repository.save(message1);
            await repository.save(message2);
            const results = await repository.findByQuery({ type: 'event' });
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('1');
        });
        it('should implement findById method', async () => {
            const message = {
                id: 'unique-123',
                timestamp: new Date(),
                type: 'test',
                direction: 'incoming',
                payload: {}
            };
            await repository.save(message);
            const found = await repository.findById('unique-123');
            expect(found).toEqual(message);
            const notFound = await repository.findById('not-exists');
            expect(notFound).toBeNull();
        });
        it('should implement getRecent method', async () => {
            const messages = [
                {
                    id: '1',
                    timestamp: new Date('2024-01-01'),
                    type: 'old',
                    direction: 'incoming',
                    payload: {}
                },
                {
                    id: '2',
                    timestamp: new Date('2024-01-03'),
                    type: 'newest',
                    direction: 'incoming',
                    payload: {}
                },
                {
                    id: '3',
                    timestamp: new Date('2024-01-02'),
                    type: 'middle',
                    direction: 'incoming',
                    payload: {}
                }
            ];
            for (const msg of messages) {
                await repository.save(msg);
            }
            const recent = await repository.getRecent(2);
            expect(recent).toHaveLength(2);
            expect(recent[0].id).toBe('2'); // newest
            expect(recent[1].id).toBe('3'); // middle
        });
        it('should implement clearOlderThan method', async () => {
            const messages = [
                {
                    id: '1',
                    timestamp: new Date('2024-01-01'),
                    type: 'old',
                    direction: 'incoming',
                    payload: {}
                },
                {
                    id: '2',
                    timestamp: new Date('2024-01-05'),
                    type: 'new',
                    direction: 'incoming',
                    payload: {}
                }
            ];
            for (const msg of messages) {
                await repository.save(msg);
            }
            const deleted = await repository.clearOlderThan(new Date('2024-01-03'));
            expect(deleted).toBe(1);
            const remaining = await repository.count();
            expect(remaining).toBe(1);
        });
        it('should implement count method', async () => {
            const messages = [
                {
                    id: '1',
                    timestamp: new Date(),
                    type: 'event',
                    namespace: 'auth',
                    direction: 'incoming',
                    payload: {}
                },
                {
                    id: '2',
                    timestamp: new Date(),
                    type: 'event',
                    namespace: 'data',
                    direction: 'outgoing',
                    payload: {}
                },
                {
                    id: '3',
                    timestamp: new Date(),
                    type: 'command',
                    namespace: 'auth',
                    direction: 'incoming',
                    payload: {}
                }
            ];
            for (const msg of messages) {
                await repository.save(msg);
            }
            expect(await repository.count()).toBe(3);
            expect(await repository.count({ type: 'event' })).toBe(2);
            expect(await repository.count({ namespace: 'auth' })).toBe(2);
            expect(await repository.count({ type: 'event', namespace: 'auth' })).toBe(1);
        });
    });
});
//# sourceMappingURL=message.repository.test.js.map