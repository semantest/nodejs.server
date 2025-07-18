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
export class OAuth2Manager extends Adapter {
  private readonly providers: Map<string, OAuth2Provider>;

  constructor() {
    super();
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Get authorization URL for provider
   */
  public getAuthorizationUrl(provider: string, state: string, scopes?: string[]): string {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    const scopeString = scopes ? scopes.join(' ') : providerConfig.scopes.join(' ');
    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: providerConfig.redirectUri,
      response_type: 'code',
      scope: scopeString,
      state,
      access_type: 'offline', // For refresh tokens
      prompt: 'consent'
    });

    return `${providerConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(provider: string, code: string, redirectUri: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    const tokenData = {
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    try {
      const response = await this.makeTokenRequest(providerConfig.tokenUrl, tokenData);
      console.log(`🔐 OAuth2 token exchange successful for ${provider}`);
      return response;
    } catch (error) {
      console.error(`❌ OAuth2 token exchange failed for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  public async refreshToken(provider: string, refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    const tokenData = {
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    try {
      const response = await this.makeTokenRequest(providerConfig.tokenUrl, tokenData);
      console.log(`🔄 OAuth2 token refresh successful for ${provider}`);
      return response;
    } catch (error) {
      console.error(`❌ OAuth2 token refresh failed for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get user info from provider
   */
  public async getUserInfo(provider: string, accessToken: string): Promise<OAuth2UserInfo> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    try {
      const response = await this.makeUserInfoRequest(providerConfig.userInfoUrl, accessToken);
      console.log(`👤 OAuth2 user info retrieved for ${provider}`);
      return this.normalizeUserInfo(provider, response);
    } catch (error) {
      console.error(`❌ OAuth2 user info failed for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Revoke token
   */
  public async revokeToken(provider: string, token: string): Promise<void> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    // Not all providers support token revocation
    const revokeUrl = this.getRevokeUrl(provider);
    if (!revokeUrl) {
      console.log(`ℹ️ Token revocation not supported for ${provider}`);
      return;
    }

    try {
      await this.makeRevokeRequest(revokeUrl, token);
      console.log(`🗑️ OAuth2 token revoked for ${provider}`);
    } catch (error) {
      console.error(`❌ OAuth2 token revocation failed for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get available providers
   */
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter(
      provider => this.providers.get(provider)?.isActive
    );
  }

  /**
   * Get provider configuration (without secrets)
   */
  public getProviderConfig(provider: string): Partial<OAuth2Provider> | null {
    const config = this.providers.get(provider);
    if (!config) {
      return null;
    }

    return {
      id: config.id,
      name: config.name,
      displayName: config.displayName,
      scopes: config.scopes,
      isActive: config.isActive
    };
  }

  /**
   * Initialize OAuth2 providers
   */
  private initializeProviders(): void {
    // Google OAuth2
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.providers.set('google', {
        id: 'google',
        name: 'google',
        displayName: 'Google',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3003/auth/callback/google',
        isActive: true
      });
    }

    // GitHub OAuth2
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.providers.set('github', {
        id: 'github',
        name: 'github',
        displayName: 'GitHub',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email'],
        redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3003/auth/callback/github',
        isActive: true
      });
    }

    // Microsoft OAuth2
    if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
      this.providers.set('microsoft', {
        id: 'microsoft',
        name: 'microsoft',
        displayName: 'Microsoft',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3003/auth/callback/microsoft',
        isActive: true
      });
    }

    console.log(`🔧 Initialized ${this.providers.size} OAuth2 providers`);
  }

  /**
   * Make token request
   */
  private async makeTokenRequest(tokenUrl: string, data: any): Promise<any> {
    // Mock implementation - in production, use fetch or axios
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile'
        });
      }, 100);
    });
  }

  /**
   * Make user info request
   */
  private async makeUserInfoRequest(userInfoUrl: string, accessToken: string): Promise<any> {
    // Mock implementation - in production, use fetch or axios
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: 'mock_user_id',
          email: 'user@example.com',
          name: 'John Doe',
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://example.com/avatar.jpg',
          locale: 'en',
          verified_email: true
        });
      }, 100);
    });
  }

  /**
   * Make revoke request
   */
  private async makeRevokeRequest(revokeUrl: string, token: string): Promise<void> {
    // Mock implementation - in production, use fetch or axios
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  }

  /**
   * Get revoke URL for provider
   */
  private getRevokeUrl(provider: string): string | null {
    const revokeUrls: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/revoke',
      github: null, // GitHub doesn't support token revocation
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
    };

    return revokeUrls[provider] || null;
  }

  /**
   * Normalize user info from different providers
   */
  private normalizeUserInfo(provider: string, rawUserInfo: any): OAuth2UserInfo {
    switch (provider) {
      case 'google':
        return {
          id: rawUserInfo.id,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          given_name: rawUserInfo.given_name,
          family_name: rawUserInfo.family_name,
          picture: rawUserInfo.picture,
          locale: rawUserInfo.locale,
          verified_email: rawUserInfo.verified_email
        };

      case 'github':
        return {
          id: rawUserInfo.id.toString(),
          email: rawUserInfo.email,
          name: rawUserInfo.name || rawUserInfo.login,
          given_name: rawUserInfo.name?.split(' ')[0] || '',
          family_name: rawUserInfo.name?.split(' ').slice(1).join(' ') || '',
          picture: rawUserInfo.avatar_url,
          locale: 'en',
          verified_email: true
        };

      case 'microsoft':
        return {
          id: rawUserInfo.id,
          email: rawUserInfo.mail || rawUserInfo.userPrincipalName,
          name: rawUserInfo.displayName,
          given_name: rawUserInfo.givenName,
          family_name: rawUserInfo.surname,
          picture: rawUserInfo.photo,
          locale: rawUserInfo.preferredLanguage,
          verified_email: true
        };

      default:
        return {
          id: rawUserInfo.id,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          verified_email: rawUserInfo.verified_email || false
        };
    }
  }
}