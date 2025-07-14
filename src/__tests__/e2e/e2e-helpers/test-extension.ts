import { chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

// Chrome Extension Test Harness
export class ExtensionTestHarness {
  private extensionPath: string;
  private context: BrowserContext | null = null;
  
  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }
  
  async loadExtension(options: {
    permissions?: string[];
    headless?: boolean;
  } = {}) {
    const { permissions = [], headless = false } = options;
    
    // Create manifest override if needed
    if (permissions.length > 0) {
      await this.overrideManifestPermissions(permissions);
    }
    
    // Launch browser with extension
    this.context = await chromium.launchPersistentContext('', {
      headless, // Extensions require non-headless mode
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      // Additional permissions for testing
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    
    return this.context;
  }
  
  async getExtensionId(): Promise<string> {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    // Get extension ID from chrome://extensions
    const page = await this.context.newPage();
    await page.goto('chrome://extensions');
    
    // Enable developer mode
    await page.evaluate(() => {
      // @ts-ignore
      chrome.developerPrivate.updateExtensionConfiguration({
        autoUpdate: false,
        showWarnings: true,
      });
    });
    
    // Get extension info
    const extensionId = await page.evaluate(() => {
      // @ts-ignore
      const extensions = document.querySelector('extensions-manager').extensions_;
      return extensions[0]?.id || 'test-extension-id';
    });
    
    await page.close();
    return extensionId;
  }
  
  async openPopup(extensionId: string) {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    const popup = await this.context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    return popup;
  }
  
  async openOptionsPage(extensionId: string) {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    const options = await this.context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    return options;
  }
  
  async getBackgroundPage(extensionId: string) {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    // Access background page context
    const targets = this.context.serviceWorkers();
    const backgroundTarget = targets.find(target => 
      target.url().includes(extensionId)
    );
    
    return backgroundTarget;
  }
  
  async injectContentScript(page: any, scriptPath: string) {
    const script = await fs.readFile(
      path.join(this.extensionPath, scriptPath),
      'utf-8'
    );
    
    await page.addScriptTag({ content: script });
  }
  
  async simulateInstall() {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    // Clear all extension data
    await this.context.clearCookies();
    await this.context.clearPermissions();
    
    // Simulate first install
    const page = await this.context.newPage();
    await page.evaluate(() => {
      // @ts-ignore
      chrome.storage.local.clear();
      // @ts-ignore
      chrome.storage.sync.clear();
    });
    
    await page.close();
  }
  
  async simulateUpdate(newVersion: string) {
    // Update manifest version
    const manifestPath = path.join(this.extensionPath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    
    const oldVersion = manifest.version;
    manifest.version = newVersion;
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Reload extension
    if (this.context) {
      const page = await this.context.newPage();
      await page.evaluate(() => {
        // @ts-ignore
        chrome.runtime.reload();
      });
      await page.close();
    }
    
    // Restore old version for cleanup
    manifest.version = oldVersion;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  async grantPermission(permission: string, origin = '*://semantest.com/*') {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    await this.context.grantPermissions([permission], { origin });
  }
  
  async revokePermission(permission: string) {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    // Clear specific permission
    const page = await this.context.newPage();
    await page.evaluate((perm) => {
      // @ts-ignore
      chrome.permissions.remove({ permissions: [perm] });
    }, permission);
    await page.close();
  }
  
  async getStorageData(storageType: 'local' | 'sync' = 'local') {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    const page = await this.context.newPage();
    const data = await page.evaluate((type) => {
      return new Promise((resolve) => {
        // @ts-ignore
        chrome.storage[type].get(null, resolve);
      });
    }, storageType);
    
    await page.close();
    return data;
  }
  
  async setStorageData(data: Record<string, any>, storageType: 'local' | 'sync' = 'local') {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    const page = await this.context.newPage();
    await page.evaluate((d, type) => {
      return new Promise((resolve) => {
        // @ts-ignore
        chrome.storage[type].set(d, resolve);
      });
    }, data, storageType);
    
    await page.close();
  }
  
  async sendMessage(message: any) {
    if (!this.context) {
      throw new Error('Extension not loaded');
    }
    
    const extensionId = await this.getExtensionId();
    const page = await this.context.newPage();
    
    const response = await page.evaluate((id, msg) => {
      return new Promise((resolve) => {
        // @ts-ignore
        chrome.runtime.sendMessage(id, msg, resolve);
      });
    }, extensionId, message);
    
    await page.close();
    return response;
  }
  
  async cleanup() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
  
  private async overrideManifestPermissions(permissions: string[]) {
    const manifestPath = path.join(this.extensionPath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    
    // Backup original
    await fs.writeFile(
      path.join(this.extensionPath, 'manifest.backup.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Override permissions
    manifest.permissions = permissions;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  async restoreManifest() {
    const backupPath = path.join(this.extensionPath, 'manifest.backup.json');
    const manifestPath = path.join(this.extensionPath, 'manifest.json');
    
    try {
      const backup = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(manifestPath, backup);
      await fs.unlink(backupPath);
    } catch (error) {
      // No backup to restore
    }
  }
}

// Mock Extension Builder for testing
export class MockExtensionBuilder {
  private manifest: any = {
    manifest_version: 3,
    name: 'Test Extension',
    version: '1.0.0',
    permissions: [],
    host_permissions: [],
    action: {
      default_popup: 'popup.html'
    }
  };
  
  private files: Map<string, string> = new Map();
  
  constructor() {
    // Add default popup
    this.addFile('popup.html', `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Extension</title>
          <style>
            body { width: 300px; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>Test Extension</h1>
          <div id="content"></div>
          <script src="popup.js"></script>
        </body>
      </html>
    `);
    
    this.addFile('popup.js', `
      console.log('Test extension popup loaded');
    `);
  }
  
  addPermission(permission: string) {
    this.manifest.permissions.push(permission);
    return this;
  }
  
  addHostPermission(pattern: string) {
    this.manifest.host_permissions.push(pattern);
    return this;
  }
  
  addContentScript(matches: string[], js: string[]) {
    if (!this.manifest.content_scripts) {
      this.manifest.content_scripts = [];
    }
    
    this.manifest.content_scripts.push({ matches, js });
    return this;
  }
  
  addFile(filename: string, content: string) {
    this.files.set(filename, content);
    return this;
  }
  
  setBackground(serviceWorker: string) {
    this.manifest.background = { service_worker: serviceWorker };
    return this;
  }
  
  async build(outputPath: string) {
    // Create directory
    await fs.mkdir(outputPath, { recursive: true });
    
    // Write manifest
    await fs.writeFile(
      path.join(outputPath, 'manifest.json'),
      JSON.stringify(this.manifest, null, 2)
    );
    
    // Write all files
    for (const [filename, content] of this.files) {
      const filePath = path.join(outputPath, filename);
      const dir = path.dirname(filePath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content);
    }
    
    return outputPath;
  }
}

// Extension Security Test Utilities
export class ExtensionSecurityTester {
  static async testCSPViolation(page: any, violationType: string) {
    const violations: any[] = [];
    
    page.on('console', (msg: any) => {
      if (msg.text().includes('Content Security Policy')) {
        violations.push({
          type: violationType,
          message: msg.text(),
          location: msg.location()
        });
      }
    });
    
    return violations;
  }
  
  static async testPermissionEscalation(harness: ExtensionTestHarness) {
    const results = {
      canAccessAllUrls: false,
      canAccessFileUrls: false,
      canAccessChromeUrls: false,
      unauthorizedApis: []
    };
    
    const page = await harness.context!.newPage();
    
    // Test various permission escalations
    results.canAccessAllUrls = await page.evaluate(() => {
      try {
        // @ts-ignore
        return chrome.permissions.contains({ origins: ['<all_urls>'] });
      } catch {
        return false;
      }
    });
    
    await page.close();
    return results;
  }
  
  static async testMessageSecurity(page: any) {
    // Inject message interceptor
    await page.evaluate(() => {
      const messages: any[] = [];
      
      // Intercept postMessage
      const originalPostMessage = window.postMessage;
      window.postMessage = function(...args) {
        messages.push({
          type: 'postMessage',
          data: args[0],
          origin: args[1]
        });
        return originalPostMessage.apply(window, args);
      };
      
      // Store for retrieval
      // @ts-ignore
      window.__interceptedMessages = messages;
    });
  }
  
  static async testStorageEncryption(harness: ExtensionTestHarness) {
    // Store sensitive data
    await harness.setStorageData({
      apiKey: 'sk_test_sensitive_key',
      userToken: 'sensitive_token',
      password: 'should_not_store_this'
    });
    
    // Get raw storage data
    const data = await harness.getStorageData();
    
    // Check if sensitive data is encrypted
    const rawDataString = JSON.stringify(data);
    
    return {
      apiKeyEncrypted: !rawDataString.includes('sk_test_sensitive_key'),
      tokenEncrypted: !rawDataString.includes('sensitive_token'),
      passwordStored: rawDataString.includes('password') // Should not store at all
    };
  }
}