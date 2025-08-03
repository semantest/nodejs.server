/**
 * @fileoverview Addon Controller
 * @description Handles HTTP requests for browser extension addon endpoints
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { 
  AddonType, 
  AddonMetadata, 
  AddonListResponse,
  AddonDetailResponse 
} from '../schemas/addon-api.schema';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { AppError } from '../../../shared/errors/app-error';
import { createHash } from 'crypto';

/**
 * Controller for addon endpoints
 */
export class AddonController {
  private readonly ADDONS_BASE_PATH = process.env.ADDONS_PATH || '/app/addons';
  private addonCache: Map<string, AddonMetadata> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * List all available addons
   */
  async listAddons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, compatibleWith } = req.query;

      logger.info('Listing addons', { type, compatibleWith });

      // Get all addons
      const addons = await this.getAvailableAddons();

      // Filter by type if specified
      let filteredAddons = addons;
      if (type && Object.values(AddonType).includes(type as AddonType)) {
        filteredAddons = addons.filter(addon => addon.type === type);
      }

      // Filter by compatibility if specified
      if (compatibleWith) {
        filteredAddons = filteredAddons.filter(addon => 
          addon.compatibleBrowsers.includes(compatibleWith as string)
        );
      }

      const response: AddonListResponse = {
        addons: filteredAddons,
        total: filteredAddons.length
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific addon details
   */
  async getAddon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addonId } = req.params;

      logger.info('Getting addon details', { addonId });

      const addon = await this.getAddonMetadata(addonId);
      if (!addon) {
        throw new AppError('Addon not found', 404);
      }

      // Get file stats
      const filePath = path.join(this.ADDONS_BASE_PATH, addon.filename);
      const stats = await fs.stat(filePath);

      const response: AddonDetailResponse = {
        ...addon,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString()
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download addon file
   */
  async downloadAddon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addonId } = req.params;

      logger.info('Downloading addon', { addonId });

      const addon = await this.getAddonMetadata(addonId);
      if (!addon) {
        throw new AppError('Addon not found', 404);
      }

      const filePath = path.join(this.ADDONS_BASE_PATH, addon.filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new AppError('Addon file not found', 404);
      }

      // Set headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${addon.filename}"`);
      res.setHeader('X-Addon-Version', addon.version);
      res.setHeader('X-Addon-Hash', addon.hash);

      // Stream file
      const fileStream = await fs.readFile(filePath);
      res.send(fileStream);

      // Log download
      logger.info('Addon downloaded', {
        addonId,
        userId: req.user?.id || 'anonymous',
        ip: req.ip
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get addon manifest (for browser integration)
   */
  async getAddonManifest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { addonId } = req.params;

      logger.info('Getting addon manifest', { addonId });

      const addon = await this.getAddonMetadata(addonId);
      if (!addon) {
        throw new AppError('Addon not found', 404);
      }

      // Return simplified manifest for browser
      res.json({
        id: addon.id,
        name: addon.name,
        version: addon.version,
        description: addon.description,
        permissions: addon.permissions,
        updateUrl: `/api/v1/addons/${addon.id}/download`,
        hash: addon.hash
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check for addon updates
   */
  async checkUpdates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updates = req.body as Array<{ id: string; version: string }>;

      if (!Array.isArray(updates)) {
        throw new AppError('Invalid request body', 400);
      }

      logger.info('Checking addon updates', { count: updates.length });

      const results = await Promise.all(
        updates.map(async ({ id, version }) => {
          const addon = await this.getAddonMetadata(id);
          if (!addon) {
            return { id, hasUpdate: false, currentVersion: version };
          }

          const hasUpdate = this.isNewerVersion(addon.version, version);
          return {
            id,
            hasUpdate,
            currentVersion: version,
            latestVersion: addon.version,
            downloadUrl: hasUpdate ? `/api/v1/addons/${id}/download` : undefined
          };
        })
      );

      res.json({ updates: results });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available addons from file system
   */
  private async getAvailableAddons(): Promise<AddonMetadata[]> {
    // Check cache
    if (Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return Array.from(this.addonCache.values());
    }

    try {
      const files = await fs.readdir(this.ADDONS_BASE_PATH);
      const addons: AddonMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadataPath = path.join(this.ADDONS_BASE_PATH, file);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as AddonMetadata;
          
          // Verify addon file exists
          const addonPath = path.join(this.ADDONS_BASE_PATH, metadata.filename);
          try {
            await fs.access(addonPath);
            addons.push(metadata);
            this.addonCache.set(metadata.id, metadata);
          } catch {
            logger.warn('Addon file missing', { id: metadata.id, filename: metadata.filename });
          }
        }
      }

      this.cacheTimestamp = Date.now();
      return addons;
    } catch (error) {
      logger.error('Failed to read addons directory', { error });
      throw new AppError('Failed to load addons', 500);
    }
  }

  /**
   * Get specific addon metadata
   */
  private async getAddonMetadata(addonId: string): Promise<AddonMetadata | null> {
    // Check cache first
    if (this.addonCache.has(addonId)) {
      return this.addonCache.get(addonId)!;
    }

    // Refresh cache and try again
    await this.getAvailableAddons();
    return this.addonCache.get(addonId) || null;
  }

  /**
   * Compare semantic versions
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string) => {
      const parts = v.split('.').map(Number);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
      };
    };

    const latestVer = parseVersion(latest);
    const currentVer = parseVersion(current);

    if (latestVer.major > currentVer.major) return true;
    if (latestVer.major < currentVer.major) return false;
    
    if (latestVer.minor > currentVer.minor) return true;
    if (latestVer.minor < currentVer.minor) return false;
    
    return latestVer.patch > currentVer.patch;
  }
}

// Export singleton instance
export const addonController = new AddonController();