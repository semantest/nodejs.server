/**
 * @fileoverview Stable Diffusion Provider Implementation
 * @description Stability AI's Stable Diffusion image generation provider
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
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
 * Stable Diffusion specific options
 */
interface StableDiffusionOptions extends ProviderGenerationOptions {
  engineId?: string;
  cfgScale?: number;
  steps?: number;
  sampler?: 'DDIM' | 'DDPM' | 'K_DPMPP_2M' | 'K_DPMPP_2S_ANCESTRAL' | 'K_DPM_2' | 'K_DPM_2_ANCESTRAL' | 'K_EULER' | 'K_EULER_ANCESTRAL' | 'K_HEUN' | 'K_LMS';
  clipGuidancePreset?: 'FAST_BLUE' | 'FAST_GREEN' | 'NONE' | 'SIMPLE' | 'SLOW' | 'SLOWER' | 'SLOWEST';
  stylePreset?: string;
}

/**
 * Stable Diffusion API response
 */
interface StableDiffusionResponse {
  artifacts: Array<{
    base64: string;
    seed: number;
    finishReason: string;
  }>;
}

/**
 * Stable Diffusion Provider Implementation
 */
export class StableDiffusionProvider extends BaseImageProvider {
  readonly provider = ImageProvider.STABLE_DIFFUSION;
  readonly displayName = 'Stability AI Stable Diffusion';
  readonly capabilities: ProviderCapabilities = {
    supportedSizes: ['512x512', '768x768', '1024x1024', '1152x896', '896x1152', '1216x832', '832x1216', '1344x768', '768x1344'],
    supportedQualities: ['standard', 'high'],
    maxImagesPerRequest: 10,
    maxPromptLength: 2000,
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsStylePreset: true,
    estimatedGenerationTime: {
      '512x512': 5,
      '768x768': 8,
      '1024x1024': 12,
      '1152x896': 15,
      '896x1152': 15,
      '1216x832': 18,
      '832x1216': 18,
      '1344x768': 20,
      '768x1344': 20
    }
  };

  private apiClient?: AxiosInstance;
  private defaultEngine = 'stable-diffusion-xl-1024-v1-0';

  /**
   * Initialize Stability AI client
   */
  protected async doInitialize(): Promise<void> {
    if (!this.config?.apiKey) {
      throw new Error('Stability AI API key is required');
    }

    this.apiClient = axios.create({
      baseURL: this.config.baseUrl || 'https://api.stability.ai',
      timeout: this.config.timeout || 60000,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...this.config.customHeaders
      }
    });

    // Add retry interceptor
    this.setupRetryInterceptor();

    // Test connection
    try {
      await this.checkHealth();
    } catch (error) {
      throw new Error(`Failed to initialize Stable Diffusion provider: ${error.message}`);
    }
  }

  /**
   * Setup axios retry interceptor
   */
  private setupRetryInterceptor(): void {
    let retryCount = 0;
    const maxRetries = this.config?.maxRetries || 3;

    this.apiClient!.interceptors.response.use(
      response => response,
      async error => {
        if (retryCount < maxRetries && error.response?.status >= 500) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.apiClient!.request(error.config);
        }
        retryCount = 0;
        return Promise.reject(error);
      }
    );
  }

  /**
   * Provider-specific validation
   */
  protected async doValidateRequest(request: GenerateImageRequest): Promise<string[]> {
    const errors: string[] = [];

    // Stable Diffusion specific validations
    if (request.prompt.length < 3) {
      errors.push('Prompt must be at least 3 characters long');
    }

    // Check for extreme negative prompts
    if (request.negativePrompt && request.negativePrompt.length > 1000) {
      errors.push('Negative prompt must be less than 1000 characters');
    }

    // Validate seed if provided
    if (request.seed !== undefined && (request.seed < 0 || request.seed > 4294967295)) {
      errors.push('Seed must be between 0 and 4294967295');
    }

    return errors;
  }

  /**
   * Generate images using Stable Diffusion
   */
  async generateImages(
    request: GenerateImageRequest, 
    options?: StableDiffusionOptions
  ): Promise<ImageGenerationResult> {
    if (!this.apiClient) {
      throw new Error('Provider not initialized');
    }

    const startTime = Date.now();
    const imageIds: string[] = [];

    try {
      logger.info('Starting Stable Diffusion image generation', {
        requestId: request.requestId,
        prompt: request.prompt.substring(0, 100),
        size: request.size,
        quality: request.quality,
        count: request.count
      });

      // Map size to width and height
      const { width, height } = this.parseSizeString(request.size);
      
      // Prepare request body
      const requestBody = {
        text_prompts: [
          {
            text: request.prompt,
            weight: 1
          }
        ],
        cfg_scale: options?.cfgScale || (request.quality === 'high' ? 8 : 7),
        width,
        height,
        samples: request.count,
        steps: options?.steps || (request.quality === 'high' ? 50 : 30),
        ...(request.seed !== undefined && { seed: request.seed }),
        ...(request.negativePrompt && {
          text_prompts: [
            {
              text: request.prompt,
              weight: 1
            },
            {
              text: request.negativePrompt,
              weight: -1
            }
          ]
        }),
        ...(options?.sampler && { sampler: options.sampler }),
        ...(options?.clipGuidancePreset && { clip_guidance_preset: options.clipGuidancePreset }),
        ...(options?.stylePreset && { style_preset: options.stylePreset })
      };

      // Make API request
      const response = await this.apiClient.post<StableDiffusionResponse>(
        `/v1/generation/${options?.engineId || this.defaultEngine}/text-to-image`,
        requestBody
      );

      // Process response
      const generatedImages = response.data.artifacts.map((artifact, index) => {
        const imageId = uuidv4();
        imageIds.push(imageId);

        // In production, upload base64 to S3 and return URL
        // For now, we'll create a data URL
        const dataUrl = `data:image/png;base64,${artifact.base64}`;

        return {
          id: imageId,
          url: dataUrl,
          size: request.size,
          prompt: request.prompt,
          seed: artifact.seed,
          metadata: {
            provider: this.provider,
            engine: options?.engineId || this.defaultEngine,
            steps: options?.steps || (request.quality === 'high' ? 50 : 30),
            cfgScale: options?.cfgScale || (request.quality === 'high' ? 8 : 7),
            sampler: options?.sampler,
            finishReason: artifact.finishReason,
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
          engine: options?.engineId || this.defaultEngine
        }
      };

      logger.info('Stable Diffusion generation completed', {
        requestId: request.requestId,
        imageIds,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('Stable Diffusion generation failed', {
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
      // Check account balance as health check
      const response = await this.apiClient?.get('/v1/user/balance');
      
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        message: 'Stable Diffusion provider is operational',
        details: {
          apiStatus: response?.status,
          quota: {
            used: 0, // Would parse from response
            limit: response?.data?.credits || 0,
            resetAt: new Date(Date.now() + 86400000) // 24 hours
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        message: `Health check failed: ${error.message}`,
        details: {
          apiStatus: error.response?.status || 0
        }
      };
    }
  }

  /**
   * Estimate generation cost
   */
  estimateCost(request: GenerateImageRequest): number {
    // Stable Diffusion pricing model (credits-based)
    // Approximate USD conversion: 1 credit = $0.01
    
    // Base cost per image based on resolution
    const { width, height } = this.parseSizeString(request.size);
    const pixels = width * height;
    
    let creditsPerImage = 0;
    if (pixels <= 512 * 512) {
      creditsPerImage = 0.2;
    } else if (pixels <= 768 * 768) {
      creditsPerImage = 0.3;
    } else if (pixels <= 1024 * 1024) {
      creditsPerImage = 0.5;
    } else {
      creditsPerImage = 0.7;
    }

    // Quality multiplier
    if (request.quality === 'high') {
      creditsPerImage *= 1.5;
    }

    // Convert to USD
    const costPerImage = creditsPerImage * 0.01;
    return costPerImage * request.count;
  }

  /**
   * Handle Stable Diffusion specific errors
   */
  handleError(error: any): ErrorDetails {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 401) {
      return {
        code: ErrorCode.PROVIDER_AUTH_FAILED,
        message: 'Invalid Stability AI API key',
        provider: this.provider,
        retryable: false
      };
    }

    if (status === 402) {
      return {
        code: ErrorCode.INSUFFICIENT_CREDITS,
        message: 'Insufficient Stability AI credits',
        provider: this.provider,
        retryable: false
      };
    }

    if (status === 429) {
      return {
        code: ErrorCode.PROVIDER_RATE_LIMITED,
        message: 'Stability AI rate limit exceeded',
        provider: this.provider,
        retryable: true,
        retryAfter: parseInt(error.response?.headers?.['retry-after'] || '60')
      };
    }

    if (status === 400) {
      return {
        code: ErrorCode.INVALID_REQUEST,
        message: `Invalid request: ${message}`,
        provider: this.provider,
        retryable: false
      };
    }

    if (status >= 500) {
      return {
        code: ErrorCode.PROVIDER_ERROR,
        message: 'Stability AI service error',
        provider: this.provider,
        retryable: true,
        retryAfter: 30
      };
    }

    // Generic error
    return {
      code: ErrorCode.PROVIDER_ERROR,
      message: message || 'Unknown Stable Diffusion error',
      provider: this.provider,
      retryable: false,
      details: {
        status,
        originalError: error.response?.data
      }
    };
  }

  /**
   * Get quota information
   */
  async getQuota(): Promise<{ used: number; limit: number; resetAt?: Date }> {
    try {
      const response = await this.apiClient?.get('/v1/user/balance');
      const credits = response?.data?.credits || 0;
      
      return {
        used: 0, // Would track in our database
        limit: credits,
        resetAt: undefined // Credits don't reset
      };
    } catch (error) {
      logger.error('Failed to get Stable Diffusion quota', { error });
      return { used: 0, limit: 0 };
    }
  }

  /**
   * Cancel generation (not directly supported)
   */
  async cancelGeneration(requestId: string): Promise<boolean> {
    logger.warn('Cancel generation requested but not supported by Stable Diffusion', { requestId });
    return false;
  }

  /**
   * Shutdown provider
   */
  protected async doShutdown(): Promise<void> {
    this.apiClient = undefined;
  }

  /**
   * Parse size string to width and height
   */
  private parseSizeString(size: ImageSize): { width: number; height: number } {
    const [width, height] = size.split('x').map(Number);
    return { width, height };
  }
}