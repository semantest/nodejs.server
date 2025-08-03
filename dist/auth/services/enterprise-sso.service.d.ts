/**
 * @fileoverview Enterprise SSO service for SAML, OIDC, and LDAP integration
 * @description Handles Single Sign-On authentication for enterprise organizations
 * @author Web-Buddy Team
 */
import { SSOConfiguration, SSOProviderConfig, AttributeMappings, EnterpriseUser } from '../domain/enterprise-entities';
/**
 * Enterprise SSO service with multiple provider support
 */
export declare class EnterpriseSSOService {
    private ssoConfigurations;
    private activeSessions;
    /**
     * Create SSO configuration for organization
     */
    createSSOConfiguration(data: {
        organizationId: string;
        provider: 'saml' | 'oidc' | 'oauth2' | 'ldap';
        name: string;
        displayName: string;
        config: SSOProviderConfig;
        mappings: AttributeMappings;
    }): Promise<SSOConfiguration>;
    /**
     * Update SSO configuration
     */
    updateSSOConfiguration(configId: string, updates: Partial<Pick<SSOConfiguration, 'displayName' | 'config' | 'mappings' | 'isActive'>>): Promise<SSOConfiguration>;
    /**
     * Get SSO configurations for organization
     */
    getOrganizationSSOConfigurations(organizationId: string): Promise<SSOConfiguration[]>;
    /**
     * Initiate SSO login
     */
    initiateSSOLogin(configId: string, redirectUrl?: string): Promise<{
        authUrl: string;
        sessionId: string;
    }>;
    /**
     * Handle SSO callback
     */
    handleSSOCallback(data: {
        sessionId: string;
        code?: string;
        samlResponse?: string;
        state?: string;
    }): Promise<{
        user: EnterpriseUser;
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Validate SSO configuration
     */
    private validateSSOConfiguration;
    /**
     * Generate authentication URL
     */
    private generateAuthUrl;
    /**
     * Generate SAML authentication URL
     */
    private generateSAMLAuthUrl;
    /**
     * Generate OIDC authentication URL
     */
    private generateOIDCAuthUrl;
    /**
     * Exchange code/response for user info
     */
    private exchangeForUserInfo;
    /**
     * Parse SAML response
     */
    private parseSAMLResponse;
    /**
     * Exchange OIDC code for user info
     */
    private exchangeOIDCCode;
    /**
     * Map SSO attributes to user
     */
    private mapAttributesToUser;
    /**
     * Helper methods
     */
    private generateConfigId;
    private generateSessionId;
    private generateState;
    private generateNonce;
    private getCallbackUrl;
    private buildSAMLRequest;
    private makeTokenRequest;
    private makeUserInfoRequest;
    private findUserByEmail;
    private createSSOUser;
    private updateSSOUser;
    private generateAccessToken;
    private generateRefreshToken;
}
//# sourceMappingURL=enterprise-sso.service.d.ts.map