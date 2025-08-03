"use strict";
/**
 * @fileoverview Production password hashing manager with bcrypt
 * @description Handles password hashing, verification, and security with real bcrypt
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
exports.PasswordHashManager = void 0;
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Password hash manager for secure password handling
 */
class PasswordHashManager extends typescript_eda_stubs_1.Adapter {
    constructor() {
        super();
        this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
        this.pepperKey = process.env.PASSWORD_PEPPER || 'your-pepper-key-change-in-production';
    }
    /**
     * Hash password with salt and pepper using bcrypt
     */
    async hashPassword(password) {
        try {
            // Add pepper to password
            const pepperedPassword = this.addPepper(password);
            // Generate hash using bcrypt
            const hash = await bcrypt.hash(pepperedPassword, this.saltRounds);
            console.log('🔒 Password hashed successfully with bcrypt');
            return hash;
        }
        catch (error) {
            console.error('Error hashing password:', error);
            throw new Error('Failed to hash password');
        }
    }
    /**
     * Verify password against hash using bcrypt
     */
    async verifyPassword(password, hash) {
        try {
            // Add pepper to password
            const pepperedPassword = this.addPepper(password);
            // Verify against hash using bcrypt
            const isValid = await bcrypt.compare(pepperedPassword, hash);
            console.log(`🔍 Password verification: ${isValid ? 'valid' : 'invalid'}`);
            return isValid;
        }
        catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }
    /**
     * Check password strength
     */
    checkPasswordStrength(password) {
        const feedback = [];
        let score = 0;
        // Length check
        if (password.length < 8) {
            feedback.push('Password must be at least 8 characters long');
        }
        else if (password.length >= 8) {
            score += 1;
        }
        if (password.length >= 12) {
            score += 1;
        }
        // Character variety checks
        if (/[a-z]/.test(password)) {
            score += 1;
        }
        else {
            feedback.push('Password must contain lowercase letters');
        }
        if (/[A-Z]/.test(password)) {
            score += 1;
        }
        else {
            feedback.push('Password must contain uppercase letters');
        }
        if (/[0-9]/.test(password)) {
            score += 1;
        }
        else {
            feedback.push('Password must contain numbers');
        }
        if (/[^a-zA-Z0-9]/.test(password)) {
            score += 1;
        }
        else {
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
    async generatePasswordResetToken(userId) {
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
    async verifyPasswordResetToken(token) {
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
        }
        catch (error) {
            console.error('Error verifying password reset token:', error);
            return null;
        }
    }
    /**
     * Reset password with token
     */
    async resetPassword(token, newPassword) {
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
        }
        catch (error) {
            console.error('Error resetting password:', error);
            return false;
        }
    }
    /**
     * Change password (for authenticated users)
     */
    async changePassword(userId, currentPassword, newPassword) {
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
        }
        catch (error) {
            console.error('Error changing password:', error);
            return false;
        }
    }
    /**
     * Add pepper to password
     */
    addPepper(password) {
        return `${password}${this.pepperKey}`;
    }
    /**
     * Generate additional entropy for passwords
     */
    generatePasswordEntropy() {
        return crypto.randomBytes(16).toString('hex');
    }
    /**
     * Check if password is common
     */
    isCommonPassword(password) {
        const commonPasswords = [
            'password', '123456', 'password123', 'admin', 'qwerty',
            'letmein', 'welcome', 'monkey', '1234567890', 'password1'
        ];
        return commonPasswords.includes(password.toLowerCase());
    }
    /**
     * Check for sequential characters
     */
    hasSequentialCharacters(password) {
        const sequences = ['abc', '123', 'qwe', 'asd', 'zxc'];
        return sequences.some(seq => password.toLowerCase().includes(seq));
    }
    /**
     * Check for repeated characters
     */
    hasRepeatedCharacters(password) {
        return /(.)\1{2,}/.test(password);
    }
    /**
     * Generate secure token using crypto
     */
    generateSecureToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Helper methods (in production, these would use database)
     */
    async storePasswordResetToken(userId, token, expiresAt) {
        // Mock implementation - store in database
        console.log(`💾 Storing password reset token for user ${userId}`);
    }
    async findPasswordResetToken(token) {
        // Mock implementation - find in database
        return null;
    }
    async deletePasswordResetToken(token) {
        // Mock implementation - delete from database
        console.log(`🗑️ Deleting password reset token`);
    }
    async getUserPasswordHash(userId) {
        // Mock implementation - get from database
        return null;
    }
    async updateUserPassword(userId, hashedPassword) {
        // Mock implementation - update in database
        console.log(`🔄 Updating password for user ${userId}`);
    }
}
exports.PasswordHashManager = PasswordHashManager;
//# sourceMappingURL=password-hash-manager.js.map