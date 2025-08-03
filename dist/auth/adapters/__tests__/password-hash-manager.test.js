"use strict";
/**
 * Tests for PasswordHashManager
 * Created to improve coverage from 3.44%
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
const password_hash_manager_1 = require("../password-hash-manager");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt;
// Mock crypto
jest.mock('crypto', () => ({
    randomBytes: jest.fn()
}));
const mockCrypto = crypto;
describe('PasswordHashManager', () => {
    let passwordManager;
    let originalEnv;
    let consoleLogSpy;
    let consoleErrorSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            BCRYPT_SALT_ROUNDS: '10',
            PASSWORD_PEPPER: 'test-pepper-key'
        };
        passwordManager = new password_hash_manager_1.PasswordHashManager();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });
    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });
    describe('constructor', () => {
        it('should use environment variables when available', () => {
            expect(passwordManager).toBeDefined();
            expect(passwordManager.saltRounds).toBe(10);
            expect(passwordManager.pepperKey).toBe('test-pepper-key');
        });
        it('should use default values when environment variables are not set', () => {
            process.env = {};
            const defaultPasswordManager = new password_hash_manager_1.PasswordHashManager();
            expect(defaultPasswordManager.saltRounds).toBe(12);
            expect(defaultPasswordManager.pepperKey).toBe('your-pepper-key-change-in-production');
        });
    });
    describe('hashPassword', () => {
        it('should hash password successfully', async () => {
            const password = 'testPassword123!';
            const hashedPassword = 'hashed_password_123';
            mockBcrypt.hash.mockResolvedValue(hashedPassword);
            const result = await passwordManager.hashPassword(password);
            expect(result).toBe(hashedPassword);
            expect(mockBcrypt.hash).toHaveBeenCalledWith('testPassword123!test-pepper-key', 10);
            expect(consoleLogSpy).toHaveBeenCalledWith('🔒 Password hashed successfully with bcrypt');
        });
        it('should handle hashing errors', async () => {
            const password = 'testPassword123!';
            mockBcrypt.hash.mockRejectedValue(new Error('Bcrypt error'));
            await expect(passwordManager.hashPassword(password)).rejects.toThrow('Failed to hash password');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error hashing password:', expect.any(Error));
        });
    });
    describe('verifyPassword', () => {
        it('should verify valid password', async () => {
            const password = 'testPassword123!';
            const hash = 'hashed_password_123';
            mockBcrypt.compare.mockResolvedValue(true);
            const result = await passwordManager.verifyPassword(password, hash);
            expect(result).toBe(true);
            expect(mockBcrypt.compare).toHaveBeenCalledWith('testPassword123!test-pepper-key', hash);
            expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Password verification: valid');
        });
        it('should reject invalid password', async () => {
            const password = 'wrongPassword';
            const hash = 'hashed_password_123';
            mockBcrypt.compare.mockResolvedValue(false);
            const result = await passwordManager.verifyPassword(password, hash);
            expect(result).toBe(false);
            expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Password verification: invalid');
        });
        it('should handle verification errors', async () => {
            const password = 'testPassword123!';
            const hash = 'hashed_password_123';
            mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));
            const result = await passwordManager.verifyPassword(password, hash);
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error verifying password:', expect.any(Error));
        });
    });
    describe('checkPasswordStrength', () => {
        it('should validate strong password', () => {
            const result = passwordManager.checkPasswordStrength('MyStr0ng!Password');
            expect(result).toEqual({
                score: 6,
                feedback: [],
                isValid: true
            });
        });
        it('should reject short password', () => {
            const result = passwordManager.checkPasswordStrength('Sh0rt!');
            expect(result.feedback).toContain('Password must be at least 8 characters long');
            expect(result.isValid).toBe(false);
        });
        it('should reject password without lowercase', () => {
            const result = passwordManager.checkPasswordStrength('PASSWORD123!');
            expect(result.feedback).toContain('Password must contain lowercase letters');
            expect(result.isValid).toBe(false);
        });
        it('should reject password without uppercase', () => {
            const result = passwordManager.checkPasswordStrength('password123!');
            expect(result.feedback).toContain('Password must contain uppercase letters');
            expect(result.isValid).toBe(false);
        });
        it('should reject password without numbers', () => {
            const result = passwordManager.checkPasswordStrength('Password!');
            expect(result.feedback).toContain('Password must contain numbers');
            expect(result.isValid).toBe(false);
        });
        it('should reject password without special characters', () => {
            const result = passwordManager.checkPasswordStrength('Password123');
            expect(result.feedback).toContain('Password must contain special characters');
            expect(result.isValid).toBe(false);
        });
        it('should reject common passwords', () => {
            const result = passwordManager.checkPasswordStrength('password123');
            expect(result.feedback).toContain('Password is too common');
            expect(result.isValid).toBe(false);
        });
        it('should detect sequential characters', () => {
            const result = passwordManager.checkPasswordStrength('Abc123!@#');
            expect(result.feedback).toContain('Avoid sequential characters');
            expect(result.score).toBeLessThan(6);
        });
        it('should detect repeated characters', () => {
            const result = passwordManager.checkPasswordStrength('Passsword123!');
            expect(result.feedback).toContain('Avoid repeated characters');
            expect(result.score).toBeLessThan(6);
        });
        it('should give bonus score for longer passwords', () => {
            const result = passwordManager.checkPasswordStrength('VeryL0ngPasswordWith!@#');
            expect(result.score).toBeGreaterThanOrEqual(6);
            expect(result.isValid).toBe(true);
        });
    });
    describe('generatePasswordResetToken', () => {
        it('should generate reset token successfully', async () => {
            const userId = 'user123';
            const mockToken = 'secure_token_123';
            mockCrypto.randomBytes.mockReturnValue({
                toString: jest.fn().mockReturnValue(mockToken)
            });
            // Mock the store method
            passwordManager.storePasswordResetToken = jest.fn().mockResolvedValue(undefined);
            const result = await passwordManager.generatePasswordResetToken(userId);
            expect(result).toBe(mockToken);
            expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
            expect(passwordManager.storePasswordResetToken).toHaveBeenCalledWith(userId, mockToken, expect.any(Date));
            expect(consoleLogSpy).toHaveBeenCalledWith(`🔑 Generated password reset token for user ${userId}`);
        });
    });
    describe('verifyPasswordResetToken', () => {
        it('should verify valid token', async () => {
            const token = 'valid_token';
            const userId = 'user123';
            const futureDate = new Date(Date.now() + 3600000);
            passwordManager.findPasswordResetToken = jest.fn().mockResolvedValue({
                userId,
                expiresAt: futureDate
            });
            const result = await passwordManager.verifyPasswordResetToken(token);
            expect(result).toBe(userId);
        });
        it('should reject expired token', async () => {
            const token = 'expired_token';
            const pastDate = new Date(Date.now() - 3600000);
            passwordManager.findPasswordResetToken = jest.fn().mockResolvedValue({
                userId: 'user123',
                expiresAt: pastDate
            });
            passwordManager.deletePasswordResetToken = jest.fn().mockResolvedValue(undefined);
            const result = await passwordManager.verifyPasswordResetToken(token);
            expect(result).toBeNull();
            expect(passwordManager.deletePasswordResetToken).toHaveBeenCalledWith(token);
        });
        it('should handle non-existent token', async () => {
            const token = 'invalid_token';
            passwordManager.findPasswordResetToken = jest.fn().mockResolvedValue(null);
            const result = await passwordManager.verifyPasswordResetToken(token);
            expect(result).toBeNull();
        });
        it('should handle verification errors', async () => {
            const token = 'error_token';
            passwordManager.findPasswordResetToken = jest.fn().mockRejectedValue(new Error('Database error'));
            const result = await passwordManager.verifyPasswordResetToken(token);
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error verifying password reset token:', expect.any(Error));
        });
    });
    describe('resetPassword', () => {
        it('should reset password successfully', async () => {
            const token = 'valid_token';
            const newPassword = 'NewStr0ngP@ssword';
            const userId = 'user123';
            const hashedPassword = 'new_hashed_password';
            jest.spyOn(passwordManager, 'verifyPasswordResetToken').mockResolvedValue(userId);
            jest.spyOn(passwordManager, 'hashPassword').mockResolvedValue(hashedPassword);
            passwordManager.updateUserPassword = jest.fn().mockResolvedValue(undefined);
            passwordManager.deletePasswordResetToken = jest.fn().mockResolvedValue(undefined);
            const result = await passwordManager.resetPassword(token, newPassword);
            expect(result).toBe(true);
            expect(passwordManager.verifyPasswordResetToken).toHaveBeenCalledWith(token);
            expect(passwordManager.hashPassword).toHaveBeenCalledWith(newPassword);
            expect(passwordManager.updateUserPassword).toHaveBeenCalledWith(userId, hashedPassword);
            expect(passwordManager.deletePasswordResetToken).toHaveBeenCalledWith(token);
            expect(consoleLogSpy).toHaveBeenCalledWith(`🔄 Password reset successfully for user ${userId}`);
        });
        it('should reject invalid token', async () => {
            const token = 'invalid_token';
            const newPassword = 'NewStr0ngP@ssword';
            jest.spyOn(passwordManager, 'verifyPasswordResetToken').mockResolvedValue(null);
            const hashPasswordSpy = jest.spyOn(passwordManager, 'hashPassword');
            const result = await passwordManager.resetPassword(token, newPassword);
            expect(result).toBe(false);
            expect(hashPasswordSpy).not.toHaveBeenCalled();
        });
        it('should reject weak password', async () => {
            const token = 'valid_token';
            const weakPassword = 'weak';
            const userId = 'user123';
            jest.spyOn(passwordManager, 'verifyPasswordResetToken').mockResolvedValue(userId);
            const result = await passwordManager.resetPassword(token, weakPassword);
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error resetting password:', expect.any(Error));
        });
        it('should handle reset errors', async () => {
            const token = 'valid_token';
            const newPassword = 'NewStr0ngP@ssword';
            const userId = 'user123';
            jest.spyOn(passwordManager, 'verifyPasswordResetToken').mockResolvedValue(userId);
            jest.spyOn(passwordManager, 'hashPassword').mockRejectedValue(new Error('Hash error'));
            const result = await passwordManager.resetPassword(token, newPassword);
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error resetting password:', expect.any(Error));
        });
    });
    describe('changePassword', () => {
        it('should change password successfully', async () => {
            const userId = 'user123';
            const currentPassword = 'CurrentP@ssw0rd';
            const newPassword = 'NewStr0ngP@ssword';
            const currentHash = 'current_hash';
            const newHash = 'new_hash';
            passwordManager.getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
            jest.spyOn(passwordManager, 'verifyPassword').mockResolvedValue(true);
            jest.spyOn(passwordManager, 'hashPassword').mockResolvedValue(newHash);
            passwordManager.updateUserPassword = jest.fn().mockResolvedValue(undefined);
            const result = await passwordManager.changePassword(userId, currentPassword, newPassword);
            expect(result).toBe(true);
            expect(passwordManager.getUserPasswordHash).toHaveBeenCalledWith(userId);
            expect(passwordManager.verifyPassword).toHaveBeenCalledWith(currentPassword, currentHash);
            expect(passwordManager.hashPassword).toHaveBeenCalledWith(newPassword);
            expect(passwordManager.updateUserPassword).toHaveBeenCalledWith(userId, newHash);
            expect(consoleLogSpy).toHaveBeenCalledWith(`🔄 Password changed successfully for user ${userId}`);
        });
        it('should reject if user not found', async () => {
            const userId = 'nonexistent';
            const currentPassword = 'CurrentP@ssw0rd';
            const newPassword = 'NewStr0ngP@ssword';
            passwordManager.getUserPasswordHash = jest.fn().mockResolvedValue(null);
            const verifyPasswordSpy = jest.spyOn(passwordManager, 'verifyPassword');
            const result = await passwordManager.changePassword(userId, currentPassword, newPassword);
            expect(result).toBe(false);
            expect(verifyPasswordSpy).not.toHaveBeenCalled();
        });
        it('should reject incorrect current password', async () => {
            const userId = 'user123';
            const currentPassword = 'WrongPassword';
            const newPassword = 'NewStr0ngP@ssword';
            const currentHash = 'current_hash';
            passwordManager.getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
            jest.spyOn(passwordManager, 'verifyPassword').mockResolvedValue(false);
            const hashPasswordSpy = jest.spyOn(passwordManager, 'hashPassword');
            const result = await passwordManager.changePassword(userId, currentPassword, newPassword);
            expect(result).toBe(false);
            expect(hashPasswordSpy).not.toHaveBeenCalled();
        });
        it('should reject weak new password', async () => {
            const userId = 'user123';
            const currentPassword = 'CurrentP@ssw0rd';
            const weakPassword = 'weak';
            const currentHash = 'current_hash';
            passwordManager.getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
            jest.spyOn(passwordManager, 'verifyPassword').mockResolvedValue(true);
            const result = await passwordManager.changePassword(userId, currentPassword, weakPassword);
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error changing password:', expect.any(Error));
        });
        it('should handle change errors', async () => {
            const userId = 'user123';
            const currentPassword = 'CurrentP@ssw0rd';
            const newPassword = 'NewStr0ngP@ssword';
            const currentHash = 'current_hash';
            passwordManager.getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
            jest.spyOn(passwordManager, 'verifyPassword').mockResolvedValue(true);
            jest.spyOn(passwordManager, 'hashPassword').mockRejectedValue(new Error('Hash error'));
            const result = await passwordManager.changePassword(userId, currentPassword, newPassword);
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error changing password:', expect.any(Error));
        });
    });
    describe('private helper methods', () => {
        it('should add pepper to password', () => {
            const password = 'testPassword';
            const peppered = passwordManager.addPepper(password);
            expect(peppered).toBe('testPasswordtest-pepper-key');
        });
        it('should generate password entropy', () => {
            const mockEntropy = 'entropy123';
            mockCrypto.randomBytes.mockReturnValue({
                toString: jest.fn().mockReturnValue(mockEntropy)
            });
            const entropy = passwordManager.generatePasswordEntropy();
            expect(entropy).toBe(mockEntropy);
            expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
        });
        it('should identify common passwords', () => {
            expect(passwordManager.isCommonPassword('password')).toBe(true);
            expect(passwordManager.isCommonPassword('123456')).toBe(true);
            expect(passwordManager.isCommonPassword('uniqueP@ssw0rd')).toBe(false);
        });
        it('should detect sequential characters', () => {
            expect(passwordManager.hasSequentialCharacters('abc123')).toBe(true);
            expect(passwordManager.hasSequentialCharacters('qwerty')).toBe(true);
            expect(passwordManager.hasSequentialCharacters('random')).toBe(false);
        });
        it('should detect repeated characters', () => {
            expect(passwordManager.hasRepeatedCharacters('passsword')).toBe(true);
            expect(passwordManager.hasRepeatedCharacters('111222')).toBe(true);
            expect(passwordManager.hasRepeatedCharacters('password')).toBe(false);
        });
        it('should generate secure token', () => {
            const mockToken = 'secure_token_hex';
            mockCrypto.randomBytes.mockReturnValue({
                toString: jest.fn().mockReturnValue(mockToken)
            });
            const token = passwordManager.generateSecureToken();
            expect(token).toBe(mockToken);
            expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        });
    });
});
//# sourceMappingURL=password-hash-manager.test.js.map