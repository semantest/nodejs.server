/**
 * @fileoverview JWT-based authentication service with refresh tokens
 * @description Handles authentication, authorization, and API key management
 * @author Web-Buddy Team
 */

import { Application, Enable, listen } from '../stubs/typescript-eda-stubs';
import { AuthenticationRequestedEvent, AuthorizationRequestedEvent, TokenRefreshRequestedEvent } from '../core/events/auth-events';
import { JwtTokenManager } from './adapters/jwt-token-manager';
import { ApiKeyManager } from './adapters/api-key-manager';
import { PasswordHashManager } from './adapters/password-hash-manager';
import { RoleBasedAccessControl } from './adapters/rbac-manager';
import { OAuth2Manager } from './adapters/oauth2-manager';
import { User, AuthToken, ApiKey, Role } from './domain/auth-entities';

/**
 * Authentication service that handles all authentication and authorization
 * Uses JWT tokens with refresh token rotation for security
 */
@Enable(JwtTokenManager)
@Enable(ApiKeyManager)
@Enable(PasswordHashManager)
@Enable(RoleBasedAccessControl)
@Enable(OAuth2Manager)
export class AuthService extends Application {
  public readonly metadata = new Map([
    ['name', 'Web-Buddy Authentication Service'],
    ['version', '1.0.0'],
    ['capabilities', 'jwt-auth,api-keys,oauth2,rbac'],
    ['tokenExpiry', '15m'], // Access token expiry
    ['refreshTokenExpiry', '7d'] // Refresh token expiry
  ]);

  private jwtManager!: JwtTokenManager;
  private apiKeyManager!: ApiKeyManager;
  private passwordHashManager!: PasswordHashManager;
  private rbacManager!: RoleBasedAccessControl;
  private oauth2Manager!: OAuth2Manager;

  constructor() {
    super();
    this.jwtManager = new JwtTokenManager();
    this.apiKeyManager = new ApiKeyManager();
    this.passwordHashManager = new PasswordHashManager();
    this.rbacManager = new RoleBasedAccessControl();
    this.oauth2Manager = new OAuth2Manager();
  }

  /**
   * Handle authentication requests with credentials
   */
  @listen(AuthenticationRequestedEvent)
  public async handleAuthentication(event: AuthenticationRequestedEvent): Promise<void> {
    try {
      const { credentials, authMethod } = event;
      
      switch (authMethod) {
        case 'password':
          await this.authenticateWithPassword(credentials);
          break;
        case 'apiKey':
          await this.authenticateWithApiKey(credentials);
          break;
        case 'oauth2':
          await this.authenticateWithOAuth2(credentials);
          break;
        default:
          throw new Error(`Unsupported authentication method: ${authMethod}`);
      }
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Handle authorization requests for protected resources
   */
  @listen(AuthorizationRequestedEvent)
  public async handleAuthorization(event: AuthorizationRequestedEvent): Promise<void> {
    try {
      const { token, requiredPermissions, resourceId } = event;
      
      // Validate token
      const tokenPayload = await this.jwtManager.validateToken(token);
      
      // Check permissions
      const hasPermission = await this.rbacManager.checkPermissions(
        tokenPayload.userId,
        requiredPermissions,
        resourceId
      );
      
      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }
      
      console.log(`✅ Authorization granted for user ${tokenPayload.userId}`);
      
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      throw error;
    }
  }

  /**
   * Handle token refresh requests
   */
  @listen(TokenRefreshRequestedEvent)
  public async handleTokenRefresh(event: TokenRefreshRequestedEvent): Promise<void> {
    try {
      const { refreshToken } = event;
      
      // Validate refresh token
      const tokenPayload = await this.jwtManager.validateRefreshToken(refreshToken);
      
      // Generate new access token
      const newAccessToken = await this.jwtManager.generateAccessToken(tokenPayload.userId);
      
      // Rotate refresh token for security
      const newRefreshToken = await this.jwtManager.generateRefreshToken(tokenPayload.userId);
      
      // Invalidate old refresh token
      await this.jwtManager.invalidateRefreshToken(refreshToken);
      
      console.log(`✅ Token refreshed for user ${tokenPayload.userId}`);
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with password
   */
  private async authenticateWithPassword(credentials: any): Promise<AuthToken> {
    const { email, password } = credentials;
    
    // Find user by email
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify password
    const isPasswordValid = await this.passwordHashManager.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is disabled');
    }
    
    // Generate tokens
    const accessToken = await this.jwtManager.generateAccessToken(user.id);
    const refreshToken = await this.jwtManager.generateRefreshToken(user.id);
    
    console.log(`✅ User ${user.email} authenticated successfully`);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  /**
   * Authenticate request with API key
   */
  private async authenticateWithApiKey(credentials: any): Promise<void> {
    const { apiKey } = credentials;
    
    // Validate API key
    const keyInfo = await this.apiKeyManager.validateApiKey(apiKey);
    if (!keyInfo) {
      throw new Error('Invalid API key');
    }
    
    // Check if key is active
    if (!keyInfo.isActive) {
      throw new Error('API key is disabled');
    }
    
    // Check rate limits
    await this.apiKeyManager.checkRateLimit(apiKey);
    
    console.log(`✅ API key authenticated: ${keyInfo.name}`);
  }

  /**
   * Authenticate with OAuth2 provider
   */
  private async authenticateWithOAuth2(credentials: any): Promise<AuthToken> {
    const { provider, code, redirectUri } = credentials;
    
    // Exchange code for access token
    const providerToken = await this.oauth2Manager.exchangeCodeForToken(provider, code, redirectUri);
    
    // Get user info from provider
    const providerUser = await this.oauth2Manager.getUserInfo(provider, providerToken.access_token);
    
    // Find or create user
    const user = await this.findOrCreateOAuthUser(provider, providerUser);
    
    // Generate our own tokens
    const accessToken = await this.jwtManager.generateAccessToken(user.id);
    const refreshToken = await this.jwtManager.generateRefreshToken(user.id);
    
    console.log(`✅ OAuth2 user ${user.email} authenticated via ${provider}`);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  /**
   * Create new user account
   */
  public async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roles?: string[];
  }): Promise<User> {
    // Hash password
    const passwordHash = await this.passwordHashManager.hashPassword(userData.password);
    
    // Create user
    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      roles: userData.roles || ['user'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save user (in real implementation, this would use a database)
    await this.saveUser(user);
    
    console.log(`✅ User created: ${user.email}`);
    
    return user;
  }

  /**
   * Create new API key
   */
  public async createApiKey(userId: string, keyData: {
    name: string;
    scopes: string[];
    tier: 'free' | 'premium' | 'enterprise';
    expiresAt?: Date;
  }): Promise<ApiKey> {
    return await this.apiKeyManager.createApiKey(userId, keyData);
  }

  /**
   * Revoke API key
   */
  public async revokeApiKey(apiKey: string): Promise<void> {
    await this.apiKeyManager.revokeApiKey(apiKey);
  }

  /**
   * Update user roles
   */
  public async updateUserRoles(userId: string, roles: string[]): Promise<void> {
    await this.rbacManager.updateUserRoles(userId, roles);
  }

  /**
   * Helper methods (in real implementation, these would use a database)
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    // Mock implementation
    return null;
  }

  private async findOrCreateOAuthUser(provider: string, providerUser: any): Promise<User> {
    // Mock implementation
    return {
      id: this.generateUserId(),
      email: providerUser.email,
      passwordHash: '',
      firstName: providerUser.given_name || '',
      lastName: providerUser.family_name || '',
      roles: ['user'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async saveUser(user: User): Promise<void> {
    // Mock implementation
    console.log(`💾 Saving user: ${user.email}`);
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}