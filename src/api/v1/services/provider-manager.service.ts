/**
 * @fileoverview Provider Manager Service
 * @description Manages provider selection, load balancing, and failover for image generation
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { 
  IImageProvider, 
  GenerateImageRequest,
  ProviderConfig,
  ProviderHealthCheck
} from './providers/base-provider.interface';
import { 
  ImageProvider, 
  ImageGenerationResult,
  ErrorCode,
  ErrorDetails
} from '../schemas/image-generation-api.schema';
import { providerFactory } from './providers/provider-factory';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { ConfigService } from '../../../config/config.service';
import { MetricsService } from '../../../monitoring/metrics/metrics-service';

/**
 * Provider selection strategy
 */
enum SelectionStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_COST = 'least_cost',
  FASTEST = 'fastest',
  HEALTH_BASED = 'health_based'
}

/**
 * Provider performance metrics
 */
interface ProviderMetrics {
  averageResponseTime: number;
  successRate: number;
  totalRequests: number;
  totalFailures: number;
  lastHealthCheck?: ProviderHealthCheck;
}

/**
 * Provider Manager Service
 */
export class ProviderManagerService {
  private static instance: ProviderManagerService;
  private providerMetrics: Map<ImageProvider, ProviderMetrics> = new Map();
  private lastSelectedProvider: ImageProvider | null = null;
  private selectionStrategy: SelectionStrategy = SelectionStrategy.HEALTH_BASED;
  private configService: ConfigService;
  private metricsService: MetricsService;

  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.configService = ConfigService.getInstance();
    this.metricsService = MetricsService.getInstance();
    this.initializeProviders();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProviderManagerService {
    if (!ProviderManagerService.instance) {
      ProviderManagerService.instance = new ProviderManagerService();
    }
    return ProviderManagerService.instance;
  }

  /**
   * Initialize all configured providers
   */
  private async initializeProviders(): Promise<void> {
    const providers = [
      {
        type: ImageProvider.DALLE,
        config: {
          apiKey: process.env.OPENAI_API_KEY!,
          timeout: 60000,
          maxRetries: 3,
          rateLimit: {
            requestsPerMinute: 50,
            requestsPerDay: 1000
          }
        }
      },
      {
        type: ImageProvider.STABLE_DIFFUSION,
        config: {
          apiKey: process.env.STABILITY_API_KEY!,
          timeout: 60000,
          maxRetries: 3,
          rateLimit: {
            requestsPerMinute: 30,
            requestsPerDay: 500
          }
        }
      }
    ];

    for (const { type, config } of providers) {
      if (config.apiKey) {
        try {
          await providerFactory.createProvider(type, config);
          this.providerMetrics.set(type, {
            averageResponseTime: 0,
            successRate: 1,
            totalRequests: 0,
            totalFailures: 0
          });
          logger.info('Provider initialized', { provider: type });
        } catch (error) {
          logger.error('Failed to initialize provider', { provider: type, error: error.message });
        }
      } else {
        logger.warn('Provider API key not configured', { provider: type });
      }
    }

    // Start health check interval
    this.startHealthCheckInterval();
  }

  /**
   * Generate images with automatic provider selection
   */
  async generateImages(request: GenerateImageRequest): Promise<ImageGenerationResult> {
    // Select provider based on strategy
    const provider = await this.selectProvider(request);
    if (!provider) {
      throw new Error('No available providers');
    }

    const startTime = Date.now();
    const providerInstance = providerFactory.getProvider(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      logger.info('Generating images with provider', {
        provider,
        requestId: request.requestId,
        strategy: this.selectionStrategy
      });

      // Validate request with provider
      const validation = await providerInstance.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Generate images
      const result = await providerInstance.generateImages(request);

      // Update metrics
      this.updateProviderMetrics(provider, true, Date.now() - startTime);

      // Emit metrics
      this.metricsService.recordImageGeneration({
        provider,
        success: true,
        responseTime: Date.now() - startTime,
        imageCount: result.images.length
      });

      return result;

    } catch (error) {
      // Update metrics
      this.updateProviderMetrics(provider, false, Date.now() - startTime);

      // Handle error
      const errorDetails = providerInstance.handleError(error);

      // Try failover if retryable
      if (errorDetails.retryable) {
        logger.warn('Provider failed, attempting failover', { 
          provider, 
          error: errorDetails.message 
        });

        return this.failoverToNextProvider(request, provider, errorDetails);
      }

      throw error;
    }
  }

  /**
   * Select provider based on strategy
   */
  private async selectProvider(request: GenerateImageRequest): Promise<ImageProvider | null> {
    const availableProviders = providerFactory.getInitializedProviders();
    if (availableProviders.length === 0) {
      return null;
    }

    // Filter providers that support the request
    const compatibleProviders = await this.filterCompatibleProviders(request, availableProviders);
    if (compatibleProviders.length === 0) {
      return null;
    }

    switch (this.selectionStrategy) {
      case SelectionStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(compatibleProviders);
      
      case SelectionStrategy.LEAST_COST:
        return this.selectLeastCost(request, compatibleProviders);
      
      case SelectionStrategy.FASTEST:
        return this.selectFastest(compatibleProviders);
      
      case SelectionStrategy.HEALTH_BASED:
      default:
        return this.selectHealthBased(compatibleProviders);
    }
  }

  /**
   * Filter providers that can handle the request
   */
  private async filterCompatibleProviders(
    request: GenerateImageRequest, 
    providers: ImageProvider[]
  ): Promise<ImageProvider[]> {
    const compatible: ImageProvider[] = [];

    for (const provider of providers) {
      const instance = providerFactory.getProvider(provider);
      if (instance) {
        const validation = await instance.validateRequest(request);
        if (validation.valid) {
          compatible.push(provider);
        }
      }
    }

    return compatible;
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(providers: ImageProvider[]): ImageProvider {
    if (!this.lastSelectedProvider || !providers.includes(this.lastSelectedProvider)) {
      this.lastSelectedProvider = providers[0];
      return providers[0];
    }

    const currentIndex = providers.indexOf(this.lastSelectedProvider);
    const nextIndex = (currentIndex + 1) % providers.length;
    this.lastSelectedProvider = providers[nextIndex];
    return providers[nextIndex];
  }

  /**
   * Select provider with least cost
   */
  private selectLeastCost(request: GenerateImageRequest, providers: ImageProvider[]): ImageProvider {
    let leastCost = Infinity;
    let selectedProvider = providers[0];

    for (const provider of providers) {
      const instance = providerFactory.getProvider(provider);
      if (instance) {
        const cost = instance.estimateCost(request);
        if (cost < leastCost) {
          leastCost = cost;
          selectedProvider = provider;
        }
      }
    }

    return selectedProvider;
  }

  /**
   * Select fastest provider based on metrics
   */
  private selectFastest(providers: ImageProvider[]): ImageProvider {
    let fastestTime = Infinity;
    let selectedProvider = providers[0];

    for (const provider of providers) {
      const metrics = this.providerMetrics.get(provider);
      if (metrics && metrics.averageResponseTime < fastestTime) {
        fastestTime = metrics.averageResponseTime;
        selectedProvider = provider;
      }
    }

    return selectedProvider;
  }

  /**
   * Select provider based on health and performance
   */
  private selectHealthBased(providers: ImageProvider[]): ImageProvider {
    let bestScore = -Infinity;
    let selectedProvider = providers[0];

    for (const provider of providers) {
      const score = this.calculateProviderScore(provider);
      if (score > bestScore) {
        bestScore = score;
        selectedProvider = provider;
      }
    }

    return selectedProvider;
  }

  /**
   * Calculate provider health score
   */
  private calculateProviderScore(provider: ImageProvider): number {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics) return 0;

    // Weighted scoring
    const successWeight = 0.4;
    const speedWeight = 0.3;
    const healthWeight = 0.3;

    let score = 0;

    // Success rate score
    score += metrics.successRate * successWeight;

    // Speed score (inverse of response time, normalized)
    const speedScore = metrics.averageResponseTime > 0 
      ? Math.min(1, 5000 / metrics.averageResponseTime) 
      : 1;
    score += speedScore * speedWeight;

    // Health score
    const healthScore = metrics.lastHealthCheck?.status === 'healthy' ? 1 : 0.5;
    score += healthScore * healthWeight;

    return score;
  }

  /**
   * Failover to next available provider
   */
  private async failoverToNextProvider(
    request: GenerateImageRequest,
    failedProvider: ImageProvider,
    originalError: ErrorDetails
  ): Promise<ImageGenerationResult> {
    const availableProviders = providerFactory.getInitializedProviders()
      .filter(p => p !== failedProvider);

    if (availableProviders.length === 0) {
      throw new Error(`All providers failed: ${originalError.message}`);
    }

    // Try next provider
    const nextProvider = await this.selectProvider(request);
    if (!nextProvider || nextProvider === failedProvider) {
      throw new Error(`No alternative provider available: ${originalError.message}`);
    }

    logger.info('Attempting failover to next provider', { 
      from: failedProvider, 
      to: nextProvider 
    });

    return this.generateImages({ ...request, metadata: { failover: true } });
  }

  /**
   * Update provider metrics
   */
  private updateProviderMetrics(
    provider: ImageProvider, 
    success: boolean, 
    responseTime: number
  ): void {
    const metrics = this.providerMetrics.get(provider) || {
      averageResponseTime: 0,
      successRate: 1,
      totalRequests: 0,
      totalFailures: 0
    };

    metrics.totalRequests++;
    if (!success) {
      metrics.totalFailures++;
    }

    // Update success rate
    metrics.successRate = (metrics.totalRequests - metrics.totalFailures) / metrics.totalRequests;

    // Update average response time (exponential moving average)
    const alpha = 0.3; // Weight for new value
    metrics.averageResponseTime = success 
      ? alpha * responseTime + (1 - alpha) * metrics.averageResponseTime
      : metrics.averageResponseTime;

    this.providerMetrics.set(provider, metrics);
  }

  /**
   * Start health check interval
   */
  private startHealthCheckInterval(): void {
    setInterval(async () => {
      const healthResults = await providerFactory.healthCheckAll();
      
      for (const [provider, health] of healthResults.entries()) {
        const metrics = this.providerMetrics.get(provider);
        if (metrics) {
          metrics.lastHealthCheck = health;
          this.providerMetrics.set(provider, metrics);
        }

        logger.debug('Provider health check', { provider, health });
      }
    }, 60000); // Check every minute
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(): Map<ImageProvider, ProviderMetrics> {
    return new Map(this.providerMetrics);
  }

  /**
   * Set selection strategy
   */
  setSelectionStrategy(strategy: SelectionStrategy): void {
    this.selectionStrategy = strategy;
    logger.info('Provider selection strategy updated', { strategy });
  }

  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    await providerFactory.shutdownAll();
  }
}

/**
 * Export singleton instance
 */
export const providerManager = ProviderManagerService.getInstance();