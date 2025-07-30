/**
 * Addon Server - REST endpoints for dynamic addon loading
 * Phase 1: Serve ChatGPT addon without domain validation
 */

const express = require('express');
const path = require('path');
const AddonBundler = require('./chatgpt-bundle-generator');

class AddonServer {
  constructor() {
    this.router = express.Router();
    this.addonCache = new Map();
    this.setupRoutes();
  }

  setupRoutes() {
    // Get addon manifest
    this.router.get('/addons/:addonId/manifest', async (req, res) => {
      try {
        const { addonId } = req.params;
        console.log(`📋 Manifest request for addon: ${addonId}`);
        
        if (addonId !== 'chatgpt') {
          return res.status(404).json({ error: 'Addon not found' });
        }

        // Path to ChatGPT addon (adjust based on your setup)
        const addonPath = path.join(__dirname, '../../../extension.chrome/src/addons/chatgpt');
        const bundler = new AddonBundler(addonPath);
        const manifest = await bundler.loadManifest();
        
        res.json(manifest);
      } catch (error) {
        console.error('Failed to get manifest:', error);
        res.status(500).json({ error: 'Failed to load manifest' });
      }
    });

    // Get addon bundle
    this.router.get('/addons/:addonId/bundle', async (req, res) => {
      try {
        const { addonId } = req.params;
        console.log(`📦 Bundle request for addon: ${addonId}`);
        
        if (addonId !== 'chatgpt') {
          return res.status(404).json({ error: 'Addon not found' });
        }

        // Check cache first
        if (this.addonCache.has(addonId)) {
          const cached = this.addonCache.get(addonId);
          console.log(`✅ Serving cached bundle for ${addonId}`);
          res.type('application/javascript');
          return res.send(cached.bundle);
        }

        // Generate bundle
        const addonPath = path.join(__dirname, '../../../extension.chrome/src/addons/chatgpt');
        const bundler = new AddonBundler(addonPath);
        const result = await bundler.generateBundle();
        
        // Cache the bundle
        this.addonCache.set(addonId, result);
        
        console.log(`✅ Generated bundle for ${addonId} (${result.bundle.length} bytes)`);
        res.type('application/javascript');
        res.send(result.bundle);
      } catch (error) {
        console.error('Failed to generate bundle:', error);
        res.status(500).json({ error: 'Failed to generate bundle' });
      }
    });

    // Get addon metadata
    this.router.get('/addons/:addonId/metadata', async (req, res) => {
      try {
        const { addonId } = req.params;
        
        if (this.addonCache.has(addonId)) {
          const cached = this.addonCache.get(addonId);
          res.json(cached.metadata);
        } else {
          res.status(404).json({ error: 'Addon not loaded' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to get metadata' });
      }
    });

    // Clear addon cache
    this.router.post('/addons/cache/clear', (req, res) => {
      this.addonCache.clear();
      console.log('🗑️ Addon cache cleared');
      res.json({ success: true, message: 'Cache cleared' });
    });

    // List available addons
    this.router.get('/addons', (req, res) => {
      // Phase 1: Only ChatGPT addon available
      res.json({
        addons: [
          {
            id: 'chatgpt',
            name: 'ChatGPT Integration',
            version: '1.0.0',
            description: 'Enables ChatGPT automation and image generation',
            available: true
          }
        ]
      });
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AddonServer;