"use strict";
/**
 * Structured Logging System for Semantest Platform
 * Provides JSON-formatted logging with correlation tracking, performance metrics, and security events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.StructuredLogger = exports.LogCategory = exports.LogLevel = void 0;
exports.requestLoggingMiddleware = requestLoggingMiddleware;
exports.websocketLoggingMiddleware = websocketLoggingMiddleware;
exports.errorLoggingMiddleware = errorLoggingMiddleware;
const winston_1 = require("winston");
const async_hooks_1 = require("async_hooks");
const uuid_1 = require("uuid");
const perf_hooks_1 = require("perf_hooks");
// Correlation ID storage for request tracking
const correlationStore = new async_hooks_1.AsyncLocalStorage();
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["HTTP"] = "http";
    LogLevel["VERBOSE"] = "verbose";
    LogLevel["DEBUG"] = "debug";
    LogLevel["SILLY"] = "silly";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogCategory;
(function (LogCategory) {
    LogCategory["SECURITY"] = "security";
    LogCategory["PERFORMANCE"] = "performance";
    LogCategory["BUSINESS"] = "business";
    LogCategory["SYSTEM"] = "system";
    LogCategory["API"] = "api";
    LogCategory["DATABASE"] = "database";
    LogCategory["WEBSOCKET"] = "websocket";
    LogCategory["AUTHENTICATION"] = "authentication";
    LogCategory["ERROR"] = "error";
    LogCategory["AUDIT"] = "audit";
})(LogCategory || (exports.LogCategory = LogCategory = {}));
/**
 * Structured Logger implementation with correlation tracking
 */
class StructuredLogger {
    constructor(options) {
        this.serviceName = options.serviceName;
        this.version = options.version;
        this.environment = options.environment;
        this.hostname = require('os').hostname();
        // Create Winston logger with structured format
        this.logger = (0, winston_1.createLogger)({
            level: options.logLevel || LogLevel.INFO,
            format: winston_1.format.combine(winston_1.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.format.errors({ stack: true }), winston_1.format.json(), winston_1.format.printf(this.formatLogEntry.bind(this))),
            transports: [
                // Console transport for development
                new winston_1.transports.Console({
                    format: winston_1.format.combine(winston_1.format.colorize(), winston_1.format.simple())
                }),
                // File transport for production
                ...(options.logToFile ? [
                    new winston_1.transports.File({
                        filename: `${options.logDirectory || './logs'}/error.log`,
                        level: LogLevel.ERROR,
                        maxsize: 10 * 1024 * 1024, // 10MB
                        maxFiles: 5,
                        tailable: true
                    }),
                    new winston_1.transports.File({
                        filename: `${options.logDirectory || './logs'}/combined.log`,
                        maxsize: 10 * 1024 * 1024, // 10MB
                        maxFiles: 10,
                        tailable: true
                    })
                ] : [])
            ],
            // Handle uncaught exceptions
            exceptionHandlers: [
                new winston_1.transports.File({
                    filename: `${options.logDirectory || './logs'}/exceptions.log`
                })
            ],
            rejectionHandlers: [
                new winston_1.transports.File({
                    filename: `${options.logDirectory || './logs'}/rejections.log`
                })
            ]
        });
    }
    /**
     * Format log entry as structured JSON
     */
    formatLogEntry(info) {
        const entry = {
            timestamp: info.timestamp,
            level: info.level,
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
    logStructured(level, category, message, context, tags) {
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
    error(message, error, context, tags) {
        this.logStructured(LogLevel.ERROR, LogCategory.ERROR, message, {
            ...context,
            metadata: {
                ...context?.metadata,
                error: error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : undefined
            }
        }, tags);
    }
    /**
     * Log warning
     */
    warn(message, context, tags) {
        this.logStructured(LogLevel.WARN, LogCategory.SYSTEM, message, context, tags);
    }
    /**
     * Log info
     */
    info(message, context, tags) {
        this.logStructured(LogLevel.INFO, LogCategory.SYSTEM, message, context, tags);
    }
    /**
     * Log debug information
     */
    debug(message, context, tags) {
        this.logStructured(LogLevel.DEBUG, LogCategory.SYSTEM, message, context, tags);
    }
    /**
     * Log HTTP request/response
     */
    http(message, context, tags) {
        this.logStructured(LogLevel.HTTP, LogCategory.API, message, context, tags);
    }
    /**
     * Log security event
     */
    security(message, context, tags) {
        this.logStructured(LogLevel.WARN, LogCategory.SECURITY, message, context, [...(tags || []), 'security']);
    }
    /**
     * Log performance metrics
     */
    performance(message, context, tags) {
        this.logStructured(LogLevel.INFO, LogCategory.PERFORMANCE, message, context, [...(tags || []), 'performance']);
    }
    /**
     * Log business event
     */
    business(message, context, tags) {
        this.logStructured(LogLevel.INFO, LogCategory.BUSINESS, message, context, [...(tags || []), 'business']);
    }
    /**
     * Log authentication event
     */
    auth(message, context, tags) {
        this.logStructured(LogLevel.INFO, LogCategory.AUTHENTICATION, message, context, [...(tags || []), 'authentication']);
    }
    /**
     * Log audit event
     */
    audit(message, context, tags) {
        this.logStructured(LogLevel.INFO, LogCategory.AUDIT, message, context, [...(tags || []), 'audit']);
    }
    /**
     * Create child logger with additional context
     */
    child(additionalContext) {
        // For now, just return this instance
        // Child logger functionality would need proper implementation
        return this;
    }
    /**
     * Create performance timer
     */
    createTimer(name, context) {
        const startTime = perf_hooks_1.performance.now();
        const startMemory = process.memoryUsage();
        return () => {
            const endTime = perf_hooks_1.performance.now();
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
    static setCorrelationId(correlationId) {
        correlationStore.enterWith(correlationId || (0, uuid_1.v4)());
    }
    /**
     * Get current correlation ID
     */
    static getCorrelationId() {
        return correlationStore.getStore();
    }
    /**
     * Run function with correlation ID
     */
    static withCorrelationId(correlationId, fn) {
        return correlationStore.run(correlationId, fn);
    }
}
exports.StructuredLogger = StructuredLogger;
/**
 * Default logger instance
 */
exports.logger = new StructuredLogger({
    serviceName: 'semantest-server',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || LogLevel.INFO,
    logToFile: process.env.NODE_ENV === 'production',
    logDirectory: process.env.LOG_DIRECTORY || './logs'
});
/**
 * Express middleware for request logging
 */
function requestLoggingMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    const startTime = perf_hooks_1.performance.now();
    // Set correlation ID in async local storage
    StructuredLogger.setCorrelationId(correlationId);
    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    // Log request
    exports.logger.http('HTTP Request', {
        correlationId,
        requestId: (0, uuid_1.v4)(),
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
        const duration = perf_hooks_1.performance.now() - startTime;
        exports.logger.http('HTTP Response', {
            correlationId,
            performance: {
                duration,
                startTime,
                endTime: perf_hooks_1.performance.now()
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
function websocketLoggingMiddleware(ws, req, next) {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    exports.logger.info('WebSocket Connection', {
        correlationId,
        metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            origin: req.get('Origin')
        }
    }, ['websocket', 'connection']);
    // Log disconnection
    ws.on('close', () => {
        exports.logger.info('WebSocket Disconnection', {
            correlationId
        }, ['websocket', 'disconnection']);
    });
    next();
}
/**
 * Error logging middleware
 */
function errorLoggingMiddleware(error, req, res, next) {
    const correlationId = StructuredLogger.getCorrelationId();
    exports.logger.error('Unhandled Error', error, {
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
//# sourceMappingURL=structured-logger.js.map