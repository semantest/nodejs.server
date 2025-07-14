import { test, expect, Page, BrowserContext, Request } from '@playwright/test';
import { LoginPage, SecurityTestHelpers } from './e2e-helpers/page-objects';
import attackPayloads from './fixtures/attack-payloads.json';

test.describe('Security Attack Simulation E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let securityHelpers: SecurityTestHelpers;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    securityHelpers = new SecurityTestHelpers(page, context);
    
    // Monitor console for security violations
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Security')) {
        console.log('Security violation detected:', msg.text());
      }
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('CSRF Attack Prevention', () => {
    test('blocks requests without CSRF token', async () => {
      // Login first
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Try to make request without CSRF token
      const response = await page.request.post('/api/transfer', {
        data: {
          amount: 1000,
          recipient: 'attacker@evil.com'
        },
        headers: {
          'Content-Type': 'application/json',
          // Deliberately omit CSRF token
        }
      });
      
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('CSRF');
    });

    test('blocks cross-origin form submissions', async () => {
      // Login on legitimate site
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Navigate to attacker's site
      await page.goto('data:text/html,<h1>Evil Site</h1>');
      
      // Try CSRF attack
      await securityHelpers.simulateCSRFAttack(
        'http://localhost:3000/api/transfer',
        attackPayloads.csrf.forms[0].fields
      );
      
      // Check if attack was blocked
      const response = await page.waitForResponse(resp => 
        resp.url().includes('/api/transfer')
      );
      
      expect(response.status()).toBe(403);
    });

    test('validates referer header', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Try request with invalid referer
      const response = await page.request.post('/api/sensitive-action', {
        data: { action: 'delete-all' },
        headers: {
          'Referer': 'https://evil-site.com',
          'X-CSRF-Token': 'fake-token'
        }
      });
      
      expect(response.status()).toBe(403);
    });

    test('double submit cookie validation', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Get CSRF token from cookie
      const cookies = await context.cookies();
      const csrfCookie = cookies.find(c => c.name === 'csrf-token');
      
      // Try with mismatched tokens
      const response = await page.request.post('/api/update-profile', {
        data: { name: 'Hacked' },
        headers: {
          'X-CSRF-Token': 'different-token',
          'Cookie': `csrf-token=${csrfCookie?.value}`
        }
      });
      
      expect(response.status()).toBe(403);
    });
  });

  test.describe('XSS Attack Prevention', () => {
    test('sanitizes user input in forms', async () => {
      await page.goto('/profile');
      
      // Try various XSS payloads
      for (const payload of attackPayloads.xss.basic) {
        await securityHelpers.injectXSSPayload(payload, 'input[name="bio"]');
        await page.locator('button[type="submit"]').click();
        
        // Check if script executed
        const alertShown = await page.evaluate(() => {
          return new Promise((resolve) => {
            const originalAlert = window.alert;
            window.alert = () => {
              window.alert = originalAlert;
              resolve(true);
            };
            setTimeout(() => resolve(false), 100);
          });
        });
        
        expect(alertShown).toBe(false);
      }
    });

    test('prevents stored XSS attacks', async () => {
      // Submit malicious content
      await page.goto('/comments');
      const xssPayload = attackPayloads.xss.advanced[0];
      
      await page.fill('textarea[name="comment"]', xssPayload);
      await page.click('button[type="submit"]');
      
      // Reload page to check stored content
      await page.reload();
      
      // Check if malicious script is executed
      const cookiesStolen = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Monitor fetch calls
          const originalFetch = window.fetch;
          window.fetch = (...args) => {
            if (args[0].includes('/api/steal-data')) {
              resolve(true);
            }
            return originalFetch(...args);
          };
          setTimeout(() => resolve(false), 1000);
        });
      });
      
      expect(cookiesStolen).toBe(false);
    });

    test('DOM-based XSS prevention', async () => {
      // Try DOM XSS via URL hash
      await page.goto('/search#<img src=x onerror=alert("XSS")>');
      
      const alertShown = await page.evaluate(() => {
        return new Promise((resolve) => {
          window.alert = () => resolve(true);
          // Process hash
          document.getElementById('search-results')!.innerHTML = 
            'Results for: ' + location.hash.substring(1);
          setTimeout(() => resolve(false), 100);
        });
      });
      
      expect(alertShown).toBe(false);
    });

    test('Content Security Policy blocks inline scripts', async () => {
      await page.goto('/');
      
      // Check CSP header
      const response = await page.waitForResponse(resp => resp.url().includes('/'));
      const cspHeader = response.headers()['content-security-policy'];
      
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).not.toContain("'unsafe-inline'");
      
      // Try to inject inline script
      const scriptBlocked = await page.evaluate(() => {
        try {
          const script = document.createElement('script');
          script.textContent = 'window.xssTest = true;';
          document.body.appendChild(script);
          // @ts-ignore
          return !window.xssTest;
        } catch {
          return true;
        }
      });
      
      expect(scriptBlocked).toBe(true);
    });
  });

  test.describe('JWT Security', () => {
    test('prevents algorithm none attack', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Get legitimate JWT
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      const legitimateToken = authCookie?.value;
      
      // Create malicious JWT with alg: none
      const maliciousPayload = attackPayloads.jwt.tampering[0];
      const header = Buffer.from(JSON.stringify(maliciousPayload.header)).toString('base64url');
      const payload = Buffer.from(JSON.stringify(maliciousPayload.payload)).toString('base64url');
      const maliciousToken = `${header}.${payload}.`;
      
      // Try to use malicious token
      await securityHelpers.manipulateCookie('auth-token', maliciousToken);
      
      // Make authenticated request
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(401);
    });

    test('validates JWT signature', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Get JWT and tamper with payload
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      const token = authCookie?.value || '';
      
      // Decode and modify payload
      const [header, payload, signature] = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      decodedPayload.role = 'admin'; // Privilege escalation attempt
      
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
      
      // Use tampered token
      await securityHelpers.manipulateCookie('auth-token', tamperedToken);
      
      const response = await page.request.get('/api/admin');
      expect(response.status()).toBe(401);
    });

    test('prevents token replay after logout', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Save token
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      const savedToken = authCookie?.value;
      
      // Logout
      await page.goto('/logout');
      
      // Try to reuse old token
      await context.addCookies([{
        name: 'auth-token',
        value: savedToken!,
        domain: 'localhost',
        path: '/'
      }]);
      
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(401);
    });

    test('token expiration enforcement', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Create expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQHRlc3QuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';
      
      await securityHelpers.manipulateCookie('auth-token', expiredToken);
      
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Rate Limiting', () => {
    test('enforces rate limits on authentication', async () => {
      const loginPage = new LoginPage(page);
      
      // Attempt multiple rapid logins
      const attempts = 15;
      const responses = [];
      
      for (let i = 0; i < attempts; i++) {
        await loginPage.goto();
        const response = page.waitForResponse(resp => resp.url().includes('/api/login'));
        await loginPage.login(`user${i}@test.com`, 'wrong-password');
        responses.push(await response);
      }
      
      // Check rate limit was hit
      const rateLimited = responses.some(r => r.status() === 429);
      expect(rateLimited).toBe(true);
      
      // Check rate limit headers
      const lastResponse = responses[responses.length - 1];
      const headers = lastResponse.headers();
      expect(headers['x-rate-limit-remaining']).toBe('0');
      expect(headers['retry-after']).toBeTruthy();
    });

    test('distributed rate limiting across IPs', async () => {
      // Simulate requests from different IPs
      const ips = ['1.2.3.4', '5.6.7.8', '9.10.11.12'];
      const requestsPerIp = 5;
      
      for (const ip of ips) {
        const responses = await securityHelpers.triggerRateLimitExhaustion(
          '/api/data',
          requestsPerIp
        );
        
        // Each IP should have its own limit
        const successfulRequests = responses.filter(r => r?.status() === 200).length;
        expect(successfulRequests).toBeGreaterThan(0);
      }
    });

    test('sliding window rate limiting', async () => {
      // Make requests up to limit
      const responses1 = await securityHelpers.triggerRateLimitExhaustion('/api/search', 10);
      const successful1 = responses1.filter(r => r?.status() === 200).length;
      
      // Wait half window
      await page.waitForTimeout(30000); // 30 seconds
      
      // Should be able to make some more requests
      const responses2 = await securityHelpers.triggerRateLimitExhaustion('/api/search', 5);
      const successful2 = responses2.filter(r => r?.status() === 200).length;
      
      expect(successful2).toBeGreaterThan(0);
    });

    test('bypass attempt detection', async () => {
      const bypassTechniques = attackPayloads.rate_limiting.bypass_techniques;
      
      // Try header manipulation
      for (const [header, values] of Object.entries(bypassTechniques[0].headers)) {
        for (const value of values) {
          const response = await page.request.get('/api/data', {
            headers: { [header]: value }
          });
          
          // Should not bypass rate limiting
          if (response.status() === 429) {
            expect(response.headers()['x-rate-limit-remaining']).toBe('0');
          }
        }
      }
    });
  });

  test.describe('SQL Injection Prevention', () => {
    test('parameterized queries prevent injection', async () => {
      await page.goto('/search');
      
      for (const payload of attackPayloads.sql_injection.auth_bypass) {
        await page.fill('input[name="search"]', payload);
        await page.click('button[type="submit"]');
        
        // Should not return unauthorized data
        const results = await page.locator('.search-results').textContent();
        expect(results).not.toContain('admin');
        expect(results).not.toContain('password');
      }
    });

    test('prevents UNION injection', async () => {
      for (const payload of attackPayloads.sql_injection.union) {
        const response = await page.request.get(`/api/products?category=${encodeURIComponent(payload)}`);
        
        expect(response.status()).not.toBe(500); // No server error
        const data = await response.json();
        
        // Check no extra columns leaked
        if (Array.isArray(data)) {
          data.forEach(item => {
            expect(Object.keys(item)).not.toContain('password');
            expect(Object.keys(item)).not.toContain('email');
          });
        }
      }
    });

    test('blind SQL injection protection', async () => {
      const baselineStart = Date.now();
      await page.request.get('/api/check-username?username=normal');
      const baselineTime = Date.now() - baselineStart;
      
      // Try time-based blind SQLi
      const payload = "admin' AND SLEEP(5)--";
      const attackStart = Date.now();
      await page.request.get(`/api/check-username?username=${encodeURIComponent(payload)}`);
      const attackTime = Date.now() - attackStart;
      
      // Should not have significant delay
      expect(attackTime).toBeLessThan(baselineTime + 1000); // Max 1 second difference
    });
  });

  test.describe('Session Security', () => {
    test('prevents session fixation', async () => {
      // Try to set session ID via URL
      await page.goto('/login?sessionid=attacker-session-id');
      
      const loginPage = new LoginPage(page);
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Check session ID changed after login
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      
      expect(sessionCookie?.value).not.toBe('attacker-session-id');
    });

    test('session hijacking prevention', async () => {
      // Login and get session
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      
      // Try to use session from different context (different IP/User-Agent)
      const attackerContext = await page.context().browser()?.newContext({
        userAgent: 'Attacker Bot 1.0'
      });
      
      const attackerPage = await attackerContext!.newPage();
      await attackerContext!.addCookies([sessionCookie!]);
      
      const response = await attackerPage.request.get('/api/me');
      expect(response.status()).toBe(401);
      
      await attackerContext!.close();
    });

    test('secure session cookie attributes', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      
      expect(sessionCookie?.httpOnly).toBe(true);
      expect(sessionCookie?.sameSite).toBe('Strict');
      if (page.url().startsWith('https://')) {
        expect(sessionCookie?.secure).toBe(true);
      }
    });
  });

  test.describe('DDoS Protection', () => {
    test('connection limiting per IP', async () => {
      const connections = [];
      
      // Try to open many connections
      for (let i = 0; i < 100; i++) {
        connections.push(
          page.request.get('/api/stream', {
            timeout: 60000 // Long timeout for streaming
          }).catch(() => null)
        );
      }
      
      const results = await Promise.all(connections);
      const successful = results.filter(r => r?.status() === 200).length;
      
      // Should limit concurrent connections
      expect(successful).toBeLessThan(20);
    });

    test('request size limiting', async () => {
      // Create large payload
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const response = await page.request.post('/api/upload', {
        data: { data: largePayload },
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(err => err.response);
      
      expect(response.status()).toBe(413); // Payload too large
    });

    test('slowloris attack prevention', async () => {
      // Try to send headers very slowly
      const slowRequest = page.request.post('/api/data', {
        data: 'test',
        timeout: 60000,
        headers: {
          'Transfer-Encoding': 'chunked',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Server should timeout slow requests
      const response = await slowRequest.catch(err => err);
      expect(response.message).toContain('timeout');
    });
  });

  test.describe('File Upload Security', () => {
    test('prevents malicious file uploads', async () => {
      await page.goto('/upload');
      
      // Try to upload PHP file
      const maliciousFile = Buffer.from('<?php system($_GET["cmd"]); ?>');
      await page.setInputFiles('input[type="file"]', {
        name: 'shell.php',
        mimeType: 'application/x-php',
        buffer: maliciousFile
      });
      
      await page.click('button[type="submit"]');
      
      // Should be rejected
      const error = await page.locator('.error-message').textContent();
      expect(error).toContain('Invalid file type');
    });

    test('file size validation', async () => {
      await page.goto('/upload');
      
      // Create large file
      const largeFile = Buffer.alloc(50 * 1024 * 1024); // 50MB
      await page.setInputFiles('input[type="file"]', {
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeFile
      });
      
      await page.click('button[type="submit"]');
      
      const error = await page.locator('.error-message').textContent();
      expect(error).toContain('File too large');
    });

    test('prevents path traversal in filenames', async () => {
      await page.goto('/upload');
      
      const file = Buffer.from('test content');
      await page.setInputFiles('input[type="file"]', {
        name: '../../../../etc/passwd',
        mimeType: 'text/plain',
        buffer: file
      });
      
      await page.click('button[type="submit"]');
      
      // Check file was sanitized
      const response = await page.waitForResponse(resp => resp.url().includes('/upload'));
      const result = await response.json();
      
      expect(result.filename).not.toContain('..');
      expect(result.filename).not.toContain('/');
    });
  });

  test.describe('API Security', () => {
    test('validates input data types', async () => {
      const invalidPayloads = [
        { userId: 'not-a-number', amount: 100 },
        { userId: 123, amount: 'not-a-number' },
        { userId: null, amount: 100 },
        { userId: undefined, amount: 100 },
        { userId: [], amount: {} }
      ];
      
      for (const payload of invalidPayloads) {
        const response = await page.request.post('/api/transfer', {
          data: payload,
          headers: { 'Content-Type': 'application/json' }
        });
        
        expect(response.status()).toBe(400);
        const error = await response.json();
        expect(error.error).toContain('validation');
      }
    });

    test('prevents XXE attacks', async () => {
      for (const payload of attackPayloads.xxe.payloads) {
        const response = await page.request.post('/api/parse-xml', {
          data: payload,
          headers: { 'Content-Type': 'application/xml' }
        });
        
        expect(response.status()).not.toBe(200);
        const body = await response.text();
        expect(body).not.toContain('/etc/passwd');
        expect(body).not.toContain('root:');
      }
    });

    test('command injection prevention', async () => {
      for (const payload of attackPayloads.command_injection.payloads) {
        const response = await page.request.post('/api/process', {
          data: { filename: payload },
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status() === 200) {
          const result = await response.json();
          expect(result).not.toContain('root');
          expect(result).not.toContain('/bin/');
        }
      }
    });
  });
});