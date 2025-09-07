/**
 * @fileoverview Server lifecycle and management events
 * @description Core events for server startup, shutdown, health checks, and monitoring
 * @author Web-Buddy Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Event triggered when server startup is requested
 */
export class ServerStartRequestedEvent extends Event {
  public readonly type = 'ServerStartRequested';
  
  constructor(
    public readonly port: number,
    public readonly configuration?: ServerConfiguration
  ) {
    super();
  }
}

/**
 * Event triggered when server shutdown is requested
 */
export class ServerStopRequestedEvent extends Event {
  public readonly type = 'ServerStopRequested';
  
  constructor(
    public readonly reason?: string,
    public readonly gracefulShutdown: boolean = true
  ) {
    super();
  }
}

/**
 * Event triggered when server health check is requested
 */
export class ServerHealthCheckRequestedEvent extends Event {
  public readonly type = 'ServerHealthCheckRequested';
  
  constructor(
    public readonly requestId: string,
    public readonly includeDetails: boolean = false
  ) {
    super();
  }
}

/**
 * Event triggered when server metrics are requested
 */
export class ServerMetricsRequestedEvent extends Event {
  public readonly type = 'ServerMetricsRequested';
  
  constructor(
    public readonly requestId: string,
    public readonly metricsType: MetricsType = 'all'
  ) {
    super();
  }
}

/**
 * Event triggered when server successfully starts
 */
export class ServerStartedEvent extends Event {
  public readonly type = 'ServerStarted';
  
  constructor(
    public readonly port: number,
    public readonly startTime: Date,
    public readonly processId: number
  ) {
    super();
  }
}

/**
 * Event triggered when server successfully stops
 */
export class ServerStoppedEvent extends Event {
  public readonly type = 'ServerStopped';
  
  constructor(
    public readonly shutdownTime: Date,
    public readonly uptime: number,
    public readonly reason?: string
  ) {
    super();
  }
}

/**
 * Event triggered when server encounters an error
 */
export class ServerErrorEvent extends Event {
  public readonly type = 'ServerError';
  
  constructor(
    public readonly error: Error,
    public readonly component: string,
    public readonly severity: ErrorSeverity = 'medium'
  ) {
    super();
  }
}

/**
 * Event triggered when server configuration changes
 */
export class ServerConfigurationChangedEvent extends Event {
  public readonly type = 'ServerConfigurationChanged';
  
  constructor(
    public readonly previousConfiguration: ServerConfiguration,
    public readonly newConfiguration: ServerConfiguration,
    public readonly changedFields: string[]
  ) {
    super();
  }
}

/**
 * Event triggered when server performance warning occurs
 */
export class ServerPerformanceWarningEvent extends Event {
  public readonly type = 'ServerPerformanceWarning';
  
  constructor(
    public readonly metric: PerformanceMetric,
    public readonly threshold: number,
    public readonly currentValue: number,
    public readonly recommendation?: string
  ) {
    super();
  }
}

/**
 * Event triggered when server security alert occurs
 */
export class ServerSecurityAlertEvent extends Event {
  public readonly type = 'ServerSecurityAlert';
  
  constructor(
    public readonly alertType: SecurityAlertType,
    public readonly description: string,
    public readonly sourceIP?: string,
    public readonly severity: SecuritySeverity = 'medium'
  ) {
    super();
  }
}

// Supporting types

export interface ServerConfiguration {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  logging: LoggingConfiguration;
  security: SecurityConfiguration;
  performance: PerformanceConfiguration;
  features: FeatureConfiguration;
}

export interface LoggingConfiguration {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destinations: string[];
  enableRequestLogging: boolean;
  enableErrorTracking: boolean;
}

export interface SecurityConfiguration {
  enableHTTPS: boolean;
  corsOrigins: string[];
  rateLimiting: RateLimitConfiguration;
  authentication: AuthenticationConfiguration;
  headers: SecurityHeadersConfiguration;
}

export interface RateLimitConfiguration {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
}

export interface AuthenticationConfiguration {
  enabled: boolean;
  method: 'jwt' | 'apikey' | 'oauth';
  jwtSecret?: string;
  tokenExpiration?: number;
}

export interface SecurityHeadersConfiguration {
  enableHelmet: boolean;
  contentSecurityPolicy: boolean;
  xssProtection: boolean;
  frameOptions: boolean;
}

export interface PerformanceConfiguration {
  enableCompression: boolean;
  enableCaching: boolean;
  maxRequestSize: string;
  requestTimeout: number;
  keepAliveTimeout: number;
}

export interface FeatureConfiguration {
  enableWebSocket: boolean;
  enableFileUploads: boolean;
  enableExtensionManagement: boolean;
  enablePatternSharing: boolean;
  enableAnalytics: boolean;
}

export type MetricsType = 'all' | 'performance' | 'health' | 'usage' | 'errors';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PerformanceMetric = 
  | 'cpu_usage'
  | 'memory_usage'
  | 'response_time'
  | 'request_rate'
  | 'error_rate'
  | 'active_connections';

export type SecurityAlertType = 
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'suspicious_activity'
  | 'malformed_request'
  | 'injection_attempt'
  | 'ddos_attempt';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Event fired when an image generation is requested from CLI
 */
export class ImageGenerationRequestedEvent extends Event {
  public readonly type = 'ImageGenerationRequestedEvent';

  constructor(
    public readonly requestId: string,
    public readonly prompt: string,
    public readonly model: string,
    public readonly parameters: {
      width?: number;
      height?: number;
      quality?: 'standard' | 'hd';
      style?: 'natural' | 'vivid';
      numberOfImages?: number;
    },
    public readonly userId: string,
    private readonly _correlationId: string
  ) {
    super();
  }

  get correlationId(): string {
    return this._correlationId;
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      requestId: this.requestId,
      prompt: this.prompt,
      model: this.model,
      parameters: this.parameters,
      userId: this.userId,
      correlationId: this.correlationId,
      timestamp: this.occurredOn.toISOString()
    };
  }
}

/**
 * Event fired when an image has been generated by the Chrome extension
 */
export class ImageGeneratedEvent extends Event {
  public readonly type = 'ImageGeneratedEvent';

  constructor(
    public readonly requestId: string,
    public readonly imageUrl: string,
    public readonly metadata: {
      model: string;
      prompt: string;
      width: number;
      height: number;
      generatedAt: Date;
    },
    public readonly extensionId: string,
    private readonly _correlationId: string,
    public readonly imagePath?: string
  ) {
    super();
  }

  get correlationId(): string {
    return this._correlationId;
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      requestId: this.requestId,
      imageUrl: this.imageUrl,
      imagePath: this.imagePath,
      metadata: {
        ...this.metadata,
        generatedAt: this.metadata.generatedAt.toISOString()
      },
      extensionId: this.extensionId,
      correlationId: this.correlationId,
      timestamp: this.occurredOn.toISOString()
    };
  }
}