/**
 * Structured Logging System for Semantest Platform
 * Provides JSON-formatted logging with correlation tracking, performance metrics, and security events
 */
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    HTTP = "http",
    VERBOSE = "verbose",
    DEBUG = "debug",
    SILLY = "silly"
}
export declare enum LogCategory {
    SECURITY = "security",
    PERFORMANCE = "performance",
    BUSINESS = "business",
    SYSTEM = "system",
    API = "api",
    DATABASE = "database",
    WEBSOCKET = "websocket",
    AUTHENTICATION = "authentication",
    ERROR = "error",
    AUDIT = "audit"
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
export declare class StructuredLogger {
    private logger;
    private serviceName;
    private version;
    private environment;
    private hostname;
    constructor(options: {
        serviceName: string;
        version: string;
        environment: string;
        logLevel?: LogLevel;
        logToFile?: boolean;
        logDirectory?: string;
    });
    /**
     * Format log entry as structured JSON
     */
    private formatLogEntry;
    /**
     * Log with structured format
     */
    private logStructured;
    /**
     * Log error with stack trace
     */
    error(message: string, error?: Error, context?: LogContext, tags?: string[]): void;
    /**
     * Log warning
     */
    warn(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log info
     */
    info(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log debug information
     */
    debug(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log HTTP request/response
     */
    http(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log security event
     */
    security(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log performance metrics
     */
    performance(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log business event
     */
    business(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log authentication event
     */
    auth(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Log audit event
     */
    audit(message: string, context?: LogContext, tags?: string[]): void;
    /**
     * Create child logger with additional context
     */
    child(additionalContext: LogContext): StructuredLogger;
    /**
     * Create performance timer
     */
    createTimer(name: string, context?: LogContext): () => void;
    /**
     * Set correlation ID for request tracking
     */
    static setCorrelationId(correlationId?: string): void;
    /**
     * Get current correlation ID
     */
    static getCorrelationId(): string | undefined;
    /**
     * Run function with correlation ID
     */
    static withCorrelationId<T>(correlationId: string, fn: () => T): T;
}
/**
 * Default logger instance
 */
export declare const logger: StructuredLogger;
/**
 * Express middleware for request logging
 */
export declare function requestLoggingMiddleware(req: any, res: any, next: any): void;
/**
 * WebSocket middleware for connection logging
 */
export declare function websocketLoggingMiddleware(ws: any, req: any, next: any): void;
/**
 * Error logging middleware
 */
export declare function errorLoggingMiddleware(error: Error, req: any, res: any, next: any): void;
//# sourceMappingURL=structured-logger.d.ts.map