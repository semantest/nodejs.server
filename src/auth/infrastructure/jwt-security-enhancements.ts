/**
 * JWT Security Enhancements
 * Additional security features for production-ready JWT implementation
 * Based on Phase 9 security audit recommendations
 */

import { Request, Response, NextFunction } from 'express';
import { TokenManager } from './token-manager';
import crypto from 'crypto';

/**
 * Enhanced JWT security configuration
 */
export interface JWTSecurityConfig {
  tokenManager: TokenManager;
  bindToIP?: boolean;
  bindToDevice?: boolean;
  maxTokensPerUser?: number;
  shortLivedTokenPaths?: string[];
  auditLogger?: SecurityAuditLogger;
  anomalyDetector?: AnomalyDetector;
}

/**
 * Security audit logger interface
 */
export interface SecurityAuditLogger {
  logAuthEvent(event: SecurityEvent): Promise<void>;
  logAnomalousActivity(activity: AnomalousActivity): Promise<void>;
}

/**
 * Anomaly detector interface
 */
export interface AnomalyDetector {
  checkForAnomalies(context: SecurityContext): Promise<AnomalyScore>;
}

/**
 * Security event types
 */
export interface SecurityEvent {
  type: 'login' | 'logout' | 'token_refresh' | 'token_revoked' | 'access_denied' | 'suspicious_activity';
  userId?: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Anomalous activity types
 */
export interface AnomalousActivity {
  type: 'multiple_ips' | 'rapid_requests' | 'unusual_pattern' | 'token_reuse';
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

/**
 * Security context for requests
 */
export interface SecurityContext {
  userId?: string;
  ip: string;
  userAgent?: string;
  requestPath: string;
  requestMethod: string;
  tokenAge?: number;
}

/**
 * Anomaly score result
 */
export interface AnomalyScore {
  score: number; // 0-100
  reasons: string[];
  requiresAdditionalAuth?: boolean;
}

/**
 * Create enhanced JWT middleware with additional security features
 */
export function createEnhancedJWTMiddleware(config: JWTSecurityConfig) {
  const { 
    tokenManager, 
    bindToIP = true, 
    bindToDevice = true,
    maxTokensPerUser = 5,
    shortLivedTokenPaths = ['/api/admin/*', '/api/sensitive/*'],
    auditLogger,
    anomalyDetector
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token
      const token = extractToken(req);
      if (!token) {
        await logSecurityEvent(auditLogger, {
          type: 'access_denied',
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          details: { reason: 'missing_token', path: req.path }
        });
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Verify token
      const decoded = await tokenManager.verifyAccessToken(token);
      
      // Check if token is blacklisted
      const isBlacklisted = await tokenManager.isTokenBlacklisted(token);
      if (isBlacklisted) {
        await logSecurityEvent(auditLogger, {
          type: 'access_denied',
          userId: decoded.userId,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          details: { reason: 'blacklisted_token' }
        });
        return res.status(401).json({ error: 'Token has been revoked' });
      }

      // IP binding check
      if (bindToIP && decoded.ip && decoded.ip !== getClientIP(req)) {
        await logSecurityEvent(auditLogger, {
          type: 'suspicious_activity',
          userId: decoded.userId,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          details: { 
            reason: 'ip_mismatch',
            original_ip: decoded.ip,
            current_ip: getClientIP(req)
          }
        });
        return res.status(401).json({ error: 'Token IP mismatch' });
      }

      // Device binding check
      if (bindToDevice && decoded.deviceFingerprint) {
        const currentFingerprint = generateDeviceFingerprint(req);
        if (decoded.deviceFingerprint !== currentFingerprint) {
          await logSecurityEvent(auditLogger, {
            type: 'suspicious_activity',
            userId: decoded.userId,
            ip: getClientIP(req),
            userAgent: req.headers['user-agent'],
            timestamp: new Date(),
            details: { reason: 'device_mismatch' }
          });
          return res.status(401).json({ error: 'Token device mismatch' });
        }
      }

      // Check for short-lived token paths
      if (isShortLivedPath(req.path, shortLivedTokenPaths)) {
        const tokenAge = Date.now() - (decoded.iat * 1000);
        const maxAge = 5 * 60 * 1000; // 5 minutes for sensitive operations
        
        if (tokenAge > maxAge) {
          await logSecurityEvent(auditLogger, {
            type: 'access_denied',
            userId: decoded.userId,
            ip: getClientIP(req),
            timestamp: new Date(),
            details: { 
              reason: 'token_too_old_for_sensitive_operation',
              token_age: tokenAge,
              max_allowed: maxAge
            }
          });
          return res.status(401).json({ 
            error: 'Token too old for this operation. Please re-authenticate.' 
          });
        }
      }

      // Anomaly detection
      if (anomalyDetector) {
        const context: SecurityContext = {
          userId: decoded.userId,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          requestPath: req.path,
          requestMethod: req.method,
          tokenAge: Date.now() - (decoded.iat * 1000)
        };

        const anomalyScore = await anomalyDetector.checkForAnomalies(context);
        
        if (anomalyScore.score > 80) {
          await logSecurityEvent(auditLogger, {
            type: 'suspicious_activity',
            userId: decoded.userId,
            ip: getClientIP(req),
            timestamp: new Date(),
            details: { 
              anomaly_score: anomalyScore.score,
              reasons: anomalyScore.reasons
            }
          });
          
          if (anomalyScore.requiresAdditionalAuth) {
            return res.status(403).json({ 
              error: 'Additional authentication required',
              reason: 'suspicious_activity_detected'
            });
          }
        }
      }

      // Attach user info to request
      req.user = {
        userId: decoded.userId,
        extensionId: decoded.extensionId,
        sessionId: decoded.sessionId,
        roles: decoded.roles || [],
        tokenId: decoded.jti
      };

      next();
    } catch (error) {
      await logSecurityEvent(auditLogger, {
        type: 'access_denied',
        ip: getClientIP(req),
        timestamp: new Date(),
        details: { 
          reason: 'token_verification_failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

/**
 * Create global API protection middleware
 * Ensures all /api/* routes are protected by default
 */
export function createGlobalAPIProtection(config: JWTSecurityConfig) {
  const enhancedJWT = createEnhancedJWTMiddleware(config);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for public paths
    const publicPaths = ['/health', '/info', '/auth'];
    const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
    
    if (isPublicPath) {
      return next();
    }
    
    // All other paths require authentication
    if (req.path.startsWith('/api/')) {
      return enhancedJWT(req, res, next);
    }
    
    next();
  };
}

/**
 * Token binding middleware - adds IP and device info to tokens
 */
export function createTokenBindingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add binding info to request for token generation
    req.tokenBinding = {
      ip: getClientIP(req),
      deviceFingerprint: generateDeviceFingerprint(req)
    };
    next();
  };
}

/**
 * Security monitoring middleware
 */
export function createSecurityMonitoringMiddleware(auditLogger?: SecurityAuditLogger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Log request start
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      if (req.user && auditLogger) {
        await logSecurityEvent(auditLogger, {
          type: 'access_denied',
          userId: req.user.userId,
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          details: {
            path: req.path,
            method: req.method,
            status: res.statusCode,
            duration,
            success: res.statusCode < 400
          }
        });
      }
    });
    
    next();
  };
}

// Helper functions

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function getClientIP(req: Request): string {
  return req.ip || 
         req.headers['x-forwarded-for']?.toString().split(',')[0] || 
         req.socket?.remoteAddress || 
         'unknown';
}

function generateDeviceFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

function isShortLivedPath(path: string, patterns: string[]): boolean {
  if (!path) return false;
  return patterns.some(pattern => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

async function logSecurityEvent(
  logger: SecurityAuditLogger | undefined, 
  event: SecurityEvent
): Promise<void> {
  if (logger) {
    try {
      await logger.logAuthEvent(event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  } else {
    // Fallback to console logging
    console.log(`[SECURITY] ${event.type}:`, event);
  }
}

// Export utility functions for testing
export const utils = {
  extractToken,
  getClientIP,
  generateDeviceFingerprint,
  isShortLivedPath
};