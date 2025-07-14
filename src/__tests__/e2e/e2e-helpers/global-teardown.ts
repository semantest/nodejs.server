import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Cleaning up E2E tests...');
  
  // Clean up test artifacts if not in CI
  if (!process.env.CI) {
    const reportsDir = path.join(__dirname, '../reports');
    try {
      // Keep HTML reports but clean old artifacts
      const artifactsDir = path.join(reportsDir, 'artifacts');
      await fs.rm(artifactsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  console.log('✅ E2E test cleanup complete\n');
}

export default globalTeardown;