"use strict";
/**
 * Dynamic Addon Routes
 * REST endpoints for serving addons dynamically
 * Phase 1: ChatGPT addon without domain validation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicAddonRouter = void 0;
const express_1 = require("express");
const addon_service_1 = require("../../application/services/addon.service");
const structured_logger_1 = require("../../../monitoring/infrastructure/structured-logger");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
exports.dynamicAddonRouter = (0, express_1.Router)();
const addonService = new addon_service_1.AddonService();
// In-memory cache for bundled addons
const addonCache = new Map();
/**
 * GET /api/addons
 * List available addons
 */
exports.dynamicAddonRouter.get('/addons', async (req, res) => {
    try {
        structured_logger_1.logger.info('Listing available addons');
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
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to list addons', error);
        res.status(500).json({ error: 'Failed to list addons' });
    }
});
/**
 * GET /api/addons/:addonId/manifest
 * Get addon manifest
 */
exports.dynamicAddonRouter.get('/addons/:addonId/manifest', async (req, res) => {
    try {
        const { addonId } = req.params;
        structured_logger_1.logger.info('Addon manifest requested', { metadata: { addonId } });
        if (addonId !== 'chatgpt') {
            return res.status(404).json({ error: 'Addon not found' });
        }
        // Load manifest from file system
        const manifestPath = path_1.default.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt/manifest.json');
        const manifestContent = await promises_1.default.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        res.json(manifest);
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to load addon manifest', error);
        res.status(500).json({ error: 'Failed to load manifest' });
    }
});
/**
 * GET /api/addons/:addonId/bundle
 * Get addon bundle (all scripts combined)
 */
exports.dynamicAddonRouter.get('/addons/:addonId/bundle', async (req, res) => {
    try {
        const { addonId } = req.params;
        structured_logger_1.logger.info('Addon bundle requested', { metadata: { addonId } });
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
        const manifestPath = path_1.default.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt/manifest.json');
        const manifestContent = await promises_1.default.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        // Bundle all scripts
        const addonPath = path_1.default.join(__dirname, '../../../../../extension.chrome/src/addons/chatgpt');
        const bundledScripts = [
            `// ChatGPT Addon Bundle - Generated ${new Date().toISOString()}`,
            '(function() {',
            '  console.log("🔌 Loading ChatGPT addon bundle...");',
            '  window.chatGPTAddon = window.chatGPTAddon || {};',
            ''
        ];
        // Load and bundle each script
        for (const scriptFile of manifest.scripts) {
            try {
                const scriptPath = path_1.default.join(addonPath, scriptFile);
                const scriptContent = await promises_1.default.readFile(scriptPath, 'utf-8');
                bundledScripts.push(`  // === ${scriptFile} ===`, '  (function() {', scriptContent.split('\n').map(line => '    ' + line).join('\n'), '  })();', '');
            }
            catch (error) {
                structured_logger_1.logger.warn(`Failed to bundle script ${scriptFile}`, { error: error });
            }
        }
        bundledScripts.push('  console.log("✅ ChatGPT addon bundle loaded successfully");', '})();');
        const bundle = bundledScripts.join('\n');
        // Cache the bundle
        addonCache.set(addonId, {
            bundle,
            manifest,
            bundledAt: new Date().toISOString()
        });
        structured_logger_1.logger.info('Addon bundle generated', {
            metadata: {
                addonId,
                size: bundle.length,
                scriptCount: manifest.scripts.length
            }
        });
        res.type('application/javascript');
        res.send(bundle);
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to generate addon bundle', error);
        res.status(500).json({ error: 'Failed to generate bundle' });
    }
});
/**
 * GET /api/addons/:addonId/metadata
 * Get addon metadata (cache info, version, etc)
 */
exports.dynamicAddonRouter.get('/addons/:addonId/metadata', async (req, res) => {
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
        }
        else {
            res.status(404).json({ error: 'Addon not in cache' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get metadata' });
    }
});
/**
 * POST /api/addons/cache/clear
 * Clear addon cache
 */
exports.dynamicAddonRouter.post('/addons/cache/clear', async (req, res) => {
    try {
        addonCache.clear();
        structured_logger_1.logger.info('Addon cache cleared');
        res.json({ success: true, message: 'Cache cleared' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});
// CORS headers for extension access
exports.dynamicAddonRouter.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
//# sourceMappingURL=addon-dynamic.routes.js.map