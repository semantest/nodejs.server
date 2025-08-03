/**
 * @fileoverview Image Generation Controller
 * @description Handles HTTP requests for image generation endpoints
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  GenerateImageRequest, 
  GenerateImagesRequestBody,
  ErrorResponse,
  ImageProvider
} from '../schemas/image-generation-api.schema';
import { ProviderManagerService } from '../services/provider-manager.service';
import { ImageGenerationJobService } from '../services/image-generation-job.service';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { AppError } from '../../../shared/errors/app-error';

/**
 * Controller for image generation endpoints
 */
export class ImageGenerationController {
  private providerManager: ProviderManagerService;
  private jobService: ImageGenerationJobService;

  constructor() {
    this.providerManager = ProviderManagerService.getInstance();
    this.jobService = ImageGenerationJobService.getInstance();
  }

  /**
   * Generate images synchronously
   */
  async generateImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const requestSchema = z.object({
        prompt: z.string().min(1).max(4000),
        negativePrompt: z.string().optional(),
        provider: z.nativeEnum(ImageProvider).optional(),
        size: z.string(),
        quality: z.string(),
        count: z.number().int().min(1).max(10),
        seed: z.number().optional(),
        stylePreset: z.string().optional(),
        enhancePrompt: z.boolean().optional(),
        options: z.record(z.any()).optional()
      });

      const validatedBody = requestSchema.parse(req.body) as GenerateImagesRequestBody;
      const userId = req.user?.id || 'anonymous';
      const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();

      logger.info('Image generation request received', {
        userId,
        requestId,
        provider: validatedBody.provider,
        prompt: validatedBody.prompt.substring(0, 100) + '...'
      });

      // Create generation request
      const request: GenerateImageRequest = {
        ...validatedBody,
        userId,
        requestId,
        size: validatedBody.size as any, // Type will be validated by provider
        quality: validatedBody.quality as any,
        metadata: {
          source: 'api',
          timestamp: new Date().toISOString()
        }
      };

      // Generate images
      const result = await this.providerManager.generateImages(request);

      logger.info('Image generation completed', {
        userId,
        requestId,
        provider: result.provider,
        imageCount: result.images.length,
        processingTime: result.processingTime
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate images asynchronously using job queue
   */
  async generateImagesAsync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body (same as sync)
      const requestSchema = z.object({
        prompt: z.string().min(1).max(4000),
        negativePrompt: z.string().optional(),
        provider: z.nativeEnum(ImageProvider).optional(),
        size: z.string(),
        quality: z.string(),
        count: z.number().int().min(1).max(10),
        seed: z.number().optional(),
        stylePreset: z.string().optional(),
        enhancePrompt: z.boolean().optional(),
        options: z.record(z.any()).optional(),
        webhookUrl: z.string().url().optional(),
        priority: z.enum(['low', 'normal', 'high']).optional()
      });

      const validatedBody = requestSchema.parse(req.body);
      const userId = req.user?.id || 'anonymous';
      const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();

      logger.info('Async image generation request received', {
        userId,
        requestId,
        provider: validatedBody.provider,
        priority: validatedBody.priority || 'normal'
      });

      // Create job
      const job = await this.jobService.createImageGenerationJob({
        ...validatedBody,
        userId,
        requestId,
        size: validatedBody.size as any,
        quality: validatedBody.quality as any,
        metadata: {
          source: 'api',
          timestamp: new Date().toISOString(),
          webhookUrl: validatedBody.webhookUrl
        }
      }, {
        priority: validatedBody.priority || 'normal'
      });

      res.status(202).json({
        jobId: job.id,
        status: 'processing',
        requestId,
        message: 'Image generation job created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id || 'anonymous';

      const job = await this.jobService.getJob(jobId);
      
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Check authorization
      if (job.data.userId !== userId && userId !== 'admin') {
        throw new AppError('Unauthorized', 403);
      }

      res.json({
        jobId: job.id,
        status: await job.getState(),
        progress: job.progress,
        result: job.returnvalue,
        createdAt: new Date(job.timestamp),
        completedAt: job.finishedOn ? new Date(job.finishedOn) : null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id || 'anonymous';

      const job = await this.jobService.getJob(jobId);
      
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Check authorization
      if (job.data.userId !== userId && userId !== 'admin') {
        throw new AppError('Unauthorized', 403);
      }

      await this.jobService.cancelJob(jobId);

      res.json({
        jobId,
        status: 'cancelled',
        message: 'Job cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available providers and their status
   */
  async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providers = await this.providerManager.getProviderStatuses();
      res.json(providers);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      
      if (!Object.values(ImageProvider).includes(provider as ImageProvider)) {
        throw new AppError('Invalid provider', 400);
      }

      const capabilities = await this.providerManager.getProviderCapabilities(provider as ImageProvider);
      
      if (!capabilities) {
        throw new AppError('Provider not available', 404);
      }

      res.json(capabilities);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.providerManager.healthCheckAll();
      const allHealthy = Object.values(health).every(h => h.status === 'healthy');

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        providers: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const imageGenerationController = new ImageGenerationController();