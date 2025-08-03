/**
 * @fileoverview Image Generation Job Service
 * @description Manages async job queue for image generation with multi-provider support
 * @issue #23 - Async job queue implementation
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import {
  ImageGenerationRequest,
  JobStatus,
  ImageProvider,
  ImageGenerationResult,
  ErrorDetails,
  WebhookEvent,
  WebhookPayload,
  ServiceHealth,
  HealthCheckResponse
} from '../schemas/image-generation-api.schema';
import { DalleProvider } from '../providers/dalle.provider';
import { StableDiffusionProvider } from '../providers/stable-diffusion.provider';
import { MidjourneyProvider } from '../providers/midjourney.provider';
import { ImageProviderInterface } from '../providers/provider.interface';
import { WebhookService } from './webhook.service';
import { RateLimiterService } from '../../../rate-limiting/rate-limiter-service';

// Job data structure
interface ImageGenerationJobData extends ImageGenerationRequest {
  jobId: string;
  attempts: number;
  createdAt: Date;
  estimatedCompletionTime?: Date;
}

// Job result structure
export interface ImageGenerationJob {
  id: string;
  status: JobStatus;
  priority: 'low' | 'normal' | 'high';
  progress?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;
  result?: ImageGenerationResult;
  error?: ErrorDetails;
  metadata?: Record<string, any>;
}

export class ImageGenerationJobService {
  private queue: Queue<ImageGenerationJobData>;
  private worker: Worker<ImageGenerationJobData>;
  private queueEvents: QueueEvents;
  private redis: Redis;
  
  private providers: Map<ImageProvider, ImageProviderInterface>;
  private webhookService: WebhookService;
  private rateLimiter: RateLimiterService;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3
    });

    // Initialize queue
    this.queue = new Queue('image-generation', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100 // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 86400 // Keep failed jobs for 24 hours
        }
      }
    });

    // Initialize providers
    this.providers = new Map([
      [ImageProvider.DALLE_3, new DalleProvider('dalle-3')],
      [ImageProvider.DALLE_2, new DalleProvider('dalle-2')],
      [ImageProvider.STABLE_DIFFUSION, new StableDiffusionProvider()],
      [ImageProvider.MIDJOURNEY, new MidjourneyProvider()]
    ]);

    // Initialize services
    this.webhookService = new WebhookService();
    this.rateLimiter = new RateLimiterService();

    // Initialize worker
    this.initializeWorker();

    // Initialize queue events
    this.queueEvents = new QueueEvents('image-generation', {
      connection: this.redis
    });

    this.setupEventListeners();

    logger.info('Image generation job service initialized');
  }

  /**
   * Create a new image generation job
   */
  async createImageGenerationJob(request: ImageGenerationRequest): Promise<ImageGenerationJob> {
    // Check rate limits
    const rateLimitKey = `image-generation:${request.userId}`;
    const allowed = await this.rateLimiter.checkLimit(rateLimitKey, {
      windowMs: 60000, // 1 minute
      max: 100 // 100 images per minute per user
    });

    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }

    const jobId = uuidv4();
    const jobData: ImageGenerationJobData = {
      ...request,
      jobId,
      attempts: 0,
      createdAt: new Date(),
      estimatedCompletionTime: this.estimateCompletionTime(request)
    };

    // Add job to queue with priority
    const job = await this.queue.add('generate-image', jobData, {
      priority: this.getPriorityValue(request.priority || 'normal'),
      delay: 0
    });

    // Send webhook for job queued
    if (request.webhookUrl && request.webhookEvents?.includes(WebhookEvent.JOB_QUEUED)) {
      await this.webhookService.sendWebhook(request.webhookUrl, {
        event: WebhookEvent.JOB_QUEUED,
        timestamp: new Date().toISOString(),
        data: {
          jobId,
          status: JobStatus.QUEUED
        }
      });
    }

    return {
      id: jobId,
      status: JobStatus.QUEUED,
      priority: request.priority || 'normal',
      createdAt: jobData.createdAt,
      estimatedCompletionTime: jobData.estimatedCompletionTime,
      metadata: request.metadata
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ImageGenerationJob | null> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      // Check completed jobs in Redis
      const completedData = await this.redis.get(`job:completed:${jobId}`);
      if (completedData) {
        return JSON.parse(completedData);
      }
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.data.jobId,
      status: this.mapJobState(state),
      priority: job.data.priority || 'normal',
      progress: typeof progress === 'number' ? progress : undefined,
      createdAt: job.data.createdAt,
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      estimatedCompletionTime: job.data.estimatedCompletionTime,
      result: job.returnvalue,
      error: job.failedReason ? {
        code: 'GENERATION_FAILED',
        message: job.failedReason,
        retryable: job.attemptsMade < 3,
        details: {}
      } : undefined,
      metadata: job.data.metadata
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      return false;
    }

    const state = await job.getState();
    
    // Can only cancel pending or waiting jobs
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      
      // Send cancellation webhook
      const jobData = job.data;
      if (jobData.webhookUrl && jobData.webhookEvents?.includes(WebhookEvent.JOB_CANCELLED)) {
        await this.webhookService.sendWebhook(jobData.webhookUrl, {
          event: WebhookEvent.JOB_CANCELLED,
          timestamp: new Date().toISOString(),
          data: {
            jobId,
            status: JobStatus.CANCELLED
          }
        });
      }
      
      return true;
    }

    return false;
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy', services: any }> {
    const services: Record<string, ServiceHealth> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check Redis
    try {
      const start = Date.now();
      await this.redis.ping();
      services.redis = {
        status: 'up',
        latency: Date.now() - start
      };
    } catch (error) {
      services.redis = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      overallStatus = 'unhealthy';
    }

    // Check queue
    try {
      const queueHealth = await this.queue.getJobCounts();
      services.queue = {
        status: 'up',
        latency: 0
      };
    } catch (error) {
      services.queue = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      overallStatus = 'unhealthy';
    }

    // Check providers
    services.imageProviders = {};
    for (const [provider, instance] of this.providers) {
      try {
        const health = await instance.healthCheck();
        services.imageProviders[provider] = health;
        if (health.status === 'down') {
          overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      } catch (error) {
        services.imageProviders[provider] = {
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }

    // Database health would be checked here
    services.database = { status: 'up' }; // Placeholder

    return {
      status: overallStatus,
      services
    };
  }

  /**
   * Initialize the worker
   */
  private initializeWorker(): void {
    this.worker = new Worker<ImageGenerationJobData>(
      'image-generation',
      async (job: Job<ImageGenerationJobData>) => {
        const { data } = job;
        
        try {
          // Update progress
          await job.updateProgress(10);

          // Select provider
          const provider = this.selectProvider(data.provider);
          
          // Generate images
          await job.updateProgress(30);
          const result = await provider.generateImages({
            prompt: data.prompt,
            size: data.size,
            count: data.count,
            quality: data.quality,
            style: data.style
          });

          // Store results
          await job.updateProgress(90);
          await this.storeJobResult(data.jobId, result);

          // Send completion webhook
          if (data.webhookUrl && data.webhookEvents?.includes(WebhookEvent.JOB_COMPLETED)) {
            await this.webhookService.sendWebhook(data.webhookUrl, {
              event: WebhookEvent.JOB_COMPLETED,
              timestamp: new Date().toISOString(),
              data: {
                jobId: data.jobId,
                status: JobStatus.COMPLETED,
                result
              }
            });
          }

          await job.updateProgress(100);
          return result;

        } catch (error) {
          logger.error('Job processing failed', { error, jobId: data.jobId });
          
          // Send failure webhook
          if (data.webhookUrl && data.webhookEvents?.includes(WebhookEvent.JOB_FAILED)) {
            await this.webhookService.sendWebhook(data.webhookUrl, {
              event: WebhookEvent.JOB_FAILED,
              timestamp: new Date().toISOString(),
              data: {
                jobId: data.jobId,
                status: JobStatus.FAILED,
                error: {
                  code: 'GENERATION_FAILED',
                  message: error instanceof Error ? error.message : 'Unknown error',
                  retryable: job.attemptsMade < 3,
                  details: {}
                }
              }
            });
          }

          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        limiter: {
          max: 10,
          duration: 1000 // Process max 10 jobs per second
        }
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Job completed', { jobId: job.data.jobId });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Job failed', { jobId: job?.data.jobId, error: err });
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.queueEvents.on('progress', async ({ jobId, data }) => {
      const job = await this.queue.getJob(jobId);
      if (job && job.data.webhookUrl && job.data.webhookEvents?.includes(WebhookEvent.JOB_PROGRESS)) {
        await this.webhookService.sendWebhook(job.data.webhookUrl, {
          event: WebhookEvent.JOB_PROGRESS,
          timestamp: new Date().toISOString(),
          data: {
            jobId: job.data.jobId,
            status: JobStatus.PROCESSING,
            progress: data
          }
        });
      }
    });
  }

  /**
   * Helper methods
   */
  private getPriorityValue(priority: 'low' | 'normal' | 'high'): number {
    const priorityMap = {
      low: 10,
      normal: 5,
      high: 1
    };
    return priorityMap[priority];
  }

  private mapJobState(state: string): JobStatus {
    const stateMap: Record<string, JobStatus> = {
      waiting: JobStatus.QUEUED,
      active: JobStatus.PROCESSING,
      completed: JobStatus.COMPLETED,
      failed: JobStatus.FAILED,
      delayed: JobStatus.PENDING
    };
    return stateMap[state] || JobStatus.PENDING;
  }

  private selectProvider(requestedProvider: ImageProvider): ImageProviderInterface {
    if (requestedProvider === ImageProvider.AUTOMATIC) {
      // Select best available provider based on health and load
      for (const [provider, instance] of this.providers) {
        const health = instance.getHealth();
        if (health.status === 'up') {
          return instance;
        }
      }
    }
    
    const provider = this.providers.get(requestedProvider);
    if (!provider) {
      throw new Error(`Provider ${requestedProvider} not available`);
    }
    
    return provider;
  }

  private estimateCompletionTime(request: ImageGenerationRequest): Date {
    // Base time: 10 seconds per image
    const baseTime = 10000 * (request.count || 1);
    
    // Add time based on size
    const sizeMultiplier = request.size === '1024x1024' ? 1.5 : 1;
    
    // Add time based on quality
    const qualityMultiplier = request.quality === 'hd' ? 2 : 1;
    
    // Add queue wait time estimate (simplified)
    const queueTime = 5000; // 5 seconds average queue time
    
    const totalTime = (baseTime * sizeMultiplier * qualityMultiplier) + queueTime;
    
    return new Date(Date.now() + totalTime);
  }

  private async storeJobResult(jobId: string, result: ImageGenerationResult): Promise<void> {
    const ttl = 3600; // 1 hour
    await this.redis.setex(
      `job:completed:${jobId}`,
      ttl,
      JSON.stringify({
        id: jobId,
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result
      })
    );
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    await this.redis.quit();
  }
}