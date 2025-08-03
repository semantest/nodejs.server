/**
 * @fileoverview Production-ready JWT token manager
 * @description Real JWT implementation with proper cryptography and Redis storage
 * @author Semantest Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { TokenPayload } from '../domain/auth-entities';
/**
 * Production JWT token manager with Redis backing
 */
export declare class ProductionJwtManager extends Adapter {
    private readonly redis;
    private readonly accessTokenSecret;
    private readonly refreshTokenSecret;
    private readonly issuer;
    private readonly audience;
    private readonly accessTokenExpiry;
    private readonly refreshTokenExpiry;
    constructor();
    /**
     * Generate access token for user
     */
    generateAccessToken(userId: string, scopes?: string[], sessionId?: string): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    /**
     * Generate refresh token for user
     */
    generateRefreshToken(userId: string, sessionId?: string): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    /**
     * Validate access token
     */
    validateToken(token: string): Promise<TokenPayload>;
    /**
     * Validate refresh token
     */
    validateRefreshToken(token: string): Promise<TokenPayload>;
    /**
     * Invalidate refresh token
     */
    invalidateRefreshToken(token: string): Promise<void>;
    /**
     * Invalidate all refresh tokens for user
     */
    invalidateAllRefreshTokens(userId: string): Promise<void>;
    /**
     * Blacklist token (for logout)
     */
    blacklistToken(jti: string, exp: number): Promise<void>;
    /**
     * Check if token is blacklisted
     */
    isTokenBlacklisted(jti: string): Promise<boolean>;
    /**
     * Get token expiry time
     */
    getTokenExpiry(token: string): Date | null;
    /**
     * Check if token is about to expire (within 5 minutes)
     */
    isTokenExpiringSoon(token: string): boolean;
    /**
     * Rotate refresh token (generate new one and invalidate old)
     */
    rotateRefreshToken(oldToken: string): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    /**
     * Get active sessions for user
     */
    getActiveSessions(userId: string): Promise<any[]>;
    /**
     * Initialize Redis connection
     */
    private initializeRedis;
    /**
     * Generate secure secret key
     */
    private generateSecureSecret;
    /**
     * Generate unique JWT ID
     */
    private generateJwtId;
    /**
     * Parse expiry string to seconds
     */
    private parseExpiry;
    /**
     * Store token metadata for management
     */
    private storeTokenMetadata;
    /**
     * Store refresh token in Redis
     */
    private storeRefreshToken;
    /**
     * Get refresh token from Redis
     */
    private getRefreshToken;
    /**
     * Remove refresh token from Redis
     */
    private removeRefreshToken;
    /**
     * Blacklist all tokens for user
     */
    private blacklistAllUserTokens;
    /**
     * Mock user retrieval (replace with actual database call)
     */
    private getUserById;
    /**
     * Cleanup expired tokens (to be called periodically)
     */
    cleanupExpiredTokens(): Promise<void>;
}
//# sourceMappingURL=production-jwt-manager.d.ts.map