/**
 * Enterprise Analytics Module
 * Main entry point for analytics, reporting, and real-time monitoring
 */

export { 
  AnalyticsService, 
  analyticsService,
  AnalyticsEvent,
  CustomMetric,
  AnalyticsQuery,
  AnalyticsReport
} from './analytics-service';

export { 
  DashboardService, 
  dashboardService,
  Dashboard,
  DashboardWidget,
  DashboardTemplate
} from './dashboard-service';

export { 
  ExportService, 
  exportService,
  ExportRequest,
  ExportResult
} from './export-service';

export { 
  RealtimeService, 
  realtimeService,
  RealtimeSubscription,
  RealtimeMetrics,
  RealtimeAlert
} from './realtime-service';

import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { analyticsService } from './analytics-service';
import { dashboardService } from './dashboard-service';
import { exportService } from './export-service';
import { RealtimeService, realtimeService } from './realtime-service';
import { logger } from '../monitoring/infrastructure/structured-logger';

/**
 * Initialize analytics module
 */
export async function initializeAnalytics(app: Express, io: SocketIOServer): Promise<void> {
  logger.info('Initializing analytics module');

  try {
    // Initialize services
    await analyticsService.initialize();
    await dashboardService.initialize();
    await exportService.initialize();
    
    // Initialize real-time service with Socket.IO
    const realtime = new RealtimeService(io);
    await realtime.initialize();
    
    // Set global realtime service
    Object.assign(realtimeService, realtime);
    
    // Setup Express routes
    setupAnalyticsRoutes(app);
    
    logger.info('Analytics module initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize analytics module', error);
    throw error;
  }
}

/**
 * Setup analytics REST API routes
 */
function setupAnalyticsRoutes(app: Express): void {
  // Analytics routes
  app.post('/api/analytics/events', async (req, res) => {
    try {
      const { eventType, userId, organizationId, sessionId, metadata, tags, source, version } = req.body;
      
      analyticsService.trackEvent({
        eventType,
        userId,
        organizationId,
        sessionId,
        metadata: metadata || {},
        tags: tags || [],
        source: source || 'api',
        version: version || '1.0'
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to track analytics event', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/analytics/metrics', async (req, res) => {
    try {
      const { name, value, type, labels, description } = req.body;
      
      analyticsService.recordMetric({
        name,
        value,
        type: type || 'gauge',
        labels: labels || {},
        description
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to record custom metric', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/analytics/query', async (req, res) => {
    try {
      const query = req.body;
      const report = await analyticsService.query(query);
      res.json(report);
    } catch (error) {
      logger.error('Failed to execute analytics query', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/analytics/dashboard', async (req, res) => {
    try {
      const dashboardData = await analyticsService.getDashboardData();
      res.json(dashboardData);
    } catch (error) {
      logger.error('Failed to get dashboard data', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard routes
  app.get('/api/dashboards', async (req, res) => {
    try {
      const { userId, organizationId } = req.query;
      const dashboards = await dashboardService.listUserDashboards(
        userId as string,
        organizationId as string
      );
      res.json(dashboards);
    } catch (error) {
      logger.error('Failed to list dashboards', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/dashboards', async (req, res) => {
    try {
      const { userId, ...dashboardData } = req.body;
      const dashboard = await dashboardService.createDashboard(userId, dashboardData);
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to create dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/dashboards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      const dashboard = await dashboardService.getDashboard(id, userId as string);
      
      if (!dashboard) {
        return res.status(404).json({ error: 'Dashboard not found' });
      }
      
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to get dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/dashboards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, ...updates } = req.body;
      const dashboard = await dashboardService.updateDashboard(id, userId, updates);
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to update dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/dashboards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      await dashboardService.deleteDashboard(id, userId as string);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/dashboards/:id/refresh', async (req, res) => {
    try {
      const { id } = req.params;
      const data = await dashboardService.refreshDashboardData(id);
      res.json(data);
    } catch (error) {
      logger.error('Failed to refresh dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/dashboards/:id/share', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, shareWithUserIds } = req.body;
      await dashboardService.shareDashboard(id, userId, shareWithUserIds);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to share dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/dashboard-templates', async (req, res) => {
    try {
      const { category } = req.query;
      const templates = await dashboardService.getTemplates(category as string);
      res.json(templates);
    } catch (error) {
      logger.error('Failed to get dashboard templates', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/dashboards/from-template', async (req, res) => {
    try {
      const { templateId, userId, customizations } = req.body;
      const dashboard = await dashboardService.createFromTemplate(
        templateId,
        userId,
        customizations
      );
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to create dashboard from template', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export routes
  app.post('/api/exports', async (req, res) => {
    try {
      const { type, format, source, userId, organizationId, options } = req.body;
      const exportRequest = await exportService.requestExport(
        type,
        format,
        source,
        userId,
        organizationId,
        options
      );
      res.json(exportRequest);
    } catch (error) {
      logger.error('Failed to request export', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/exports', async (req, res) => {
    try {
      const { userId, organizationId, status } = req.query;
      const exports = await exportService.listUserExports(
        userId as string,
        organizationId as string,
        status as any
      );
      res.json(exports);
    } catch (error) {
      logger.error('Failed to list exports', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/exports/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      const exportRequest = await exportService.getExportStatus(id, userId as string);
      
      if (!exportRequest) {
        return res.status(404).json({ error: 'Export not found' });
      }
      
      res.json(exportRequest);
    } catch (error) {
      logger.error('Failed to get export status', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/exports/:id/download', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      const download = await exportService.downloadExport(id, userId as string);
      
      res.set({
        'Content-Type': download.contentType,
        'Content-Disposition': `attachment; filename="${download.fileName}"`,
        'Content-Length': download.data.length
      });
      
      res.send(download.data);
    } catch (error) {
      logger.error('Failed to download export', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/exports/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      await exportService.cancelExport(id, userId as string);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to cancel export', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Real-time metrics routes
  app.get('/api/realtime/metrics', (req, res) => {
    try {
      const metrics = realtimeService.getMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get realtime metrics', error);
      res.status(500).json({ error: error.message });
    }
  });

  logger.info('Analytics API routes configured');
}

/**
 * Shutdown analytics module
 */
export async function shutdownAnalytics(): Promise<void> {
  logger.info('Shutting down analytics module');
  
  try {
    if (realtimeService) {
      await realtimeService.shutdown();
    }
    
    logger.info('Analytics module shut down successfully');
  } catch (error) {
    logger.error('Error shutting down analytics module', error);
  }
}