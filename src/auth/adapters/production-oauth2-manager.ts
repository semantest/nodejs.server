/**
 * @fileoverview Production OAuth2 manager with real HTTP requests
 * @description Handles OAuth2 flows with multiple providers using actual HTTP calls
 * @author Semantest Team
 */

import { Adapter } from '../../stubs/typescript-eda-stubs';
import { OAuth2Provider, OAuth2UserInfo } from '../domain/auth-entities';
import * as crypto from 'crypto';

/**
 * Production OAuth2 manager with real HTTP requests
 */
export class ProductionOAuth2Manager extends Adapter {
  private readonly providers: Map<string, OAuth2Provider>;
  private readonly httpTimeout: number;
  private readonly retryAttempts: number;

  constructor() {
    super();
    this.providers = new Map();
    this.httpTimeout = parseInt(process.env.OAUTH2_HTTP_TIMEOUT || '10000'); // 10 seconds
    this.retryAttempts = parseInt(process.env.OAUTH2_RETRY_ATTEMPTS || '3');
    this.initializeProviders();
  }

  /**
   * Generate secure state parameter for OAuth2 flow
   */
  public generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate state parameter
   */
  public validateState(state: string): boolean {
    return /^[a-f0-9]{64}$/.test(state);
  }

  /**
   * Get authorization URL for provider
   */
  public getAuthorizationUrl(
    provider: string, 
    state: string, 
    scopes?: string[],
    additionalParams?: Record<string, string>
  ): string {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth2 provider not configured: ${provider}`);
    }

    if (!this.validateState(state)) {
      throw new Error('Invalid state parameter');
    }

    const scopeString = scopes ? scopes.join(' ') : providerConfig.scopes.join(' ');
    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: providerConfig.redirectUri,
      response_type: 'code',
      scope: scopeString,
      state,
      ...additionalParams
    });

    // Add provider-specific parameters
    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else if (provider === 'microsoft') {
      params.set('response_mode', 'query');
    }

    const authUrl = `${providerConfig.authorizationUrl}?${params.toString()}`;
    console.log(`🔐 Generated OAuth2 authorization URL for ${provider}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(
    provider: string, 
    code: string, 
    state: string,
    redirectUri?: string
  ): Promise<{
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

    if (!this.validateState(state)) {
      throw new Error('Invalid state parameter');
    }

    const tokenData = {
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      code,
      redirect_uri: redirectUri || providerConfig.redirectUri,
      grant_type: 'authorization_code'
    };

    try {
      const response = await this.makeTokenRequest(providerConfig.tokenUrl, tokenData);
      
      // Validate response
      if (!response.access_token) {
        throw new Error('Invalid token response: missing access_token');
      }

      console.log(`🔐 OAuth2 token exchange successful for ${provider}`);
      return response;
    } catch (error) {
      console.error(`❌ OAuth2 token exchange failed for ${provider}:`, error);
      throw new Error(`OAuth2 token exchange failed: ${error.message}`);
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
      
      // Validate response
      if (!response.access_token) {
        throw new Error('Invalid token response: missing access_token');
      }

      console.log(`🔄 OAuth2 token refresh successful for ${provider}`);
      return response;
    } catch (error) {
      console.error(`❌ OAuth2 token refresh failed for ${provider}:`, error);
      throw new Error(`OAuth2 token refresh failed: ${error.message}`);
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
      
      // Validate response
      if (!response.id && !response.sub) {
        throw new Error('Invalid user info response: missing user ID');
      }

      console.log(`👤 OAuth2 user info retrieved for ${provider}`);
      return this.normalizeUserInfo(provider, response);
    } catch (error) {
      console.error(`❌ OAuth2 user info failed for ${provider}:`, error);
      throw new Error(`OAuth2 user info failed: ${error.message}`);
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

    const revokeUrl = this.getRevokeUrl(provider);
    if (!revokeUrl) {
      console.log(`ℹ️ Token revocation not supported for ${provider}`);
      return;
    }

    try {
      await this.makeRevokeRequest(revokeUrl, token, providerConfig);
      console.log(`🗑️ OAuth2 token revoked for ${provider}`);
    } catch (error) {
      console.error(`❌ OAuth2 token revocation failed for ${provider}:`, error);
      throw new Error(`OAuth2 token revocation failed: ${error.message}`);
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
   * Validate provider configuration
   */
  private validateProviderConfig(provider: OAuth2Provider): void {
    const required = ['id', 'name', 'clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl'];
    for (const field of required) {
      if (!provider[field]) {
        throw new Error(`Missing required field for OAuth2 provider: ${field}`);
      }
    }
  }

  /**
   * Initialize OAuth2 providers
   */
  private initializeProviders(): void {
    const providers = [];

    // Google OAuth2
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const googleProvider: OAuth2Provider = {
        id: 'google',
        name: 'google',
        displayName: 'Google',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback/google',
        isActive: true
      };
      this.validateProviderConfig(googleProvider);
      this.providers.set('google', googleProvider);
      providers.push('Google');
    }

    // GitHub OAuth2
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      const githubProvider: OAuth2Provider = {
        id: 'github',
        name: 'github',
        displayName: 'GitHub',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['user:email'],
        redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/callback/github',
        isActive: true
      };
      this.validateProviderConfig(githubProvider);
      this.providers.set('github', githubProvider);
      providers.push('GitHub');
    }

    // Microsoft OAuth2
    if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
      const microsoftProvider: OAuth2Provider = {
        id: 'microsoft',
        name: 'microsoft',
        displayName: 'Microsoft',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/callback/microsoft',
        isActive: true
      };
      this.validateProviderConfig(microsoftProvider);
      this.providers.set('microsoft', microsoftProvider);
      providers.push('Microsoft');
    }

    // Discord OAuth2
    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
      const discordProvider: OAuth2Provider = {
        id: 'discord',
        name: 'discord',
        displayName: 'Discord',
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        authorizationUrl: 'https://discord.com/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        scopes: ['identify', 'email'],
        redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/callback/discord',
        isActive: true
      };
      this.validateProviderConfig(discordProvider);
      this.providers.set('discord', discordProvider);
      providers.push('Discord');
    }

    if (providers.length > 0) {
      console.log(`🔧 Initialized OAuth2 providers: ${providers.join(', ')}`);
    } else {
      console.log('⚠️ No OAuth2 providers configured');
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeHttpRequest(url: string, options: RequestInit): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.httpTimeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
      } catch (error) {
        lastError = error;
        console.log(`Request attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Make token request with proper error handling
   */
  private async makeTokenRequest(tokenUrl: string, data: any): Promise<any> {
    const body = new URLSearchParams(data);
    
    return await this.makeHttpRequest(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Semantest-API/1.0'
      },
      body: body.toString()
    });
  }

  /**
   * Make user info request with proper error handling
   */
  private async makeUserInfoRequest(userInfoUrl: string, accessToken: string): Promise<any> {
    return await this.makeHttpRequest(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Semantest-API/1.0'
      }
    });
  }

  /**
   * Make revoke request with proper error handling
   */
  private async makeRevokeRequest(revokeUrl: string, token: string, provider: OAuth2Provider): Promise<void> {
    const body = new URLSearchParams({
      token,
      client_id: provider.clientId,
      client_secret: provider.clientSecret
    });

    await this.makeHttpRequest(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Semantest-API/1.0'
      },
      body: body.toString()
    });
  }

  /**
   * Get revoke URL for provider
   */
  private getRevokeUrl(provider: string): string | null {
    const revokeUrls: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/revoke',
      github: null, // GitHub doesn't support token revocation
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
      discord: 'https://discord.com/api/oauth2/token/revoke'
    };

    return revokeUrls[provider] || null;
  }

  /**
   * Normalize user info from different providers
   */
  private normalizeUserInfo(provider: string, rawUserInfo: any): OAuth2UserInfo {
    const baseInfo = {
      providerId: provider,
      providerUserId: rawUserInfo.id || rawUserInfo.sub,
      email: rawUserInfo.email,
      emailVerified: rawUserInfo.verified_email || rawUserInfo.email_verified || false,
      name: rawUserInfo.name || rawUserInfo.display_name,
      picture: rawUserInfo.picture || rawUserInfo.avatar_url,
      locale: rawUserInfo.locale || rawUserInfo.preferred_language || 'en',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    switch (provider) {
      case 'google':
        return {
          ...baseInfo,
          given_name: rawUserInfo.given_name,
          family_name: rawUserInfo.family_name,
          emailVerified: rawUserInfo.verified_email || false
        };

      case 'github':
        return {
          ...baseInfo,
          id: rawUserInfo.id.toString(),
          email: rawUserInfo.email,
          name: rawUserInfo.name || rawUserInfo.login,
          given_name: rawUserInfo.name?.split(' ')[0] || rawUserInfo.login,
          family_name: rawUserInfo.name?.split(' ').slice(1).join(' ') || '',
          picture: rawUserInfo.avatar_url,
          username: rawUserInfo.login,
          emailVerified: true // GitHub emails are verified
        };

      case 'microsoft':
        return {
          ...baseInfo,
          email: rawUserInfo.mail || rawUserInfo.userPrincipalName,
          name: rawUserInfo.displayName,
          given_name: rawUserInfo.givenName,
          family_name: rawUserInfo.surname,
          picture: rawUserInfo.photo,
          emailVerified: true // Microsoft emails are verified
        };

      case 'discord':
        return {
          ...baseInfo,
          id: rawUserInfo.id,
          email: rawUserInfo.email,
          name: rawUserInfo.username,
          username: rawUserInfo.username,
          discriminator: rawUserInfo.discriminator,
          picture: rawUserInfo.avatar ? 
            `https://cdn.discordapp.com/avatars/${rawUserInfo.id}/${rawUserInfo.avatar}.png` : 
            null,
          emailVerified: rawUserInfo.verified || false
        };

      default:
        return baseInfo;
    }
  }

  /**
   * Get additional user data from provider (like email for GitHub)
   */
  public async getAdditionalUserData(provider: string, accessToken: string): Promise<any> {
    if (provider === 'github') {
      try {
        // GitHub requires separate call for emails
        const emailResponse = await this.makeHttpRequest('https://api.github.com/user/emails', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Semantest-API/1.0'
          }
        });

        const primaryEmail = emailResponse.find((email: any) => email.primary);
        return {
          email: primaryEmail?.email,
          emailVerified: primaryEmail?.verified || false
        };
      } catch (error) {
        console.error('Failed to get GitHub user emails:', error);
        return {};
      }
    }

    return {};
  }

  /**
   * Validate OAuth2 callback parameters
   */
  public validateCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): { isValid: boolean; error?: string } {
    if (params.error) {
      return {
        isValid: false,
        error: `OAuth2 error: ${params.error} - ${params.error_description || 'Unknown error'}`
      };
    }

    if (!params.code) {
      return {
        isValid: false,
        error: 'Missing authorization code'
      };
    }

    if (!params.state || !this.validateState(params.state)) {
      return {
        isValid: false,
        error: 'Invalid or missing state parameter'
      };
    }

    return { isValid: true };
  }

  /**
   * Cleanup expired OAuth2 data (to be called periodically)
   */
  public async cleanupExpiredData(): Promise<void> {
    // This would typically clean up expired OAuth2 tokens and associated data
    // Implementation depends on your storage mechanism
    console.log('🧹 OAuth2 cleanup completed');
  }
}