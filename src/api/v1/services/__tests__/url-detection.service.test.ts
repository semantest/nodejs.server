/**
 * @fileoverview Tests for URL Detection Service
 * @issue #22 - DALL-E 3 URL Detection
 * @author Sam & Claude - Semantest Team
 */

import { UrlDetectionService } from '../url-detection.service';

describe('UrlDetectionService', () => {
  let service: UrlDetectionService;

  beforeEach(() => {
    service = new UrlDetectionService();
  });

  describe('isDalleUrl', () => {
    it('should detect DALL-E 3 Azure blob URLs', () => {
      const url = 'https://oaidalleapiprodscus.blob.core.windows.net/images/generation-12345.png?se=2024-01-01T12:00:00Z&sig=abc123';
      expect(service.isDalleUrl(url)).toBe(true);
    });

    it('should detect DALL-E 3 S3 URLs', () => {
      const url = 'https://openai-labs-public-images-prod.s3.amazonaws.com/generation-12345.png?Expires=1704110400';
      expect(service.isDalleUrl(url)).toBe(true);
    });

    it('should detect legacy DALL-E 2 URLs', () => {
      const url = 'https://images.openai.com/generations/img-12345.png';
      expect(service.isDalleUrl(url)).toBe(true);
    });

    it('should reject non-DALL-E URLs', () => {
      expect(service.isDalleUrl('https://example.com/image.png')).toBe(false);
      expect(service.isDalleUrl('https://imgur.com/12345.png')).toBe(false);
      expect(service.isDalleUrl('https://cdn.openai.com/other.png')).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(service.isDalleUrl('')).toBe(false);
      expect(service.isDalleUrl(null as any)).toBe(false);
      expect(service.isDalleUrl(undefined as any)).toBe(false);
    });
  });

  describe('validateDalleUrl', () => {
    it('should validate and parse DALL-E 3 Azure URLs', () => {
      const url = 'https://oaidalleapiprodscus.blob.core.windows.net/private/generation-xyz123.png?st=2024-01-01T11:00:00Z&se=2024-01-01T12:00:00Z&sig=signature123&sv=2021-08-06';
      const result = service.validateDalleUrl(url);

      expect(result.valid).toBe(true);
      expect(result.provider).toBe('dalle-3');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.metadata).toMatchObject({
        jobId: 'generation-xyz123',
        startTime: '2024-01-01T11:00:00Z',
        endTime: '2024-01-01T12:00:00Z',
        signature: 'signature123',
        serviceVersion: '2021-08-06'
      });
    });

    it('should validate and parse DALL-E 3 S3 URLs', () => {
      const url = 'https://openai-labs-public-images-prod.s3.amazonaws.com/job-abc789.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240101T120000Z&Expires=1704110400';
      const result = service.validateDalleUrl(url);

      expect(result.valid).toBe(true);
      expect(result.provider).toBe('dalle-3');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.metadata?.jobId).toBe('job-abc789');
    });

    it('should handle malformed URLs gracefully', () => {
      const result = service.validateDalleUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.provider).toBeNull();
    });
  });

  describe('detectUrlsInContent', () => {
    it('should detect multiple DALL-E URLs in text', () => {
      const content = `
        Check out these images:
        1. https://oaidalleapiprodscus.blob.core.windows.net/images/img1.png?se=2024-01-01T12:00:00Z
        2. https://openai-labs-public-images-prod.s3.amazonaws.com/img2.png?Expires=1704110400
        3. https://images.openai.com/generations/img3.png
        And this is not: https://example.com/image.png
      `;

      const detected = service.detectUrlsInContent(content);
      
      expect(detected).toHaveLength(3);
      expect(detected[0].provider).toBe('dalle-3');
      expect(detected[1].provider).toBe('dalle-3');
      expect(detected[2].provider).toBe('dalle-2');
    });

    it('should handle duplicate URLs', () => {
      const url = 'https://images.openai.com/generations/same.png';
      const content = `First: ${url} and again: ${url}`;
      
      const detected = service.detectUrlsInContent(content);
      expect(detected).toHaveLength(1);
    });

    it('should handle empty or invalid content', () => {
      expect(service.detectUrlsInContent('')).toEqual([]);
      expect(service.detectUrlsInContent(null as any)).toEqual([]);
    });
  });

  describe('isUrlExpiring', () => {
    it('should detect expiring URLs', () => {
      // URL that expires in 3 minutes
      const expiresIn3Min = new Date(Date.now() + 3 * 60 * 1000);
      const url = `https://oaidalleapiprodscus.blob.core.windows.net/img.png?se=${expiresIn3Min.toISOString()}`;
      
      expect(service.isUrlExpiring(url, 5)).toBe(true); // 5 minute threshold
      expect(service.isUrlExpiring(url, 2)).toBe(false); // 2 minute threshold
    });

    it('should consider invalid URLs as expired', () => {
      expect(service.isUrlExpiring('invalid-url')).toBe(true);
      expect(service.isUrlExpiring('')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with special characters', () => {
      const url = 'https://oaidalleapiprodscus.blob.core.windows.net/images/job%20with%20spaces.png?se=2024-01-01T12:00:00Z';
      const result = service.validateDalleUrl(url);
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with multiple query parameters', () => {
      const url = 'https://openai-labs-public-images-prod.s3.amazonaws.com/image.png?Expires=1704110400&X-Amz-SignedHeaders=host&X-Amz-Signature=abc123';
      const result = service.validateDalleUrl(url);
      expect(result.valid).toBe(true);
      expect(result.metadata?.signedHeaders).toBe('host');
    });

    it('should extract job IDs with various formats', () => {
      const testCases = [
        { url: 'https://images.openai.com/generations/job-12345.png', expectedId: 'job-12345' },
        { url: 'https://images.openai.com/generations/12345.png', expectedId: '12345' },
        { url: 'https://images.openai.com/generations/job_abc_123.png', expectedId: 'job_abc_123' },
      ];

      testCases.forEach(({ url, expectedId }) => {
        const result = service.validateDalleUrl(url);
        expect(result.metadata?.jobId).toBe(expectedId);
      });
    });
  });
});