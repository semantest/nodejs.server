/**
 * Enterprise Dashboard Service
 * Custom dashboard creation and management
 */
import { EventEmitter } from 'events';
import { AnalyticsQuery } from './analytics-service';
export interface DashboardWidget {
    id: string;
    type: 'chart' | 'table' | 'metric' | 'text' | 'gauge' | 'heatmap';
    title: string;
    description?: string;
    query: AnalyticsQuery;
    configuration: {
        chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
        aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
        timeGrouping?: 'hour' | 'day' | 'week' | 'month';
        columns?: string[];
        filters?: Record<string, any>;
        threshold?: number;
        unit?: string;
        color?: string;
        refreshInterval?: number;
    };
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface Dashboard {
    id: string;
    name: string;
    description?: string;
    organizationId?: string;
    userId: string;
    widgets: DashboardWidget[];
    layout: {
        columns: number;
        rows: number;
        gridSize: number;
    };
    settings: {
        autoRefresh: boolean;
        refreshInterval: number;
        theme: 'light' | 'dark';
        timezone: string;
    };
    isPublic: boolean;
    sharedWith: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    category: 'executive' | 'operations' | 'analytics' | 'security' | 'custom';
    template: Omit<Dashboard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
    isDefault: boolean;
}
export declare class DashboardService extends EventEmitter {
    private dashboards;
    private templates;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    /**
     * Create a new dashboard
     */
    createDashboard(userId: string, dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard>;
    /**
     * Update an existing dashboard
     */
    updateDashboard(dashboardId: string, userId: string, updates: Partial<Omit<Dashboard, 'id' | 'createdAt'>>): Promise<Dashboard>;
    /**
     * Delete a dashboard
     */
    deleteDashboard(dashboardId: string, userId: string): Promise<void>;
    /**
     * Get dashboard by ID
     */
    getDashboard(dashboardId: string, userId: string): Promise<Dashboard | null>;
    /**
     * List user's dashboards
     */
    listUserDashboards(userId: string, organizationId?: string): Promise<Dashboard[]>;
    /**
     * Execute dashboard data refresh
     */
    refreshDashboardData(dashboardId: string): Promise<{
        dashboardId: string;
        widgets: Array<{
            widgetId: string;
            data: any;
            lastUpdated: Date;
            error?: string;
        }>;
    }>;
    /**
     * Share dashboard with users
     */
    shareDashboard(dashboardId: string, userId: string, shareWithUserIds: string[]): Promise<void>;
    /**
     * Create dashboard from template
     */
    createFromTemplate(templateId: string, userId: string, customizations: {
        name?: string;
        description?: string;
        organizationId?: string;
    }): Promise<Dashboard>;
    /**
     * Get available templates
     */
    getTemplates(category?: string): Promise<DashboardTemplate[]>;
    /**
     * Export dashboard configuration
     */
    exportDashboard(dashboardId: string, userId: string, format: 'json' | 'yaml'): Promise<string>;
    private processWidgetData;
    private processChartData;
    private processTableData;
    private processMetricData;
    private processGaugeData;
    private processHeatmapData;
    private groupDataByTime;
    private loadDefaultTemplates;
    private generateDashboardId;
    private toYaml;
}
export declare const dashboardService: DashboardService;
//# sourceMappingURL=dashboard-service.d.ts.map