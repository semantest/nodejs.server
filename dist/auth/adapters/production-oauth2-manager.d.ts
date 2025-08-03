/**
 * @fileoverview Production OAuth2 manager with real HTTP requests
 * @description Handles OAuth2 flows with multiple providers using actual HTTP calls
 * @author Semantest Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { OAuth2Provider, OAuth2UserInfo } from '../domain/auth-entities';
/**
 * Production OAuth2 manager with real HTTP requests
 */
export declare class ProductionOAuth2Manager extends Adapter {
    private readonly providers;
    private readonly httpTimeout;
    private readonly retryAttempts;
    constructor();
    /**
     * Generate secure state parameter for OAuth2 flow
     */
    generateState(): string;
    /**
     * Validate state parameter
     */
    validateState(state: string): boolean;
    /**
     * Get authorization URL for provider
     */
    getAuthorizationUrl(provider: string, state: string, scopes?: string[], additionalParams?: Record<string, string>): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(provider: string, code: string, state: string, redirectUri?: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope: string;
    }>;
    /**
     * Refresh access token
     */
    refreshToken(provider: string, refreshToken: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope: string;
    }>;
    /**
     * Get user info from provider
     */
    getUserInfo(provider: string, accessToken: string): Promise<OAuth2UserInfo>;
    /**
     * Revoke token
     */
    revokeToken(provider: string, token: string): Promise<void>;
    /**
     * Get available providers
     */
    getAvailableProviders(): string[];
    /**
     * Get provider configuration (without secrets)
     */
    getProviderConfig(provider: string): Partial<OAuth2Provider> | null;
    /**
     * Validate provider configuration
     */
    private validateProviderConfig;
    /**
     * Initialize OAuth2 providers
     */
    private initializeProviders;
    /**
     * Make HTTP request with retry logic
     */
    private makeHttpRequest;
    /**
     * Make token request with proper error handling
     */
    private makeTokenRequest;
    /**
     * Make user info request with proper error handling
     */
    private makeUserInfoRequest;
    /**
     * Make revoke request with proper error handling
     */
    private makeRevokeRequest;
    /**
     * Get revoke URL for provider
     */
    private getRevokeUrl;
    /**
     * Normalize user info from different providers
     */
    private normalizeUserInfo;
    /**
     * Get additional user data from provider (like email for GitHub)
     */
    getAdditionalUserData(provider: string, accessToken: string): Promise<any>;
    /**
     * Validate OAuth2 callback parameters
     */
    validateCallback(params: {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
    }): {
        isValid: boolean;
        error?: string;
    };
    /**
     * Cleanup expired OAuth2 data (to be called periodically)
     */
    cleanupExpiredData(): Promise<void>;
}
//# sourceMappingURL=production-oauth2-manager.d.ts.map