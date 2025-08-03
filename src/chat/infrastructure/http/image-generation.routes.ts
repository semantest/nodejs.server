/**
 * @fileoverview Image generation routes for chat API
 * @description REST endpoints for image generation with restrictions
 * @issue #24 - Chat image generation restrictions
 * @author Alex - Semantest Team
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { ImageGenerationService } from '../../application/services/image-generation.service';
import { ImageGenerationRestrictionService } from '../../application/services/image-generation-restriction.service';
import {
  ImageGenerationRequest,
  ImageGenerationError,
  ImageGenerationErrorCode
} from '../../domain/image-generation.types';

// Initialize services
const restrictionService = new ImageGenerationRestrictionService();
const imageGenerationService = new ImageGenerationService(restrictionService);

// Create router
export const imageGenerationRouter = Router();

/**
 * Generate images for a chat session
 * POST /api/chat/images/generate
 */
imageGenerationRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, prompt, size, count } = req.body;
    
    // Validate required fields
    if (!sessionId || !userId || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['sessionId', 'userId', 'prompt']
      });
    }
    
    const request: ImageGenerationRequest = {
      sessionId,
      userId,
      prompt,
      size,
      count,
      metadata: req.body.metadata
    };
    
    const response = await imageGenerationService.generateImages(request);
    
    res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      logger.warn('Image generation request failed', {
        error,
        metadata: {
          code: error.code,
          details: error.details
        }
      });
      
      // Map error codes to HTTP status codes
      const statusMap: Record<ImageGenerationErrorCode, number> = {
        [ImageGenerationErrorCode.DISABLED]: 503,
        [ImageGenerationErrorCode.DAILY_LIMIT_EXCEEDED]: 429,
        [ImageGenerationErrorCode.SESSION_LIMIT_EXCEEDED]: 429,
        [ImageGenerationErrorCode.COOLDOWN_ACTIVE]: 429,
        [ImageGenerationErrorCode.INVALID_SIZE]: 400,
        [ImageGenerationErrorCode.PROMPT_TOO_LONG]: 400,
        [ImageGenerationErrorCode.BLOCKED_CONTENT]: 400,
        [ImageGenerationErrorCode.CONTENT_FILTER_FAILED]: 400,
        [ImageGenerationErrorCode.GENERATION_FAILED]: 500,
        [ImageGenerationErrorCode.UNAUTHORIZED]: 401
      };
      
      const status = statusMap[error.code] || 500;
      
      return res.status(status).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
    
    logger.error('Unexpected error in image generation', { error });
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * Get image generation status for a user
 * GET /api/chat/images/status/:userId
 */
imageGenerationRouter.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const status = await imageGenerationService.getUserStatus(userId);
    
    res.status(200).json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('Error getting image generation status', { error });
    res.status(500).json({
      error: 'Failed to get status'
    });
  }
});

/**
 * Get image generation configuration (admin)
 * GET /api/chat/images/config
 */
imageGenerationRouter.get('/config', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    
    const config = restrictionService.getConfig();
    
    res.status(200).json({
      success: true,
      data: config
    });
    
  } catch (error) {
    logger.error('Error getting image generation config', { error });
    res.status(500).json({
      error: 'Failed to get configuration'
    });
  }
});

/**
 * Update image generation configuration (admin)
 * PUT /api/chat/images/config
 */
imageGenerationRouter.put('/config', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    
    const config = req.body;
    
    imageGenerationService.updateConfiguration(config);
    
    res.status(200).json({
      success: true,
      message: 'Configuration updated'
    });
    
  } catch (error) {
    logger.error('Error updating image generation config', { error });
    res.status(500).json({
      error: 'Failed to update configuration'
    });
  }
});

/**
 * Reset user quota (admin)
 * POST /api/chat/images/reset-quota/:userId
 */
imageGenerationRouter.post('/reset-quota/:userId', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    
    const { userId } = req.params;
    
    imageGenerationService.resetUserQuota(userId);
    
    res.status(200).json({
      success: true,
      message: `Quota reset for user ${userId}`
    });
    
  } catch (error) {
    logger.error('Error resetting user quota', { error });
    res.status(500).json({
      error: 'Failed to reset quota'
    });
  }
});