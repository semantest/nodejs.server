/**
 * @fileoverview Image Generation API Schema Definitions
 * @description Complete TypeScript schema for async image generation API with multi-provider support
 * @issue #23 - NewChatRequested endpoint with proper schemas
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { z } from 'zod';

// ===== Enums and Constants =====

export enum ImageProvider {
  DALLE_3 = 'dalle3',
  DALLE_2 = 'dalle2',
  STABLE_DIFFUSION = 'stable_diffusion',
  MIDJOURNEY = 'midjourney',
  AUTOMATIC = 'automatic' // System selects best provider
}

export enum JobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum ImageSize {
  SMALL = '256x256',
  MEDIUM = '512x512',
  LARGE = '1024x1024',
  HD = '1792x1024', // DALL-E 3 HD
  WIDE = '1024x576', // 16:9 aspect ratio
  TALL = '576x1024'  // 9:16 aspect ratio
}

export enum WebhookEvent {
  JOB_QUEUED = 'job.queued',
  JOB_STARTED = 'job.started',
  JOB_PROGRESS = 'job.progress',
  JOB_COMPLETED = 'job.completed',
  JOB_FAILED = 'job.failed',
  JOB_CANCELLED = 'job.cancelled'
}

// ===== Request Schemas =====

/**
 * New chat request with image generation
 * Primary endpoint for issue #23
 */
export const NewChatRequestSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(4000),
  imageGeneration: z.object({
    enabled: z.boolean().default(true),
    provider: z.nativeEnum(ImageProvider).default(ImageProvider.AUTOMATIC),
    size: z.nativeEnum(ImageSize).default(ImageSize.MEDIUM),
    count: z.number().int().min(1).max(4).default(1),
    quality: z.enum(['standard', 'hd']).default('standard'),
    style: z.enum(['vivid', 'natural']).optional(),
    webhookUrl: z.string().url().optional(),
    webhookEvents: z.array(z.nativeEnum(WebhookEvent)).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }).optional(),
  chatContext: z.object({
    previousMessages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string().datetime()
    })).optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(1).max(4000).optional()
  }).optional()
});

export type NewChatRequest = z.infer<typeof NewChatRequestSchema>;

/**
 * Batch image generation request
 */
export const BatchImageGenerationRequestSchema = z.object({
  userId: z.string().uuid(),
  apiKey: z.string().optional(),
  jobs: z.array(z.object({
    prompt: z.string().min(1).max(4000),
    provider: z.nativeEnum(ImageProvider).default(ImageProvider.AUTOMATIC),
    size: z.nativeEnum(ImageSize).default(ImageSize.MEDIUM),
    count: z.number().int().min(1).max(4).default(1),
    quality: z.enum(['standard', 'hd']).default('standard'),
    style: z.enum(['vivid', 'natural']).optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    metadata: z.record(z.string(), z.any()).optional()
  })).min(1).max(100),
  webhookUrl: z.string().url().optional(),
  webhookEvents: z.array(z.nativeEnum(WebhookEvent)).optional()
});

export type BatchImageGenerationRequest = z.infer<typeof BatchImageGenerationRequestSchema>;

/**
 * Single image generation request
 */
export const ImageGenerationRequestSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(4000),
  provider: z.nativeEnum(ImageProvider).default(ImageProvider.AUTOMATIC),
  size: z.nativeEnum(ImageSize).default(ImageSize.MEDIUM),
  count: z.number().int().min(1).max(4).default(1),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  webhookUrl: z.string().url().optional(),
  webhookEvents: z.array(z.nativeEnum(WebhookEvent)).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;

// ===== Response Schemas =====

/**
 * Job response - returned immediately after job creation
 */
export interface JobResponse {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  estimatedCompletionTime?: string;
  priority: 'low' | 'normal' | 'high';
  statusUrl: string;
  cancelUrl: string;
}

/**
 * Batch job response
 */
export interface BatchJobResponse {
  batchId: string;
  jobs: JobResponse[];
  totalJobs: number;
  statusUrl: string;
}

/**
 * Job status response
 */
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress?: number; // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
  result?: ImageGenerationResult;
  error?: ErrorDetails;
  metadata?: Record<string, any>;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  images: GeneratedImage[];
  provider: ImageProvider;
  totalCost?: number;
  processingTime: number;
  contentWarnings?: ContentWarning[];
}

/**
 * Generated image details
 */
export interface GeneratedImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  size: ImageSize;
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  sizeBytes: number;
  hash: string; // SHA-256 hash for deduplication
  expiresAt?: string; // ISO 8601 timestamp
  metadata?: {
    revisedPrompt?: string; // DALL-E 3 revised prompt
    seed?: number;
    model?: string;
  };
}

/**
 * Content warning
 */
export interface ContentWarning {
  type: 'violence' | 'adult' | 'medical' | 'racy' | 'spoof';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

/**
 * Error details
 */
export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: string; // ISO 8601 timestamp
}

/**
 * New chat response with optional image generation job
 */
export interface NewChatResponse {
  sessionId: string;
  messageId: string;
  chatResponse: {
    content: string;
    role: 'assistant';
    timestamp: string;
  };
  imageGenerationJob?: JobResponse;
}

// ===== Rate Limiting Response =====

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: string; // ISO 8601 timestamp
  retryAfter?: number; // seconds
}

// ===== Webhook Payloads =====

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: {
    jobId: string;
    batchId?: string;
    status: JobStatus;
    progress?: number;
    result?: ImageGenerationResult;
    error?: ErrorDetails;
  };
}

// ===== Health Check Response =====

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    queue: ServiceHealth;
    imageProviders: Record<ImageProvider, ServiceHealth>;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
}

// ===== API Error Response =====

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    traceId: string;
    timestamp: string;
  };
}

// ===== Validation Helpers =====

export const validateNewChatRequest = (data: unknown): NewChatRequest => {
  return NewChatRequestSchema.parse(data);
};

export const validateImageGenerationRequest = (data: unknown): ImageGenerationRequest => {
  return ImageGenerationRequestSchema.parse(data);
};

export const validateBatchRequest = (data: unknown): BatchImageGenerationRequest => {
  return BatchImageGenerationRequestSchema.parse(data);
};