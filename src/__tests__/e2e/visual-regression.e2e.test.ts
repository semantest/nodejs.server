import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage, PermissionDialog } from './e2e-helpers/page-objects';

test.describe('Visual Regression Tests for Security Components', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2, // High DPI for better screenshots
      colorScheme: 'light'
    });
    page = await context.newPage();
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Login Page Visual Tests', () => {
    test('login page default state', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      // Wait for all fonts to load
      await page.evaluate(() => document.fonts.ready);
      
      // Full page screenshot
      await expect(page).toHaveScreenshot('login-page-default.png', {
        fullPage: true,
        animations: 'disabled'
      });
      
      // Login form specifically
      const loginForm = page.locator('form');
      await expect(loginForm).toHaveScreenshot('login-form-default.png');
    });

    test('login page with validation errors', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      // Trigger validation errors
      await loginPage.submitButton.click();
      
      await expect(loginPage.errorMessage).toBeVisible();
      
      // Screenshot with errors
      await expect(page).toHaveScreenshot('login-page-validation-errors.png', {
        fullPage: true
      });
      
      // Error message styling
      await expect(loginPage.errorMessage).toHaveScreenshot('error-message.png');
    });

    test('login page focused states', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      // Focus email field
      await loginPage.emailInput.focus();
      await expect(loginPage.emailInput).toHaveScreenshot('input-focused.png');
      
      // Focus password field
      await loginPage.passwordInput.focus();
      await expect(loginPage.passwordInput).toHaveScreenshot('password-input-focused.png');
      
      // Hover submit button
      await loginPage.submitButton.hover();
      await expect(loginPage.submitButton).toHaveScreenshot('submit-button-hover.png');
    });

    test('login page with filled form', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      await loginPage.emailInput.fill('user@example.com');
      await loginPage.passwordInput.fill('••••••••');
      await loginPage.rememberMeCheckbox.check();
      
      await expect(page).toHaveScreenshot('login-page-filled.png', {
        fullPage: true
      });
    });

    test('login page password visibility toggle', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      await loginPage.passwordInput.fill('MyPassword123');
      
      // Show password
      const toggleButton = page.locator('[data-testid="toggle-password-visibility"]');
      await toggleButton.click();
      
      await expect(loginPage.passwordInput).toHaveScreenshot('password-visible.png');
      
      // Hide password again
      await toggleButton.click();
      await expect(loginPage.passwordInput).toHaveScreenshot('password-hidden.png');
    });
  });

  test.describe('Permission Dialog Visual Tests', () => {
    test('permission dialog default state', async () => {
      await page.goto('/test-permission-dialog');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      await expect(permissionDialog.dialog).toHaveScreenshot('permission-dialog-default.png');
    });

    test('permission dialog with multiple permissions', async () => {
      await page.goto('/test-permission-dialog?permissions=read,write,delete,admin');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      await expect(permissionDialog.dialog).toHaveScreenshot('permission-dialog-multiple.png');
    });

    test('permission dialog hover states', async () => {
      await page.goto('/test-permission-dialog');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      // Hover allow button
      await permissionDialog.allowButton.hover();
      await expect(permissionDialog.allowButton).toHaveScreenshot('allow-button-hover.png');
      
      // Hover deny button
      await permissionDialog.denyButton.hover();
      await expect(permissionDialog.denyButton).toHaveScreenshot('deny-button-hover.png');
    });

    test('permission dialog with remember checked', async () => {
      await page.goto('/test-permission-dialog');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      await permissionDialog.rememberChoice.check();
      await expect(permissionDialog.dialog).toHaveScreenshot('permission-dialog-remember.png');
    });
  });

  test.describe('Security Alerts Visual Tests', () => {
    test('security warning banner', async () => {
      await page.goto('/dashboard?security-warning=true');
      
      const warningBanner = page.locator('[data-testid="security-warning-banner"]');
      await expect(warningBanner).toBeVisible();
      
      await expect(warningBanner).toHaveScreenshot('security-warning-banner.png');
    });

    test('session timeout warning', async () => {
      await page.goto('/dashboard?session-warning=true');
      
      const sessionWarning = page.locator('[data-testid="session-warning"]');
      await expect(sessionWarning).toBeVisible();
      
      await expect(sessionWarning).toHaveScreenshot('session-timeout-warning.png');
    });

    test('suspicious activity alert', async () => {
      await page.goto('/dashboard?suspicious-activity=true');
      
      const suspiciousAlert = page.locator('[data-testid="suspicious-activity-alert"]');
      await expect(suspiciousAlert).toBeVisible();
      
      await expect(suspiciousAlert).toHaveScreenshot('suspicious-activity-alert.png');
    });

    test('rate limit warning', async () => {
      await page.goto('/dashboard?rate-limited=true');
      
      const rateLimitWarning = page.locator('[data-testid="rate-limit-warning"]');
      await expect(rateLimitWarning).toBeVisible();
      
      await expect(rateLimitWarning).toHaveScreenshot('rate-limit-warning.png');
    });
  });

  test.describe('Two-Factor Authentication Visual Tests', () => {
    test('2FA setup QR code', async () => {
      await page.goto('/settings/2fa-setup');
      
      const qrCodeSection = page.locator('[data-testid="2fa-qr-section"]');
      await expect(qrCodeSection).toBeVisible();
      
      await expect(qrCodeSection).toHaveScreenshot('2fa-qr-code-section.png');
    });

    test('2FA input field', async () => {
      await page.goto('/two-factor');
      
      const totpInput = page.locator('[data-testid="totp-input"]');
      await expect(totpInput).toBeVisible();
      
      // Empty state
      await expect(totpInput).toHaveScreenshot('2fa-input-empty.png');
      
      // Partial input
      await totpInput.fill('123');
      await expect(totpInput).toHaveScreenshot('2fa-input-partial.png');
      
      // Complete input
      await totpInput.fill('123456');
      await expect(totpInput).toHaveScreenshot('2fa-input-complete.png');
    });

    test('backup codes display', async () => {
      await page.goto('/settings/backup-codes');
      
      const backupCodesSection = page.locator('[data-testid="backup-codes-section"]');
      await expect(backupCodesSection).toBeVisible();
      
      await expect(backupCodesSection).toHaveScreenshot('backup-codes-display.png');
    });
  });

  test.describe('Password Strength Indicator Visual Tests', () => {
    test('password strength levels', async () => {
      await page.goto('/register');
      
      const passwordInput = page.locator('input[name="password"]');
      const strengthIndicator = page.locator('[data-testid="password-strength"]');
      
      // Weak password
      await passwordInput.fill('abc123');
      await expect(strengthIndicator).toHaveScreenshot('password-strength-weak.png');
      
      // Medium password
      await passwordInput.fill('Abc123!');
      await expect(strengthIndicator).toHaveScreenshot('password-strength-medium.png');
      
      // Strong password
      await passwordInput.fill('MyStr0ng!P@ssw0rd123');
      await expect(strengthIndicator).toHaveScreenshot('password-strength-strong.png');
    });

    test('password requirements checklist', async () => {
      await page.goto('/register');
      
      const passwordInput = page.locator('input[name="password"]');
      const requirements = page.locator('[data-testid="password-requirements"]');
      
      // No requirements met
      await expect(requirements).toHaveScreenshot('password-requirements-none.png');
      
      // Some requirements met
      await passwordInput.fill('Abc123');
      await expect(requirements).toHaveScreenshot('password-requirements-partial.png');
      
      // All requirements met
      await passwordInput.fill('MyStr0ng!P@ssw0rd123');
      await expect(requirements).toHaveScreenshot('password-requirements-complete.png');
    });
  });

  test.describe('Dark Mode Security Components', () => {
    test.beforeEach(async () => {
      // Switch to dark mode
      await context.close();
      context = await page.context().browser()!.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 2,
        colorScheme: 'dark'
      });
      page = await context.newPage();
    });

    test('login page dark mode', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      await expect(page).toHaveScreenshot('login-page-dark-mode.png', {
        fullPage: true
      });
    });

    test('security alerts dark mode', async () => {
      await page.goto('/dashboard?security-warning=true');
      
      const warningBanner = page.locator('[data-testid="security-warning-banner"]');
      await expect(warningBanner).toBeVisible();
      
      await expect(warningBanner).toHaveScreenshot('security-warning-banner-dark.png');
    });

    test('permission dialog dark mode', async () => {
      await page.goto('/test-permission-dialog');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      await expect(permissionDialog.dialog).toHaveScreenshot('permission-dialog-dark.png');
    });
  });

  test.describe('Responsive Security Components', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];

    for (const viewport of viewports) {
      test(`login page on ${viewport.name}`, async () => {
        await page.setViewportSize(viewport);
        
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        
        await expect(page).toHaveScreenshot(`login-page-${viewport.name}.png`, {
          fullPage: true
        });
      });

      test(`permission dialog on ${viewport.name}`, async () => {
        await page.setViewportSize(viewport);
        await page.goto('/test-permission-dialog');
        
        const permissionDialog = new PermissionDialog(page);
        await permissionDialog.waitForDialog();
        
        await expect(permissionDialog.dialog).toHaveScreenshot(`permission-dialog-${viewport.name}.png`);
      });
    }
  });

  test.describe('Loading States Visual Tests', () => {
    test('login button loading state', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      // Trigger loading state
      await page.evaluate(() => {
        const button = document.querySelector('button[type="submit"]');
        button?.classList.add('loading');
      });
      
      await expect(loginPage.submitButton).toHaveScreenshot('login-button-loading.png');
    });

    test('permission dialog loading state', async () => {
      await page.goto('/test-permission-dialog?loading=true');
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      await expect(permissionDialog.dialog).toHaveScreenshot('permission-dialog-loading.png');
    });
  });

  test.describe('Error States Visual Tests', () => {
    test('network error display', async () => {
      await page.goto('/error?type=network');
      
      const errorDisplay = page.locator('[data-testid="error-display"]');
      await expect(errorDisplay).toBeVisible();
      
      await expect(errorDisplay).toHaveScreenshot('network-error.png');
    });

    test('authentication error display', async () => {
      await page.goto('/error?type=auth');
      
      const errorDisplay = page.locator('[data-testid="error-display"]');
      await expect(errorDisplay).toBeVisible();
      
      await expect(errorDisplay).toHaveScreenshot('auth-error.png');
    });

    test('rate limit error display', async () => {
      await page.goto('/error?type=rate-limit');
      
      const errorDisplay = page.locator('[data-testid="error-display"]');
      await expect(errorDisplay).toBeVisible();
      
      await expect(errorDisplay).toHaveScreenshot('rate-limit-error.png');
    });
  });

  test.describe('Accessibility Visual Tests', () => {
    test('high contrast mode', async () => {
      // Enable high contrast
      await page.emulateMedia({ forcedColors: 'active' });
      
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      await expect(page).toHaveScreenshot('login-page-high-contrast.png', {
        fullPage: true
      });
    });

    test('focus indicators', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveScreenshot('focus-indicator-1.png');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveScreenshot('focus-indicator-2.png');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveScreenshot('focus-indicator-3.png');
    });
  });
});