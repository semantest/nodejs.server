"use strict";
/**
 * Enterprise Analytics Module
 * Main entry point for analytics, reporting, and real-time monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeService = exports.RealtimeService = exports.exportService = exports.ExportService = exports.dashboardService = exports.DashboardService = exports.analyticsService = exports.AnalyticsService = void 0;
exports.initializeAnalytics = initializeAnalytics;
exports.shutdownAnalytics = shutdownAnalytics;
var analytics_service_1 = require("./analytics-service");
Object.defineProperty(exports, "AnalyticsService", { enumerable: true, get: function () { return analytics_service_1.AnalyticsService; } });
Object.defineProperty(exports, "analyticsService", { enumerable: true, get: function () { return analytics_service_1.analyticsService; } });
var dashboard_service_1 = require("./dashboard-service");
Object.defineProperty(exports, "DashboardService", { enumerable: true, get: function () { return dashboard_service_1.DashboardService; } });
Object.defineProperty(exports, "dashboardService", { enumerable: true, get: function () { return dashboard_service_1.dashboardService; } });
var export_service_1 = require("./export-service");
Object.defineProperty(exports, "ExportService", { enumerable: true, get: function () { return export_service_1.ExportService; } });
Object.defineProperty(exports, "exportService", { enumerable: true, get: function () { return export_service_1.exportService; } });
var realtime_service_1 = require("./realtime-service");
Object.defineProperty(exports, "RealtimeService", { enumerable: true, get: function () { return realtime_service_1.RealtimeService; } });
Object.defineProperty(exports, "realtimeService", { enumerable: true, get: function () { return realtime_service_1.realtimeService; } });
const analytics_service_2 = require("./analytics-service");
const dashboard_service_2 = require("./dashboard-service");
const export_service_2 = require("./export-service");
const realtime_service_2 = require("./realtime-service");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
/**
 * Initialize analytics module
 */
async function initializeAnalytics(app, io) {
    structured_logger_1.logger.info('Initializing analytics module');
    try {
        // Initialize services
        await analytics_service_2.analyticsService.initialize();
        await dashboard_service_2.dashboardService.initialize();
        await export_service_2.exportService.initialize();
        // Initialize real-time service with Socket.IO
        const realtime = new realtime_service_2.RealtimeService(io);
        await realtime.initialize();
        // Set global realtime service
        Object.assign(realtime_service_2.realtimeService, realtime);
        // Setup Express routes
        setupAnalyticsRoutes(app);
        structured_logger_1.logger.info('Analytics module initialized successfully');
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to initialize analytics module', error);
        throw error;
    }
}
/**
 * Setup analytics REST API routes
 */
function setupAnalyticsRoutes(app) {
    // Analytics routes
    app.post('/api/analytics/events', async (req, res) => {
        try {
            const { eventType, userId, organizationId, sessionId, metadata, tags, source, version } = req.body;
            analytics_service_2.analyticsService.trackEvent({
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
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to track analytics event', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/analytics/metrics', async (req, res) => {
        try {
            const { name, value, type, labels, description } = req.body;
            analytics_service_2.analyticsService.recordMetric({
                name,
                value,
                type: type || 'gauge',
                labels: labels || {},
                description
            });
            res.json({ success: true });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to record custom metric', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/analytics/query', async (req, res) => {
        try {
            const query = req.body;
            const report = await analytics_service_2.analyticsService.query(query);
            res.json(report);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to execute analytics query', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/analytics/dashboard', async (req, res) => {
        try {
            const dashboardData = await analytics_service_2.analyticsService.getDashboardData();
            res.json(dashboardData);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get dashboard data', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Dashboard routes
    app.get('/api/dashboards', async (req, res) => {
        try {
            const { userId, organizationId } = req.query;
            const dashboards = await dashboard_service_2.dashboardService.listUserDashboards(userId, organizationId);
            res.json(dashboards);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list dashboards', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/dashboards', async (req, res) => {
        try {
            const { userId, ...dashboardData } = req.body;
            const dashboard = await dashboard_service_2.dashboardService.createDashboard(userId, dashboardData);
            res.json(dashboard);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to create dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/dashboards/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId } = req.query;
            const dashboard = await dashboard_service_2.dashboardService.getDashboard(id, userId);
            if (!dashboard) {
                return res.status(404).json({ error: 'Dashboard not found' });
            }
            res.json(dashboard);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/api/dashboards/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId, ...updates } = req.body;
            const dashboard = await dashboard_service_2.dashboardService.updateDashboard(id, userId, updates);
            res.json(dashboard);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to update dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/api/dashboards/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId } = req.query;
            await dashboard_service_2.dashboardService.deleteDashboard(id, userId);
            res.json({ success: true });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to delete dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/dashboards/:id/refresh', async (req, res) => {
        try {
            const { id } = req.params;
            const data = await dashboard_service_2.dashboardService.refreshDashboardData(id);
            res.json(data);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to refresh dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/dashboards/:id/share', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId, shareWithUserIds } = req.body;
            await dashboard_service_2.dashboardService.shareDashboard(id, userId, shareWithUserIds);
            res.json({ success: true });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to share dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/dashboard-templates', async (req, res) => {
        try {
            const { category } = req.query;
            const templates = await dashboard_service_2.dashboardService.getTemplates(category);
            res.json(templates);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get dashboard templates', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/dashboards/from-template', async (req, res) => {
        try {
            const { templateId, userId, customizations } = req.body;
            const dashboard = await dashboard_service_2.dashboardService.createFromTemplate(templateId, userId, customizations);
            res.json(dashboard);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to create dashboard from template', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Export routes
    app.post('/api/exports', async (req, res) => {
        try {
            const { type, format, source, userId, organizationId, options } = req.body;
            const exportRequest = await export_service_2.exportService.requestExport(type, format, source, userId, organizationId, options);
            res.json(exportRequest);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to request export', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/exports', async (req, res) => {
        try {
            const { userId, organizationId, status } = req.query;
            const exports = await export_service_2.exportService.listUserExports(userId, organizationId, status);
            res.json(exports);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list exports', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/exports/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId } = req.query;
            const exportRequest = await export_service_2.exportService.getExportStatus(id, userId);
            if (!exportRequest) {
                return res.status(404).json({ error: 'Export not found' });
            }
            res.json(exportRequest);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get export status', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/exports/:id/download', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId } = req.query;
            const download = await export_service_2.exportService.downloadExport(id, userId);
            res.set({
                'Content-Type': download.contentType,
                'Content-Disposition': `attachment; filename="${download.fileName}"`,
                'Content-Length': download.data.length
            });
            res.send(download.data);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to download export', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/api/exports/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { userId } = req.query;
            await export_service_2.exportService.cancelExport(id, userId);
            res.json({ success: true });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to cancel export', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Real-time metrics routes
    app.get('/api/realtime/metrics', (req, res) => {
        try {
            const metrics = realtime_service_2.realtimeService.getMetrics();
            res.json(metrics);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get realtime metrics', error);
            res.status(500).json({ error: error.message });
        }
    });
    structured_logger_1.logger.info('Analytics API routes configured');
}
/**
 * Shutdown analytics module
 */
async function shutdownAnalytics() {
    structured_logger_1.logger.info('Shutting down analytics module');
    try {
        if (realtime_service_2.realtimeService) {
            await realtime_service_2.realtimeService.shutdown();
        }
        structured_logger_1.logger.info('Analytics module shut down successfully');
    }
    catch (error) {
        structured_logger_1.logger.error('Error shutting down analytics module', error);
    }
}
//# sourceMappingURL=index.js.map