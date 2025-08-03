/**
 * @fileoverview API Key Authentication Middleware
 * @description Validates API keys with special handling for Metaphysical integration
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../monitoring/infrastructure/structured-logger';
import { AppError } from '../../../shared/errors/app-error';
import crypto from 'crypto';

interface ApiKeyConfig {
  clientId: string;
  clientName: string;
  tier: 'basic' | 'pro' | 'enterprise' | 'unlimited';
  rateLimit: {
    requestsPerMinute: number;
    concurrentJobs: number;
    burstAllowance: number;
  };
  permissions: string[];
  metadata?: Record<string, any>;
}

/**
 * In production, these would be stored in a secure database
 * For now, using environment variables and hardcoded configs
 */
const API_KEY_CONFIGS: Record<string, ApiKeyConfig> = {
  // Metaphysical gets unlimited tier with special privileges
  [process.env.METAPHYSICAL_API_KEY || 'meta-prod-key']: {
    clientId: 'metaphysical-production',
    clientName: 'Metaphysical',
    tier: 'unlimited',
    rateLimit: {
      requestsPerMinute: 1000,
      concurrentJobs: 50,
      burstAllowance: 100
    },
    permissions: [
      'images:generate',
      'images:batch',
      'providers:all',
      'webhooks:priority',
      'websocket:subscribe',
      'admin:metrics'
    ],
    metadata: {
      partner: true,
      priorityQueue: true,
      dedicatedProviders: ['dalle-dedicated-1', 'sd-dedicated-1']
    }
  },
  // Standard tier for other clients
  [process.env.STANDARD_API_KEY || 'standard-key']: {
    clientId: 'standard-client',
    clientName: 'Standard Client',
    tier: 'pro',
    rateLimit: {
      requestsPerMinute: 60,
      concurrentJobs: 10,
      burstAllowance: 20
    },
    permissions: [
      'images:generate',
      'images:batch',
      'providers:list'
    ]
  }
};

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Check query parameter (not recommended for production)
  if (req.query.apiKey && typeof req.query.apiKey === 'string') {
    return req.query.apiKey;
  }

  return null;
}

/**
 * Validate API key and attach client info to request
 */
export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AppError('API key required', 401, 'MISSING_API_KEY');
    }

    // Hash the API key for logging (never log raw keys)
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex')
      .substring(0, 8);

    // Look up API key configuration
    const config = API_KEY_CONFIGS[apiKey];

    if (!config) {
      logger.warn('Invalid API key attempt', {
        keyHash,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Check if client has permission for this endpoint
    const requiredPermission = getRequiredPermission(req);
    if (requiredPermission && !config.permissions.includes(requiredPermission)) {
      logger.warn('Permission denied', {
        clientId: config.clientId,
        requiredPermission,
        endpoint: req.path
      });
      throw new AppError('Insufficient permissions', 403, 'PERMISSION_DENIED');
    }

    // Attach client info to request
    req.apiClient = {
      id: config.clientId,
      name: config.clientName,
      tier: config.tier,
      rateLimit: config.rateLimit,
      permissions: config.permissions,
      metadata: config.metadata
    };

    // Special handling for Metaphysical
    if (config.clientId === 'metaphysical-production') {
      req.headers['x-priority-client'] = 'true';
      req.headers['x-queue-priority'] = 'high';
      
      logger.info('Metaphysical API request', {
        endpoint: req.path,
        method: req.method,
        clientId: config.clientId
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Get required permission for endpoint
 */
function getRequiredPermission(req: Request): string | null {
  const endpoint = req.path;
  const method = req.method;

  // Map endpoints to permissions
  const permissionMap: Record<string, string> = {
    'POST:/api/v1/images/generate': 'images:generate',
    'POST:/api/v1/images/batch': 'images:batch',
    'POST:/api/v1/chat/new': 'images:generate',
    'GET:/api/v1/providers': 'providers:list',
    'GET:/api/v1/providers/recommend': 'providers:all',
    'GET:/api/v1/admin/metrics': 'admin:metrics'
  };

  return permissionMap[`${method}:${endpoint}`] || null;
}

/**
 * Rate limiting middleware that uses API key config
 */
export function createRateLimiter() {
  const clientRequests = new Map<string, number[]>();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiClient) {
      return next();
    }

    const clientId = req.apiClient.id;
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Get or create request timestamps for client
    if (!clientRequests.has(clientId)) {
      clientRequests.set(clientId, []);
    }

    const requests = clientRequests.get(clientId)!;
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => 
      now - timestamp < windowMs
    );

    // Check rate limit
    const limit = req.apiClient.rateLimit.requestsPerMinute;
    if (validRequests.length >= limit) {
      const resetTime = Math.min(...validRequests) + windowMs;
      
      logger.warn('Rate limit exceeded', {
        clientId,
        requests: validRequests.length,
        limit
      });

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: Math.ceil((resetTime - now) / 1000)
        }
      });
    }

    // Add current request
    validRequests.push(now);
    clientRequests.set(clientId, validRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - validRequests.length).toString());
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiClient?: {
        id: string;
        name: string;
        tier: string;
        rateLimit: {
          requestsPerMinute: number;
          concurrentJobs: number;
          burstAllowance: number;
        };
        permissions: string[];
        metadata?: Record<string, any>;
      };
    }
  }
}