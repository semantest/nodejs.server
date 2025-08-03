"use strict";
/**
 * In-memory implementation of message repository
 * Stores messages with automatic cleanup of old entries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryMessageRepository = void 0;
const uuid_1 = require("uuid");
class InMemoryMessageRepository {
    constructor() {
        this.messages = new Map();
        this.messagesByTime = [];
        this.maxMessages = 1000; // Keep last 1000 messages
    }
    async save(message) {
        const savedMessage = {
            ...message,
            id: message.id || (0, uuid_1.v4)(),
            timestamp: message.timestamp || new Date()
        };
        this.messages.set(savedMessage.id, savedMessage);
        this.messagesByTime.push(savedMessage);
        // Cleanup old messages if exceeding limit
        if (this.messagesByTime.length > this.maxMessages) {
            const removed = this.messagesByTime.shift();
            if (removed) {
                this.messages.delete(removed.id);
            }
        }
        return savedMessage;
    }
    async findByQuery(query) {
        let results = [...this.messagesByTime];
        // Filter by date range
        if (query.since) {
            results = results.filter(m => m.timestamp >= query.since);
        }
        if (query.until) {
            results = results.filter(m => m.timestamp <= query.until);
        }
        // Filter by type
        if (query.type) {
            results = results.filter(m => m.type === query.type);
        }
        // Filter by namespace
        if (query.namespace) {
            results = results.filter(m => m.namespace === query.namespace);
        }
        // Filter by addon_id
        if (query.addon_id) {
            results = results.filter(m => m.addon_id === query.addon_id);
        }
        // Sort by timestamp descending (newest first)
        results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply pagination
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        return results.slice(offset, offset + limit);
    }
    async findById(id) {
        return this.messages.get(id) || null;
    }
    async getRecent(limit) {
        const startIndex = Math.max(0, this.messagesByTime.length - limit);
        return this.messagesByTime
            .slice(startIndex)
            .reverse(); // Newest first
    }
    async clearOlderThan(date) {
        const before = this.messagesByTime.length;
        this.messagesByTime = this.messagesByTime.filter(m => m.timestamp > date);
        // Rebuild the map
        const newMap = new Map();
        this.messagesByTime.forEach(m => newMap.set(m.id, m));
        this.messages = newMap;
        return before - this.messagesByTime.length;
    }
    async count(query) {
        if (!query) {
            return this.messages.size;
        }
        const results = await this.findByQuery({ ...query, limit: Number.MAX_SAFE_INTEGER });
        return results.length;
    }
    /**
     * Clear all messages (useful for testing)
     */
    clear() {
        this.messages.clear();
        this.messagesByTime = [];
    }
    /**
     * Set maximum message limit
     */
    setMaxMessages(limit) {
        this.maxMessages = limit;
    }
}
exports.InMemoryMessageRepository = InMemoryMessageRepository;
//# sourceMappingURL=in-memory-message.repository.js.map