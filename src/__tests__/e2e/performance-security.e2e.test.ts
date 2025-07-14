import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage, SecurityTestHelpers } from './e2e-helpers/page-objects';

test.describe('Security Performance Impact E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let loginPage: LoginPage;
  let securityHelpers: SecurityTestHelpers;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    loginPage = new LoginPage(page);
    securityHelpers = new SecurityTestHelpers(page, context);
    
    // Enable performance monitoring
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();
  });

  test.afterEach(async () => {
    // Collect coverage data
    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage()
    ]);
    
    // Log unused code
    const totalBytes = jsCoverage.reduce((total, entry) => total + entry.text.length, 0);
    const usedBytes = jsCoverage.reduce((total, entry) => {
      return total + entry.ranges.reduce((sum, range) => sum + range.end - range.start, 0);
    }, 0);
    
    console.log(`JS Coverage: ${((usedBytes / totalBytes) * 100).toFixed(2)}%`);
    
    await context.close();
  });

  test.describe('Authentication Performance', () => {
    test('login flow performance metrics', async () => {
      const metrics: any[] = [];
      
      // Monitor performance
      page.on('load', async () => {
        const performance = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const resources = performance.getEntriesByType('resource');
          
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            ttfb: navigation.responseStart - navigation.requestStart,
            totalResources: resources.length,
            totalSize: resources.reduce((sum, r: any) => sum + (r.transferSize || 0), 0)
          };
        });
        metrics.push(performance);
      });
      
      // Measure login process
      const startTime = Date.now();
      
      await loginPage.goto();
      const pageLoadTime = Date.now() - startTime;
      
      // Fill and submit form
      const formStartTime = Date.now();
      await loginPage.login('user@test.com', 'User123!@#');
      const loginTime = Date.now() - formStartTime;
      
      // Wait for redirect
      await expect(page).toHaveURL('/dashboard');
      const totalTime = Date.now() - startTime;
      
      // Performance assertions
      expect(pageLoadTime).toBeLessThan(2000); // Page loads in < 2s
      expect(loginTime).toBeLessThan(1000); // Login process < 1s
      expect(totalTime).toBeLessThan(3000); // Total flow < 3s
      
      // Check metrics
      const navMetrics = metrics[0];
      expect(navMetrics.ttfb).toBeLessThan(500); // Time to first byte < 500ms
      expect(navMetrics.domContentLoaded).toBeLessThan(1000);
    });

    test('password hashing performance', async () => {
      await loginPage.goto();
      
      // Measure client-side hashing if implemented
      const hashingTime = await page.evaluate(async () => {
        const start = performance.now();
        const encoder = new TextEncoder();
        
        // Simulate password hashing
        for (let i = 0; i < 10; i++) {
          const data = encoder.encode('TestPassword123!' + i);
          await crypto.subtle.digest('SHA-256', data);
        }
        
        return performance.now() - start;
      });
      
      // Hashing should be fast enough not to impact UX
      expect(hashingTime).toBeLessThan(100); // < 100ms for 10 iterations
    });

    test('concurrent authentication requests', async () => {
      const concurrentLogins = 5;
      const loginPromises = [];
      
      for (let i = 0; i < concurrentLogins; i++) {
        const context = await page.context().browser()!.newContext();
        const page = await context.newPage();
        const loginPage = new LoginPage(page);
        
        loginPromises.push(
          loginPage.goto().then(() => 
            loginPage.login(`user${i}@test.com`, 'User123!@#')
          )
        );
      }
      
      const startTime = Date.now();
      await Promise.all(loginPromises);
      const totalTime = Date.now() - startTime;
      
      // Server should handle concurrent logins efficiently
      const avgTime = totalTime / concurrentLogins;
      expect(avgTime).toBeLessThan(2000); // Average < 2s per login
    });
  });

  test.describe('CSRF Token Performance', () => {
    test('CSRF token generation overhead', async () => {
      const measurements: number[] = [];
      
      // Measure multiple page loads
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await page.goto('/form-page');
        
        // Get CSRF token
        const csrfToken = await page.locator('input[name="csrf_token"]').getAttribute('value');
        expect(csrfToken).toBeTruthy();
        
        measurements.push(Date.now() - start);
      }
      
      const avgLoadTime = measurements.reduce((a, b) => a + b) / measurements.length;
      expect(avgLoadTime).toBeLessThan(500); // CSRF doesn't add significant overhead
    });

    test('CSRF validation performance', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Measure form submission with CSRF
      const submissions = [];
      
      for (let i = 0; i < 5; i++) {
        await page.goto('/profile');
        
        const start = Date.now();
        await page.fill('input[name="bio"]', `Test bio ${i}`);
        await page.click('button[type="submit"]');
        await page.waitForResponse(resp => resp.url().includes('/api/profile'));
        
        submissions.push(Date.now() - start);
      }
      
      const avgSubmissionTime = submissions.reduce((a, b) => a + b) / submissions.length;
      expect(avgSubmissionTime).toBeLessThan(1000); // < 1s average
    });
  });

  test.describe('Rate Limiting Performance', () => {
    test('rate limiting overhead measurement', async () => {
      const normalRequests: number[] = [];
      const rateLimitedRequests: number[] = [];
      
      // Normal requests (within rate limit)
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const response = await page.request.get('/api/data');
        normalRequests.push(Date.now() - start);
        expect(response.status()).toBe(200);
      }
      
      // Trigger rate limit
      await securityHelpers.triggerRateLimitExhaustion('/api/data', 20);
      
      // Rate limited requests
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const response = await page.request.get('/api/data');
        rateLimitedRequests.push(Date.now() - start);
        expect(response.status()).toBe(429);
      }
      
      // Rate limited responses should be fast (early rejection)
      const avgNormal = normalRequests.reduce((a, b) => a + b) / normalRequests.length;
      const avgLimited = rateLimitedRequests.reduce((a, b) => a + b) / rateLimitedRequests.length;
      
      expect(avgLimited).toBeLessThan(avgNormal); // Rate limited requests rejected quickly
      expect(avgLimited).toBeLessThan(50); // < 50ms for rejection
    });

    test('distributed rate limiting performance', async () => {
      const contexts = [];
      const requests = [];
      
      // Create multiple contexts (simulating different users)
      for (let i = 0; i < 10; i++) {
        const ctx = await page.context().browser()!.newContext();
        contexts.push(ctx);
        
        const page = await ctx.newPage();
        requests.push(page.request.get('/api/expensive-operation'));
      }
      
      const start = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - start;
      
      // Check distributed rate limiting doesn't cause bottlenecks
      const successCount = responses.filter(r => r.status() === 200).length;
      expect(successCount).toBeGreaterThan(5); // At least half should succeed
      expect(totalTime).toBeLessThan(5000); // Total time < 5s
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });

  test.describe('Security Headers Performance', () => {
    test('header processing overhead', async () => {
      const withSecurityHeaders: number[] = [];
      const withoutSecurityHeaders: number[] = [];
      
      // Measure with security headers
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        const response = await page.request.get('/api/with-security-headers');
        withSecurityHeaders.push(Date.now() - start);
        
        // Verify headers present
        const headers = response.headers();
        expect(headers['x-frame-options']).toBeTruthy();
        expect(headers['content-security-policy']).toBeTruthy();
      }
      
      // Measure without security headers (test endpoint)
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await page.request.get('/api/no-security-headers');
        withoutSecurityHeaders.push(Date.now() - start);
      }
      
      const avgWith = withSecurityHeaders.reduce((a, b) => a + b) / withSecurityHeaders.length;
      const avgWithout = withoutSecurityHeaders.reduce((a, b) => a + b) / withoutSecurityHeaders.length;
      
      // Security headers should add minimal overhead
      const overhead = avgWith - avgWithout;
      expect(overhead).toBeLessThan(10); // < 10ms overhead
    });

    test('CSP impact on page rendering', async () => {
      const renderingTimes: Record<string, number[]> = {
        strict: [],
        relaxed: [],
        none: []
      };
      
      const cspLevels = [
        { name: 'strict', url: '/csp-strict' },
        { name: 'relaxed', url: '/csp-relaxed' },
        { name: 'none', url: '/csp-none' }
      ];
      
      for (const level of cspLevels) {
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          await page.goto(level.url);
          
          // Wait for full render
          await page.evaluate(() => {
            return new Promise(resolve => {
              if (document.readyState === 'complete') {
                resolve(true);
              } else {
                window.addEventListener('load', () => resolve(true));
              }
            });
          });
          
          renderingTimes[level.name].push(Date.now() - start);
        }
      }
      
      // Compare rendering times
      const avgStrict = renderingTimes.strict.reduce((a, b) => a + b) / renderingTimes.strict.length;
      const avgNone = renderingTimes.none.reduce((a, b) => a + b) / renderingTimes.none.length;
      
      // CSP shouldn't significantly impact rendering
      const cspOverhead = avgStrict - avgNone;
      expect(cspOverhead).toBeLessThan(100); // < 100ms overhead
    });
  });

  test.describe('Encryption Performance', () => {
    test('TLS handshake performance', async () => {
      if (!page.url().startsWith('https://')) {
        test.skip();
        return;
      }
      
      const handshakeTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        
        // Force new connection
        const response = await page.request.get('/api/health', {
          headers: {
            'Connection': 'close' // Force new TLS handshake
          }
        });
        
        handshakeTimes.push(Date.now() - start);
        expect(response.status()).toBe(200);
      }
      
      const avgHandshake = handshakeTimes.reduce((a, b) => a + b) / handshakeTimes.length;
      expect(avgHandshake).toBeLessThan(200); // < 200ms including handshake
    });

    test('encrypted storage performance', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Measure encrypted storage operations
      const storageTimes = await page.evaluate(async () => {
        const measurements = {
          encrypt: [],
          decrypt: []
        };
        
        // Test data
        const testData = {
          apiKey: 'sk_test_1234567890',
          sessionData: { user: 'test', permissions: ['read', 'write'] },
          preferences: { theme: 'dark', language: 'en' }
        };
        
        // Simulate encryption
        for (let i = 0; i < 10; i++) {
          const encryptStart = performance.now();
          
          // Encrypt data
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify(testData));
          const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
          );
          
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
          );
          
          measurements.encrypt.push(performance.now() - encryptStart);
          
          // Decrypt data
          const decryptStart = performance.now();
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
          );
          
          measurements.decrypt.push(performance.now() - decryptStart);
        }
        
        return measurements;
      });
      
      // @ts-ignore
      const avgEncrypt = storageTimes.encrypt.reduce((a: number, b: number) => a + b) / storageTimes.encrypt.length;
      // @ts-ignore
      const avgDecrypt = storageTimes.decrypt.reduce((a: number, b: number) => a + b) / storageTimes.decrypt.length;
      
      expect(avgEncrypt).toBeLessThan(10); // < 10ms for encryption
      expect(avgDecrypt).toBeLessThan(10); // < 10ms for decryption
    });
  });

  test.describe('Session Management Performance', () => {
    test('session validation overhead', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const requestTimes: number[] = [];
      
      // Make authenticated requests
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        const response = await page.request.get('/api/me');
        requestTimes.push(Date.now() - start);
        
        expect(response.status()).toBe(200);
      }
      
      const avgRequestTime = requestTimes.reduce((a, b) => a + b) / requestTimes.length;
      expect(avgRequestTime).toBeLessThan(100); // Session validation < 100ms
    });

    test('concurrent session handling', async () => {
      const sessions = 10;
      const contexts: BrowserContext[] = [];
      const loginPromises = [];
      
      // Create multiple sessions
      for (let i = 0; i < sessions; i++) {
        const ctx = await page.context().browser()!.newContext();
        contexts.push(ctx);
        
        const page = await ctx.newPage();
        const loginPage = new LoginPage(page);
        
        loginPromises.push(
          loginPage.goto().then(() => 
            loginPage.login(`user${i}@test.com`, 'User123!@#')
          )
        );
      }
      
      const start = Date.now();
      await Promise.all(loginPromises);
      const loginTime = Date.now() - start;
      
      // Make concurrent authenticated requests
      const requestPromises = [];
      for (const ctx of contexts) {
        const page = await ctx.newPage();
        requestPromises.push(page.request.get('/api/data'));
      }
      
      const requestStart = Date.now();
      const responses = await Promise.all(requestPromises);
      const requestTime = Date.now() - requestStart;
      
      // All requests should succeed
      responses.forEach(r => expect(r.status()).toBe(200));
      
      // Performance should scale well
      expect(loginTime / sessions).toBeLessThan(1000); // < 1s per session
      expect(requestTime / sessions).toBeLessThan(100); // < 100ms per request
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });

  test.describe('Resource Loading Performance', () => {
    test('security script loading impact', async () => {
      await page.goto('/');
      
      // Measure resource loading
      const resources = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        return entries.map((entry: any) => ({
          name: entry.name,
          duration: entry.duration,
          size: entry.transferSize,
          type: entry.initiatorType
        }));
      });
      
      // Find security-related scripts
      const securityScripts = resources.filter((r: any) => 
        r.name.includes('security') || 
        r.name.includes('auth') || 
        r.name.includes('csrf')
      );
      
      // Security scripts should be optimized
      securityScripts.forEach((script: any) => {
        expect(script.duration).toBeLessThan(500); // Load in < 500ms
        expect(script.size).toBeLessThan(50000); // < 50KB per script
      });
      
      // Total security overhead
      const totalSecuritySize = securityScripts.reduce((sum: number, s: any) => sum + s.size, 0);
      expect(totalSecuritySize).toBeLessThan(200000); // Total < 200KB
    });

    test('lazy loading of security features', async () => {
      await page.goto('/');
      
      // Initial page load
      const initialResources = await page.evaluate(() => 
        performance.getEntriesByType('resource').length
      );
      
      // Trigger security feature (2FA setup)
      await page.click('button:has-text("Enable 2FA")');
      
      // Wait for lazy load
      await page.waitForTimeout(1000);
      
      // Check additional resources loaded
      const afterResources = await page.evaluate(() => 
        performance.getEntriesByType('resource').length
      );
      
      // Security features should lazy load
      expect(afterResources).toBeGreaterThan(initialResources);
      
      // Measure lazy load performance
      const lazyLoadTime = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        const recent = entries.slice(-5); // Last 5 resources
        return Math.max(...recent.map((e: any) => e.responseEnd)) - 
               Math.min(...recent.map((e: any) => e.startTime));
      });
      
      expect(lazyLoadTime).toBeLessThan(1000); // Lazy load < 1s
    });
  });

  test.describe('Memory Usage', () => {
    test('security feature memory footprint', async () => {
      if (!page.evaluate(() => 'memory' in performance)) {
        test.skip();
        return;
      }
      
      // Baseline memory
      await page.goto('/minimal');
      const baselineMemory = await page.evaluate(() => 
        // @ts-ignore
        performance.memory.usedJSHeapSize
      );
      
      // Load page with all security features
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      await page.goto('/dashboard');
      
      // Measure memory with security features
      const securityMemory = await page.evaluate(() => 
        // @ts-ignore
        performance.memory.usedJSHeapSize
      );
      
      const memoryIncrease = securityMemory - baselineMemory;
      const increaseInMB = memoryIncrease / (1024 * 1024);
      
      // Security features should have reasonable memory footprint
      expect(increaseInMB).toBeLessThan(10); // < 10MB increase
    });

    test('memory leak detection', async () => {
      if (!page.evaluate(() => 'memory' in performance)) {
        test.skip();
        return;
      }
      
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const memorySnapshots: number[] = [];
      
      // Perform repeated actions
      for (let i = 0; i < 10; i++) {
        // Navigate between pages
        await page.goto('/dashboard');
        await page.goto('/profile');
        await page.goto('/settings');
        
        // Force garbage collection if available
        await page.evaluate(() => {
          // @ts-ignore
          if (window.gc) window.gc();
        });
        
        // Take memory snapshot
        const memory = await page.evaluate(() => 
          // @ts-ignore
          performance.memory.usedJSHeapSize
        );
        memorySnapshots.push(memory);
      }
      
      // Check for memory leak
      const firstHalf = memorySnapshots.slice(0, 5).reduce((a, b) => a + b) / 5;
      const secondHalf = memorySnapshots.slice(5).reduce((a, b) => a + b) / 5;
      
      const memoryGrowth = (secondHalf - firstHalf) / firstHalf;
      expect(memoryGrowth).toBeLessThan(0.1); // < 10% growth indicates no major leak
    });
  });
});