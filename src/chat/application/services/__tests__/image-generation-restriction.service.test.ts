/**
 * @fileoverview Tests for image generation restriction service
 * @description Unit tests for image generation restrictions and quota management
 * @issue #24 - Chat image generation restrictions
 * @author Alex - Semantest Team
 */

import { ImageGenerationRestrictionService } from '../image-generation-restriction.service';
import {
  ImageGenerationRequest,
  ImageGenerationError,
  ImageGenerationErrorCode,
  ImageGenerationConfig
} from '../../../domain/image-generation.types';

describe('ImageGenerationRestrictionService', () => {
  let service: ImageGenerationRestrictionService;
  const mockUserId = 'test-user-123';
  const mockSessionId = 'test-session-456';

  beforeEach(() => {
    // Create service with test configuration
    service = new ImageGenerationRestrictionService({
      enabled: true,
      dailyLimit: 10,
      sessionLimit: 3,
      cooldownPeriod: 1000, // 1 second for testing
      allowedSizes: ['256x256', '512x512'],
      maxPromptLength: 100,
      blockedTerms: ['blocked', 'forbidden'],
      contentFilterLevel: 'moderate'
    });
  });

  describe('validateRequest', () => {
    const validRequest: ImageGenerationRequest = {
      sessionId: mockSessionId,
      userId: mockUserId,
      prompt: 'A beautiful sunset'
    };

    it('should validate a valid request', async () => {
      await expect(service.validateRequest(validRequest)).resolves.not.toThrow();
    });

    it('should throw error when image generation is disabled', async () => {
      service.updateConfig({ enabled: false });
      
      await expect(service.validateRequest(validRequest))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(validRequest);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.DISABLED);
      }
    });

    it('should throw error for prompt exceeding max length', async () => {
      const longPrompt = 'a'.repeat(101);
      const request = { ...validRequest, prompt: longPrompt };
      
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.PROMPT_TOO_LONG);
      }
    });

    it('should throw error for invalid image size', async () => {
      const request = { ...validRequest, size: '2048x2048' as any };
      
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.INVALID_SIZE);
      }
    });

    it('should throw error for blocked content', async () => {
      const request = { ...validRequest, prompt: 'This contains blocked content' };
      
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.BLOCKED_CONTENT);
      }
    });
  });

  describe('quota management', () => {
    const request: ImageGenerationRequest = {
      sessionId: mockSessionId,
      userId: mockUserId,
      prompt: 'A test prompt'
    };

    it('should track daily quota correctly', async () => {
      // Generate images up to daily limit
      for (let i = 0; i < 10; i++) {
        await service.validateRequest(request);
        await service.recordGeneration(mockUserId, mockSessionId);
      }
      
      // Next request should fail
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.DAILY_LIMIT_EXCEEDED);
      }
    });

    it('should track session quota correctly', async () => {
      // Generate images up to session limit
      for (let i = 0; i < 3; i++) {
        await service.validateRequest(request);
        await service.recordGeneration(mockUserId, mockSessionId);
      }
      
      // Next request for same session should fail
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.SESSION_LIMIT_EXCEEDED);
      }
      
      // Request for different session should work
      const newSessionRequest = { ...request, sessionId: 'new-session' };
      await expect(service.validateRequest(newSessionRequest)).resolves.not.toThrow();
    });

    it('should enforce cooldown period', async () => {
      // First request should succeed
      await service.validateRequest(request);
      await service.recordGeneration(mockUserId, mockSessionId);
      
      // Immediate second request should fail
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.COOLDOWN_ACTIVE);
      }
      
      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Request should now succeed
      await expect(service.validateRequest(request)).resolves.not.toThrow();
    });

    it('should reset daily quota at day boundary', async () => {
      // Use up quota
      for (let i = 0; i < 10; i++) {
        await service.validateRequest(request);
        await service.recordGeneration(mockUserId, mockSessionId);
      }
      
      // Manually update last reset date to yesterday
      const quota = service.getUserQuota(mockUserId);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      quota.lastResetDate = yesterday;
      
      // Should now be able to generate again
      await expect(service.validateRequest(request)).resolves.not.toThrow();
    });
  });

  describe('content filtering', () => {
    it('should apply strict content filtering', async () => {
      service.updateConfig({ contentFilterLevel: 'strict' });
      
      const request: ImageGenerationRequest = {
        sessionId: mockSessionId,
        userId: mockUserId,
        prompt: 'A scene with violence'
      };
      
      await expect(service.validateRequest(request))
        .rejects.toThrow(ImageGenerationError);
      
      try {
        await service.validateRequest(request);
      } catch (error) {
        expect((error as ImageGenerationError).code).toBe(ImageGenerationErrorCode.CONTENT_FILTER_FAILED);
      }
    });

    it('should apply moderate content filtering', async () => {
      service.updateConfig({ contentFilterLevel: 'moderate' });
      
      const mildRequest: ImageGenerationRequest = {
        sessionId: mockSessionId,
        userId: mockUserId,
        prompt: 'A scene with violence' // Should pass moderate filter
      };
      
      await expect(service.validateRequest(mildRequest)).resolves.not.toThrow();
      
      const extremeRequest: ImageGenerationRequest = {
        sessionId: mockSessionId,
        userId: mockUserId,
        prompt: 'extreme violence scene' // Should fail moderate filter
      };
      
      await expect(service.validateRequest(extremeRequest))
        .rejects.toThrow(ImageGenerationError);
    });
  });

  describe('utility functions', () => {
    it('should calculate remaining quota correctly', () => {
      const userId = 'quota-test-user';
      
      // Initially should have full quota
      expect(service.getRemainingQuota(userId)).toBe(10);
      
      // After recording some generations
      service.recordGeneration(userId, 'session1', 3);
      expect(service.getRemainingQuota(userId)).toBe(7);
      
      // After using all quota
      service.recordGeneration(userId, 'session2', 7);
      expect(service.getRemainingQuota(userId)).toBe(0);
    });

    it('should calculate next allowed time correctly', () => {
      const userId = 'time-test-user';
      
      // Initially should return null
      expect(service.getNextAllowedTime(userId)).toBeNull();
      
      // After recording generation
      service.recordGeneration(userId, 'session1');
      const nextTime = service.getNextAllowedTime(userId);
      
      expect(nextTime).not.toBeNull();
      expect(nextTime!.getTime()).toBeGreaterThan(Date.now());
      expect(nextTime!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('should reset user quota', () => {
      const userId = 'reset-test-user';
      
      // Generate some usage
      service.recordGeneration(userId, 'session1', 5);
      expect(service.getRemainingQuota(userId)).toBe(5);
      
      // Reset quota
      service.resetUserQuota(userId);
      
      // Should have full quota again
      expect(service.getRemainingQuota(userId)).toBe(10);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<ImageGenerationConfig> = {
        dailyLimit: 20,
        sessionLimit: 5,
        contentFilterLevel: 'strict'
      };
      
      service.updateConfig(newConfig);
      const config = service.getConfig();
      
      expect(config.dailyLimit).toBe(20);
      expect(config.sessionLimit).toBe(5);
      expect(config.contentFilterLevel).toBe('strict');
      // Other config should remain unchanged
      expect(config.enabled).toBe(true);
      expect(config.cooldownPeriod).toBe(1000);
    });

    it('should return copy of configuration', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});