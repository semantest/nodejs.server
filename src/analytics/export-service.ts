/**
 * Enterprise Export Service
 * Export capabilities for analytics reports (PDF, CSV, JSON, Excel)
 */

import { EventEmitter } from 'events';
import { logger } from '../monitoring/infrastructure/structured-logger';
import { performanceMetrics } from '../monitoring/infrastructure/performance-metrics';
import { AnalyticsReport, AnalyticsQuery, analyticsService } from './analytics-service';
import { Dashboard, dashboardService } from './dashboard-service';

export interface ExportRequest {
  id: string;
  type: 'report' | 'dashboard' | 'query';
  format: 'pdf' | 'csv' | 'json' | 'excel' | 'xml';
  source: AnalyticsQuery | string; // Query object or dashboard ID
  userId: string;
  organizationId?: string;
  options: {
    includeCharts?: boolean;
    includeRawData?: boolean;
    includeMetadata?: boolean;
    compressed?: boolean;
    password?: string;
    fileName?: string;
    template?: string;
    branding?: {
      logo?: string;
      colors?: { primary: string; secondary: string };
      companyName?: string;
    };
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}

export interface ExportResult {
  requestId: string;
  format: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  metadata: {
    recordCount: number;
    exportTime: number;
    generatedAt: Date;
    expiresAt: Date;
  };
}

export class ExportService extends EventEmitter {
  private exports: Map<string, ExportRequest> = new Map();
  private isInitialized = false;
  private exportRetentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
  private maxConcurrentExports = 5;
  private activeExports = 0;

  constructor() {
    super();
    this.setupCleanupSchedule();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Export service already initialized');
      return;
    }

    logger.info('Initializing export service');

    try {
      // Initialize export storage
      await this.initializeStorage();
      
      this.isInitialized = true;
      logger.info('Export service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize export service', error);
      throw error;
    }
  }

  /**
   * Request data export
   */
  async requestExport(
    type: 'report' | 'dashboard' | 'query',
    format: 'pdf' | 'csv' | 'json' | 'excel' | 'xml',
    source: AnalyticsQuery | string,
    userId: string,
    organizationId?: string,
    options: ExportRequest['options'] = {}
  ): Promise<ExportRequest> {
    if (this.activeExports >= this.maxConcurrentExports) {
      throw new Error('Maximum concurrent exports reached. Please try again later.');
    }

    const exportRequest: ExportRequest = {
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
    performanceMetrics.increment('exports.requested', 1, {
      type,
      format,
      userId,
      organizationId: organizationId || 'none'
    });

    logger.info('Export requested', {
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
  async getExportStatus(exportId: string, userId: string): Promise<ExportRequest | null> {
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
  async listUserExports(
    userId: string,
    organizationId?: string,
    status?: ExportRequest['status']
  ): Promise<ExportRequest[]> {
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
  async cancelExport(exportId: string, userId: string): Promise<void> {
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
    performanceMetrics.increment('exports.cancelled', 1, {
      type: exportRequest.type,
      format: exportRequest.format,
      userId
    });

    logger.info('Export cancelled', {
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
  async downloadExport(exportId: string, userId: string): Promise<{
    fileName: string;
    contentType: string;
    data: Buffer;
  }> {
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
    performanceMetrics.increment('exports.downloaded', 1, {
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

  private async processExport(exportRequest: ExportRequest): Promise<void> {
    this.activeExports++;
    
    try {
      exportRequest.status = 'processing';
      exportRequest.progress = 0;
      exportRequest.updatedAt = new Date();
      this.updateExportStatus(exportRequest);

      const startTime = Date.now();

      // Get data based on type
      let data: any;
      if (exportRequest.type === 'dashboard') {
        data = await this.getDashboardData(exportRequest.source as string, exportRequest.userId);
      } else {
        data = await this.getQueryData(exportRequest.source as AnalyticsQuery);
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
      performanceMetrics.histogram('exports.processing_time', executionTime, {
        type: exportRequest.type,
        format: exportRequest.format
      });

      performanceMetrics.increment('exports.completed', 1, {
        type: exportRequest.type,
        format: exportRequest.format,
        userId: exportRequest.userId
      });

      logger.info('Export completed', {
        exportId: exportRequest.id,
        type: exportRequest.type,
        format: exportRequest.format,
        userId: exportRequest.userId,
        executionTime,
        fileSize: exportResult.fileSize
      });

      this.emit('exportCompleted', exportRequest);

    } catch (error) {
      exportRequest.status = 'failed';
      exportRequest.error = error.message;
      exportRequest.updatedAt = new Date();

      // Track failure
      performanceMetrics.increment('exports.failed', 1, {
        type: exportRequest.type,
        format: exportRequest.format,
        error: error.name
      });

      logger.error('Export failed', {
        exportId: exportRequest.id,
        type: exportRequest.type,
        format: exportRequest.format,
        userId: exportRequest.userId,
        error: error.message
      });

      this.emit('exportFailed', exportRequest);
    } finally {
      this.activeExports--;
      this.updateExportStatus(exportRequest);
    }
  }

  private async getDashboardData(dashboardId: string, userId: string): Promise<any> {
    const dashboard = await dashboardService.getDashboard(dashboardId, userId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    const dashboardData = await dashboardService.refreshDashboardData(dashboardId);
    return {
      dashboard,
      data: dashboardData
    };
  }

  private async getQueryData(query: AnalyticsQuery): Promise<AnalyticsReport> {
    return await analyticsService.query(query);
  }

  private async generateExportFile(
    exportRequest: ExportRequest,
    data: any
  ): Promise<ExportResult> {
    const fileName = exportRequest.options.fileName || 
                    `export-${exportRequest.id}.${exportRequest.format}`;
    
    let fileContent: Buffer;
    let fileSize: number;

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

  private generateJsonExport(data: any, options: ExportRequest['options']): Buffer {
    const exportData: any = {};

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

  private generateCsvExport(data: any, options: ExportRequest['options']): Buffer {
    let csvContent = '';
    
    if (data.results?.events) {
      // CSV headers
      const headers = ['timestamp', 'eventType', 'userId', 'organizationId', 'sessionId', 'source', 'metadata'];
      csvContent += headers.join(',') + '\n';
      
      // CSV data
      data.results.events.forEach((event: any) => {
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

  private generateExcelExport(data: any, options: ExportRequest['options']): Buffer {
    // In production, this would use a library like xlsx
    // For now, return CSV content as mock Excel
    const csvContent = this.generateCsvExport(data, options);
    return csvContent;
  }

  private generatePdfExport(data: any, options: ExportRequest['options']): Buffer {
    // In production, this would use a PDF library like pdfkit
    // For now, return mock PDF content
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = `1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Analytics Export Report) Tj\nET\nendstream\nendobj\n\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF`;
    
    return Buffer.from(pdfHeader + pdfContent, 'utf8');
  }

  private generateXmlExport(data: any, options: ExportRequest['options']): Buffer {
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
      data.results.events.forEach((event: any) => {
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

  private updateExportStatus(exportRequest: ExportRequest): void {
    this.exports.set(exportRequest.id, exportRequest);
    this.emit('exportStatusUpdated', exportRequest);
  }

  private getContentType(format: string): string {
    const contentTypes = {
      'json': 'application/json',
      'csv': 'text/csv',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pdf': 'application/pdf',
      'xml': 'application/xml'
    };
    
    return contentTypes[format] || 'application/octet-stream';
  }

  private async initializeStorage(): Promise<void> {
    // Initialize export storage
    this.exports.clear();
  }

  private generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupCleanupSchedule(): void {
    // Clean up expired exports every hour
    setInterval(() => {
      this.cleanupExpiredExports();
    }, 60 * 60 * 1000);
  }

  private cleanupExpiredExports(): void {
    const cutoff = new Date(Date.now() - this.exportRetentionPeriod);
    let deletedCount = 0;

    for (const [id, exportRequest] of this.exports) {
      if (exportRequest.createdAt < cutoff) {
        this.exports.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info('Expired exports cleaned up', {
        deletedCount,
        cutoffDate: cutoff.toISOString()
      });
    }
  }
}

export const exportService = new ExportService();