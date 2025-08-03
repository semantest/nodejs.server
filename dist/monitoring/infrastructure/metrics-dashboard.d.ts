/**
 * Metrics Dashboard
 * Provides a comprehensive dashboard for monitoring system metrics and alerts
 */
import { Router } from 'express';
/**
 * Dashboard data aggregator
 */
export declare class MetricsDashboard {
    private dashboardHTML;
    private lastUpdateTime;
    private cachedData;
    private cacheExpiry;
    constructor();
    /**
     * Get dashboard router
     */
    getDashboardRouter(): Router;
    /**
     * Get overview data
     */
    private getOverviewData;
    /**
     * Get metrics data
     */
    private getMetricsData;
    /**
     * Get alerts data
     */
    private getAlertsData;
    /**
     * Generate dashboard HTML
     */
    private generateDashboardHTML;
}
/**
 * Default dashboard instance
 */
export declare const metricsDashboard: MetricsDashboard;
//# sourceMappingURL=metrics-dashboard.d.ts.map