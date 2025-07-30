/**
 * Dynamic Addon Routes
 * REST endpoints for serving addons dynamically
 * Phase 1: ChatGPT addon without domain validation
 */

import { Router, Request, Response } from 'express';
import { AddonService } from '../../application/services/addon.service';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import path from 'path';
import fs from 'fs/promises';

export const dynamicAddonRouter = Router();
const addonService = new AddonService();

// In-memory cache for bundled addons
const addonCache = new Map<string, any>();

/**
 * GET /api/addons
 * List available addons
 */
dynamicAddonRouter.get('/addons', async (req: Request, res: Response) => {
  try {
    logger.info('Listing available addons');
    
    // Phase 1: Only ChatGPT addon
    const addons = [
      {
        id: 'chatgpt',
        name: 'ChatGPT Integration',
        version: '1.0.0',
        description: 'Enables ChatGPT automation and image generation',
        available: true
      }
    ];
    
    res.json({ addons });
  } catch (error) {
    logger.error('Failed to list addons', error as Error);
    res.status(500).json({ error: 'Failed to list addons' });
  }
});

/**
 * GET /api/addons/:addonId/manifest
 * Get addon manifest
 */
dynamicAddonRouter.get('/addons/:addonId/manifest', async (req: Request, res: Response) => {
  try {
    const { addonId } = req.params;
    logger.info('Addon manifest requested', { metadata: { addonId } });
    
    if (addonId !== 'chatgpt') {
      return res.status(404).json({ error: 'Addon not found' });
    }
    
    // Load manifest from file system
    const manifestPath = path.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt/manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    res.json(manifest);
  } catch (error) {
    logger.error('Failed to load addon manifest', error as Error);
    res.status(500).json({ error: 'Failed to load manifest' });
  }
});

/**
 * GET /api/addons/:addonId/bundle
 * Get addon bundle (all scripts combined)
 */
dynamicAddonRouter.get('/addons/:addonId/bundle', async (req: Request, res: Response) => {
  try {
    const { addonId } = req.params;
    logger.info('Addon bundle requested', { metadata: { addonId } });
    
    if (addonId !== 'chatgpt') {
      return res.status(404).json({ error: 'Addon not found' });
    }
    
    // Check cache
    if (addonCache.has(addonId)) {
      const cached = addonCache.get(addonId);
      res.type('application/javascript');
      return res.send(cached.bundle);
    }
    
    // Load manifest to get script list
    const manifestPath = path.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt/manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    // Bundle all scripts
    const addonPath = path.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt');
    const bundledScripts: string[] = [
      `// ChatGPT Addon Bundle - Generated ${new Date().toISOString()}`,
      '(function() {',
      '  console.log("🔌 Loading ChatGPT addon bundle...");',
      '  window.chatGPTAddon = window.chatGPTAddon || {};',
      ''
    ];
    
    // Load and bundle each script
    for (const scriptFile of manifest.scripts) {
      try {
        const scriptPath = path.join(addonPath, scriptFile);
        const scriptContent = await fs.readFile(scriptPath, 'utf-8');
        
        bundledScripts.push(
          `  // === ${scriptFile} ===`,
          '  (function() {',
          scriptContent.split('\n').map(line => '    ' + line).join('\n'),
          '  })();',
          ''
        );
      } catch (error) {
        logger.warn(`Failed to bundle script ${scriptFile}`, error as Error);
      }
    }
    
    bundledScripts.push(
      '  console.log("✅ ChatGPT addon bundle loaded successfully");',
      '})();'
    );
    
    const bundle = bundledScripts.join('\n');
    
    // Cache the bundle
    addonCache.set(addonId, {
      bundle,
      manifest,
      bundledAt: new Date().toISOString()
    });
    
    logger.info('Addon bundle generated', {
      metadata: {
        addonId,
        size: bundle.length,
        scriptCount: manifest.scripts.length
      }
    });
    
    res.type('application/javascript');
    res.send(bundle);
  } catch (error) {
    logger.error('Failed to generate addon bundle', error as Error);
    res.status(500).json({ error: 'Failed to generate bundle' });
  }
});

/**
 * GET /api/addons/:addonId/metadata
 * Get addon metadata (cache info, version, etc)
 */
dynamicAddonRouter.get('/addons/:addonId/metadata', async (req: Request, res: Response) => {
  try {
    const { addonId } = req.params;
    
    if (addonCache.has(addonId)) {
      const cached = addonCache.get(addonId);
      res.json({
        addonId,
        version: cached.manifest.version,
        bundledAt: cached.bundledAt,
        cacheSize: cached.bundle.length,
        manifest: cached.manifest
      });
    } else {
      res.status(404).json({ error: 'Addon not in cache' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

/**
 * POST /api/addons/cache/clear
 * Clear addon cache
 */
dynamicAddonRouter.post('/addons/cache/clear', async (req: Request, res: Response) => {
  try {
    addonCache.clear();
    logger.info('Addon cache cleared');
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// CORS headers for extension access
dynamicAddonRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});