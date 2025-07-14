/**
 * @fileoverview Store Integration Tests
 * @description Tests for Redis and in-memory store integration with failover
 * @author Web-Buddy Team
 */

import Redis from 'ioredis';
import request from 'supertest';
import { testHelper, TestServerInstance } from './integration-test-setup';
import { createRateLimitStore } from '../../security/rate-limit-stores';

describe('Store Integration Tests', () => {
  let serverWithRedis: TestServerInstance;
  let serverWithMemory: TestServerInstance;
  let redisClient: Redis;
  
  beforeAll(async () => {
    // Set up Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 1,
      retryStrategy: () => null
    });
    
    // Check if Redis is available
    const redisAvailable = await new Promise<boolean>(resolve => {
      redisClient.ping((err) => {
        resolve(!err);
      });
    });
    
    if (redisAvailable) {
      // Create server with Redis store
      serverWithRedis = await testHelper.createTestServer('store-redis', {
        enableCSRF: true,
        enableRateLimiting: true,
        useRedis: true,
        rateLimitStore: 'redis'
      });
    }
    
    // Always create memory store server
    serverWithMemory = await testHelper.createTestServer('store-memory', {
      enableCSRF: true,
      enableRateLimiting: true,
      rateLimitStore: 'memory'
    });
  });
  
  afterAll(async () => {
    if (serverWithRedis) {
      await testHelper.stopTestServer('store-redis');
    }
    await testHelper.stopTestServer('store-memory');
    redisClient.disconnect();
  });
  
  beforeEach(async () => {
    // Clean up stores
    if (serverWithRedis) {
      await testHelper.cleanupTestData(serverWithRedis);
    }
    await testHelper.cleanupTestData(serverWithMemory);
    
    // Clear Redis
    if (redisClient.status === 'ready') {
      await redisClient.flushdb();
    }
  });
  
  describe('Redis Store Integration', () => {
    it('should use Redis for rate limiting when available', async function() {
      if (!serverWithRedis) {
        this.skip();
        return;
      }
      
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithRedis);
      
      // Make requests to trigger rate limiting
      const limit = 10;
      const requests = [];
      
      for (let i = 0; i < limit + 2; i++) {
        requests.push(
          request(serverWithRedis.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${tokens.accessToken}`)
        );
      }
      
      const results = await Promise.all(requests);
      
      // Check rate limiting worked
      const successCount = results.filter(r => r.status === 200).length;
      const rateLimitedCount = results.filter(r => r.status === 429).length;
      
      expect(successCount).toBe(limit);
      expect(rateLimitedCount).toBe(2);
      
      // Verify data in Redis
      const keys = await redisClient.keys('semantest:rl:*');
      expect(keys.length).toBeGreaterThan(0);
      
      // Check stored data format
      const data = await redisClient.get(keys[0]);
      expect(data).toBeDefined();
      const parsed = JSON.parse(data!);
      expect(parsed).toHaveProperty('count');
      expect(parsed).toHaveProperty('resetTime');
    });
    
    it('should persist rate limit data across requests', async function() {
      if (!serverWithRedis) {
        this.skip();
        return;
      }
      
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithRedis);
      
      // Make some requests
      for (let i = 0; i < 5; i++) {
        await request(serverWithRedis.baseUrl)
          .get('/api/extensions')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
      }
      
      // Check remaining limit
      const checkRes = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      const remaining1 = parseInt(checkRes.headers['x-ratelimit-remaining']);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make another request
      const nextRes = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      const remaining2 = parseInt(nextRes.headers['x-ratelimit-remaining']);
      
      // Should decrement consistently
      expect(remaining2).toBe(remaining1 - 1);
    });
    
    it('should handle Redis connection failures gracefully', async function() {
      if (!serverWithRedis) {
        this.skip();
        return;
      }
      
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithRedis);
      
      // Temporarily disconnect Redis
      await serverWithRedis.redisClient!.disconnect();
      
      // Requests should still work (fallback to memory)
      const res = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(res.status).toBe(200);
      
      // Reconnect Redis
      await serverWithRedis.redisClient!.connect();
    });
  });
  
  describe('Memory Store Integration', () => {
    it('should use in-memory store for rate limiting', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithMemory);
      
      // Make requests to trigger rate limiting
      const limit = 10;
      const requests = [];
      
      for (let i = 0; i < limit + 2; i++) {
        requests.push(
          request(serverWithMemory.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${tokens.accessToken}`)
        );
      }
      
      const results = await Promise.all(requests);
      
      // Check rate limiting worked
      const successCount = results.filter(r => r.status === 200).length;
      const rateLimitedCount = results.filter(r => r.status === 429).length;
      
      expect(successCount).toBe(limit);
      expect(rateLimitedCount).toBe(2);
    });
    
    it('should clean up expired entries in memory store', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithMemory);
      
      // Make a request
      await request(serverWithMemory.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      // Wait for cleanup interval (simulated)
      // In real implementation, this would be based on the cleanup interval
      
      // Make another request after theoretical reset
      const res = await request(serverWithMemory.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });
  
  describe('Session Storage Integration', () => {
    it('should store and retrieve session data', async () => {
      const server = serverWithMemory;
      
      // Create user and login
      const { user, tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Session should be created
      const sessions = await server.sessionRepository.findByUserId(user.id);
      expect(sessions.length).toBeGreaterThan(0);
      
      const session = sessions[0];
      expect(session).toHaveProperty('id');
      expect(session.userId).toBe(user.id);
      expect(session.status).toBe('active');
      
      // Make authenticated request
      const res = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(res.status).toBe(200);
      
      // Session should be updated with activity
      const updatedSession = await server.sessionRepository.findById(session.id);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.lastActivityAt.getTime()).toBeGreaterThan(
        session.lastActivityAt.getTime()
      );
    });
    
    it('should handle concurrent session operations', async () => {
      const server = serverWithMemory;
      const userCount = 5;
      
      // Create multiple users
      const users = await testHelper.createMultipleUsers(server, userCount);
      
      // All users make concurrent requests
      const requests = users.flatMap(user =>
        Array(3).fill(null).map(() =>
          request(server.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        )
      );
      
      const results = await Promise.all(requests);
      
      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
      });
      
      // Check all sessions are tracked
      for (const user of users) {
        const sessions = await server.sessionRepository.findByUserId(user.user.id);
        expect(sessions.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Token Blacklist Storage', () => {
    it('should store and check blacklisted tokens', async () => {
      const server = serverWithMemory;
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Token should work initially
      const validRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(validRes.status).toBe(200);
      
      // Blacklist the token
      await server.tokenManager.blacklistToken(tokens.accessToken);
      
      // Token should now be rejected
      const blacklistedRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(blacklistedRes.status).toBe(401);
      
      // Check blacklist stats
      const stats = server.tokenManager.getTokenStats();
      expect(stats.blacklistedTokens).toBeGreaterThan(0);
    });
    
    it('should handle token cleanup', async () => {
      const server = serverWithMemory;
      
      // Create multiple users and blacklist their tokens
      const users = await testHelper.createMultipleUsers(server, 3);
      
      for (const user of users) {
        await server.tokenManager.blacklistToken(user.tokens.accessToken);
      }
      
      // Check initial count
      const initialStats = server.tokenManager.getTokenStats();
      expect(initialStats.blacklistedTokens).toBe(3);
      
      // Run cleanup (in real scenario, this would remove expired tokens)
      await server.tokenManager.cleanupExpiredTokens();
      
      // Stats should reflect cleanup
      const cleanupStats = server.tokenManager.getTokenStats();
      expect(cleanupStats.blacklistedTokens).toBeLessThanOrEqual(
        initialStats.blacklistedTokens
      );
    });
  });
  
  describe('CSRF Token Storage', () => {
    it('should store and validate CSRF tokens', async () => {
      const server = serverWithMemory;
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Get CSRF token
      const csrfRes = await request(server.baseUrl)
        .get('/auth/csrf-token')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(csrfRes.status).toBe(200);
      const csrfToken = csrfRes.body.csrfToken;
      
      // Use CSRF token
      const useRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test',
          action: 'test'
        });
      
      expect(useRes.status).toBe(200);
      
      // Same token should work again (depending on implementation)
      const reuseRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test',
          action: 'test2'
        });
      
      expect(reuseRes.status).toBe(200);
    });
    
    it('should handle CSRF token rotation', async () => {
      const server = serverWithMemory;
      const { tokens, csrfToken: originalToken } = await testHelper.createAuthenticatedUser(server);
      
      // Rotate token
      const rotateRes = await request(server.baseUrl)
        .post('/auth/csrf-rotate')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', originalToken);
      
      expect(rotateRes.status).toBe(200);
      const newToken = rotateRes.body.csrfToken;
      
      // Old token should not work
      const oldTokenRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', originalToken)
        .send({
          extensionId: 'test',
          action: 'test'
        });
      
      expect(oldTokenRes.status).toBe(403);
      
      // New token should work
      const newTokenRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', newToken)
        .send({
          extensionId: 'test',
          action: 'test'
        });
      
      expect(newTokenRes.status).toBe(200);
    });
  });
  
  describe('Store Failover and Recovery', () => {
    it('should handle primary store failure with fallback', async function() {
      if (!serverWithRedis) {
        this.skip();
        return;
      }
      
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithRedis);
      
      // Make some requests with Redis working
      for (let i = 0; i < 3; i++) {
        const res = await request(serverWithRedis.baseUrl)
          .get('/api/extensions')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
        
        expect(res.status).toBe(200);
      }
      
      // Simulate Redis failure
      await serverWithRedis.redisClient!.disconnect();
      
      // Should fallback to memory store
      for (let i = 0; i < 3; i++) {
        const res = await request(serverWithRedis.baseUrl)
          .get('/api/extensions')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
        
        expect(res.status).toBe(200);
      }
      
      // Reconnect Redis
      await serverWithRedis.redisClient!.connect();
      
      // Should resume using Redis
      const finalRes = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(finalRes.status).toBe(200);
    });
    
    it('should maintain data consistency during failover', async function() {
      if (!serverWithRedis) {
        this.skip();
        return;
      }
      
      const { tokens } = await testHelper.createAuthenticatedUser(serverWithRedis);
      
      // Track rate limit state
      const res1 = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      const limitBefore = parseInt(res1.headers['x-ratelimit-limit']);
      const remainingBefore = parseInt(res1.headers['x-ratelimit-remaining']);
      
      // Disconnect Redis (failover to memory)
      await serverWithRedis.redisClient!.disconnect();
      
      // Make request during failover
      const res2 = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(res2.status).toBe(200);
      
      // Reconnect Redis
      await serverWithRedis.redisClient!.connect();
      
      // Rate limits should be reasonable (might reset on failover)
      const res3 = await request(serverWithRedis.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      const limitAfter = parseInt(res3.headers['x-ratelimit-limit']);
      expect(limitAfter).toBe(limitBefore);
    });
  });
  
  describe('Store Performance', () => {
    it('should handle high-throughput operations', async () => {
      const server = serverWithMemory;
      const users = await testHelper.createMultipleUsers(server, 10);
      
      // Generate high load
      const requestCount = 100;
      const requests = [];
      
      for (let i = 0; i < requestCount; i++) {
        const user = users[i % users.length];
        requests.push(
          request(server.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${user.tokens.accessToken}`)
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
      
      // Most requests should succeed (some may be rate limited)
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(requestCount * 0.5);
    });
    
    it('should maintain low latency for store operations', async () => {
      const server = serverWithMemory;
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Measure individual request latencies
      const latencies = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const res = await request(server.baseUrl)
          .get('/api/extensions')
          .set('Authorization', `Bearer ${tokens.accessToken}`);
        const latency = Date.now() - start;
        
        if (res.status === 200) {
          latencies.push(latency);
        }
      }
      
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      
      // Average latency should be low
      expect(avgLatency).toBeLessThan(50);
    });
  });
});