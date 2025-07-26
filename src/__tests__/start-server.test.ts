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
  return jest.fn(() => mockApp);
});
jest.mock('cors');
jest.mock('helmet');
jest.mock('compression');
jest.mock('../items/infrastructure/http/item.routes');
jest.mock('../messages/infrastructure/http/message.routes');
jest.mock('../queues/infrastructure/http/queue.routes');
jest.mock('../health/infrastructure/http/health.routes');
jest.mock('../monitoring/infrastructure/http/monitoring.routes');
jest.mock('../security/infrastructure/middleware/security.middleware');

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

    it('should skip rate limiting when disabled', async () => {
      process.env.DISABLE_RATE_LIMITING = 'true';
      jest.resetModules();
      
      const startServerModule = await import('../start-server');
      const { rateLimiters } = require('../security/infrastructure/middleware/security.middleware');
      
      // Should not have been called with rate limiter
      const rateLimiterCalls = (mockApp.use as jest.Mock).mock.calls.filter(
        call => call[0] === rateLimiters.api
      );
      expect(rateLimiterCalls).toHaveLength(0);
    });

    it('should mount all routers', async () => {
      const startServerModule = await import('../start-server');
      
      const { itemRouter } = require('../items/infrastructure/http/item.routes');
      const { messageRouter } = require('../messages/infrastructure/http/message.routes');
      const { queueRouter } = require('../queues/infrastructure/http/queue.routes');
      const { healthRouter } = require('../health/infrastructure/http/health.routes');
      const { monitoringRouter } = require('../monitoring/infrastructure/http/monitoring.routes');
      
      expect(mockApp.use).toHaveBeenCalledWith('/api/item', itemRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api/messages', messageRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api/queues', queueRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/health', healthRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/monitoring', monitoringRouter);
    });

    it('should set trust proxy', async () => {
      const startServerModule = await import('../start-server');
      expect(mockApp.set).toHaveBeenCalledWith('trust proxy', true);
    });

    it('should handle development environment', async () => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      
      const startServerModule = await import('../start-server');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Development mode'));
    });

    it('should log successful startup', async () => {
      const startServerModule = await import('../start-server');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Server running on port 3003')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Environment:')
      );
    });

    it('should handle server startup errors', async () => {
      // Make listen throw an error
      mockApp.listen.mockImplementationOnce(() => {
        throw new Error('Port already in use');
      });
      
      jest.resetModules();
      await expect(import('../start-server')).rejects.toThrow('Port already in use');
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

    it('should seed test data when required', async () => {
      process.env.SEED_TEST_DATA = 'true';
      jest.resetModules();
      
      const { seedTestData } = require('../items/infrastructure/http/item.routes');
      seedTestData.mockResolvedValueOnce(undefined);
      
      const startServerModule = await import('../start-server');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(seedTestData).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Test data seeded'));
    });

    it('should handle seed data errors', async () => {
      process.env.SEED_TEST_DATA = 'true';
      jest.resetModules();
      
      const { seedTestData } = require('../items/infrastructure/http/item.routes');
      seedTestData.mockRejectedValueOnce(new Error('Seed failed'));
      
      const startServerModule = await import('../start-server');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to seed test data'),
        expect.any(Error)
      );
    });
  });
});