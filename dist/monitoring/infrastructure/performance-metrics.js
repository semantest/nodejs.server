"use strict";
/**
 * Performance Metrics Collection System
 * Collects and tracks performance metrics, resource utilization, and business KPIs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMetrics = exports.PerformanceMetrics = void 0;
exports.metricsMiddleware = metricsMiddleware;
exports.websocketMetricsMiddleware = websocketMetricsMiddleware;
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const structured_logger_1 = require("./structured-logger");
/**
 * Performance Metrics Collector
 */
class PerformanceMetrics extends events_1.EventEmitter {
    constructor(collectInterval = 60000) {
        super();
        this.collectInterval = collectInterval;
        this.metrics = new Map();
        this.timers = new Map();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.isCollecting = false;
        this.setupPerformanceObservers();
    }
    /**
     * Start metrics collection
     */
    start() {
        if (this.isCollecting)
            return;
        this.isCollecting = true;
        this.startSystemMetricsCollection();
        this.performanceObserver?.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
        this.gcObserver?.observe({ entryTypes: ['gc'] });
        structured_logger_1.logger.info('Performance metrics collection started', {
            metadata: { collectInterval: this.collectInterval }
        });
    }
    /**
     * Stop metrics collection
     */
    stop() {
        if (!this.isCollecting)
            return;
        this.isCollecting = false;
        if (this.systemMetricsInterval) {
            clearInterval(this.systemMetricsInterval);
        }
        this.performanceObserver?.disconnect();
        this.gcObserver?.disconnect();
        structured_logger_1.logger.info('Performance metrics collection stopped');
    }
    /**
     * Record a timing metric
     */
    timing(name, duration, tags) {
        this.recordMetric(name, duration, 'ms', tags);
        this.addToHistogram(name, duration);
    }
    /**
     * Increment a counter
     */
    increment(name, value = 1, tags) {
        const currentValue = this.counters.get(name) || 0;
        this.counters.set(name, currentValue + value);
        this.recordMetric(name, currentValue + value, 'count', tags);
    }
    /**
     * Set a gauge value
     */
    gauge(name, value, tags) {
        this.gauges.set(name, value);
        this.recordMetric(name, value, 'gauge', tags);
    }
    /**
     * Start a timer
     */
    startTimer(name) {
        const startTime = perf_hooks_1.performance.now();
        this.timers.set(name, startTime);
        return () => {
            const endTime = perf_hooks_1.performance.now();
            const duration = endTime - startTime;
            this.timing(name, duration);
            this.timers.delete(name);
        };
    }
    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(method, path, statusCode, duration, contentLength) {
        const tags = {
            method,
            path,
            status_code: statusCode.toString(),
            status_class: `${Math.floor(statusCode / 100)}xx`
        };
        this.timing('http.request.duration', duration, tags);
        this.increment('http.request.count', 1, tags);
        if (contentLength) {
            this.gauge('http.response.size', contentLength, tags);
        }
        // Track error rates
        if (statusCode >= 400) {
            this.increment('http.request.errors', 1, tags);
        }
    }
    /**
     * Record WebSocket connection metrics
     */
    recordWebSocketConnection(event, tags) {
        this.increment(`websocket.${event}`, 1, tags);
        if (event === 'connect') {
            const currentConnections = this.gauges.get('websocket.active_connections') || 0;
            this.gauge('websocket.active_connections', currentConnections + 1);
        }
        else if (event === 'disconnect') {
            const currentConnections = this.gauges.get('websocket.active_connections') || 0;
            this.gauge('websocket.active_connections', Math.max(0, currentConnections - 1));
        }
    }
    /**
     * Record business event metrics
     */
    recordBusinessEvent(eventType, value, tags) {
        this.increment(`business.${eventType}`, 1, tags);
        if (value !== undefined) {
            this.gauge(`business.${eventType}.value`, value, tags);
        }
    }
    /**
     * Record authentication metrics
     */
    recordAuthEvent(event, tags) {
        this.increment(`auth.${event}`, 1, tags);
    }
    /**
     * Get metric summary
     */
    getMetricSummary(name) {
        const values = this.histograms.get(name);
        if (!values || values.length === 0)
            return null;
        const sorted = values.sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        const min = sorted[0];
        const max = sorted[count - 1];
        const avg = sum / count;
        return {
            count,
            sum,
            min,
            max,
            avg,
            p50: this.getPercentile(sorted, 0.5),
            p90: this.getPercentile(sorted, 0.9),
            p95: this.getPercentile(sorted, 0.95),
            p99: this.getPercentile(sorted, 0.99)
        };
    }
    /**
     * Get system metrics
     */
    getSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        return {
            cpu: {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                loadAverage: require('os').loadavg()
            },
            memory: {
                total: require('os').totalmem(),
                free: require('os').freemem(),
                used: require('os').totalmem() - require('os').freemem(),
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers
            },
            eventLoop: {
                delay: this.gauges.get('eventloop.delay') || 0,
                utilization: this.gauges.get('eventloop.utilization') || 0
            },
            gc: [], // Will be populated by GC observer
            uptime: process.uptime()
        };
    }
    /**
     * Get business metrics
     */
    getBusinessMetrics() {
        return {
            websocketConnections: {
                active: this.gauges.get('websocket.active_connections') || 0,
                total: this.counters.get('websocket.connect') || 0,
                failed: this.counters.get('websocket.error') || 0
            },
            apiRequests: {
                total: this.counters.get('http.request.count') || 0,
                errors: this.counters.get('http.request.errors') || 0,
                responseTime: this.getMetricSummary('http.request.duration') || {
                    count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0
                }
            },
            extensionEvents: {
                total: this.counters.get('business.extension_event') || 0,
                byType: this.getCountersByPrefix('business.')
            },
            authentication: {
                attempts: this.counters.get('auth.attempt') || 0,
                successes: this.counters.get('auth.success') || 0,
                failures: this.counters.get('auth.failure') || 0
            }
        };
    }
    /**
     * Get all metrics
     */
    getAllMetrics() {
        const histograms = {};
        for (const [name] of this.histograms) {
            const summary = this.getMetricSummary(name);
            if (summary) {
                histograms[name] = summary;
            }
        }
        return {
            system: this.getSystemMetrics(),
            business: this.getBusinessMetrics(),
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms
        };
    }
    /**
     * Export metrics in Prometheus format
     */
    exportPrometheusMetrics() {
        const lines = [];
        // Export counters
        for (const [name, value] of this.counters) {
            lines.push(`# TYPE ${name} counter`);
            lines.push(`${name} ${value}`);
        }
        // Export gauges
        for (const [name, value] of this.gauges) {
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name} ${value}`);
        }
        // Export histograms
        for (const [name] of this.histograms) {
            const summary = this.getMetricSummary(name);
            if (summary) {
                lines.push(`# TYPE ${name} histogram`);
                lines.push(`${name}_count ${summary.count}`);
                lines.push(`${name}_sum ${summary.sum}`);
                lines.push(`${name}_bucket{le="0.5"} ${summary.p50}`);
                lines.push(`${name}_bucket{le="0.9"} ${summary.p90}`);
                lines.push(`${name}_bucket{le="0.95"} ${summary.p95}`);
                lines.push(`${name}_bucket{le="0.99"} ${summary.p99}`);
            }
        }
        return lines.join('\n');
    }
    /**
     * Clear all metrics
     */
    clear() {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.timers.clear();
    }
    /**
     * Record a metric value
     */
    recordMetric(name, value, unit, tags) {
        const metric = {
            value,
            timestamp: Date.now(),
            unit,
            tags
        };
        const existing = this.metrics.get(name) || [];
        existing.push(metric);
        // Keep only last 1000 values per metric
        if (existing.length > 1000) {
            existing.shift();
        }
        this.metrics.set(name, existing);
        this.emit('metric', name, metric);
    }
    /**
     * Add value to histogram
     */
    addToHistogram(name, value) {
        const existing = this.histograms.get(name) || [];
        existing.push(value);
        // Keep only last 1000 values
        if (existing.length > 1000) {
            existing.shift();
        }
        this.histograms.set(name, existing);
    }
    /**
     * Get percentile from sorted array
     */
    getPercentile(sorted, percentile) {
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[Math.max(0, index)];
    }
    /**
     * Get counters by prefix
     */
    getCountersByPrefix(prefix) {
        const result = {};
        for (const [name, value] of this.counters) {
            if (name.startsWith(prefix)) {
                result[name] = value;
            }
        }
        return result;
    }
    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        // Performance observer for timing metrics
        this.performanceObserver = new perf_hooks_1.PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.timing(entry.name, entry.duration);
            }
        });
        // GC observer for garbage collection metrics
        this.gcObserver = new perf_hooks_1.PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.timing('gc.duration', entry.duration, {
                    type: entry.detail?.kind || 'unknown'
                });
            }
        });
        // Event loop lag monitoring
        this.monitorEventLoop();
    }
    /**
     * Monitor event loop lag
     */
    monitorEventLoop() {
        const interval = 1000; // Check every second
        let lastTime = Date.now();
        const checkLag = () => {
            const currentTime = Date.now();
            const lag = currentTime - lastTime - interval;
            this.gauge('eventloop.delay', Math.max(0, lag));
            lastTime = currentTime;
            if (this.isCollecting) {
                setTimeout(checkLag, interval);
            }
        };
        checkLag();
    }
    /**
     * Start system metrics collection
     */
    startSystemMetricsCollection() {
        this.systemMetricsInterval = setInterval(() => {
            const systemMetrics = this.getSystemMetrics();
            // Record system metrics
            this.gauge('system.cpu.usage', systemMetrics.cpu.usage);
            this.gauge('system.memory.used', systemMetrics.memory.used);
            this.gauge('system.memory.heap_used', systemMetrics.memory.heapUsed);
            this.gauge('system.uptime', systemMetrics.uptime);
            // Log system metrics
            structured_logger_1.logger.performance('System metrics collected', {
                metadata: {
                    cpu_usage: systemMetrics.cpu.usage,
                    memory_used: systemMetrics.memory.used,
                    heap_used: systemMetrics.memory.heapUsed,
                    uptime: systemMetrics.uptime
                }
            });
            this.emit('systemMetrics', systemMetrics);
        }, this.collectInterval);
    }
}
exports.PerformanceMetrics = PerformanceMetrics;
/**
 * Default performance metrics instance
 */
exports.performanceMetrics = new PerformanceMetrics();
/**
 * Express middleware for performance metrics
 */
function metricsMiddleware(req, res, next) {
    const startTime = perf_hooks_1.performance.now();
    const path = req.route?.path || req.path;
    res.on('finish', () => {
        const duration = perf_hooks_1.performance.now() - startTime;
        const contentLength = parseInt(res.get('content-length') || '0', 10);
        exports.performanceMetrics.recordHttpRequest(req.method, path, res.statusCode, duration, contentLength);
    });
    next();
}
/**
 * WebSocket middleware for performance metrics
 */
function websocketMetricsMiddleware(ws, req, next) {
    exports.performanceMetrics.recordWebSocketConnection('connect', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    ws.on('close', () => {
        exports.performanceMetrics.recordWebSocketConnection('disconnect');
    });
    ws.on('error', (error) => {
        exports.performanceMetrics.recordWebSocketConnection('error', {
            error: error.message
        });
    });
    next();
}
//# sourceMappingURL=performance-metrics.js.map