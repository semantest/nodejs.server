"use strict";
/**
 * Monitoring and metrics endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringRouter = void 0;
const express_1 = require("express");
const queue_routes_1 = require("../../../queues/infrastructure/http/queue.routes");
const message_routes_1 = require("../../../messages/infrastructure/http/message.routes");
const os_1 = __importDefault(require("os"));
exports.monitoringRouter = (0, express_1.Router)();
/**
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 */
exports.monitoringRouter.get('/metrics', async (req, res) => {
    try {
        const queueStatus = queue_routes_1.queueManager.getStatus();
        const messageCount = await message_routes_1.messageRepository.count();
        // Format as Prometheus metrics
        const metrics = [
            '# HELP nodejs_process_uptime_seconds Process uptime in seconds',
            '# TYPE nodejs_process_uptime_seconds gauge',
            `nodejs_process_uptime_seconds ${process.uptime()}`,
            '',
            '# HELP nodejs_memory_heap_used_bytes Process heap memory usage',
            '# TYPE nodejs_memory_heap_used_bytes gauge',
            `nodejs_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,
            '',
            '# HELP queue_items_total Total items in queues by priority',
            '# TYPE queue_items_total gauge',
            `queue_items_total{priority="high"} ${queueStatus.queueSizes.high}`,
            `queue_items_total{priority="normal"} ${queueStatus.queueSizes.normal}`,
            `queue_items_total{priority="low"} ${queueStatus.queueSizes.low}`,
            `queue_items_total{priority="processing"} ${queueStatus.queueSizes.processing}`,
            `queue_items_total{priority="dlq"} ${queueStatus.queueSizes.dlq}`,
            '',
            '# HELP queue_processed_total Total processed queue items',
            '# TYPE queue_processed_total counter',
            `queue_processed_total ${queueStatus.totalProcessed}`,
            '',
            '# HELP queue_failed_total Total failed queue items',
            '# TYPE queue_failed_total counter',
            `queue_failed_total ${queueStatus.totalFailed}`,
            '',
            '# HELP message_store_size Total messages in store',
            '# TYPE message_store_size gauge',
            `message_store_size ${messageCount}`,
        ].join('\n');
        res.type('text/plain').send(metrics);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
    }
});
/**
 * GET /metrics/json
 * JSON-formatted metrics for custom dashboards
 */
exports.monitoringRouter.get('/metrics/json', async (req, res) => {
    try {
        const queueStatus = queue_routes_1.queueManager.getStatus();
        const messageCount = await message_routes_1.messageRepository.count();
        const memUsage = process.memoryUsage();
        const systemMem = {
            total: os_1.default.totalmem(),
            free: os_1.default.freemem(),
            used: os_1.default.totalmem() - os_1.default.freemem(),
            percentUsed: ((os_1.default.totalmem() - os_1.default.freemem()) / os_1.default.totalmem()) * 100
        };
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: {
                process: process.uptime(),
                system: os_1.default.uptime()
            },
            memory: {
                process: memUsage,
                system: systemMem
            },
            cpu: {
                loadAvg: os_1.default.loadavg(),
                cores: os_1.default.cpus().length
            },
            application: {
                queue: {
                    depth: queueStatus.queueSizes,
                    processingRate: queueStatus.currentRate,
                    errorRate: queueStatus.totalFailed / Math.max(queueStatus.totalProcessed, 1),
                    dlqSize: queueStatus.queueSizes.dlq
                },
                messages: {
                    total: messageCount,
                    rate: 0 // Would need time-series data
                },
                websocket: {
                    connections: 0, // Would get from WebSocket adapter
                    messageRate: 0
                }
            }
        };
        res.json(metrics);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
    }
});
/**
 * GET /metrics/queue
 * Detailed queue metrics
 */
exports.monitoringRouter.get('/metrics/queue', (req, res) => {
    try {
        const status = queue_routes_1.queueManager.getStatus();
        res.json({
            timestamp: new Date().toISOString(),
            queue: {
                sizes: status.queueSizes,
                totals: {
                    enqueued: status.totalEnqueued,
                    processed: status.totalProcessed,
                    failed: status.totalFailed,
                    inDLQ: status.totalInDLQ
                },
                performance: {
                    avgProcessingTime: status.avgProcessingTime,
                    currentRate: status.currentRate
                },
                health: {
                    isHealthy: status.queueSizes.dlq < 50,
                    warnings: [],
                    errors: []
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to collect queue metrics' });
    }
});
/**
 * GET /metrics/system
 * System resource metrics
 */
exports.monitoringRouter.get('/metrics/system', (req, res) => {
    try {
        const cpus = os_1.default.cpus();
        const cpuUsage = cpus.map((cpu, i) => ({
            core: i,
            model: cpu.model,
            speed: cpu.speed,
            times: cpu.times
        }));
        res.json({
            timestamp: new Date().toISOString(),
            hostname: os_1.default.hostname(),
            platform: os_1.default.platform(),
            arch: os_1.default.arch(),
            nodeVersion: process.version,
            uptime: {
                system: os_1.default.uptime(),
                process: process.uptime()
            },
            memory: {
                system: {
                    total: os_1.default.totalmem(),
                    free: os_1.default.freemem(),
                    used: os_1.default.totalmem() - os_1.default.freemem(),
                    percentUsed: ((os_1.default.totalmem() - os_1.default.freemem()) / os_1.default.totalmem()) * 100
                },
                process: process.memoryUsage()
            },
            cpu: {
                cores: cpus.length,
                usage: cpuUsage,
                loadAverage: os_1.default.loadavg()
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to collect system metrics' });
    }
});
//# sourceMappingURL=monitoring.routes.js.map