/**
 * @fileoverview Production password hashing manager with bcrypt
 * @description Handles password hashing, verification, and security with real bcrypt
 * @author Semantest Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
/**
 * Password hash manager for secure password handling
 */
export declare class PasswordHashManager extends Adapter {
    private readonly saltRounds;
    private readonly pepperKey;
    constructor();
    /**
     * Hash password with salt and pepper using bcrypt
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verify password against hash using bcrypt
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Check password strength
     */
    checkPasswordStrength(password: string): {
        score: number;
        feedback: string[];
        isValid: boolean;
    };
    /**
     * Generate password reset token
     */
    generatePasswordResetToken(userId: string): Promise<string>;
    /**
     * Verify password reset token
     */
    verifyPasswordResetToken(token: string): Promise<string | null>;
    /**
     * Reset password with token
     */
    resetPassword(token: string, newPassword: string): Promise<boolean>;
    /**
     * Change password (for authenticated users)
     */
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
    /**
     * Add pepper to password
     */
    private addPepper;
    /**
     * Generate additional entropy for passwords
     */
    private generatePasswordEntropy;
    /**
     * Check if password is common
     */
    private isCommonPassword;
    /**
     * Check for sequential characters
     */
    private hasSequentialCharacters;
    /**
     * Check for repeated characters
     */
    private hasRepeatedCharacters;
    /**
     * Generate secure token using crypto
     */
    private generateSecureToken;
    /**
     * Helper methods (in production, these would use database)
     */
    private storePasswordResetToken;
    private findPasswordResetToken;
    private deletePasswordResetToken;
    private getUserPasswordHash;
    private updateUserPassword;
}
//# sourceMappingURL=password-hash-manager.d.ts.map