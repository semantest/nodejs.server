/**
 * @fileoverview AuthService Unit Tests
 * @description Comprehensive tests for authentication service with security focus
 * @author Web-Buddy Team
 */

import bcrypt from 'bcrypt';
import { AuthService, LoginRequest, LoginResponse, RegisterRequest } from '../application/auth-service';
import { TokenManager } from '../infrastructure/token-manager';
import { UserRepository } from '../domain/user-repository';
import { SessionRepository } from '../domain/session-repository';
import { User } from '../domain/user';
import { Session, SessionStatus } from '../domain/session';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('../infrastructure/token-manager');
jest.mock('../domain/user-repository');
jest.mock('../domain/session-repository');

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>;
const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockSessionRepository = SessionRepository as jest.MockedClass<typeof SessionRepository>;

describe('AuthService', () => {
  let authService: AuthService;
  let tokenManager: jest.Mocked<TokenManager>;
  let userRepository: jest.Mocked<UserRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.resetTime();

    // Create mock instances
    tokenManager = new mockTokenManager() as jest.Mocked<TokenManager>;
    userRepository = new mockUserRepository() as jest.Mocked<UserRepository>;
    sessionRepository = new mockSessionRepository() as jest.Mocked<SessionRepository>;

    // Setup default mock behaviors
    mockBcrypt.hash.mockResolvedValue('hashedPassword123' as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    authService = new AuthService(tokenManager, userRepository, sessionRepository);
  });

  describe('User Registration', () => {
    let validRegisterRequest: RegisterRequest;

    beforeEach(() => {
      validRegisterRequest = {
        email: 'test@example.com',
        password: 'SecurePassword123',
        name: 'Test User',
        extensionId: 'ext-123'
      };
    });

    it('should register new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.save.mockResolvedValue(undefined);

      const user = await authService.register(validRegisterRequest);

      expect(user).toMatchObject({
        email: validRegisterRequest.email,
        name: validRegisterRequest.name,
        extensionId: validRegisterRequest.extensionId,
        roles: ['user'],
        isActive: true,
        isEmailVerified: false
      });

      expect(user.password).toBeUndefined(); // Password should be stripped from response
      expect(mockBcrypt.hash).toHaveBeenCalledWith(validRegisterRequest.password, 12);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should reject registration with existing email', async () => {
      const existingUser = testUtils.generateTestUser({ email: validRegisterRequest.email });
      userRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(validRegisterRequest)).rejects.toThrow(
        'User already exists with this email'
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    describe('Email Validation', () => {
      it('should reject invalid email formats', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'test@',
          'test.example.com',
          '',
          ' '
        ];

        for (const email of invalidEmails) {
          await expect(
            authService.register({ ...validRegisterRequest, email })
          ).rejects.toThrow('Invalid email address');
        }
      });

      it('should accept valid email formats', async () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'test123@test-domain.com'
        ];

        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.save.mockResolvedValue(undefined);

        for (const email of validEmails) {
          await expect(
            authService.register({ ...validRegisterRequest, email })
          ).resolves.toBeDefined();
        }
      });
    });

    describe('Password Validation', () => {
      it('should reject passwords shorter than 8 characters', async () => {
        await expect(
          authService.register({ ...validRegisterRequest, password: 'Short1' })
        ).rejects.toThrow('Password must be at least 8 characters long');
      });

      it('should reject passwords without uppercase letter', async () => {
        await expect(
          authService.register({ ...validRegisterRequest, password: 'lowercase123' })
        ).rejects.toThrow('Password must contain at least one uppercase letter');
      });

      it('should reject passwords without lowercase letter', async () => {
        await expect(
          authService.register({ ...validRegisterRequest, password: 'UPPERCASE123' })
        ).rejects.toThrow('Password must contain at least one lowercase letter');
      });

      it('should reject passwords without number', async () => {
        await expect(
          authService.register({ ...validRegisterRequest, password: 'NoNumbers' })
        ).rejects.toThrow('Password must contain at least one number');
      });

      it('should accept valid passwords', async () => {
        const validPasswords = [
          'SecurePassword123',
          'Another1Valid',
          'Complex9Password',
          'Test123Password'
        ];

        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.save.mockResolvedValue(undefined);

        for (const password of validPasswords) {
          await expect(
            authService.register({ ...validRegisterRequest, password })
          ).resolves.toBeDefined();
        }
      });
    });
  });

  describe('User Login', () => {
    let testUser: User;
    let testSession: Session;

    beforeEach(() => {
      testUser = testUtils.generateTestUser();
      testSession = testUtils.generateTestSession({ userId: testUser.id });

      sessionRepository.save.mockResolvedValue(undefined);
      userRepository.save.mockResolvedValue(undefined);
      tokenManager.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    });

    describe('Email/Password Authentication', () => {
      it('should login successfully with valid credentials', async () => {
        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'correctPassword'
        };

        userRepository.findByEmail.mockResolvedValue(testUser);
        mockBcrypt.compare.mockResolvedValue(true as never);

        const response = await authService.login(loginRequest);

        expect(response).toMatchObject({
          user: expect.objectContaining({
            id: testUser.id,
            email: testUser.email
          }),
          tokens: expect.objectContaining({
            accessToken: 'access-token',
            refreshToken: 'refresh-token'
          }),
          sessionId: expect.any(String)
        });

        expect(response.user.password).toBeUndefined();
        expect(userRepository.save).toHaveBeenCalled(); // Update last login
      });

      it('should reject login with wrong password', async () => {
        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'wrongPassword'
        };

        userRepository.findByEmail.mockResolvedValue(testUser);
        mockBcrypt.compare.mockResolvedValue(false as never);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Authentication failed'
        );

        expect(tokenManager.generateTokenPair).not.toHaveBeenCalled();
      });

      it('should reject login with non-existent email', async () => {
        const loginRequest: LoginRequest = {
          email: 'nonexistent@example.com',
          password: 'password'
        };

        userRepository.findByEmail.mockResolvedValue(null);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Authentication failed'
        );
      });

      it('should increment login attempts on failed login', async () => {
        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'wrongPassword'
        };

        userRepository.findByEmail.mockResolvedValue(testUser);
        mockBcrypt.compare.mockResolvedValue(false as never);

        await expect(authService.login(loginRequest)).rejects.toThrow();

        expect(userRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            loginAttempts: 1
          })
        );
      });

      it('should lock account after max login attempts', async () => {
        const lockedUser = {
          ...testUser,
          loginAttempts: 4 // One away from limit
        };

        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'wrongPassword'
        };

        userRepository.findByEmail.mockResolvedValue(lockedUser);
        mockBcrypt.compare.mockResolvedValue(false as never);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Account locked due to too many failed login attempts'
        );

        expect(userRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            loginAttempts: 5,
            lockedUntil: expect.any(Date)
          })
        );
      });

      it('should reject login for locked account', async () => {
        const lockedUser = {
          ...testUser,
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000) // Locked for 10 more minutes
        };

        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'correctPassword'
        };

        userRepository.findByEmail.mockResolvedValue(lockedUser);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Account is locked due to too many failed login attempts'
        );
      });

      it('should reject login for inactive user', async () => {
        const inactiveUser = {
          ...testUser,
          isActive: false
        };

        const loginRequest: LoginRequest = {
          email: testUser.email,
          password: 'correctPassword'
        };

        userRepository.findByEmail.mockResolvedValue(inactiveUser);
        mockBcrypt.compare.mockResolvedValue(true as never);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'User account is deactivated'
        );
      });
    });

    describe('API Key Authentication', () => {
      it('should login successfully with valid API key', async () => {
        const userWithApiKey = {
          ...testUser,
          apiKey: 'hashedApiKey123'
        };

        const loginRequest: LoginRequest = {
          extensionId: testUser.extensionId!,
          apiKey: 'plainApiKey123'
        };

        userRepository.findByExtensionId.mockResolvedValue(userWithApiKey);
        mockBcrypt.compare.mockResolvedValue(true as never);

        const response = await authService.login(loginRequest);

        expect(response).toMatchObject({
          user: expect.objectContaining({
            id: testUser.id,
            extensionId: testUser.extensionId
          }),
          tokens: expect.any(Object),
          sessionId: expect.any(String)
        });
      });

      it('should reject login with invalid API key', async () => {
        const userWithApiKey = {
          ...testUser,
          apiKey: 'hashedApiKey123'
        };

        const loginRequest: LoginRequest = {
          extensionId: testUser.extensionId!,
          apiKey: 'wrongApiKey'
        };

        userRepository.findByExtensionId.mockResolvedValue(userWithApiKey);
        mockBcrypt.compare.mockResolvedValue(false as never);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Authentication failed'
        );
      });

      it('should reject login with non-existent extension ID', async () => {
        const loginRequest: LoginRequest = {
          extensionId: 'nonexistent-ext',
          apiKey: 'apiKey123'
        };

        userRepository.findByExtensionId.mockResolvedValue(null);

        await expect(authService.login(loginRequest)).rejects.toThrow(
          'Authentication failed'
        );
      });
    });

    it('should reject invalid login request format', async () => {
      const invalidRequests = [
        {}, // No credentials
        { email: 'test@example.com' }, // Missing password
        { password: 'password' }, // Missing email
        { extensionId: 'ext-123' }, // Missing API key
        { apiKey: 'key123' } // Missing extension ID
      ];

      for (const request of invalidRequests) {
        await expect(authService.login(request)).rejects.toThrow(
          'Invalid login request'
        );
      }
    });
  });

  describe('User Logout', () => {
    let testSession: Session;

    beforeEach(() => {
      testSession = testUtils.generateTestSession();
    });

    it('should logout user successfully', async () => {
      sessionRepository.findById.mockResolvedValue(testSession);
      sessionRepository.save.mockResolvedValue(undefined);
      tokenManager.revokeSessionTokens.mockImplementation();

      await authService.logout(testSession.id);

      expect(tokenManager.revokeSessionTokens).toHaveBeenCalledWith(testSession.id);
      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SessionStatus.TERMINATED,
          endedAt: expect.any(Date)
        })
      );
    });

    it('should reject logout for non-existent session', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(authService.logout('nonexistent-session')).rejects.toThrow(
        'Session not found'
      );

      expect(tokenManager.revokeSessionTokens).not.toHaveBeenCalled();
    });

    it('should logout all user sessions', async () => {
      const sessions = [
        testUtils.generateTestSession({ id: 'session-1', userId: 'user-123' }),
        testUtils.generateTestSession({ id: 'session-2', userId: 'user-123' })
      ];

      sessionRepository.findActiveByUserId.mockResolvedValue(sessions);
      sessionRepository.save.mockResolvedValue(undefined);
      tokenManager.revokeSessionTokens.mockImplementation();
      tokenManager.revokeAllUserTokens.mockImplementation();

      await authService.logoutAllSessions('user-123');

      expect(tokenManager.revokeSessionTokens).toHaveBeenCalledTimes(2);
      expect(tokenManager.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
      expect(sessionRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Refresh', () => {
    let testUser: User;
    let testSession: Session;

    beforeEach(() => {
      testUser = testUtils.generateTestUser();
      testSession = testUtils.generateTestSession({ userId: testUser.id });

      userRepository.findById.mockResolvedValue(testUser);
      sessionRepository.findById.mockResolvedValue(testSession);
      sessionRepository.save.mockResolvedValue(undefined);
    });

    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedToken = testUtils.generateTestJWTPayload({
        sessionId: testSession.id,
        type: 'refresh'
      });

      tokenManager.verifyRefreshToken.mockResolvedValue(decodedToken);
      tokenManager.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const newTokenPair = await authService.refreshToken(refreshToken, testUser.id);

      expect(newTokenPair).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastActivityAt: expect.any(Date)
        })
      );
    });

    it('should reject refresh for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        authService.refreshToken('refresh-token', 'nonexistent-user')
      ).rejects.toThrow('User not found');
    });

    it('should reject refresh for inactive user', async () => {
      const inactiveUser = { ...testUser, isActive: false };
      userRepository.findById.mockResolvedValue(inactiveUser);

      await expect(
        authService.refreshToken('refresh-token', testUser.id)
      ).rejects.toThrow('User account is deactivated');
    });

    it('should reject refresh for inactive session', async () => {
      const inactiveSession = { ...testSession, status: SessionStatus.TERMINATED };
      const decodedToken = testUtils.generateTestJWTPayload({
        sessionId: testSession.id,
        type: 'refresh'
      });

      tokenManager.verifyRefreshToken.mockResolvedValue(decodedToken);
      sessionRepository.findById.mockResolvedValue(inactiveSession);

      await expect(
        authService.refreshToken('refresh-token', testUser.id)
      ).rejects.toThrow('Session not found or inactive');
    });
  });

  describe('Password Management', () => {
    let testUser: User;

    beforeEach(() => {
      testUser = testUtils.generateTestUser();
      userRepository.findById.mockResolvedValue(testUser);
      userRepository.save.mockResolvedValue(undefined);
    });

    it('should change password successfully', async () => {
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

      await authService.changePassword(testUser.id, 'currentPassword', 'NewPassword123');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('currentPassword', testUser.password);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123', 12);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'newHashedPassword',
          updatedAt: expect.any(Date)
        })
      );
    });

    it('should reject password change with wrong current password', async () => {
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        authService.changePassword(testUser.id, 'wrongPassword', 'NewPassword123')
      ).rejects.toThrow('Current password is incorrect');

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should logout all sessions after password change', async () => {
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

      const logoutAllSessionsSpy = jest.spyOn(authService, 'logoutAllSessions').mockResolvedValue();

      await authService.changePassword(testUser.id, 'currentPassword', 'NewPassword123');

      expect(logoutAllSessionsSpy).toHaveBeenCalledWith(testUser.id);
    });

    it('should reject password change for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        authService.changePassword('nonexistent-user', 'currentPassword', 'NewPassword123')
      ).rejects.toThrow('User not found');
    });
  });

  describe('API Key Management', () => {
    let testUser: User;

    beforeEach(() => {
      testUser = testUtils.generateTestUser();
      userRepository.findById.mockResolvedValue(testUser);
      userRepository.save.mockResolvedValue(undefined);
    });

    it('should generate API key successfully', async () => {
      mockBcrypt.hash.mockResolvedValue('hashedApiKey' as never);

      const apiKey = await authService.generateApiKey(testUser.id, 'extension-123');

      expect(apiKey).toMatch(/^sem_[a-f0-9]{64}$/); // Should match expected format
      expect(mockBcrypt.hash).toHaveBeenCalledWith(apiKey, 12);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionId: 'extension-123',
          apiKey: 'hashedApiKey',
          updatedAt: expect.any(Date)
        })
      );
    });

    it('should reject API key generation for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        authService.generateApiKey('nonexistent-user', 'extension-123')
      ).rejects.toThrow('User not found');
    });
  });

  describe('Email Verification', () => {
    let testUser: User;

    beforeEach(() => {
      testUser = testUtils.generateTestUser({ isEmailVerified: false });
      userRepository.findById.mockResolvedValue(testUser);
      userRepository.save.mockResolvedValue(undefined);
    });

    it('should verify email successfully', async () => {
      await authService.verifyEmail(testUser.id, 'verification-token');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: true,
          updatedAt: expect.any(Date)
        })
      );
    });

    it('should reject email verification for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        authService.verifyEmail('nonexistent-user', 'verification-token')
      ).rejects.toThrow('User not found');
    });
  });

  describe('Session Management', () => {
    let testUser: User;

    beforeEach(() => {
      testUser = testUtils.generateTestUser();
    });

    it('should get active sessions for user', async () => {
      const sessions = [
        testUtils.generateTestSession({ userId: testUser.id }),
        testUtils.generateTestSession({ userId: testUser.id })
      ];

      sessionRepository.findActiveByUserId.mockResolvedValue(sessions);

      const activeSessions = await authService.getActiveSessions(testUser.id);

      expect(activeSessions).toEqual(sessions);
      expect(sessionRepository.findActiveByUserId).toHaveBeenCalledWith(testUser.id);
    });

    it('should terminate specific session', async () => {
      const session = testUtils.generateTestSession({ userId: testUser.id });
      
      sessionRepository.findById.mockResolvedValue(session);
      sessionRepository.save.mockResolvedValue(undefined);
      tokenManager.revokeSessionTokens.mockImplementation();

      await authService.terminateSession(session.id, testUser.id);

      expect(tokenManager.revokeSessionTokens).toHaveBeenCalledWith(session.id);
      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SessionStatus.TERMINATED,
          endedAt: expect.any(Date)
        })
      );
    });

    it('should reject session termination for wrong user', async () => {
      const session = testUtils.generateTestSession({ userId: 'different-user' });
      
      sessionRepository.findById.mockResolvedValue(session);

      await expect(
        authService.terminateSession(session.id, testUser.id)
      ).rejects.toThrow('Session not found');

      expect(tokenManager.revokeSessionTokens).not.toHaveBeenCalled();
    });
  });
});