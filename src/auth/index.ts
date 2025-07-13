/**
 * @fileoverview Authentication Module Exports
 * @description Central export file for all authentication components
 * @author Web-Buddy Team
 */

// Infrastructure exports
export { TokenManager, TokenPayload, TokenPair, DecodedToken } from './infrastructure/token-manager';
export { 
  createJWTMiddleware, 
  createWebSocketAuthHandler,
  requireRoles,
  requireExtension,
  optionalAuth,
  refreshTokenMiddleware,
  authErrorHandler,
  AuthenticatedUser,
  JWTMiddlewareOptions
} from './infrastructure/jwt-middleware';
export { createAuthRouter, configureAuth, AuthConfig } from './infrastructure/auth-controller';
export { validateRequest, validateQuery, validateParams } from './infrastructure/validation-middleware';

// CSRF Protection exports
export { 
  CSRFService, 
  CSRFTokenData, 
  CSRFConfig, 
  CSRFTokenStats,
  csrfService 
} from './infrastructure/csrf-service';
export { 
  createCSRFMiddleware,
  createCSRFMiddlewareWithAuth,
  createCSRFTokenGeneratorMiddleware,
  createCSRFTokenEndpoint,
  createCSRFTokenRotationMiddleware,
  createCSRFCleanupMiddleware,
  createDevCSRFMiddleware,
  CSRFMiddlewareOptions,
  CSRFError
} from './infrastructure/csrf-middleware';
export { 
  CSRFHelpers,
  createCSRFHelpers,
  getCSRFToken,
  validateCSRFToken,
  generateCSRFSnippet,
  FormCSRFOptions,
  AjaxCSRFOptions,
  CSRFTokenInfo
} from './infrastructure/csrf-helpers';

// Application exports
export { 
  AuthService, 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest 
} from './application/auth-service';

// Domain exports
export { User, UserWithoutPassword, UserRole, UserStatus } from './domain/user';
export { Session, SessionStatus } from './domain/session';
export { UserRepository } from './domain/user-repository';
export { SessionRepository } from './domain/session-repository';

// Infrastructure implementations
export { InMemoryUserRepository } from './infrastructure/in-memory-user-repository';
export { InMemorySessionRepository } from './infrastructure/in-memory-session-repository';

// CSRF Test utilities (for development)
export { createCSRFTestRouter, addCSRFTestRoutes } from './csrf-test-endpoints';

// Helper function to create a complete auth system
export function createAuthSystem() {
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  const tokenManager = new TokenManager();
  const authService = new AuthService(tokenManager, userRepository, sessionRepository);

  return {
    tokenManager,
    authService,
    userRepository,
    sessionRepository,
    authRouter: createAuthRouter(authService, tokenManager)
  };
}

// Helper function to create a complete auth system with CSRF protection
export function createAuthSystemWithCSRF(csrfConfig?: any) {
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  const tokenManager = new TokenManager();
  const authService = new AuthService(tokenManager, userRepository, sessionRepository);
  const csrfService = new CSRFService(csrfConfig);
  const csrfHelpers = createCSRFHelpers(csrfService);

  return {
    tokenManager,
    authService,
    userRepository,
    sessionRepository,
    csrfService,
    csrfHelpers,
    authRouter: createAuthRouter(authService, tokenManager),
    csrfTestRouter: createCSRFTestRouter(csrfService, tokenManager)
  };
}