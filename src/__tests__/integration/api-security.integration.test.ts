/**
 * @fileoverview API Security Integration Tests
 * @description Tests for API endpoint security with middleware integration
 * @author Web-Buddy Team
 */

import request from 'supertest';
import { testHelper, TestServerInstance } from './integration-test-setup';
import SecurityTestUtils from '../security-test-utils';

describe('API Security Integration Tests', () => {
  let server: TestServerInstance;
  
  beforeAll(async () => {
    server = await testHelper.createTestServer('api-security', {
      enableCSRF: true,
      enableRateLimiting: true,
      rateLimitStore: 'memory'
    });
  });
  
  afterAll(async () => {
    await testHelper.stopTestServer('api-security');
  });
  
  beforeEach(async () => {
    await testHelper.cleanupTestData(server);
  });
  
  describe('CSRF Protection Integration', () => {
    it('should enforce CSRF protection on state-changing operations', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // POST without CSRF token should fail
      const noCSRFRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          extensionId: 'test-ext',
          action: 'test'
        });
      
      expect(noCSRFRes.status).toBe(403);
      expect(noCSRFRes.body.error).toContain('CSRF');
      
      // POST with invalid CSRF token should fail
      const invalidCSRFRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', 'invalid-csrf-token')
        .send({
          extensionId: 'test-ext',
          action: 'test'
        });
      
      expect(invalidCSRFRes.status).toBe(403);
      
      // POST with valid CSRF token should succeed
      const validCSRFRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test'
        });
      
      expect(validCSRFRes.status).toBe(200);
    });
    
    it('should handle CSRF token rotation correctly', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Use original token
      const firstRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test1'
        });
      
      expect(firstRes.status).toBe(200);
      
      // Rotate CSRF token
      const rotateRes = await request(server.baseUrl)
        .post('/auth/csrf-rotate')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken);
      
      expect(rotateRes.status).toBe(200);
      const newCSRFToken = rotateRes.body.csrfToken;
      expect(newCSRFToken).not.toBe(csrfToken);
      
      // Old token should fail
      const oldTokenRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test2'
        });
      
      expect(oldTokenRes.status).toBe(403);
      
      // New token should work
      const newTokenRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', newCSRFToken)
        .send({
          extensionId: 'test-ext',
          action: 'test3'
        });
      
      expect(newTokenRes.status).toBe(200);
    });
    
    it('should handle CSRF for different content types', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // JSON request
      const jsonRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Content-Type', 'application/json')
        .send({
          extensionId: 'test-ext',
          action: 'json-test'
        });
      
      expect(jsonRes.status).toBe(200);
      
      // Form data request
      const formRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .type('form')
        .send({
          extensionId: 'test-ext',
          action: 'form-test'
        });
      
      expect(formRes.status).toBe(200);
    });
  });
  
  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits per user', async () => {
      const user1 = await testHelper.createAuthenticatedUser(server, {
        email: 'ratelimit1@example.com'
      });
      const user2 = await testHelper.createAuthenticatedUser(server, {
        email: 'ratelimit2@example.com'
      });
      
      // Make requests as user1 up to the limit
      const limit = 10; // Default limit for testing
      const user1Requests = [];
      
      for (let i = 0; i < limit; i++) {
        user1Requests.push(
          request(server.baseUrl)
            .get('/api/extensions')
            .set('Authorization', `Bearer ${user1.tokens.accessToken}`)
        );
      }
      
      const user1Results = await Promise.all(user1Requests);
      user1Results.forEach((res, index) => {
        expect(res.status).toBe(200);
        expect(parseInt(res.headers['x-ratelimit-remaining'])).toBe(limit - index - 1);
      });
      
      // Next request should be rate limited
      const user1LimitedRes = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${user1.tokens.accessToken}`);
      
      expect(user1LimitedRes.status).toBe(429);
      expect(user1LimitedRes.headers).toHaveProperty('x-ratelimit-reset');
      
      // User2 should still be able to make requests
      const user2Res = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${user2.tokens.accessToken}`);
      
      expect(user2Res.status).toBe(200);
      expect(parseInt(user2Res.headers['x-ratelimit-remaining'])).toBe(limit - 1);
    });
    
    it('should handle burst protection', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Make rapid burst of requests
      const burstSize = 20;
      const burstRequests = Array(burstSize).fill(null).map(() =>
        request(server.baseUrl)
          .get('/api/extensions')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
      );
      
      const burstResults = await Promise.all(burstRequests);
      
      // Count successful vs rate limited
      const successful = burstResults.filter(res => res.status === 200).length;
      const rateLimited = burstResults.filter(res => res.status === 429).length;
      
      expect(successful).toBeGreaterThan(0);
      expect(rateLimited).toBeGreaterThan(0);
      expect(successful + rateLimited).toBe(burstSize);
    });
    
    it('should apply different limits for different endpoints', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server, {
        roles: ['user', 'admin']
      });
      
      // Regular endpoint should have standard limit
      const metricsRes = await request(server.baseUrl)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(metricsRes.status).toBe(200);
      const metricsLimit = parseInt(metricsRes.headers['x-ratelimit-limit']);
      
      // Admin endpoint might have different limit
      const adminRes = await request(server.baseUrl)
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`);
      
      expect(adminRes.status).toBe(200);
      const adminLimit = parseInt(adminRes.headers['x-ratelimit-limit']);
      
      // Limits might be different based on endpoint sensitivity
      expect(metricsLimit).toBeDefined();
      expect(adminLimit).toBeDefined();
    });
  });
  
  describe('Combined Security Middleware', () => {
    it('should enforce all security layers in correct order', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Request flow: Rate Limit → Auth → CSRF → Handler
      
      // 1. No auth token - should fail at auth layer
      const noAuthRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .send({ action: 'test' });
      
      expect(noAuthRes.status).toBe(401);
      
      // 2. Invalid auth token - should fail at auth layer
      const invalidAuthRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', 'Bearer invalid-token')
        .send({ action: 'test' });
      
      expect(invalidAuthRes.status).toBe(401);
      
      // 3. Valid auth but no CSRF - should fail at CSRF layer
      const noCSRFRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ action: 'test' });
      
      expect(noCSRFRes.status).toBe(403);
      
      // 4. Everything valid - should succeed
      const validRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test'
        });
      
      expect(validRes.status).toBe(200);
      
      // 5. Exhaust rate limit
      await testHelper.exhaustRateLimit(
        server,
        tokens.accessToken,
        '/api/automation/dispatch',
        5
      );
      
      // 6. Rate limited request - should fail at rate limit layer
      const rateLimitedRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test'
        });
      
      expect(rateLimitedRes.status).toBe(429);
    });
  });
  
  describe('Security Headers and CORS', () => {
    it('should set appropriate security headers', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      const res = await request(server.baseUrl)
        .get('/api/extensions')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('Origin', 'http://localhost:3000');
      
      expect(res.status).toBe(200);
      
      // Check security headers
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-xss-protection');
      
      // Check CORS headers
      expect(res.headers).toHaveProperty('access-control-allow-origin');
      expect(res.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });
    
    it('should handle preflight requests correctly', async () => {
      const res = await request(server.baseUrl)
        .options('/api/automation/dispatch')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, X-CSRF-Token');
      
      expect(res.status).toBe(204);
      expect(res.headers).toHaveProperty('access-control-allow-methods');
      expect(res.headers['access-control-allow-headers']).toContain('X-CSRF-Token');
    });
  });
  
  describe('API Input Validation and Sanitization', () => {
    it('should validate and sanitize input data', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      const { xssPayloads, sqlInjectionPayloads } = SecurityTestUtils.createSecurityTestScenarios();
      
      // Test XSS prevention
      for (const payload of xssPayloads) {
        const res = await request(server.baseUrl)
          .post('/api/automation/dispatch')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            extensionId: 'test-ext',
            action: payload,
            payload: { data: payload }
          });
        
        // Should either sanitize or reject
        if (res.status === 200) {
          expect(res.body).not.toContain('<script>');
          expect(res.body).not.toContain('javascript:');
        }
      }
      
      // Test SQL injection prevention
      for (const payload of sqlInjectionPayloads) {
        const res = await request(server.baseUrl)
          .post('/api/automation/dispatch')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            extensionId: payload,
            action: 'test'
          });
        
        // Should handle safely
        expect([200, 400]).toContain(res.status);
      }
    });
    
    it('should enforce request size limits', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Create large payload (over 10MB limit)
      const largeData = 'x'.repeat(11 * 1024 * 1024);
      
      const res = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          extensionId: 'test-ext',
          action: 'test',
          payload: largeData
        });
      
      expect(res.status).toBe(413); // Payload too large
    });
  });
  
  describe('API Error Handling', () => {
    it('should not leak sensitive information in errors', async () => {
      // Unauthenticated request
      const unauthRes = await request(server.baseUrl)
        .get('/api/extensions');
      
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body).not.toContain('stack');
      expect(unauthRes.body).not.toContain('password');
      
      // Invalid endpoint
      const notFoundRes = await request(server.baseUrl)
        .get('/api/nonexistent');
      
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error).toBe('Not Found');
      
      // Validate no sensitive data exposure
      const validation = SecurityTestUtils.validateNoSensitiveDataExposure(notFoundRes.body);
      expect(validation.isSecure).toBe(true);
    });
    
    it('should handle malformed requests gracefully', async () => {
      const { tokens } = await testHelper.createAuthenticatedUser(server);
      
      // Malformed JSON
      const malformedRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json');
      
      expect(malformedRes.status).toBe(400);
      
      // Invalid content type with body
      const invalidTypeRes = await request(server.baseUrl)
        .post('/api/automation/dispatch')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .set('Content-Type', 'text/plain')
        .send('not json data');
      
      expect([400, 415]).toContain(invalidTypeRes.status);
    });
  });
  
  describe('API Performance Under Security Load', () => {
    it('should maintain performance with security checks', async () => {
      const { tokens, csrfToken } = await testHelper.createAuthenticatedUser(server);
      
      // Measure baseline performance
      const baselineResult = await SecurityTestUtils.measureExecutionTime(async () => {
        return await request(server.baseUrl)
          .post('/api/automation/dispatch')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            extensionId: 'test-ext',
            action: 'performance-test'
          });
      });
      
      expect(baselineResult.result.status).toBe(200);
      expect(baselineResult.executionTime).toBeLessThan(100); // Should be fast
      
      // Make multiple concurrent requests
      const concurrentCount = 20;
      const concurrentRequests = Array(concurrentCount).fill(null).map(() => () =>
        request(server.baseUrl)
          .post('/api/automation/dispatch')
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            extensionId: 'test-ext',
            action: 'concurrent-test'
          })
      );
      
      const concurrentResult = await SecurityTestUtils.measureExecutionTime(async () => {
        return await testHelper.makeConcurrentRequests(concurrentRequests);
      });
      
      const successCount = concurrentResult.result.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Average time per request should still be reasonable
      const avgTime = concurrentResult.executionTime / concurrentCount;
      expect(avgTime).toBeLessThan(200);
    });
  });
});