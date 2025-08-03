"use strict";
/**
 * Health check endpoints for failover support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const queue_routes_1 = require("../../../queues/infrastructure/http/queue.routes");
const message_routes_1 = require("../../../messages/infrastructure/http/message.routes");
exports.healthRouter = (0, express_1.Router)();
/**
 * GET /health
 * Basic health check
 */
exports.healthRouter.get('/health', (req, res) => {
    const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
            server: {
                status: 'pass',
                message: 'Server is running',
                responseTime: 0
            }
        }
    };
    res.json(status);
});
/**
 * GET /health/detailed
 * Comprehensive health check for all components
 */
exports.healthRouter.get('/health/detailed', async (req, res) => {
    const startTime = Date.now();
    const checks = {};
    let overallStatus = 'healthy';
    // Check server
    checks.server = {
        status: 'pass',
        message: 'Server is running',
        responseTime: Date.now() - startTime,
        details: {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: process.memoryUsage()
        }
    };
    // Check queue system
    try {
        const queueStartTime = Date.now();
        const queueStatus = queue_routes_1.queueManager.getStatus();
        const queueResponseTime = Date.now() - queueStartTime;
        const queueHealth = queueStatus.queueSizes.dlq > 50 ? 'fail' :
            queueStatus.queueSizes.dlq > 10 ? 'warn' : 'pass';
        if (queueHealth === 'warn')
            overallStatus = 'degraded';
        if (queueHealth === 'fail')
            overallStatus = 'unhealthy';
        checks.queue = {
            status: queueHealth,
            message: `Queue system operational. DLQ size: ${queueStatus.queueSizes.dlq}`,
            responseTime: queueResponseTime,
            details: {
                metrics: queueStatus,
                healthy: queueHealth === 'pass'
            }
        };
    }
    catch (error) {
        checks.queue = {
            status: 'fail',
            message: 'Queue system error',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
        overallStatus = 'unhealthy';
    }
    // Check message storage
    try {
        const messageStartTime = Date.now();
        const messageCount = await message_routes_1.messageRepository.count();
        const messageResponseTime = Date.now() - messageStartTime;
        checks.messageStore = {
            status: 'pass',
            message: `Message store operational. ${messageCount} messages stored.`,
            responseTime: messageResponseTime,
            details: {
                messageCount,
                healthy: true
            }
        };
    }
    catch (error) {
        checks.messageStore = {
            status: 'fail',
            message: 'Message store error',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
        overallStatus = 'unhealthy';
    }
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const memoryHealth = memoryUsagePercent > 90 ? 'fail' :
        memoryUsagePercent > 70 ? 'warn' : 'pass';
    if (memoryHealth === 'warn' && overallStatus === 'healthy')
        overallStatus = 'degraded';
    if (memoryHealth === 'fail')
        overallStatus = 'unhealthy';
    checks.memory = {
        status: memoryHealth,
        message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        details: memoryUsage
    };
    const result = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks
    };
    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 :
        overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(result);
});
/**
 * GET /health/live
 * Kubernetes liveness probe
 */
exports.healthRouter.get('/health/live', (req, res) => {
    // Simple check that the server is running
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});
/**
 * GET /health/ready
 * Kubernetes readiness probe
 */
exports.healthRouter.get('/health/ready', async (req, res) => {
    try {
        // Check if queue system is ready
        const queueStatus = queue_routes_1.queueManager.getStatus();
        // Check if we can accept new requests
        const ready = queueStatus.queueSizes.processing < 10; // arbitrary threshold
        if (ready) {
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                reason: 'Queue system overloaded',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'not ready',
            reason: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /health/websocket
 * WebSocket server health check
 */
exports.healthRouter.get('/health/websocket', (req, res) => {
    // This would check WebSocket server status
    // For now, return mock data
    res.json({
        status: 'healthy',
        websocketUrl: `ws://localhost:3004`,
        connections: 0, // Would be actual connection count
        timestamp: new Date().toISOString()
    });
});
//# sourceMappingURL=health.routes.js.map