/**
 * @fileoverview Domain entities for authentication and authorization
 * @description Type definitions for users, tokens, API keys, and roles
 * @author Web-Buddy Team
 */

/**
 * User entity
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Authentication token response
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: string; // 'Bearer'
}

/**
 * JWT token payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  scopes: string[];
  iat: number; // issued at
  exp: number; // expires at
  iss: string; // issuer
  sub: string; // subject
  jti: string; // JWT ID
}

/**
 * API key entity
 */
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  scopes: string[];
  tier: 'free' | 'premium' | 'enterprise';
  isActive: boolean;
  rateLimit: RateLimit;
  usageStats: UsageStats;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  concurrentRequests: number;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  totalRequests: number;
  requestsThisMonth: number;
  requestsToday: number;
  errorCount: number;
  lastError?: Date;
  averageResponseTime: number;
}

/**
 * Role definition
 */
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission definition
 */
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: string[];
  description: string;
}

/**
 * OAuth2 provider configuration
 */
export interface OAuth2Provider {
  id: string;
  name: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  redirectUri: string;
  isActive: boolean;
}

/**
 * OAuth2 user info from provider
 */
export interface OAuth2UserInfo {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  verified_email?: boolean;
}

/**
 * Session information
 */
export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

/**
 * Authentication request data
 */
export interface AuthRequest {
  method: 'password' | 'apiKey' | 'oauth2';
  credentials: {
    email?: string;
    password?: string;
    apiKey?: string;
    provider?: string;
    code?: string;
    redirectUri?: string;
  };
  metadata?: {
    ipAddress: string;
    userAgent: string;
    deviceId?: string;
  };
}

/**
 * Authorization context
 */
export interface AuthContext {
  userId: string;
  roles: string[];
  permissions: string[];
  apiKeyId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Rate limiting tiers
 */
export const RATE_LIMIT_TIERS = {
  free: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10,
    concurrentRequests: 5
  },
  premium: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    burstLimit: 50,
    concurrentRequests: 20
  },
  enterprise: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 1000000,
    burstLimit: 200,
    concurrentRequests: 100
  }
} as const;

/**
 * Default role permissions
 */
export const DEFAULT_PERMISSIONS = {
  user: [
    'read:profile',
    'update:profile',
    'read:own-api-keys',
    'create:own-api-keys',
    'delete:own-api-keys'
  ],
  admin: [
    'read:users',
    'update:users',
    'delete:users',
    'read:api-keys',
    'create:api-keys',
    'delete:api-keys',
    'read:roles',
    'update:roles',
    'read:system-metrics'
  ],
  super_admin: [
    '*' // All permissions
  ]
} as const;