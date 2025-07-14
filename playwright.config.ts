import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: '**/*.e2e.test.ts',
  
  // Test timeout
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  
  // Parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  
  // Retry configuration
  retries: process.env.CI ? 2 : 0,
  
  // Output configuration
  reporter: [
    ['html', { outputFolder: 'src/__tests__/e2e/reports/html' }],
    ['json', { outputFile: 'src/__tests__/e2e/reports/results.json' }],
    ['junit', { outputFile: 'src/__tests__/e2e/reports/junit.xml' }],
    ['list'],
  ],
  
  // Artifacts
  use: {
    actionTimeout: 0,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  outputDir: 'src/__tests__/e2e/reports/artifacts',
  
  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
        contextOptions: {
          // Chrome extension testing support
          extraHTTPHeaders: {
            'X-Extension-Test': 'true',
          },
        },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'edge',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
  ],
  
  // Web server configuration
  webServer: {
    command: 'npm run start:test',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key',
      CSRF_SECRET: 'test-csrf-secret',
      RATE_LIMIT_WINDOW: '60000', // 1 minute for testing
      RATE_LIMIT_MAX: '10', // Low limit for testing
    },
  },
  
  // Global setup and teardown
  globalSetup: path.join(__dirname, 'src/__tests__/e2e/e2e-helpers/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'src/__tests__/e2e/e2e-helpers/global-teardown.ts'),
});