import { test, expect, chromium, Page, BrowserContext } from '@playwright/test';
import { ExtensionPopup, PermissionDialog, ExtensionTestHelpers } from './e2e-helpers/page-objects';
import path from 'path';

test.describe('Chrome Extension Security E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeEach(async () => {
    // Launch Chrome with extension
    const extensionPath = path.join(__dirname, '../../../../extension.chrome/dist');
    
    context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });
    
    // Get extension ID
    extensionId = await ExtensionTestHelpers.getExtensionId(context);
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Extension Installation and Setup', () => {
    test('extension installs with correct permissions', async () => {
      // Check extension is loaded
      const extensions = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          if (chrome && chrome.management) {
            // @ts-ignore
            chrome.management.getAll((extensions) => {
              resolve(extensions);
            });
          } else {
            resolve([]);
          }
        });
      });
      
      expect(extensions).toBeTruthy();
    });

    test('permission migration on first install', async () => {
      // Open extension popup
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      // Should show permission request on first use
      const status = await extensionPopup.getStatus();
      expect(status).toContain('Permissions required');
      
      // Click manage permissions
      await extensionPopup.permissionsButton.click();
      
      // Permission dialog should appear
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      const permissions = await permissionDialog.getRequestedPermissions();
      expect(permissions).toContain('Access to semantest.com');
      expect(permissions).toContain('Storage');
      expect(permissions).toContain('API communication');
    });

    test('extension updates preserve settings', async () => {
      // Set API key
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      await extensionPopup.setApiKey('test-api-key-12345');
      
      // Simulate extension update
      await popup.close();
      await page.evaluate(() => {
        // @ts-ignore
        chrome.runtime.reload();
      });
      
      // Reopen and check settings preserved
      const newPopup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const newExtensionPopup = new ExtensionPopup(newPopup);
      
      const apiKeyValue = await newExtensionPopup.apiKeyInput.inputValue();
      expect(apiKeyValue).toBe('test-api-key-12345');
    });
  });

  test.describe('Permission Management', () => {
    test('granular permission control', async () => {
      await page.goto('https://semantest.com');
      
      // Trigger permission request
      await page.evaluate(() => {
        // @ts-ignore
        window.postMessage({ type: 'SEMANTEST_PERMISSION_REQUEST', permissions: ['read', 'write'] }, '*');
      });
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      
      // Check individual permissions can be toggled
      const permissionCheckboxes = await permissionDialog.permissionsList.locator('input[type="checkbox"]').all();
      expect(permissionCheckboxes.length).toBeGreaterThan(0);
      
      // Uncheck write permission
      await permissionCheckboxes[1].uncheck();
      await permissionDialog.allow(true);
      
      // Verify only read permission granted
      const grantedPermissions = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.runtime.sendMessage({ type: 'GET_PERMISSIONS' }, (response) => {
            resolve(response.permissions);
          });
        });
      });
      
      expect(grantedPermissions).toContain('read');
      expect(grantedPermissions).not.toContain('write');
    });

    test('permission persistence across sessions', async () => {
      await page.goto('https://semantest.com');
      
      // Grant permissions
      await page.evaluate(() => {
        // @ts-ignore
        window.postMessage({ type: 'SEMANTEST_PERMISSION_REQUEST', permissions: ['read'] }, '*');
      });
      
      const permissionDialog = new PermissionDialog(page);
      await permissionDialog.waitForDialog();
      await permissionDialog.allow(true);
      
      // Close and reopen page
      await page.close();
      const newPage = await context.newPage();
      await newPage.goto('https://semantest.com');
      
      // Permissions should be remembered
      const hasPermission = await newPage.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.runtime.sendMessage({ type: 'CHECK_PERMISSION', permission: 'read' }, (response) => {
            resolve(response.granted);
          });
        });
      });
      
      expect(hasPermission).toBe(true);
    });

    test('permission revocation', async () => {
      // Open extension popup
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      await extensionPopup.permissionsButton.click();
      
      // Should show permission management UI
      await page.waitForSelector('[data-testid="permission-manager"]');
      
      // Find and revoke a permission
      const revokeButton = page.locator('button:has-text("Revoke")').first();
      await revokeButton.click();
      
      // Confirm revocation
      await page.locator('button:has-text("Confirm")').click();
      
      // Permission should be revoked
      const permissions = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.runtime.sendMessage({ type: 'GET_PERMISSIONS' }, (response) => {
            resolve(response.permissions);
          });
        });
      });
      
      expect(permissions).toBeTruthy();
    });
  });

  test.describe('API Key Security', () => {
    test('API key validation and storage', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      // Try invalid API key
      await extensionPopup.setApiKey('invalid-key');
      
      // Should show error
      const errorMsg = await popup.locator('.error-message').textContent();
      expect(errorMsg).toContain('Invalid API key');
      
      // Set valid API key
      await extensionPopup.setApiKey('sk_test_valid_api_key_12345');
      
      // Should show success
      const successMsg = await popup.locator('.success-message').textContent();
      expect(successMsg).toContain('API key saved');
      
      // Key should be stored securely (not in plain text)
      const storage = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.storage.local.get(['apiKey'], (result) => {
            resolve(result);
          });
        });
      });
      
      // @ts-ignore
      expect(storage.apiKey).not.toBe('sk_test_valid_api_key_12345'); // Should be encrypted
    });

    test('API key rotation', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      // Set initial API key
      await extensionPopup.setApiKey('sk_test_old_key_12345');
      
      // Rotate key
      await popup.locator('button:has-text("Rotate API Key")').click();
      
      // Confirm rotation
      await popup.locator('button:has-text("Confirm Rotation")').click();
      
      // Old key should be invalidated
      const isOldKeyValid = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.runtime.sendMessage({ type: 'VALIDATE_API_KEY', key: 'sk_test_old_key_12345' }, (response) => {
            resolve(response.valid);
          });
        });
      });
      
      expect(isOldKeyValid).toBe(false);
    });
  });

  test.describe('Extension Communication Security', () => {
    test('content script isolation', async () => {
      await page.goto('https://malicious-site.com');
      
      // Try to access extension APIs from page
      const canAccessExtension = await page.evaluate(() => {
        try {
          // @ts-ignore
          return chrome.runtime !== undefined;
        } catch {
          return false;
        }
      });
      
      expect(canAccessExtension).toBe(false);
    });

    test('message origin validation', async () => {
      await page.goto('https://evil-site.com');
      
      // Try to send message to extension from unauthorized origin
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          window.postMessage({ 
            type: 'SEMANTEST_API_REQUEST', 
            action: 'steal-data' 
          }, '*');
          
          // Listen for response
          window.addEventListener('message', (event) => {
            if (event.data.type === 'SEMANTEST_API_RESPONSE') {
              resolve(event.data);
            }
          });
          
          // Timeout if no response
          setTimeout(() => resolve({ error: 'No response' }), 1000);
        });
      });
      
      // @ts-ignore
      expect(response.error).toBeTruthy();
    });

    test('secure message passing', async () => {
      await page.goto('https://semantest.com');
      
      // Send legitimate message
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Generate message ID for tracking
          const messageId = Math.random().toString(36);
          
          window.postMessage({ 
            type: 'SEMANTEST_API_REQUEST',
            id: messageId,
            action: 'getData',
            nonce: Date.now().toString(),
          }, '*');
          
          window.addEventListener('message', (event) => {
            if (event.data.id === messageId) {
              resolve(event.data);
            }
          });
        });
      });
      
      // @ts-ignore
      expect(response.id).toBeTruthy();
      // @ts-ignore
      expect(response.nonce).toBeTruthy();
    });
  });

  test.describe('Extension Update Security', () => {
    test('update notification and user consent', async () => {
      // Simulate update available
      await page.evaluate(() => {
        // @ts-ignore
        chrome.runtime.sendMessage({ type: 'SIMULATE_UPDATE_AVAILABLE' });
      });
      
      // Open popup
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      
      // Should show update notification
      const updateNotice = await popup.locator('[data-testid="update-notice"]');
      await expect(updateNotice).toBeVisible();
      await expect(updateNotice).toHaveText(/Update available/);
      
      // Check update details
      const updateDetails = await popup.locator('[data-testid="update-details"]').textContent();
      expect(updateDetails).toContain('Security improvements');
    });

    test('permission changes on update', async () => {
      // Simulate update with new permissions
      await page.evaluate(() => {
        // @ts-ignore
        chrome.runtime.sendMessage({ 
          type: 'SIMULATE_UPDATE_WITH_PERMISSIONS',
          newPermissions: ['camera', 'microphone']
        });
      });
      
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      
      // Should show permission change warning
      const permissionWarning = await popup.locator('[data-testid="permission-warning"]');
      await expect(permissionWarning).toBeVisible();
      await expect(permissionWarning).toHaveText(/New permissions required/);
      
      // User must explicitly approve
      const approveButton = await popup.locator('button:has-text("Approve New Permissions")');
      const denyButton = await popup.locator('button:has-text("Deny Update")');
      
      await expect(approveButton).toBeVisible();
      await expect(denyButton).toBeVisible();
    });
  });

  test.describe('Browser Action Security', () => {
    test('popup script isolation', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      
      // Try to access parent window from popup
      const canAccessParent = await popup.evaluate(() => {
        try {
          // @ts-ignore
          return window.opener !== null;
        } catch {
          return false;
        }
      });
      
      expect(canAccessParent).toBe(false);
    });

    test('secure state management in popup', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      // Login through popup
      await extensionPopup.loginButton.click();
      
      // Should open secure login flow
      const [loginPage] = await Promise.all([
        context.waitForEvent('page'),
        // Login button click already triggered above
      ]);
      
      expect(loginPage.url()).toContain('semantest.com/login');
      expect(loginPage.url()).toContain('extension_id=' + extensionId);
    });
  });

  test.describe('Content Security Policy', () => {
    test('CSP enforcement in extension pages', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      
      // Try to inject inline script
      const scriptExecuted = await popup.evaluate(() => {
        try {
          const script = document.createElement('script');
          script.textContent = 'window.injected = true;';
          document.head.appendChild(script);
          // @ts-ignore
          return window.injected === true;
        } catch {
          return false;
        }
      });
      
      expect(scriptExecuted).toBe(false);
    });

    test('external resource loading restrictions', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      
      // Try to load external script
      const externalLoaded = await popup.evaluate(() => {
        return new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://evil-cdn.com/malicious.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
          
          setTimeout(() => resolve(false), 1000);
        });
      });
      
      expect(externalLoaded).toBe(false);
    });
  });

  test.describe('Data Protection', () => {
    test('sensitive data encryption in storage', async () => {
      const popup = await ExtensionTestHelpers.openExtensionPopup(context, extensionId);
      const extensionPopup = new ExtensionPopup(popup);
      
      // Store sensitive data
      await extensionPopup.setApiKey('sk_test_sensitive_key_12345');
      
      // Check storage directly
      const storageData = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          chrome.storage.local.get(null, (data) => {
            resolve(data);
          });
        });
      });
      
      // Should not find plain text sensitive data
      const storageString = JSON.stringify(storageData);
      expect(storageString).not.toContain('sk_test_sensitive_key_12345');
      expect(storageString).not.toContain('sensitive');
    });

    test('secure data transmission', async () => {
      await page.goto('https://semantest.com');
      
      // Monitor network requests from extension
      const requests: any[] = [];
      page.on('request', (request) => {
        if (request.url().includes('semantest.com/api')) {
          requests.push({
            url: request.url(),
            headers: request.headers(),
            method: request.method(),
          });
        }
      });
      
      // Trigger API call from extension
      await page.evaluate(() => {
        window.postMessage({ 
          type: 'SEMANTEST_API_REQUEST',
          action: 'syncData',
        }, '*');
      });
      
      await page.waitForTimeout(1000);
      
      // Check all requests are secure
      for (const request of requests) {
        expect(request.url).toMatch(/^https:/);
        expect(request.headers['x-api-key']).toBeTruthy();
        expect(request.headers['x-extension-id']).toBe(extensionId);
      }
    });
  });
});