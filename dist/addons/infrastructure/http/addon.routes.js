"use strict";
/**
 * Addon Routes
 * REST endpoints for serving addon code dynamically
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addonRouter = void 0;
const express_1 = require("express");
const addon_service_1 = require("../../application/services/addon.service");
const structured_logger_1 = require("../../../monitoring/infrastructure/structured-logger");
exports.addonRouter = (0, express_1.Router)();
const addonService = new addon_service_1.AddonService();
/**
 * GET /api/addon
 * Serves the ChatGPT addon code
 */
exports.addonRouter.get('/addon', async (req, res) => {
    try {
        structured_logger_1.logger.info('Addon code requested', {
            metadata: {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        const addonCode = await addonService.getChatGPTAddonCode();
        // Set appropriate headers for JavaScript content
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Add CORS headers if needed for browser extension
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.status(200).send(addonCode);
        structured_logger_1.logger.info('Addon code served successfully', {
            metadata: {
                addonId: 'chatgpt-addon',
                size: addonCode.length
            }
        });
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to serve addon code', error, {
            metadata: {
                endpoint: '/api/addon'
            }
        });
        res.status(500).json({
            error: 'Failed to retrieve addon code',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/addon/health
 * Health check for addon service
 */
exports.addonRouter.get('/addon/health', async (req, res) => {
    try {
        const health = await addonService.getHealth();
        res.status(200).json(health);
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/addon/metadata
 * Returns metadata about available addons
 */
exports.addonRouter.get('/addon/metadata', async (req, res) => {
    try {
        const metadata = await addonService.getAddonMetadata();
        res.status(200).json(metadata);
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to retrieve addon metadata', error);
        res.status(500).json({
            error: 'Failed to retrieve addon metadata',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=addon.routes.js.map