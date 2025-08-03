"use strict";
/**
 * Enterprise Dashboard Service
 * Custom dashboard creation and management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = void 0;
const events_1 = require("events");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
const analytics_service_1 = require("./analytics-service");
const performance_metrics_1 = require("../monitoring/infrastructure/performance-metrics");
class DashboardService extends events_1.EventEmitter {
    constructor() {
        super();
        this.dashboards = new Map();
        this.templates = new Map();
        this.isInitialized = false;
    }
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Dashboard service already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing dashboard service');
        try {
            // Load default templates
            await this.loadDefaultTemplates();
            this.isInitialized = true;
            structured_logger_1.logger.info('Dashboard service initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize dashboard service', error);
            throw error;
        }
    }
    /**
     * Create a new dashboard
     */
    async createDashboard(userId, dashboardData) {
        const dashboard = {
            id: this.generateDashboardId(),
            ...dashboardData,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.dashboards.set(dashboard.id, dashboard);
        // Track creation
        performance_metrics_1.performanceMetrics.increment('dashboards.created', 1, {
            userId,
            organizationId: dashboard.organizationId || 'none'
        });
        structured_logger_1.logger.info('Dashboard created', {
            dashboardId: dashboard.id,
            userId,
            organizationId: dashboard.organizationId,
            widgetCount: dashboard.widgets.length
        });
        this.emit('dashboardCreated', dashboard);
        return dashboard;
    }
    /**
     * Update an existing dashboard
     */
    async updateDashboard(dashboardId, userId, updates) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        // Check permissions
        if (dashboard.userId !== userId && !dashboard.sharedWith.includes(userId)) {
            throw new Error('Insufficient permissions to update dashboard');
        }
        const updatedDashboard = {
            ...dashboard,
            ...updates,
            updatedAt: new Date()
        };
        this.dashboards.set(dashboardId, updatedDashboard);
        // Track update
        performance_metrics_1.performanceMetrics.increment('dashboards.updated', 1, {
            userId,
            dashboardId
        });
        structured_logger_1.logger.info('Dashboard updated', {
            dashboardId,
            userId,
            organizationId: dashboard.organizationId
        });
        this.emit('dashboardUpdated', updatedDashboard);
        return updatedDashboard;
    }
    /**
     * Delete a dashboard
     */
    async deleteDashboard(dashboardId, userId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        // Check permissions
        if (dashboard.userId !== userId) {
            throw new Error('Insufficient permissions to delete dashboard');
        }
        this.dashboards.delete(dashboardId);
        // Track deletion
        performance_metrics_1.performanceMetrics.increment('dashboards.deleted', 1, {
            userId,
            dashboardId
        });
        structured_logger_1.logger.info('Dashboard deleted', {
            dashboardId,
            userId,
            organizationId: dashboard.organizationId
        });
        this.emit('dashboardDeleted', { dashboardId, userId });
    }
    /**
     * Get dashboard by ID
     */
    async getDashboard(dashboardId, userId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            return null;
        }
        // Check permissions
        if (dashboard.userId !== userId &&
            !dashboard.sharedWith.includes(userId) &&
            !dashboard.isPublic) {
            throw new Error('Insufficient permissions to view dashboard');
        }
        // Track access
        performance_metrics_1.performanceMetrics.increment('dashboards.accessed', 1, {
            userId,
            dashboardId
        });
        return dashboard;
    }
    /**
     * List user's dashboards
     */
    async listUserDashboards(userId, organizationId) {
        const userDashboards = Array.from(this.dashboards.values()).filter(dashboard => {
            // Check if user has access
            const hasAccess = dashboard.userId === userId ||
                dashboard.sharedWith.includes(userId) ||
                dashboard.isPublic;
            // Check organization filter
            const orgMatches = !organizationId || dashboard.organizationId === organizationId;
            return hasAccess && orgMatches;
        });
        // Sort by updatedAt desc
        userDashboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return userDashboards;
    }
    /**
     * Execute dashboard data refresh
     */
    async refreshDashboardData(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        const startTime = Date.now();
        const widgetResults = [];
        for (const widget of dashboard.widgets) {
            try {
                const report = await analytics_service_1.analyticsService.query(widget.query);
                const processedData = this.processWidgetData(widget, report);
                widgetResults.push({
                    widgetId: widget.id,
                    data: processedData,
                    lastUpdated: new Date(),
                    error: undefined
                });
            }
            catch (error) {
                structured_logger_1.logger.error('Widget data refresh failed', {
                    dashboardId,
                    widgetId: widget.id,
                    error: error.message
                });
                widgetResults.push({
                    widgetId: widget.id,
                    data: null,
                    lastUpdated: new Date(),
                    error: error.message
                });
            }
        }
        const executionTime = Date.now() - startTime;
        // Track refresh performance
        performance_metrics_1.performanceMetrics.histogram('dashboard.refresh.execution_time', executionTime, {
            dashboardId,
            widgetCount: dashboard.widgets.length.toString()
        });
        structured_logger_1.logger.info('Dashboard data refreshed', {
            dashboardId,
            widgetCount: dashboard.widgets.length,
            executionTime,
            successCount: widgetResults.filter(w => !w.error).length,
            errorCount: widgetResults.filter(w => w.error).length
        });
        return {
            dashboardId,
            widgets: widgetResults
        };
    }
    /**
     * Share dashboard with users
     */
    async shareDashboard(dashboardId, userId, shareWithUserIds) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        // Check permissions
        if (dashboard.userId !== userId) {
            throw new Error('Insufficient permissions to share dashboard');
        }
        const updatedDashboard = {
            ...dashboard,
            sharedWith: [...new Set([...dashboard.sharedWith, ...shareWithUserIds])],
            updatedAt: new Date()
        };
        this.dashboards.set(dashboardId, updatedDashboard);
        // Track sharing
        performance_metrics_1.performanceMetrics.increment('dashboards.shared', 1, {
            userId,
            dashboardId,
            shareCount: shareWithUserIds.length.toString()
        });
        structured_logger_1.logger.info('Dashboard shared', {
            dashboardId,
            userId,
            sharedWithCount: shareWithUserIds.length,
            totalSharedWith: updatedDashboard.sharedWith.length
        });
        this.emit('dashboardShared', {
            dashboardId,
            userId,
            sharedWith: shareWithUserIds
        });
    }
    /**
     * Create dashboard from template
     */
    async createFromTemplate(templateId, userId, customizations) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        const dashboard = await this.createDashboard(userId, {
            ...template.template,
            name: customizations.name || template.template.name,
            description: customizations.description || template.template.description,
            organizationId: customizations.organizationId,
            userId
        });
        // Track template usage
        performance_metrics_1.performanceMetrics.increment('dashboard.templates.used', 1, {
            templateId,
            userId,
            organizationId: customizations.organizationId || 'none'
        });
        structured_logger_1.logger.info('Dashboard created from template', {
            templateId,
            dashboardId: dashboard.id,
            userId,
            organizationId: customizations.organizationId
        });
        return dashboard;
    }
    /**
     * Get available templates
     */
    async getTemplates(category) {
        const templates = Array.from(this.templates.values());
        if (category) {
            return templates.filter(t => t.category === category);
        }
        return templates;
    }
    /**
     * Export dashboard configuration
     */
    async exportDashboard(dashboardId, userId, format) {
        const dashboard = await this.getDashboard(dashboardId, userId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        // Track export
        performance_metrics_1.performanceMetrics.increment('dashboards.exported', 1, {
            userId,
            dashboardId,
            format
        });
        if (format === 'json') {
            return JSON.stringify(dashboard, null, 2);
        }
        else if (format === 'yaml') {
            // Simple YAML export (would use yaml library in production)
            return this.toYaml(dashboard);
        }
        throw new Error(`Unsupported export format: ${format}`);
    }
    processWidgetData(widget, report) {
        const { configuration } = widget;
        switch (widget.type) {
            case 'chart':
                return this.processChartData(report, configuration);
            case 'table':
                return this.processTableData(report, configuration);
            case 'metric':
                return this.processMetricData(report, configuration);
            case 'gauge':
                return this.processGaugeData(report, configuration);
            case 'heatmap':
                return this.processHeatmapData(report, configuration);
            default:
                return report.results;
        }
    }
    processChartData(report, config) {
        // Process data based on chart type and configuration
        const { chartType, aggregation, timeGrouping } = config;
        // Group data by time if specified
        if (timeGrouping) {
            const groupedData = this.groupDataByTime(report.results.events, timeGrouping);
            return {
                type: chartType,
                data: groupedData,
                aggregation
            };
        }
        return {
            type: chartType,
            data: report.results.events,
            aggregation
        };
    }
    processTableData(report, config) {
        const { columns } = config;
        return {
            columns: columns || ['eventType', 'timestamp', 'userId'],
            rows: report.results.events.map(event => ({
                eventType: event.eventType,
                timestamp: event.timestamp,
                userId: event.userId || 'anonymous',
                ...event.metadata
            }))
        };
    }
    processMetricData(report, config) {
        const { aggregation, unit } = config;
        let value = 0;
        if (aggregation === 'count') {
            value = report.results.events.length;
        }
        else if (aggregation === 'sum' && report.results.metrics.length > 0) {
            value = report.results.metrics.reduce((sum, metric) => sum + metric.value, 0);
        }
        return {
            value,
            unit: unit || '',
            aggregation
        };
    }
    processGaugeData(report, config) {
        const { threshold, unit } = config;
        const value = report.results.events.length;
        const percentage = threshold ? (value / threshold) * 100 : 0;
        return {
            value,
            percentage,
            threshold,
            unit: unit || '',
            status: percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : 'success'
        };
    }
    processHeatmapData(report, config) {
        // Simple heatmap based on event frequency
        const heatmapData = new Map();
        report.results.events.forEach(event => {
            const key = `${event.eventType}-${event.userId}`;
            heatmapData.set(key, (heatmapData.get(key) || 0) + 1);
        });
        return {
            data: Array.from(heatmapData.entries()).map(([key, count]) => ({
                x: key.split('-')[0],
                y: key.split('-')[1],
                value: count
            }))
        };
    }
    groupDataByTime(events, grouping) {
        const grouped = new Map();
        events.forEach(event => {
            const timestamp = new Date(event.timestamp);
            let key;
            switch (grouping) {
                case 'hour':
                    key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}`;
                    break;
                case 'day':
                    key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;
                    break;
                case 'week':
                    const weekNumber = Math.floor(timestamp.getTime() / (7 * 24 * 60 * 60 * 1000));
                    key = `week-${weekNumber}`;
                    break;
                case 'month':
                    key = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
                    break;
                default:
                    key = timestamp.toISOString();
            }
            grouped.set(key, (grouped.get(key) || 0) + 1);
        });
        return Array.from(grouped.entries()).map(([time, count]) => ({
            time,
            value: count
        }));
    }
    async loadDefaultTemplates() {
        const templates = [
            {
                id: 'executive-overview',
                name: 'Executive Overview',
                description: 'High-level metrics and KPIs for executives',
                category: 'executive',
                isDefault: true,
                template: {
                    name: 'Executive Overview',
                    description: 'High-level metrics and KPIs',
                    widgets: [
                        {
                            id: 'total-users',
                            type: 'metric',
                            title: 'Total Users',
                            query: {
                                startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                                endTime: new Date(),
                                eventTypes: ['user_login', 'user_registration']
                            },
                            configuration: {
                                aggregation: 'count',
                                unit: 'users',
                                color: '#2563eb'
                            },
                            position: { x: 0, y: 0, width: 3, height: 2 },
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            id: 'user-activity',
                            type: 'chart',
                            title: 'User Activity Over Time',
                            query: {
                                startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                                endTime: new Date(),
                                eventTypes: ['user_login', 'user_action']
                            },
                            configuration: {
                                chartType: 'line',
                                timeGrouping: 'hour',
                                aggregation: 'count'
                            },
                            position: { x: 3, y: 0, width: 6, height: 4 },
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    ],
                    layout: {
                        columns: 12,
                        rows: 8,
                        gridSize: 20
                    },
                    settings: {
                        autoRefresh: true,
                        refreshInterval: 300,
                        theme: 'light',
                        timezone: 'UTC'
                    },
                    isPublic: false,
                    sharedWith: []
                }
            },
            {
                id: 'operations-dashboard',
                name: 'Operations Dashboard',
                description: 'System performance and operational metrics',
                category: 'operations',
                isDefault: true,
                template: {
                    name: 'Operations Dashboard',
                    description: 'System performance and operational metrics',
                    widgets: [
                        {
                            id: 'system-health',
                            type: 'gauge',
                            title: 'System Health',
                            query: {
                                startTime: new Date(Date.now() - 60 * 60 * 1000),
                                endTime: new Date(),
                                metrics: ['system.health']
                            },
                            configuration: {
                                threshold: 100,
                                unit: '%',
                                color: '#10b981'
                            },
                            position: { x: 0, y: 0, width: 3, height: 3 },
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            id: 'error-rate',
                            type: 'chart',
                            title: 'Error Rate',
                            query: {
                                startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
                                endTime: new Date(),
                                eventTypes: ['error', 'exception']
                            },
                            configuration: {
                                chartType: 'area',
                                timeGrouping: 'hour',
                                aggregation: 'count',
                                color: '#ef4444'
                            },
                            position: { x: 3, y: 0, width: 6, height: 3 },
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    ],
                    layout: {
                        columns: 12,
                        rows: 8,
                        gridSize: 20
                    },
                    settings: {
                        autoRefresh: true,
                        refreshInterval: 60,
                        theme: 'dark',
                        timezone: 'UTC'
                    },
                    isPublic: false,
                    sharedWith: []
                }
            }
        ];
        for (const template of templates) {
            this.templates.set(template.id, template);
        }
        structured_logger_1.logger.info('Default dashboard templates loaded', {
            templateCount: templates.length
        });
    }
    generateDashboardId() {
        return `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    toYaml(obj) {
        // Simple YAML serialization (would use yaml library in production)
        return JSON.stringify(obj, null, 2)
            .replace(/"/g, '')
            .replace(/,$/gm, '')
            .replace(/\{/g, '')
            .replace(/\}/g, '');
    }
}
exports.DashboardService = DashboardService;
exports.dashboardService = new DashboardService();
//# sourceMappingURL=dashboard-service.js.map