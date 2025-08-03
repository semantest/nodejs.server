/**
 * @fileoverview API key manager for authentication and rate limiting
 * @description Manages API key creation, validation, and rate limiting
 * @author Web-Buddy Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { ApiKey, UsageStats } from '../domain/auth-entities';
/**
 * API key manager for handling API authentication and rate limiting
 */
export declare class ApiKeyManager extends Adapter {
    private readonly keyPrefix;
    private readonly keyLength;
    constructor();
    /**
     * Create new API key
     */
    createApiKey(userId: string, keyData: {
        name: string;
        scopes: string[];
        tier: 'free' | 'premium' | 'enterprise';
        expiresAt?: Date;
    }): Promise<ApiKey>;
    /**
     * Validate API key
     */
    validateApiKey(key: string): Promise<ApiKey | null>;
    /**
     * Check rate limit for API key
     */
    checkRateLimit(key: string): Promise<void>;
    /**
     * Update API key usage statistics
     */
    updateUsageStats(key: string, responseTime: number, isError?: boolean): Promise<void>;
    /**
     * Revoke API key
     */
    revokeApiKey(key: string): Promise<void>;
    /**
     * List API keys for user
     */
    listApiKeys(userId: string): Promise<ApiKey[]>;
    /**
     * Get API key usage statistics
     */
    getUsageStats(key: string): Promise<UsageStats | null>;
    /**
     * Update API key scopes
     */
    updateScopes(key: string, scopes: string[]): Promise<void>;
    /**
     * Generate API key
     */
    private generateApiKey;
    /**
     * Generate API key ID
     */
    private generateApiKeyId;
    /**
     * Create initial usage statistics
     */
    private createInitialUsageStats;
    /**
     * Calculate average response time
     */
    private calculateAverageResponseTime;
    /**
     * Helper methods (in production, these would use Redis and database)
     */
    private storeApiKey;
    private findApiKeyByKey;
    private findApiKeysByUserId;
    private updateLastUsed;
    private updateApiKeyStatus;
    private updateApiKeyScopes;
    private updateApiKeyUsageStats;
    private getRateLimitCount;
    private getConcurrentCount;
    private incrementRateLimitCount;
    private incrementConcurrentCount;
}
//# sourceMappingURL=api-key-manager.d.ts.map