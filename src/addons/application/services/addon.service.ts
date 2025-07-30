/**
 * Addon Service
 * Handles business logic for serving addon code
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../../monitoring/infrastructure/structured-logger';

export interface AddonMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoint: string;
}

export interface AddonHealth {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  addons: {
    id: string;
    available: boolean;
    lastAccessed?: string;
  }[];
}

export class AddonService {
  private readonly addonsPath: string;
  private lastAccessTime: Map<string, Date> = new Map();

  constructor() {
    // Path to addon files
    this.addonsPath = join(__dirname, '../../');
  }

  /**
   * Retrieves the ChatGPT addon code from file
   */
  async getChatGPTAddonCode(): Promise<string> {
    try {
      const addonPath = join(this.addonsPath, 'chatgpt-addon.js');
      const addonCode = await readFile(addonPath, 'utf-8');
      
      // Track access time
      this.lastAccessTime.set('chatgpt-addon', new Date());
      
      logger.info('ChatGPT addon code loaded', {
        metadata: {
          path: addonPath,
          size: addonCode.length
        }
      });
      
      return addonCode;
    } catch (error) {
      logger.error('Failed to load ChatGPT addon code', error as Error);
      throw new Error('Addon code not found or inaccessible');
    }
  }

  /**
   * Returns health status of addon service
   */
  async getHealth(): Promise<AddonHealth> {
    const health: AddonHealth = {
      status: 'healthy',
      service: 'addon-service',
      timestamp: new Date().toISOString(),
      addons: []
    };

    try {
      // Check if ChatGPT addon is available
      const addonPath = join(this.addonsPath, 'chatgpt-addon.js');
      const addonExists = await this.fileExists(addonPath);
      
      health.addons.push({
        id: 'chatgpt-addon',
        available: addonExists,
        lastAccessed: this.lastAccessTime.get('chatgpt-addon')?.toISOString()
      });

      // If any addon is unavailable, mark as unhealthy
      if (health.addons.some(addon => !addon.available)) {
        health.status = 'unhealthy';
      }
    } catch (error) {
      health.status = 'unhealthy';
      logger.error('Health check failed', error as Error);
    }

    return health;
  }

  /**
   * Returns metadata about available addons
   */
  async getAddonMetadata(): Promise<AddonMetadata[]> {
    const metadata: AddonMetadata[] = [
      {
        id: 'semantest-chatgpt-addon',
        name: 'Semantest ChatGPT Integration',
        version: '1.0.0',
        description: 'Provides AI-powered assistance for Semantest operations',
        capabilities: [
          'text-generation',
          'code-analysis',
          'test-generation',
          'documentation'
        ],
        endpoint: '/api/addon'
      }
    ];

    return metadata;
  }

  /**
   * Helper method to check if a file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await readFile(path);
      return true;
    } catch {
      return false;
    }
  }
}