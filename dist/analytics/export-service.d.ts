/**
 * Enterprise Export Service
 * Export capabilities for analytics reports (PDF, CSV, JSON, Excel)
 */
import { EventEmitter } from 'events';
import { AnalyticsQuery } from './analytics-service';
export interface ExportRequest {
    id: string;
    type: 'report' | 'dashboard' | 'query';
    format: 'pdf' | 'csv' | 'json' | 'excel' | 'xml';
    source: AnalyticsQuery | string;
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
            colors?: {
                primary: string;
                secondary: string;
            };
            companyName?: string;
        };
    };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
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
export declare class ExportService extends EventEmitter {
    private exports;
    private isInitialized;
    private exportRetentionPeriod;
    private maxConcurrentExports;
    private activeExports;
    constructor();
    initialize(): Promise<void>;
    /**
     * Request data export
     */
    requestExport(type: 'report' | 'dashboard' | 'query', format: 'pdf' | 'csv' | 'json' | 'excel' | 'xml', source: AnalyticsQuery | string, userId: string, organizationId?: string, options?: ExportRequest['options']): Promise<ExportRequest>;
    /**
     * Get export status
     */
    getExportStatus(exportId: string, userId: string): Promise<ExportRequest | null>;
    /**
     * List user's exports
     */
    listUserExports(userId: string, organizationId?: string, status?: ExportRequest['status']): Promise<ExportRequest[]>;
    /**
     * Cancel export
     */
    cancelExport(exportId: string, userId: string): Promise<void>;
    /**
     * Download export file
     */
    downloadExport(exportId: string, userId: string): Promise<{
        fileName: string;
        contentType: string;
        data: Buffer;
    }>;
    private processExport;
    private getDashboardData;
    private getQueryData;
    private generateExportFile;
    private generateJsonExport;
    private generateCsvExport;
    private generateExcelExport;
    private generatePdfExport;
    private generateXmlExport;
    private updateExportStatus;
    private getContentType;
    private initializeStorage;
    private generateExportId;
    private setupCleanupSchedule;
    private cleanupExpiredExports;
}
export declare const exportService: ExportService;
//# sourceMappingURL=export-service.d.ts.map