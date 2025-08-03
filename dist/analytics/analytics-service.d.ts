/**
 * Enterprise Analytics Service
 * Advanced usage analytics with custom metrics and reporting
 */
import { EventEmitter } from 'events';
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
export declare class AnalyticsService extends EventEmitter {
    private events;
    private metrics;
    private isInitialized;
    private retentionPeriod;
    constructor();
    initialize(): Promise<void>;
    /**
     * Track analytics event
     */
    trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void;
    /**
     * Record custom metric
     */
    recordMetric(metric: Omit<CustomMetric, 'timestamp'>): void;
    /**
     * Query analytics data
     */
    query(query: AnalyticsQuery): Promise<AnalyticsReport>;
    /**
     * Get real-time analytics dashboard data
     */
    getDashboardData(): Promise<{
        realTimeEvents: AnalyticsEvent[];
        realTimeMetrics: CustomMetric[];
        summaryStats: Record<string, any>;
        topEvents: Array<{
            eventType: string;
            count: number;
        }>;
        topMetrics: Array<{
            name: string;
            value: number;
        }>;
    }>;
    private initializeStorage;
    private setupDefaultMetrics;
    private queryEvents;
    private queryMetrics;
    private generateAggregations;
    private matchesQuery;
    private matchesMetricQuery;
    private getStorageKey;
    private generateReportId;
    private setupCleanupSchedule;
    private cleanupOldData;
}
export declare const analyticsService: AnalyticsService;
//# sourceMappingURL=analytics-service.d.ts.map