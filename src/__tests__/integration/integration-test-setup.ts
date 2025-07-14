/**
 * @fileoverview Integration Test Setup
 * @description Shared infrastructure for integration tests
 * @author Web-Buddy Team
 */

import 'reflect-metadata';
import express, { Express } from 'express';
import { Server } from 'http';
import * as WebSocket from 'ws';
import Redis from 'ioredis';
import request from 'supertest';
import { HttpServerAdapterWithAuth } from '../../server/adapters/http-server-adapter-with-auth';
import { WebSocketServerAdapterWithAuth } from '../../coordination/adapters/websocket-server-adapter-with-auth';
import { TokenManager } from '../../auth/infrastructure/token-manager';
import { AuthService } from '../../auth/application/auth-service';
import { CSRFService } from '../../auth/infrastructure/csrf-service';
import { InMemoryUserRepository } from '../../auth/infrastructure/in-memory-user-repository';
import { InMemorySessionRepository } from '../../auth/infrastructure/in-memory-session-repository';
import { RateLimitMiddleware } from '../../security/rate-limiting-middleware';
import { RateLimitMonitor } from '../../security/monitoring';
import { createRateLimitStore } from '../../security/rate-limit-stores';
import SecurityTestUtils from '../security-test-utils';

/**
 * Test server configuration
 */
export interface TestServerConfig {
  httpPort?: number;
  wsPort?: number;
  useRedis?: boolean;
  redisUrl?: string;
  enableCSRF?: boolean;
  enableRateLimiting?: boolean;
  rateLimitStore?: 'redis' | 'memory';
}

/**
 * Test server instance with all components
 */
export interface TestServerInstance {
  httpServer: HttpServerAdapterWithAuth;
  wsServer: WebSocketServerAdapterWithAuth;
  tokenManager: TokenManager;
  authService: AuthService;
  csrfService: CSRFService;
  userRepository: InMemoryUserRepository;
  sessionRepository: InMemorySessionRepository;
  rateLimitMiddleware?: RateLimitMiddleware;
  rateLimitMonitor?: RateLimitMonitor;
  redisClient?: Redis;
  httpPort: number;
  wsPort: number;
  baseUrl: string;
  wsUrl: string;
}

/**
 * Integration test helper class
 */
export class IntegrationTestHelper {
  private static servers: Map<string, TestServerInstance> = new Map();
  private static defaultPorts = { http: 4000, ws: 4001 };
  
  /**
   * Create and start a test server with full security stack
   */
  static async createTestServer(
    name: string = 'default',
    config: TestServerConfig = {}
  ): Promise<TestServerInstance> {
    const httpPort = config.httpPort || this.defaultPorts.http++;
    const wsPort = config.wsPort || this.defaultPorts.ws++;
    
    // Create HTTP server with auth
    const httpServer = new HttpServerAdapterWithAuth();
    
    // Create WebSocket server with auth
    const wsServer = new WebSocketServerAdapterWithAuth();
    
    // Get auth components from HTTP server
    await httpServer.startServer(httpPort);
    const authComponents = httpServer.getAuthComponents();
    
    // Set token manager for WebSocket server
    wsServer.setTokenManager(authComponents.tokenManager!);
    await wsServer.startServer(wsPort - 1); // WS server adds 1 to port
    
    // Set up Redis if requested
    let redisClient: Redis | undefined;
    if (config.useRedis) {
      redisClient = new Redis(config.redisUrl || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry in tests
      });
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        redisClient!.once('connect', () => resolve());
        redisClient!.once('error', (err) => reject(err));
      });
    }
    
    const instance: TestServerInstance = {
      httpServer,
      wsServer,
      tokenManager: authComponents.tokenManager!,
      authService: authComponents.authService!,
      csrfService: authComponents.csrfService!,
      userRepository: authComponents.userRepository!,
      sessionRepository: authComponents.sessionRepository!,
      rateLimitMiddleware: authComponents.rateLimitMiddleware,
      rateLimitMonitor: authComponents.rateLimitMonitor,
      redisClient,
      httpPort,
      wsPort,
      baseUrl: `http://localhost:${httpPort}`,
      wsUrl: `ws://localhost:${wsPort}/ws`
    };
    
    this.servers.set(name, instance);
    return instance;
  }
  
  /**
   * Stop and clean up a test server
   */
  static async stopTestServer(name: string = 'default'): Promise<void> {
    const server = this.servers.get(name);
    if (!server) return;
    
    // Stop servers
    await server.httpServer.stopServer();
    await server.wsServer.stopServer();
    
    // Clean up Redis
    if (server.redisClient) {
      await server.redisClient.flushall();
      server.redisClient.disconnect();
    }
    
    this.servers.delete(name);
  }
  
  /**
   * Stop all test servers
   */
  static async stopAllServers(): Promise<void> {
    for (const name of this.servers.keys()) {
      await this.stopTestServer(name);
    }
  }
  
  /**
   * Get a test server instance
   */
  static getServer(name: string = 'default'): TestServerInstance | undefined {
    return this.servers.get(name);
  }
  
  /**
   * Create an authenticated test user
   */
  static async createAuthenticatedUser(
    server: TestServerInstance,
    userData: {
      email?: string;
      password?: string;
      roles?: string[];
      extensionId?: string;
    } = {}
  ): Promise<{
    user: any;
    tokens: any;
    csrfToken?: string;
  }> {
    const { email = 'test@example.com', password = 'Test123!@#', roles = ['user'], extensionId } = userData;
    
    // Register user
    const registerRes = await request(server.baseUrl)
      .post('/auth/register')
      .send({ email, password, name: 'Test User' });
    
    expect(registerRes.status).toBe(201);
    
    // Login to get tokens
    const loginRes = await request(server.baseUrl)
      .post('/auth/login')
      .send({ email, password });
    
    expect(loginRes.status).toBe(200);
    
    // Get CSRF token if enabled
    let csrfToken: string | undefined;
    if (server.csrfService) {
      const csrfRes = await request(server.baseUrl)
        .get('/auth/csrf-token')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
      
      expect(csrfRes.status).toBe(200);
      csrfToken = csrfRes.body.csrfToken;
    }
    
    return {
      user: registerRes.body.user,
      tokens: loginRes.body,
      csrfToken
    };
  }
  
  /**
   * Create WebSocket connection with authentication
   */
  static async createAuthenticatedWebSocket(
    server: TestServerInstance,
    token: string
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${server.wsUrl}?token=${token}`);
      
      ws.on('open', () => {
        resolve(ws);
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
      
      ws.on('unexpected-response', (req, res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          reject(new Error(`WebSocket connection failed: ${res.statusCode} - ${body}`));
        });
      });
    });
  }
  
  /**
   * Wait for WebSocket message
   */
  static waitForWSMessage(
    ws: WebSocket,
    messageType?: string,
    timeout: number = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for WebSocket message${messageType ? ` of type ${messageType}` : ''}`));
      }, timeout);
      
      const messageHandler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (!messageType || message.type === messageType) {
            clearTimeout(timer);
            ws.off('message', messageHandler);
            resolve(message);
          }
        } catch (error) {
          // Ignore parse errors
        }
      };
      
      ws.on('message', messageHandler);
    });
  }
  
  /**
   * Make authenticated HTTP request
   */
  static async makeAuthenticatedRequest(
    server: TestServerInstance,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    token: string,
    options: {
      body?: any;
      csrfToken?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<request.Test> {
    const req = request(server.baseUrl)[method](path)
      .set('Authorization', `Bearer ${token}`);
    
    if (options.csrfToken) {
      req.set('X-CSRF-Token', options.csrfToken);
    }
    
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req.set(key, value);
      });
    }
    
    if (options.body) {
      req.send(options.body);
    }
    
    return req;
  }
  
  /**
   * Simulate rate limit exhaustion
   */
  static async exhaustRateLimit(
    server: TestServerInstance,
    identifier: string,
    endpoint: string = '/api/test',
    limit: number = 10
  ): Promise<void> {
    const requests = [];
    
    for (let i = 0; i < limit + 5; i++) {
      requests.push(
        request(server.baseUrl)
          .get(endpoint)
          .set('X-Real-IP', identifier)
      );
    }
    
    await Promise.all(requests);
  }
  
  /**
   * Clean up rate limit data
   */
  static async cleanupRateLimits(server: TestServerInstance): Promise<void> {
    if (server.rateLimitMiddleware) {
      await server.rateLimitMiddleware.cleanup();
    }
    
    if (server.redisClient) {
      const keys = await server.redisClient.keys('semantest:rl:*');
      if (keys.length > 0) {
        await server.redisClient.del(...keys);
      }
    }
  }
  
  /**
   * Wait for condition with timeout
   */
  static async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Timeout waiting for condition');
  }
  
  /**
   * Generate multiple test users
   */
  static async createMultipleUsers(
    server: TestServerInstance,
    count: number
  ): Promise<Array<{
    user: any;
    tokens: any;
    csrfToken?: string;
  }>> {
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const user = await this.createAuthenticatedUser(server, {
        email: `user${i}@example.com`,
        password: `Password${i}!@#`
      });
      users.push(user);
    }
    
    return users;
  }
  
  /**
   * Simulate concurrent requests
   */
  static async makeConcurrentRequests(
    requests: Array<() => Promise<any>>,
    options: {
      maxConcurrent?: number;
      delayBetween?: number;
    } = {}
  ): Promise<any[]> {
    const { maxConcurrent = 10, delayBetween = 0 } = options;
    const results = [];
    
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map(fn => fn()));
      results.push(...batchResults);
      
      if (delayBetween > 0 && i + maxConcurrent < requests.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    }
    
    return results;
  }
  
  /**
   * Clean up test data
   */
  static async cleanupTestData(server: TestServerInstance): Promise<void> {
    // Clear repositories
    server.userRepository['users'].clear();
    server.sessionRepository['sessions'].clear();
    
    // Clear token blacklist
    if (server.tokenManager) {
      await server.tokenManager.cleanupExpiredTokens();
    }
    
    // Clear CSRF tokens
    if (server.csrfService) {
      await server.csrfService.invalidateUserTokens('*');
    }
    
    // Clear rate limits
    await this.cleanupRateLimits(server);
  }
}

// Export helper instance
export const testHelper = IntegrationTestHelper;

// Clean up after all tests
afterAll(async () => {
  await IntegrationTestHelper.stopAllServers();
});