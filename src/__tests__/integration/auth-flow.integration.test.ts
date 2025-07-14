/**
 * @fileoverview Authentication Flow Integration Tests
 * @description Complete authentication workflow testing with security integration
 * @author Web-Buddy Team
 */

import request from 'supertest';
import { testHelper, TestServerInstance } from './integration-test-setup';
import SecurityTestUtils from '../security-test-utils';

describe('Authentication Flow Integration Tests', () => {
  let server: TestServerInstance;
  
  beforeAll(async () => {
    server = await testHelper.createTestServer('auth-flow', {
      enableCSRF: true,
      enableRateLimiting: true,
      rateLimitStore: 'memory'
    });
  });
  
  afterAll(async () => {
    await testHelper.stopTestServer('auth-flow');
  });
  
  beforeEach(async () => {
    await testHelper.cleanupTestData(server);
  });
  
  describe('Complete Registration → Login → Access → Logout Flow', () => {
    it('should complete full authentication lifecycle with security checks', async () => {
      const email = 'lifecycle@example.com';
      const password = 'SecurePass123!@#';
      
      // Step 1: Registration
      console.log('Step 1: User Registration');
      const registerRes = await request(server.baseUrl)
        .post('/auth/register')
        .send({ email, password, name: 'Test User' });
      
      expect(registerRes.status).toBe(201);
      expect(registerRes.body).toHaveProperty('user');
      expect(registerRes.body.user.email).toBe(email);
      expect(registerRes.body.user).not.toHaveProperty('password');
      
      // Verify rate limit headers on registration
      expect(registerRes.headers).toHaveProperty('x-ratelimit-limit');
      expect(registerRes.headers).toHaveProperty('x-ratelimit-remaining');
      
      // Step 2: Login
      console.log('Step 2: User Login');
      const loginRes = await request(server.baseUrl)
        .post('/auth/login')
        .send({ email, password });
      
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body).toHaveProperty('refreshToken');
      expect(loginRes.body).toHaveProperty('user');
      expect(loginRes.body.accessToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
      
      // Check refresh token cookie
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.startsWith('refreshToken='))).toBe(true);
      
      const { accessToken, refreshToken } = loginRes.body;
      
      // Step 3: Get CSRF Token
      console.log('Step 3: Get CSRF Token');
      const csrfRes = await request(server.baseUrl)
        .get('/auth/csrf-token')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(csrfRes.status).toBe(200);
      expect(csrfRes.body).toHaveProperty('csrfToken');
      expect(csrfRes.body.csrfToken).toMatch(/^[a-f0-9]+\.\d+\.[a-f0-9]+$/);
      
      const { csrfToken } = csrfRes.body;
      
      // Step 4: Access Protected Resource
      console.log('Step 4: Access Protected Resource');
      const protectedRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-extension',
          action: 'test-action',
          payload: { test: true }
        });
      
      expect(protectedRes.status).toBe(200);
      expect(protectedRes.body).toHaveProperty('requestId');
      expect(protectedRes.body.status).toBe('accepted');
      
      // Step 5: Refresh Access Token
      console.log('Step 5: Refresh Access Token');
      const refreshRes = await request(server.baseUrl)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body.accessToken).not.toBe(accessToken); // New token
      
      const newAccessToken = refreshRes.body.accessToken;
      
      // Step 6: Rotate CSRF Token
      console.log('Step 6: Rotate CSRF Token');
      const rotateRes = await request(server.baseUrl)
        .post('/auth/csrf-rotate')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('X-CSRF-Token', csrfToken);
      
      expect(rotateRes.status).toBe(200);
      expect(rotateRes.body).toHaveProperty('csrfToken');
      expect(rotateRes.body.csrfToken).not.toBe(csrfToken); // New token
      
      // Step 7: Logout
      console.log('Step 7: User Logout');
      const logoutRes = await request(server.baseUrl)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('X-CSRF-Token', rotateRes.body.csrfToken);
      
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      
      // Step 8: Verify Access Denied After Logout
      console.log('Step 8: Verify Access Denied');
      const deniedRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${newAccessToken}`);
      
      expect(deniedRes.status).toBe(401);
    });
    
    it('should handle failed login attempts with account lockout', async () => {
      const email = 'lockout@example.com';
      const password = 'CorrectPass123!@#';
      const wrongPassword = 'WrongPass123!@#';
      
      // Register user
      await request(server.baseUrl)
        .post('/auth/register')
        .send({ email, password, name: 'Lockout Test' });
      
      // Make multiple failed login attempts
      const maxAttempts = 5;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await request(server.baseUrl)
          .post('/auth/login')
          .send({ email, password: wrongPassword });
        
        expect(res.status).toBe(401);
        
        if (i < maxAttempts - 1) {
          expect(res.body.attemptsRemaining).toBe(maxAttempts - i - 1);
        }
      }
      
      // Next attempt should result in account lock
      const lockedRes = await request(server.baseUrl)
        .post('/auth/login')
        .send({ email, password });
      
      expect(lockedRes.status).toBe(423); // Locked
      expect(lockedRes.body.error).toContain('locked');
      
      // Verify correct password also fails during lockout
      const stillLockedRes = await request(server.baseUrl)
        .post('/auth/login')
        .send({ email, password });
      
      expect(stillLockedRes.status).toBe(423);
    });
  });
  
  describe('Multi-User Concurrent Authentication', () => {
    it('should handle multiple users authenticating simultaneously', async () => {
      const userCount = 10;
      const users = Array.from({ length: userCount }, (_, i) => ({
        email: `concurrent${i}@example.com`,
        password: `Pass${i}!@#`,
        name: `User ${i}`
      }));
      
      // Register all users concurrently
      const registerPromises = users.map(user =>
        request(server.baseUrl)
          .post('/auth/register')
          .send(user)
      );
      
      const registerResults = await Promise.all(registerPromises);
      registerResults.forEach(res => {
        expect(res.status).toBe(201);
      });
      
      // Login all users concurrently
      const loginPromises = users.map(user =>
        request(server.baseUrl)
          .post('/auth/login')
          .send({ email: user.email, password: user.password })
      );
      
      const loginResults = await Promise.all(loginPromises);
      const tokens = loginResults.map(res => {
        expect(res.status).toBe(200);
        return res.body.accessToken;
      });
      
      // All users access protected endpoints concurrently
      const accessPromises = tokens.map(token =>
        request(server.baseUrl)
          .get('/api/metrics')
          .set('Authorization', `Bearer ${token}`)
      );
      
      const accessResults = await Promise.all(accessPromises);
      accessResults.forEach(res => {
        expect(res.status).toBe(200);
      });
      
      // Verify token statistics
      const stats = server.tokenManager.getTokenStats();
      expect(stats.activeRefreshTokens).toBe(userCount);
    });
  });
  
  describe('Session Management and Security', () => {
    it('should track and manage user sessions correctly', async () => {
      const email = 'session@example.com';
      const password = 'SessionPass123!@#';
      
      // Register and login from multiple devices
      await request(server.baseUrl)
        .post('/auth/register')
        .send({ email, password, name: 'Session User' });
      
      // Login from device 1
      const device1Res = await request(server.baseUrl)
        .post('/auth/login')
        .set('User-Agent', 'Device1/1.0')
        .send({ email, password });
      
      const device1Token = device1Res.body.accessToken;
      const device1SessionId = device1Res.body.user.sessionId;
      
      // Login from device 2
      const device2Res = await request(server.baseUrl)
        .post('/auth/login')
        .set('User-Agent', 'Device2/1.0')
        .send({ email, password });
      
      const device2Token = device2Res.body.accessToken;
      const device2SessionId = device2Res.body.user.sessionId;
      
      expect(device1SessionId).not.toBe(device2SessionId);
      
      // Both devices can access resources
      const access1 = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${device1Token}`);
      
      const access2 = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${device2Token}`);
      
      expect(access1.status).toBe(200);
      expect(access2.status).toBe(200);
      
      // Revoke all sessions for user
      await server.tokenManager.revokeAllUserTokens(device1Res.body.user.id);
      
      // Both devices should now be denied access
      const denied1 = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${device1Token}`);
      
      const denied2 = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${device2Token}`);
      
      expect(denied1.status).toBe(401);
      expect(denied2.status).toBe(401);
    });
    
    it('should handle session expiration and cleanup', async () => {
      const email = 'expiry@example.com';
      const password = 'ExpiryPass123!@#';
      
      // Register and login
      await request(server.baseUrl)
        .post('/auth/register')
        .send({ email, password, name: 'Expiry User' });
      
      const loginRes = await request(server.baseUrl)
        .post('/auth/login')
        .send({ email, password });
      
      const { accessToken, user } = loginRes.body;
      
      // Access should work initially
      const initialAccess = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(initialAccess.status).toBe(200);
      
      // Manually expire the session
      const session = await server.sessionRepository.findById(user.sessionId);
      if (session) {
        session.expiresAt = new Date(Date.now() - 1000);
        await server.sessionRepository.update(session);
      }
      
      // Access should now fail
      const expiredAccess = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(expiredAccess.status).toBe(401);
    });
  });
  
  describe('Authentication Error Scenarios', () => {
    it('should handle registration errors properly', async () => {
      // Invalid email
      const invalidEmailRes = await request(server.baseUrl)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!@#',
          name: 'Test User'
        });
      
      expect(invalidEmailRes.status).toBe(400);
      expect(invalidEmailRes.body.error).toContain('email');
      
      // Weak password
      const weakPasswordRes = await request(server.baseUrl)
        .post('/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          name: 'Test User'
        });
      
      expect(weakPasswordRes.status).toBe(400);
      expect(weakPasswordRes.body.error).toContain('password');
      
      // Duplicate email
      const email = 'duplicate@example.com';
      await request(server.baseUrl)
        .post('/auth/register')
        .send({
          email,
          password: 'ValidPass123!@#',
          name: 'First User'
        });
      
      const duplicateRes = await request(server.baseUrl)
        .post('/auth/register')
        .send({
          email,
          password: 'ValidPass123!@#',
          name: 'Second User'
        });
      
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toContain('exists');
    });
    
    it('should handle token manipulation attempts', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Tampered token
      const tamperedToken = tokens.accessToken.slice(0, -5) + 'XXXXX';
      const tamperedRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tamperedToken}`);
      
      expect(tamperedRes.status).toBe(401);
      
      // Expired token (mock)
      const expiredPayload = SecurityTestUtils.generateTestJWTPayload({
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });
      
      // Invalid signature token
      const invalidToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0In0.invalid';
      const invalidRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(invalidRes.status).toBe(401);
    });
  });
  
  describe('Cross-Component Security Integration', () => {
    it('should enforce security across HTTP and WebSocket connections', async () => {
      const { user, tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // HTTP access should work
      const httpRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(httpRes.status).toBe(200);
      
      // WebSocket connection should work with same token
      const ws = await testHelper.createAuthenticatedWebSocket(server, tokens.accessToken);
      
      // Wait for authentication success message
      const authMessage = await testHelper.waitForWSMessage(ws, 'authentication_success');
      expect(authMessage.userId).toBe(user.id);
      
      // Send a message through WebSocket
      ws.send(JSON.stringify({
        type: 'test-message',
        data: { test: true }
      }));
      
      // Revoke the token
      await server.tokenManager.blacklistToken(tokens.accessToken);
      
      // HTTP access should now fail
      const deniedHttpRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(deniedHttpRes.status).toBe(401);
      
      // WebSocket should also be affected (connection might close)
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(ws.readyState).not.toBe(ws.OPEN);
      
      ws.close();
    });
    
    it('should maintain security context across operations', async () => {
      const { user, tokens, csrfToken } = await testHelper.createAuthenticatedUser(server, {
        roles: ['user', 'admin']
      });
      
      // Admin endpoint should work
      const adminRes = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(adminRes.status).toBe(200);
      
      // Create another user without admin role
      const { tokens: userTokens } = await testHelper.createAuthenticatedUser(server, {
        email: 'regular@example.com',
        roles: ['user']
      });
      
      // Regular user should be denied admin access
      const deniedRes = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);
      
      expect(deniedRes.status).toBe(403);
      expect(deniedRes.body.error).toContain('Admin access required');
    });
  });
});