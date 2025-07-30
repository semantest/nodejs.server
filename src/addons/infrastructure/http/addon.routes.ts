/**
 * Addon Routes
 * REST endpoints for serving addon code dynamically
 */

import { Router, Request, Response } from 'express';
import { AddonService } from '../../application/services/addon.service';
import { logger } from '../../../monitoring/infrastructure/structured-logger';

export const addonRouter = Router();
const addonService = new AddonService();

/**
 * GET /api/addon
 * Serves the ChatGPT addon code
 */
addonRouter.get('/addon', async (req: Request, res: Response) => {
  try {
    logger.info('Addon code requested', {
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
    
    logger.info('Addon code served successfully', {
      metadata: {
        addonId: 'chatgpt-addon',
        size: addonCode.length
      }
    });
  } catch (error) {
    logger.error('Failed to serve addon code', error as Error, {
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
addonRouter.get('/addon/health', async (req: Request, res: Response) => {
  try {
    const health = await addonService.getHealth();
    res.status(200).json(health);
  } catch (error) {
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
addonRouter.get('/addon/metadata', async (req: Request, res: Response) => {
  try {
    const metadata = await addonService.getAddonMetadata();
    res.status(200).json(metadata);
  } catch (error) {
    logger.error('Failed to retrieve addon metadata', error as Error);
    res.status(500).json({
      error: 'Failed to retrieve addon metadata',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});