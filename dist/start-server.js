"use strict";
/**
 * @fileoverview Server startup script
 * @description Starts the Semantest Node.js server with item history endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const item_routes_1 = require("./items/infrastructure/http/item.routes");
const message_routes_1 = require("./messages/infrastructure/http/message.routes");
const queue_routes_1 = require("./queues/infrastructure/http/queue.routes");
const health_routes_1 = require("./health/infrastructure/http/health.routes");
const monitoring_routes_1 = require("./monitoring/infrastructure/http/monitoring.routes");
const addon_routes_1 = require("./addons/infrastructure/http/addon.routes");
const addon_dynamic_routes_1 = require("./addons/infrastructure/http/addon-dynamic.routes");
const security_middleware_1 = require("./security/infrastructure/middleware/security.middleware");
const PORT = process.env.PORT || 3003;
async function startServer() {
    const app = (0, express_1.default)();
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"]
            }
        }
    }));
    // CORS configuration
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests from chrome extensions and localhost
            if (!origin || origin.startsWith('chrome-extension://') || origin.includes('localhost')) {
                callback(null, true);
            }
            else {
                callback(null, process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
    }));
    // Compression
    app.use((0, compression_1.default)());
    // Additional security headers
    app.use(security_middleware_1.securityHeaders);
    // Apply general rate limiting to all routes
    app.use(security_middleware_1.rateLimiters.api);
    // Body parsing
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Request logging
    app.use((req, res, next) => {
        const start = Date.now();
        const { method, url } = req;
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`📝 ${method} ${url} - ${res.statusCode} - ${duration}ms`);
        });
        next();
    });
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        });
    });
    // Mount all routes
    app.use('/api', item_routes_1.itemRouter);
    app.use('/api', message_routes_1.messageRouter);
    app.use('/api', queue_routes_1.queueRouter);
    app.use('/api', monitoring_routes_1.monitoringRouter);
    app.use('/api', addon_routes_1.addonRouter);
    app.use('/api', addon_dynamic_routes_1.dynamicAddonRouter); // New dynamic addon endpoints
    app.use('/', health_routes_1.healthRouter);
    console.log('📍 Routes mounted:');
    console.log('   - Item routes at /api');
    console.log('   - Message routes at /api');
    console.log('   - Queue routes at /api');
    console.log('   - Monitoring routes at /api');
    console.log('   - Addon routes at /api');
    console.log('   - Dynamic addon routes at /api');
    console.log('   - Health routes at /');
    // Seed test data in development mode
    if (process.env.NODE_ENV !== 'production') {
        await (0, item_routes_1.seedTestData)();
    }
    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            error: 'Not Found',
            message: `Route ${req.method} ${req.originalUrl} not found`,
            timestamp: new Date().toISOString()
        });
    });
    // Error handler
    app.use((error, req, res, next) => {
        console.error('❌ Server error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    });
    // Start server
    app.listen(PORT, () => {
        console.log('✅ Semantest Node.js Server started');
        console.log(`📡 HTTP API available at http://localhost:${PORT}`);
        console.log(`🔌 Health checks:`);
        console.log(`   - Basic: http://localhost:${PORT}/health`);
        console.log(`   - Detailed: http://localhost:${PORT}/health/detailed`);
        console.log(`   - Liveness: http://localhost:${PORT}/health/live`);
        console.log(`   - Readiness: http://localhost:${PORT}/health/ready`);
        console.log('\n📋 Available Endpoints:');
        console.log('\n🗂️  Item History:');
        console.log(`   GET    /api/items`);
        console.log(`   GET    /api/item/:item_id/history`);
        console.log(`   POST   /api/items`);
        console.log(`   PUT    /api/items/:item_id`);
        console.log(`   DELETE /api/items/:item_id`);
        console.log('\n💬 Message Store:');
        console.log(`   GET    /api/messages`);
        console.log(`   GET    /api/messages/recent`);
        console.log(`   GET    /api/messages/:id`);
        console.log(`   GET    /api/messages/namespaces`);
        console.log(`   GET    /api/messages/addons`);
        console.log('\n📥 Queue System:');
        console.log(`   POST   /api/queue/enqueue`);
        console.log(`   GET    /api/queue/status`);
        console.log(`   GET    /api/queue/item/:id`);
        console.log(`   DELETE /api/queue/item/:id`);
        console.log(`   GET    /api/queue/dlq`);
        console.log(`   POST   /api/queue/dlq/:id/retry`);
        console.log('\n📊 Monitoring & Metrics:');
        console.log(`   GET    /api/metrics`);
        console.log(`   GET    /api/metrics/json`);
        console.log(`   GET    /api/metrics/queue`);
        console.log(`   GET    /api/metrics/system`);
        console.log('\n💡 Test data has been seeded. Server ready for requests!');
    });
}
// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
// Start the server
startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=start-server.js.map