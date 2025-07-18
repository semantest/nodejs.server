/**
 * Enterprise Dashboard Service
 * Custom dashboard creation and management
 */

import { EventEmitter } from 'events';
import { logger } from '../monitoring/infrastructure/structured-logger';
import { analyticsService, AnalyticsQuery, AnalyticsReport } from './analytics-service';
import { performanceMetrics } from '../monitoring/infrastructure/performance-metrics';

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
    refreshInterval?: number; // in seconds
  };
  position: { x: number; y: number; width: number; height: number };
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
    refreshInterval: number; // in seconds
    theme: 'light' | 'dark';
    timezone: string;
  };
  isPublic: boolean;
  sharedWith: string[]; // User IDs
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

export class DashboardService extends EventEmitter {
  private dashboards: Map<string, Dashboard> = new Map();
  private templates: Map<string, DashboardTemplate> = new Map();
  private isInitialized = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Dashboard service already initialized');
      return;
    }

    logger.info('Initializing dashboard service');

    try {
      // Load default templates
      await this.loadDefaultTemplates();
      
      this.isInitialized = true;
      logger.info('Dashboard service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize dashboard service', error);
      throw error;
    }
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(
    userId: string,
    dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    const dashboard: Dashboard = {
      id: this.generateDashboardId(),
      ...dashboardData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(dashboard.id, dashboard);

    // Track creation
    performanceMetrics.increment('dashboards.created', 1, {
      userId,
      organizationId: dashboard.organizationId || 'none'
    });

    logger.info('Dashboard created', {
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
  async updateDashboard(
    dashboardId: string,
    userId: string,
    updates: Partial<Omit<Dashboard, 'id' | 'createdAt'>>
  ): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    // Check permissions
    if (dashboard.userId !== userId && !dashboard.sharedWith.includes(userId)) {
      throw new Error('Insufficient permissions to update dashboard');
    }

    const updatedDashboard: Dashboard = {
      ...dashboard,
      ...updates,
      updatedAt: new Date()
    };

    this.dashboards.set(dashboardId, updatedDashboard);

    // Track update
    performanceMetrics.increment('dashboards.updated', 1, {
      userId,
      dashboardId
    });

    logger.info('Dashboard updated', {
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
  async deleteDashboard(dashboardId: string, userId: string): Promise<void> {
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
    performanceMetrics.increment('dashboards.deleted', 1, {
      userId,
      dashboardId
    });

    logger.info('Dashboard deleted', {
      dashboardId,
      userId,
      organizationId: dashboard.organizationId
    });

    this.emit('dashboardDeleted', { dashboardId, userId });
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(dashboardId: string, userId: string): Promise<Dashboard | null> {
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
    performanceMetrics.increment('dashboards.accessed', 1, {
      userId,
      dashboardId
    });

    return dashboard;
  }

  /**
   * List user's dashboards
   */
  async listUserDashboards(
    userId: string,
    organizationId?: string
  ): Promise<Dashboard[]> {
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
  async refreshDashboardData(dashboardId: string): Promise<{
    dashboardId: string;
    widgets: Array<{
      widgetId: string;
      data: any;
      lastUpdated: Date;
      error?: string;
    }>;
  }> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const startTime = Date.now();
    const widgetResults = [];

    for (const widget of dashboard.widgets) {
      try {
        const report = await analyticsService.query(widget.query);
        const processedData = this.processWidgetData(widget, report);
        
        widgetResults.push({
          widgetId: widget.id,
          data: processedData,
          lastUpdated: new Date(),
          error: undefined
        });
      } catch (error) {
        logger.error('Widget data refresh failed', {
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
    performanceMetrics.histogram('dashboard.refresh.execution_time', executionTime, {
      dashboardId,
      widgetCount: dashboard.widgets.length.toString()
    });

    logger.info('Dashboard data refreshed', {
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
  async shareDashboard(
    dashboardId: string,
    userId: string,
    shareWithUserIds: string[]
  ): Promise<void> {
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
    performanceMetrics.increment('dashboards.shared', 1, {
      userId,
      dashboardId,
      shareCount: shareWithUserIds.length.toString()
    });

    logger.info('Dashboard shared', {
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
  async createFromTemplate(
    templateId: string,
    userId: string,
    customizations: {
      name?: string;
      description?: string;
      organizationId?: string;
    }
  ): Promise<Dashboard> {
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
    performanceMetrics.increment('dashboard.templates.used', 1, {
      templateId,
      userId,
      organizationId: customizations.organizationId || 'none'
    });

    logger.info('Dashboard created from template', {
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
  async getTemplates(category?: string): Promise<DashboardTemplate[]> {
    const templates = Array.from(this.templates.values());
    
    if (category) {
      return templates.filter(t => t.category === category);
    }
    
    return templates;
  }

  /**
   * Export dashboard configuration
   */
  async exportDashboard(
    dashboardId: string,
    userId: string,
    format: 'json' | 'yaml'
  ): Promise<string> {
    const dashboard = await this.getDashboard(dashboardId, userId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    // Track export
    performanceMetrics.increment('dashboards.exported', 1, {
      userId,
      dashboardId,
      format
    });

    if (format === 'json') {
      return JSON.stringify(dashboard, null, 2);
    } else if (format === 'yaml') {
      // Simple YAML export (would use yaml library in production)
      return this.toYaml(dashboard);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  private processWidgetData(widget: DashboardWidget, report: AnalyticsReport): any {
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

  private processChartData(report: AnalyticsReport, config: any): any {
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

  private processTableData(report: AnalyticsReport, config: any): any {
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

  private processMetricData(report: AnalyticsReport, config: any): any {
    const { aggregation, unit } = config;
    
    let value = 0;
    if (aggregation === 'count') {
      value = report.results.events.length;
    } else if (aggregation === 'sum' && report.results.metrics.length > 0) {
      value = report.results.metrics.reduce((sum, metric) => sum + metric.value, 0);
    }

    return {
      value,
      unit: unit || '',
      aggregation
    };
  }

  private processGaugeData(report: AnalyticsReport, config: any): any {
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

  private processHeatmapData(report: AnalyticsReport, config: any): any {
    // Simple heatmap based on event frequency
    const heatmapData = new Map<string, number>();
    
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

  private groupDataByTime(events: any[], grouping: string): any[] {
    const grouped = new Map<string, number>();
    
    events.forEach(event => {
      const timestamp = new Date(event.timestamp);
      let key: string;
      
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

  private async loadDefaultTemplates(): Promise<void> {
    const templates: DashboardTemplate[] = [
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

    logger.info('Default dashboard templates loaded', {
      templateCount: templates.length
    });
  }

  private generateDashboardId(): string {
    return `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private toYaml(obj: any): string {
    // Simple YAML serialization (would use yaml library in production)
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/\{/g, '')
      .replace(/\}/g, '');
  }
}

export const dashboardService = new DashboardService();