/**
 * @fileoverview Authentication Service
 * @description Main authentication service handling login, logout, and session management
 * @author Web-Buddy Team
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { TokenManager, TokenPair, TokenPayload } from '../infrastructure/token-manager';
import { UserRepository } from '../domain/user-repository';
import { User } from '../domain/user';
import { Session, SessionStatus } from '../domain/session';
import { SessionRepository } from '../domain/session-repository';

export interface LoginRequest {
  email?: string;
  extensionId?: string;
  password?: string;
  apiKey?: string;
}

export interface LoginResponse {
  user: Partial<User>;
  tokens: TokenPair;
  sessionId: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  extensionId?: string;
}

/**
 * Authentication Service
 * Handles user authentication, session management, and token operations
 */
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly tokenManager: TokenManager,
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository
  ) {}

  /**
   * Register a new user
   */
  public async register(request: RegisterRequest): Promise<User> {
    // Validate request
    this.validateRegisterRequest(request);

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(request.password, this.SALT_ROUNDS);

    // Create user
    const user: User = {
      id: this.generateUserId(),
      email: request.email,
      password: hashedPassword,
      name: request.name,
      extensionId: request.extensionId,
      roles: ['user'],
      isActive: true,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null
    };

    // Save user
    await this.userRepository.save(user);

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Login user and create session
   */
  public async login(request: LoginRequest): Promise<LoginResponse> {
    let user: User | null = null;

    // Authenticate based on method
    if (request.email && request.password) {
      user = await this.authenticateWithPassword(request.email, request.password);
    } else if (request.extensionId && request.apiKey) {
      user = await this.authenticateWithApiKey(request.extensionId, request.apiKey);
    } else {
      throw new Error('Invalid login request: provide email/password or extensionId/apiKey');
    }

    if (!user) {
      throw new Error('Authentication failed');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Create session
    const session = await this.createSession(user);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      extensionId: user.extensionId,
      roles: user.roles,
      sessionId: session.id
    };

    const tokens = await this.tokenManager.generateTokenPair(tokenPayload);

    // Update user last login
    user.lastLoginAt = new Date();
    user.loginAttempts = 0;
    await this.userRepository.save(user);

    // Return response
    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      tokens,
      sessionId: session.id
    };
  }

  /**
   * Logout user and revoke tokens
   */
  public async logout(sessionId: string): Promise<void> {
    // Find session
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Revoke all session tokens
    this.tokenManager.revokeSessionTokens(sessionId);

    // Update session status
    session.status = SessionStatus.TERMINATED;
    session.endedAt = new Date();
    await this.sessionRepository.save(session);

    console.log(`🚪 User logged out: ${session.userId}`);
  }

  /**
   * Logout all sessions for a user
   */
  public async logoutAllSessions(userId: string): Promise<void> {
    // Find all active sessions
    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    // Revoke all tokens and terminate sessions
    for (const session of sessions) {
      this.tokenManager.revokeSessionTokens(session.id);
      session.status = SessionStatus.TERMINATED;
      session.endedAt = new Date();
      await this.sessionRepository.save(session);
    }

    // Also revoke all tokens by user ID (belt and suspenders)
    this.tokenManager.revokeAllUserTokens(userId);

    console.log(`🚪 All sessions logged out for user: ${userId}`);
  }

  /**
   * Refresh access token
   */
  public async refreshToken(refreshToken: string, userId: string): Promise<TokenPair> {
    // Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Get session from refresh token
    const decoded = await this.tokenManager.verifyRefreshToken(refreshToken);
    const session = await this.sessionRepository.findById(decoded.sessionId);
    
    if (!session || session.status !== SessionStatus.ACTIVE) {
      throw new Error('Session not found or inactive');
    }

    // Update session activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    // Generate new token pair
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      extensionId: user.extensionId,
      roles: user.roles,
      sessionId: session.id
    };

    return await this.tokenManager.refreshAccessToken(refreshToken, tokenPayload);
  }

  /**
   * Verify email address
   */
  public async verifyEmail(userId: string, verificationToken: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // In production, verify the token properly
    // For now, just mark as verified
    user.isEmailVerified = true;
    user.updatedAt = new Date();
    await this.userRepository.save(user);
  }

  /**
   * Change user password
   */
  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    user.updatedAt = new Date();
    await this.userRepository.save(user);

    // Logout all sessions for security
    await this.logoutAllSessions(userId);
  }

  /**
   * Generate API key for extension
   */
  public async generateApiKey(userId: string, extensionId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate API key
    const apiKey = this.generateSecureApiKey();
    const hashedApiKey = await bcrypt.hash(apiKey, this.SALT_ROUNDS);

    // Update user
    user.extensionId = extensionId;
    user.apiKey = hashedApiKey;
    user.updatedAt = new Date();
    await this.userRepository.save(user);

    return apiKey;
  }

  /**
   * Authenticate with email and password
   */
  private async authenticateWithPassword(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is locked due to too many failed login attempts');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      // Lock account if too many attempts
      if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
        await this.userRepository.save(user);
        throw new Error('Account locked due to too many failed login attempts');
      }
      
      await this.userRepository.save(user);
      return null;
    }

    return user;
  }

  /**
   * Authenticate with extension ID and API key
   */
  private async authenticateWithApiKey(extensionId: string, apiKey: string): Promise<User | null> {
    const user = await this.userRepository.findByExtensionId(extensionId);
    if (!user || !user.apiKey) {
      return null;
    }

    // Verify API key
    const isValid = await bcrypt.compare(apiKey, user.apiKey);
    if (!isValid) {
      return null;
    }

    return user;
  }

  /**
   * Create new session for user
   */
  private async createSession(user: User): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      userId: user.id,
      userAgent: '', // Should be extracted from request
      ipAddress: '', // Should be extracted from request
      status: SessionStatus.ACTIVE,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      endedAt: null
    };

    await this.sessionRepository.save(session);
    return session;
  }

  /**
   * Validate register request
   */
  private validateRegisterRequest(request: RegisterRequest): void {
    if (!request.email || !this.isValidEmail(request.email)) {
      throw new Error('Invalid email address');
    }

    if (!request.password || request.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Additional password complexity requirements
    if (!/[A-Z]/.test(request.password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(request.password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(request.password)) {
      throw new Error('Password must contain at least one number');
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate secure API key
   */
  private generateSecureApiKey(): string {
    return `sem_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Get active sessions for user
   */
  public async getActiveSessions(userId: string): Promise<Session[]> {
    return await this.sessionRepository.findActiveByUserId(userId);
  }

  /**
   * Terminate specific session
   */
  public async terminateSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    
    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    // Revoke session tokens
    this.tokenManager.revokeSessionTokens(sessionId);

    // Update session
    session.status = SessionStatus.TERMINATED;
    session.endedAt = new Date();
    await this.sessionRepository.save(session);
  }
}