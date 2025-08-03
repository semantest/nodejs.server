/**
 * @fileoverview URL Detection Service for DALL-E Image URLs
 * @description Detects and validates DALL-E 2/3 image URLs with expiration handling
 * @issue #22 - DALL-E 3 URL Detection
 * @author Sam & Claude - Semantest Team
 * @version 1.0.0
 */

import { logger } from '../../../monitoring/infrastructure/structured-logger';

export interface UrlValidationResult {
  valid: boolean;
  provider: 'dalle-2' | 'dalle-3' | null;
  expiresAt?: Date;
  metadata?: {
    jobId?: string;
    timestamp?: string;
    signature?: string;
  };
}

export interface DetectedUrl {
  originalUrl: string;
  provider: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Service for detecting and validating DALL-E image URLs
 */
export class UrlDetectionService {
  private readonly dalleUrlPatterns = [
    // DALL-E 3 Azure Blob Storage pattern
    {
      pattern: /^https:\/\/oaidalleapiprodscus\.blob\.core\.windows\.net\/[^?]+/,
      provider: 'dalle-3' as const,
      type: 'azure'
    },
    // DALL-E 3 S3 pattern
    {
      pattern: /^https:\/\/openai-labs-public-images-prod\.s3\.amazonaws\.com\/[^?]+/,
      provider: 'dalle-3' as const,
      type: 's3'
    },
    // Legacy DALL-E 2 pattern
    {
      pattern: /^https:\/\/images\.openai\.com\/[^?]+/,
      provider: 'dalle-2' as const,
      type: 'legacy'
    }
  ];

  /**
   * Check if a URL is from DALL-E
   */
  isDalleUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    return this.dalleUrlPatterns.some(({ pattern }) => pattern.test(url));
  }

  /**
   * Validate DALL-E URL and extract metadata
   */
  validateDalleUrl(url: string): UrlValidationResult {
    if (!url || typeof url !== 'string') {
      return { valid: false, provider: null };
    }

    // Find matching pattern
    const match = this.dalleUrlPatterns.find(({ pattern }) => pattern.test(url));
    
    if (!match) {
      return { valid: false, provider: null };
    }

    try {
      const urlObj = new URL(url);
      const metadata = this.parseDalleUrlMetadata(url);
      const expiresAt = this.extractExpirationFromUrl(url, match.type);

      logger.info('DALL-E URL validated', {
        provider: match.provider,
        type: match.type,
        hasExpiration: !!expiresAt,
        metadata
      });

      return {
        valid: true,
        provider: match.provider,
        expiresAt,
        metadata
      };
    } catch (error) {
      logger.error('Failed to parse DALL-E URL', { url, error: error.message });
      return { valid: false, provider: null };
    }
  }

  /**
   * Extract expiration timestamp from URL
   */
  private extractExpirationFromUrl(url: string, type: string): Date | undefined {
    try {
      const urlObj = new URL(url);
      
      switch (type) {
        case 'azure':
          // Azure uses 'se' (Signature Expiry) parameter
          const se = urlObj.searchParams.get('se');
          if (se) {
            const expiry = new Date(se);
            if (!isNaN(expiry.getTime())) {
              return expiry;
            }
          }
          break;
          
        case 's3':
          // S3 uses 'Expires' parameter (Unix timestamp)
          const expires = urlObj.searchParams.get('Expires');
          if (expires) {
            const timestamp = parseInt(expires, 10);
            if (!isNaN(timestamp)) {
              return new Date(timestamp * 1000);
            }
          }
          // Also check X-Amz-Expires for newer S3 URLs
          const amzExpires = urlObj.searchParams.get('X-Amz-Expires');
          if (amzExpires) {
            const seconds = parseInt(amzExpires, 10);
            if (!isNaN(seconds)) {
              return new Date(Date.now() + seconds * 1000);
            }
          }
          break;
          
        case 'legacy':
          // DALL-E 2 URLs typically expire after 1 hour
          return new Date(Date.now() + 3600000);
      }

      // Default expiration: 1 hour
      return new Date(Date.now() + 3600000);
    } catch (error) {
      logger.warn('Failed to extract expiration from URL', { url, error: error.message });
      return new Date(Date.now() + 3600000); // Default 1 hour
    }
  }

  /**
   * Parse metadata from DALL-E URL
   */
  parseDalleUrlMetadata(url: string): Record<string, any> {
    try {
      const urlObj = new URL(url);
      const metadata: Record<string, any> = {};

      // Extract job ID from path
      const pathParts = urlObj.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      if (filename) {
        // Remove file extension
        const jobId = filename.replace(/\.[^/.]+$/, '');
        if (jobId) {
          metadata.jobId = jobId;
        }
      }

      // Azure-specific parameters
      const st = urlObj.searchParams.get('st'); // Start time
      const se = urlObj.searchParams.get('se'); // End time
      const sig = urlObj.searchParams.get('sig'); // Signature
      const sv = urlObj.searchParams.get('sv'); // Service version
      
      if (st) metadata.startTime = st;
      if (se) metadata.endTime = se;
      if (sig) metadata.signature = sig;
      if (sv) metadata.serviceVersion = sv;

      // S3-specific parameters
      const algorithm = urlObj.searchParams.get('X-Amz-Algorithm');
      const credential = urlObj.searchParams.get('X-Amz-Credential');
      const date = urlObj.searchParams.get('X-Amz-Date');
      const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders');
      
      if (algorithm) metadata.algorithm = algorithm;
      if (credential) metadata.credential = credential;
      if (date) metadata.date = date;
      if (signedHeaders) metadata.signedHeaders = signedHeaders;

      return metadata;
    } catch (error) {
      logger.warn('Failed to parse URL metadata', { url, error: error.message });
      return {};
    }
  }

  /**
   * Batch validate multiple URLs
   */
  async validateBatch(urls: string[]): Promise<UrlValidationResult[]> {
    return urls.map(url => this.validateDalleUrl(url));
  }

  /**
   * Detect DALL-E URLs in text content
   */
  detectUrlsInContent(content: string): DetectedUrl[] {
    if (!content || typeof content !== 'string') {
      return [];
    }

    // Enhanced URL regex to catch various URL formats
    const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
    const urls = content.match(urlRegex) || [];
    
    const detectedUrls: DetectedUrl[] = [];
    const processedUrls = new Set<string>();

    for (const url of urls) {
      // Skip duplicates
      if (processedUrls.has(url)) continue;
      processedUrls.add(url);

      const validation = this.validateDalleUrl(url);
      if (validation.valid && validation.provider) {
        detectedUrls.push({
          originalUrl: url,
          provider: validation.provider,
          expiresAt: validation.expiresAt,
          metadata: validation.metadata
        });
      }
    }

    logger.info('URL detection completed', {
      totalUrls: urls.length,
      dalleUrls: detectedUrls.length
    });

    return detectedUrls;
  }

  /**
   * Check if URL is expired or will expire soon
   */
  isUrlExpiring(url: string, thresholdMinutes: number = 5): boolean {
    const validation = this.validateDalleUrl(url);
    
    if (!validation.valid || !validation.expiresAt) {
      return true; // Consider invalid URLs as expired
    }

    const now = new Date();
    const expiresAt = validation.expiresAt;
    const thresholdMs = thresholdMinutes * 60 * 1000;

    return (expiresAt.getTime() - now.getTime()) < thresholdMs;
  }
}