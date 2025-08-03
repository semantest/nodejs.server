/**
 * @fileoverview Addon Serving API Routes
 * @description RESTful endpoints for browser extension addon delivery
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import {
  validateAddonRequest,
  validateCreateAddonRequest,
  validateUpdateStatusRequest,
  AddonMetadata,
  AddonApiError,
  AddonStatus,
  AddonType,
  ContentType,
  AddonResponseHeaders,
  AddonListResponse
} from '../schemas/addon-api.schema';
import { AddonService } from '../services/addon.service';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../../../auth/middleware/auth-middleware';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';

const router = Router();
const addonService = new AddonService();

/**
 * GET /api/v1/addons/:addonId
 * Fetch addon content - Phase 1: Simple static serving
 */
router.get('/addons/:addonId',
  rateLimitMiddleware({ windowMs: 60000, max: 1000 }), // 1000 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { addonId } = req.params;
      const { headers, query } = validateAddonRequest(req.headers, req.query);
      
      logger.info('Addon requested', {
        addonId,
        version: query.version,
        targetDomain: headers['x-target-domain'],
        browserInfo: {
          id: headers['x-browser-id'],
          extensionVersion: headers['x-extension-version']
        }
      });

      // Get addon from service
      const addon = await addonService.getAddon(addonId, {
        version: query.version,
        minified: query.minified
      });

      if (!addon) {
        const error: AddonApiError = {
          error: {
            code: 'ADDON_NOT_FOUND',
            message: `Addon ${addonId} not found`
          }
        };
        return res.status(404).json(error);
      }

      // Check ETag
      const etag = `"${addon.contentHash}"`;
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end(); // Not Modified
      }

      // Check Last-Modified
      const lastModified = new Date(addon.updatedAt).toUTCString();
      if (req.headers['if-modified-since'] === lastModified) {
        return res.status(304).end();
      }

      // Phase 2: Domain validation would go here
      if (headers['x-target-domain'] && addon.domainPatterns) {
        const allowed = await addonService.validateDomain(
          headers['x-target-domain'],
          addon.domainPatterns
        );
        
        if (!allowed) {
          const error: AddonApiError = {
            error: {
              code: 'DOMAIN_NOT_ALLOWED',
              message: `Addon not allowed for domain ${headers['x-target-domain']}`
            }
          };
          return res.status(403).json(error);
        }
      }

      // Set response headers
      const responseHeaders: AddonResponseHeaders = {
        'x-addon-id': addon.id,
        'x-addon-version': addon.version,
        'x-content-hash': addon.contentHash,
        'x-addon-type': addon.type,
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
        'etag': etag,
        'last-modified': lastModified,
        'content-type': addon.type === AddonType.STYLE_SHEET ? ContentType.CSS : ContentType.JAVASCRIPT,
        'content-length': addon.size.toString()
      };

      if (addon.status === AddonStatus.DEPRECATED) {
        responseHeaders['x-deprecation-warning'] = addon.deprecationMessage || 'This addon is deprecated';
      }

      // Apply headers
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Send content
      res.send(addon.content);

      // Track usage metrics
      await addonService.trackUsage(addonId, {
        browserInfo: headers,
        version: addon.version,
        targetDomain: headers['x-target-domain']
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const apiError: AddonApiError = {
          error: {
            code: 'INVALID_VERSION',
            message: 'Invalid request parameters',
            details: error
          }
        };
        return res.status(400).json(apiError);
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/addons/:addonId/metadata
 * Get addon metadata without content
 */
router.get('/addons/:addonId/metadata',
  rateLimitMiddleware({ windowMs: 60000, max: 2000 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { addonId } = req.params;
      
      const metadata = await addonService.getAddonMetadata(addonId);
      
      if (!metadata) {
        const error: AddonApiError = {
          error: {
            code: 'ADDON_NOT_FOUND',
            message: `Addon ${addonId} not found`
          }
        };
        return res.status(404).json(error);
      }

      res.json(metadata);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/addons
 * List available addons with pagination
 */
router.get('/addons',
  rateLimitMiddleware({ windowMs: 60000, max: 500 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
      const status = req.query.status as AddonStatus;
      const type = req.query.type as AddonType;
      
      const result = await addonService.listAddons({
        page,
        pageSize,
        filters: {
          status,
          type,
          domain: req.query.domain as string
        }
      });

      const response: AddonListResponse = {
        addons: result.addons,
        total: result.total,
        page,
        pageSize,
        hasMore: page * pageSize < result.total
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/addons/:domain/bundle (Phase 2)
 * Get optimized bundle for specific domain
 */
router.post('/addons/:domain/bundle',
  rateLimitMiddleware({ windowMs: 60000, max: 100 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain } = req.params;
      const { includeStyles = true, includeDependencies = true } = req.body;
      
      const bundle = await addonService.createDomainBundle(domain, {
        includeStyles,
        includeDependencies
      });

      if (!bundle) {
        return res.status(204).end(); // No content for this domain
      }

      // Cache aggressively
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('X-Bundle-Id', bundle.bundleId);
      
      res.json(bundle);

    } catch (error) {
      next(error);
    }
  }
);

// ===== Admin Endpoints =====

/**
 * POST /api/v1/admin/addons
 * Create new addon (admin only)
 */
router.post('/admin/addons',
  authMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedRequest = validateCreateAddonRequest(req.body);
      
      // Validate addon content
      const validation = await addonService.validateAddonContent(
        validatedRequest.content,
        validatedRequest.type
      );

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid addon content',
          validation
        });
      }

      const addon = await addonService.createAddon(validatedRequest);
      
      logger.info('Addon created', {
        addonId: addon.id,
        name: addon.name,
        version: addon.version,
        type: addon.type
      });

      res.status(201).json(addon);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid request body',
          details: error
        });
      }
      next(error);
    }
  }
);

/**
 * PUT /api/v1/admin/addons/:addonId
 * Update addon content (admin only)
 */
router.put('/admin/addons/:addonId',
  authMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { addonId } = req.params;
      const validatedRequest = validateCreateAddonRequest(req.body);
      
      const addon = await addonService.updateAddon(addonId, validatedRequest);
      
      if (!addon) {
        const error: AddonApiError = {
          error: {
            code: 'ADDON_NOT_FOUND',
            message: `Addon ${addonId} not found`
          }
        };
        return res.status(404).json(error);
      }

      logger.info('Addon updated', {
        addonId: addon.id,
        version: addon.version
      });

      res.json(addon);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/addons/:addonId/status
 * Update addon status (admin only)
 */
router.patch('/admin/addons/:addonId/status',
  authMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 20 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { addonId } = req.params;
      const validatedRequest = validateUpdateStatusRequest(req.body);
      
      const addon = await addonService.updateAddonStatus(
        addonId,
        validatedRequest.status,
        {
          reason: validatedRequest.reason,
          deprecationMessage: validatedRequest.deprecationMessage
        }
      );

      if (!addon) {
        const error: AddonApiError = {
          error: {
            code: 'ADDON_NOT_FOUND',
            message: `Addon ${addonId} not found`
          }
        };
        return res.status(404).json(error);
      }

      logger.info('Addon status updated', {
        addonId: addon.id,
        oldStatus: addon.status,
        newStatus: validatedRequest.status
      });

      res.json(addon);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/admin/addons/:addonId
 * Delete addon (admin only)
 */
router.delete('/admin/addons/:addonId',
  authMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware({ windowMs: 60000, max: 5 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { addonId } = req.params;
      
      const deleted = await addonService.deleteAddon(addonId);
      
      if (!deleted) {
        const error: AddonApiError = {
          error: {
            code: 'ADDON_NOT_FOUND',
            message: `Addon ${addonId} not found`
          }
        };
        return res.status(404).json(error);
      }

      logger.info('Addon deleted', { addonId });

      res.status(204).end();

    } catch (error) {
      next(error);
    }
  }
);

// Error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Addon API error', { error: err, path: req.path });
  
  const apiError: AddonApiError = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred'
    }
  };
  
  res.status(500).json(apiError);
});

export default router;