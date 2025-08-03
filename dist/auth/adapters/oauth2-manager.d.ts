/**
 * @fileoverview OAuth2 manager for third-party authentication
 * @description Handles OAuth2 flows with multiple providers
 * @author Web-Buddy Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { OAuth2Provider, OAuth2UserInfo } from '../domain/auth-entities';
/**
 * OAuth2 manager for third-party authentication
 */
export declare class OAuth2Manager extends Adapter {
    private readonly providers;
    constructor();
    /**
     * Get authorization URL for provider
     */
    getAuthorizationUrl(provider: string, state: string, scopes?: string[]): string;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForToken(provider: string, code: string, redirectUri: string): Promise<{
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
     * Initialize OAuth2 providers
     */
    private initializeProviders;
    /**
     * Make token request
     */
    private makeTokenRequest;
    /**
     * Make user info request
     */
    private makeUserInfoRequest;
    /**
     * Make revoke request
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
}
//# sourceMappingURL=oauth2-manager.d.ts.map