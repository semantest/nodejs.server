/**
 * @fileoverview Types for chat image generation restrictions
 * @description Defines types and interfaces for controlling image generation in chat sessions
 * @issue #24 - Chat image generation restrictions
 * @author Alex - Semantest Team
 */

/**
 * Image generation restriction configuration
 */
export interface ImageGenerationConfig {
  /** Whether image generation is enabled globally */
  enabled: boolean;
  
  /** Maximum images per user per day */
  dailyLimit: number;
  
  /** Maximum images per session */
  sessionLimit: number;
  
  /** Cooldown period between generations (milliseconds) */
  cooldownPeriod: number;
  
  /** Allowed image sizes */
  allowedSizes: ImageSize[];
  
  /** Maximum prompt length */
  maxPromptLength: number;
  
  /** Blocked terms in prompts */
  blockedTerms: string[];
  
  /** Content filtering level */
  contentFilterLevel: ContentFilterLevel;
}

/**
 * Allowed image sizes
 */
export type ImageSize = '256x256' | '512x512' | '1024x1024';

/**
 * Content filtering levels
 */
export type ContentFilterLevel = 'strict' | 'moderate' | 'minimal';

/**
 * Image generation request
 */
export interface ImageGenerationRequest {
  /** Chat session ID */
  sessionId: string;
  
  /** User ID making the request */
  userId: string;
  
  /** Text prompt for image generation */
  prompt: string;
  
  /** Requested image size */
  size?: ImageSize;
  
  /** Number of images to generate (1-4) */
  count?: number;
  
  /** Request metadata */
  metadata?: Record<string, any>;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  /** Request ID for tracking */
  requestId: string;
  
  /** Generated image URLs */
  images: GeneratedImage[];
  
  /** Time taken to generate (ms) */
  generationTime: number;
  
  /** Remaining daily quota */
  remainingQuota: number;
  
  /** Next allowed generation time */
  nextAllowedAt?: Date;
}

/**
 * Generated image data
 */
export interface GeneratedImage {
  /** Unique image ID */
  id: string;
  
  /** Image URL */
  url: string;
  
  /** Image size */
  size: ImageSize;
  
  /** Generation timestamp */
  createdAt: Date;
  
  /** Prompt used */
  prompt: string;
  
  /** Content filter results */
  contentFilter?: ContentFilterResult;
}

/**
 * Content filter result
 */
export interface ContentFilterResult {
  /** Whether content passed filters */
  passed: boolean;
  
  /** Detected categories */
  categories?: string[];
  
  /** Confidence scores */
  scores?: Record<string, number>;
  
  /** Reason if blocked */
  blockedReason?: string;
}

/**
 * User image generation quota
 */
export interface UserImageQuota {
  /** User ID */
  userId: string;
  
  /** Images generated today */
  dailyCount: number;
  
  /** Date of last reset */
  lastResetDate: Date;
  
  /** Total images generated */
  totalGenerated: number;
  
  /** Last generation timestamp */
  lastGeneratedAt?: Date;
  
  /** Session usage map */
  sessionUsage: Map<string, number>;
}

/**
 * Image generation error codes
 */
export enum ImageGenerationErrorCode {
  DISABLED = 'IMAGE_GENERATION_DISABLED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  COOLDOWN_ACTIVE = 'COOLDOWN_ACTIVE',
  INVALID_SIZE = 'INVALID_SIZE',
  PROMPT_TOO_LONG = 'PROMPT_TOO_LONG',
  BLOCKED_CONTENT = 'BLOCKED_CONTENT',
  CONTENT_FILTER_FAILED = 'CONTENT_FILTER_FAILED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

/**
 * Image generation error
 */
export class ImageGenerationError extends Error {
  constructor(
    public readonly code: ImageGenerationErrorCode,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}