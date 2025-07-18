/**
 * @fileoverview Domain entities for developer portal
 * @description Type definitions for API documentation, SDK generation, and developer onboarding
 * @author Web-Buddy Team
 */

/**
 * API documentation structure
 */
export interface ApiDocumentation {
  id: string;
  title: string;
  description: string;
  version: string;
  format: 'openapi' | 'postman' | 'insomnia' | 'curl';
  content: string | object;
  endpoints: ApiEndpoint[];
  authentication: AuthenticationMethod[];
  examples: ApiExample[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API endpoint definition
 */
export interface ApiEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  security: SecurityRequirement[];
  deprecated: boolean;
  rateLimit: RateLimitInfo;
  examples: ApiExample[];
}

/**
 * API parameter definition
 */
export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description: string;
  required: boolean;
  schema: ApiSchema;
  example?: any;
  examples?: Record<string, any>;
}

/**
 * API request body definition
 */
export interface ApiRequestBody {
  description: string;
  required: boolean;
  content: Record<string, ApiMediaType>;
}

/**
 * API media type definition
 */
export interface ApiMediaType {
  schema: ApiSchema;
  example?: any;
  examples?: Record<string, any>;
}

/**
 * API response definition
 */
export interface ApiResponse {
  statusCode: number;
  description: string;
  headers?: Record<string, ApiHeader>;
  content?: Record<string, ApiMediaType>;
}

/**
 * API header definition
 */
export interface ApiHeader {
  description: string;
  required: boolean;
  schema: ApiSchema;
}

/**
 * API schema definition
 */
export interface ApiSchema {
  type: string;
  format?: string;
  description?: string;
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema;
  required?: string[];
  enum?: any[];
  example?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * API example definition
 */
export interface ApiExample {
  id: string;
  name: string;
  description: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
  language: string;
  category: string;
}

/**
 * Authentication method definition
 */
export interface AuthenticationMethod {
  type: 'apiKey' | 'bearer' | 'basic' | 'oauth2';
  name: string;
  description: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuth2Flows;
}

/**
 * OAuth2 flows definition
 */
export interface OAuth2Flows {
  implicit?: OAuth2Flow;
  password?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
  authorizationCode?: OAuth2Flow;
}

/**
 * OAuth2 flow definition
 */
export interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * Security requirement definition
 */
export interface SecurityRequirement {
  [key: string]: string[];
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  tier: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  concurrentRequests: number;
}

/**
 * SDK configuration
 */
export interface SdkConfig {
  language: string;
  version: string;
  packageName: string;
  namespace: string;
  baseUrl: string;
  authentication: string;
  features: string[];
  dependencies?: Record<string, string>;
  buildTool?: string;
  outputFormat?: string;
  documentation?: boolean;
  examples?: boolean;
  tests?: boolean;
}

/**
 * SDK generation result
 */
export interface SdkGenerationResult {
  language: string;
  version: string;
  packageName: string;
  files: SdkFile[];
  dependencies: Record<string, string>;
  documentation: string;
  examples: string[];
  downloadUrl: string;
  installInstructions: string;
  createdAt: Date;
}

/**
 * SDK file definition
 */
export interface SdkFile {
  path: string;
  content: string;
  type: 'source' | 'test' | 'documentation' | 'configuration';
  language: string;
}

/**
 * Developer onboarding flow
 */
export interface DeveloperOnboardingFlow {
  userId: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  steps: string[];
  currentStep: string;
  completedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  estimatedDuration: number;
  actualDuration?: number;
  feedback?: OnboardingFeedback;
}

/**
 * Onboarding feedback
 */
export interface OnboardingFeedback {
  rating: number;
  comment: string;
  suggestions: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  completionTime: number;
  helpfulSteps: string[];
  confusingSteps: string[];
}

/**
 * API explorer session
 */
export interface ApiExplorerSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  endpoint: string;
  method: string;
  parameters: Record<string, any>;
  headers: Record<string, string>;
  body?: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    responseTime: number;
  };
  success: boolean;
  error?: string;
}

/**
 * API key dashboard configuration
 */
export interface ApiKeyDashboardConfig {
  userId: string;
  features: string[];
  theme: 'light' | 'dark' | 'auto';
  layout: 'grid' | 'list' | 'table';
  refreshInterval: number;
  notifications: boolean;
  analytics: boolean;
}

/**
 * Developer portal analytics
 */
export interface DeveloperPortalAnalytics {
  period: string;
  startDate: Date;
  endDate: Date;
  totalDevelopers: number;
  activeDevelopers: number;
  newDevelopers: number;
  documentationViews: number;
  sdkDownloads: number;
  apiExplorerSessions: number;
  onboardingCompletions: number;
  averageOnboardingTime: number;
  topEndpoints: Array<{
    endpoint: string;
    views: number;
    tests: number;
  }>;
  topSdkLanguages: Array<{
    language: string;
    downloads: number;
    percentage: number;
  }>;
  feedbackSummary: {
    averageRating: number;
    totalFeedback: number;
    positivePercentage: number;
    negativePercentage: number;
  };
}

/**
 * Documentation template
 */
export interface DocumentationTemplate {
  id: string;
  name: string;
  description: string;
  format: string;
  template: string;
  variables: string[];
  examples: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Code sample
 */
export interface CodeSample {
  id: string;
  endpoint: string;
  language: string;
  title: string;
  description: string;
  code: string;
  dependencies: string[];
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  votes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tutorial definition
 */
export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // minutes
  prerequisites: string[];
  steps: TutorialStep[];
  category: string;
  tags: string[];
  rating: number;
  completions: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tutorial step
 */
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  content: string;
  code?: string;
  language?: string;
  expectedOutput?: string;
  hints: string[];
  validation?: string;
  order: number;
}

/**
 * Developer community post
 */
export interface CommunityPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  type: 'question' | 'answer' | 'tutorial' | 'showcase';
  votes: number;
  views: number;
  replies: number;
  isResolved: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Developer support ticket
 */
export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  assignedTo?: string;
  tags: string[];
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

/**
 * API changelog entry
 */
export interface ApiChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'breaking' | 'deprecation';
  endpoints: string[];
  impact: 'low' | 'medium' | 'high';
  migrationGuide?: string;
  releaseDate: Date;
  isPublished: boolean;
}

/**
 * Developer portal configuration
 */
export interface DeveloperPortalConfig {
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  features: {
    apiExplorer: boolean;
    sdkGeneration: boolean;
    tutorials: boolean;
    community: boolean;
    support: boolean;
    changelog: boolean;
  };
  authentication: {
    required: boolean;
    methods: string[];
    providers: string[];
  };
  customization: {
    customCss: string;
    customJs: string;
    customHtml: string;
  };
  integrations: {
    analytics: string;
    feedback: string;
    chat: string;
  };
}