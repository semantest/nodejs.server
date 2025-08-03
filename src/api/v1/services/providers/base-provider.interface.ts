/**
 * @fileoverview Base Provider Interface for Image Generation
 * @description Abstract interface that all image generation providers must implement
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { 
  ImageProvider, 
  ImageSize, 
  ImageQuality,
  ImageGenerationResult,
  ImageGenerationOptions,
  ProviderCapabilities,
  ProviderStatus,
  ErrorDetails
} from '../../schemas/image-generation-api.schema';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };
  customHeaders?: Record<string, string>;
}

/**
 * Provider health check result
 */
export interface ProviderHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastChecked: Date;
  message?: string;
  details?: {
    apiStatus?: number;
    quota?: {
      used: number;
      limit: number;
      resetAt: Date;
    };
  };
}

/**
 * Image generation request interface
 */
export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  size: ImageSize;
  quality: ImageQuality;
  count: number;
  seed?: number;
  stylePreset?: string;
  enhancePrompt?: boolean;
  userId: string;
  requestId: string;
  metadata?: Record<string, any>;
}

/**
 * Provider-specific generation options
 */
export interface ProviderGenerationOptions {
  model?: string;
  steps?: number;
  guidanceScale?: number;
  sampler?: string;
  clipGuidancePreset?: string;
  stylePreset?: string;
  extras?: Record<string, any>;
}

/**
 * Base interface for all image generation providers
 */
export interface IImageProvider {
  /**
   * Provider identifier
   */
  readonly provider: ImageProvider;

  /**
   * Provider display name
   */
  readonly displayName: string;

  /**
   * Provider capabilities
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Check if provider is initialized and ready
   */
  isInitialized(): boolean;

  /**
   * Generate images based on the request
   */
  generateImages(request: GenerateImageRequest, options?: ProviderGenerationOptions): Promise<ImageGenerationResult>;

  /**
   * Validate if the provider can handle the request
   */
  validateRequest(request: GenerateImageRequest): Promise<{ valid: boolean; errors?: string[] }>;

  /**
   * Get provider health status
   */
  checkHealth(): Promise<ProviderHealthCheck>;

  /**
   * Get current provider status
   */
  getStatus(): ProviderStatus;

  /**
   * Cancel an ongoing generation (if supported)
   */
  cancelGeneration?(requestId: string): Promise<boolean>;

  /**
   * Get estimated cost for the request
   */
  estimateCost(request: GenerateImageRequest): number;

  /**
   * Get remaining quota/credits
   */
  getQuota?(): Promise<{ used: number; limit: number; resetAt?: Date }>;

  /**
   * Handle provider-specific errors
   */
  handleError(error: any): ErrorDetails;

  /**
   * Cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * Abstract base class for image providers
 */
export abstract class BaseImageProvider implements IImageProvider {
  abstract readonly provider: ImageProvider;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected config?: ProviderConfig;
  protected initialized = false;
  protected status: ProviderStatus = {
    available: false,
    message: 'Not initialized'
  };

  /**
   * Initialize the provider
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    await this.doInitialize();
    this.initialized = true;
    this.status = {
      available: true,
      message: 'Provider initialized successfully'
    };
  }

  /**
   * Provider-specific initialization
   */
  protected abstract doInitialize(): Promise<void>;

  /**
   * Check initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get provider status
   */
  getStatus(): ProviderStatus {
    return this.status;
  }

  /**
   * Validate request against provider capabilities
   */
  async validateRequest(request: GenerateImageRequest): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check size support
    if (!this.capabilities.supportedSizes.includes(request.size)) {
      errors.push(`Size ${request.size} is not supported by ${this.displayName}`);
    }

    // Check quality support
    if (!this.capabilities.supportedQualities.includes(request.quality)) {
      errors.push(`Quality ${request.quality} is not supported by ${this.displayName}`);
    }

    // Check count limits
    if (request.count > this.capabilities.maxImagesPerRequest) {
      errors.push(`Maximum ${this.capabilities.maxImagesPerRequest} images per request for ${this.displayName}`);
    }

    // Check prompt length
    if (request.prompt.length > this.capabilities.maxPromptLength) {
      errors.push(`Prompt exceeds maximum length of ${this.capabilities.maxPromptLength} characters`);
    }

    // Provider-specific validation
    const providerErrors = await this.doValidateRequest(request);
    errors.push(...providerErrors);

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Provider-specific validation
   */
  protected abstract doValidateRequest(request: GenerateImageRequest): Promise<string[]>;

  /**
   * Generate images
   */
  abstract generateImages(request: GenerateImageRequest, options?: ProviderGenerationOptions): Promise<ImageGenerationResult>;

  /**
   * Check provider health
   */
  abstract checkHealth(): Promise<ProviderHealthCheck>;

  /**
   * Estimate generation cost
   */
  abstract estimateCost(request: GenerateImageRequest): number;

  /**
   * Handle provider errors
   */
  abstract handleError(error: any): ErrorDetails;

  /**
   * Shutdown provider
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
    this.status = {
      available: false,
      message: 'Provider shut down'
    };
    await this.doShutdown();
  }

  /**
   * Provider-specific shutdown
   */
  protected abstract doShutdown(): Promise<void>;
}

/**
 * Provider factory interface
 */
export interface IProviderFactory {
  createProvider(provider: ImageProvider, config: ProviderConfig): Promise<IImageProvider>;
  getAvailableProviders(): ImageProvider[];
}