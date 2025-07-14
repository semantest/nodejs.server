import { Page, Locator, BrowserContext } from '@playwright/test';

// Page Object for Login Page
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly csrfToken: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
    this.csrfToken = page.locator('input[name="csrf_token"]');
    this.rememberMeCheckbox = page.locator('input[name="remember"]');
    this.forgotPasswordLink = page.locator('a[href*="forgot-password"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    await this.submitButton.click();
  }

  async getCSRFToken(): Promise<string> {
    return await this.csrfToken.getAttribute('value') || '';
  }

  async isLoggedIn(): Promise<boolean> {
    const cookies = await this.page.context().cookies();
    return cookies.some(cookie => cookie.name === 'auth-token');
  }
}

// Page Object for Permission Dialog
export class PermissionDialog {
  readonly page: Page;
  readonly dialog: Locator;
  readonly title: Locator;
  readonly permissionsList: Locator;
  readonly allowButton: Locator;
  readonly denyButton: Locator;
  readonly rememberChoice: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('[data-testid="permission-dialog"]');
    this.title = this.dialog.locator('h2');
    this.permissionsList = this.dialog.locator('[data-testid="permissions-list"]');
    this.allowButton = this.dialog.locator('button:has-text("Allow")');
    this.denyButton = this.dialog.locator('button:has-text("Deny")');
    this.rememberChoice = this.dialog.locator('input[type="checkbox"]');
  }

  async waitForDialog() {
    await this.dialog.waitFor({ state: 'visible' });
  }

  async getRequestedPermissions(): Promise<string[]> {
    const items = await this.permissionsList.locator('li').all();
    return Promise.all(items.map(item => item.textContent() || ''));
  }

  async allow(remember = false) {
    if (remember) {
      await this.rememberChoice.check();
    }
    await this.allowButton.click();
  }

  async deny() {
    await this.denyButton.click();
  }
}

// Page Object for Extension Popup
export class ExtensionPopup {
  readonly page: Page;
  readonly statusIndicator: Locator;
  readonly permissionsButton: Locator;
  readonly loginButton: Locator;
  readonly logoutButton: Locator;
  readonly apiKeyInput: Locator;
  readonly saveApiKeyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusIndicator = page.locator('[data-testid="status-indicator"]');
    this.permissionsButton = page.locator('button:has-text("Manage Permissions")');
    this.loginButton = page.locator('button:has-text("Login")');
    this.logoutButton = page.locator('button:has-text("Logout")');
    this.apiKeyInput = page.locator('input[name="apiKey"]');
    this.saveApiKeyButton = page.locator('button:has-text("Save API Key")');
  }

  async getStatus(): Promise<string> {
    return await this.statusIndicator.textContent() || '';
  }

  async isAuthenticated(): Promise<boolean> {
    return await this.logoutButton.isVisible();
  }

  async setApiKey(apiKey: string) {
    await this.apiKeyInput.fill(apiKey);
    await this.saveApiKeyButton.click();
  }
}

// Security Test Helpers
export class SecurityTestHelpers {
  readonly page: Page;
  readonly context: BrowserContext;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
  }

  // Inject malicious scripts for XSS testing
  async injectXSSPayload(payload: string, selector: string) {
    await this.page.locator(selector).fill(payload);
  }

  // Manipulate cookies for session attacks
  async manipulateCookie(name: string, value: string) {
    const cookies = await this.context.cookies();
    const cookie = cookies.find(c => c.name === name);
    if (cookie) {
      await this.context.addCookies([{ ...cookie, value }]);
    }
  }

  // Simulate CSRF attack
  async simulateCSRFAttack(targetUrl: string, formData: Record<string, string>) {
    const attackPage = `
      <html>
        <body>
          <form id="csrf-form" action="${targetUrl}" method="POST">
            ${Object.entries(formData).map(([key, value]) => 
              `<input type="hidden" name="${key}" value="${value}" />`
            ).join('')}
          </form>
          <script>
            document.getElementById('csrf-form').submit();
          </script>
        </body>
      </html>
    `;
    
    await this.page.setContent(attackPage);
  }

  // Monitor network for security headers
  async checkSecurityHeaders(response: any): Promise<Record<string, string>> {
    const headers = response.headers();
    const securityHeaders: Record<string, string> = {};
    
    const importantHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy',
      'x-csrf-token',
      'x-rate-limit-limit',
      'x-rate-limit-remaining',
    ];
    
    for (const header of importantHeaders) {
      if (headers[header]) {
        securityHeaders[header] = headers[header];
      }
    }
    
    return securityHeaders;
  }

  // Generate attack payloads
  static getXSSPayloads(): string[] {
    return [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(`XSS`)">',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<textarea onfocus=alert("XSS") autofocus>',
      '<keygen onfocus=alert("XSS") autofocus>',
      '<video><source onerror="alert(\'XSS\')">',
    ];
  }

  static getSQLInjectionPayloads(): string[] {
    return [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1--",
      "1' AND '1'='1",
      "' OR 'x'='x",
    ];
  }

  // Rate limiting helper
  async triggerRateLimitExhaustion(endpoint: string, count: number) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        this.page.request.get(endpoint).catch(() => null)
      );
    }
    return Promise.all(promises);
  }
}

// Extension Test Helpers
export class ExtensionTestHelpers {
  static async loadExtension(context: BrowserContext, extensionPath: string) {
    // This would be implemented with actual Chrome extension loading
    // For now, we'll simulate it
    await context.addInitScript(() => {
      // @ts-ignore
      window.__EXTENSION_LOADED__ = true;
    });
  }

  static async getExtensionId(context: BrowserContext): Promise<string> {
    // Simulate getting extension ID
    return 'test-extension-id';
  }

  static async openExtensionPopup(context: BrowserContext, extensionId: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    return page;
  }
}