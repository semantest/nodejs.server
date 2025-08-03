"use strict";
/**
 * Enterprise Export Service
 * Export capabilities for analytics reports (PDF, CSV, JSON, Excel)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const events_1 = require("events");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
const performance_metrics_1 = require("../monitoring/infrastructure/performance-metrics");
const analytics_service_1 = require("./analytics-service");
const dashboard_service_1 = require("./dashboard-service");
class ExportService extends events_1.EventEmitter {
    constructor() {
        super();
        this.exports = new Map();
        this.isInitialized = false;
        this.exportRetentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.maxConcurrentExports = 5;
        this.activeExports = 0;
        this.setupCleanupSchedule();
    }
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Export service already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing export service');
        try {
            // Initialize export storage
            await this.initializeStorage();
            this.isInitialized = true;
            structured_logger_1.logger.info('Export service initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize export service', error);
            throw error;
        }
    }
    /**
     * Request data export
     */
    async requestExport(type, format, source, userId, organizationId, options = {}) {
        if (this.activeExports >= this.maxConcurrentExports) {
            throw new Error('Maximum concurrent exports reached. Please try again later.');
        }
        const exportRequest = {
            id: this.generateExportId(),
            type,
            format,
            source,
            userId,
            organizationId,
            options: {
                includeCharts: true,
                includeRawData: true,
                includeMetadata: true,
                compressed: false,
                ...options
            },
            status: 'pending',
            progress: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.exports.set(exportRequest.id, exportRequest);
        // Start export processing
        this.processExport(exportRequest);
        // Track export request
        performance_metrics_1.performanceMetrics.increment('exports.requested', 1, {
            type,
            format,
            userId,
            organizationId: organizationId || 'none'
        });
        structured_logger_1.logger.info('Export requested', {
            exportId: exportRequest.id,
            type,
            format,
            userId,
            organizationId
        });
        this.emit('exportRequested', exportRequest);
        return exportRequest;
    }
    /**
     * Get export status
     */
    async getExportStatus(exportId, userId) {
        const exportRequest = this.exports.get(exportId);
        if (!exportRequest) {
            return null;
        }
        // Check permissions
        if (exportRequest.userId !== userId) {
            throw new Error('Insufficient permissions to view export');
        }
        return exportRequest;
    }
    /**
     * List user's exports
     */
    async listUserExports(userId, organizationId, status) {
        const userExports = Array.from(this.exports.values()).filter(exp => {
            const userMatches = exp.userId === userId;
            const orgMatches = !organizationId || exp.organizationId === organizationId;
            const statusMatches = !status || exp.status === status;
            return userMatches && orgMatches && statusMatches;
        });
        // Sort by created date desc
        userExports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return userExports;
    }
    /**
     * Cancel export
     */
    async cancelExport(exportId, userId) {
        const exportRequest = this.exports.get(exportId);
        if (!exportRequest) {
            throw new Error(`Export not found: ${exportId}`);
        }
        // Check permissions
        if (exportRequest.userId !== userId) {
            throw new Error('Insufficient permissions to cancel export');
        }
        if (exportRequest.status === 'completed') {
            throw new Error('Cannot cancel completed export');
        }
        exportRequest.status = 'failed';
        exportRequest.error = 'Cancelled by user';
        exportRequest.updatedAt = new Date();
        this.exports.set(exportId, exportRequest);
        // Track cancellation
        performance_metrics_1.performanceMetrics.increment('exports.cancelled', 1, {
            type: exportRequest.type,
            format: exportRequest.format,
            userId
        });
        structured_logger_1.logger.info('Export cancelled', {
            exportId,
            userId,
            type: exportRequest.type,
            format: exportRequest.format
        });
        this.emit('exportCancelled', exportRequest);
    }
    /**
     * Download export file
     */
    async downloadExport(exportId, userId) {
        const exportRequest = this.exports.get(exportId);
        if (!exportRequest) {
            throw new Error(`Export not found: ${exportId}`);
        }
        // Check permissions
        if (exportRequest.userId !== userId) {
            throw new Error('Insufficient permissions to download export');
        }
        if (exportRequest.status !== 'completed') {
            throw new Error('Export is not ready for download');
        }
        if (!exportRequest.downloadUrl) {
            throw new Error('Export file not available');
        }
        // Track download
        performance_metrics_1.performanceMetrics.increment('exports.downloaded', 1, {
            type: exportRequest.type,
            format: exportRequest.format,
            userId
        });
        // In production, this would fetch from file storage
        const mockData = Buffer.from('Mock export data');
        return {
            fileName: exportRequest.options.fileName || `export-${exportId}.${exportRequest.format}`,
            contentType: this.getContentType(exportRequest.format),
            data: mockData
        };
    }
    async processExport(exportRequest) {
        this.activeExports++;
        try {
            exportRequest.status = 'processing';
            exportRequest.progress = 0;
            exportRequest.updatedAt = new Date();
            this.updateExportStatus(exportRequest);
            const startTime = Date.now();
            // Get data based on type
            let data;
            if (exportRequest.type === 'dashboard') {
                data = await this.getDashboardData(exportRequest.source, exportRequest.userId);
            }
            else {
                data = await this.getQueryData(exportRequest.source);
            }
            exportRequest.progress = 50;
            this.updateExportStatus(exportRequest);
            // Generate export file
            const exportResult = await this.generateExportFile(exportRequest, data);
            exportRequest.status = 'completed';
            exportRequest.progress = 100;
            exportRequest.completedAt = new Date();
            exportRequest.downloadUrl = exportResult.downloadUrl;
            exportRequest.updatedAt = new Date();
            const executionTime = Date.now() - startTime;
            // Track completion
            performance_metrics_1.performanceMetrics.histogram('exports.processing_time', executionTime, {
                type: exportRequest.type,
                format: exportRequest.format
            });
            performance_metrics_1.performanceMetrics.increment('exports.completed', 1, {
                type: exportRequest.type,
                format: exportRequest.format,
                userId: exportRequest.userId
            });
            structured_logger_1.logger.info('Export completed', {
                exportId: exportRequest.id,
                type: exportRequest.type,
                format: exportRequest.format,
                userId: exportRequest.userId,
                executionTime,
                fileSize: exportResult.fileSize
            });
            this.emit('exportCompleted', exportRequest);
        }
        catch (error) {
            exportRequest.status = 'failed';
            exportRequest.error = error.message;
            exportRequest.updatedAt = new Date();
            // Track failure
            performance_metrics_1.performanceMetrics.increment('exports.failed', 1, {
                type: exportRequest.type,
                format: exportRequest.format,
                error: error.name
            });
            structured_logger_1.logger.error('Export failed', {
                exportId: exportRequest.id,
                type: exportRequest.type,
                format: exportRequest.format,
                userId: exportRequest.userId,
                error: error.message
            });
            this.emit('exportFailed', exportRequest);
        }
        finally {
            this.activeExports--;
            this.updateExportStatus(exportRequest);
        }
    }
    async getDashboardData(dashboardId, userId) {
        const dashboard = await dashboard_service_1.dashboardService.getDashboard(dashboardId, userId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }
        const dashboardData = await dashboard_service_1.dashboardService.refreshDashboardData(dashboardId);
        return {
            dashboard,
            data: dashboardData
        };
    }
    async getQueryData(query) {
        return await analytics_service_1.analyticsService.query(query);
    }
    async generateExportFile(exportRequest, data) {
        const fileName = exportRequest.options.fileName ||
            `export-${exportRequest.id}.${exportRequest.format}`;
        let fileContent;
        let fileSize;
        switch (exportRequest.format) {
            case 'json':
                fileContent = this.generateJsonExport(data, exportRequest.options);
                break;
            case 'csv':
                fileContent = this.generateCsvExport(data, exportRequest.options);
                break;
            case 'excel':
                fileContent = this.generateExcelExport(data, exportRequest.options);
                break;
            case 'pdf':
                fileContent = this.generatePdfExport(data, exportRequest.options);
                break;
            case 'xml':
                fileContent = this.generateXmlExport(data, exportRequest.options);
                break;
            default:
                throw new Error(`Unsupported export format: ${exportRequest.format}`);
        }
        fileSize = fileContent.length;
        // In production, this would save to file storage and return actual URL
        const downloadUrl = `/api/exports/${exportRequest.id}/download`;
        return {
            requestId: exportRequest.id,
            format: exportRequest.format,
            fileName,
            fileSize,
            downloadUrl,
            metadata: {
                recordCount: Array.isArray(data.results?.events) ? data.results.events.length : 0,
                exportTime: Date.now(),
                generatedAt: new Date(),
                expiresAt: new Date(Date.now() + this.exportRetentionPeriod)
            }
        };
    }
    generateJsonExport(data, options) {
        const exportData = {};
        if (options.includeRawData) {
            exportData.data = data;
        }
        if (options.includeMetadata) {
            exportData.metadata = {
                exportedAt: new Date().toISOString(),
                format: 'json',
                version: '1.0'
            };
        }
        const jsonString = JSON.stringify(exportData, null, 2);
        return Buffer.from(jsonString, 'utf8');
    }
    generateCsvExport(data, options) {
        let csvContent = '';
        if (data.results?.events) {
            // CSV headers
            const headers = ['timestamp', 'eventType', 'userId', 'organizationId', 'sessionId', 'source', 'metadata'];
            csvContent += headers.join(',') + '\n';
            // CSV data
            data.results.events.forEach((event) => {
                const row = [
                    event.timestamp,
                    event.eventType,
                    event.userId || '',
                    event.organizationId || '',
                    event.sessionId,
                    event.source,
                    JSON.stringify(event.metadata || {})
                ];
                csvContent += row.map(field => `"${field}"`).join(',') + '\n';
            });
        }
        return Buffer.from(csvContent, 'utf8');
    }
    generateExcelExport(data, options) {
        // In production, this would use a library like xlsx
        // For now, return CSV content as mock Excel
        const csvContent = this.generateCsvExport(data, options);
        return csvContent;
    }
    generatePdfExport(data, options) {
        // In production, this would use a PDF library like pdfkit
        // For now, return mock PDF content
        const pdfHeader = '%PDF-1.4\n';
        const pdfContent = `1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Analytics Export Report) Tj\nET\nendstream\nendobj\n\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF`;
        return Buffer.from(pdfHeader + pdfContent, 'utf8');
    }
    generateXmlExport(data, options) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<analyticsExport>\n';
        if (options.includeMetadata) {
            xmlContent += '  <metadata>\n';
            xmlContent += `    <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
            xmlContent += '    <format>xml</format>\n';
            xmlContent += '    <version>1.0</version>\n';
            xmlContent += '  </metadata>\n';
        }
        if (data.results?.events) {
            xmlContent += '  <events>\n';
            data.results.events.forEach((event) => {
                xmlContent += '    <event>\n';
                xmlContent += `      <timestamp>${event.timestamp}</timestamp>\n`;
                xmlContent += `      <eventType>${event.eventType}</eventType>\n`;
                xmlContent += `      <userId>${event.userId || ''}</userId>\n`;
                xmlContent += `      <organizationId>${event.organizationId || ''}</organizationId>\n`;
                xmlContent += `      <sessionId>${event.sessionId}</sessionId>\n`;
                xmlContent += `      <source>${event.source}</source>\n`;
                xmlContent += '    </event>\n';
            });
            xmlContent += '  </events>\n';
        }
        xmlContent += '</analyticsExport>\n';
        return Buffer.from(xmlContent, 'utf8');
    }
    updateExportStatus(exportRequest) {
        this.exports.set(exportRequest.id, exportRequest);
        this.emit('exportStatusUpdated', exportRequest);
    }
    getContentType(format) {
        const contentTypes = {
            'json': 'application/json',
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf',
            'xml': 'application/xml'
        };
        return contentTypes[format] || 'application/octet-stream';
    }
    async initializeStorage() {
        // Initialize export storage
        this.exports.clear();
    }
    generateExportId() {
        return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    setupCleanupSchedule() {
        // Clean up expired exports every hour
        setInterval(() => {
            this.cleanupExpiredExports();
        }, 60 * 60 * 1000);
    }
    cleanupExpiredExports() {
        const cutoff = new Date(Date.now() - this.exportRetentionPeriod);
        let deletedCount = 0;
        for (const [id, exportRequest] of this.exports) {
            if (exportRequest.createdAt < cutoff) {
                this.exports.delete(id);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            structured_logger_1.logger.info('Expired exports cleaned up', {
                deletedCount,
                cutoffDate: cutoff.toISOString()
            });
        }
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
//# sourceMappingURL=export-service.js.map