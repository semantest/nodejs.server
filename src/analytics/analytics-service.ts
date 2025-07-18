/**
 * Enterprise Analytics Service
 * Advanced usage analytics with custom metrics and reporting
 */

import { EventEmitter } from 'events';
import { logger } from '../monitoring/infrastructure/structured-logger';
import { performanceMetrics } from '../monitoring/infrastructure/performance-metrics';

export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  organizationId?: string;
  sessionId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  tags?: string[];
  source: string;
  version: string;
}

export interface CustomMetric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  timestamp: Date;
  description?: string;
}

export interface AnalyticsQuery {
  startTime: Date;
  endTime: Date;
  eventTypes?: string[];
  userIds?: string[];
  organizationIds?: string[];
  metrics?: string[];
  groupBy?: string[];
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface AnalyticsReport {
  reportId: string;
  query: AnalyticsQuery;
  results: {
    events: AnalyticsEvent[];
    metrics: CustomMetric[];
    aggregations: Record<string, any>;
    metadata: {
      totalEvents: number;
      totalMetrics: number;
      executionTime: number;
      generatedAt: Date;
    };
  };
}

export class AnalyticsService extends EventEmitter {
  private events: Map<string, AnalyticsEvent[]> = new Map();
  private metrics: Map<string, CustomMetric[]> = new Map();
  private isInitialized = false;
  private retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    super();
    this.setupCleanupSchedule();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Analytics service already initialized');
      return;
    }

    logger.info('Initializing analytics service');

    try {
      // Initialize storage
      await this.initializeStorage();
      
      // Setup default metrics
      await this.setupDefaultMetrics();
      
      this.isInitialized = true;
      logger.info('Analytics service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize analytics service', error);
      throw error;
    }
  }

  /**
   * Track analytics event
   */
  trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date()
    };

    const key = this.getStorageKey(fullEvent.eventType, fullEvent.timestamp);
    
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    
    this.events.get(key)!.push(fullEvent);

    // Emit event for real-time processing
    this.emit('event', fullEvent);

    // Update performance metrics
    performanceMetrics.increment('analytics.events.total', 1, {
      eventType: fullEvent.eventType,
      source: fullEvent.source,
      organizationId: fullEvent.organizationId || 'unknown'
    });

    logger.debug('Analytics event tracked', {
      eventType: fullEvent.eventType,
      userId: fullEvent.userId,
      organizationId: fullEvent.organizationId,
      sessionId: fullEvent.sessionId
    });
  }

  /**
   * Record custom metric
   */
  recordMetric(metric: Omit<CustomMetric, 'timestamp'>): void {
    const fullMetric: CustomMetric = {
      ...metric,
      timestamp: new Date()
    };

    const key = this.getStorageKey(fullMetric.name, fullMetric.timestamp);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(fullMetric);

    // Emit metric for real-time processing
    this.emit('metric', fullMetric);

    // Update performance metrics
    performanceMetrics.increment('analytics.metrics.total', 1, {
      metricName: fullMetric.name,
      metricType: fullMetric.type
    });

    logger.debug('Custom metric recorded', {
      name: fullMetric.name,
      value: fullMetric.value,
      type: fullMetric.type
    });
  }

  /**
   * Query analytics data
   */
  async query(query: AnalyticsQuery): Promise<AnalyticsReport> {
    const startTime = Date.now();
    
    logger.info('Executing analytics query', {
      query: {
        ...query,
        startTime: query.startTime.toISOString(),
        endTime: query.endTime.toISOString()
      }
    });

    try {
      const reportId = this.generateReportId();
      
      // Query events
      const events = await this.queryEvents(query);
      
      // Query metrics
      const metrics = await this.queryMetrics(query);
      
      // Generate aggregations
      const aggregations = await this.generateAggregations(events, metrics, query);
      
      const executionTime = Date.now() - startTime;
      
      const report: AnalyticsReport = {
        reportId,
        query,
        results: {
          events,
          metrics,
          aggregations,
          metadata: {
            totalEvents: events.length,
            totalMetrics: metrics.length,
            executionTime,
            generatedAt: new Date()
          }
        }
      };

      // Track query performance
      performanceMetrics.histogram('analytics.query.execution_time', executionTime);
      performanceMetrics.increment('analytics.queries.total', 1);

      logger.info('Analytics query completed', {
        reportId,
        totalEvents: events.length,
        totalMetrics: metrics.length,
        executionTime
      });

      return report;
      
    } catch (error) {
      logger.error('Analytics query failed', error);
      performanceMetrics.increment('analytics.queries.failed', 1);
      throw error;
    }
  }

  /**
   * Get real-time analytics dashboard data
   */
  async getDashboardData(): Promise<{
    realTimeEvents: AnalyticsEvent[];
    realTimeMetrics: CustomMetric[];
    summaryStats: Record<string, any>;
    topEvents: Array<{ eventType: string; count: number }>;
    topMetrics: Array<{ name: string; value: number }>;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentQuery: AnalyticsQuery = {
      startTime: oneHourAgo,
      endTime: now,
      limit: 100
    };

    const recentData = await this.query(recentQuery);
    
    // Generate summary stats
    const summaryStats = {
      totalEvents: recentData.results.events.length,
      totalMetrics: recentData.results.metrics.length,
      uniqueUsers: new Set(recentData.results.events.map(e => e.userId).filter(Boolean)).size,
      uniqueOrganizations: new Set(recentData.results.events.map(e => e.organizationId).filter(Boolean)).size,
      lastHourEvents: recentData.results.events.length,
      systemUptime: process.uptime()
    };

    // Get top events
    const eventCounts = new Map<string, number>();
    recentData.results.events.forEach(event => {
      eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
    });
    
    const topEvents = Array.from(eventCounts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top metrics
    const metricSums = new Map<string, number>();
    recentData.results.metrics.forEach(metric => {
      metricSums.set(metric.name, (metricSums.get(metric.name) || 0) + metric.value);
    });
    
    const topMetrics = Array.from(metricSums.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      realTimeEvents: recentData.results.events.slice(-50), // Last 50 events
      realTimeMetrics: recentData.results.metrics.slice(-50), // Last 50 metrics
      summaryStats,
      topEvents,
      topMetrics
    };
  }

  private async initializeStorage(): Promise<void> {
    // Initialize in-memory storage
    // In production, this would connect to a database
    this.events.clear();
    this.metrics.clear();
  }

  private async setupDefaultMetrics(): Promise<void> {
    // Setup default system metrics
    const defaultMetrics = [
      { name: 'system.uptime', type: 'gauge' as const, value: process.uptime() },
      { name: 'system.memory.used', type: 'gauge' as const, value: process.memoryUsage().heapUsed },
      { name: 'system.memory.total', type: 'gauge' as const, value: process.memoryUsage().heapTotal }
    ];

    for (const metric of defaultMetrics) {
      this.recordMetric(metric);
    }
  }

  private async queryEvents(query: AnalyticsQuery): Promise<AnalyticsEvent[]> {
    const events: AnalyticsEvent[] = [];
    
    // Iterate through all event storage keys
    for (const [key, eventList] of this.events) {
      for (const event of eventList) {
        if (this.matchesQuery(event, query)) {
          events.push(event);
        }
      }
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply pagination
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : events.length;
    
    return events.slice(start, end);
  }

  private async queryMetrics(query: AnalyticsQuery): Promise<CustomMetric[]> {
    const metrics: CustomMetric[] = [];
    
    // Iterate through all metric storage keys
    for (const [key, metricList] of this.metrics) {
      for (const metric of metricList) {
        if (this.matchesMetricQuery(metric, query)) {
          metrics.push(metric);
        }
      }
    }

    // Sort by timestamp
    metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply pagination
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : metrics.length;
    
    return metrics.slice(start, end);
  }

  private async generateAggregations(
    events: AnalyticsEvent[], 
    metrics: CustomMetric[], 
    query: AnalyticsQuery
  ): Promise<Record<string, any>> {
    const aggregations: Record<string, any> = {};

    // Event aggregations
    if (query.groupBy?.includes('eventType')) {
      aggregations.eventsByType = {};
      events.forEach(event => {
        aggregations.eventsByType[event.eventType] = 
          (aggregations.eventsByType[event.eventType] || 0) + 1;
      });
    }

    if (query.groupBy?.includes('userId')) {
      aggregations.eventsByUser = {};
      events.forEach(event => {
        if (event.userId) {
          aggregations.eventsByUser[event.userId] = 
            (aggregations.eventsByUser[event.userId] || 0) + 1;
        }
      });
    }

    if (query.groupBy?.includes('organizationId')) {
      aggregations.eventsByOrganization = {};
      events.forEach(event => {
        if (event.organizationId) {
          aggregations.eventsByOrganization[event.organizationId] = 
            (aggregations.eventsByOrganization[event.organizationId] || 0) + 1;
        }
      });
    }

    // Metric aggregations
    const metricAggregations: Record<string, any> = {};
    metrics.forEach(metric => {
      if (!metricAggregations[metric.name]) {
        metricAggregations[metric.name] = {
          sum: 0,
          count: 0,
          avg: 0,
          min: metric.value,
          max: metric.value
        };
      }
      
      const agg = metricAggregations[metric.name];
      agg.sum += metric.value;
      agg.count += 1;
      agg.avg = agg.sum / agg.count;
      agg.min = Math.min(agg.min, metric.value);
      agg.max = Math.max(agg.max, metric.value);
    });
    
    aggregations.metricAggregations = metricAggregations;

    return aggregations;
  }

  private matchesQuery(event: AnalyticsEvent, query: AnalyticsQuery): boolean {
    // Time range filter
    if (event.timestamp < query.startTime || event.timestamp > query.endTime) {
      return false;
    }

    // Event type filter
    if (query.eventTypes && !query.eventTypes.includes(event.eventType)) {
      return false;
    }

    // User filter
    if (query.userIds && event.userId && !query.userIds.includes(event.userId)) {
      return false;
    }

    // Organization filter
    if (query.organizationIds && event.organizationId && 
        !query.organizationIds.includes(event.organizationId)) {
      return false;
    }

    // Custom filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (event.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesMetricQuery(metric: CustomMetric, query: AnalyticsQuery): boolean {
    // Time range filter
    if (metric.timestamp < query.startTime || metric.timestamp > query.endTime) {
      return false;
    }

    // Metric name filter
    if (query.metrics && !query.metrics.includes(metric.name)) {
      return false;
    }

    return true;
  }

  private getStorageKey(identifier: string, timestamp: Date): string {
    // Group by day for efficient storage and retrieval
    const date = timestamp.toISOString().split('T')[0];
    return `${identifier}-${date}`;
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupCleanupSchedule(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.retentionPeriod);
    
    let eventsDeleted = 0;
    let metricsDeleted = 0;

    // Clean up events
    for (const [key, eventList] of this.events) {
      const filteredEvents = eventList.filter(event => event.timestamp > cutoff);
      if (filteredEvents.length !== eventList.length) {
        eventsDeleted += eventList.length - filteredEvents.length;
        if (filteredEvents.length === 0) {
          this.events.delete(key);
        } else {
          this.events.set(key, filteredEvents);
        }
      }
    }

    // Clean up metrics
    for (const [key, metricList] of this.metrics) {
      const filteredMetrics = metricList.filter(metric => metric.timestamp > cutoff);
      if (filteredMetrics.length !== metricList.length) {
        metricsDeleted += metricList.length - filteredMetrics.length;
        if (filteredMetrics.length === 0) {
          this.metrics.delete(key);
        } else {
          this.metrics.set(key, filteredMetrics);
        }
      }
    }

    if (eventsDeleted > 0 || metricsDeleted > 0) {
      logger.info('Analytics data cleanup completed', {
        eventsDeleted,
        metricsDeleted,
        cutoffDate: cutoff.toISOString()
      });
    }
  }
}

export const analyticsService = new AnalyticsService();