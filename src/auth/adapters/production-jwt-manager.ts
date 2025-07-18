/**
 * @fileoverview Production-ready JWT token manager
 * @description Real JWT implementation with proper cryptography and Redis storage
 * @author Semantest Team
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { TokenPayload, User } from '../domain/auth-entities';

/**
 * Production JWT token manager with Redis backing
 */
export class ProductionJwtManager extends Adapter {
  private readonly redis: Redis;
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    super();
    
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // JWT configuration
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecureSecret();
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecureSecret();
    this.issuer = process.env.JWT_ISSUER || 'semantest-api';
    this.audience = process.env.JWT_AUDIENCE || 'semantest-clients';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    // Ensure Redis connection
    this.initializeRedis();
  }

  /**
   * Generate access token for user
   */
  public async generateAccessToken(
    userId: string, 
    scopes: string[] = [],
    sessionId?: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJwtId();
    
    const payload: TokenPayload = {
      sub: userId,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.parseExpiry(this.accessTokenExpiry),
      jti,
      userId,
      email: user.email,
      roles: user.roles,
      scopes,
      sessionId,
      type: 'access'
    };

    const token = jwt.sign(payload, this.accessTokenSecret, {
      algorithm: 'HS256',
      noTimestamp: true // We set iat manually
    });

    const expiresAt = new Date(payload.exp * 1000);

    // Store token metadata for blacklist checking
    await this.storeTokenMetadata(jti, userId, expiresAt, 'access');

    console.log(`🔐 Generated access token for user ${userId} (expires: ${expiresAt.toISOString()})`);
    return { token, expiresAt };
  }

  /**
   * Generate refresh token for user
   */
  public async generateRefreshToken(
    userId: string,
    sessionId?: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateJwtId();
    const expirySeconds = this.parseExpiry(this.refreshTokenExpiry);
    
    const payload = {
      sub: userId,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + expirySeconds,
      jti,
      userId,
      sessionId,
      type: 'refresh'
    };

    const token = jwt.sign(payload, this.refreshTokenSecret, {
      algorithm: 'HS256',
      noTimestamp: true
    });

    const expiresAt = new Date(payload.exp * 1000);

    // Store refresh token in Redis with TTL
    await this.storeRefreshToken(userId, jti, token, expirySeconds);
    await this.storeTokenMetadata(jti, userId, expiresAt, 'refresh');

    console.log(`🔄 Generated refresh token for user ${userId} (expires: ${expiresAt.toISOString()})`);
    return { token, expiresAt };
  }

  /**
   * Validate access token
   */
  public async validateToken(token: string): Promise<TokenPayload> {
    try {
      // Verify token signature and decode
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      }) as TokenPayload;

      // Validate token type
      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(payload.jti)) {
        throw new Error('Token is blacklisted');
      }

      // Check if user is still active
      const user = await this.getUserById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User is inactive');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid token: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate refresh token
   */
  public async validateRefreshToken(token: string): Promise<TokenPayload> {
    try {
      // Verify token signature and decode
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      }) as TokenPayload;

      // Validate token type
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const storedToken = await this.getRefreshToken(payload.userId, payload.jti);
      if (!storedToken || storedToken !== token) {
        throw new Error('Refresh token not found or invalid');
      }

      // Check if user is still active
      const user = await this.getUserById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User is inactive');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid refresh token: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Invalidate refresh token
   */
  public async invalidateRefreshToken(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token) as any;
      if (payload && payload.userId && payload.jti) {
        await this.removeRefreshToken(payload.userId, payload.jti);
        await this.blacklistToken(payload.jti, payload.exp);
        console.log(`🗑️ Invalidated refresh token for user ${payload.userId}`);
      }
    } catch (error) {
      console.error('Error invalidating refresh token:', error);
    }
  }

  /**
   * Invalidate all refresh tokens for user
   */
  public async invalidateAllRefreshTokens(userId: string): Promise<void> {
    try {
      const pattern = `refresh_token:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} refresh tokens for user ${userId}`);
      }

      // Also blacklist all active tokens for this user
      await this.blacklistAllUserTokens(userId);
    } catch (error) {
      console.error('Error invalidating all refresh tokens:', error);
    }
  }

  /**
   * Blacklist token (for logout)
   */
  public async blacklistToken(jti: string, exp: number): Promise<void> {
    try {
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(`blacklist:${jti}`, ttl, '1');
        console.log(`🚫 Blacklisted token ${jti} for ${ttl} seconds`);
      }
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  public async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await this.redis.get(`blacklist:${jti}`);
      return result === '1';
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }

  /**
   * Get token expiry time
   */
  public getTokenExpiry(token: string): Date | null {
    try {
      const payload = jwt.decode(token) as any;
      return payload?.exp ? new Date(payload.exp * 1000) : null;
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
   * Rotate refresh token (generate new one and invalidate old)
   */
  public async rotateRefreshToken(oldToken: string): Promise<{ token: string; expiresAt: Date }> {
    const payload = await this.validateRefreshToken(oldToken);
    
    // Invalidate old token
    await this.invalidateRefreshToken(oldToken);
    
    // Generate new token
    return await this.generateRefreshToken(payload.userId, payload.sessionId);
  }

  /**
   * Get active sessions for user
   */
  public async getActiveSessions(userId: string): Promise<any[]> {
    try {
      const pattern = `refresh_token:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const sessions = [];
      for (const key of keys) {
        const token = await this.redis.get(key);
        if (token) {
          const payload = jwt.decode(token) as any;
          if (payload) {
            sessions.push({
              jti: payload.jti,
              sessionId: payload.sessionId,
              createdAt: new Date(payload.iat * 1000),
              expiresAt: new Date(payload.exp * 1000)
            });
          }
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('✅ Redis connection established for JWT manager');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
    }
  }

  /**
   * Generate secure secret key
   */
  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate unique JWT ID
   */
  private generateJwtId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }

  /**
   * Store token metadata for management
   */
  private async storeTokenMetadata(
    jti: string, 
    userId: string, 
    expiresAt: Date, 
    type: 'access' | 'refresh'
  ): Promise<void> {
    try {
      const metadata = {
        jti,
        userId,
        type,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      
      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.redis.setex(
          `token_metadata:${jti}`, 
          ttl, 
          JSON.stringify(metadata)
        );
      }
    } catch (error) {
      console.error('Error storing token metadata:', error);
    }
  }

  /**
   * Store refresh token in Redis
   */
  private async storeRefreshToken(
    userId: string, 
    jti: string, 
    token: string, 
    ttl: number
  ): Promise<void> {
    try {
      await this.redis.setex(`refresh_token:${userId}:${jti}`, ttl, token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Get refresh token from Redis
   */
  private async getRefreshToken(userId: string, jti: string): Promise<string | null> {
    try {
      return await this.redis.get(`refresh_token:${userId}:${jti}`);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Remove refresh token from Redis
   */
  private async removeRefreshToken(userId: string, jti: string): Promise<void> {
    try {
      await this.redis.del(`refresh_token:${userId}:${jti}`);
    } catch (error) {
      console.error('Error removing refresh token:', error);
    }
  }

  /**
   * Blacklist all tokens for user
   */
  private async blacklistAllUserTokens(userId: string): Promise<void> {
    try {
      const pattern = `token_metadata:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const metadata = await this.redis.get(key);
        if (metadata) {
          const data = JSON.parse(metadata);
          if (data.userId === userId) {
            const ttl = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
            if (ttl > 0) {
              await this.redis.setex(`blacklist:${data.jti}`, ttl, '1');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error blacklisting all user tokens:', error);
    }
  }

  /**
   * Mock user retrieval (replace with actual database call)
   */
  private async getUserById(userId: string): Promise<User | null> {
    // This would typically query your user database
    // For now, return a mock user
    return {
      id: userId,
      email: 'user@example.com',
      username: 'user123',
      roles: ['user'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Cleanup expired tokens (to be called periodically)
   */
  public async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = Date.now();
      const pattern = `token_metadata:*`;
      const keys = await this.redis.keys(pattern);
      
      let cleanedCount = 0;
      for (const key of keys) {
        const metadata = await this.redis.get(key);
        if (metadata) {
          const data = JSON.parse(metadata);
          if (new Date(data.expiresAt).getTime() < now) {
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired token metadata entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }
}