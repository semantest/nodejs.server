/**
 * @fileoverview JWT token manager for authentication
 * @description Handles JWT token generation, validation, and refresh
 * @author Web-Buddy Team
 */

import { Adapter } from '../../stubs/typescript-eda-stubs';
import { TokenPayload } from '../domain/auth-entities';

/**
 * JWT token manager for handling authentication tokens
 */
export class JwtTokenManager extends Adapter {
  private readonly secretKey: string;
  private readonly issuer: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    super();
    this.secretKey = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.issuer = process.env.JWT_ISSUER || 'web-buddy-api';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Generate access token for user
   */
  public async generateAccessToken(userId: string, scopes: string[] = []): Promise<string> {
    const payload: TokenPayload = {
      userId,
      email: await this.getUserEmail(userId),
      roles: await this.getUserRoles(userId),
      scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      iss: this.issuer,
      sub: userId,
      jti: this.generateJwtId()
    };

    // In real implementation, use a proper JWT library like jsonwebtoken
    const token = this.encodeJWT(payload);
    
    console.log(`🔐 Generated access token for user ${userId}`);
    return token;
  }

  /**
   * Generate refresh token for user
   */
  public async generateRefreshToken(userId: string): Promise<string> {
    const payload = {
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iss: this.issuer,
      sub: userId,
      jti: this.generateJwtId()
    };

    const token = this.encodeJWT(payload);
    
    // Store refresh token in database for invalidation
    await this.storeRefreshToken(userId, token);
    
    console.log(`🔄 Generated refresh token for user ${userId}`);
    return token;
  }

  /**
   * Validate access token
   */
  public async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = this.decodeJWT(token);
      
      // Check if token is expired
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      // Check if token is valid
      if (payload.iss !== this.issuer) {
        throw new Error('Invalid token issuer');
      }

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(payload.jti)) {
        throw new Error('Token is blacklisted');
      }

      return payload as TokenPayload;
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Validate refresh token
   */
  public async validateRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = this.decodeJWT(token);
      
      // Check if token is expired
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Refresh token expired');
      }

      // Check if token type is refresh
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in database
      if (!await this.refreshTokenExists(payload.userId, token)) {
        throw new Error('Refresh token not found');
      }

      return payload as TokenPayload;
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Invalidate refresh token
   */
  public async invalidateRefreshToken(token: string): Promise<void> {
    try {
      const payload = this.decodeJWT(token);
      await this.removeRefreshToken(payload.userId, token);
      console.log(`🗑️ Invalidated refresh token for user ${payload.userId}`);
    } catch (error) {
      console.error('Error invalidating refresh token:', error);
    }
  }

  /**
   * Blacklist token (for logout)
   */
  public async blacklistToken(token: string): Promise<void> {
    try {
      const payload = this.decodeJWT(token);
      await this.addToBlacklist(payload.jti, payload.exp);
      console.log(`🚫 Blacklisted token ${payload.jti}`);
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  /**
   * Get token expiry time
   */
  public getTokenExpiry(token: string): Date | null {
    try {
      const payload = this.decodeJWT(token);
      return new Date(payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is about to expire (within 5 minutes)
   */
  public isTokenExpiringSoon(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return expiry <= fiveMinutesFromNow;
  }

  /**
   * Mock JWT encoding (use proper library in production)
   */
  private encodeJWT(payload: any): string {
    // In production, use jsonwebtoken library
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.generateSignature(encodedHeader, encodedPayload);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Mock JWT decoding (use proper library in production)
   */
  private decodeJWT(token: string): any {
    // In production, use jsonwebtoken library
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [header, payload, signature] = parts;
    
    // Verify signature
    const expectedSignature = this.generateSignature(header, payload);
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  }

  /**
   * Generate JWT signature
   */
  private generateSignature(header: string, payload: string): string {
    // In production, use proper HMAC-SHA256 signing
    const data = `${header}.${payload}`;
    return Buffer.from(`${data}.${this.secretKey}`).toString('base64url').slice(0, 43);
  }

  /**
   * Generate unique JWT ID
   */
  private generateJwtId(): string {
    return `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper methods (in production, these would use Redis or database)
   */
  private async getUserEmail(userId: string): Promise<string> {
    // Mock implementation
    return 'user@example.com';
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    // Mock implementation
    return ['user'];
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    // Mock implementation - store in Redis with TTL
    console.log(`💾 Storing refresh token for user ${userId}`);
  }

  private async refreshTokenExists(userId: string, token: string): Promise<boolean> {
    // Mock implementation - check if token exists in Redis
    return true;
  }

  private async removeRefreshToken(userId: string, token: string): Promise<void> {
    // Mock implementation - remove from Redis
    console.log(`🗑️ Removing refresh token for user ${userId}`);
  }

  private async isTokenBlacklisted(jti: string): Promise<boolean> {
    // Mock implementation - check Redis blacklist
    return false;
  }

  private async addToBlacklist(jti: string, exp: number): Promise<void> {
    // Mock implementation - add to Redis blacklist with TTL
    console.log(`🚫 Adding token ${jti} to blacklist`);
  }
}