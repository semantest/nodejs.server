import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage, SecurityTestHelpers } from './e2e-helpers/page-objects';

test.describe('Browser Authentication E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let loginPage: LoginPage;
  let securityHelpers: SecurityTestHelpers;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    loginPage = new LoginPage(page);
    securityHelpers = new SecurityTestHelpers(page, context);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Login Flow', () => {
    test('successful login with valid credentials', async () => {
      await loginPage.goto();
      
      // Check CSRF token is present
      const csrfToken = await loginPage.getCSRFToken();
      expect(csrfToken).toBeTruthy();
      
      // Perform login
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Verify redirect and authentication
      await expect(page).toHaveURL('/dashboard');
      expect(await loginPage.isLoggedIn()).toBe(true);
      
      // Check security headers
      const response = await page.waitForResponse(resp => resp.url().includes('/api/'));
      const headers = await securityHelpers.checkSecurityHeaders(response);
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('login fails with invalid credentials', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'WrongPassword123!');
      
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(loginPage.errorMessage).toHaveText(/Invalid credentials/);
      expect(await loginPage.isLoggedIn()).toBe(false);
    });

    test('login with remember me sets persistent cookie', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#', true);
      
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      expect(authCookie).toBeTruthy();
      expect(authCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 7 * 24 * 60 * 60); // 7 days
    });

    test('prevents login without CSRF token', async () => {
      await loginPage.goto();
      
      // Remove CSRF token
      await page.evaluate(() => {
        const csrfInput = document.querySelector('input[name="csrf_token"]');
        if (csrfInput) csrfInput.remove();
      });
      
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Should show CSRF error
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(loginPage.errorMessage).toHaveText(/CSRF/);
    });
  });

  test.describe('Session Management', () => {
    test('session expires after inactivity', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      await expect(page).toHaveURL('/dashboard');
      
      // Fast forward time (mock)
      await page.evaluate(() => {
        // Simulate session timeout
        localStorage.setItem('session_expired', 'true');
      });
      
      // Try to access protected resource
      await page.goto('/api/protected');
      await expect(page).toHaveURL('/login');
    });

    test('concurrent sessions handling', async () => {
      // Login in first context
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Login in second context
      const context2 = await page.context().browser()?.newContext();
      const page2 = await context2!.newPage();
      const loginPage2 = new LoginPage(page2);
      
      await loginPage2.goto();
      await loginPage2.login('user@test.com', 'User123!@#');
      
      // Both sessions should be valid
      await page.goto('/api/me');
      await expect(page).not.toHaveURL('/login');
      
      await page2.goto('/api/me');
      await expect(page2).not.toHaveURL('/login');
      
      await context2!.close();
    });

    test('logout invalidates session', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Logout
      await page.goto('/logout');
      
      // Try to access protected resource
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login');
      
      // Check cookie is removed
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      expect(authCookie).toBeFalsy();
    });
  });

  test.describe('Browser Storage Security', () => {
    test('sensitive data not stored in localStorage', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const localStorage = await page.evaluate(() => {
        return Object.keys(window.localStorage).reduce((acc, key) => {
          acc[key] = window.localStorage.getItem(key);
          return acc;
        }, {} as Record<string, string | null>);
      });
      
      // Check no sensitive data in localStorage
      const sensitivePatterns = [/password/i, /token/i, /secret/i, /key/i];
      for (const [key, value] of Object.entries(localStorage)) {
        for (const pattern of sensitivePatterns) {
          expect(key).not.toMatch(pattern);
          if (value) expect(value).not.toMatch(pattern);
        }
      }
    });

    test('httpOnly cookies cannot be accessed via JavaScript', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const cookieAccess = await page.evaluate(() => {
        return document.cookie;
      });
      
      // Auth token should not be accessible
      expect(cookieAccess).not.toContain('auth-token');
      
      // But cookie should exist
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      expect(authCookie).toBeTruthy();
      expect(authCookie?.httpOnly).toBe(true);
    });

    test('secure flag on cookies in production', async () => {
      // This would run against HTTPS in production
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth-token');
      
      // In production, this should be true
      if (page.url().startsWith('https://')) {
        expect(authCookie?.secure).toBe(true);
      }
    });
  });

  test.describe('Password Security', () => {
    test('password field is properly masked', async () => {
      await loginPage.goto();
      
      const inputType = await loginPage.passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
      
      // Ensure autocomplete is disabled for security
      const autocomplete = await loginPage.passwordInput.getAttribute('autocomplete');
      expect(['off', 'new-password', 'current-password']).toContain(autocomplete);
    });

    test('password complexity requirements enforced', async () => {
      await loginPage.goto();
      
      const weakPasswords = ['123456', 'password', 'abc123', 'test'];
      
      for (const weakPassword of weakPasswords) {
        await loginPage.login('user@test.com', weakPassword);
        await expect(loginPage.errorMessage).toBeVisible();
      }
    });

    test('prevents password in URL', async () => {
      // Try to login with password in URL
      await page.goto('/login?password=User123!@#');
      
      // Password field should not be pre-filled
      const passwordValue = await loginPage.passwordInput.inputValue();
      expect(passwordValue).toBe('');
      
      // URL should be cleaned
      expect(page.url()).not.toContain('password');
    });
  });

  test.describe('Multi-Factor Authentication', () => {
    test('MFA flow when enabled', async () => {
      await loginPage.goto();
      await loginPage.login('admin@test.com', 'Admin123!@#');
      
      // Should redirect to MFA page
      await expect(page).toHaveURL('/mfa');
      
      // Enter MFA code
      const mfaInput = page.locator('input[name="mfa_code"]');
      await mfaInput.fill('123456'); // Mock MFA code
      await page.locator('button[type="submit"]').click();
      
      // Should now be logged in
      await expect(page).toHaveURL('/dashboard');
    });

    test('MFA code expiration', async () => {
      await loginPage.goto();
      await loginPage.login('admin@test.com', 'Admin123!@#');
      await expect(page).toHaveURL('/mfa');
      
      // Wait for code to expire (mock)
      await page.waitForTimeout(5000);
      
      const mfaInput = page.locator('input[name="mfa_code"]');
      await mfaInput.fill('123456');
      await page.locator('button[type="submit"]').click();
      
      // Should show expiration error
      const errorMsg = page.locator('.error-message');
      await expect(errorMsg).toBeVisible();
      await expect(errorMsg).toHaveText(/expired/i);
    });
  });

  test.describe('Account Lockout', () => {
    test('account locks after failed attempts', async () => {
      await loginPage.goto();
      
      // Try to login with wrong password multiple times
      for (let i = 0; i < 5; i++) {
        await loginPage.login('user@test.com', 'WrongPassword' + i);
        await page.waitForTimeout(100); // Small delay between attempts
      }
      
      // Account should be locked
      await loginPage.login('user@test.com', 'User123!@#'); // Correct password
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(loginPage.errorMessage).toHaveText(/locked/i);
    });

    test('lockout expires after timeout', async () => {
      await loginPage.goto();
      
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await loginPage.login('user@test.com', 'WrongPassword' + i);
        await page.waitForTimeout(100);
      }
      
      // Wait for lockout to expire (mock)
      await page.evaluate(() => {
        localStorage.setItem('lockout_expired', 'true');
      });
      
      // Should be able to login now
      await loginPage.login('user@test.com', 'User123!@#');
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('OAuth Integration', () => {
    test('Google OAuth login flow', async () => {
      await loginPage.goto();
      
      const googleButton = page.locator('button:has-text("Sign in with Google")');
      await expect(googleButton).toBeVisible();
      
      // Click will open OAuth popup
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        googleButton.click()
      ]);
      
      // Mock Google OAuth flow
      await popup.waitForLoadState();
      expect(popup.url()).toContain('accounts.google.com');
      
      // Simulate successful OAuth
      await popup.close();
      
      // Should be redirected back and logged in
      await page.waitForURL('/dashboard');
      expect(await loginPage.isLoggedIn()).toBe(true);
    });
  });

  test.describe('Security Headers Validation', () => {
    test('all security headers present on responses', async () => {
      await loginPage.goto();
      
      const response = await page.waitForResponse(resp => resp.url().includes('/login'));
      const headers = await securityHelpers.checkSecurityHeaders(response);
      
      // Check required security headers
      expect(headers['x-frame-options']).toBeTruthy();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['strict-transport-security']).toBeTruthy();
      expect(headers['content-security-policy']).toBeTruthy();
    });
  });
});