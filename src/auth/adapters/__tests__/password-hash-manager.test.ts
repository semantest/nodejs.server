/**
 * Tests for PasswordHashManager
 * Created to improve coverage from 3.44%
 */

import { PasswordHashManager } from '../password-hash-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn()
}));
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('PasswordHashManager', () => {
  let passwordManager: PasswordHashManager;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      BCRYPT_SALT_ROUNDS: '10',
      PASSWORD_PEPPER: 'test-pepper-key'
    };
    passwordManager = new PasswordHashManager();
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
      expect((passwordManager as any).saltRounds).toBe(10);
      expect((passwordManager as any).pepperKey).toBe('test-pepper-key');
    });

    it('should use default values when environment variables are not set', () => {
      process.env = {};
      const defaultPasswordManager = new PasswordHashManager();
      expect((defaultPasswordManager as any).saltRounds).toBe(12);
      expect((defaultPasswordManager as any).pepperKey).toBe('your-pepper-key-change-in-production');
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'testPassword123!';
      const hashedPassword = 'hashed_password_123';
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await passwordManager.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('testPassword123!test-pepper-key', 10);
      expect(consoleLogSpy).toHaveBeenCalledWith('🔒 Password hashed successfully with bcrypt');
    });

    it('should handle hashing errors', async () => {
      const password = 'testPassword123!';
      mockBcrypt.hash.mockRejectedValue(new Error('Bcrypt error') as never);

      await expect(passwordManager.hashPassword(password)).rejects.toThrow('Failed to hash password');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error hashing password:', expect.any(Error));
    });
  });

  describe('verifyPassword', () => {
    it('should verify valid password', async () => {
      const password = 'testPassword123!';
      const hash = 'hashed_password_123';
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await passwordManager.verifyPassword(password, hash);

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('testPassword123!test-pepper-key', hash);
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Password verification: valid');
    });

    it('should reject invalid password', async () => {
      const password = 'wrongPassword';
      const hash = 'hashed_password_123';
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await passwordManager.verifyPassword(password, hash);

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Password verification: invalid');
    });

    it('should handle verification errors', async () => {
      const password = 'testPassword123!';
      const hash = 'hashed_password_123';
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error') as never);

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
      } as any);
      
      // Mock the store method
      (passwordManager as any).storePasswordResetToken = jest.fn().mockResolvedValue(undefined);

      const result = await passwordManager.generatePasswordResetToken(userId);

      expect(result).toBe(mockToken);
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect((passwordManager as any).storePasswordResetToken).toHaveBeenCalledWith(
        userId,
        mockToken,
        expect.any(Date)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(`🔑 Generated password reset token for user ${userId}`);
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should verify valid token', async () => {
      const token = 'valid_token';
      const userId = 'user123';
      const futureDate = new Date(Date.now() + 3600000);
      
      (passwordManager as any).findPasswordResetToken = jest.fn().mockResolvedValue({
        userId,
        expiresAt: futureDate
      });

      const result = await passwordManager.verifyPasswordResetToken(token);

      expect(result).toBe(userId);
    });

    it('should reject expired token', async () => {
      const token = 'expired_token';
      const pastDate = new Date(Date.now() - 3600000);
      
      (passwordManager as any).findPasswordResetToken = jest.fn().mockResolvedValue({
        userId: 'user123',
        expiresAt: pastDate
      });
      (passwordManager as any).deletePasswordResetToken = jest.fn().mockResolvedValue(undefined);

      const result = await passwordManager.verifyPasswordResetToken(token);

      expect(result).toBeNull();
      expect((passwordManager as any).deletePasswordResetToken).toHaveBeenCalledWith(token);
    });

    it('should handle non-existent token', async () => {
      const token = 'invalid_token';
      
      (passwordManager as any).findPasswordResetToken = jest.fn().mockResolvedValue(null);

      const result = await passwordManager.verifyPasswordResetToken(token);

      expect(result).toBeNull();
    });

    it('should handle verification errors', async () => {
      const token = 'error_token';
      
      (passwordManager as any).findPasswordResetToken = jest.fn().mockRejectedValue(new Error('Database error'));

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
      (passwordManager as any).updateUserPassword = jest.fn().mockResolvedValue(undefined);
      (passwordManager as any).deletePasswordResetToken = jest.fn().mockResolvedValue(undefined);

      const result = await passwordManager.resetPassword(token, newPassword);

      expect(result).toBe(true);
      expect(passwordManager.verifyPasswordResetToken).toHaveBeenCalledWith(token);
      expect(passwordManager.hashPassword).toHaveBeenCalledWith(newPassword);
      expect((passwordManager as any).updateUserPassword).toHaveBeenCalledWith(userId, hashedPassword);
      expect((passwordManager as any).deletePasswordResetToken).toHaveBeenCalledWith(token);
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

      (passwordManager as any).getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
      jest.spyOn(passwordManager, 'verifyPassword').mockResolvedValue(true);
      jest.spyOn(passwordManager, 'hashPassword').mockResolvedValue(newHash);
      (passwordManager as any).updateUserPassword = jest.fn().mockResolvedValue(undefined);

      const result = await passwordManager.changePassword(userId, currentPassword, newPassword);

      expect(result).toBe(true);
      expect((passwordManager as any).getUserPasswordHash).toHaveBeenCalledWith(userId);
      expect(passwordManager.verifyPassword).toHaveBeenCalledWith(currentPassword, currentHash);
      expect(passwordManager.hashPassword).toHaveBeenCalledWith(newPassword);
      expect((passwordManager as any).updateUserPassword).toHaveBeenCalledWith(userId, newHash);
      expect(consoleLogSpy).toHaveBeenCalledWith(`🔄 Password changed successfully for user ${userId}`);
    });

    it('should reject if user not found', async () => {
      const userId = 'nonexistent';
      const currentPassword = 'CurrentP@ssw0rd';
      const newPassword = 'NewStr0ngP@ssword';

      (passwordManager as any).getUserPasswordHash = jest.fn().mockResolvedValue(null);
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

      (passwordManager as any).getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
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

      (passwordManager as any).getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
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

      (passwordManager as any).getUserPasswordHash = jest.fn().mockResolvedValue(currentHash);
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
      const peppered = (passwordManager as any).addPepper(password);
      expect(peppered).toBe('testPasswordtest-pepper-key');
    });

    it('should generate password entropy', () => {
      const mockEntropy = 'entropy123';
      mockCrypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(mockEntropy)
      } as any);

      const entropy = (passwordManager as any).generatePasswordEntropy();
      
      expect(entropy).toBe(mockEntropy);
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
    });

    it('should identify common passwords', () => {
      expect((passwordManager as any).isCommonPassword('password')).toBe(true);
      expect((passwordManager as any).isCommonPassword('123456')).toBe(true);
      expect((passwordManager as any).isCommonPassword('uniqueP@ssw0rd')).toBe(false);
    });

    it('should detect sequential characters', () => {
      expect((passwordManager as any).hasSequentialCharacters('abc123')).toBe(true);
      expect((passwordManager as any).hasSequentialCharacters('qwerty')).toBe(true);
      expect((passwordManager as any).hasSequentialCharacters('random')).toBe(false);
    });

    it('should detect repeated characters', () => {
      expect((passwordManager as any).hasRepeatedCharacters('passsword')).toBe(true);
      expect((passwordManager as any).hasRepeatedCharacters('111222')).toBe(true);
      expect((passwordManager as any).hasRepeatedCharacters('password')).toBe(false);
    });

    it('should generate secure token', () => {
      const mockToken = 'secure_token_hex';
      mockCrypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken)
      } as any);

      const token = (passwordManager as any).generateSecureToken();
      
      expect(token).toBe(mockToken);
      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });
});