/**
 * @fileoverview Image Generation API Routes v1
 * @description RESTful API endpoints for async image generation with job queue
 * @issue #23 - NewChatRequested endpoint implementation
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import {
  validateNewChatRequest,
  validateImageGenerationRequest,
  validateBatchRequest,
  NewChatRequest,
  ImageGenerationRequest,
  BatchImageGenerationRequest,
  JobStatus,
  JobResponse,
  BatchJobResponse,
  JobStatusResponse,
  NewChatResponse,
  ApiErrorResponse,
  HealthCheckResponse,
  ImageProvider
} from '../schemas/image-generation-api.schema';
import { ImageGenerationJobService } from '../services/image-generation-job.service';
import { ChatService } from '../../../chat/application/services/chat.service';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { authMiddleware } from '../../../auth/middleware/auth-middleware';
import { validateApiKey } from '../middleware/api-key.middleware';

const router = Router();
const jobService = new ImageGenerationJobService();
const chatService = new ChatService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/v1/chat/new
 * Create new chat with optional image generation
 * This is the primary endpoint for issue #23
 */
router.post('/chat/new', 
  rateLimitMiddleware({ windowMs: 60000, max: 10 }), // 10 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validatedRequest = validateNewChatRequest(req.body);
      
      logger.info('New chat requested', {
        userId: validatedRequest.userId,
        hasImageGeneration: !!validatedRequest.imageGeneration?.enabled,
        provider: validatedRequest.imageGeneration?.provider
      });

      // Create chat session
      const sessionId = validatedRequest.sessionId || uuidv4();
      const messageId = uuidv4();
      
      const chatSession = await chatService.createSession({
        id: sessionId,
        userId: validatedRequest.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{
          id: messageId,
          sessionId,
          content: validatedRequest.prompt,
          role: 'user',
          timestamp: new Date()
        }],
        status: 'active',
        metadata: validatedRequest.chatContext
      });

      // Generate chat response
      const chatResponse = await chatService.generateResponse(
        sessionId,
        validatedRequest.prompt,
        validatedRequest.chatContext
      );

      const response: NewChatResponse = {
        sessionId,
        messageId,
        chatResponse: {
          content: chatResponse,
          role: 'assistant',
          timestamp: new Date().toISOString()
        }
      };

      // Handle image generation if requested
      if (validatedRequest.imageGeneration?.enabled) {
        const imageJob = await jobService.createImageGenerationJob({
          userId: validatedRequest.userId,
          sessionId,
          prompt: validatedRequest.prompt,
          provider: validatedRequest.imageGeneration.provider,
          size: validatedRequest.imageGeneration.size,
          count: validatedRequest.imageGeneration.count,
          quality: validatedRequest.imageGeneration.quality,
          style: validatedRequest.imageGeneration.style,
          priority: 'normal',
          webhookUrl: validatedRequest.imageGeneration.webhookUrl,
          webhookEvents: validatedRequest.imageGeneration.webhookEvents,
          metadata: {
            ...validatedRequest.imageGeneration.metadata,
            chatMessageId: messageId
          }
        });

        response.imageGenerationJob = {
          jobId: imageJob.id,
          status: imageJob.status,
          createdAt: imageJob.createdAt.toISOString(),
          estimatedCompletionTime: imageJob.estimatedCompletionTime?.toISOString(),
          priority: imageJob.priority,
          statusUrl: `/api/v1/images/status/${imageJob.id}`,
          cancelUrl: `/api/v1/images/cancel/${imageJob.id}`
        };
      }

      res.status(201).json(response);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const apiError: ApiErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error,
            traceId: uuidv4(),
            timestamp: new Date().toISOString()
          }
        };
        return res.status(400).json(apiError);
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/images/generate
 * Single image generation endpoint
 */
router.post('/images/generate',
  rateLimitMiddleware({ windowMs: 60000, max: 30 }), // 30 requests per minute
  validateApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedRequest = validateImageGenerationRequest(req.body);
      
      const job = await jobService.createImageGenerationJob(validatedRequest);
      
      const response: JobResponse = {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        estimatedCompletionTime: job.estimatedCompletionTime?.toISOString(),
        priority: job.priority,
        statusUrl: `/api/v1/images/status/${job.id}`,
        cancelUrl: `/api/v1/images/cancel/${job.id}`
      };

      res.status(202).json(response); // 202 Accepted for async operation

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const apiError: ApiErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error,
            traceId: uuidv4(),
            timestamp: new Date().toISOString()
          }
        };
        return res.status(400).json(apiError);
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/images/batch
 * Batch image generation endpoint
 */
router.post('/images/batch',
  rateLimitMiddleware({ windowMs: 60000, max: 5 }), // 5 batch requests per minute
  validateApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedRequest = validateBatchRequest(req.body);
      
      const batchId = uuidv4();
      const jobs: JobResponse[] = [];

      // Create individual jobs for each request
      for (const jobRequest of validatedRequest.jobs) {
        const job = await jobService.createImageGenerationJob({
          ...jobRequest,
          userId: validatedRequest.userId,
          metadata: {
            ...jobRequest.metadata,
            batchId
          },
          webhookUrl: validatedRequest.webhookUrl,
          webhookEvents: validatedRequest.webhookEvents
        });

        jobs.push({
          jobId: job.id,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          estimatedCompletionTime: job.estimatedCompletionTime?.toISOString(),
          priority: job.priority,
          statusUrl: `/api/v1/images/status/${job.id}`,
          cancelUrl: `/api/v1/images/cancel/${job.id}`
        });
      }

      const response: BatchJobResponse = {
        batchId,
        jobs,
        totalJobs: jobs.length,
        statusUrl: `/api/v1/images/batch/${batchId}/status`
      };

      res.status(202).json(response);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const apiError: ApiErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error,
            traceId: uuidv4(),
            timestamp: new Date().toISOString()
          }
        };
        return res.status(400).json(apiError);
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/images/status/:jobId
 * Get job status and results
 */
router.get('/images/status/:jobId',
  rateLimitMiddleware({ windowMs: 60000, max: 120 }), // 120 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      
      const job = await jobService.getJobStatus(jobId);
      
      if (!job) {
        const apiError: ApiErrorResponse = {
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Job ${jobId} not found`,
            traceId: uuidv4(),
            timestamp: new Date().toISOString()
          }
        };
        return res.status(404).json(apiError);
      }

      const response: JobStatusResponse = {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        estimatedCompletionTime: job.estimatedCompletionTime?.toISOString(),
        result: job.result,
        error: job.error,
        metadata: job.metadata
      };

      res.json(response);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/images/cancel/:jobId
 * Cancel a pending or processing job
 */
router.delete('/images/cancel/:jobId',
  rateLimitMiddleware({ windowMs: 60000, max: 30 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      
      const cancelled = await jobService.cancelJob(jobId);
      
      if (!cancelled) {
        const apiError: ApiErrorResponse = {
          error: {
            code: 'CANNOT_CANCEL',
            message: `Job ${jobId} cannot be cancelled`,
            traceId: uuidv4(),
            timestamp: new Date().toISOString()
          }
        };
        return res.status(400).json(apiError);
      }

      res.status(204).send(); // No content

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await jobService.getHealthStatus();
    
    const response: HealthCheckResponse = {
      status: health.status,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: health.services
    };

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);

  } catch (error) {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'down' },
        redis: { status: 'down' },
        queue: { status: 'down' },
        imageProviders: {} as any
      }
    };
    res.status(503).json(response);
  }
});

// Error handler middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('API error', { error: err, path: req.path });
  
  const apiError: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      traceId: uuidv4(),
      timestamp: new Date().toISOString()
    }
  };
  
  res.status(500).json(apiError);
});

export default router;