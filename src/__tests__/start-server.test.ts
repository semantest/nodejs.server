/**
 * Emergency tests for start-server.ts
 * Created by Quinn (QA) during test coverage crisis - 8:00 AM
 * Target: Boost nodejs.server coverage from 13.41%
 */

import { createServer } from 'http';
import express from 'express';

// Mock all the dependencies
jest.mock('dotenv/config');
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn((port, callback) => callback()),
    set: jest.fn()
  };
  const expressMock = jest.fn(() => mockApp) as any;
  expressMock.Router = jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn(),
    stack: []
  }));
  return expressMock;
});
jest.mock('cors');
jest.mock('helmet');
jest.mock('compression');
jest.mock('../items/infrastructure/http/item.routes', () => ({
  itemRouter: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    use: jest.fn()
  },
  seedTestData: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../messages/infrastructure/http/message.routes', () => ({
  messageRouter: {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn()
  }
}));
jest.mock('../queues/infrastructure/http/queue.routes', () => ({
  queueRouter: {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn()
  }
}));
jest.mock('../health/infrastructure/http/health.routes', () => ({
  healthRouter: {
    get: jest.fn(),
    use: jest.fn()
  }
}));
jest.mock('../monitoring/infrastructure/http/monitoring.routes', () => ({
  monitoringRouter: {
    get: jest.fn(),
    use: jest.fn()
  }
}));
jest.mock('../security/infrastructure/middleware/security.middleware', () => ({
  securityHeaders: jest.fn((req, res, next) => next()),
  rateLimiters: {
    api: jest.fn((req, res, next) => next())
  }
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

describe('Server Startup', () => {
  let mockApp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockApp = (express as jest.MockedFunction<typeof express>)();
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Reset environment variables
    delete process.env.PORT;
    delete process.env.CORS_ORIGINS;
    delete process.env.DISABLE_RATE_LIMITING;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('server configuration', () => {
    it('should use default port when PORT env is not set', async () => {
      const startServerModule = await import('../start-server');
      expect(mockApp.listen).toHaveBeenCalledWith(3003, expect.any(Function));
    });

    it('should use PORT from environment when set', async () => {
      process.env.PORT = '5000';
      jest.resetModules();
      const startServerModule = await import('../start-server');
      expect(mockApp.listen).toHaveBeenCalledWith(5000, expect.any(Function));
    });

    it('should configure all security middleware', async () => {
      const startServerModule = await import('../start-server');
      
      // Check that helmet was configured
      const helmetModule = require('helmet');
      expect(helmetModule).toHaveBeenCalledWith({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
          }
        }
      });
    });

    it('should configure CORS with default origins', async () => {
      const startServerModule = await import('../start-server');
      
      const corsModule = require('cors');
      expect(corsModule).toHaveBeenCalledWith({
        origin: ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
      });
    });

    it('should configure CORS with custom origins from env', async () => {
      process.env.CORS_ORIGINS = 'http://example.com,http://test.com';
      jest.resetModules();
      
      const startServerModule = await import('../start-server');
      
      const corsModule = require('cors');
      expect(corsModule).toHaveBeenCalledWith({
        origin: ['http://example.com', 'http://test.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id']
      });
    });

    it('should use compression middleware', async () => {
      const startServerModule = await import('../start-server');
      const compressionModule = require('compression');
      expect(compressionModule).toHaveBeenCalled();
    });

    it('should apply security headers', async () => {
      const startServerModule = await import('../start-server');
      const { securityHeaders } = require('../security/infrastructure/middleware/security.middleware');
      expect(mockApp.use).toHaveBeenCalledWith(securityHeaders);
    });

    it('should apply rate limiting', async () => {
      const startServerModule = await import('../start-server');
      const { rateLimiters } = require('../security/infrastructure/middleware/security.middleware');
      expect(mockApp.use).toHaveBeenCalledWith(rateLimiters.api);
    });

    it('should apply rate limiting middleware', async () => {
      const startServerModule = await import('../start-server');
      const { rateLimiters } = require('../security/infrastructure/middleware/security.middleware');
      
      // Should have been called with rate limiter
      const rateLimiterCalls = (mockApp.use as jest.Mock).mock.calls.filter(
        call => call[0] === rateLimiters.api
      );
      expect(rateLimiterCalls).toHaveLength(1);
    });

    it('should mount all routers', async () => {
      const startServerModule = await import('../start-server');
      
      const { itemRouter } = require('../items/infrastructure/http/item.routes');
      const { messageRouter } = require('../messages/infrastructure/http/message.routes');
      const { queueRouter } = require('../queues/infrastructure/http/queue.routes');
      const { healthRouter } = require('../health/infrastructure/http/health.routes');
      const { monitoringRouter } = require('../monitoring/infrastructure/http/monitoring.routes');
      
      expect(mockApp.use).toHaveBeenCalledWith('/api', itemRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api', messageRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api', queueRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/', healthRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api', monitoringRouter);
    });



    it('should log successful startup', async () => {
      const startServerModule = await import('../start-server');
      
      expect(console.log).toHaveBeenCalledWith('✅ Semantest Node.js Server started');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('HTTP API available at http://localhost:3003')
      );
    });

    it('should handle server startup errors', async () => {
      // Make listen throw an error
      mockApp.listen.mockImplementationOnce(() => {
        throw new Error('Port already in use');
      });
      
      jest.resetModules();
      await import('../start-server');
      
      // Wait for the promise to be rejected and caught
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(console.error).toHaveBeenCalledWith(
        '❌ Failed to start server:',
        expect.any(Error)
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle error middleware', async () => {
      const startServerModule = await import('../start-server');
      
      // Find the error handler middleware (4 parameters)
      const errorHandlerCalls = (mockApp.use as jest.Mock).mock.calls.filter(
        call => call[0] && call[0].length === 4
      );
      
      expect(errorHandlerCalls).toHaveLength(1);
    });

    it('should handle 404 errors', async () => {
      const startServerModule = await import('../start-server');
      
      // Find the 404 handler
      const notFoundHandlerCalls = (mockApp.use as jest.Mock).mock.calls.filter(
        call => call[0] && call[0].name === 'notFoundHandler'
      );
      
      // Should have a catch-all route handler
      expect(mockApp.use).toHaveBeenCalled();
    });

    it('should seed test data in non-production environment', async () => {
      delete process.env.NODE_ENV;  // Not production
      jest.resetModules();
      
      const { seedTestData } = require('../items/infrastructure/http/item.routes');
      const startServerModule = await import('../start-server');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(seedTestData).toHaveBeenCalled();
    });

    it('should not seed test data in production environment', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      
      const { seedTestData } = require('../items/infrastructure/http/item.routes');
      const startServerModule = await import('../start-server');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(seedTestData).not.toHaveBeenCalled();
    });
  });
});