/**
 * @fileoverview Image generation restriction service
 * @description Handles validation and restrictions for image generation in chat sessions
 * @issue #24 - Chat image generation restrictions
 * @author Alex - Semantest Team
 */

import { logger } from '../../../monitoring/infrastructure/structured-logger';
import {
  ImageGenerationConfig,
  ImageGenerationRequest,
  UserImageQuota,
  ImageGenerationError,
  ImageGenerationErrorCode,
  ImageSize,
  ContentFilterLevel
} from '../../domain/image-generation.types';

/**
 * Service for managing image generation restrictions
 */
export class ImageGenerationRestrictionService {
  // Default configuration
  private config: ImageGenerationConfig = {
    enabled: true,
    dailyLimit: 50,
    sessionLimit: 10,
    cooldownPeriod: 60000, // 1 minute
    allowedSizes: ['256x256', '512x512', '1024x1024'],
    maxPromptLength: 1000,
    blockedTerms: [],
    contentFilterLevel: 'moderate'
  };

  // User quota tracking (in-memory for now)
  private userQuotas: Map<string, UserImageQuota> = new Map();

  constructor(config?: Partial<ImageGenerationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    logger.info('Image generation restriction service initialized', {
      metadata: { config: this.config }
    });
  }

  /**
   * Validate image generation request against restrictions
   */
  async validateRequest(request: ImageGenerationRequest): Promise<void> {
    // Check if image generation is enabled
    if (!this.config.enabled) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.DISABLED,
        'Image generation is currently disabled'
      );
    }

    // Validate prompt length
    if (request.prompt.length > this.config.maxPromptLength) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.PROMPT_TOO_LONG,
        `Prompt exceeds maximum length of ${this.config.maxPromptLength} characters`,
        { promptLength: request.prompt.length }
      );
    }

    // Validate image size
    if (request.size && !this.config.allowedSizes.includes(request.size)) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.INVALID_SIZE,
        `Invalid image size. Allowed sizes: ${this.config.allowedSizes.join(', ')}`,
        { requestedSize: request.size }
      );
    }

    // Check content filter
    await this.validateContent(request.prompt);

    // Check user quotas
    await this.checkUserQuota(request.userId, request.sessionId);

    // Check cooldown
    await this.checkCooldown(request.userId);

    logger.info('Image generation request validated', {
      metadata: {
        userId: request.userId,
        sessionId: request.sessionId,
        promptLength: request.prompt.length
      }
    });
  }

  /**
   * Validate content against blocked terms and content filter
   */
  private async validateContent(prompt: string): Promise<void> {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check blocked terms
    for (const term of this.config.blockedTerms) {
      if (lowerPrompt.includes(term.toLowerCase())) {
        throw new ImageGenerationError(
          ImageGenerationErrorCode.BLOCKED_CONTENT,
          'Prompt contains blocked content',
          { blockedTerm: term }
        );
      }
    }

    // Apply content filter based on level
    const filterResult = await this.applyContentFilter(prompt, this.config.contentFilterLevel);
    
    if (!filterResult.passed) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.CONTENT_FILTER_FAILED,
        'Content failed safety filters',
        filterResult
      );
    }
  }

  /**
   * Apply content filtering based on configured level
   */
  private async applyContentFilter(prompt: string, level: ContentFilterLevel): Promise<{ passed: boolean; reason?: string }> {
    // Placeholder for content filtering logic
    // In production, this would integrate with a content moderation API
    
    const suspiciousPatterns = {
      strict: [
        /\b(violence|weapon|drug|adult|explicit)\b/i,
        /\b(harmful|dangerous|illegal)\b/i
      ],
      moderate: [
        /\b(extreme violence|illegal drug|explicit adult)\b/i
      ],
      minimal: [
        /\b(illegal activity|extreme content)\b/i
      ]
    };

    const patterns = suspiciousPatterns[level] || suspiciousPatterns.moderate;
    
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        return {
          passed: false,
          reason: `Content violates ${level} content policy`
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check user quota limits
   */
  private async checkUserQuota(userId: string, sessionId: string): Promise<void> {
    const quota = this.getUserQuota(userId);
    
    // Reset daily quota if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (quota.lastResetDate < today) {
      quota.dailyCount = 0;
      quota.lastResetDate = today;
      quota.sessionUsage.clear();
    }

    // Check daily limit
    if (quota.dailyCount >= this.config.dailyLimit) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.DAILY_LIMIT_EXCEEDED,
        `Daily limit of ${this.config.dailyLimit} images exceeded`,
        {
          dailyCount: quota.dailyCount,
          limit: this.config.dailyLimit
        }
      );
    }

    // Check session limit
    const sessionCount = quota.sessionUsage.get(sessionId) || 0;
    if (sessionCount >= this.config.sessionLimit) {
      throw new ImageGenerationError(
        ImageGenerationErrorCode.SESSION_LIMIT_EXCEEDED,
        `Session limit of ${this.config.sessionLimit} images exceeded`,
        {
          sessionCount,
          limit: this.config.sessionLimit
        }
      );
    }
  }

  /**
   * Check cooldown period
   */
  private async checkCooldown(userId: string): Promise<void> {
    const quota = this.getUserQuota(userId);
    
    if (quota.lastGeneratedAt) {
      const timeSinceLastGeneration = Date.now() - quota.lastGeneratedAt.getTime();
      
      if (timeSinceLastGeneration < this.config.cooldownPeriod) {
        const remainingCooldown = this.config.cooldownPeriod - timeSinceLastGeneration;
        const nextAllowedAt = new Date(quota.lastGeneratedAt.getTime() + this.config.cooldownPeriod);
        
        throw new ImageGenerationError(
          ImageGenerationErrorCode.COOLDOWN_ACTIVE,
          `Please wait ${Math.ceil(remainingCooldown / 1000)} seconds before generating another image`,
          {
            remainingCooldown,
            nextAllowedAt
          }
        );
      }
    }
  }

  /**
   * Record successful image generation
   */
  async recordGeneration(userId: string, sessionId: string, count: number = 1): Promise<void> {
    const quota = this.getUserQuota(userId);
    
    quota.dailyCount += count;
    quota.totalGenerated += count;
    quota.lastGeneratedAt = new Date();
    
    const sessionCount = quota.sessionUsage.get(sessionId) || 0;
    quota.sessionUsage.set(sessionId, sessionCount + count);
    
    logger.info('Image generation recorded', {
      metadata: {
        userId,
        sessionId,
        count,
        dailyCount: quota.dailyCount,
        totalGenerated: quota.totalGenerated
      }
    });
  }

  /**
   * Get user quota information
   */
  getUserQuota(userId: string): UserImageQuota {
    if (!this.userQuotas.has(userId)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      this.userQuotas.set(userId, {
        userId,
        dailyCount: 0,
        lastResetDate: today,
        totalGenerated: 0,
        sessionUsage: new Map()
      });
    }
    
    return this.userQuotas.get(userId)!;
  }

  /**
   * Get remaining daily quota for user
   */
  getRemainingQuota(userId: string): number {
    const quota = this.getUserQuota(userId);
    
    // Reset if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (quota.lastResetDate < today) {
      quota.dailyCount = 0;
      quota.lastResetDate = today;
      quota.sessionUsage.clear();
    }
    
    return Math.max(0, this.config.dailyLimit - quota.dailyCount);
  }

  /**
   * Get next allowed generation time for user
   */
  getNextAllowedTime(userId: string): Date | null {
    const quota = this.getUserQuota(userId);
    
    if (!quota.lastGeneratedAt) {
      return null;
    }
    
    const timeSinceLastGeneration = Date.now() - quota.lastGeneratedAt.getTime();
    
    if (timeSinceLastGeneration >= this.config.cooldownPeriod) {
      return null;
    }
    
    return new Date(quota.lastGeneratedAt.getTime() + this.config.cooldownPeriod);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ImageGenerationConfig>): void {
    this.config = { ...this.config, ...config };
    
    logger.info('Image generation config updated', {
      metadata: { config: this.config }
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): ImageGenerationConfig {
    return { ...this.config };
  }

  /**
   * Reset user quota (admin function)
   */
  resetUserQuota(userId: string): void {
    this.userQuotas.delete(userId);
    
    logger.info('User image generation quota reset', {
      metadata: { userId }
    });
  }
}