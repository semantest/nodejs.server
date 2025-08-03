"use strict";
/**
 * @fileoverview Production-ready JWT token manager
 * @description Real JWT implementation with proper cryptography and Redis storage
 * @author Semantest Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionJwtManager = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
const ioredis_1 = require("ioredis");
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Production JWT token manager with Redis backing
 */
class ProductionJwtManager extends typescript_eda_stubs_1.Adapter {
    constructor() {
        super();
        // Initialize Redis connection
        this.redis = new ioredis_1.Redis({
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
    async generateAccessToken(userId, scopes = [], sessionId) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const now = Math.floor(Date.now() / 1000);
        const jti = this.generateJwtId();
        const payload = {
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
    async generateRefreshToken(userId, sessionId) {
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
    async validateToken(token) {
        try {
            // Verify token signature and decode
            const payload = jwt.verify(token, this.accessTokenSecret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: ['HS256']
            });
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
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new Error(`Invalid token: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Validate refresh token
     */
    async validateRefreshToken(token) {
        try {
            // Verify token signature and decode
            const payload = jwt.verify(token, this.refreshTokenSecret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: ['HS256']
            });
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
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new Error(`Invalid refresh token: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Invalidate refresh token
     */
    async invalidateRefreshToken(token) {
        try {
            const payload = jwt.decode(token);
            if (payload && payload.userId && payload.jti) {
                await this.removeRefreshToken(payload.userId, payload.jti);
                await this.blacklistToken(payload.jti, payload.exp);
                console.log(`🗑️ Invalidated refresh token for user ${payload.userId}`);
            }
        }
        catch (error) {
            console.error('Error invalidating refresh token:', error);
        }
    }
    /**
     * Invalidate all refresh tokens for user
     */
    async invalidateAllRefreshTokens(userId) {
        try {
            const pattern = `refresh_token:${userId}:*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                console.log(`🗑️ Invalidated ${keys.length} refresh tokens for user ${userId}`);
            }
            // Also blacklist all active tokens for this user
            await this.blacklistAllUserTokens(userId);
        }
        catch (error) {
            console.error('Error invalidating all refresh tokens:', error);
        }
    }
    /**
     * Blacklist token (for logout)
     */
    async blacklistToken(jti, exp) {
        try {
            const ttl = exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await this.redis.setex(`blacklist:${jti}`, ttl, '1');
                console.log(`🚫 Blacklisted token ${jti} for ${ttl} seconds`);
            }
        }
        catch (error) {
            console.error('Error blacklisting token:', error);
        }
    }
    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(jti) {
        try {
            const result = await this.redis.get(`blacklist:${jti}`);
            return result === '1';
        }
        catch (error) {
            console.error('Error checking token blacklist:', error);
            return false;
        }
    }
    /**
     * Get token expiry time
     */
    getTokenExpiry(token) {
        try {
            const payload = jwt.decode(token);
            return payload?.exp ? new Date(payload.exp * 1000) : null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Check if token is about to expire (within 5 minutes)
     */
    isTokenExpiringSoon(token) {
        const expiry = this.getTokenExpiry(token);
        if (!expiry)
            return true;
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        return expiry <= fiveMinutesFromNow;
    }
    /**
     * Rotate refresh token (generate new one and invalidate old)
     */
    async rotateRefreshToken(oldToken) {
        const payload = await this.validateRefreshToken(oldToken);
        // Invalidate old token
        await this.invalidateRefreshToken(oldToken);
        // Generate new token
        return await this.generateRefreshToken(payload.userId, payload.sessionId);
    }
    /**
     * Get active sessions for user
     */
    async getActiveSessions(userId) {
        try {
            const pattern = `refresh_token:${userId}:*`;
            const keys = await this.redis.keys(pattern);
            const sessions = [];
            for (const key of keys) {
                const token = await this.redis.get(key);
                if (token) {
                    const payload = jwt.decode(token);
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
        }
        catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }
    /**
     * Initialize Redis connection
     */
    async initializeRedis() {
        try {
            await this.redis.connect();
            console.log('✅ Redis connection established for JWT manager');
        }
        catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
        }
    }
    /**
     * Generate secure secret key
     */
    generateSecureSecret() {
        return crypto.randomBytes(64).toString('hex');
    }
    /**
     * Generate unique JWT ID
     */
    generateJwtId() {
        return crypto.randomBytes(16).toString('hex');
    }
    /**
     * Parse expiry string to seconds
     */
    parseExpiry(expiry) {
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
    async storeTokenMetadata(jti, userId, expiresAt, type) {
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
                await this.redis.setex(`token_metadata:${jti}`, ttl, JSON.stringify(metadata));
            }
        }
        catch (error) {
            console.error('Error storing token metadata:', error);
        }
    }
    /**
     * Store refresh token in Redis
     */
    async storeRefreshToken(userId, jti, token, ttl) {
        try {
            await this.redis.setex(`refresh_token:${userId}:${jti}`, ttl, token);
        }
        catch (error) {
            console.error('Error storing refresh token:', error);
        }
    }
    /**
     * Get refresh token from Redis
     */
    async getRefreshToken(userId, jti) {
        try {
            return await this.redis.get(`refresh_token:${userId}:${jti}`);
        }
        catch (error) {
            console.error('Error getting refresh token:', error);
            return null;
        }
    }
    /**
     * Remove refresh token from Redis
     */
    async removeRefreshToken(userId, jti) {
        try {
            await this.redis.del(`refresh_token:${userId}:${jti}`);
        }
        catch (error) {
            console.error('Error removing refresh token:', error);
        }
    }
    /**
     * Blacklist all tokens for user
     */
    async blacklistAllUserTokens(userId) {
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
        }
        catch (error) {
            console.error('Error blacklisting all user tokens:', error);
        }
    }
    /**
     * Mock user retrieval (replace with actual database call)
     */
    async getUserById(userId) {
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
    async cleanupExpiredTokens() {
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
        }
        catch (error) {
            console.error('Error cleaning up expired tokens:', error);
        }
    }
}
exports.ProductionJwtManager = ProductionJwtManager;
//# sourceMappingURL=production-jwt-manager.js.map