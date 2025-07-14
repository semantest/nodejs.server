import { test, expect, devices, Page, BrowserContext } from '@playwright/test';
import { LoginPage, PermissionDialog, SecurityTestHelpers } from './e2e-helpers/page-objects';

// Run tests on multiple browsers
const browsers = ['chromium', 'firefox', 'webkit', 'mobile-chrome', 'mobile-safari'];

for (const browserName of browsers) {
  test.describe(`Cross-Browser Security Tests - ${browserName}`, () => {
    test.use({ ...devices[browserName] || {} });
    
    let page: Page;
    let context: BrowserContext;
    let loginPage: LoginPage;
    let securityHelpers: SecurityTestHelpers;

    test.beforeEach(async ({ browser }) => {
      context = await browser.newContext({
        ignoreHTTPSErrors: false, // Ensure HTTPS validation
        javaScriptEnabled: true,
        locale: 'en-US',
        timezoneId: 'America/New_York',
      });
      
      page = await context.newPage();
      loginPage = new LoginPage(page);
      securityHelpers = new SecurityTestHelpers(page, context);
      
      // Set up request interception for security monitoring
      await page.route('**/*', (route) => {
        const request = route.request();
        // Log security-relevant requests
        if (request.url().includes('/api/')) {
          console.log(`[${browserName}] API Request:`, request.method(), request.url());
        }
        route.continue();
      });
    });

    test.afterEach(async () => {
      await context.close();
    });

    test.describe('Browser-Specific Security Features', () => {
      test('cookie handling across browsers', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'User123!@#');
        
        const cookies = await context.cookies();
        const authCookie = cookies.find(c => c.name === 'auth-token');
        
        // Verify cookie attributes work correctly
        expect(authCookie).toBeTruthy();
        expect(authCookie?.httpOnly).toBe(true);
        
        // Test SameSite behavior
        if (browserName !== 'webkit') { // Safari has different SameSite defaults
          expect(authCookie?.sameSite).toBe('Strict');
        }
        
        // Test cookie persistence
        await page.reload();
        const cookiesAfterReload = await context.cookies();
        const authCookieAfterReload = cookiesAfterReload.find(c => c.name === 'auth-token');
        expect(authCookieAfterReload?.value).toBe(authCookie?.value);
      });

      test('localStorage security boundaries', async () => {
        await page.goto('http://localhost:3000');
        await page.evaluate(() => {
          localStorage.setItem('test-key', 'test-value');
        });
        
        // Navigate to different origin
        await page.goto('http://127.0.0.1:3000');
        const crossOriginValue = await page.evaluate(() => {
          return localStorage.getItem('test-key');
        });
        
        // Should not access cross-origin localStorage
        expect(crossOriginValue).toBeNull();
      });

      test('CORS enforcement', async () => {
        await page.goto('http://localhost:3000');
        
        // Try cross-origin request
        const corsViolation = await page.evaluate(async () => {
          try {
            const response = await fetch('http://evil-site.com/api/data');
            return false;
          } catch (error) {
            return true;
          }
        });
        
        // CORS should block the request
        expect(corsViolation).toBe(true);
      });
    });

    test.describe('Mobile-Specific Security', () => {
      test.skip(({ browserName }) => !browserName.includes('mobile'), 'Mobile only test');
      
      test('touch event security', async () => {
        await loginPage.goto();
        
        // Test touch events don't bypass security
        await page.tap('input[name="email"]');
        await page.fill('input[name="email"]', 'user@test.com');
        
        await page.tap('input[name="password"]');
        await page.fill('input[name="password"]', 'User123!@#');
        
        // Ensure CSRF token still required on mobile
        const csrfToken = await loginPage.getCSRFToken();
        expect(csrfToken).toBeTruthy();
        
        await page.tap('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard');
      });

      test('viewport security on mobile', async () => {
        await page.goto('/sensitive-data');
        
        // Check viewport meta tag prevents zooming on sensitive pages
        const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewportMeta).toContain('user-scalable=no');
        expect(viewportMeta).toContain('maximum-scale=1');
      });

      test('mobile clipboard security', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'User123!@#');
        
        await page.goto('/api-keys');
        
        // Mobile browsers handle clipboard differently
        const canCopyApiKey = await page.evaluate(async () => {
          try {
            await navigator.clipboard.writeText('test-api-key');
            return true;
          } catch {
            return false;
          }
        });
        
        // Should require user interaction
        if (canCopyApiKey) {
          // If clipboard is available, test secure handling
          const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
          expect(clipboardText).not.toContain('sk_live'); // No production keys
        }
      });
    });

    test.describe('Browser-Specific CSP Handling', () => {
      test('CSP enforcement variations', async () => {
        await page.goto('/');
        
        const response = await page.waitForResponse(resp => resp.url() === page.url());
        const cspHeader = response.headers()['content-security-policy'];
        
        expect(cspHeader).toBeTruthy();
        
        // Test CSP violation reporting
        const cspViolations: string[] = [];
        page.on('console', (msg) => {
          if (msg.text().includes('Content Security Policy')) {
            cspViolations.push(msg.text());
          }
        });
        
        // Try to violate CSP
        await page.evaluate(() => {
          const script = document.createElement('script');
          script.src = 'https://evil-cdn.com/malicious.js';
          document.head.appendChild(script);
        });
        
        await page.waitForTimeout(1000);
        
        // Different browsers report CSP violations differently
        if (browserName === 'chromium' || browserName === 'firefox') {
          expect(cspViolations.length).toBeGreaterThan(0);
        }
      });

      test('CSP nonce validation', async () => {
        await page.goto('/');
        
        // Get nonce from page
        const nonce = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[nonce]');
          return scripts.length > 0 ? scripts[0].getAttribute('nonce') : null;
        });
        
        if (nonce) {
          // Try to use the nonce
          const scriptExecuted = await page.evaluate((n) => {
            const script = document.createElement('script');
            script.setAttribute('nonce', n);
            script.textContent = 'window.nonceTest = true;';
            document.head.appendChild(script);
            // @ts-ignore
            return window.nonceTest === true;
          }, nonce);
          
          // Nonce should be single-use in strict implementations
          expect(scriptExecuted).toBe(browserName === 'chromium'); // Chrome is more permissive
        }
      });
    });

    test.describe('WebCrypto API Security', () => {
      test('crypto.subtle availability and usage', async () => {
        await page.goto('/');
        
        const cryptoSupport = await page.evaluate(async () => {
          if (!window.crypto || !window.crypto.subtle) {
            return { supported: false };
          }
          
          try {
            // Generate a key
            const key = await crypto.subtle.generateKey(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );
            
            // Test encryption
            const data = new TextEncoder().encode('sensitive data');
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              data
            );
            
            return {
              supported: true,
              keyGenerated: !!key,
              encryptionWorks: encrypted.byteLength > 0
            };
          } catch (error) {
            return { supported: true, error: error.message };
          }
        });
        
        // WebCrypto should be available in secure contexts
        expect(cryptoSupport.supported).toBe(true);
        if (page.url().startsWith('https://') || page.url().includes('localhost')) {
          expect(cryptoSupport.keyGenerated).toBe(true);
          expect(cryptoSupport.encryptionWorks).toBe(true);
        }
      });
    });

    test.describe('Form Security Across Browsers', () => {
      test('autofill security behavior', async () => {
        await loginPage.goto();
        
        // Check autocomplete attributes
        const emailAutocomplete = await loginPage.emailInput.getAttribute('autocomplete');
        const passwordAutocomplete = await loginPage.passwordInput.getAttribute('autocomplete');
        
        // Different browsers handle these differently
        if (browserName === 'chromium' || browserName.includes('chrome')) {
          expect(['email', 'username']).toContain(emailAutocomplete);
          expect(['current-password', 'off']).toContain(passwordAutocomplete);
        }
        
        // Test password manager integration
        await loginPage.emailInput.fill('test@example.com');
        await loginPage.passwordInput.fill('Test123!@#');
        
        // Submit and check if browser offers to save
        await loginPage.submitButton.click();
        
        // Note: Can't directly test password manager prompts in Playwright
        // but we can verify the form structure supports it
      });

      test('form submission security', async () => {
        await loginPage.goto();
        
        // Test form action and method
        const formAction = await page.locator('form').getAttribute('action');
        const formMethod = await page.locator('form').getAttribute('method');
        
        expect(formMethod?.toLowerCase()).toBe('post');
        expect(formAction).not.toContain('http://'); // Should use HTTPS or relative
        
        // Test hidden field injection prevention
        await page.evaluate(() => {
          const form = document.querySelector('form');
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'admin';
          input.value = 'true';
          form?.appendChild(input);
        });
        
        await loginPage.login('user@test.com', 'User123!@#');
        
        // Should not grant admin access
        const response = await page.waitForResponse(resp => resp.url().includes('/api/login'));
        const userData = await response.json();
        expect(userData.role).not.toBe('admin');
      });
    });

    test.describe('JavaScript API Security', () => {
      test('window.opener protection', async () => {
        await page.goto('/');
        
        // Create a link that opens in new window
        await page.evaluate(() => {
          const link = document.createElement('a');
          link.href = 'https://external-site.com';
          link.target = '_blank';
          link.textContent = 'External Link';
          document.body.appendChild(link);
        });
        
        // Click the link
        const [newPage] = await Promise.all([
          context.waitForEvent('page'),
          page.click('a[target="_blank"]')
        ]);
        
        // Check opener is nullified
        const openerAccess = await newPage.evaluate(() => {
          return window.opener !== null;
        });
        
        // Modern browsers should nullify opener for security
        if (browserName !== 'webkit') { // Safari handles this differently
          expect(openerAccess).toBe(false);
        }
        
        await newPage.close();
      });

      test('postMessage security', async () => {
        await page.goto('/');
        
        const messageReceived = await page.evaluate(() => {
          return new Promise((resolve) => {
            window.addEventListener('message', (event) => {
              resolve({
                origin: event.origin,
                data: event.data,
                hasSource: !!event.source
              });
            });
            
            // Send message to self
            window.postMessage({ test: 'data' }, '*');
          });
        });
        
        // @ts-ignore
        expect(messageReceived.origin).toBe(page.url().replace(/\/$/, ''));
        // @ts-ignore
        expect(messageReceived.hasSource).toBe(true);
      });
    });

    test.describe('Network Security Features', () => {
      test('mixed content blocking', async () => {
        // This test would run on HTTPS in production
        if (page.url().startsWith('https://')) {
          const mixedContentBlocked = await page.evaluate(async () => {
            try {
              // Try to load HTTP resource from HTTPS page
              const img = document.createElement('img');
              img.src = 'http://insecure-cdn.com/image.jpg';
              document.body.appendChild(img);
              
              await new Promise((resolve) => {
                img.onload = () => resolve(false);
                img.onerror = () => resolve(true);
              });
            } catch {
              return true;
            }
          });
          
          expect(mixedContentBlocked).toBe(true);
        }
      });

      test('HSTS header support', async () => {
        await page.goto('/');
        
        const response = await page.waitForResponse(resp => resp.url() === page.url());
        const hstsHeader = response.headers()['strict-transport-security'];
        
        if (page.url().startsWith('https://')) {
          expect(hstsHeader).toBeTruthy();
          expect(hstsHeader).toContain('max-age=');
          
          // Test HSTS preload
          if (browserName === 'chromium' || browserName === 'firefox') {
            expect(hstsHeader).toContain('includeSubDomains');
          }
        }
      });
    });

    test.describe('Performance Impact of Security', () => {
      test('security headers performance', async () => {
        const timings: number[] = [];
        
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          await page.goto('/', { waitUntil: 'networkidle' });
          timings.push(Date.now() - startTime);
        }
        
        const avgTime = timings.reduce((a, b) => a + b) / timings.length;
        
        // Security headers should not significantly impact performance
        expect(avgTime).toBeLessThan(2000); // 2 seconds max
        
        // Check all security headers are present despite performance
        const response = await page.waitForResponse(resp => resp.url() === page.url());
        const headers = response.headers();
        
        expect(headers['x-frame-options']).toBeTruthy();
        expect(headers['x-content-type-options']).toBeTruthy();
        expect(headers['content-security-policy']).toBeTruthy();
      });

      test('crypto operations performance', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'User123!@#');
        
        const cryptoPerformance = await page.evaluate(async () => {
          const iterations = 100;
          const startTime = performance.now();
          
          for (let i = 0; i < iterations; i++) {
            // Simulate password hashing
            const encoder = new TextEncoder();
            const data = encoder.encode('password' + i);
            await crypto.subtle.digest('SHA-256', data);
          }
          
          return performance.now() - startTime;
        });
        
        // Crypto operations should be reasonably fast
        expect(cryptoPerformance).toBeLessThan(1000); // 1 second for 100 operations
      });
    });
  });
}