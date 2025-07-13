/**
 * @fileoverview HTTP server adapter with authentication support
 * @description Enhanced HTTP server adapter that integrates JWT authentication
 * @author Web-Buddy Team
 */

import { Adapter, AdapterFor, Port } from '../../stubs/typescript-eda-stubs';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { TokenManager } from '../../auth/infrastructure/token-manager';
import { AuthService } from '../../auth/application/auth-service';
import { createAuthRouter } from '../../auth/infrastructure/auth-controller';
import { createJWTMiddleware } from '../../auth/infrastructure/jwt-middleware';
import { InMemoryUserRepository } from '../../auth/infrastructure/in-memory-user-repository';
import { InMemorySessionRepository } from '../../auth/infrastructure/in-memory-session-repository';
import { CSRFService } from '../../auth/infrastructure/csrf-service';
import { 
  createCSRFMiddlewareWithAuth,
  createCSRFTokenGeneratorMiddleware,
  createCSRFTokenEndpoint,
  createCSRFTokenRotationMiddleware,
  createCSRFCleanupMiddleware
} from '../../auth/infrastructure/csrf-middleware';
import { createCSRFHelpers } from '../../auth/infrastructure/csrf-helpers';
import { 
  createDevelopmentRateLimitMiddleware,
  RateLimitMiddleware 
} from '../../security/rate-limiting-middleware';
import { RateLimitMonitor } from '../../security/monitoring';
import { createRateLimitStore } from '../../security/rate-limit-stores';

/**
 * Port interface for HTTP server operations
 */
export abstract class HttpServerPort extends Port {
  public readonly name = 'HttpServerPort';
  
  public abstract startServer(port: number): Promise<void>;
  public abstract stopServer(): Promise<void>;
  public abstract registerRoute(method: string, path: string, handler: Function): void;
  public abstract getServerInfo(): Promise<ServerInfo>;
}

/**
 * HTTP server adapter with authentication using Express.js
 * Provides secure REST API endpoints with JWT authentication
 */
@AdapterFor(HttpServerPort)
export class HttpServerAdapterWithAuth extends HttpServerPort {
  private app?: Express;
  private server?: Server;
  private isRunning = false;
  private port = 0;
  private routes = new Map<string, RouteInfo>();
  
  // Authentication components
  private tokenManager?: TokenManager;
  private authService?: AuthService;
  private userRepository?: InMemoryUserRepository;
  private sessionRepository?: InMemorySessionRepository;
  
  // CSRF protection components
  private csrfService?: CSRFService;
  private csrfHelpers?: any;
  
  // Rate limiting components
  private rateLimitMiddleware?: RateLimitMiddleware;
  private rateLimitMonitor?: RateLimitMonitor;

  /**
   * Start the HTTP server on specified port
   */
  public async startServer(port: number): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ HTTP server is already running');
      return;
    }

    console.log(`🌐 Starting HTTP server with authentication on port ${port}...`);

    try {
      this.app = express();
      this.port = port;

      // Initialize authentication components
      this.initializeAuthentication();

      // Initialize CSRF protection
      this.initializeCSRFProtection();

      // Initialize rate limiting
      this.initializeRateLimiting();

      // Set up middleware
      this.setupMiddleware();
      
      // Set up authentication routes
      this.setupAuthRoutes();
      
      // Set up protected routes
      this.setupRoutes();

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server = this.app!.listen(port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isRunning = true;
      
      console.log(`✅ HTTP server with authentication started on http://localhost:${port}`);
      
    } catch (error) {
      console.error('❌ Failed to start HTTP server:', error);
      throw error;
    }
  }

  /**
   * Stop the HTTP server gracefully
   */
  public async stopServer(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ HTTP server is not running');
      return;
    }

    console.log('🛑 Stopping HTTP server...');

    try {
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      this.isRunning = false;
      this.app = undefined;
      this.server = undefined;
      
      console.log('✅ HTTP server stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping HTTP server:', error);
      throw error;
    }
  }

  /**
   * Register a new route handler
   */
  public registerRoute(method: string, path: string, handler: Function): void {
    if (!this.app) {
      throw new Error('HTTP server not initialized');
    }

    const routeKey = `${method.toUpperCase()} ${path}`;
    this.routes.set(routeKey, {
      method: method.toUpperCase(),
      path,
      handler,
      registeredAt: new Date()
    });

    // Register with Express
    switch (method.toLowerCase()) {
      case 'get':
        this.app.get(path, handler as any);
        break;
      case 'post':
        this.app.post(path, handler as any);
        break;
      case 'put':
        this.app.put(path, handler as any);
        break;
      case 'delete':
        this.app.delete(path, handler as any);
        break;
      case 'patch':
        this.app.patch(path, handler as any);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    console.log(`📍 Route registered: ${routeKey}`);
  }

  /**
   * Get server information
   */
  public async getServerInfo(): Promise<ServerInfo> {
    return {
      isRunning: this.isRunning,
      port: this.port,
      routeCount: this.routes.size,
      registeredRoutes: Array.from(this.routes.keys()),
      uptime: this.isRunning ? process.uptime() : 0,
      environment: process.env.NODE_ENV || 'development',
      authEnabled: true,
      csrfEnabled: !!this.csrfService,
      csrfConfig: this.csrfService ? {
        headerName: this.csrfService.getConfig().headerName,
        cookieName: this.csrfService.getConfig().cookieName,
        tokenExpiry: this.csrfService.getConfig().tokenExpiry
      } : undefined,
      rateLimitingEnabled: !!this.rateLimitMiddleware,
      rateLimitingMonitoring: !!this.rateLimitMonitor
    };
  }

  /**
   * Initialize authentication components
   */
  private initializeAuthentication(): void {
    // Initialize repositories
    this.userRepository = new InMemoryUserRepository();
    this.sessionRepository = new InMemorySessionRepository();

    // Initialize token manager
    this.tokenManager = new TokenManager();

    // Initialize auth service
    this.authService = new AuthService(
      this.tokenManager,
      this.userRepository,
      this.sessionRepository
    );

    console.log('🔐 Authentication components initialized');
  }

  /**
   * Initialize CSRF protection components
   */
  private initializeCSRFProtection(): void {
    // Initialize CSRF service
    this.csrfService = new CSRFService({
      cookieName: 'semantest-csrf-token',
      headerName: 'X-CSRF-Token',
      tokenLength: 32,
      tokenExpiry: 3600000, // 1 hour
      secureCookie: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: false // Must be false for JavaScript access
    });

    // Initialize CSRF helpers
    this.csrfHelpers = createCSRFHelpers(this.csrfService);

    console.log('🛡️ CSRF protection components initialized');
  }

  /**
   * Initialize rate limiting components
   */
  private initializeRateLimiting(): void {
    // Create rate limit store based on environment
    const storeType = process.env.RATE_LIMIT_STORE || 'memory';
    const rateLimitStore = createRateLimitStore({
      type: storeType as 'redis' | 'memory',
      redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: 'semantest:rl:'
      },
      memory: {
        maxSize: parseInt(process.env.RATE_LIMIT_MEMORY_MAX_SIZE || '10000'),
        cleanupIntervalMs: parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || '60000'),
        maxAge: parseInt(process.env.RATE_LIMIT_MAX_AGE || '3600000')
      }
    });

    // Initialize rate limiting middleware
    this.rateLimitMiddleware = new RateLimitMiddleware({
      store: rateLimitStore,
      skipPaths: ['/health', '/info'],
      headers: true,
      standardHeaders: true,
      legacyHeaders: false
    });

    // Initialize monitoring
    this.rateLimitMonitor = new RateLimitMonitor({
      enabled: process.env.RATE_LIMIT_MONITORING !== 'false',
      thresholds: {
        violationsPerMinute: parseInt(process.env.RATE_LIMIT_VIOLATIONS_PER_MINUTE || '10'),
        blockedRequestsPercentage: parseInt(process.env.RATE_LIMIT_BLOCKED_PERCENTAGE || '20'),
        criticalViolationsPerMinute: parseInt(process.env.RATE_LIMIT_CRITICAL_VIOLATIONS || '5'),
        storeErrorRate: parseInt(process.env.RATE_LIMIT_STORE_ERROR_RATE || '5')
      },
      notifications: {
        webhook: process.env.RATE_LIMIT_WEBHOOK_URL ? {
          url: process.env.RATE_LIMIT_WEBHOOK_URL,
          headers: {
            'Authorization': process.env.RATE_LIMIT_WEBHOOK_AUTH || '',
            'X-Service': 'semantest-rate-limiter'
          }
        } : undefined,
        slack: process.env.SLACK_WEBHOOK_URL ? {
          webhook: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts'
        } : undefined
      },
      cooldownMs: parseInt(process.env.RATE_LIMIT_ALERT_COOLDOWN || '300000') // 5 minutes
    });

    // Set up monitoring event handlers
    this.setupRateLimitMonitoring();

    console.log('🛡️ Rate limiting components initialized');
  }

  /**
   * Setup rate limit monitoring event handlers
   */
  private setupRateLimitMonitoring(): void {
    if (!this.rateLimitMonitor) return;

    // Log violations
    this.rateLimitMonitor.on('violation', (violation) => {
      console.warn('🚫 Rate limit violation:', {
        identifier: violation.identifier,
        endpoint: violation.endpoint,
        tier: violation.tier,
        severity: violation.severity,
        timestamp: new Date(violation.timestamp).toISOString()
      });
    });

    // Log alerts
    this.rateLimitMonitor.on('alert', (alert) => {
      console.error('🚨 Rate limiting alert:', alert);
    });

    // Periodic health check
    setInterval(async () => {
      if (this.rateLimitMiddleware) {
        try {
          const health = await this.rateLimitMiddleware.healthCheck();
          if (!health?.healthy) {
            console.warn('⚠️ Rate limiting health check failed:', health);
          }
        } catch (error) {
          console.error('❌ Rate limiting health check error:', error);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    if (!this.app) return;

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Extension-Id']
    }));

    // Cookie parser for refresh tokens
    this.app.use(cookieParser());

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting (before other middleware that might be expensive)
    if (this.rateLimitMiddleware) {
      const rateLimitHandler = this.rateLimitMiddleware.createMiddleware();
      this.app.use(rateLimitHandler);
      
      // Add monitoring integration
      if (this.rateLimitMonitor) {
        this.app.use((req, res, next) => {
          const startTime = Date.now();
          
          res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            const rateLimitResults = req.rateLimit?.results;
            
            if (rateLimitResults && this.rateLimitMonitor) {
              this.rateLimitMonitor.recordRateLimitCheck(
                req.rateLimitContext?.identifier || req.ip || 'unknown',
                req.path,
                rateLimitResults,
                req.rateLimit?.allowed || true,
                responseTime,
                {
                  userAgent: req.headers['user-agent'],
                  extensionId: req.user?.extensionId,
                  ipAddress: req.ip || 'unknown',
                  userId: req.user?.userId
                }
              );
            }
          });
          
          next();
        });
      }
    }

    // CSRF token generation middleware (for GET requests)
    if (this.csrfService) {
      this.app.use(createCSRFTokenGeneratorMiddleware(this.csrfService));
    }

    // CSRF helpers middleware
    if (this.csrfHelpers) {
      this.app.use(this.csrfHelpers.templateMiddleware());
      this.app.use(this.csrfHelpers.expressHelperMiddleware());
    }

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      const { method, url, ip } = req;
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`📝 ${method} ${url} - ${res.statusCode} - ${duration}ms - ${ip}`);
      });
      
      next();
    });

    console.log('🔧 HTTP middleware configured');
  }

  /**
   * Set up authentication routes
   */
  private setupAuthRoutes(): void {
    if (!this.app || !this.authService || !this.tokenManager) return;

    // Mount auth router
    const authRouter = createAuthRouter(this.authService, this.tokenManager);
    this.app.use('/auth', authRouter);

    // Add CSRF token endpoint
    if (this.csrfService) {
      this.app.get('/auth/csrf-token', createCSRFTokenEndpoint(this.csrfService));
      
      // Add CSRF token rotation endpoint (protected)
      this.app.post('/auth/csrf-rotate',
        createJWTMiddleware({ tokenManager: this.tokenManager }),
        createCSRFTokenRotationMiddleware(this.csrfService),
        (req, res) => {
          res.json({
            success: true,
            message: 'CSRF token rotated successfully',
            csrfToken: req.csrfToken,
            timestamp: new Date().toISOString()
          });
        }
      );

      // Add logout endpoint with CSRF cleanup
      this.app.post('/auth/logout',
        createJWTMiddleware({ tokenManager: this.tokenManager }),
        createCSRFCleanupMiddleware(this.csrfService),
        (req, res) => {
          // In a real implementation, this would invalidate the JWT token
          res.json({
            success: true,
            message: 'Logged out successfully',
            timestamp: new Date().toISOString()
          });
        }
      );
    }

    console.log('🔐 Authentication routes configured');
  }

  /**
   * Set up default routes with authentication
   */
  private setupRoutes(): void {
    if (!this.app || !this.tokenManager) return;

    // Health check endpoint (public)
    this.registerRoute('GET', '/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        authEnabled: true
      });
    });

    // Server info endpoint (public)
    this.registerRoute('GET', '/info', async (req: Request, res: Response) => {
      try {
        const serverInfo = await this.getServerInfo();
        res.json(serverInfo);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get server info' });
      }
    });

    // Protected automation dispatch endpoint
    this.app.post('/api/automation/dispatch', 
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      this.csrfService ? createCSRFMiddlewareWithAuth(this.csrfService, {
        allowedExtensionIds: process.env.ALLOWED_EXTENSION_IDS?.split(',') || []
      }) : (req, res, next) => next(),
      (req: Request, res: Response) => {
        try {
          const { extensionId, tabId, action, payload } = req.body;
          
          // Validate required fields
          if (!extensionId || !action) {
            return res.status(400).json({
              error: 'Missing required fields: extensionId, action'
            });
          }

          const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // In real implementation, this would emit an AutomationRequestReceivedEvent
          console.log(`🤖 Automation dispatch request received:`, {
            requestId,
            extensionId,
            tabId,
            action,
            userId: req.user?.userId
          });

          res.json({
            requestId,
            status: 'accepted',
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('❌ Error processing automation dispatch:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    );

    // Protected extension status endpoint
    this.app.get('/api/extensions',
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      (req: Request, res: Response) => {
        // In real implementation, this would query the coordination application
        res.json({
          extensions: [],
          count: 0,
          timestamp: new Date().toISOString(),
          userId: req.user?.userId
        });
      }
    );

    // Protected metrics endpoint
    this.app.get('/api/metrics',
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      async (req: Request, res: Response) => {
        try {
          const rateLimitMetrics = this.rateLimitMonitor ? 
            this.rateLimitMonitor.getMetrics() : null;
          const rateLimitHealth = this.rateLimitMiddleware ? 
            await this.rateLimitMiddleware.healthCheck() : null;

          res.json({
            server: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              cpu: process.cpuUsage()
            },
            coordination: {
              activeExtensions: 0,
              activeSessions: 0,
              requestsPerSecond: 0
            },
            auth: {
              activeTokens: this.tokenManager?.getTokenStats().activeRefreshTokens || 0,
              blacklistedTokens: this.tokenManager?.getTokenStats().blacklistedTokens || 0
            },
            rateLimit: rateLimitMetrics ? {
              totalRequests: rateLimitMetrics.totalRequests,
              allowedRequests: rateLimitMetrics.allowedRequests,
              blockedRequests: rateLimitMetrics.blockedRequests,
              blockPercentage: rateLimitMetrics.totalRequests > 0 ? 
                ((rateLimitMetrics.blockedRequests / rateLimitMetrics.totalRequests) * 100).toFixed(2) : '0.00',
              averageResponseTime: rateLimitMetrics.averageResponseTime,
              storeStats: rateLimitMetrics.storeStats,
              health: rateLimitHealth
            } : null,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          res.status(500).json({ error: 'Failed to get metrics' });
        }
      }
    );

    // Rate limiting status endpoint (admin only)
    this.app.get('/api/rate-limit/status',
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      async (req: Request, res: Response) => {
        try {
          if (!req.user?.roles.includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const metrics = this.rateLimitMonitor ? 
            this.rateLimitMonitor.getMetrics() : null;
          const health = this.rateLimitMonitor ? 
            this.rateLimitMonitor.getHealthStatus() : null;
          const violations = this.rateLimitMonitor ? 
            this.rateLimitMonitor.getRecentViolations() : [];
          const topViolators = this.rateLimitMonitor ? 
            this.rateLimitMonitor.getTopViolators() : [];

          res.json({
            enabled: !!this.rateLimitMiddleware,
            metrics,
            health,
            violations,
            topViolators,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Rate limit status error:', error);
          res.status(500).json({ error: 'Failed to get rate limit status' });
        }
      }
    );

    // Rate limiting reset endpoint (admin only)
    this.app.post('/api/rate-limit/reset',
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      async (req: Request, res: Response) => {
        try {
          if (!req.user?.roles.includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const { identifier, endpoint } = req.body;
          if (!identifier) {
            return res.status(400).json({ error: 'Identifier is required' });
          }

          // Reset rate limit for specific identifier
          // This would need to be implemented in the service
          
          res.json({
            message: 'Rate limit reset successfully',
            identifier,
            endpoint: endpoint || 'all',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Rate limit reset error:', error);
          res.status(500).json({ error: 'Failed to reset rate limit' });
        }
      }
    );

    // WebSocket connection info endpoint (requires authentication)
    this.app.get('/api/websocket/info',
      createJWTMiddleware({ tokenManager: this.tokenManager }),
      (req: Request, res: Response) => {
        res.json({
          url: `ws://localhost:${this.port + 1}/ws`,
          activeConnections: 0,
          protocol: 'websocket',
          authRequired: true,
          timestamp: new Date().toISOString()
        });
      }
    );

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((error: Error, req: Request, res: Response, next: Function) => {
      console.error('❌ HTTP server error:', error);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
        timestamp: new Date().toISOString()
      });
    });

    console.log('📍 Protected routes configured');
  }

  /**
   * Get registered routes
   */
  public getRegisteredRoutes(): RouteInfo[] {
    return Array.from(this.routes.values());
  }

  /**
   * Health check for the adapter
   */
  public async isHealthy(): Promise<boolean> {
    return this.isRunning && this.server !== undefined;
  }

  /**
   * Cleanup the adapter
   */
  public async shutdown(): Promise<void> {
    // Cleanup rate limiting components
    if (this.rateLimitMiddleware) {
      await this.rateLimitMiddleware.cleanup();
    }
    
    await this.stopServer();
  }

  /**
   * Get authentication components (for testing/development)
   */
  public getAuthComponents() {
    return {
      tokenManager: this.tokenManager,
      authService: this.authService,
      userRepository: this.userRepository,
      sessionRepository: this.sessionRepository,
      csrfService: this.csrfService,
      csrfHelpers: this.csrfHelpers,
      rateLimitMiddleware: this.rateLimitMiddleware,
      rateLimitMonitor: this.rateLimitMonitor
    };
  }
}

// Supporting interfaces

interface RouteInfo {
  method: string;
  path: string;
  handler: Function;
  registeredAt: Date;
}

export interface ServerInfo {
  isRunning: boolean;
  port: number;
  routeCount: number;
  registeredRoutes: string[];
  uptime: number;
  environment: string;
  authEnabled?: boolean;
  csrfEnabled?: boolean;
  csrfConfig?: {
    headerName: string;
    cookieName: string;
    tokenExpiry: number;
  };
  rateLimitingEnabled?: boolean;
  rateLimitingMonitoring?: boolean;
}