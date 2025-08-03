/**
 * @fileoverview Image generation service for chat sessions
 * @description Handles image generation requests with restrictions and AI integration
 * @issue #24 - Chat image generation restrictions
 * @author Alex - Semantest Team
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { ImageGenerationRestrictionService } from './image-generation-restriction.service';
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedImage,
  ImageSize,
  ImageGenerationError,
  ImageGenerationErrorCode
} from '../../domain/image-generation.types';

/**
 * Service for generating images in chat sessions
 */
export class ImageGenerationService {
  constructor(
    private readonly restrictionService: ImageGenerationRestrictionService
  ) {
    logger.info('Image generation service initialized');
  }

  /**
   * Generate images based on request
   */
  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const requestId = randomUUID();
    
    try {
      // Validate request against restrictions
      await this.restrictionService.validateRequest(request);
      
      // Set defaults
      const size = request.size || '512x512';
      const count = Math.min(request.count || 1, 4); // Max 4 images
      
      logger.info('Starting image generation', {
        metadata: {
          requestId,
          userId: request.userId,
          sessionId: request.sessionId,
          size,
          count
        }
      });
      
      // Generate images
      const images = await this.callImageGenerationAPI(
        request.prompt,
        size,
        count,
        requestId
      );
      
      // Record successful generation
      await this.restrictionService.recordGeneration(
        request.userId,
        request.sessionId,
        images.length
      );
      
      // Get remaining quota
      const remainingQuota = this.restrictionService.getRemainingQuota(request.userId);
      const nextAllowedAt = this.restrictionService.getNextAllowedTime(request.userId);
      
      const response: ImageGenerationResponse = {
        requestId,
        images,
        generationTime: Date.now() - startTime,
        remainingQuota,
        nextAllowedAt: nextAllowedAt || undefined
      };
      
      logger.info('Image generation completed', {
        metadata: {
          requestId,
          imagesGenerated: images.length,
          generationTime: response.generationTime,
          remainingQuota
        }
      });
      
      return response;
      
    } catch (error) {
      logger.error('Image generation failed', {
        error,
        metadata: {
          requestId,
          userId: request.userId,
          sessionId: request.sessionId
        }
      });
      
      if (error instanceof ImageGenerationError) {
        throw error;
      }
      
      throw new ImageGenerationError(
        ImageGenerationErrorCode.GENERATION_FAILED,
        'Failed to generate image',
        { originalError: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Call external image generation API
   * This is a placeholder - integrate with actual image generation service
   */
  private async callImageGenerationAPI(
    prompt: string,
    size: ImageSize,
    count: number,
    requestId: string
  ): Promise<GeneratedImage[]> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate placeholder images
    const images: GeneratedImage[] = [];
    
    for (let i = 0; i < count; i++) {
      const imageId = randomUUID();
      
      images.push({
        id: imageId,
        url: `https://api.semantest.com/images/${requestId}/${imageId}.png`,
        size,
        createdAt: new Date(),
        prompt,
        contentFilter: {
          passed: true,
          categories: ['safe'],
          scores: { safe: 0.99 }
        }
      });
    }
    
    // In production, this would:
    // 1. Call an actual image generation API (OpenAI DALL-E, Stable Diffusion, etc.)
    // 2. Upload generated images to storage
    // 3. Apply additional content filtering
    // 4. Return actual image URLs
    
    return images;
  }

  /**
   * Get image generation status for a user
   */
  async getUserStatus(userId: string): Promise<{
    enabled: boolean;
    remainingQuota: number;
    nextAllowedAt?: Date;
    config: any;
  }> {
    const config = this.restrictionService.getConfig();
    const remainingQuota = this.restrictionService.getRemainingQuota(userId);
    const nextAllowedAt = this.restrictionService.getNextAllowedTime(userId);
    
    return {
      enabled: config.enabled,
      remainingQuota,
      nextAllowedAt: nextAllowedAt || undefined,
      config: {
        dailyLimit: config.dailyLimit,
        sessionLimit: config.sessionLimit,
        cooldownPeriod: config.cooldownPeriod,
        allowedSizes: config.allowedSizes,
        maxPromptLength: config.maxPromptLength
      }
    };
  }

  /**
   * Admin function to update configuration
   */
  updateConfiguration(config: any): void {
    this.restrictionService.updateConfig(config);
  }

  /**
   * Admin function to reset user quota
   */
  resetUserQuota(userId: string): void {
    this.restrictionService.resetUserQuota(userId);
  }
}