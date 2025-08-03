"use strict";
/**
 * Enterprise Analytics Service
 * Advanced usage analytics with custom metrics and reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const events_1 = require("events");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
const performance_metrics_1 = require("../monitoring/infrastructure/performance-metrics");
class AnalyticsService extends events_1.EventEmitter {
    constructor() {
        super();
        this.events = new Map();
        this.metrics = new Map();
        this.isInitialized = false;
        this.retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
        this.setupCleanupSchedule();
    }
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Analytics service already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing analytics service');
        try {
            // Initialize storage
            await this.initializeStorage();
            // Setup default metrics
            await this.setupDefaultMetrics();
            this.isInitialized = true;
            structured_logger_1.logger.info('Analytics service initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize analytics service', error);
            throw error;
        }
    }
    /**
     * Track analytics event
     */
    trackEvent(event) {
        const fullEvent = {
            ...event,
            timestamp: new Date()
        };
        const key = this.getStorageKey(fullEvent.eventType, fullEvent.timestamp);
        if (!this.events.has(key)) {
            this.events.set(key, []);
        }
        this.events.get(key).push(fullEvent);
        // Emit event for real-time processing
        this.emit('event', fullEvent);
        // Update performance metrics
        performance_metrics_1.performanceMetrics.increment('analytics.events.total', 1, {
            eventType: fullEvent.eventType,
            source: fullEvent.source,
            organizationId: fullEvent.organizationId || 'unknown'
        });
        structured_logger_1.logger.debug('Analytics event tracked', {
            eventType: fullEvent.eventType,
            userId: fullEvent.userId,
            organizationId: fullEvent.organizationId,
            sessionId: fullEvent.sessionId
        });
    }
    /**
     * Record custom metric
     */
    recordMetric(metric) {
        const fullMetric = {
            ...metric,
            timestamp: new Date()
        };
        const key = this.getStorageKey(fullMetric.name, fullMetric.timestamp);
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push(fullMetric);
        // Emit metric for real-time processing
        this.emit('metric', fullMetric);
        // Update performance metrics
        performance_metrics_1.performanceMetrics.increment('analytics.metrics.total', 1, {
            metricName: fullMetric.name,
            metricType: fullMetric.type
        });
        structured_logger_1.logger.debug('Custom metric recorded', {
            name: fullMetric.name,
            value: fullMetric.value,
            type: fullMetric.type
        });
    }
    /**
     * Query analytics data
     */
    async query(query) {
        const startTime = Date.now();
        structured_logger_1.logger.info('Executing analytics query', {
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
            const report = {
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
            performance_metrics_1.performanceMetrics.histogram('analytics.query.execution_time', executionTime);
            performance_metrics_1.performanceMetrics.increment('analytics.queries.total', 1);
            structured_logger_1.logger.info('Analytics query completed', {
                reportId,
                totalEvents: events.length,
                totalMetrics: metrics.length,
                executionTime
            });
            return report;
        }
        catch (error) {
            structured_logger_1.logger.error('Analytics query failed', error);
            performance_metrics_1.performanceMetrics.increment('analytics.queries.failed', 1);
            throw error;
        }
    }
    /**
     * Get real-time analytics dashboard data
     */
    async getDashboardData() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const recentQuery = {
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
        const eventCounts = new Map();
        recentData.results.events.forEach(event => {
            eventCounts.set(event.eventType, (eventCounts.get(event.eventType) || 0) + 1);
        });
        const topEvents = Array.from(eventCounts.entries())
            .map(([eventType, count]) => ({ eventType, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // Get top metrics
        const metricSums = new Map();
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
    async initializeStorage() {
        // Initialize in-memory storage
        // In production, this would connect to a database
        this.events.clear();
        this.metrics.clear();
    }
    async setupDefaultMetrics() {
        // Setup default system metrics
        const defaultMetrics = [
            { name: 'system.uptime', type: 'gauge', value: process.uptime() },
            { name: 'system.memory.used', type: 'gauge', value: process.memoryUsage().heapUsed },
            { name: 'system.memory.total', type: 'gauge', value: process.memoryUsage().heapTotal }
        ];
        for (const metric of defaultMetrics) {
            this.recordMetric(metric);
        }
    }
    async queryEvents(query) {
        const events = [];
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
    async queryMetrics(query) {
        const metrics = [];
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
    async generateAggregations(events, metrics, query) {
        const aggregations = {};
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
        const metricAggregations = {};
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
    matchesQuery(event, query) {
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
    matchesMetricQuery(metric, query) {
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
    getStorageKey(identifier, timestamp) {
        // Group by day for efficient storage and retrieval
        const date = timestamp.toISOString().split('T')[0];
        return `${identifier}-${date}`;
    }
    generateReportId() {
        return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    setupCleanupSchedule() {
        // Run cleanup every hour
        setInterval(() => {
            this.cleanupOldData();
        }, 60 * 60 * 1000);
    }
    cleanupOldData() {
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
                }
                else {
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
                }
                else {
                    this.metrics.set(key, filteredMetrics);
                }
            }
        }
        if (eventsDeleted > 0 || metricsDeleted > 0) {
            structured_logger_1.logger.info('Analytics data cleanup completed', {
                eventsDeleted,
                metricsDeleted,
                cutoffDate: cutoff.toISOString()
            });
        }
    }
}
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
//# sourceMappingURL=analytics-service.js.map