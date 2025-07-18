/**
 * @fileoverview Authentication module for Express application
 * @description Main module that integrates all authentication components
 * @author Semantest Team
 */

import { Express, Router } from 'express';
import { ProductionAuthService } from './production-auth-service';
import { AuthMiddleware } from './middleware/auth-middleware';
import { AuthRoutes } from './routes/auth-routes';
import { authErrorHandler } from './middleware/auth-middleware';

/**
 * Authentication module configuration
 */
export interface AuthModuleConfig {
  // JWT configuration
  jwtSecret?: string;
  jwtExpiresIn?: string;
  jwtRefreshExpiresIn?: string;
  
  // Redis configuration
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  
  // Password configuration
  bcryptSaltRounds?: number;
  passwordPepper?: string;
  
  // OAuth2 configuration
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  
  githubClientId?: string;
  githubClientSecret?: string;
  githubRedirectUri?: string;
  
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftRedirectUri?: string;
  
  discordClientId?: string;
  discordClientSecret?: string;
  discordRedirectUri?: string;
  
  // CORS configuration
  allowedOrigins?: string[];
  
  // Rate limiting
  enableRateLimiting?: boolean;
  
  // API key configuration
  apiKeyPrefix?: string;
  apiKeyLength?: number;
}

/**
 * Authentication module for Express applications
 */
export class AuthModule {
  private readonly authService: ProductionAuthService;
  private readonly authMiddleware: AuthMiddleware;
  private readonly authRoutes: AuthRoutes;
  private readonly config: AuthModuleConfig;

  constructor(config: AuthModuleConfig = {}) {
    this.config = config;
    this.setEnvironmentVariables();
    
    // Initialize services
    this.authService = new ProductionAuthService();
    this.authMiddleware = new AuthMiddleware(this.authService);
    this.authRoutes = new AuthRoutes(this.authService);
  }

  /**
   * Initialize authentication module with Express app
   */
  public initialize(app: Express): void {
    // Add CORS middleware
    app.use(this.authMiddleware.cors());

    // Add authentication routes
    app.use('/api/auth', this.authRoutes.getRouter());

    // Add rate limiting middleware if enabled
    if (this.config.enableRateLimiting !== false) {
      app.use('/api', this.authMiddleware.rateLimiter());
    }

    // Add authentication error handler
    app.use(authErrorHandler);

    console.log('🔐 Authentication module initialized');
  }

  /**
   * Get authentication service
   */
  public getAuthService(): ProductionAuthService {
    return this.authService;
  }

  /**
   * Get authentication middleware
   */
  public getAuthMiddleware(): AuthMiddleware {
    return this.authMiddleware;
  }

  /**
   * Get authentication routes
   */
  public getAuthRoutes(): AuthRoutes {
    return this.authRoutes;
  }

  /**
   * Create a protected router with authentication middleware
   */
  public createProtectedRouter(): Router {
    const router = Router();
    router.use(this.authMiddleware.requireAuth());
    return router;
  }

  /**
   * Create a router that requires specific permissions
   */
  public createPermissionRouter(permissions: string[]): Router {
    const router = Router();
    router.use(this.authMiddleware.requireAuth());
    router.use(this.authMiddleware.requirePermissions(permissions));
    return router;
  }

  /**
   * Create a router that requires specific roles
   */
  public createRoleRouter(roles: string[]): Router {
    const router = Router();
    router.use(this.authMiddleware.requireAuth());
    router.use(this.authMiddleware.requireRoles(roles));
    return router;
  }

  /**
   * Create a router that requires API key authentication
   */
  public createApiKeyRouter(): Router {
    const router = Router();
    router.use(this.authMiddleware.requireApiKey());
    return router;
  }

  /**
   * Create a router with optional authentication
   */
  public createOptionalAuthRouter(): Router {
    const router = Router();
    router.use(this.authMiddleware.optionalAuth());
    return router;
  }

  /**
   * Start cleanup tasks
   */
  public startCleanupTasks(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        await this.authService.performCleanup();
      } catch (error) {
        console.error('Authentication cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('🧹 Authentication cleanup tasks started');
  }

  /**
   * Shutdown authentication module
   */
  public async shutdown(): Promise<void> {
    try {
      // Perform final cleanup
      await this.authService.performCleanup();
      
      console.log('🔐 Authentication module shutdown complete');
    } catch (error) {
      console.error('Error during authentication module shutdown:', error);
    }
  }

  /**
   * Set environment variables from config
   */
  private setEnvironmentVariables(): void {
    if (this.config.jwtSecret) {
      process.env.JWT_SECRET = this.config.jwtSecret;
    }
    
    if (this.config.jwtExpiresIn) {
      process.env.JWT_EXPIRES_IN = this.config.jwtExpiresIn;
    }
    
    if (this.config.jwtRefreshExpiresIn) {
      process.env.JWT_REFRESH_EXPIRES_IN = this.config.jwtRefreshExpiresIn;
    }
    
    if (this.config.redisHost) {
      process.env.REDIS_HOST = this.config.redisHost;
    }
    
    if (this.config.redisPort) {
      process.env.REDIS_PORT = this.config.redisPort.toString();
    }
    
    if (this.config.redisPassword) {
      process.env.REDIS_PASSWORD = this.config.redisPassword;
    }
    
    if (this.config.bcryptSaltRounds) {
      process.env.BCRYPT_SALT_ROUNDS = this.config.bcryptSaltRounds.toString();
    }
    
    if (this.config.passwordPepper) {
      process.env.PASSWORD_PEPPER = this.config.passwordPepper;
    }
    
    if (this.config.googleClientId) {
      process.env.GOOGLE_CLIENT_ID = this.config.googleClientId;
    }
    
    if (this.config.googleClientSecret) {
      process.env.GOOGLE_CLIENT_SECRET = this.config.googleClientSecret;
    }
    
    if (this.config.googleRedirectUri) {
      process.env.GOOGLE_REDIRECT_URI = this.config.googleRedirectUri;
    }
    
    if (this.config.githubClientId) {
      process.env.GITHUB_CLIENT_ID = this.config.githubClientId;
    }
    
    if (this.config.githubClientSecret) {
      process.env.GITHUB_CLIENT_SECRET = this.config.githubClientSecret;
    }
    
    if (this.config.githubRedirectUri) {
      process.env.GITHUB_REDIRECT_URI = this.config.githubRedirectUri;
    }
    
    if (this.config.microsoftClientId) {
      process.env.MICROSOFT_CLIENT_ID = this.config.microsoftClientId;
    }
    
    if (this.config.microsoftClientSecret) {
      process.env.MICROSOFT_CLIENT_SECRET = this.config.microsoftClientSecret;
    }
    
    if (this.config.microsoftRedirectUri) {
      process.env.MICROSOFT_REDIRECT_URI = this.config.microsoftRedirectUri;
    }
    
    if (this.config.discordClientId) {
      process.env.DISCORD_CLIENT_ID = this.config.discordClientId;
    }
    
    if (this.config.discordClientSecret) {
      process.env.DISCORD_CLIENT_SECRET = this.config.discordClientSecret;
    }
    
    if (this.config.discordRedirectUri) {
      process.env.DISCORD_REDIRECT_URI = this.config.discordRedirectUri;
    }
    
    if (this.config.allowedOrigins) {
      process.env.ALLOWED_ORIGINS = this.config.allowedOrigins.join(',');
    }
    
    if (this.config.apiKeyPrefix) {
      process.env.API_KEY_PREFIX = this.config.apiKeyPrefix;
    }
    
    if (this.config.apiKeyLength) {
      process.env.API_KEY_LENGTH = this.config.apiKeyLength.toString();
    }
  }
}

/**
 * Factory function to create authentication module
 */
export function createAuthModule(config: AuthModuleConfig = {}): AuthModule {
  return new AuthModule(config);
}

/**
 * Default authentication module configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthModuleConfig = {
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  redisHost: 'localhost',
  redisPort: 6379,
  bcryptSaltRounds: 12,
  allowedOrigins: ['http://localhost:3000'],
  enableRateLimiting: true,
  apiKeyPrefix: 'sk',
  apiKeyLength: 32
};

/**
 * Express middleware to add authentication to existing apps
 */
export function useAuthentication(app: Express, config: AuthModuleConfig = {}): AuthModule {
  const authModule = new AuthModule({ ...DEFAULT_AUTH_CONFIG, ...config });
  authModule.initialize(app);
  return authModule;
}

// Export all authentication types and interfaces
export * from './domain/auth-entities';
export * from './middleware/auth-middleware';
export * from './routes/auth-routes';
export * from './production-auth-service';