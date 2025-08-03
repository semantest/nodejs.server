/**
 * @fileoverview Production authentication service with complete integration
 * @description Main auth service that coordinates all authentication components
 * @author Semantest Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { AuthenticationRequestedEvent, AuthorizationRequestedEvent, TokenRefreshRequestedEvent } from '../core/events/auth-events';
import { User, AuthToken, ApiKey, AuthContext } from './domain/auth-entities';
/**
 * Production authentication service with comprehensive security features
 */
export declare class ProductionAuthService extends Application {
    readonly metadata: Map<string, string>;
    private jwtManager;
    private apiKeyManager;
    private oauth2Manager;
    private rbacManager;
    private passwordHashManager;
    /**
     * Handle authentication requests
     */
    handleAuthentication(event: AuthenticationRequestedEvent): Promise<AuthToken>;
    /**
     * Handle authorization requests
     */
    handleAuthorization(event: AuthorizationRequestedEvent): Promise<AuthContext>;
    /**
     * Handle token refresh requests
     */
    handleTokenRefresh(event: TokenRefreshRequestedEvent): Promise<AuthToken>;
    /**
     * Create new user account
     */
    createUser(userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        roles?: string[];
        metadata?: Record<string, any>;
    }): Promise<User>;
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
     * Logout user and invalidate session
     */
    logout(accessToken: string, metadata?: any): Promise<void>;
    /**
     * Get user profile
     */
    getUserProfile(userId: string): Promise<Partial<User>>;
    /**
     * Update user profile
     */
    updateUserProfile(userId: string, updates: {
        firstName?: string;
        lastName?: string;
        metadata?: Record<string, any>;
    }): Promise<User>;
    /**
     * Change user password
     */
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    /**
     * API Key management methods
     */
    createApiKey(userId: string, keyData: {
        name: string;
        scopes: string[];
        tier: 'free' | 'premium' | 'enterprise';
        expiresAt?: Date;
        description?: string;
    }): Promise<ApiKey>;
    revokeApiKey(apiKey: string): Promise<void>;
    listUserApiKeys(userId: string): Promise<ApiKey[]>;
    /**
     * Session management
     */
    getUserSessions(userId: string): Promise<any[]>;
    invalidateSession(sessionId: string): Promise<void>;
    invalidateAllUserSessions(userId: string): Promise<void>;
    /**
     * Security utilities
     */
    private validatePasswordStrength;
    private generateUserId;
    private generateSessionId;
    private getUserIdFromToken;
    /**
     * Helper methods (in production, these would use actual database)
     */
    private findUserByEmail;
    private getUserById;
    private saveUser;
    private updateLastLogin;
    private createSession;
    private findOrCreateOAuthUser;
    private checkAccountLockout;
    private recordFailedAttempt;
    private clearFailedAttempts;
    private auditLog;
    /**
     * Periodic cleanup tasks
     */
    performCleanup(): Promise<void>;
}
//# sourceMappingURL=production-auth-service.d.ts.map