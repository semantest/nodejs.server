/**
 * @fileoverview JWT-based authentication service with refresh tokens
 * @description Handles authentication, authorization, and API key management
 * @author Web-Buddy Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { AuthenticationRequestedEvent, AuthorizationRequestedEvent, TokenRefreshRequestedEvent } from '../core/events/auth-events';
import { User, ApiKey } from './domain/auth-entities';
/**
 * Authentication service that handles all authentication and authorization
 * Uses JWT tokens with refresh token rotation for security
 */
export declare class AuthService extends Application {
    readonly metadata: Map<string, string>;
    private jwtManager;
    private apiKeyManager;
    private passwordHashManager;
    private rbacManager;
    private oauth2Manager;
    constructor();
    /**
     * Handle authentication requests with credentials
     */
    handleAuthentication(event: AuthenticationRequestedEvent): Promise<void>;
    /**
     * Handle authorization requests for protected resources
     */
    handleAuthorization(event: AuthorizationRequestedEvent): Promise<void>;
    /**
     * Handle token refresh requests
     */
    handleTokenRefresh(event: TokenRefreshRequestedEvent): Promise<void>;
    /**
     * Authenticate user with password
     */
    private authenticateWithPassword;
    /**
     * Authenticate request with API key
     */
    private authenticateWithApiKey;
    /**
     * Authenticate with OAuth2 provider
     */
    private authenticateWithOAuth2;
    /**
     * Create new user account
     */
    createUser(userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        roles?: string[];
    }): Promise<User>;
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
     * Revoke API key
     */
    revokeApiKey(apiKey: string): Promise<void>;
    /**
     * Update user roles
     */
    updateUserRoles(userId: string, roles: string[]): Promise<void>;
    /**
     * Helper methods (in real implementation, these would use a database)
     */
    private findUserByEmail;
    private findOrCreateOAuthUser;
    private saveUser;
    private generateUserId;
}
//# sourceMappingURL=auth-service.d.ts.map