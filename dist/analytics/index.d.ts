/**
 * Enterprise Analytics Module
 * Main entry point for analytics, reporting, and real-time monitoring
 */
export { AnalyticsService, analyticsService, AnalyticsEvent, CustomMetric, AnalyticsQuery, AnalyticsReport } from './analytics-service';
export { DashboardService, dashboardService, Dashboard, DashboardWidget, DashboardTemplate } from './dashboard-service';
export { ExportService, exportService, ExportRequest, ExportResult } from './export-service';
export { RealtimeService, realtimeService, RealtimeSubscription, RealtimeMetrics, RealtimeAlert } from './realtime-service';
import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
/**
 * Initialize analytics module
 */
export declare function initializeAnalytics(app: Express, io: SocketIOServer): Promise<void>;
/**
 * Shutdown analytics module
 */
export declare function shutdownAnalytics(): Promise<void>;
//# sourceMappingURL=index.d.ts.map