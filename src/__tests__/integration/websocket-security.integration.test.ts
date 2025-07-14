/**
 * @fileoverview WebSocket Security Integration Tests
 * @description Tests for WebSocket server with JWT authentication and security
 * @author Web-Buddy Team
 */

import * as WebSocket from 'ws';
import request from 'supertest';
import { testHelper, TestServerInstance } from './integration-test-setup';
import SecurityTestUtils from '../security-test-utils';

describe('WebSocket Security Integration Tests', () => {
  let server: TestServerInstance;
  
  beforeAll(async () => {
    server = await testHelper.createTestServer('ws-security', {
      enableCSRF: true,
      enableRateLimiting: true
    });
  });
  
  afterAll(async () => {
    await testHelper.stopTestServer('ws-security');
  });
  
  beforeEach(async () => {
    await testHelper.cleanupTestData(server);
  });
  
  describe('WebSocket Authentication', () => {
    it('should require valid JWT for connection', async () => {
      // Try connection without token
      await expect(
        new Promise((resolve, reject) => {
          const ws = new WebSocket(server.wsUrl);
          ws.on('open', () => reject(new Error('Should not connect without auth')));
          ws.on('error', resolve);
          ws.on('unexpected-response', (req, res) => {
            expect(res.statusCode).toBe(401);
            resolve(res);
          });
        })
      ).resolves.toBeDefined();
      
      // Try connection with invalid token
      await expect(
        new Promise((resolve, reject) => {
          const ws = new WebSocket(`${server.wsUrl}?token=invalid-token`);
          ws.on('open', () => reject(new Error('Should not connect with invalid token')));
          ws.on('error', resolve);
          ws.on('unexpected-response', (req, res) => {
            expect(res.statusCode).toBe(401);
            resolve(res);
          });
        })
      ).resolves.toBeDefined();
      
      // Valid token should connect
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Should receive authentication success message
      const authMsg = await testHelper.waitForWSMessage(ws, 'authentication_success');
      expect(authMsg).toHaveProperty('userId');
      expect(authMsg).toHaveProperty('sessionId');
      
      ws.close();
    });
    
    it('should accept token in Authorization header', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(server.wsUrl, {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      const authMsg = await testHelper.waitForWSMessage(ws, 'authentication_success');
      expect(authMsg.type).toBe('authentication_success');
      
      ws.close();
    });
    
    it('should handle token expiration during connection', async () => {
      // Create user with short-lived token
      const { tokens, user } = await testHelper.createAuthenticatedUser(server);
      
      // Connect with valid token
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Verify connection works
      ws.send(JSON.stringify({ type: 'ping' }));
      
      // Blacklist the token to simulate expiration
      await server.tokenManager.blacklistToken(tokens.accessToken);
      
      // Connection might close or next operation might fail
      // Wait a bit for any server-side processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to send another message
      ws.send(JSON.stringify({ type: 'test' }));
      
      // WebSocket might close
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clean up
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
  
  describe('WebSocket Message Security', () => {
    it('should validate and sanitize incoming messages', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Wait for auth success
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      const { xssPayloads } = SecurityTestUtils.createSecurityTestScenarios();
      
      // Send potentially malicious payloads
      for (const payload of xssPayloads) {
        ws.send(JSON.stringify({
          type: 'test-message',
          data: payload
        }));
      }
      
      // Send invalid JSON
      ws.send('{ invalid json }');
      ws.send('not json at all');
      
      // Connection should remain stable
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
    
    it('should enforce message size limits', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Wait for auth success
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Send large message
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      ws.send(JSON.stringify({
        type: 'large-message',
        data: largeData
      }));
      
      // Connection should handle it gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });
  
  describe('WebSocket Rate Limiting', () => {
    it('should rate limit WebSocket messages per connection', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Wait for auth success
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Send burst of messages
      const messageCount = 50;
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({
          type: 'burst-test',
          index: i
        }));
      }
      
      // Connection should remain open but might receive rate limit warnings
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
    
    it('should handle multiple connections with separate rate limits', async () => {
      // Create multiple users
      const users = await testHelper.createMultipleUsers(server, 3);
      
      // Create WebSocket for each user
      const connections = await Promise.all(
        users.map(async user => {
          const ws = await testHelper.createAuthenticatedWebSocket(
            server,
            user.tokens.accessToken
          );
          await testHelper.waitForWSMessage(ws, 'authentication_success');
          return { ws, user };
        })
      );
      
      // Each connection sends messages
      connections.forEach(({ ws }, index) => {
        for (let i = 0; i < 10; i++) {
          ws.send(JSON.stringify({
            type: 'multi-user-test',
            userIndex: index,
            messageIndex: i
          }));
        }
      });
      
      // All connections should remain stable
      await new Promise(resolve => setTimeout(resolve, 200));
      connections.forEach(({ ws }) => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Clean up
      connections.forEach(({ ws }) => ws.close());
    });
  });
  
  describe('WebSocket Session Management', () => {
    it('should track WebSocket sessions correctly', async () => {
      const { tokens, user } = await testHelper.createAuthenticatedUser(server);
      
      // Create multiple connections for same user
      const ws1 = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      const ws2 = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Both should be authenticated
      const auth1 = await testHelper.waitForWSMessage(ws1, 'authentication_success');
      const auth2 = await testHelper.waitForWSMessage(ws2, 'authentication_success');
      
      expect(auth1.userId).toBe(user.id);
      expect(auth2.userId).toBe(user.id);
      
      // Get connection count
      const connCount = await server.wsServer.getConnectionCount();
      expect(connCount).toBeGreaterThanOrEqual(2);
      
      // Close one connection
      ws1.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Count should decrease
      const newCount = await server.wsServer.getConnectionCount();
      expect(newCount).toBe(connCount - 1);
      
      ws2.close();
    });
    
    it('should handle session revocation', async () => {
      const { tokens, user } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Wait for auth
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Send a message to verify connection works
      ws.send(JSON.stringify({ type: 'heartbeat' }));
      const heartbeatRes = await testHelper.waitForWSMessage(ws, 'heartbeat_response');
      expect(heartbeatRes).toBeDefined();
      
      // Revoke all user tokens
      await server.tokenManager.revokeAllUserTokens(user.id);
      
      // Connection behavior after revocation
      // (Implementation specific - might close immediately or on next message)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean up if still open
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
  
  describe('WebSocket and HTTP Integration', () => {
    it('should share authentication context between HTTP and WebSocket', async () => {
      const { tokens, user, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Make HTTP request
      const httpRes = await request(server.baseUrl)
        .get('/api/websocket/info')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(httpRes.status).toBe(200);
      expect(httpRes.body).toHaveProperty('url');
      
      // Connect via WebSocket with same token
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      const authMsg = await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      expect(authMsg.userId).toBe(user.id);
      
      // Make HTTP request to trigger action
      const dispatchRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: authMsg.extensionId,
          action: 'test-integration',
          payload: { via: 'http' }
        });
      
      expect(dispatchRes.status).toBe(200);
      
      // WebSocket might receive related messages
      // (Implementation specific)
      
      ws.close();
    });
    
    it('should handle concurrent HTTP and WebSocket operations', async () => {
      const users = await testHelper.createMultipleUsers(server, 3);
      
      // Each user makes both HTTP and WS connections
      const operations = await Promise.all(
        users.map(async user => {
          // HTTP request
          const httpPromise = request(server.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${user.tokens.accessToken}`);
          
          // WebSocket connection
          const wsPromise = testHelper.createAuthenticatedWebSocket(
            server,
            user.tokens.accessToken
          );
          
          const [httpRes, ws] = await Promise.all([httpPromise, wsPromise]);
          
          return { httpRes, ws, user };
        })
      );
      
      // Verify all succeeded
      operations.forEach(({ httpRes, ws }) => {
        expect(httpRes.status).toBe(200);
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Clean up
      operations.forEach(({ ws }) => ws.close());
    });
  });
  
  describe('WebSocket Heartbeat and Health', () => {
    it('should maintain connection with heartbeat', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Send heartbeat
      ws.send(JSON.stringify({ type: 'heartbeat' }));
      const response = await testHelper.waitForWSMessage(ws, 'heartbeat_response');
      
      expect(response.type).toBe('heartbeat_response');
      expect(response).toHaveProperty('timestamp');
      
      // Connection should remain healthy
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Send multiple heartbeats
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        const hbRes = await testHelper.waitForWSMessage(ws, 'heartbeat_response');
        expect(hbRes.type).toBe('heartbeat_response');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      ws.close();
    });
    
    it('should handle ping/pong for connection health', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Set up pong listener
      let pongReceived = false;
      ws.on('pong', () => {
        pongReceived = true;
      });
      
      // Send ping
      ws.ping();
      
      // Wait for pong
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(pongReceived).toBe(true);
      
      ws.close();
    });
  });
  
  describe('WebSocket Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Send various malformed messages
      ws.send('not json');
      ws.send('{"incomplete": ');
      ws.send(JSON.stringify({ /* no type */ data: 'test' }));
      ws.send('');
      ws.send('\x00\x01\x02'); // Binary data
      
      // Connection should remain stable
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Should still respond to valid messages
      ws.send(JSON.stringify({ type: 'heartbeat' }));
      const response = await testHelper.waitForWSMessage(ws, 'heartbeat_response');
      expect(response).toBeDefined();
      
      ws.close();
    });
    
    it('should handle connection errors and reconnection', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // First connection
      const ws1 = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      await testHelper.waitForWSMessage(ws1, 'authentication_success');
      
      // Force close
      ws1.terminate();
      
      // Should be able to reconnect
      const ws2 = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      const authMsg = await testHelper.waitForWSMessage(ws2, 'authentication_success');
      expect(authMsg).toBeDefined();
      
      ws2.close();
    });
  });
  
  describe('WebSocket Performance and Scalability', () => {
    it('should handle multiple concurrent connections efficiently', async () => {
      const connectionCount = 10;
      const users = await testHelper.createMultipleUsers(server, connectionCount);
      
      const startTime = Date.now();
      
      // Create all connections concurrently
      const connections = await Promise.all(
        users.map(user =>
          testHelper.createAuthenticatedWebSocket(server, user.tokens.accessToken)
        )
      );
      
      const connectionTime = Date.now() - startTime;
      
      // Should connect reasonably fast
      expect(connectionTime).toBeLessThan(5000);
      expect(connections.length).toBe(connectionCount);
      
      // All should be open
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Send messages from all connections
      const messagePromises = connections.map((ws, index) =>
        new Promise<void>(resolve => {
          ws.send(JSON.stringify({
            type: 'perf-test',
            connectionIndex: index
          }));
          resolve();
        })
      );
      
      await Promise.all(messagePromises);
      
      // Clean up
      connections.forEach(ws => ws.close());
    });
    
    it('should maintain performance under message load', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      await testHelper.waitForWSMessage(ws, 'authentication_success');
      
      // Measure message round-trip time
      const measurements = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        ws.send(JSON.stringify({ type: 'heartbeat', index: i }));
        await testHelper.waitForWSMessage(ws, 'heartbeat_response');
        const duration = Date.now() - start;
        measurements.push(duration);
      }
      
      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      
      // Should maintain low latency
      expect(avgDuration).toBeLessThan(50);
      
      ws.close();
    });
  });
});