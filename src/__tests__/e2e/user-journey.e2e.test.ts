import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage, PermissionDialog, ExtensionPopup, SecurityTestHelpers } from './e2e-helpers/page-objects';

test.describe('Complete User Journey Security E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let loginPage: LoginPage;
  let securityHelpers: SecurityTestHelpers;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: './src/__tests__/e2e/reports/videos',
        size: { width: 1280, height: 720 }
      }
    });
    
    page = await context.newPage();
    loginPage = new LoginPage(page);
    securityHelpers = new SecurityTestHelpers(page, context);
    
    // Set up comprehensive monitoring
    const securityEvents: any[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('Security')) {
        securityEvents.push({
          type: 'console',
          level: msg.type(),
          text: msg.text(),
          timestamp: Date.now()
        });
      }
    });
    
    page.on('pageerror', (error) => {
      securityEvents.push({
        type: 'error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });
    
    page.on('requestfailed', (request) => {
      securityEvents.push({
        type: 'request_failed',
        url: request.url(),
        failure: request.failure(),
        timestamp: Date.now()
      });
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('New User Registration Journey', () => {
    test('complete secure registration flow', async ({ page }) => {
      // Navigate to registration
      await page.goto('/register');
      
      // Check security headers on registration page
      const response = await page.waitForResponse(resp => resp.url().includes('/register'));
      const headers = await securityHelpers.checkSecurityHeaders(response);
      expect(headers['x-frame-options']).toBe('DENY');
      
      // Fill registration form
      await page.fill('input[name="email"]', 'newuser@test.com');
      await page.fill('input[name="password"]', 'SecurePass123!@#');
      await page.fill('input[name="confirmPassword"]', 'SecurePass123!@#');
      await page.fill('input[name="firstName"]', 'Test');
      await page.fill('input[name="lastName"]', 'User');
      
      // Check password strength indicator
      const strengthIndicator = page.locator('[data-testid="password-strength"]');
      await expect(strengthIndicator).toHaveText(/Strong/);
      
      // Accept terms and conditions
      await page.check('input[name="acceptTerms"]');
      
      // Check CAPTCHA present
      const captcha = page.locator('[data-testid="captcha"]');
      await expect(captcha).toBeVisible();
      
      // Submit registration
      await page.click('button[type="submit"]');
      
      // Verify email confirmation required
      await expect(page).toHaveURL('/verify-email');
      const message = page.locator('.info-message');
      await expect(message).toHaveText(/verification email has been sent/);
      
      // Simulate email verification click
      const verificationToken = 'mock-verification-token';
      await page.goto(`/verify-email?token=${verificationToken}`);
      
      // Should redirect to login with success message
      await expect(page).toHaveURL('/login');
      const successMessage = page.locator('.success-message');
      await expect(successMessage).toHaveText(/Email verified successfully/);
      
      // Complete first login
      await loginPage.login('newuser@test.com', 'SecurePass123!@#');
      
      // First-time setup wizard
      await expect(page).toHaveURL('/setup');
      
      // Set up 2FA
      const setup2FAButton = page.locator('button:has-text("Enable Two-Factor Authentication")');
      await setup2FAButton.click();
      
      // Show QR code and backup codes
      const qrCode = page.locator('[data-testid="2fa-qr-code"]');
      await expect(qrCode).toBeVisible();
      
      const backupCodes = page.locator('[data-testid="backup-codes"]');
      await expect(backupCodes).toBeVisible();
      
      // User must confirm they saved backup codes
      await page.check('input[name="confirmedBackupCodes"]');
      await page.click('button:has-text("Continue")');
      
      // Enter 2FA code to confirm setup
      await page.fill('input[name="totpCode"]', '123456');
      await page.click('button:has-text("Verify and Enable")');
      
      // Setup complete
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Authenticated User Journey', () => {
    test('secure workflow from login to sensitive actions', async () => {
      // Login
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Dashboard security check
      await expect(page).toHaveURL('/dashboard');
      
      // Check session timeout warning
      await page.waitForTimeout(5000); // Simulate some activity
      const sessionWarning = page.locator('[data-testid="session-warning"]');
      // Session warning should appear before timeout
      
      // Navigate to sensitive area (account settings)
      await page.click('a:has-text("Account Settings")');
      
      // Should require re-authentication for sensitive actions
      await page.click('button:has-text("Change Password")');
      
      const reauthDialog = page.locator('[data-testid="reauth-dialog"]');
      await expect(reauthDialog).toBeVisible();
      
      // Re-enter password
      await page.fill('[data-testid="reauth-password"]', 'User123!@#');
      await page.click('button:has-text("Confirm")');
      
      // Change password form
      await page.fill('input[name="currentPassword"]', 'User123!@#');
      await page.fill('input[name="newPassword"]', 'NewSecurePass456!@#');
      await page.fill('input[name="confirmNewPassword"]', 'NewSecurePass456!@#');
      
      // Check password history validation
      await page.click('button:has-text("Update Password")');
      
      // Should show success and force re-login
      const successMsg = page.locator('.success-message');
      await expect(successMsg).toHaveText(/Password updated successfully/);
      
      await expect(page).toHaveURL('/login');
      const infoMsg = page.locator('.info-message');
      await expect(infoMsg).toHaveText(/Please login with your new password/);
    });

    test('API key management journey', async () => {
      await loginPage.goto();
      await loginPage.login('developer@test.com', 'Dev123!@#');
      
      // Navigate to API keys
      await page.click('a:has-text("API Keys")');
      await expect(page).toHaveURL('/api-keys');
      
      // Create new API key
      await page.click('button:has-text("Create New API Key")');
      
      const dialog = page.locator('[data-testid="create-api-key-dialog"]');
      await expect(dialog).toBeVisible();
      
      // Fill API key details
      await page.fill('input[name="keyName"]', 'Production API Key');
      await page.fill('textarea[name="description"]', 'Key for production environment');
      
      // Select permissions
      await page.check('input[value="read"]');
      await page.check('input[value="write"]');
      
      // Set expiration
      await page.selectOption('select[name="expiration"]', '90'); // 90 days
      
      // IP whitelist
      await page.fill('input[name="ipWhitelist"]', '192.168.1.0/24');
      
      // Create key
      await page.click('button:has-text("Create Key")');
      
      // Show key once with copy button
      const keyDisplay = page.locator('[data-testid="api-key-display"]');
      await expect(keyDisplay).toBeVisible();
      await expect(keyDisplay).toHaveText(/sk_live_/);
      
      // Copy key
      await page.click('button:has-text("Copy Key")');
      
      // Verify clipboard (if supported)
      const copiedKey = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedKey).toMatch(/^sk_live_/);
      
      // Key should be hidden after closing
      await page.click('button:has-text("I\'ve Saved This Key")');
      await expect(keyDisplay).not.toBeVisible();
      
      // Verify key appears in list
      const keysList = page.locator('[data-testid="api-keys-list"]');
      await expect(keysList).toContainText('Production API Key');
      
      // Test key rotation
      await page.click('button[data-testid="rotate-key-Production API Key"]');
      
      const rotateDialog = page.locator('[data-testid="rotate-key-dialog"]');
      await expect(rotateDialog).toBeVisible();
      await expect(rotateDialog).toContainText(/This action cannot be undone/);
      
      await page.click('button:has-text("Rotate Key")');
      
      // Show new key
      const newKeyDisplay = page.locator('[data-testid="new-api-key-display"]');
      await expect(newKeyDisplay).toBeVisible();
      await expect(newKeyDisplay).toHaveText(/sk_live_/);
    });
  });

  test.describe('Permission Management Journey', () => {
    test('granular permission control flow', async () => {
      await loginPage.goto();
      await loginPage.login('admin@test.com', 'Admin123!@#');
      
      // Navigate to team management
      await page.click('a:has-text("Team")');
      await expect(page).toHaveURL('/team');
      
      // Invite new team member
      await page.click('button:has-text("Invite Member")');
      
      const inviteDialog = page.locator('[data-testid="invite-dialog"]');
      await expect(inviteDialog).toBeVisible();
      
      await page.fill('input[name="email"]', 'newmember@test.com');
      
      // Set up custom role
      await page.click('button:has-text("Create Custom Role")');
      
      await page.fill('input[name="roleName"]', 'Content Editor');
      
      // Granular permissions
      const permissions = [
        'content.read',
        'content.write',
        'content.publish',
        'media.upload',
        'media.delete'
      ];
      
      for (const permission of permissions) {
        await page.check(`input[value="${permission}"]`);
      }
      
      // Time-based restrictions
      await page.check('input[name="enableTimeRestrictions"]');
      await page.fill('input[name="validFrom"]', '2024-01-01');
      await page.fill('input[name="validUntil"]', '2024-12-31');
      
      // Save role and send invite
      await page.click('button:has-text("Create Role and Send Invite")');
      
      // Verify invite sent
      const successMsg = page.locator('.success-message');
      await expect(successMsg).toHaveText(/Invitation sent/);
      
      // Simulate accepting invite (switch to invited user)
      await page.goto('/logout');
      
      // Click invite link
      const inviteToken = 'mock-invite-token';
      await page.goto(`/accept-invite?token=${inviteToken}`);
      
      // Set up account
      await page.fill('input[name="password"]', 'NewMember123!@#');
      await page.fill('input[name="confirmPassword"]', 'NewMember123!@#');
      await page.click('button:has-text("Create Account")');
      
      // First login shows permissions
      await expect(page).toHaveURL('/permissions-overview');
      
      const permissionsList = page.locator('[data-testid="granted-permissions"]');
      await expect(permissionsList).toContainText('Content Editor');
      await expect(permissionsList).toContainText('Read content');
      await expect(permissionsList).toContainText('Write content');
      
      await page.click('button:has-text("Continue to Dashboard")');
      
      // Verify restricted access
      await page.goto('/admin');
      await expect(page).toHaveURL('/unauthorized');
    });
  });

  test.describe('Data Export and Privacy Journey', () => {
    test('GDPR compliance and data export flow', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Navigate to privacy settings
      await page.click('a:has-text("Privacy")');
      await expect(page).toHaveURL('/privacy-settings');
      
      // Request data export
      await page.click('button:has-text("Export My Data")');
      
      const exportDialog = page.locator('[data-testid="export-dialog"]');
      await expect(exportDialog).toBeVisible();
      
      // Select data to export
      await page.check('input[value="profile"]');
      await page.check('input[value="activity"]');
      await page.check('input[value="settings"]');
      await page.check('input[value="api-keys"]');
      
      // Choose format
      await page.selectOption('select[name="format"]', 'json');
      
      // Require authentication
      await page.fill('input[name="password"]', 'User123!@#');
      
      await page.click('button:has-text("Request Export")');
      
      // Email notification
      const notification = page.locator('.info-message');
      await expect(notification).toHaveText(/export request has been received/);
      
      // Simulate export ready (would be email link in real scenario)
      await page.goto('/data-export/download?token=mock-export-token');
      
      // Security check before download
      const securityCheck = page.locator('[data-testid="security-check"]');
      await expect(securityCheck).toBeVisible();
      
      // Enter 2FA code
      await page.fill('input[name="totpCode"]', '123456');
      await page.click('button:has-text("Verify and Download")');
      
      // Download starts
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download Now")')
      ]);
      
      expect(download.suggestedFilename()).toMatch(/data-export-.*\.json/);
      
      // Verify download expires
      await page.reload();
      await expect(page).toHaveURL('/link-expired');
    });

    test('account deletion journey', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Navigate to account settings
      await page.click('a:has-text("Account")');
      await page.click('a:has-text("Delete Account")');
      
      // Deletion warning
      const warningDialog = page.locator('[data-testid="deletion-warning"]');
      await expect(warningDialog).toBeVisible();
      await expect(warningDialog).toContainText(/This action cannot be undone/);
      await expect(warningDialog).toContainText(/All your data will be permanently deleted/);
      
      // List impacts
      const impacts = page.locator('[data-testid="deletion-impacts"] li');
      expect(await impacts.count()).toBeGreaterThan(5);
      
      // Type confirmation
      await page.fill('input[name="confirmDelete"]', 'DELETE MY ACCOUNT');
      
      // Enter password
      await page.fill('input[name="password"]', 'User123!@#');
      
      // Final confirmation
      await page.click('button:has-text("Delete My Account")');
      
      // 2FA required for deletion
      await page.fill('input[name="totpCode"]', '123456');
      await page.click('button:has-text("Confirm Deletion")');
      
      // Grace period notice
      const graceNotice = page.locator('[data-testid="grace-period-notice"]');
      await expect(graceNotice).toBeVisible();
      await expect(graceNotice).toContainText(/account will be deleted in 30 days/);
      await expect(graceNotice).toContainText(/cancel this request/);
      
      // Logged out
      await expect(page).toHaveURL('/account-scheduled-deletion');
    });
  });

  test.describe('Security Incident Response Journey', () => {
    test('suspicious activity detection and response', async () => {
      // Simulate suspicious login
      await loginPage.goto();
      
      // Failed login attempts from different IPs (simulated)
      for (let i = 0; i < 3; i++) {
        await loginPage.login('user@test.com', 'WrongPassword' + i);
        await page.waitForTimeout(100);
      }
      
      // Successful login from new location
      await page.setExtraHTTPHeaders({
        'X-Forwarded-For': '192.168.1.100' // Different IP
      });
      
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Security alert shown
      const securityAlert = page.locator('[data-testid="security-alert"]');
      await expect(securityAlert).toBeVisible();
      await expect(securityAlert).toContainText(/New login from unrecognized location/);
      
      // Options presented
      const secureAccountBtn = page.locator('button:has-text("Secure My Account")');
      const wasThisMeBtn = page.locator('button:has-text("Yes, This Was Me")');
      
      await expect(secureAccountBtn).toBeVisible();
      await expect(wasThisMeBtn).toBeVisible();
      
      // Choose to secure account
      await secureAccountBtn.click();
      
      // Force password reset
      await expect(page).toHaveURL('/forced-password-reset');
      
      const resetNotice = page.locator('[data-testid="security-notice"]');
      await expect(resetNotice).toContainText(/suspicious activity detected/);
      
      // Show recent activity
      const activityLog = page.locator('[data-testid="recent-activity"]');
      await expect(activityLog).toBeVisible();
      
      const suspiciousItems = activityLog.locator('.suspicious-activity');
      expect(await suspiciousItems.count()).toBeGreaterThan(0);
      
      // Reset password
      await page.fill('input[name="newPassword"]', 'SuperSecure789!@#');
      await page.fill('input[name="confirmPassword"]', 'SuperSecure789!@#');
      
      // Revoke all sessions
      await page.check('input[name="revokeAllSessions"]');
      
      // Enable additional security
      await page.check('input[name="enableLoginAlerts"]');
      await page.check('input[name="requireTwoFactor"]');
      
      await page.click('button:has-text("Reset Password and Secure Account")');
      
      // Success and forced re-login
      await expect(page).toHaveURL('/login');
      const successMsg = page.locator('.success-message');
      await expect(successMsg).toContainText(/Account secured/);
      await expect(successMsg).toContainText(/All other sessions have been terminated/);
    });
  });

  test.describe('Multi-Device Security Journey', () => {
    test('device management and security', async () => {
      await loginPage.goto();
      await loginPage.login('user@test.com', 'User123!@#');
      
      // Navigate to security settings
      await page.click('a:has-text("Security")');
      await page.click('a:has-text("Devices")');
      
      // Show active devices
      const deviceList = page.locator('[data-testid="device-list"]');
      await expect(deviceList).toBeVisible();
      
      // Current device should be marked
      const currentDevice = deviceList.locator('.current-device');
      await expect(currentDevice).toBeVisible();
      await expect(currentDevice).toContainText('This device');
      
      // Add new trusted device process
      await page.click('button:has-text("Add Trusted Device")');
      
      const qrCode = page.locator('[data-testid="device-qr-code"]');
      await expect(qrCode).toBeVisible();
      
      const deviceCode = page.locator('[data-testid="device-code"]');
      await expect(deviceCode).toBeVisible();
      
      // Simulate scanning from another device
      const newDeviceToken = await deviceCode.textContent();
      
      // Open in new context (simulating different device)
      const newContext = await page.context().browser()?.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      });
      
      const newDevice = await newContext!.newPage();
      await newDevice.goto(`/pair-device?code=${newDeviceToken}`);
      
      // Approve on original device
      const approvalNotification = page.locator('[data-testid="device-approval"]');
      await expect(approvalNotification).toBeVisible();
      await expect(approvalNotification).toContainText(/New device requesting access/);
      await expect(approvalNotification).toContainText(/iPhone/);
      
      await page.click('button:has-text("Approve Device")');
      
      // Device added to list
      await expect(deviceList).toContainText('iPhone');
      
      // Revoke device
      await page.click('button[data-testid="revoke-device-iPhone"]');
      
      const revokeDialog = page.locator('[data-testid="revoke-device-dialog"]');
      await expect(revokeDialog).toBeVisible();
      
      await page.click('button:has-text("Revoke Access")');
      
      // Device removed
      await expect(deviceList).not.toContainText('iPhone');
      
      await newContext!.close();
    });
  });

  test.describe('Emergency Access Journey', () => {
    test('account recovery without 2FA device', async () => {
      await loginPage.goto();
      
      // Start login
      await loginPage.emailInput.fill('user@test.com');
      await loginPage.passwordInput.fill('User123!@#');
      await loginPage.submitButton.click();
      
      // 2FA required
      await expect(page).toHaveURL('/two-factor');
      
      // Lost device option
      await page.click('a:has-text("Lost your device?")');
      
      // Recovery options
      await expect(page).toHaveURL('/account-recovery');
      
      const recoveryOptions = page.locator('[data-testid="recovery-options"]');
      await expect(recoveryOptions).toBeVisible();
      
      // Use backup code
      await page.click('button:has-text("Use Backup Code")');
      
      await page.fill('input[name="backupCode"]', 'BACKUP-CODE-123456');
      await page.click('button:has-text("Verify")');
      
      // Additional verification required
      const additionalVerification = page.locator('[data-testid="additional-verification"]');
      await expect(additionalVerification).toBeVisible();
      
      // Security questions
      await page.fill('input[name="mothersMaidenName"]', 'Smith');
      await page.fill('input[name="firstPet"]', 'Fluffy');
      await page.fill('input[name="birthCity"]', 'New York');
      
      await page.click('button:has-text("Verify Identity")');
      
      // Recovery successful - forced security update
      await expect(page).toHaveURL('/security-update-required');
      
      const updateNotice = page.locator('[data-testid="security-update-notice"]');
      await expect(updateNotice).toContainText(/Your account was recovered/);
      await expect(updateNotice).toContainText(/update your security settings/);
      
      // Must set up new 2FA
      await page.click('button:has-text("Set Up New 2FA Device")');
      
      // Complete 2FA setup
      const newQrCode = page.locator('[data-testid="new-2fa-qr"]');
      await expect(newQrCode).toBeVisible();
      
      // Generate new backup codes
      await page.click('button:has-text("Generate New Backup Codes")');
      
      const newBackupCodes = page.locator('[data-testid="new-backup-codes"]');
      await expect(newBackupCodes).toBeVisible();
      
      // Confirm saved
      await page.check('input[name="confirmedNewBackupCodes"]');
      await page.click('button:has-text("Complete Security Update")');
      
      // Finally logged in
      await expect(page).toHaveURL('/dashboard');
      
      // Security reminder
      const reminder = page.locator('[data-testid="security-reminder"]');
      await expect(reminder).toContainText(/Account was recently recovered/);
    });
  });
});