/**
 * @fileoverview Password hashing manager for secure password storage
 * @description Handles password hashing, verification, and security
 * @author Web-Buddy Team
 */

import { Adapter } from '../../stubs/typescript-eda-stubs';

/**
 * Password hash manager for secure password handling
 */
export class PasswordHashManager extends Adapter {
  private readonly saltRounds: number;
  private readonly pepperKey: string;

  constructor() {
    super();
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.pepperKey = process.env.PASSWORD_PEPPER || 'your-pepper-key-change-in-production';
  }

  /**
   * Hash password with salt and pepper
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      // Add pepper to password
      const pepperedPassword = this.addPepper(password);
      
      // Generate salt and hash
      const salt = await this.generateSalt();
      const hash = await this.hashWithSalt(pepperedPassword, salt);
      
      console.log('🔒 Password hashed successfully');
      return hash;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // Add pepper to password
      const pepperedPassword = this.addPepper(password);
      
      // Verify against hash
      const isValid = await this.compareWithHash(pepperedPassword, hash);
      
      console.log(`🔍 Password verification: ${isValid ? 'valid' : 'invalid'}`);
      return isValid;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Check password strength
   */
  public checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    isValid: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 8) {
      score += 1;
    }

    if (password.length >= 12) {
      score += 1;
    }

    // Character variety checks
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain uppercase letters');
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain numbers');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password must contain special characters');
    }

    // Common password patterns
    if (this.isCommonPassword(password)) {
      score -= 2;
      feedback.push('Password is too common');
    }

    // Sequential characters
    if (this.hasSequentialCharacters(password)) {
      score -= 1;
      feedback.push('Avoid sequential characters');
    }

    // Repeated characters
    if (this.hasRepeatedCharacters(password)) {
      score -= 1;
      feedback.push('Avoid repeated characters');
    }

    const isValid = score >= 4 && feedback.length === 0;
    
    return { score, feedback, isValid };
  }

  /**
   * Generate password reset token
   */
  public async generatePasswordResetToken(userId: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    
    // Store token in database with expiration
    await this.storePasswordResetToken(userId, token, expiresAt);
    
    console.log(`🔑 Generated password reset token for user ${userId}`);
    return token;
  }

  /**
   * Verify password reset token
   */
  public async verifyPasswordResetToken(token: string): Promise<string | null> {
    try {
      const tokenData = await this.findPasswordResetToken(token);
      if (!tokenData) {
        return null;
      }

      // Check if token is expired
      if (tokenData.expiresAt < new Date()) {
        await this.deletePasswordResetToken(token);
        return null;
      }

      return tokenData.userId;
    } catch (error) {
      console.error('Error verifying password reset token:', error);
      return null;
    }
  }

  /**
   * Reset password with token
   */
  public async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const userId = await this.verifyPasswordResetToken(token);
      if (!userId) {
        return false;
      }

      // Check password strength
      const strengthCheck = this.checkPasswordStrength(newPassword);
      if (!strengthCheck.isValid) {
        throw new Error(`Password is too weak: ${strengthCheck.feedback.join(', ')}`);
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);
      
      // Update user password
      await this.updateUserPassword(userId, hashedPassword);
      
      // Delete reset token
      await this.deletePasswordResetToken(token);
      
      console.log(`🔄 Password reset successfully for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }

  /**
   * Change password (for authenticated users)
   */
  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get current password hash
      const currentHash = await this.getUserPasswordHash(userId);
      if (!currentHash) {
        return false;
      }

      // Verify current password
      const isCurrentValid = await this.verifyPassword(currentPassword, currentHash);
      if (!isCurrentValid) {
        return false;
      }

      // Check new password strength
      const strengthCheck = this.checkPasswordStrength(newPassword);
      if (!strengthCheck.isValid) {
        throw new Error(`Password is too weak: ${strengthCheck.feedback.join(', ')}`);
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);
      
      // Update user password
      await this.updateUserPassword(userId, hashedPassword);
      
      console.log(`🔄 Password changed successfully for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      return false;
    }
  }

  /**
   * Add pepper to password
   */
  private addPepper(password: string): string {
    return `${password}${this.pepperKey}`;
  }

  /**
   * Generate salt
   */
  private async generateSalt(): Promise<string> {
    // In production, use bcrypt.genSalt()
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Hash password with salt
   */
  private async hashWithSalt(password: string, salt: string): Promise<string> {
    // In production, use bcrypt.hash()
    return `${salt}:${Buffer.from(password + salt).toString('base64')}`;
  }

  /**
   * Compare password with hash
   */
  private async compareWithHash(password: string, hash: string): Promise<boolean> {
    // In production, use bcrypt.compare()
    const [salt, expectedHash] = hash.split(':');
    const actualHash = Buffer.from(password + salt).toString('base64');
    return actualHash === expectedHash;
  }

  /**
   * Check if password is common
   */
  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890', 'password1'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Check for sequential characters
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = ['abc', '123', 'qwe', 'asd', 'zxc'];
    return sequences.some(seq => password.toLowerCase().includes(seq));
  }

  /**
   * Check for repeated characters
   */
  private hasRepeatedCharacters(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }

  /**
   * Generate secure token
   */
  private generateSecureToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36);
  }

  /**
   * Helper methods (in production, these would use database)
   */
  private async storePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Mock implementation - store in database
    console.log(`💾 Storing password reset token for user ${userId}`);
  }

  private async findPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    // Mock implementation - find in database
    return null;
  }

  private async deletePasswordResetToken(token: string): Promise<void> {
    // Mock implementation - delete from database
    console.log(`🗑️ Deleting password reset token`);
  }

  private async getUserPasswordHash(userId: string): Promise<string | null> {
    // Mock implementation - get from database
    return null;
  }

  private async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    // Mock implementation - update in database
    console.log(`🔄 Updating password for user ${userId}`);
  }
}