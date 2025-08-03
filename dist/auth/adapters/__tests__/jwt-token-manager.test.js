"use strict";
/**
 * Tests for JwtTokenManager
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_token_manager_1 = require("../jwt-token-manager");
describe('JwtTokenManager', () => {
    let jwtManager;
    const mockSecret = 'test-secret-key';
    const mockIssuer = 'test-issuer';
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = mockSecret;
        process.env.JWT_ISSUER = mockIssuer;
        process.env.JWT_ACCESS_EXPIRY = '15m';
        process.env.JWT_REFRESH_EXPIRY = '7d';
        jwtManager = new jwt_token_manager_1.JwtTokenManager();
    });
    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.JWT_ISSUER;
        delete process.env.JWT_ACCESS_EXPIRY;
        delete process.env.JWT_REFRESH_EXPIRY;
    });
    describe('initialization', () => {
        it('should initialize with environment variables', () => {
            expect(jwtManager).toBeDefined();
            expect(jwtManager['secretKey']).toBe(mockSecret);
            expect(jwtManager['issuer']).toBe(mockIssuer);
        });
        it('should use default values if environment variables not set', () => {
            delete process.env.JWT_SECRET;
            delete process.env.JWT_ISSUER;
            const manager = new jwt_token_manager_1.JwtTokenManager();
            expect(manager['secretKey']).toBe('your-secret-key-change-in-production');
            expect(manager['issuer']).toBe('web-buddy-api');
        });
    });
    describe('generateAccessToken', () => {
        it('should generate an access token with user id and scopes', async () => {
            const userId = 'user123';
            const scopes = ['read', 'write'];
            const token = await jwtManager.generateAccessToken(userId, scopes);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format
        });
        it('should generate access token with default empty scopes', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateAccessToken(userId);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });
    });
    describe('generateRefreshToken', () => {
        it('should generate a refresh token with user id', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateRefreshToken(userId);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format
        });
    });
    describe('validateToken', () => {
        it('should validate a valid access token', async () => {
            // Generate a token first
            const userId = 'user123';
            const token = await jwtManager.generateAccessToken(userId);
            // Validate it
            const decoded = await jwtManager.validateToken(token);
            expect(decoded).toBeDefined();
            expect(decoded.userId).toBe(userId);
            expect(decoded.iss).toBe(mockIssuer);
        });
        it('should throw error for invalid token format', async () => {
            const invalidToken = 'invalid.token';
            await expect(jwtManager.validateToken(invalidToken))
                .rejects.toThrow('Invalid token');
        });
        it('should throw error for expired token', async () => {
            // Create an expired token by manipulating the payload
            const expiredPayload = {
                userId: 'user123',
                exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                iss: mockIssuer
            };
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
            const expiredToken = `${header}.${payload}.fakesignature`;
            await expect(jwtManager.validateToken(expiredToken))
                .rejects.toThrow('Invalid token');
        });
        it('should throw error for wrong issuer', async () => {
            // Create a token with wrong issuer
            process.env.JWT_ISSUER = 'different-issuer';
            const differentManager = new jwt_token_manager_1.JwtTokenManager();
            const token = await jwtManager.generateAccessToken('user123');
            await expect(differentManager.validateToken(token))
                .rejects.toThrow('Invalid token');
        });
    });
    describe('validateRefreshToken', () => {
        it('should validate a valid refresh token', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateRefreshToken(userId);
            const decoded = await jwtManager.validateRefreshToken(token);
            expect(decoded).toBeDefined();
            expect(decoded.userId).toBe(userId);
            // The refresh token includes 'type' in the token itself, not in TokenPayload
            expect(decoded.type).toBe('refresh');
        });
        it('should reject access tokens', async () => {
            const userId = 'user123';
            const accessToken = await jwtManager.generateAccessToken(userId);
            await expect(jwtManager.validateRefreshToken(accessToken))
                .rejects.toThrow('Invalid refresh token');
        });
    });
    describe('invalidateRefreshToken', () => {
        it('should invalidate a valid refresh token', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateRefreshToken(userId);
            // Invalidate should not throw
            await expect(jwtManager.invalidateRefreshToken(token))
                .resolves.toBeUndefined();
        });
        it('should handle invalid token gracefully', async () => {
            // Should not throw, just log error
            await expect(jwtManager.invalidateRefreshToken('invalid.token'))
                .resolves.toBeUndefined();
        });
    });
    describe('blacklistToken', () => {
        it('should blacklist a valid token', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateAccessToken(userId);
            await expect(jwtManager.blacklistToken(token))
                .resolves.toBeUndefined();
        });
        it('should handle invalid token gracefully', async () => {
            await expect(jwtManager.blacklistToken('invalid.token'))
                .resolves.toBeUndefined();
        });
    });
    describe('getTokenExpiry', () => {
        it('should return expiry date for valid token', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateAccessToken(userId);
            const expiry = jwtManager.getTokenExpiry(token);
            expect(expiry).toBeInstanceOf(Date);
            expect(expiry.getTime()).toBeGreaterThan(Date.now());
        });
        it('should return null for invalid token', () => {
            const expiry = jwtManager.getTokenExpiry('invalid.token');
            expect(expiry).toBeNull();
        });
    });
    describe('isTokenExpiringSoon', () => {
        it('should return false for fresh token', async () => {
            const userId = 'user123';
            const token = await jwtManager.generateAccessToken(userId);
            const expiringSoon = jwtManager.isTokenExpiringSoon(token);
            expect(expiringSoon).toBe(false);
        });
        it('should return true for invalid token', () => {
            const expiringSoon = jwtManager.isTokenExpiringSoon('invalid.token');
            expect(expiringSoon).toBe(true);
        });
        it('should return true for token expiring within 5 minutes', async () => {
            // Create a token that expires in 3 minutes
            const nearExpiryPayload = {
                userId: 'user123',
                exp: Math.floor(Date.now() / 1000) + 180, // 3 minutes
                iss: mockIssuer,
                sub: 'user123',
                jti: 'test_jti'
            };
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(JSON.stringify(nearExpiryPayload)).toString('base64url');
            const signature = Buffer.from(`${header}.${payload}.${mockSecret}`).toString('base64url').slice(0, 43);
            const nearExpiryToken = `${header}.${payload}.${signature}`;
            const expiringSoon = jwtManager.isTokenExpiringSoon(nearExpiryToken);
            expect(expiringSoon).toBe(true);
        });
    });
    describe('error handling', () => {
        it('should handle malformed tokens', async () => {
            const malformedToken = 'not-a-jwt';
            await expect(jwtManager.validateToken(malformedToken))
                .rejects.toThrow('Invalid token');
        });
        it('should handle tokens with wrong number of parts', async () => {
            const wrongFormatToken = 'only.two';
            await expect(jwtManager.validateToken(wrongFormatToken))
                .rejects.toThrow('Invalid token');
        });
        it('should handle empty token', async () => {
            await expect(jwtManager.validateToken(''))
                .rejects.toThrow('Invalid token');
        });
    });
});
//# sourceMappingURL=jwt-token-manager.test.js.map