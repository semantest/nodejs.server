/**
 * Performance Metrics Collection System
 * Collects and tracks performance metrics, resource utilization, and business KPIs
 */
import { EventEmitter } from 'events';
export interface MetricValue {
    value: number;
    timestamp: number;
    unit: string;
    tags?: Record<string, string>;
}
export interface MetricSummary {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
}
export interface SystemMetrics {
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    memory: {
        total: number;
        free: number;
        used: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
    eventLoop: {
        delay: number;
        utilization: number;
    };
    gc: {
        count: number;
        duration: number;
        type: string;
    }[];
    uptime: number;
}
export interface BusinessMetrics {
    websocketConnections: {
        active: number;
        total: number;
        failed: number;
    };
    apiRequests: {
        total: number;
        errors: number;
        responseTime: MetricSummary;
    };
    extensionEvents: {
        total: number;
        byType: Record<string, number>;
    };
    authentication: {
        attempts: number;
        successes: number;
        failures: number;
    };
}
/**
 * Performance Metrics Collector
 */
export declare class PerformanceMetrics extends EventEmitter {
    private collectInterval;
    private metrics;
    private timers;
    private counters;
    private gauges;
    private histograms;
    private systemMetricsInterval?;
    private performanceObserver?;
    private gcObserver?;
    private isCollecting;
    constructor(collectInterval?: number);
    /**
     * Start metrics collection
     */
    start(): void;
    /**
     * Stop metrics collection
     */
    stop(): void;
    /**
     * Record a timing metric
     */
    timing(name: string, duration: number, tags?: Record<string, string>): void;
    /**
     * Increment a counter
     */
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Start a timer
     */
    startTimer(name: string): () => void;
    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(method: string, path: string, statusCode: number, duration: number, contentLength?: number): void;
    /**
     * Record WebSocket connection metrics
     */
    recordWebSocketConnection(event: 'connect' | 'disconnect' | 'error', tags?: Record<string, string>): void;
    /**
     * Record business event metrics
     */
    recordBusinessEvent(eventType: string, value?: number, tags?: Record<string, string>): void;
    /**
     * Record authentication metrics
     */
    recordAuthEvent(event: 'attempt' | 'success' | 'failure', tags?: Record<string, string>): void;
    /**
     * Get metric summary
     */
    getMetricSummary(name: string): MetricSummary | null;
    /**
     * Get system metrics
     */
    getSystemMetrics(): SystemMetrics;
    /**
     * Get business metrics
     */
    getBusinessMetrics(): BusinessMetrics;
    /**
     * Get all metrics
     */
    getAllMetrics(): {
        system: SystemMetrics;
        business: BusinessMetrics;
        counters: Record<string, number>;
        gauges: Record<string, number>;
        histograms: Record<string, MetricSummary>;
    };
    /**
     * Export metrics in Prometheus format
     */
    exportPrometheusMetrics(): string;
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Record a metric value
     */
    private recordMetric;
    /**
     * Add value to histogram
     */
    private addToHistogram;
    /**
     * Get percentile from sorted array
     */
    private getPercentile;
    /**
     * Get counters by prefix
     */
    private getCountersByPrefix;
    /**
     * Setup performance observers
     */
    private setupPerformanceObservers;
    /**
     * Monitor event loop lag
     */
    private monitorEventLoop;
    /**
     * Start system metrics collection
     */
    private startSystemMetricsCollection;
}
/**
 * Default performance metrics instance
 */
export declare const performanceMetrics: PerformanceMetrics;
/**
 * Express middleware for performance metrics
 */
export declare function metricsMiddleware(req: any, res: any, next: any): void;
/**
 * WebSocket middleware for performance metrics
 */
export declare function websocketMetricsMiddleware(ws: any, req: any, next: any): void;
//# sourceMappingURL=performance-metrics.d.ts.map