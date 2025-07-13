/**
 * @fileoverview CSRF Protection Service
 * @description Implements double-submit cookie pattern for CSRF protection
 * @author Web-Buddy Team
 */

import crypto from 'crypto';
import { Request, Response } from 'express';

export interface CSRFTokenData {
  token: string;
  createdAt: Date;
  sessionId?: string;
  userId?: string;
}

export interface CSRFConfig {
  cookieName: string;
  headerName: string;
  tokenLength: number;
  tokenExpiry: number; // in milliseconds
  secureCookie: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  httpOnly: boolean;
}

/**
 * CSRF Service implementing double-submit cookie pattern
 * Provides stateless CSRF protection with cryptographically secure tokens
 */
export class CSRFService {
  private readonly config: CSRFConfig;
  private readonly tokenStore: Map<string, CSRFTokenData> = new Map();
  private readonly secret: string;

  constructor(config?: Partial<CSRFConfig>) {
    this.config = {
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
      tokenLength: 32,
      tokenExpiry: 3600000, // 1 hour
      secureCookie: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: false, // Must be false for JavaScript access
      ...config
    };

    // Generate a secret for token signing (in production, this should be from environment)
    this.secret = process.env.CSRF_SECRET || crypto.randomBytes(64).toString('hex');
    
    // Cleanup expired tokens every 5 minutes
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);

    console.log('🛡️ CSRF Service initialized with double-submit cookie pattern');
  }

  /**
   * Generate a new CSRF token with associated data
   */
  public generateToken(sessionId?: string, userId?: string): CSRFTokenData {
    const token = this.createSecureToken();
    const tokenData: CSRFTokenData = {
      token,
      createdAt: new Date(),
      sessionId,
      userId
    };

    // Store token data for validation
    this.tokenStore.set(token, tokenData);

    // Schedule token cleanup
    setTimeout(() => {
      this.tokenStore.delete(token);
    }, this.config.tokenExpiry);

    return tokenData;
  }

  /**
   * Validate CSRF token using double-submit cookie pattern
   */
  public validateToken(
    headerToken: string | undefined,
    cookieToken: string | undefined,
    sessionId?: string,
    userId?: string
  ): boolean {
    try {
      // Both tokens must be present
      if (!headerToken || !cookieToken) {
        return false;
      }

      // Tokens must match (double-submit validation)
      if (headerToken !== cookieToken) {
        return false;
      }

      // Check if token exists in store
      const tokenData = this.tokenStore.get(headerToken);
      if (!tokenData) {
        return false;
      }

      // Check token expiry
      const now = new Date();
      const tokenAge = now.getTime() - tokenData.createdAt.getTime();
      if (tokenAge > this.config.tokenExpiry) {
        this.tokenStore.delete(headerToken);
        return false;
      }

      // Validate session binding if provided
      if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
        return false;
      }

      // Validate user binding if provided
      if (userId && tokenData.userId && tokenData.userId !== userId) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('CSRF token validation error:', error);
      return false;
    }
  }

  /**
   * Set CSRF token as cookie in response
   */
  public setCookie(res: Response, token: string): void {
    res.cookie(this.config.cookieName, token, {
      httpOnly: this.config.httpOnly,
      secure: this.config.secureCookie,
      sameSite: this.config.sameSite,
      maxAge: this.config.tokenExpiry,
      path: '/'
    });
  }

  /**
   * Get CSRF token from request header
   */
  public getTokenFromHeader(req: Request): string | undefined {
    return req.headers[this.config.headerName.toLowerCase()] as string;
  }

  /**
   * Get CSRF token from request cookie
   */
  public getTokenFromCookie(req: Request): string | undefined {
    return req.cookies?.[this.config.cookieName];
  }

  /**
   * Clear CSRF token cookie
   */
  public clearCookie(res: Response): void {
    res.clearCookie(this.config.cookieName, {
      path: '/',
      secure: this.config.secureCookie,
      sameSite: this.config.sameSite
    });
  }

  /**
   * Generate token and set cookie for new requests
   */
  public generateAndSetToken(
    req: Request,
    res: Response,
    sessionId?: string,
    userId?: string
  ): string {
    // Check if valid token already exists
    const existingToken = this.getTokenFromCookie(req);
    if (existingToken && this.validateToken(existingToken, existingToken, sessionId, userId)) {
      return existingToken;
    }

    // Generate new token
    const tokenData = this.generateToken(sessionId, userId);
    this.setCookie(res, tokenData.token);
    
    return tokenData.token;
  }

  /**
   * Check if request is from Chrome extension (should be exempt from CSRF)
   */
  public isExtensionRequest(req: Request): boolean {
    // Check for extension-specific headers
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];
    const extensionHeader = req.headers['x-extension-id'];

    // Chrome extension requests have specific patterns
    if (origin && origin.startsWith('chrome-extension://')) {
      return true;
    }

    // Check for custom extension header
    if (extensionHeader) {
      return true;
    }

    // Additional extension detection logic can be added here
    return false;
  }

  /**
   * Validate that the request originates from an allowed extension
   */
  public validateExtensionOrigin(req: Request, allowedExtensionIds?: string[]): boolean {
    const origin = req.headers.origin;
    const extensionId = req.headers['x-extension-id'] as string;

    // If no specific extension IDs are configured, allow any chrome extension
    if (!allowedExtensionIds || allowedExtensionIds.length === 0) {
      return this.isExtensionRequest(req);
    }

    // Validate against allowed extension IDs
    if (extensionId && allowedExtensionIds.includes(extensionId)) {
      return true;
    }

    // Extract extension ID from origin and validate
    if (origin && origin.startsWith('chrome-extension://')) {
      const originExtensionId = origin.replace('chrome-extension://', '').split('/')[0];
      return allowedExtensionIds.includes(originExtensionId);
    }

    return false;
  }

  /**
   * Rotate CSRF token for enhanced security
   */
  public rotateToken(
    req: Request,
    res: Response,
    sessionId?: string,
    userId?: string
  ): string {
    // Clear existing token
    const existingToken = this.getTokenFromCookie(req);
    if (existingToken) {
      this.tokenStore.delete(existingToken);
      this.clearCookie(res);
    }

    // Generate new token
    return this.generateAndSetToken(req, res, sessionId, userId);
  }

  /**
   * Get token statistics for monitoring
   */
  public getTokenStats(): CSRFTokenStats {
    const now = new Date();
    let activeTokens = 0;
    let expiredTokens = 0;

    for (const tokenData of this.tokenStore.values()) {
      const age = now.getTime() - tokenData.createdAt.getTime();
      if (age > this.config.tokenExpiry) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      totalTokens: this.tokenStore.size,
      activeTokens,
      expiredTokens,
      config: {
        cookieName: this.config.cookieName,
        headerName: this.config.headerName,
        tokenExpiry: this.config.tokenExpiry,
        secureCookie: this.config.secureCookie
      }
    };
  }

  /**
   * Invalidate all tokens for a specific user
   */
  public invalidateUserTokens(userId: string): number {
    let invalidated = 0;
    for (const [token, tokenData] of this.tokenStore.entries()) {
      if (tokenData.userId === userId) {
        this.tokenStore.delete(token);
        invalidated++;
      }
    }
    console.log(`🚫 Invalidated ${invalidated} CSRF tokens for user: ${userId}`);
    return invalidated;
  }

  /**
   * Invalidate all tokens for a specific session
   */
  public invalidateSessionTokens(sessionId: string): number {
    let invalidated = 0;
    for (const [token, tokenData] of this.tokenStore.entries()) {
      if (tokenData.sessionId === sessionId) {
        this.tokenStore.delete(token);
        invalidated++;
      }
    }
    console.log(`🚫 Invalidated ${invalidated} CSRF tokens for session: ${sessionId}`);
    return invalidated;
  }

  /**
   * Create a cryptographically secure token
   */
  private createSecureToken(): string {
    const randomBytes = crypto.randomBytes(this.config.tokenLength);
    const timestamp = Date.now().toString();
    
    // Create HMAC signature for additional security
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(randomBytes);
    hmac.update(timestamp);
    
    const signature = hmac.digest('hex').substring(0, 16);
    return `${randomBytes.toString('hex')}.${timestamp}.${signature}`;
  }

  /**
   * Cleanup expired tokens from memory
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [token, tokenData] of this.tokenStore.entries()) {
      const age = now.getTime() - tokenData.createdAt.getTime();
      if (age > this.config.tokenExpiry) {
        this.tokenStore.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired CSRF tokens`);
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): CSRFConfig {
    return { ...this.config };
  }
}

// Supporting interfaces

export interface CSRFTokenStats {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  config: {
    cookieName: string;
    headerName: string;
    tokenExpiry: number;
    secureCookie: boolean;
  };
}

// Export singleton instance
export const csrfService = new CSRFService();