/**
 * Structured Logging System for Semantest Platform
 * Provides JSON-formatted logging with correlation tracking, performance metrics, and security events
 */

import { createLogger, format, transports, Logger } from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

// Correlation ID storage for request tracking
const correlationStore = new AsyncLocalStorage<string>();

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly'
}

export enum LogCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  SYSTEM = 'system',
  API = 'api',
  DATABASE = 'database',
  WEBSOCKET = 'websocket',
  AUTHENTICATION = 'authentication',
  ERROR = 'error',
  AUDIT = 'audit'
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  extensionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  performance?: {
    duration?: number;
    startTime?: number;
    endTime?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  security?: {
    ipAddress?: string;
    userAgent?: string;
    threat?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
  business?: {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    value?: number;
    currency?: string;
  };
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context: LogContext;
  service: string;
  version: string;
  environment: string;
  hostname: string;
  pid: number;
  stack?: string;
  tags?: string[];
}

/**
 * Structured Logger implementation with correlation tracking
 */
export class StructuredLogger {
  private logger: Logger;
  private serviceName: string;
  private version: string;
  private environment: string;
  private hostname: string;

  constructor(options: {
    serviceName: string;
    version: string;
    environment: string;
    logLevel?: LogLevel;
    logToFile?: boolean;
    logDirectory?: string;
  }) {
    this.serviceName = options.serviceName;
    this.version = options.version;
    this.environment = options.environment;
    this.hostname = require('os').hostname();

    // Create Winston logger with structured format
    this.logger = createLogger({
      level: options.logLevel || LogLevel.INFO,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        format.errors({ stack: true }),
        format.json(),
        format.printf(this.formatLogEntry.bind(this))
      ),
      transports: [
        // Console transport for development
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        // File transport for production
        ...(options.logToFile ? [
          new transports.File({
            filename: `${options.logDirectory || './logs'}/error.log`,
            level: LogLevel.ERROR,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
          }),
          new transports.File({
            filename: `${options.logDirectory || './logs'}/combined.log`,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            tailable: true
          })
        ] : [])
      ],
      // Handle uncaught exceptions
      exceptionHandlers: [
        new transports.File({
          filename: `${options.logDirectory || './logs'}/exceptions.log`
        })
      ],
      rejectionHandlers: [
        new transports.File({
          filename: `${options.logDirectory || './logs'}/rejections.log`
        })
      ]
    });
  }

  /**
   * Format log entry as structured JSON
   */
  private formatLogEntry(info: any): string {
    const entry: StructuredLogEntry = {
      timestamp: info.timestamp,
      level: info.level as LogLevel,
      category: info.category || LogCategory.SYSTEM,
      message: info.message,
      context: info.context || {},
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      hostname: this.hostname,
      pid: process.pid,
      stack: info.stack,
      tags: info.tags
    };

    // Add correlation ID if available
    const correlationId = correlationStore.getStore();
    if (correlationId) {
      entry.context.correlationId = correlationId;
    }

    return JSON.stringify(entry);
  }

  /**
   * Log with structured format
   */
  private logStructured(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: LogContext,
    tags?: string[]
  ): void {
    this.logger.log({
      level,
      category,
      message,
      context: context || {},
      tags: tags || []
    });
  }

  /**
   * Log error with stack trace
   */
  error(message: string, error?: Error, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.ERROR,
      LogCategory.ERROR,
      message,
      {
        ...context,
        metadata: {
          ...context?.metadata,
          error: error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : undefined
        }
      },
      tags
    );
  }

  /**
   * Log warning
   */
  warn(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(LogLevel.WARN, LogCategory.SYSTEM, message, context, tags);
  }

  /**
   * Log info
   */
  info(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(LogLevel.INFO, LogCategory.SYSTEM, message, context, tags);
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(LogLevel.DEBUG, LogCategory.SYSTEM, message, context, tags);
  }

  /**
   * Log HTTP request/response
   */
  http(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(LogLevel.HTTP, LogCategory.API, message, context, tags);
  }

  /**
   * Log security event
   */
  security(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.WARN,
      LogCategory.SECURITY,
      message,
      context,
      [...(tags || []), 'security']
    );
  }

  /**
   * Log performance metrics
   */
  performance(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.INFO,
      LogCategory.PERFORMANCE,
      message,
      context,
      [...(tags || []), 'performance']
    );
  }

  /**
   * Log business event
   */
  business(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.INFO,
      LogCategory.BUSINESS,
      message,
      context,
      [...(tags || []), 'business']
    );
  }

  /**
   * Log authentication event
   */
  auth(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.INFO,
      LogCategory.AUTHENTICATION,
      message,
      context,
      [...(tags || []), 'authentication']
    );
  }

  /**
   * Log audit event
   */
  audit(message: string, context?: LogContext, tags?: string[]): void {
    this.logStructured(
      LogLevel.INFO,
      LogCategory.AUDIT,
      message,
      context,
      [...(tags || []), 'audit']
    );
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): StructuredLogger {
    // For now, just return this instance
    // Child logger functionality would need proper implementation
    return this;
  }

  /**
   * Create performance timer
   */
  createTimer(name: string, context?: LogContext): () => void {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    return () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;

      this.performance(`Timer: ${name}`, {
        ...context,
        performance: {
          duration,
          startTime,
          endTime,
          memoryUsage: {
            rss: endMemory.rss - startMemory.rss,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
          }
        }
      });
    };
  }

  /**
   * Set correlation ID for request tracking
   */
  static setCorrelationId(correlationId?: string): void {
    correlationStore.enterWith(correlationId || uuidv4());
  }

  /**
   * Get current correlation ID
   */
  static getCorrelationId(): string | undefined {
    return correlationStore.getStore();
  }

  /**
   * Run function with correlation ID
   */
  static withCorrelationId<T>(
    correlationId: string,
    fn: () => T
  ): T {
    return correlationStore.run(correlationId, fn);
  }
}

/**
 * Default logger instance
 */
export const logger = new StructuredLogger({
  serviceName: 'semantest-server',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  logLevel: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  logToFile: process.env.NODE_ENV === 'production',
  logDirectory: process.env.LOG_DIRECTORY || './logs'
});

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(
  req: any,
  res: any,
  next: any
): void {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  const startTime = performance.now();

  // Set correlation ID in async local storage
  StructuredLogger.setCorrelationId(correlationId);

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request
  logger.http('HTTP Request', {
    correlationId,
    requestId: uuidv4(),
    metadata: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      headers: req.headers
    }
  });

  // Log response
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    
    logger.http('HTTP Response', {
      correlationId,
      performance: {
        duration,
        startTime,
        endTime: performance.now()
      },
      metadata: {
        statusCode: res.statusCode,
        contentLength: res.get('content-length')
      }
    });
  });

  next();
}

/**
 * WebSocket middleware for connection logging
 */
export function websocketLoggingMiddleware(
  ws: any,
  req: any,
  next: any
): void {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  logger.info('WebSocket Connection', {
    correlationId,
    metadata: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin')
    }
  }, ['websocket', 'connection']);

  // Log disconnection
  ws.on('close', () => {
    logger.info('WebSocket Disconnection', {
      correlationId
    }, ['websocket', 'disconnection']);
  });

  next();
}

/**
 * Error logging middleware
 */
export function errorLoggingMiddleware(
  error: Error,
  req: any,
  res: any,
  next: any
): void {
  const correlationId = StructuredLogger.getCorrelationId();
  
  logger.error('Unhandled Error', error, {
    correlationId,
    metadata: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  next(error);
}