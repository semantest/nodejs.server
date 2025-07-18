/**
 * Performance Metrics Collection System
 * Collects and tracks performance metrics, resource utilization, and business KPIs
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logger, LogContext } from './structured-logger';

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
export class PerformanceMetrics extends EventEmitter {
  private metrics: Map<string, MetricValue[]> = new Map();
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private systemMetricsInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private gcObserver?: PerformanceObserver;
  private isCollecting = false;

  constructor(private collectInterval: number = 60000) {
    super();
    this.setupPerformanceObservers();
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.startSystemMetricsCollection();
    this.performanceObserver?.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    this.gcObserver?.observe({ entryTypes: ['gc'] });
    
    logger.info('Performance metrics collection started', {
      metadata: { collectInterval: this.collectInterval }
    });
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isCollecting) return;
    
    this.isCollecting = false;
    
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    this.performanceObserver?.disconnect();
    this.gcObserver?.disconnect();
    
    logger.info('Performance metrics collection stopped');
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric(name, duration, 'ms', tags);
    this.addToHistogram(name, duration);
  }

  /**
   * Increment a counter
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);
    this.recordMetric(name, currentValue + value, 'count', tags);
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(name, value);
    this.recordMetric(name, value, 'gauge', tags);
  }

  /**
   * Start a timer
   */
  startTimer(name: string): () => void {
    const startTime = performance.now();
    this.timers.set(name, startTime);
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.timing(name, duration);
      this.timers.delete(name);
    };
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    contentLength?: number
  ): void {
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
  recordWebSocketConnection(event: 'connect' | 'disconnect' | 'error', tags?: Record<string, string>): void {
    this.increment(`websocket.${event}`, 1, tags);
    
    if (event === 'connect') {
      const currentConnections = this.gauges.get('websocket.active_connections') || 0;
      this.gauge('websocket.active_connections', currentConnections + 1);
    } else if (event === 'disconnect') {
      const currentConnections = this.gauges.get('websocket.active_connections') || 0;
      this.gauge('websocket.active_connections', Math.max(0, currentConnections - 1));
    }
  }

  /**
   * Record business event metrics
   */
  recordBusinessEvent(eventType: string, value?: number, tags?: Record<string, string>): void {
    this.increment(`business.${eventType}`, 1, tags);
    
    if (value !== undefined) {
      this.gauge(`business.${eventType}.value`, value, tags);
    }
  }

  /**
   * Record authentication metrics
   */
  recordAuthEvent(event: 'attempt' | 'success' | 'failure', tags?: Record<string, string>): void {
    this.increment(`auth.${event}`, 1, tags);
  }

  /**
   * Get metric summary
   */
  getMetricSummary(name: string): MetricSummary | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

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
  getSystemMetrics(): SystemMetrics {
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
  getBusinessMetrics(): BusinessMetrics {
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
  getAllMetrics(): {
    system: SystemMetrics;
    business: BusinessMetrics;
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, MetricSummary>;
  } {
    const histograms: Record<string, MetricSummary> = {};
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
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
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
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }

  /**
   * Record a metric value
   */
  private recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: MetricValue = {
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
  private addToHistogram(name: string, value: number): void {
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
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get counters by prefix
   */
  private getCountersByPrefix(prefix: string): Record<string, number> {
    const result: Record<string, number> = {};
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
  private setupPerformanceObservers(): void {
    // Performance observer for timing metrics
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.timing(entry.name, entry.duration);
      }
    });

    // GC observer for garbage collection metrics
    this.gcObserver = new PerformanceObserver((list) => {
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
  private monitorEventLoop(): void {
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
  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      const systemMetrics = this.getSystemMetrics();
      
      // Record system metrics
      this.gauge('system.cpu.usage', systemMetrics.cpu.usage);
      this.gauge('system.memory.used', systemMetrics.memory.used);
      this.gauge('system.memory.heap_used', systemMetrics.memory.heapUsed);
      this.gauge('system.uptime', systemMetrics.uptime);
      
      // Log system metrics
      logger.performance('System metrics collected', {
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

/**
 * Default performance metrics instance
 */
export const performanceMetrics = new PerformanceMetrics();

/**
 * Express middleware for performance metrics
 */
export function metricsMiddleware(req: any, res: any, next: any): void {
  const startTime = performance.now();
  const path = req.route?.path || req.path;
  
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const contentLength = parseInt(res.get('content-length') || '0', 10);
    
    performanceMetrics.recordHttpRequest(
      req.method,
      path,
      res.statusCode,
      duration,
      contentLength
    );
  });
  
  next();
}

/**
 * WebSocket middleware for performance metrics
 */
export function websocketMetricsMiddleware(ws: any, req: any, next: any): void {
  performanceMetrics.recordWebSocketConnection('connect', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  ws.on('close', () => {
    performanceMetrics.recordWebSocketConnection('disconnect');
  });
  
  ws.on('error', (error: Error) => {
    performanceMetrics.recordWebSocketConnection('error', {
      error: error.message
    });
  });
  
  next();
}