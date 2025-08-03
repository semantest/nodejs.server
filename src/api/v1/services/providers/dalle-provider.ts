/**
 * @fileoverview DALL-E 3 Provider Implementation
 * @description OpenAI DALL-E 3 image generation provider
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { 
  BaseImageProvider, 
  GenerateImageRequest, 
  ProviderGenerationOptions,
  ProviderHealthCheck
} from './base-provider.interface';
import { 
  ImageProvider, 
  ImageSize, 
  ImageQuality,
  ImageGenerationResult,
  ProviderCapabilities,
  ErrorDetails,
  ErrorCode
} from '../../schemas/image-generation-api.schema';
import { logger } from '../../../../monitoring/infrastructure/structured-logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * DALL-E specific options
 */
interface DalleOptions extends ProviderGenerationOptions {
  model?: 'dall-e-2' | 'dall-e-3';
  style?: 'vivid' | 'natural';
  responseFormat?: 'url' | 'b64_json';
}

/**
 * DALL-E 3 Provider Implementation
 */
export class DalleProvider extends BaseImageProvider {
  readonly provider = ImageProvider.DALLE;
  readonly displayName = 'OpenAI DALL-E 3';
  readonly capabilities: ProviderCapabilities = {
    supportedSizes: ['1024x1024', '1024x1792', '1792x1024'],
    supportedQualities: ['standard', 'hd'],
    maxImagesPerRequest: 1, // DALL-E 3 only supports 1 image per request
    maxPromptLength: 4000,
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsStylePreset: true,
    estimatedGenerationTime: {
      '1024x1024': 15,
      '1024x1792': 20,
      '1792x1024': 20
    }
  };

  private openai?: OpenAI;
  private defaultModel: 'dall-e-3' = 'dall-e-3';

  /**
   * Initialize OpenAI client
   */
  protected async doInitialize(): Promise<void> {
    if (!this.config?.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout || 60000,
      maxRetries: this.config.maxRetries || 3
    });

    // Test connection
    try {
      await this.checkHealth();
    } catch (error) {
      throw new Error(`Failed to initialize DALL-E provider: ${error.message}`);
    }
  }

  /**
   * Provider-specific validation
   */
  protected async doValidateRequest(request: GenerateImageRequest): Promise<string[]> {
    const errors: string[] = [];

    // DALL-E 3 specific validations
    if (request.count > 1) {
      errors.push('DALL-E 3 only supports generating 1 image per request');
    }

    if (request.negativePrompt) {
      errors.push('DALL-E 3 does not support negative prompts');
    }

    if (request.seed !== undefined) {
      errors.push('DALL-E 3 does not support seed values for reproducibility');
    }

    // Check for content policy violations in prompt
    const bannedWords = ['nsfw', 'nude', 'explicit', 'violence', 'gore'];
    const lowerPrompt = request.prompt.toLowerCase();
    if (bannedWords.some(word => lowerPrompt.includes(word))) {
      errors.push('Prompt may violate OpenAI content policy');
    }

    return errors;
  }

  /**
   * Generate images using DALL-E
   */
  async generateImages(
    request: GenerateImageRequest, 
    options?: DalleOptions
  ): Promise<ImageGenerationResult> {
    if (!this.openai) {
      throw new Error('Provider not initialized');
    }

    const startTime = Date.now();
    const imageIds: string[] = [];

    try {
      logger.info('Starting DALL-E image generation', {
        requestId: request.requestId,
        prompt: request.prompt.substring(0, 100),
        size: request.size,
        quality: request.quality
      });

      // Map our size format to DALL-E format
      const dalleSize = this.mapSizeToDalle(request.size);
      
      // Generate image
      const response = await this.openai.images.generate({
        model: options?.model || this.defaultModel,
        prompt: request.prompt,
        n: 1, // DALL-E 3 only supports 1
        size: dalleSize as any,
        quality: request.quality as 'standard' | 'hd',
        style: options?.style || 'vivid',
        response_format: options?.responseFormat || 'url'
      });

      const generatedImages = response.data.map(image => {
        const imageId = uuidv4();
        imageIds.push(imageId);

        return {
          id: imageId,
          url: image.url!,
          size: request.size,
          prompt: request.prompt,
          revisedPrompt: image.revised_prompt,
          metadata: {
            provider: this.provider,
            model: options?.model || this.defaultModel,
            style: options?.style || 'vivid',
            quality: request.quality,
            generatedAt: new Date().toISOString()
          }
        };
      });

      const processingTime = Date.now() - startTime;

      const result: ImageGenerationResult = {
        jobId: request.requestId,
        status: 'completed',
        provider: this.provider,
        images: generatedImages,
        processingTime,
        cost: this.estimateCost(request),
        metadata: {
          requestId: request.requestId,
          userId: request.userId,
          enhancedPrompt: generatedImages[0]?.revisedPrompt
        }
      };

      logger.info('DALL-E generation completed', {
        requestId: request.requestId,
        imageIds,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('DALL-E generation failed', {
        requestId: request.requestId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Check provider health
   */
  async checkHealth(): Promise<ProviderHealthCheck> {
    const startTime = Date.now();

    try {
      // Use models list as health check
      await this.openai?.models.list();
      
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        message: 'DALL-E provider is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        message: `Health check failed: ${error.message}`,
        details: {
          apiStatus: error.status || 0
        }
      };
    }
  }

  /**
   * Estimate generation cost
   */
  estimateCost(request: GenerateImageRequest): number {
    // DALL-E 3 pricing (as of 2024)
    // Standard quality: $0.040 per image
    // HD quality: $0.080 per image
    const basePrice = request.quality === 'hd' ? 0.080 : 0.040;
    
    // Size multiplier
    let sizeMultiplier = 1;
    if (request.size === '1024x1792' || request.size === '1792x1024') {
      sizeMultiplier = 1.5; // Larger sizes cost more
    }

    return basePrice * sizeMultiplier * request.count;
  }

  /**
   * Handle DALL-E specific errors
   */
  handleError(error: any): ErrorDetails {
    // OpenAI specific error handling
    if (error.status === 401) {
      return {
        code: ErrorCode.PROVIDER_AUTH_FAILED,
        message: 'Invalid OpenAI API key',
        provider: this.provider,
        retryable: false
      };
    }

    if (error.status === 429) {
      return {
        code: ErrorCode.PROVIDER_RATE_LIMITED,
        message: 'OpenAI rate limit exceeded',
        provider: this.provider,
        retryable: true,
        retryAfter: parseInt(error.headers?.['retry-after'] || '60')
      };
    }

    if (error.status === 400 && error.message?.includes('content policy')) {
      return {
        code: ErrorCode.INVALID_PROMPT,
        message: 'Prompt violates OpenAI content policy',
        provider: this.provider,
        retryable: false
      };
    }

    if (error.status === 503) {
      return {
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: 'OpenAI service temporarily unavailable',
        provider: this.provider,
        retryable: true,
        retryAfter: 30
      };
    }

    // Generic error
    return {
      code: ErrorCode.PROVIDER_ERROR,
      message: error.message || 'Unknown DALL-E error',
      provider: this.provider,
      retryable: false,
      details: {
        status: error.status,
        type: error.type,
        code: error.code
      }
    };
  }

  /**
   * Get quota information
   */
  async getQuota(): Promise<{ used: number; limit: number; resetAt?: Date }> {
    // OpenAI doesn't provide quota API, return mock data
    // In production, this would track usage in our database
    return {
      used: 0,
      limit: 1000,
      resetAt: new Date(Date.now() + 86400000) // 24 hours
    };
  }

  /**
   * Cancel generation (not supported by DALL-E)
   */
  async cancelGeneration(requestId: string): Promise<boolean> {
    logger.warn('Cancel generation requested but not supported by DALL-E', { requestId });
    return false;
  }

  /**
   * Shutdown provider
   */
  protected async doShutdown(): Promise<void> {
    this.openai = undefined;
  }

  /**
   * Map our size format to DALL-E format
   */
  private mapSizeToDalle(size: ImageSize): string {
    // DALL-E uses different size format
    const sizeMap: Record<string, string> = {
      '1024x1024': '1024x1024',
      '1024x1792': '1024x1792',
      '1792x1024': '1792x1024'
    };

    return sizeMap[size] || '1024x1024';
  }
}