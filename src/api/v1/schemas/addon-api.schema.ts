/**
 * @fileoverview Addon Serving API Schema Definitions
 * @description TypeScript schema for browser extension addon delivery
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { z } from 'zod';

// ===== Enums and Constants =====

export enum AddonStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  BETA = 'beta'
}

export enum AddonType {
  CONTENT_SCRIPT = 'content_script',
  BACKGROUND_SCRIPT = 'background_script',
  INJECTED_SCRIPT = 'injected_script',
  STYLE_SHEET = 'style_sheet'
}

export enum ContentType {
  JAVASCRIPT = 'application/javascript',
  CSS = 'text/css',
  JSON = 'application/json'
}

// ===== Request Schemas =====

/**
 * Addon fetch request headers
 */
export const AddonRequestHeadersSchema = z.object({
  'x-target-domain': z.string().optional(), // Phase 2
  'x-browser-id': z.string().optional(),
  'x-extension-version': z.string().optional(),
  'if-none-match': z.string().optional(), // ETag support
  'if-modified-since': z.string().optional()
});

export type AddonRequestHeaders = z.infer<typeof AddonRequestHeadersSchema>;

/**
 * Query parameters for addon fetching
 */
export const AddonQueryParamsSchema = z.object({
  version: z.string().optional(),
  minified: z.boolean().default(true),
  targetDomain: z.string().optional() // Phase 2
});

export type AddonQueryParams = z.infer<typeof AddonQueryParamsSchema>;

// ===== Response Schemas =====

/**
 * Addon response headers
 */
export interface AddonResponseHeaders {
  'x-addon-id': string;
  'x-addon-version': string;
  'x-content-hash': string;
  'x-addon-type': AddonType;
  'cache-control': string;
  'etag': string;
  'last-modified': string;
  'content-type': ContentType;
  'content-length': string;
  'x-deprecation-warning'?: string;
}

/**
 * Addon metadata response
 */
export interface AddonMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  type: AddonType;
  status: AddonStatus;
  contentHash: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  
  // Phase 2 properties
  domainPatterns?: string[];
  injectionRules?: InjectionRule[];
  dependencies?: AddonDependency[];
  
  // Configuration
  config?: {
    minBrowserVersion?: string;
    maxBrowserVersion?: string;
    requiredPermissions?: string[];
    experimentalFeatures?: boolean;
  };
  
  // Performance hints
  performance?: {
    estimatedLoadTime?: number;
    memoryUsage?: number;
    cpuUsage?: 'low' | 'medium' | 'high';
  };
}

/**
 * Injection rule for Phase 2
 */
export interface InjectionRule {
  id: string;
  priority: number;
  domains: string[];
  urlPatterns?: string[];
  excludePatterns?: string[];
  runAt: 'document_start' | 'document_end' | 'document_idle';
  allFrames?: boolean;
  conditions?: InjectionCondition[];
}

/**
 * Injection condition for advanced targeting
 */
export interface InjectionCondition {
  type: 'user_agent' | 'viewport' | 'feature_flag' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

/**
 * Addon dependency
 */
export interface AddonDependency {
  addonId: string;
  version: string;
  optional?: boolean;
}

/**
 * Addon list response
 */
export interface AddonListResponse {
  addons: AddonMetadata[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Addon bundle response (Phase 2)
 */
export interface AddonBundleResponse {
  bundleId: string;
  domain: string;
  addons: AddonBundleItem[];
  totalSize: number;
  contentHash: string;
  generatedAt: string;
  expiresAt: string;
}

/**
 * Item in an addon bundle
 */
export interface AddonBundleItem {
  addonId: string;
  version: string;
  type: AddonType;
  content: string;
  order: number;
  dependencies: string[];
}

/**
 * Addon validation result
 */
export interface AddonValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  metadata?: AddonMetadata;
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'critical';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

// ===== Admin API Schemas =====

/**
 * Create/Update addon request
 */
export const CreateAddonRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: z.nativeEnum(AddonType),
  content: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning
  status: z.nativeEnum(AddonStatus).default(AddonStatus.ACTIVE),
  domainPatterns: z.array(z.string()).optional(),
  injectionRules: z.array(z.any()).optional(), // Complex validation done server-side
  config: z.object({
    minBrowserVersion: z.string().optional(),
    maxBrowserVersion: z.string().optional(),
    requiredPermissions: z.array(z.string()).optional(),
    experimentalFeatures: z.boolean().optional()
  }).optional()
});

export type CreateAddonRequest = z.infer<typeof CreateAddonRequestSchema>;

/**
 * Update addon status request
 */
export const UpdateAddonStatusRequestSchema = z.object({
  status: z.nativeEnum(AddonStatus),
  reason: z.string().optional(),
  deprecationMessage: z.string().optional()
});

export type UpdateAddonStatusRequest = z.infer<typeof UpdateAddonStatusRequestSchema>;

// ===== Error Response Schema =====

export interface AddonApiError {
  error: {
    code: 'ADDON_NOT_FOUND' | 'INVALID_VERSION' | 'DOMAIN_NOT_ALLOWED' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
    message: string;
    details?: any;
    retryAfter?: string;
  };
}

// ===== Validation Helpers =====

export const validateAddonRequest = (headers: unknown, query: unknown) => {
  return {
    headers: AddonRequestHeadersSchema.parse(headers),
    query: AddonQueryParamsSchema.parse(query)
  };
};

export const validateCreateAddonRequest = (data: unknown): CreateAddonRequest => {
  return CreateAddonRequestSchema.parse(data);
};

export const validateUpdateStatusRequest = (data: unknown): UpdateAddonStatusRequest => {
  return UpdateAddonStatusRequestSchema.parse(data);
};