/**
 * @fileoverview JWT Token Manager for authentication
 * @description Handles token generation, validation, and blacklisting with RS256 algorithm
 * @author Web-Buddy Team
 */

import jwt, { SignOptions, VerifyOptions, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

export interface TokenPayload {
  userId: string;
  extensionId?: string;
  email?: string;
  roles?: string[];
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
}

export interface DecodedToken extends JwtPayload, TokenPayload {
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Token Manager - Handles JWT token operations with RS256 algorithm
 * Implements secure token generation, validation, refresh, and blacklisting
 */
export class TokenManager {
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private readonly ALGORITHM = 'RS256';
  
  private privateKey: string;
  private publicKey: string;
  private blacklistedTokens: Set<string> = new Set();
  private refreshTokenStore: Map<string, RefreshTokenData> = new Map();
  
  // In production, these should be stored in Redis
  private tokenBlacklistTTL = 15 * 60 * 1000; // 15 minutes (same as access token expiry)
  private refreshTokenTTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly issuer: string = 'semantest-auth',
    private readonly audience: string = 'semantest-api'
  ) {
    this.initializeKeys();
  }

  /**
   * Initialize RSA keys for JWT signing and verification
   */
  private initializeKeys(): void {
    const keysDir = path.join(process.cwd(), 'keys');
    const privateKeyPath = path.join(keysDir, 'private.key');
    const publicKeyPath = path.join(keysDir, 'public.key');

    // Check if keys exist
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      console.log('✅ RSA keys loaded successfully');
    } else {
      // Generate new keys in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 Generating new RSA keys...');
        this.generateAndSaveKeys(keysDir, privateKeyPath, publicKeyPath);
      } else {
        throw new Error('RSA keys not found in production. Please provide keys.');
      }
    }
  }

  /**
   * Generate and save RSA key pair
   */
  private generateAndSaveKeys(keysDir: string, privateKeyPath: string, publicKeyPath: string): void {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    // Save keys
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    
    console.log('✅ RSA keys generated and saved');
  }

  /**
   * Generate access and refresh token pair
   */
  public async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const jtiAccess = this.generateJTI();
    const jtiRefresh = this.generateJTI();
    const now = new Date();

    // Generate access token
    const accessTokenOptions: SignOptions = {
      algorithm: this.ALGORITHM,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: this.issuer,
      audience: this.audience,
      jwtid: jtiAccess,
      subject: payload.userId
    };

    const accessToken = jwt.sign(
      {
        ...payload,
        type: 'access'
      },
      this.privateKey,
      accessTokenOptions
    );

    // Generate refresh token
    const refreshTokenOptions: SignOptions = {
      algorithm: this.ALGORITHM,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: this.issuer,
      audience: this.audience,
      jwtid: jtiRefresh,
      subject: payload.userId
    };

    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        sessionId: payload.sessionId,
        type: 'refresh'
      },
      this.privateKey,
      refreshTokenOptions
    );

    // Store refresh token data
    this.storeRefreshToken(jtiRefresh, {
      userId: payload.userId,
      sessionId: payload.sessionId,
      createdAt: now,
      lastUsed: now,
      accessTokenJTI: jtiAccess
    });

    // Calculate expiry times
    const accessTokenExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    const refreshTokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry
    };
  }

  /**
   * Verify and decode access token
   */
  public async verifyAccessToken(token: string): Promise<DecodedToken> {
    try {
      const verifyOptions: VerifyOptions = {
        algorithms: [this.ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
        complete: false
      };

      const decoded = jwt.verify(token, this.publicKey, verifyOptions) as DecodedToken;

      // Check if token is blacklisted
      if (decoded.jti && this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify and decode refresh token
   */
  public async verifyRefreshToken(token: string): Promise<DecodedToken> {
    try {
      const verifyOptions: VerifyOptions = {
        algorithms: [this.ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
        complete: false
      };

      const decoded = jwt.verify(token, this.publicKey, verifyOptions) as DecodedToken;

      // Check if token is blacklisted
      if (decoded.jti && this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Refresh token has been revoked');
      }

      // Verify token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in store
      if (!decoded.jti || !this.refreshTokenStore.has(decoded.jti)) {
        throw new Error('Refresh token not found');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken: string, payload: TokenPayload): Promise<TokenPair> {
    // Verify refresh token
    const decodedRefresh = await this.verifyRefreshToken(refreshToken);
    
    if (!decodedRefresh.jti) {
      throw new Error('Invalid refresh token: missing JTI');
    }

    // Get stored refresh token data
    const storedData = this.refreshTokenStore.get(decodedRefresh.jti);
    if (!storedData) {
      throw new Error('Refresh token not found in store');
    }

    // Blacklist old access token
    if (storedData.accessTokenJTI) {
      this.blacklistToken(storedData.accessTokenJTI);
    }

    // Generate new token pair with rotation
    const newTokenPair = await this.generateTokenPair(payload);

    // Blacklist old refresh token (rotation)
    this.blacklistToken(decodedRefresh.jti);
    this.refreshTokenStore.delete(decodedRefresh.jti);

    // Update last used timestamp
    storedData.lastUsed = new Date();

    return newTokenPair;
  }

  /**
   * Blacklist a token by JTI
   */
  public blacklistToken(jti: string): void {
    this.blacklistedTokens.add(jti);
    
    // Schedule removal after token expiry
    setTimeout(() => {
      this.blacklistedTokens.delete(jti);
    }, this.tokenBlacklistTTL);

    console.log(`🚫 Token blacklisted: ${jti}`);
  }

  /**
   * Revoke all tokens for a user
   */
  public revokeAllUserTokens(userId: string): void {
    // Find and blacklist all refresh tokens for the user
    for (const [jti, data] of this.refreshTokenStore.entries()) {
      if (data.userId === userId) {
        this.blacklistToken(jti);
        if (data.accessTokenJTI) {
          this.blacklistToken(data.accessTokenJTI);
        }
        this.refreshTokenStore.delete(jti);
      }
    }
    
    console.log(`🚫 All tokens revoked for user: ${userId}`);
  }

  /**
   * Revoke all tokens for a session
   */
  public revokeSessionTokens(sessionId: string): void {
    // Find and blacklist all tokens for the session
    for (const [jti, data] of this.refreshTokenStore.entries()) {
      if (data.sessionId === sessionId) {
        this.blacklistToken(jti);
        if (data.accessTokenJTI) {
          this.blacklistToken(data.accessTokenJTI);
        }
        this.refreshTokenStore.delete(jti);
      }
    }
    
    console.log(`🚫 All tokens revoked for session: ${sessionId}`);
  }

  /**
   * Check if token is blacklisted
   */
  private isTokenBlacklisted(jti: string): boolean {
    return this.blacklistedTokens.has(jti);
  }

  /**
   * Store refresh token data
   */
  private storeRefreshToken(jti: string, data: RefreshTokenData): void {
    this.refreshTokenStore.set(jti, data);
    
    // Schedule removal after expiry
    setTimeout(() => {
      this.refreshTokenStore.delete(jti);
    }, this.refreshTokenTTL);
  }

  /**
   * Generate unique JWT ID
   */
  private generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get token statistics
   */
  public getTokenStats(): TokenStats {
    return {
      blacklistedTokens: this.blacklistedTokens.size,
      activeRefreshTokens: this.refreshTokenStore.size,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: this.ALGORITHM
    };
  }

  /**
   * Clean up expired tokens (maintenance task)
   */
  public cleanupExpiredTokens(): void {
    const now = new Date().getTime();
    let cleaned = 0;

    // Clean expired refresh tokens
    for (const [jti, data] of this.refreshTokenStore.entries()) {
      const age = now - data.createdAt.getTime();
      if (age > this.refreshTokenTTL) {
        this.refreshTokenStore.delete(jti);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired tokens`);
    }
  }

  /**
   * Extract token from Authorization header
   */
  public static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

// Supporting interfaces

interface RefreshTokenData {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastUsed: Date;
  accessTokenJTI?: string;
}

interface TokenStats {
  blacklistedTokens: number;
  activeRefreshTokens: number;
  issuer: string;
  audience: string;
  algorithm: string;
}

// Export singleton instance
export const tokenManager = new TokenManager();