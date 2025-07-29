/**
 * 🧪 Tests for HttpServerAdapter
 * Testing HTTP server functionality and middleware integration
 */

import { HttpServerAdapter } from '../http-server-adapter';
import express from 'express';
import http from 'http';

// Mock dependencies
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn((port, callback) => {
      if (callback) callback();
      return mockServer;
    }),
    set: jest.fn()
  };
  const expressMock = jest.fn(() => mockApp);
  (expressMock as any).json = jest.fn(() => 'json-middleware');
  (expressMock as any).urlencoded = jest.fn(() => 'urlencoded-middleware');
  (expressMock as any).static = jest.fn(() => 'static-middleware');
  (expressMock as any).Router = jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn()
  }));
  return expressMock;
});

const mockServer = {
  close: jest.fn((callback) => callback && callback()),
  on: jest.fn(),
  address: jest.fn(() => ({ port: 3000 }))
};

jest.mock('cors', () => jest.fn(() => 'cors-middleware'));
jest.mock('compression', () => jest.fn(() => 'compression-middleware'));
jest.mock('helmet', () => jest.fn(() => 'helmet-middleware'));
jest.mock('../../../security/infrastructure/middleware/security.middleware', () => ({
  securityHeaders: jest.fn((req, res, next) => next()),
  errorHandler: jest.fn((err, req, res, next) => res.status(500).json({ error: 'Internal Server Error' })),
  notFoundHandler: jest.fn((req, res) => res.status(404).json({ error: 'Not Found' }))
}));
jest.mock('../../../items/infrastructure/http/item.routes', () => ({
  itemRouter: { use: jest.fn() },
  seedTestData: jest.fn(() => Promise.resolve())
}));
jest.mock('../../../messages/infrastructure/http/message.routes', () => ({
  messageRouter: { use: jest.fn() }
}));
jest.mock('../../../queues/infrastructure/http/queue.routes', () => ({
  queueRouter: { use: jest.fn() }
}));
jest.mock('../../../health/infrastructure/http/health.routes', () => ({
  healthRouter: { use: jest.fn() }
}));
jest.mock('../../../monitoring/infrastructure/http/monitoring.routes', () => ({
  monitoringRouter: { use: jest.fn() }
}));

describe('HttpServerAdapter', () => {
  let adapter: HttpServerAdapter;
  let mockApp: any;
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new HttpServerAdapter();
    mockApp = (express as unknown as jest.Mock)();
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe('Server Lifecycle', () => {
    it('should start server on specified port', async () => {
      await adapter.startServer(3000);

      expect(express).toHaveBeenCalled();
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(await adapter.isHealthy()).toBe(true);
      expect(consoleLog).toHaveBeenCalledWith('🌐 Starting HTTP server on port 3000...');
      expect(consoleLog).toHaveBeenCalledWith('✅ HTTP server started on http://localhost:3000');
    });

    it('should prevent starting server multiple times', async () => {
      await adapter.startServer(3000);
      await adapter.startServer(3000);
      
      expect(mockApp.listen).toHaveBeenCalledTimes(1);
      expect(consoleLog).toHaveBeenCalledWith('⚠️ HTTP server is already running');
    });

    it('should stop server gracefully', async () => {
      await adapter.startServer(3000);
      await adapter.stopServer();

      expect(mockServer.close).toHaveBeenCalled();
      expect(await adapter.isHealthy()).toBe(false);
      expect(consoleLog).toHaveBeenCalledWith('🛑 Stopping HTTP server...');
      expect(consoleLog).toHaveBeenCalledWith('✅ HTTP server stopped successfully');
    });

    it('should handle stop when server not running', async () => {
      await adapter.stopServer();
      expect(mockServer.close).not.toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith('⚠️ HTTP server is not running');
    });

    it('should handle server startup errors', async () => {
      const error = new Error('EADDRINUSE: Port already in use');
      mockApp.listen.mockImplementationOnce((port, callback) => {
        if (callback) callback(error);
        return mockServer;
      });

      await expect(adapter.startServer(3000)).rejects.toThrow('EADDRINUSE');
      expect(consoleError).toHaveBeenCalledWith('❌ Failed to start HTTP server:', error);
    });

    it('should handle server close errors', async () => {
      const error = new Error('Close failed');
      mockServer.close.mockImplementationOnce((callback) => {
        if (callback) callback(error);
      });

      await adapter.startServer(3000);
      await expect(adapter.stopServer()).rejects.toThrow('Close failed');
      expect(consoleError).toHaveBeenCalledWith('❌ Failed to stop HTTP server:', error);
    });
  });

  describe('Middleware Setup', () => {
    it('should configure basic middleware', async () => {
      await adapter.startServer(3000);

      expect(express.json).toHaveBeenCalled();
      expect(express.urlencoded).toHaveBeenCalledWith({ extended: true });
      expect(mockApp.use).toHaveBeenCalledWith('json-middleware');
      expect(mockApp.use).toHaveBeenCalledWith('urlencoded-middleware');
    });

    it('should configure security middleware', async () => {
      const cors = require('cors');
      const helmet = require('helmet');
      const compression = require('compression');
      const { securityHeaders } = require('../../../security/infrastructure/middleware/security.middleware');

      await adapter.startServer(3000);

      expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
      expect(mockApp.use).toHaveBeenCalledWith('helmet-middleware');
      expect(mockApp.use).toHaveBeenCalledWith('compression-middleware');
      expect(mockApp.use).toHaveBeenCalledWith(securityHeaders);
    });

    it('should configure static file serving', async () => {
      await adapter.startServer(3000);

      expect(express.static).toHaveBeenCalledWith('public');
      expect(mockApp.use).toHaveBeenCalledWith('static-middleware');
    });

    it('should set trust proxy', async () => {
      await adapter.startServer(3000);

      expect(mockApp.set).toHaveBeenCalledWith('trust proxy', true);
    });
  });

  describe('Route Registration', () => {
    it('should register route with specified method and path', async () => {
      const handler = jest.fn();
      adapter.registerRoute('GET', '/test', handler);

      const routes = adapter.getRegisteredRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        method: 'GET',
        path: '/test',
        handler,
        registeredAt: expect.any(Date)
      });
    });

    it('should register all API routes during setup', async () => {
      const { itemRouter } = require('../../../items/infrastructure/http/item.routes');
      const { messageRouter } = require('../../../messages/infrastructure/http/message.routes');
      const { queueRouter } = require('../../../queues/infrastructure/http/queue.routes');
      const { healthRouter } = require('../../../health/infrastructure/http/health.routes');
      const { monitoringRouter } = require('../../../monitoring/infrastructure/http/monitoring.routes');

      await adapter.startServer(3000);

      expect(mockApp.use).toHaveBeenCalledWith('/api/items', itemRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api/messages', messageRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/api/queues', queueRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/health', healthRouter);
      expect(mockApp.use).toHaveBeenCalledWith('/metrics', monitoringRouter);
    });

    it('should register default routes', async () => {
      await adapter.startServer(3000);

      // Check that registerRoute was called for default endpoints
      const routes = adapter.getRegisteredRoutes();
      const routePaths = routes.map(r => r.path);
      
      expect(routePaths).toContain('/');
      expect(routePaths).toContain('/health');
      expect(routePaths).toContain('/info');
      expect(routePaths).toContain('/api/automation/dispatch');
    });

    it('should register error handlers', async () => {
      const { errorHandler, notFoundHandler } = require('../../../security/infrastructure/middleware/security.middleware');

      await adapter.startServer(3000);

      // Error handlers should be registered
      expect(mockApp.use).toHaveBeenCalledWith(errorHandler);
      
      // 404 handler should be in the registered routes
      const routes = adapter.getRegisteredRoutes();
      expect(routes.some(r => r.path === '*' && r.method === 'ALL')).toBe(true);
    });
  });

  describe('Server Information', () => {
    it('should return server info when running', async () => {
      await adapter.startServer(3000);

      const info = await adapter.getServerInfo();
      expect(info).toMatchObject({
        isRunning: true,
        port: 3000,
        routeCount: expect.any(Number),
        registeredRoutes: expect.any(Array),
        uptime: expect.any(Number),
        environment: 'test'
      });
    });

    it('should return server info when not running', async () => {
      const info = await adapter.getServerInfo();
      expect(info).toMatchObject({
        isRunning: false,
        port: 0,
        routeCount: 0,
        registeredRoutes: [],
        uptime: 0,
        environment: 'test'
      });
    });
  });

  describe('Health Check', () => {
    it('should report healthy when server is running', async () => {
      await adapter.startServer(3000);
      expect(await adapter.isHealthy()).toBe(true);
    });

    it('should report unhealthy when server is not running', async () => {
      expect(await adapter.isHealthy()).toBe(false);
    });

    it('should report unhealthy after server stops', async () => {
      await adapter.startServer(3000);
      await adapter.stopServer();
      expect(await adapter.isHealthy()).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await adapter.startServer(3000);
      await adapter.shutdown();

      expect(mockServer.close).toHaveBeenCalled();
      expect(await adapter.isHealthy()).toBe(false);
    });

    it('should handle shutdown when not running', async () => {
      await adapter.shutdown();
      expect(mockServer.close).not.toHaveBeenCalled();
    });
  });

  describe('Request Handling', () => {
    it('should handle different HTTP methods', async () => {
      await adapter.startServer(3000);
      
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach(method => {
        const handler = jest.fn();
        adapter.registerRoute(method, `/test-${method}`, handler);
      });

      const routes = adapter.getRegisteredRoutes();
      // Should include default routes + test routes
      expect(routes.length).toBeGreaterThanOrEqual(methods.length);
      
      methods.forEach(method => {
        expect(routes.some(r => r.method === method)).toBe(true);
      });
    });

    it('should track route registration time', async () => {
      await adapter.startServer(3000);
      
      const before = Date.now();
      adapter.registerRoute('GET', '/test', jest.fn());
      const after = Date.now();

      const routes = adapter.getRegisteredRoutes();
      const testRoute = routes.find(r => r.path === '/test');
      const registeredAt = testRoute.registeredAt.getTime();
      
      expect(registeredAt).toBeGreaterThanOrEqual(before);
      expect(registeredAt).toBeLessThanOrEqual(after);
    });
  });

  describe('Environment', () => {
    it('should use NODE_ENV for environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const info = await adapter.getServerInfo();
      expect(info.environment).toBe('production');

      process.env.NODE_ENV = originalEnv;
    });

    it('should default to test environment', async () => {
      const info = await adapter.getServerInfo();
      expect(info.environment).toBe('test');
    });
  });

  describe('Test Data Seeding', () => {
    it('should seed test data when SEED_TEST_DATA is true', async () => {
      process.env.SEED_TEST_DATA = 'true';
      const { seedTestData } = require('../../../items/infrastructure/http/item.routes');
      
      await adapter.startServer(3000);
      
      expect(seedTestData).toHaveBeenCalled();
      delete process.env.SEED_TEST_DATA;
    });

    it('should not seed test data by default', async () => {
      const { seedTestData } = require('../../../items/infrastructure/http/item.routes');
      seedTestData.mockClear();
      
      await adapter.startServer(3000);
      
      expect(seedTestData).not.toHaveBeenCalled();
    });

    it('should handle seed data errors', async () => {
      process.env.SEED_TEST_DATA = 'true';
      const { seedTestData } = require('../../../items/infrastructure/http/item.routes');
      const error = new Error('Seed failed');
      seedTestData.mockRejectedValueOnce(error);
      
      await adapter.startServer(3000);
      
      expect(consoleError).toHaveBeenCalledWith('❌ Failed to seed test data:', error);
      delete process.env.SEED_TEST_DATA;
    });
  });
});