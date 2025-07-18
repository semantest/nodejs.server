/**
 * @fileoverview Example Express integration with authentication system
 * @description Shows how to integrate the authentication system with Express
 * @author Semantest Team
 */

import express from 'express';
import { AuthModule, DEFAULT_AUTH_CONFIG, AuthModuleConfig } from '../auth-module';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

/**
 * Example Express application with authentication
 */
class ExampleApp {
  private readonly app: express.Express;
  private readonly authModule: AuthModule;

  constructor() {
    this.app = express();
    
    // Setup basic middleware
    this.setupMiddleware();
    
    // Initialize authentication module
    const authConfig: AuthModuleConfig = {
      ...DEFAULT_AUTH_CONFIG,
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379'),
      allowedOrigins: ['http://localhost:3000', 'https://yourdomain.com'],
      
      // OAuth2 configuration (optional)
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
      
      // Security configuration
      bcryptSaltRounds: 12,
      passwordPepper: process.env.PASSWORD_PEPPER || 'change-this-in-production'
    };
    
    this.authModule = new AuthModule(authConfig);
    this.authModule.initialize(this.app);
    
    // Setup routes
    this.setupRoutes();
    
    // Start cleanup tasks
    this.authModule.startCleanupTasks();
  }

  /**
   * Setup basic Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add request logging
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Public routes
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to Semantest API',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          protected: '/api/protected',
          admin: '/api/admin',
          apiKeys: '/api/api-keys'
        }
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Protected routes example
    this.setupProtectedRoutes();
    
    // Admin routes example
    this.setupAdminRoutes();
    
    // API key routes example
    this.setupApiKeyRoutes();
    
    // Mixed authentication routes example
    this.setupMixedAuthRoutes();
  }

  /**
   * Setup protected routes (require authentication)
   */
  private setupProtectedRoutes(): void {
    const protectedRouter = this.authModule.createProtectedRouter();
    
    // User profile endpoints
    protectedRouter.get('/profile', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'This is a protected route',
        user: req.user,
        auth: req.auth
      });
    });
    
    // User data endpoints
    protectedRouter.get('/dashboard', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Welcome to your dashboard',
        userId: req.auth?.userId,
        roles: req.auth?.roles
      });
    });
    
    // User settings
    protectedRouter.get('/settings', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'User settings',
        userId: req.auth?.userId,
        permissions: req.auth?.permissions
      });
    });
    
    this.app.use('/api/protected', protectedRouter);
  }

  /**
   * Setup admin routes (require admin role)
   */
  private setupAdminRoutes(): void {
    const adminRouter = this.authModule.createRoleRouter(['admin', 'super_admin']);
    
    // Admin dashboard
    adminRouter.get('/dashboard', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Admin dashboard',
        user: req.user,
        systemInfo: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }
      });
    });
    
    // User management
    adminRouter.get('/users', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'User management',
        users: [
          { id: '1', email: 'admin@example.com', role: 'admin' },
          { id: '2', email: 'user@example.com', role: 'user' }
        ]
      });
    });
    
    // System logs
    adminRouter.get('/logs', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'System logs',
        logs: [
          { timestamp: new Date().toISOString(), level: 'info', message: 'System started' },
          { timestamp: new Date().toISOString(), level: 'info', message: 'Authentication module initialized' }
        ]
      });
    });
    
    this.app.use('/api/admin', adminRouter);
  }

  /**
   * Setup API key routes (require API key authentication)
   */
  private setupApiKeyRoutes(): void {
    const apiKeyRouter = this.authModule.createApiKeyRouter();
    
    // API key authenticated endpoints
    apiKeyRouter.get('/data', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'API key authenticated data',
        apiKeyId: req.auth?.apiKeyId,
        data: [
          { id: 1, name: 'Item 1', value: 'Value 1' },
          { id: 2, name: 'Item 2', value: 'Value 2' }
        ]
      });
    });
    
    // Bulk operations
    apiKeyRouter.post('/bulk-operation', (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Bulk operation started',
        operationId: 'bulk_' + Date.now(),
        status: 'processing'
      });
    });
    
    this.app.use('/api/api-keys', apiKeyRouter);
  }

  /**
   * Setup mixed authentication routes (optional authentication)
   */
  private setupMixedAuthRoutes(): void {
    const mixedRouter = this.authModule.createOptionalAuthRouter();
    
    // Public content with optional user context
    mixedRouter.get('/content', (req: AuthenticatedRequest, res) => {
      const isAuthenticated = !!req.auth;
      
      res.json({
        message: 'Mixed authentication content',
        isAuthenticated,
        user: req.user || null,
        content: {
          public: 'This is public content',
          private: isAuthenticated ? 'This is private content' : 'Login to see private content'
        }
      });
    });
    
    // Personalized recommendations
    mixedRouter.get('/recommendations', (req: AuthenticatedRequest, res) => {
      const recommendations = req.auth 
        ? ['Personalized item 1', 'Personalized item 2', 'Personalized item 3']
        : ['Generic item 1', 'Generic item 2', 'Generic item 3'];
      
      res.json({
        message: 'Recommendations',
        personalized: !!req.auth,
        recommendations
      });
    });
    
    this.app.use('/api/mixed', mixedRouter);
  }

  /**
   * Start the Express server
   */
  public start(port: number = 3000): void {
    this.app.listen(port, () => {
      console.log(`🚀 Server started on port ${port}`);
      console.log(`📖 API Documentation: http://localhost:${port}/`);
      console.log(`🔐 Authentication: http://localhost:${port}/api/auth`);
      console.log(`🛡️  Protected Routes: http://localhost:${port}/api/protected`);
      console.log(`👑 Admin Routes: http://localhost:${port}/api/admin`);
      console.log(`🔑 API Key Routes: http://localhost:${port}/api/api-keys`);
    });
  }

  /**
   * Shutdown the server gracefully
   */
  public async shutdown(): Promise<void> {
    await this.authModule.shutdown();
    console.log('🛑 Server shutdown complete');
  }
}

/**
 * Example usage with environment variables
 */
function createExampleApp(): ExampleApp {
  // Load environment variables
  const requiredEnvVars = ['JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.log('Please set the following environment variables:');
    console.log('JWT_SECRET=your-secret-key-change-in-production');
    console.log('REDIS_HOST=localhost (optional)');
    console.log('REDIS_PORT=6379 (optional)');
    console.log('GOOGLE_CLIENT_ID=your-google-client-id (optional)');
    console.log('GOOGLE_CLIENT_SECRET=your-google-client-secret (optional)');
    console.log('GITHUB_CLIENT_ID=your-github-client-id (optional)');
    console.log('GITHUB_CLIENT_SECRET=your-github-client-secret (optional)');
    process.exit(1);
  }
  
  return new ExampleApp();
}

/**
 * Example middleware for permission-based access
 */
function createPermissionExample(authModule: AuthModule): express.Router {
  const router = express.Router();
  
  // Routes that require specific permissions
  router.get('/read-only', 
    authModule.getAuthMiddleware().requireAuth(),
    authModule.getAuthMiddleware().requirePermissions(['read:data']),
    (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Read-only data access',
        data: 'This requires read:data permission'
      });
    }
  );
  
  router.post('/write-data',
    authModule.getAuthMiddleware().requireAuth(),
    authModule.getAuthMiddleware().requirePermissions(['write:data']),
    (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Data written successfully',
        data: 'This requires write:data permission'
      });
    }
  );
  
  router.delete('/delete-data',
    authModule.getAuthMiddleware().requireAuth(),
    authModule.getAuthMiddleware().requirePermissions(['delete:data']),
    (req: AuthenticatedRequest, res) => {
      res.json({
        message: 'Data deleted successfully',
        data: 'This requires delete:data permission'
      });
    }
  );
  
  return router;
}

// Export for use in other modules
export { ExampleApp, createExampleApp, createPermissionExample };

// If this file is run directly, start the example app
if (require.main === module) {
  const app = createExampleApp();
  const port = parseInt(process.env.PORT || '3000');
  app.start(port);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });
}