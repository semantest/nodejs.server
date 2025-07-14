import { chromium, FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 Starting E2E test setup...');
  
  // Create test database
  process.env.DATABASE_URL = 'sqlite::memory:';
  
  // Build Chrome extension for testing
  const extensionPath = path.join(__dirname, '../../../../extension.chrome');
  if (await fs.stat(extensionPath).catch(() => false)) {
    console.log('📦 Building Chrome extension...');
    await execAsync('npm run build:extension', { cwd: extensionPath });
  }
  
  // Store global state
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Store auth tokens for different test scenarios
  const testUsers = {
    admin: { 
      email: 'admin@test.com', 
      password: 'Admin123!@#',
      permissions: ['admin', 'read', 'write', 'delete']
    },
    user: { 
      email: 'user@test.com', 
      password: 'User123!@#',
      permissions: ['read', 'write']
    },
    attacker: { 
      email: 'attacker@evil.com', 
      password: 'Evil123!@#',
      permissions: []
    },
  };
  
  // Store test configuration
  await browser.close();
  
  // Store environment variables
  process.env.TEST_USERS = JSON.stringify(testUsers);
  process.env.EXTENSION_PATH = extensionPath;
  
  console.log('✅ E2E test setup complete\n');
}

export default globalSetup;