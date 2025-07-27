/**
 * Tests for OAuth2Manager
 * Created to improve coverage from 2.15%
 */

import { OAuth2Manager } from '../oauth2-manager';
import { OAuth2Provider } from '../../domain/auth-entities';

describe('OAuth2Manager', () => {
  let oauth2Manager: OAuth2Manager;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback/google',
      GITHUB_CLIENT_ID: 'github-client-id',
      GITHUB_CLIENT_SECRET: 'github-client-secret',
      GITHUB_REDIRECT_URI: 'http://localhost:3000/auth/callback/github',
      MICROSOFT_CLIENT_ID: 'microsoft-client-id',
      MICROSOFT_CLIENT_SECRET: 'microsoft-client-secret',
      MICROSOFT_REDIRECT_URI: 'http://localhost:3000/auth/callback/microsoft'
    };
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    oauth2Manager = new OAuth2Manager();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize providers with environment variables', () => {
      expect(oauth2Manager).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith('🔧 Initialized 3 OAuth2 providers');
    });

    it('should initialize without providers when environment variables are not set', () => {
      process.env = {};
      const emptyOAuth2Manager = new OAuth2Manager();
      expect(emptyOAuth2Manager).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith('🔧 Initialized 0 OAuth2 providers');
    });

    it('should initialize only configured providers', () => {
      process.env = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret'
      };
      const partialOAuth2Manager = new OAuth2Manager();
      expect(partialOAuth2Manager).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith('🔧 Initialized 1 OAuth2 providers');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL for Google', () => {
      const state = 'test-state-123';
      const url = oauth2Manager.getAuthorizationUrl('google', state);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=google-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fgoogle');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('state=test-state-123');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('should generate authorization URL with custom scopes', () => {
      const state = 'test-state-123';
      const customScopes = ['read:user', 'write:user'];
      const url = oauth2Manager.getAuthorizationUrl('github', state, customScopes);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('scope=read%3Auser+write%3Auser');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        oauth2Manager.getAuthorizationUrl('unknown', 'state');
      }).toThrow('OAuth2 provider not configured: unknown');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token successfully', async () => {
      const code = 'auth-code-123';
      const redirectUri = 'http://localhost:3000/auth/callback/google';

      const result = await oauth2Manager.exchangeCodeForToken('google', code, redirectUri);

      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('🔐 OAuth2 token exchange successful for google');
    });

    it('should handle token exchange errors', async () => {
      const code = 'auth-code-123';
      const redirectUri = 'http://localhost:3000/auth/callback/google';

      // Mock the makeTokenRequest to throw an error
      (oauth2Manager as any).makeTokenRequest = jest.fn().mockRejectedValue(new Error('Token exchange failed'));

      await expect(oauth2Manager.exchangeCodeForToken('google', code, redirectUri))
        .rejects.toThrow('Token exchange failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ OAuth2 token exchange failed for google:', expect.any(Error));
    });

    it('should throw error for unknown provider', async () => {
      await expect(oauth2Manager.exchangeCodeForToken('unknown', 'code', 'uri'))
        .rejects.toThrow('OAuth2 provider not configured: unknown');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh-token-123';

      const result = await oauth2Manager.refreshToken('google', refreshToken);

      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('🔄 OAuth2 token refresh successful for google');
    });

    it('should handle token refresh errors', async () => {
      const refreshToken = 'refresh-token-123';

      // Mock the makeTokenRequest to throw an error
      (oauth2Manager as any).makeTokenRequest = jest.fn().mockRejectedValue(new Error('Token refresh failed'));

      await expect(oauth2Manager.refreshToken('google', refreshToken))
        .rejects.toThrow('Token refresh failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ OAuth2 token refresh failed for google:', expect.any(Error));
    });

    it('should throw error for unknown provider', async () => {
      await expect(oauth2Manager.refreshToken('unknown', 'token'))
        .rejects.toThrow('OAuth2 provider not configured: unknown');
    });
  });

  describe('getUserInfo', () => {
    it('should get user info for Google', async () => {
      const accessToken = 'access-token-123';

      const result = await oauth2Manager.getUserInfo('google', accessToken);

      expect(result).toEqual({
        id: 'mock_user_id',
        email: 'user@example.com',
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/avatar.jpg',
        locale: 'en',
        verified_email: true
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('👤 OAuth2 user info retrieved for google');
    });

    it('should normalize GitHub user info', async () => {
      const accessToken = 'access-token-123';
      
      // Mock the makeUserInfoRequest to return GitHub-style data
      (oauth2Manager as any).makeUserInfoRequest = jest.fn().mockResolvedValue({
        id: 12345,
        email: 'github@example.com',
        login: 'githubuser',
        name: 'GitHub User',
        avatar_url: 'https://github.com/avatar.jpg'
      });

      const result = await oauth2Manager.getUserInfo('github', accessToken);

      expect(result).toEqual({
        id: '12345',
        email: 'github@example.com',
        name: 'GitHub User',
        given_name: 'GitHub',
        family_name: 'User',
        picture: 'https://github.com/avatar.jpg',
        locale: 'en',
        verified_email: true
      });
    });

    it('should normalize Microsoft user info', async () => {
      const accessToken = 'access-token-123';
      
      // Mock the makeUserInfoRequest to return Microsoft-style data
      (oauth2Manager as any).makeUserInfoRequest = jest.fn().mockResolvedValue({
        id: 'ms-user-id',
        mail: 'microsoft@example.com',
        displayName: 'Microsoft User',
        givenName: 'Microsoft',
        surname: 'User',
        photo: 'https://microsoft.com/photo.jpg',
        preferredLanguage: 'en-US'
      });

      const result = await oauth2Manager.getUserInfo('microsoft', accessToken);

      expect(result).toEqual({
        id: 'ms-user-id',
        email: 'microsoft@example.com',
        name: 'Microsoft User',
        given_name: 'Microsoft',
        family_name: 'User',
        picture: 'https://microsoft.com/photo.jpg',
        locale: 'en-US',
        verified_email: true
      });
    });

    it('should handle user info errors', async () => {
      const accessToken = 'access-token-123';

      // Mock the makeUserInfoRequest to throw an error
      (oauth2Manager as any).makeUserInfoRequest = jest.fn().mockRejectedValue(new Error('User info failed'));

      await expect(oauth2Manager.getUserInfo('google', accessToken))
        .rejects.toThrow('User info failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ OAuth2 user info failed for google:', expect.any(Error));
    });

    it('should throw error for unknown provider', async () => {
      await expect(oauth2Manager.getUserInfo('unknown', 'token'))
        .rejects.toThrow('OAuth2 provider not configured: unknown');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token for Google', async () => {
      const token = 'token-to-revoke';

      await oauth2Manager.revokeToken('google', token);

      expect(consoleLogSpy).toHaveBeenCalledWith('🗑️ OAuth2 token revoked for google');
    });

    it('should handle providers without revocation support', async () => {
      const token = 'token-to-revoke';

      await oauth2Manager.revokeToken('github', token);

      expect(consoleLogSpy).toHaveBeenCalledWith('ℹ️ Token revocation not supported for github');
    });

    it('should handle revocation errors', async () => {
      const token = 'token-to-revoke';

      // Mock the makeRevokeRequest to throw an error
      (oauth2Manager as any).makeRevokeRequest = jest.fn().mockRejectedValue(new Error('Revocation failed'));

      await expect(oauth2Manager.revokeToken('google', token))
        .rejects.toThrow('Revocation failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ OAuth2 token revocation failed for google:', expect.any(Error));
    });

    it('should throw error for unknown provider', async () => {
      await expect(oauth2Manager.revokeToken('unknown', 'token'))
        .rejects.toThrow('OAuth2 provider not configured: unknown');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all active providers', () => {
      const providers = oauth2Manager.getAvailableProviders();

      expect(providers).toEqual(['google', 'github', 'microsoft']);
    });

    it('should filter out inactive providers', () => {
      // Mock a provider as inactive
      const providersMap = (oauth2Manager as any).providers;
      const googleProvider = providersMap.get('google');
      googleProvider.isActive = false;
      providersMap.set('google', googleProvider);

      const providers = oauth2Manager.getAvailableProviders();

      expect(providers).toEqual(['github', 'microsoft']);
    });

    it('should return empty array when no providers are configured', () => {
      process.env = {};
      const emptyOAuth2Manager = new OAuth2Manager();
      
      const providers = emptyOAuth2Manager.getAvailableProviders();

      expect(providers).toEqual([]);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider config without secrets', () => {
      const config = oauth2Manager.getProviderConfig('google');

      expect(config).toEqual({
        id: 'google',
        name: 'google',
        displayName: 'Google',
        scopes: ['openid', 'email', 'profile'],
        isActive: true
      });
      // Should not include clientId, clientSecret, or URLs
      expect(config).not.toHaveProperty('clientId');
      expect(config).not.toHaveProperty('clientSecret');
      expect(config).not.toHaveProperty('tokenUrl');
    });

    it('should return null for unknown provider', () => {
      const config = oauth2Manager.getProviderConfig('unknown');

      expect(config).toBeNull();
    });
  });

  describe('private helper methods', () => {
    it('should handle GitHub user without name', async () => {
      const accessToken = 'access-token-123';
      
      // Mock the makeUserInfoRequest to return GitHub user with only login
      (oauth2Manager as any).makeUserInfoRequest = jest.fn().mockResolvedValue({
        id: 12345,
        email: 'github@example.com',
        login: 'githubuser',
        name: null,
        avatar_url: 'https://github.com/avatar.jpg'
      });

      const result = await oauth2Manager.getUserInfo('github', accessToken);

      expect(result.name).toBe('githubuser');
      expect(result.given_name).toBe('');
      expect(result.family_name).toBe('');
    });

    it('should handle Microsoft user with userPrincipalName', async () => {
      const accessToken = 'access-token-123';
      
      // Mock the makeUserInfoRequest to return Microsoft user without mail
      (oauth2Manager as any).makeUserInfoRequest = jest.fn().mockResolvedValue({
        id: 'ms-user-id',
        userPrincipalName: 'user@microsoft.com',
        displayName: 'Microsoft User',
        givenName: 'Microsoft',
        surname: 'User'
      });

      const result = await oauth2Manager.getUserInfo('microsoft', accessToken);

      expect(result.email).toBe('user@microsoft.com');
    });

    it('should handle unknown provider normalization', async () => {
      // Add a custom provider
      const providersMap = (oauth2Manager as any).providers;
      providersMap.set('custom', {
        id: 'custom',
        name: 'custom',
        displayName: 'Custom',
        clientId: 'custom-id',
        clientSecret: 'custom-secret',
        authorizationUrl: 'https://custom.com/auth',
        tokenUrl: 'https://custom.com/token',
        userInfoUrl: 'https://custom.com/userinfo',
        scopes: ['email'],
        redirectUri: 'http://localhost:3000/auth/callback/custom',
        isActive: true
      });

      const accessToken = 'access-token-123';
      const result = await oauth2Manager.getUserInfo('custom', accessToken);

      expect(result).toEqual({
        id: 'mock_user_id',
        email: 'user@example.com',
        name: 'John Doe',
        verified_email: true
      });
    });
  });
});