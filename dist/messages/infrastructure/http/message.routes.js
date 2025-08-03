"use strict";
/**
 * Message API routes for popup viewer
 * Provides REST endpoints to query WebSocket message history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRepository = exports.messageRouter = void 0;
exports.captureMessage = captureMessage;
const express_1 = require("express");
const in_memory_message_repository_1 = require("../repositories/in-memory-message.repository");
// Initialize repository
const messageRepository = new in_memory_message_repository_1.InMemoryMessageRepository();
exports.messageRepository = messageRepository;
// Create router
exports.messageRouter = (0, express_1.Router)();
/**
 * GET /messages
 * Get messages with optional filtering
 */
exports.messageRouter.get('/messages', async (req, res, next) => {
    try {
        const { since, until, type, namespace, addon_id, limit = '100', offset = '0' } = req.query;
        const messages = await messageRepository.findByQuery({
            since: since ? new Date(since) : undefined,
            until: until ? new Date(until) : undefined,
            type: type,
            namespace: namespace,
            addon_id: addon_id,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });
        const total = await messageRepository.count({
            since: since ? new Date(since) : undefined,
            until: until ? new Date(until) : undefined,
            type: type,
            namespace: namespace,
            addon_id: addon_id
        });
        res.json({
            messages,
            pagination: {
                total,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10)
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /messages/recent
 * Get recent messages (optimized for popup viewer)
 */
exports.messageRouter.get('/messages/recent', async (req, res, next) => {
    try {
        const { limit = '50' } = req.query;
        const messages = await messageRepository.getRecent(parseInt(limit, 10));
        res.json({
            messages,
            count: messages.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /messages/:id
 * Get a specific message by ID
 */
exports.messageRouter.get('/messages/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const message = await messageRepository.findById(id);
        if (!message) {
            return res.status(404).json({
                error: 'Message not found',
                messageId: id,
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            message,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /messages/namespaces
 * Get available namespaces
 */
exports.messageRouter.get('/messages/namespaces', async (req, res, next) => {
    try {
        const allMessages = await messageRepository.findByQuery({ limit: 1000 });
        const namespaces = new Set();
        allMessages.forEach(msg => {
            if (msg.namespace) {
                namespaces.add(msg.namespace);
            }
        });
        res.json({
            namespaces: Array.from(namespaces).sort(),
            count: namespaces.size,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /messages/addons
 * Get addon IDs that have sent messages
 */
exports.messageRouter.get('/messages/addons', async (req, res, next) => {
    try {
        const allMessages = await messageRepository.findByQuery({ limit: 1000 });
        const addons = new Set();
        allMessages.forEach(msg => {
            if (msg.addon_id) {
                addons.add(msg.addon_id);
            }
        });
        res.json({
            addons: Array.from(addons).sort(),
            count: addons.size,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /messages/old
 * Clean up old messages
 */
exports.messageRouter.delete('/messages/old', async (req, res, next) => {
    try {
        const { before } = req.query;
        if (!before) {
            return res.status(400).json({
                error: 'before parameter is required (ISO date string)',
                timestamp: new Date().toISOString()
            });
        }
        const beforeDate = new Date(before);
        const deletedCount = await messageRepository.clearOlderThan(beforeDate);
        res.json({
            deleted: deletedCount,
            before: beforeDate.toISOString(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Middleware to capture WebSocket messages
 * This should be called by the WebSocket server when messages are sent/received
 */
function captureMessage(message) {
    messageRepository.save({
        ...message,
        id: '',
        timestamp: new Date()
    });
}
//# sourceMappingURL=message.routes.js.map