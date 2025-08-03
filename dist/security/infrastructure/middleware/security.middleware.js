"use strict";
/**
 * Security middleware for input validation and protection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnqueue = exports.requestSizeLimits = exports.securityHeaders = exports.sanitizeInput = exports.validateInput = exports.rateLimiters = void 0;
/**
 * Simple in-memory rate limiter
 */
class SimpleRateLimiter {
    constructor(windowMs, maxRequests, message) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.message = message;
        this.requests = new Map();
        this.middleware = (req, res, next) => {
            const key = req.ip || req.socket.remoteAddress || 'unknown';
            const now = Date.now();
            // Get existing requests for this IP
            const requests = this.requests.get(key) || [];
            // Filter out old requests outside the window
            const recentRequests = requests.filter(time => now - time < this.windowMs);
            if (recentRequests.length >= this.maxRequests) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: this.message,
                    retryAfter: Math.ceil(this.windowMs / 1000),
                    timestamp: new Date().toISOString(),
                });
            }
            // Add current request
            recentRequests.push(now);
            this.requests.set(key, recentRequests);
            // Cleanup old entries periodically
            if (Math.random() < 0.01) { // 1% chance
                this.cleanup();
            }
            next();
        };
    }
    cleanup() {
        const now = Date.now();
        for (const [key, requests] of this.requests.entries()) {
            const recent = requests.filter(time => now - time < this.windowMs);
            if (recent.length === 0) {
                this.requests.delete(key);
            }
            else {
                this.requests.set(key, recent);
            }
        }
    }
}
/**
 * Rate limiting configurations
 */
exports.rateLimiters = {
    // General API rate limit
    api: new SimpleRateLimiter(15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many requests from this IP, please try again later.').middleware,
    // Strict rate limit for sensitive operations
    strict: new SimpleRateLimiter(15 * 60 * 1000, 10, 'Too many requests for this operation, please try again later.').middleware,
    // Queue enqueue rate limit
    enqueue: new SimpleRateLimiter(60 * 1000, // 1 minute
    30, // 30 requests per minute
    'Too many queue requests, please slow down.').middleware,
    // Message creation rate limit
    messages: new SimpleRateLimiter(60 * 1000, 50, 'Too many message requests, please slow down.').middleware,
};
/**
 * Basic input validation
 */
exports.validateInput = {
    url: (req, res, next) => {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'URL is required and must be a string',
                timestamp: new Date().toISOString(),
            });
        }
        try {
            const parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
            if (url.length > 2048) {
                throw new Error('URL too long');
            }
        }
        catch (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid URL format',
                timestamp: new Date().toISOString(),
            });
        }
        next();
    },
    priority: (req, res, next) => {
        const { priority } = req.body;
        if (priority && !['high', 'normal', 'low'].includes(priority)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Priority must be high, normal, or low',
                timestamp: new Date().toISOString(),
            });
        }
        next();
    },
    metadata: (req, res, next) => {
        const { metadata } = req.body;
        if (metadata) {
            if (typeof metadata !== 'object' || Array.isArray(metadata)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Metadata must be an object',
                    timestamp: new Date().toISOString(),
                });
            }
            const size = JSON.stringify(metadata).length;
            if (size > 10240) { // 10KB limit
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Metadata too large (max 10KB)',
                    timestamp: new Date().toISOString(),
                });
            }
        }
        next();
    },
    aiTool: (req, res, next) => {
        const { ai_tool } = req.body;
        if (ai_tool) {
            if (typeof ai_tool !== 'object' || Array.isArray(ai_tool)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'AI tool must be an object',
                    timestamp: new Date().toISOString(),
                });
            }
            if (ai_tool.toolId && typeof ai_tool.toolId !== 'string') {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Tool ID must be a string',
                    timestamp: new Date().toISOString(),
                });
            }
            if (ai_tool.activationRequired !== undefined &&
                typeof ai_tool.activationRequired !== 'boolean') {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Activation required must be a boolean',
                    timestamp: new Date().toISOString(),
                });
            }
        }
        next();
    },
    id: (req, res, next) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'ID is required',
                timestamp: new Date().toISOString(),
            });
        }
        // Basic UUID v4 validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid ID format',
                timestamp: new Date().toISOString(),
            });
        }
        next();
    },
};
/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
    // Recursively sanitize strings in request body
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove null bytes and control characters
            return obj.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // Limit key length
                    const sanitizedKey = key.slice(0, 128);
                    sanitized[sanitizedKey] = sanitize(obj[key]);
                }
            }
            return sanitized;
        }
        return obj;
    };
    if (req.body) {
        req.body = sanitize(req.body);
    }
    next();
};
exports.sanitizeInput = sanitizeInput;
/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};
exports.securityHeaders = securityHeaders;
/**
 * Request size limiting
 */
exports.requestSizeLimits = {
    json: '10mb',
    urlencoded: '10mb',
};
/**
 * Combined validation for queue enqueue
 */
exports.validateEnqueue = [
    exports.validateInput.url,
    exports.validateInput.priority,
    exports.validateInput.metadata,
    exports.validateInput.aiTool,
];
//# sourceMappingURL=security.middleware.js.map