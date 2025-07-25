/**
 * @fileoverview Server startup script
 * @description Starts the Semantest Node.js server with item history endpoints
 */

import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { itemRouter, seedTestData } from './items/infrastructure/http/item.routes';
import { messageRouter } from './messages/infrastructure/http/message.routes';
import { queueRouter } from './queues/infrastructure/http/queue.routes';
import { healthRouter } from './health/infrastructure/http/health.routes';
import { monitoringRouter } from './monitoring/infrastructure/http/monitoring.routes';
import { securityHeaders, rateLimiters } from './security/infrastructure/middleware/security.middleware';

const PORT = process.env.PORT || 3003;

async function startServer() {
  const app: Express = express();

  // Security middleware
  app.use(helmet({
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
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
  }));

  // Compression
  app.use(compression());

  // Additional security headers
  app.use(securityHeaders);

  // Apply general rate limiting to all routes
  app.use(rateLimiters.api);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  app.use('/api', itemRouter);
  app.use('/api', messageRouter);
  app.use('/api', queueRouter);
  app.use('/api', monitoringRouter);
  app.use('/', healthRouter);
  
  console.log('📍 Routes mounted:');
  console.log('   - Item routes at /api');
  console.log('   - Message routes at /api');
  console.log('   - Queue routes at /api');
  console.log('   - Monitoring routes at /api');
  console.log('   - Health routes at /');

  // Seed test data in development mode
  if (process.env.NODE_ENV !== 'production') {
    await seedTestData();
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
  app.use((error: Error, req: any, res: any, next: any) => {
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

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});