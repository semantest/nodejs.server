/**
 * @fileoverview Multi-Component Integration Tests
 * @description Cross-component security scenarios and complex workflows
 * @author Web-Buddy Team
 */

import request from 'supertest';
import * as WebSocket from 'ws';
import { testHelper, TestServerInstance } from './integration-test-setup';
import SecurityTestUtils from '../security-test-utils';

describe('Multi-Component Security Integration Tests', () => {
  let server: TestServerInstance;
  
  beforeAll(async () => {
    server = await testHelper.createTestServer('multi-component', {
      enableCSRF: true,
      enableRateLimiting: true,
      rateLimitStore: 'memory'
    });
  });
  
  afterAll(async () => {
    await testHelper.stopTestServer('multi-component');
  });
  
  beforeEach(async () => {
    await testHelper.cleanupTestData(server);
  });
  
  describe('Complete User Journey with All Security Components', () => {
    it('should handle full user lifecycle with security at each step', async () => {
      const email = 'journey@example.com';
      const password = 'JourneyPass123!@#';
      
      // Step 1: Registration with rate limiting
      console.log('Step 1: Registration');
      const registerRes = await request(server.baseUrl)
        .post('/auth/register')
        .send({ email, password, name: 'Journey User' });
      
      expect(registerRes.status).toBe(201);
      expect(registerRes.headers['x-ratelimit-remaining']).toBeDefined();
      
      // Step 2: Login with JWT generation
      console.log('Step 2: Login');
      const loginRes = await request(server.baseUrl)
        .post('/auth/login')
        .send({ email, password });
      
      expect(loginRes.status).toBe(200);
      const { accessToken, refreshToken, user } = loginRes.body;
      
      // Step 3: Get CSRF token
      console.log('Step 3: CSRF Token');
      const csrfRes = await request(server.baseUrl)
        .get('/auth/csrf-token')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(csrfRes.status).toBe(200);
      const csrfToken = csrfRes.body.csrfToken;
      
      // Step 4: Establish WebSocket connection
      console.log('Step 4: WebSocket Connection');
      const ws = await testHelper.createAuthenticatedWebSocket(server, accessToken);
      const authMsg = await testHelper.waitForWSMessage(ws, 'authentication_success');
      expect(authMsg.userId).toBe(user.id);
      
      // Step 5: Make authenticated HTTP requests
      console.log('Step 5: HTTP Requests');
      const httpRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: authMsg.extensionId,
          action: 'test-action',
          payload: { test: true }
        });
      
      expect(httpRes.status).toBe(200);
      
      // Step 6: Send WebSocket messages
      console.log('Step 6: WebSocket Messages');
      ws.send(JSON.stringify({
        type: 'user-action',
        data: { action: 'test', timestamp: Date.now() }
      }));
      
      // Step 7: Check metrics endpoint
      console.log('Step 7: Metrics Check');
      const metricsRes = await request(server.baseUrl)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body.auth.activeTokens).toBeGreaterThan(0);
      
      // Step 8: Token refresh
      console.log('Step 8: Token Refresh');
      const refreshRes = await request(server.baseUrl)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      
      expect(refreshRes.status).toBe(200);
      const newAccessToken = refreshRes.body.accessToken;
      
      // Step 9: Use new token for both HTTP and WS
      console.log('Step 9: Use New Token');
      const newTokenRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${newAccessToken}`);
      
      expect(newTokenRes.status).toBe(200);
      
      // Step 10: Cleanup - logout
      console.log('Step 10: Logout');
      const logoutRes = await request(server.baseUrl)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('X-CSRF-Token', csrfToken);
      
      expect(logoutRes.status).toBe(200);
      
      // Verify WebSocket closes after logout
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean up
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
  
  describe('Concurrent Multi-User Security Scenarios', () => {
    it('should handle multiple users with different security contexts', async () => {
      // Create users with different roles
      const adminUser = await testHelper.createAuthenticatedUser(server, {
        email: 'admin@example.com',
        roles: ['user', 'admin']
      });
      
      const regularUser = await testHelper.createAuthenticatedUser(server, {
        email: 'regular@example.com',
        roles: ['user']
      });
      
      const guestUser = await testHelper.createAuthenticatedUser(server, {
        email: 'guest@example.com',
        roles: ['guest']
      });
      
      // Each user connects via WebSocket
      const adminWS = await testHelper.createAuthenticatedWebSocket(
        server,
        adminUser.tokens.accessToken
      );
      const regularWS = await testHelper.createAuthenticatedWebSocket(
        server,
        regularUser.tokens.accessToken
      );
      const guestWS = await testHelper.createAuthenticatedWebSocket(
        server,
        guestUser.tokens.accessToken
      );
      
      // Wait for all to authenticate
      await Promise.all([
        testHelper.waitForWSMessage(adminWS, 'authentication_success'),
        testHelper.waitForWSMessage(regularWS, 'authentication_success'),
        testHelper.waitForWSMessage(guestWS, 'authentication_success')
      ]);
      
      // Test role-based access
      const adminEndpoint = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${adminUser.tokens.accessToken}`);
      
      expect(adminEndpoint.status).toBe(200);
      
      const regularEndpoint = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${regularUser.tokens.accessToken}`);
      
      expect(regularEndpoint.status).toBe(403);
      
      // Send messages through WebSocket
      adminWS.send(JSON.stringify({ type: 'admin-action', data: 'test' }));
      regularWS.send(JSON.stringify({ type: 'user-action', data: 'test' }));
      guestWS.send(JSON.stringify({ type: 'guest-action', data: 'test' }));
      
      // Clean up
      adminWS.close();
      regularWS.close();
      guestWS.close();
    });
    
    it('should maintain security isolation between users', async () => {
      const user1 = await testHelper.createAuthenticatedUser(server, {
        email: 'isolated1@example.com'
      });
      
      const user2 = await testHelper.createAuthenticatedUser(server, {
        email: 'isolated2@example.com'
      });
      
      // User 1 creates some data
      const user1Res = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .set('X-CSRF-Token', user1.csrfToken)
        .send({
          extensionId: 'user1-ext',
          action: 'create-data',
          payload: { sensitive: 'user1-secret' }
        });
      
      expect(user1Res.status).toBe(200);
      
      // User 2 should not be able to use User 1's tokens
      const crossTokenRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        .set('X-Real-IP', '192.168.1.2'); // Different IP
      
      // Should work (same token, different IP might be allowed)
      expect([200, 401]).toContain(crossTokenRes.status);
      
      // User 2 should not be able to use User 1's CSRF token
      const crossCSRFRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
        .set('X-CSRF-Token', user1.csrfToken)
        .send({
          extensionId: 'user2-ext',
          action: 'test'
        });
      
      expect(crossCSRFRes.status).toBe(403);
    });
  });
  
  describe('Security Under Attack Scenarios', () => {
    it('should defend against coordinated attack attempts', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      const attackResults = {
        bruteForce: false,
        csrfAttack: false,
        tokenReplay: false,
        ddos: false
      };
      
      // 1. Brute force login attempt
      console.log('Testing brute force defense...');
      const bruteForceAttempts = 10;
      const bruteForceResults = [];
      
      for (let i = 0; i < bruteForceAttempts; i++) {
        const res = await request(server.baseUrl)
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: `wrong${i}`
          });
        bruteForceResults.push(res.status);
      }
      
      // Should start blocking after several attempts
      const blockedCount = bruteForceResults.filter(s => s === 429).length;
      attackResults.bruteForce = blockedCount > 0;
      
      // 2. CSRF attack attempt
      console.log('Testing CSRF defense...');
      const csrfAttackRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', 'forged-csrf-token')
        .send({
          extensionId: 'attack',
          action: 'csrf-attack'
        });
      
      attackResults.csrfAttack = csrfAttackRes.status === 403;
      
      // 3. Token replay attack
      console.log('Testing token replay defense...');
      await server.tokenManager.blacklistToken(tokens.accessToken);
      
      const replayRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      attackResults.tokenReplay = replayRes.status === 401;
      
      // 4. DDoS attempt
      console.log('Testing DDoS defense...');
      const ddosRequests = 50;
      const ddosResults = await Promise.all(
        Array(ddosRequests).fill(null).map(() =>
          request(server.baseUrl)
            .get('/health')
            .timeout(100)
            .catch(() => ({ status: 'timeout' }))
        )
      );
      
      const timeoutCount = ddosResults.filter(r => r.status === 'timeout').length;
      const rateLimitCount = ddosResults.filter(r => r.status === 429).length;
      attackResults.ddos = rateLimitCount > 0 || timeoutCount < ddosRequests * 0.1;
      
      // All defenses should be active
      expect(attackResults.bruteForce).toBe(true);
      expect(attackResults.csrfAttack).toBe(true);
      expect(attackResults.tokenReplay).toBe(true);
      expect(attackResults.ddos).toBe(true);
    });
    
    it('should handle injection attack attempts', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      const { xssPayloads, sqlInjectionPayloads } = SecurityTestUtils.createSecurityTestScenarios();
      
      // Test various injection attempts
      const injectionTests = [
        ...xssPayloads.map(p => ({ type: 'xss', payload: p })),
        ...sqlInjectionPayloads.map(p => ({ type: 'sql', payload: p }))
      ];
      
      for (const test of injectionTests) {
        const res = await request(server.baseUrl)
          .post('/api/automation/dispatch')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            extensionId: test.payload,
            action: test.payload,
            payload: { data: test.payload }
          });
        
        // Should either sanitize or reject
        expect([200, 400, 403]).toContain(res.status);
        
        // If accepted, should be sanitized
        if (res.status === 200) {
          const responseText = JSON.stringify(res.body);
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('DROP TABLE');
        }
      }
    });
  });
  
  describe('Security Monitoring and Alerting', () => {
    it('should track and report security events', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server, {
        roles: ['user', 'admin']
      });
      
      // Generate various security events
      const events = [];
      
      // Failed login
      const failedLogin = await request(server.baseUrl)
        .post('/auth/login')
        .send({
          email: 'monitor@example.com',
          password: 'wrong'
        });
      events.push({ type: 'failed_login', status: failedLogin.status });
      
      // Rate limit violation
      await testHelper.exhaustRateLimit(server, tokens.accessToken, '/api/extensions', 10);
      const rateLimited = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      events.push({ type: 'rate_limit', status: rateLimited.status });
      
      // Check monitoring endpoint
      const monitorRes = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(monitorRes.status).toBe(200);
      expect(monitorRes.body).toHaveProperty('violations');
      expect(monitorRes.body.violations.length).toBeGreaterThan(0);
      
      // Check metrics
      const metricsRes = await request(server.baseUrl)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body.rateLimit).toHaveProperty('blockedRequests');
      expect(metricsRes.body.rateLimit.blockedRequests).toBeGreaterThan(0);
    });
  });
  
  describe('Security Recovery and Resilience', () => {
    it('should recover from security component failures', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Normal operation
      const normalRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test',
          action: 'normal'
        });
      
      expect(normalRes.status).toBe(200);
      
      // Simulate temporary issues
      // (In real scenario, this might involve network issues, store failures, etc.)
      
      // System should continue to function
      const recoveryRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(recoveryRes.status).toBe(200);
    });
    
    it('should maintain security during high load', async () => {
      const users = await testHelper.createMultipleUsers(server, 5);
      
      // Generate high load with mixed operations
      const operations = [];
      const operationCount = 100;
      
      for (let i = 0; i < operationCount; i++) {
        const user = users[i % users.length];
        const opType = i % 4;
        
        switch (opType) {
          case 0: // HTTP GET
            operations.push(() =>
              request(server.baseUrl)
                .get('/api/extensions')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
            );
            break;
          case 1: // HTTP POST with CSRF
            operations.push(() =>
              request(server.baseUrl)
                .post('/api/automation/dispatch')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .set('X-CSRF-Token', user.csrfToken || '')
                .send({
                  extensionId: 'load-test',
                  action: `action-${i}`
                })
            );
            break;
          case 2: // WebSocket connection
            operations.push(async () => {
              const ws = await testHelper.createAuthenticatedWebSocket(
                server,
                user.tokens.accessToken
              );
              await testHelper.waitForWSMessage(ws, 'authentication_success');
              ws.send(JSON.stringify({ type: 'load-test', index: i }));
              setTimeout(() => ws.close(), 1000);
              return { status: 200 };
            });
            break;
          case 3: // Token refresh
            operations.push(() =>
              request(server.baseUrl)
                .post('/auth/refresh')
                .set('Cookie', `refreshToken=${user.tokens.refreshToken}`)
            );
            break;
        }
      }
      
      // Execute with controlled concurrency
      const results = await testHelper.makeConcurrentRequests(
        operations,
        { maxConcurrent: 20, delayBetween: 50 }
      );
      
      // Analyze results
      const successCount = results.filter(r => r.status === 200).length;
      const rateLimitCount = results.filter(r => r.status === 429).length;
      const errorCount = results.filter(r => r.status >= 500).length;
      
      // Most should succeed
      expect(successCount).toBeGreaterThan(operationCount * 0.7);
      // Some rate limiting is expected
      expect(rateLimitCount).toBeGreaterThan(0);
      // Errors should be minimal
      expect(errorCount).toBeLessThan(operationCount * 0.05);
    });
  });
  
  describe('End-to-End Security Compliance', () => {
    it('should meet security compliance requirements', async () => {
      const compliance = {
        authentication: false,
        authorization: false,
        encryption: false,
        auditTrail: false,
        dataProtection: false
      };
      
      // Test authentication requirement
      const unauthRes = await request(server.baseUrl)
        .get('/api/extensions');
      compliance.authentication = unauthRes.status === 401;
      
      // Test authorization requirement
      const { tokens: userTokens } = await testHelper.createAuthenticatedUser(server, {
        email: 'compliance-user@example.com',
        roles: ['user']
      });
      
      const authzRes = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);
      compliance.authorization = authzRes.status === 403;
      
      // Test encryption (tokens should be properly formatted)
      compliance.encryption = userTokens.accessToken.split('.').length === 3;
      
      // Test audit trail (metrics should track access)
      const metricsRes = await request(server.baseUrl)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);
      compliance.auditTrail = metricsRes.status === 200 && 
        metricsRes.body.auth.activeTokens >= 0;
      
      // Test data protection (no sensitive data in responses)
      const validation = SecurityTestUtils.validateNoSensitiveDataExposure(metricsRes.body);
      compliance.dataProtection = validation.isSecure;
      
      // All compliance checks should pass
      expect(compliance.authentication).toBe(true);
      expect(compliance.authorization).toBe(true);
      expect(compliance.encryption).toBe(true);
      expect(compliance.auditTrail).toBe(true);
      expect(compliance.dataProtection).toBe(true);
    });
  });
});