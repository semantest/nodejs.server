/**
 * @fileoverview Sample Authentication Integration
 * @description Example code showing how to integrate JWT authentication in the Semantest platform
 * @author Web-Buddy Team
 */

import express from 'express';
import { TokenManager } from './infrastructure/token-manager';
import { AuthService } from './application/auth-service';
import { InMemoryUserRepository } from './infrastructure/in-memory-user-repository';
import { InMemorySessionRepository } from './infrastructure/in-memory-session-repository';
import { createAuthRouter } from './infrastructure/auth-controller';
import { createJWTMiddleware, requireRoles, requireExtension } from './infrastructure/jwt-middleware';
import { HttpServerAdapterWithAuth } from '../server/adapters/http-server-adapter-with-auth';
import { WebSocketServerAdapterWithAuth } from '../coordination/adapters/websocket-server-adapter-with-auth';

/**
 * Example 1: Basic Authentication Setup
 */
export async function setupBasicAuthentication() {
  // Initialize repositories
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  
  // Initialize token manager
  const tokenManager = new TokenManager();
  
  // Initialize auth service
  const authService = new AuthService(tokenManager, userRepository, sessionRepository);
  
  // Create Express app
  const app = express();
  
  // Add authentication routes
  const authRouter = createAuthRouter(authService, tokenManager);
  app.use('/auth', authRouter);
  
  // Add protected route
  app.get('/api/protected',
    createJWTMiddleware({ tokenManager }),
    (req, res) => {
      res.json({
        message: 'This is a protected route',
        user: req.user
      });
    }
  );
  
  console.log('✅ Basic authentication setup complete');
}

/**
 * Example 2: Role-Based Access Control
 */
export async function setupRoleBasedAccess() {
  const tokenManager = new TokenManager();
  const app = express();
  
  // Admin-only route
  app.get('/api/admin/users',
    createJWTMiddleware({ tokenManager }),
    requireRoles('admin'),
    (req, res) => {
      res.json({
        message: 'Admin users list',
        userId: req.user?.userId
      });
    }
  );
  
  // Extension-only route
  app.post('/api/extension/report',
    createJWTMiddleware({ tokenManager }),
    requireExtension(),
    (req, res) => {
      res.json({
        message: 'Extension report received',
        extensionId: req.user?.extensionId
      });
    }
  );
  
  console.log('✅ Role-based access control configured');
}

/**
 * Example 3: WebSocket Authentication
 */
export async function setupWebSocketAuth() {
  const tokenManager = new TokenManager();
  const wsAdapter = new WebSocketServerAdapterWithAuth();
  
  // Set token manager for WebSocket authentication
  wsAdapter.setTokenManager(tokenManager);
  
  // Start WebSocket server
  await wsAdapter.startServer(3003);
  
  console.log('✅ WebSocket authentication configured');
}

/**
 * Example 4: Full Server Integration
 */
export async function setupFullServerWithAuth() {
  // Use the enhanced HTTP server adapter with built-in auth
  const httpAdapter = new HttpServerAdapterWithAuth();
  
  // Start server with authentication
  await httpAdapter.startServer(3003);
  
  // Get auth components for additional configuration
  const { tokenManager, authService } = httpAdapter.getAuthComponents();
  
  // Set up WebSocket server with same token manager
  const wsAdapter = new WebSocketServerAdapterWithAuth();
  wsAdapter.setTokenManager(tokenManager!);
  await wsAdapter.startServer(3003);
  
  console.log('✅ Full server with authentication started');
  console.log('📝 Auth endpoints available at: http://localhost:3003/auth');
  console.log('🔐 Protected API at: http://localhost:3003/api/*');
  console.log('🔌 Secure WebSocket at: ws://localhost:3004/ws');
}

/**
 * Example 5: Client-Side Authentication Flow
 */
export async function clientAuthExample() {
  // 1. Register a new user
  const registerResponse = await fetch('http://localhost:3003/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'Test User'
    })
  });
  
  // 2. Login to get tokens
  const loginResponse = await fetch('http://localhost:3003/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important for cookies
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePass123!'
    })
  });
  
  const { accessToken } = await loginResponse.json();
  
  // 3. Make authenticated API call
  const protectedResponse = await fetch('http://localhost:3003/api/metrics', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  // 4. Connect to WebSocket with token
  const ws = new WebSocket(`ws://localhost:3004/ws?token=${accessToken}`);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected with authentication');
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', message);
  });
  
  // 5. Refresh token when needed
  const refreshResponse = await fetch('http://localhost:3003/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Sends the httpOnly refresh token cookie
  });
  
  const { accessToken: newAccessToken } = await refreshResponse.json();
  console.log('🔄 Token refreshed successfully');
}

/**
 * Example 6: Extension Authentication Flow
 */
export async function extensionAuthExample() {
  // 1. Extension gets API key from user (one-time setup)
  const apiKeyResponse = await fetch('http://localhost:3003/auth/generate-api-key', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      extensionId: 'ext_12345'
    })
  });
  
  const { apiKey } = await apiKeyResponse.json();
  
  // 2. Extension authenticates with API key
  const extensionLoginResponse = await fetch('http://localhost:3003/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extensionId: 'ext_12345',
      apiKey: apiKey
    })
  });
  
  const { accessToken } = await extensionLoginResponse.json();
  
  // 3. Extension connects to WebSocket
  const ws = new WebSocket('ws://localhost:3004/ws', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  console.log('✅ Extension authenticated and connected');
}

/**
 * Example 7: Security Best Practices
 */
export async function securityBestPractices() {
  const tokenManager = new TokenManager();
  const app = express();
  
  // 1. Set secure headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  
  // 2. Configure CORS properly
  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.semantest.com'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };
  
  // 3. Add request validation
  app.post('/api/sensitive-action',
    createJWTMiddleware({ tokenManager }),
    requireRoles('admin'),
    (req, res, next) => {
      // Additional validation
      if (!req.body.confirmationToken) {
        return res.status(400).json({ error: 'Confirmation required' });
      }
      next();
    },
    (req, res) => {
      res.json({ message: 'Sensitive action completed' });
    }
  );
  
  // 4. Implement token cleanup
  setInterval(() => {
    tokenManager.cleanupExpiredTokens();
  }, 60 * 60 * 1000); // Every hour
  
  // 5. Monitor authentication failures
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.name === 'UnauthorizedError') {
      console.warn(`⚠️ Auth failure from ${req.ip}: ${err.message}`);
      // In production, implement rate limiting and alerting
    }
    next(err);
  });
  
  console.log('✅ Security best practices implemented');
}

/**
 * Example 8: Testing Authentication
 */
export async function testAuthentication() {
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  const tokenManager = new TokenManager();
  const authService = new AuthService(tokenManager, userRepository, sessionRepository);
  
  // Create test user
  const testUser = await authService.register({
    email: 'test@example.com',
    password: 'TestPass123!',
    name: 'Test User'
  });
  
  // Test login
  const loginResult = await authService.login({
    email: 'test@example.com',
    password: 'TestPass123!'
  });
  
  console.log('✅ Login successful:', {
    userId: loginResult.user.id,
    sessionId: loginResult.sessionId,
    tokenExpiry: loginResult.tokens.accessTokenExpiry
  });
  
  // Test token verification
  const decoded = await tokenManager.verifyAccessToken(loginResult.tokens.accessToken);
  console.log('✅ Token verified:', decoded.userId);
  
  // Test refresh
  const newTokens = await authService.refreshToken(
    loginResult.tokens.refreshToken,
    decoded.userId
  );
  console.log('✅ Token refreshed successfully');
  
  // Test logout
  await authService.logout(loginResult.sessionId);
  console.log('✅ Logout successful');
  
  // Verify token is blacklisted
  try {
    await tokenManager.verifyAccessToken(loginResult.tokens.accessToken);
    console.error('❌ Token should have been blacklisted!');
  } catch (error) {
    console.log('✅ Token correctly blacklisted after logout');
  }
}

// Run examples (uncomment to test)
// setupBasicAuthentication();
// setupFullServerWithAuth();
// testAuthentication();