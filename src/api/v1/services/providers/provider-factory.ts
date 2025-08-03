/**
 * @fileoverview Provider Factory for Image Generation
 * @description Factory pattern implementation for creating and managing image generation providers
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { 
  IImageProvider, 
  IProviderFactory, 
  ProviderConfig 
} from './base-provider.interface';
import { ImageProvider } from '../../schemas/image-generation-api.schema';
import { DalleProvider } from './dalle-provider';
import { StableDiffusionProvider } from './stable-diffusion-provider';
import { logger } from '../../../../monitoring/infrastructure/structured-logger';

/**
 * Provider registry type
 */
type ProviderConstructor = new () => IImageProvider;

/**
 * Provider Factory Implementation
 */
export class ProviderFactory implements IProviderFactory {
  private static instance: ProviderFactory;
  private providers: Map<ImageProvider, IImageProvider> = new Map();
  private providerRegistry: Map<ImageProvider, ProviderConstructor> = new Map();

  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.registerProviders();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  /**
   * Register available providers
   */
  private registerProviders(): void {
    this.providerRegistry.set(ImageProvider.DALLE, DalleProvider);
    this.providerRegistry.set(ImageProvider.STABLE_DIFFUSION, StableDiffusionProvider);
    // Add more providers as they are implemented
    // this.providerRegistry.set(ImageProvider.MIDJOURNEY, MidjourneyProvider);
  }

  /**
   * Create or get a provider instance
   */
  async createProvider(provider: ImageProvider, config: ProviderConfig): Promise<IImageProvider> {
    // Check if provider already exists and is initialized
    const existingProvider = this.providers.get(provider);
    if (existingProvider && existingProvider.isInitialized()) {
      logger.info('Returning existing provider instance', { provider });
      return existingProvider;
    }

    // Get provider constructor
    const ProviderClass = this.providerRegistry.get(provider);
    if (!ProviderClass) {
      throw new Error(`Provider ${provider} is not registered`);
    }

    // Create new provider instance
    logger.info('Creating new provider instance', { provider });
    const providerInstance = new ProviderClass();

    // Initialize provider
    try {
      await providerInstance.initialize(config);
      this.providers.set(provider, providerInstance);
      logger.info('Provider initialized successfully', { provider });
      return providerInstance;
    } catch (error) {
      logger.error('Failed to initialize provider', { provider, error: error.message });
      throw error;
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): ImageProvider[] {
    return Array.from(this.providerRegistry.keys());
  }

  /**
   * Get initialized providers
   */
  getInitializedProviders(): ImageProvider[] {
    return Array.from(this.providers.keys()).filter(
      provider => this.providers.get(provider)?.isInitialized()
    );
  }

  /**
   * Get provider instance if initialized
   */
  getProvider(provider: ImageProvider): IImageProvider | undefined {
    const instance = this.providers.get(provider);
    return instance?.isInitialized() ? instance : undefined;
  }

  /**
   * Shutdown a specific provider
   */
  async shutdownProvider(provider: ImageProvider): Promise<void> {
    const instance = this.providers.get(provider);
    if (instance) {
      await instance.shutdown();
      this.providers.delete(provider);
      logger.info('Provider shut down', { provider });
    }
  }

  /**
   * Shutdown all providers
   */
  async shutdownAll(): Promise<void> {
    logger.info('Shutting down all providers');
    const shutdownPromises = Array.from(this.providers.values()).map(
      provider => provider.shutdown()
    );
    await Promise.all(shutdownPromises);
    this.providers.clear();
    logger.info('All providers shut down');
  }

  /**
   * Health check all providers
   */
  async healthCheckAll(): Promise<Map<ImageProvider, any>> {
    const results = new Map<ImageProvider, any>();
    
    for (const [provider, instance] of this.providers.entries()) {
      if (instance.isInitialized()) {
        try {
          const health = await instance.checkHealth();
          results.set(provider, health);
        } catch (error) {
          results.set(provider, {
            status: 'error',
            message: error.message
          });
        }
      }
    }

    return results;
  }
}

/**
 * Export singleton instance
 */
export const providerFactory = ProviderFactory.getInstance();