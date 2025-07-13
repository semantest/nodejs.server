/**
 * @fileoverview Security Module Index
 * @description Main entry point for the Semantest security module
 * @author Web-Buddy Team
 */

// Rate limiting core services
export * from './rate-limiting-service';
export * from './rate-limit-stores';
export * from './rate-limit-config';

// Middleware and integration
export * from './rate-limiting-middleware';

// Monitoring and alerting
export * from './monitoring';

// Type definitions
export * from './types';

// Existing security services
export * from './audit-service';
export * from './compliance-validator';
export * from './security-event-analyzer';

// Re-export domain models
export * from './domain/audit-entry';
export * from './domain/audit-repository';

/**
 * Main factory function to create a complete rate limiting setup
 */
export function createRateLimitingSystem(options: {
  storeType?: 'redis' | 'memory';
  redisConfig?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  memoryConfig?: {
    maxSize?: number;
    cleanupIntervalMs?: number;
    maxAge?: number;
  };
  monitoring?: {
    enabled?: boolean;
    alertWebhookUrl?: string;
    slackWebhookUrl?: string;
  };
} = {}) {
  const { createRateLimitStore } = require('./rate-limit-stores');
  const { RateLimitMiddleware } = require('./rate-limiting-middleware');
  const { RateLimitMonitor } = require('./monitoring');

  // Create store
  const store = createRateLimitStore({
    type: options.storeType || 'memory',
    redis: options.redisConfig,
    memory: options.memoryConfig
  });

  // Create middleware
  const middleware = new RateLimitMiddleware({
    store,
    headers: true,
    standardHeaders: true
  });

  // Create monitor
  const monitor = new RateLimitMonitor({
    enabled: options.monitoring?.enabled !== false,
    notifications: {
      webhook: options.monitoring?.alertWebhookUrl ? {
        url: options.monitoring.alertWebhookUrl
      } : undefined,
      slack: options.monitoring?.slackWebhookUrl ? {
        webhook: options.monitoring.slackWebhookUrl,
        channel: '#alerts'
      } : undefined
    }
  });

  return {
    store,
    middleware,
    monitor,
    createMiddleware: () => middleware.createMiddleware(),
    getStats: () => monitor.getMetrics(),
    getHealth: () => monitor.getHealthStatus(),
    cleanup: async () => {
      await store.cleanup();
      await middleware.cleanup();
    }
  };
}

/**
 * Default rate limiting configuration for quick setup
 */
export const DEFAULT_RATE_LIMIT_SETUP = {
  development: {
    storeType: 'memory' as const,
    memoryConfig: {
      maxSize: 5000,
      cleanupIntervalMs: 30000,
      maxAge: 1800000 // 30 minutes
    },
    monitoring: {
      enabled: true
    }
  },
  production: {
    storeType: 'redis' as const,
    redisConfig: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '1')
    },
    monitoring: {
      enabled: true,
      alertWebhookUrl: process.env.RATE_LIMIT_WEBHOOK_URL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
    }
  }
};

/**
 * Create rate limiting system with environment-based defaults
 */
export function createDefaultRateLimitingSystem() {
  const env = process.env.NODE_ENV || 'development';
  const config = env === 'production' 
    ? DEFAULT_RATE_LIMIT_SETUP.production 
    : DEFAULT_RATE_LIMIT_SETUP.development;
  
  return createRateLimitingSystem(config);
}