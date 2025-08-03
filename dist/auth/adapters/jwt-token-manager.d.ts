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
export declare class JwtTokenManager extends Adapter {
    private readonly secretKey;
    private readonly issuer;
    private readonly accessTokenExpiry;
    private readonly refreshTokenExpiry;
    constructor();
    /**
     * Generate access token for user
     */
    generateAccessToken(userId: string, scopes?: string[]): Promise<string>;
    /**
     * Generate refresh token for user
     */
    generateRefreshToken(userId: string): Promise<string>;
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
     * Blacklist token (for logout)
     */
    blacklistToken(token: string): Promise<void>;
    /**
     * Get token expiry time
     */
    getTokenExpiry(token: string): Date | null;
    /**
     * Check if token is about to expire (within 5 minutes)
     */
    isTokenExpiringSoon(token: string): boolean;
    /**
     * Mock JWT encoding (use proper library in production)
     */
    private encodeJWT;
    /**
     * Mock JWT decoding (use proper library in production)
     */
    private decodeJWT;
    /**
     * Generate JWT signature
     */
    private generateSignature;
    /**
     * Generate unique JWT ID
     */
    private generateJwtId;
    /**
     * Helper methods (in production, these would use Redis or database)
     */
    private getUserEmail;
    private getUserRoles;
    private storeRefreshToken;
    private refreshTokenExists;
    private removeRefreshToken;
    private isTokenBlacklisted;
    private addToBlacklist;
}
//# sourceMappingURL=jwt-token-manager.d.ts.map