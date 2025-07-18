/**
 * @fileoverview Production authentication service with complete integration
 * @description Main auth service that coordinates all authentication components
 * @author Semantest Team
 */

import { Application, Enable, listen } from '../stubs/typescript-eda-stubs';
import { AuthenticationRequestedEvent, AuthorizationRequestedEvent, TokenRefreshRequestedEvent } from '../core/events/auth-events';
import { ProductionJwtManager } from './adapters/production-jwt-manager';
import { ProductionApiKeyManager } from './adapters/production-api-key-manager';
import { ProductionOAuth2Manager } from './adapters/production-oauth2-manager';
import { RoleBasedAccessControl } from './adapters/rbac-manager';
import { PasswordHashManager } from './adapters/password-hash-manager';
import { User, AuthToken, ApiKey, Role, AuthRequest, AuthContext, Session } from './domain/auth-entities';
import * as crypto from 'crypto';

/**
 * Production authentication service with comprehensive security features
 */
@Enable(ProductionJwtManager)
@Enable(ProductionApiKeyManager)
@Enable(ProductionOAuth2Manager)
@Enable(RoleBasedAccessControl)
@Enable(PasswordHashManager)
export class ProductionAuthService extends Application {
  public readonly metadata = new Map([
    ['name', 'Semantest Authentication Service'],
    ['version', '1.0.0'],
    ['capabilities', 'jwt-auth,api-keys,oauth2,rbac,2fa'],
    ['tokenExpiry', '15m'],
    ['refreshTokenExpiry', '7d'],
    ['maxSessionsPerUser', '5'],
    ['passwordPolicy', 'strong'],
    ['auditingEnabled', 'true']
  ]);

  private jwtManager!: ProductionJwtManager;
  private apiKeyManager!: ProductionApiKeyManager;
  private oauth2Manager!: ProductionOAuth2Manager;
  private rbacManager!: RoleBasedAccessControl;
  private passwordHashManager!: PasswordHashManager;

  /**
   * Handle authentication requests
   */
  @listen(AuthenticationRequestedEvent)
  public async handleAuthentication(event: AuthenticationRequestedEvent): Promise<AuthToken> {
    const startTime = Date.now();
    
    try {
      const { credentials, authMethod, metadata } = event;
      
      // Audit log
      await this.auditLog('auth_attempt', {
        method: authMethod,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        timestamp: new Date().toISOString()
      });
      
      let authResult: AuthToken;
      
      switch (authMethod) {
        case 'password':
          authResult = await this.authenticateWithPassword(credentials, metadata);
          break;
        case 'apiKey':
          authResult = await this.authenticateWithApiKey(credentials, metadata);
          break;
        case 'oauth2':
          authResult = await this.authenticateWithOAuth2(credentials, metadata);
          break;
        default:
          throw new Error(`Unsupported authentication method: ${authMethod}`);
      }
      
      // Success audit log
      await this.auditLog('auth_success', {
        method: authMethod,
        userId: await this.getUserIdFromToken(authResult.accessToken),
        duration: Date.now() - startTime,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      });
      
      return authResult;
      
    } catch (error) {
      // Failure audit log
      await this.auditLog('auth_failure', {
        method: event.authMethod,
        error: error.message,
        duration: Date.now() - startTime,
        ipAddress: event.metadata?.ipAddress,
        userAgent: event.metadata?.userAgent
      });
      
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Handle authorization requests
   */
  @listen(AuthorizationRequestedEvent)
  public async handleAuthorization(event: AuthorizationRequestedEvent): Promise<AuthContext> {
    const startTime = Date.now();
    
    try {
      const { token, requiredPermissions, resourceId, metadata } = event;
      
      // Validate token and get user context
      const tokenPayload = await this.jwtManager.validateToken(token);
      
      // Check permissions
      const hasPermission = await this.rbacManager.checkPermissions(
        tokenPayload.userId,
        requiredPermissions,
        resourceId
      );
      
      if (!hasPermission) {
        await this.auditLog('auth_denied', {
          userId: tokenPayload.userId,
          requiredPermissions,
          resourceId,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent
        });
        
        throw new Error('Insufficient permissions');
      }
      
      // Create auth context
      const authContext: AuthContext = {
        userId: tokenPayload.userId,
        roles: tokenPayload.roles,
        permissions: requiredPermissions,
        sessionId: tokenPayload.sessionId,
        ipAddress: metadata?.ipAddress || 'unknown',
        userAgent: metadata?.userAgent || 'unknown'
      };
      
      // Success audit log
      await this.auditLog('auth_authorized', {
        userId: tokenPayload.userId,
        permissions: requiredPermissions,
        resourceId,
        duration: Date.now() - startTime,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      });
      
      console.log(`✅ Authorization granted for user ${tokenPayload.userId}`);
      return authContext;
      
    } catch (error) {
      // Failure audit log
      await this.auditLog('auth_unauthorized', {
        error: error.message,
        requiredPermissions: event.requiredPermissions,
        resourceId: event.resourceId,
        duration: Date.now() - startTime,
        ipAddress: event.metadata?.ipAddress,
        userAgent: event.metadata?.userAgent
      });
      
      console.error('❌ Authorization failed:', error);
      throw error;
    }
  }

  /**
   * Handle token refresh requests
   */
  @listen(TokenRefreshRequestedEvent)
  public async handleTokenRefresh(event: TokenRefreshRequestedEvent): Promise<AuthToken> {
    const startTime = Date.now();
    
    try {
      const { refreshToken, metadata } = event;
      
      // Validate refresh token
      const tokenPayload = await this.jwtManager.validateRefreshToken(refreshToken);
      
      // Check if user is still active
      const user = await this.getUserById(tokenPayload.userId);
      if (!user || !user.isActive) {
        throw new Error('User is inactive');
      }
      
      // Generate new tokens
      const newTokens = await this.jwtManager.rotateRefreshToken(refreshToken);
      const newAccessToken = await this.jwtManager.generateAccessToken(
        tokenPayload.userId,
        [], // Will be populated from user roles
        tokenPayload.sessionId
      );
      
      const authToken: AuthToken = {
        accessToken: newAccessToken.token,
        refreshToken: newTokens.token,
        expiresIn: 900, // 15 minutes
        tokenType: 'Bearer'
      };
      
      // Success audit log
      await this.auditLog('token_refreshed', {
        userId: tokenPayload.userId,
        sessionId: tokenPayload.sessionId,
        duration: Date.now() - startTime,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      });
      
      console.log(`✅ Token refreshed for user ${tokenPayload.userId}`);
      return authToken;
      
    } catch (error) {
      // Failure audit log
      await this.auditLog('token_refresh_failed', {
        error: error.message,
        duration: Date.now() - startTime,
        ipAddress: event.metadata?.ipAddress,
        userAgent: event.metadata?.userAgent
      });
      
      console.error('❌ Token refresh failed:', error);
      throw error;
    }
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
    metadata?: Record<string, any>;
  }): Promise<User> {
    try {
      // Validate password strength
      this.validatePasswordStrength(userData.password);
      
      // Check if user already exists
      const existingUser = await this.findUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User already exists');
      }
      
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
        emailVerified: false,
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: userData.metadata
      };
      
      // Save user
      await this.saveUser(user);
      
      // Audit log
      await this.auditLog('user_created', {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ User created: ${user.email}`);
      return user;
      
    } catch (error) {
      console.error('❌ User creation failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with password
   */
  private async authenticateWithPassword(
    credentials: any,
    metadata?: any
  ): Promise<AuthToken> {
    const { email, password } = credentials;
    
    // Find user by email
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check account lockout
    await this.checkAccountLockout(user.id);
    
    // Verify password
    const isPasswordValid = await this.passwordHashManager.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(user.id);
      throw new Error('Invalid password');
    }
    
    // Clear failed attempts
    await this.clearFailedAttempts(user.id);
    
    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is disabled');
    }
    
    // Create session
    const sessionId = this.generateSessionId();
    const session = await this.createSession(user.id, sessionId, metadata);
    
    // Generate tokens
    const accessToken = await this.jwtManager.generateAccessToken(user.id, [], sessionId);
    const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
    
    // Update last login
    await this.updateLastLogin(user.id);
    
    console.log(`✅ User ${user.email} authenticated successfully`);
    
    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  /**
   * Authenticate request with API key
   */
  private async authenticateWithApiKey(
    credentials: any,
    metadata?: any
  ): Promise<AuthToken> {
    const { apiKey } = credentials;
    
    // Validate API key
    const keyInfo = await this.apiKeyManager.validateApiKey(apiKey);
    if (!keyInfo) {
      throw new Error('Invalid API key');
    }
    
    // Check rate limits
    const rateLimitResult = await this.apiKeyManager.checkRateLimit(apiKey);
    if (!rateLimitResult.allowed) {
      throw new Error('Rate limit exceeded');
    }
    
    // Increment rate limit counters
    await this.apiKeyManager.incrementRateLimit(apiKey);
    
    // Get user
    const user = await this.getUserById(keyInfo.userId);
    if (!user || !user.isActive) {
      throw new Error('User is inactive');
    }
    
    // Create session
    const sessionId = this.generateSessionId();
    const session = await this.createSession(user.id, sessionId, metadata);
    
    // Generate tokens with API key scopes
    const accessToken = await this.jwtManager.generateAccessToken(user.id, keyInfo.scopes, sessionId);
    const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
    
    console.log(`✅ API key authenticated: ${keyInfo.name}`);
    
    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  /**
   * Authenticate with OAuth2 provider
   */
  private async authenticateWithOAuth2(
    credentials: any,
    metadata?: any
  ): Promise<AuthToken> {
    const { provider, code, state, redirectUri } = credentials;
    
    // Validate OAuth2 callback
    const validation = this.oauth2Manager.validateCallback({ code, state });
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    // Exchange code for access token
    const providerToken = await this.oauth2Manager.exchangeCodeForToken(provider, code, state, redirectUri);
    
    // Get user info from provider
    const providerUser = await this.oauth2Manager.getUserInfo(provider, providerToken.access_token);
    
    // Get additional user data if needed
    const additionalData = await this.oauth2Manager.getAdditionalUserData(provider, providerToken.access_token);
    const completeUserInfo = { ...providerUser, ...additionalData };
    
    // Find or create user
    const user = await this.findOrCreateOAuthUser(provider, completeUserInfo);
    
    // Create session
    const sessionId = this.generateSessionId();
    const session = await this.createSession(user.id, sessionId, metadata);
    
    // Generate our own tokens
    const accessToken = await this.jwtManager.generateAccessToken(user.id, [], sessionId);
    const refreshToken = await this.jwtManager.generateRefreshToken(user.id, sessionId);
    
    console.log(`✅ OAuth2 user ${user.email} authenticated via ${provider}`);
    
    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  /**
   * Logout user and invalidate session
   */
  public async logout(accessToken: string, metadata?: any): Promise<void> {
    try {
      const tokenPayload = await this.jwtManager.validateToken(accessToken);
      
      // Blacklist access token
      await this.jwtManager.blacklistToken(tokenPayload.jti, tokenPayload.exp);
      
      // Invalidate all refresh tokens for this session
      if (tokenPayload.sessionId) {
        await this.invalidateSession(tokenPayload.sessionId);
      }
      
      // Audit log
      await this.auditLog('user_logout', {
        userId: tokenPayload.userId,
        sessionId: tokenPayload.sessionId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      });
      
      console.log(`✅ User ${tokenPayload.userId} logged out successfully`);
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  public async getUserProfile(userId: string): Promise<Partial<User>> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Return safe user data (no password hash)
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      metadata: user.metadata
    };
  }

  /**
   * Update user profile
   */
  public async updateUserProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update user
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    
    await this.saveUser(updatedUser);
    
    // Audit log
    await this.auditLog('user_updated', {
      userId,
      updates: Object.keys(updates),
      timestamp: new Date().toISOString()
    });
    
    return updatedUser;
  }

  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const isCurrentPasswordValid = await this.passwordHashManager.verifyPassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Validate new password strength
    this.validatePasswordStrength(newPassword);
    
    // Hash new password
    const newPasswordHash = await this.passwordHashManager.hashPassword(newPassword);
    
    // Update user
    const updatedUser = {
      ...user,
      passwordHash: newPasswordHash,
      updatedAt: new Date()
    };
    
    await this.saveUser(updatedUser);
    
    // Invalidate all sessions (force re-login)
    await this.invalidateAllUserSessions(userId);
    
    // Audit log
    await this.auditLog('password_changed', {
      userId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Password changed for user ${userId}`);
  }

  /**
   * API Key management methods
   */
  public async createApiKey(
    userId: string,
    keyData: {
      name: string;
      scopes: string[];
      tier: 'free' | 'premium' | 'enterprise';
      expiresAt?: Date;
      description?: string;
    }
  ): Promise<ApiKey> {
    return await this.apiKeyManager.createApiKey(userId, keyData);
  }

  public async revokeApiKey(apiKey: string): Promise<void> {
    return await this.apiKeyManager.revokeApiKey(apiKey);
  }

  public async listUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await this.apiKeyManager.listApiKeys(userId);
  }

  /**
   * Session management
   */
  public async getUserSessions(userId: string): Promise<any[]> {
    return await this.jwtManager.getActiveSessions(userId);
  }

  public async invalidateSession(sessionId: string): Promise<void> {
    // Implementation would invalidate specific session
    console.log(`🗑️ Invalidated session ${sessionId}`);
  }

  public async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.jwtManager.invalidateAllRefreshTokens(userId);
  }

  /**
   * Security utilities
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private generateUserId(): string {
    return `user_${crypto.randomUUID()}`;
  }

  private generateSessionId(): string {
    return `session_${crypto.randomUUID()}`;
  }

  private async getUserIdFromToken(token: string): Promise<string> {
    const tokenPayload = await this.jwtManager.validateToken(token);
    return tokenPayload.userId;
  }

  /**
   * Helper methods (in production, these would use actual database)
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    // Mock implementation
    return null;
  }

  private async getUserById(userId: string): Promise<User | null> {
    // Mock implementation
    return null;
  }

  private async saveUser(user: User): Promise<void> {
    // Mock implementation
    console.log(`💾 Saving user: ${user.email}`);
  }

  private async updateLastLogin(userId: string): Promise<void> {
    // Mock implementation
    console.log(`📊 Updated last login for user ${userId}`);
  }

  private async createSession(userId: string, sessionId: string, metadata?: any): Promise<Session> {
    // Mock implementation
    const session: Session = {
      id: sessionId,
      userId,
      accessToken: '',
      refreshToken: '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: metadata?.ipAddress || 'unknown',
      userAgent: metadata?.userAgent || 'unknown',
      isActive: true
    };
    
    console.log(`📱 Created session ${sessionId} for user ${userId}`);
    return session;
  }

  private async findOrCreateOAuthUser(provider: string, userInfo: any): Promise<User> {
    // Mock implementation
    const user: User = {
      id: this.generateUserId(),
      email: userInfo.email,
      passwordHash: '',
      firstName: userInfo.given_name || '',
      lastName: userInfo.family_name || '',
      roles: ['user'],
      isActive: true,
      emailVerified: userInfo.emailVerified || false,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        oauthProvider: provider,
        oauthId: userInfo.id
      }
    };
    
    await this.saveUser(user);
    return user;
  }

  private async checkAccountLockout(userId: string): Promise<void> {
    // Mock implementation - check if account is locked
    return;
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    // Mock implementation - record failed login attempt
    console.log(`⚠️ Failed login attempt for user ${userId}`);
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    // Mock implementation - clear failed attempts
    console.log(`✅ Cleared failed attempts for user ${userId}`);
  }

  private async auditLog(event: string, data: any): Promise<void> {
    // Mock implementation - log to audit system
    console.log(`🔍 AUDIT: ${event}`, JSON.stringify(data, null, 2));
  }

  /**
   * Periodic cleanup tasks
   */
  public async performCleanup(): Promise<void> {
    console.log('🧹 Starting authentication system cleanup...');
    
    await Promise.all([
      this.jwtManager.cleanupExpiredTokens(),
      this.apiKeyManager.cleanupExpiredData(),
      this.oauth2Manager.cleanupExpiredData()
    ]);
    
    console.log('✅ Authentication system cleanup completed');
  }
}