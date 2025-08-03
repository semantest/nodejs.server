/**
 * Health Check System
 * Provides comprehensive health monitoring for all services and dependencies
 */
import { Router } from 'express';
import { SystemMetrics, BusinessMetrics } from './performance-metrics';
export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy",
    UNKNOWN = "unknown"
}
export interface HealthCheckResult {
    status: HealthStatus;
    timestamp: string;
    duration: number;
    details?: Record<string, any>;
    error?: string;
}
export interface ServiceHealthCheck {
    name: string;
    check: () => Promise<HealthCheckResult>;
    timeout?: number;
    interval?: number;
    critical?: boolean;
}
export interface ComprehensiveHealthReport {
    overall: HealthStatus;
    timestamp: string;
    version: string;
    uptime: number;
    services: Record<string, HealthCheckResult>;
    system: SystemMetrics;
    business: BusinessMetrics;
    dependencies: Record<string, HealthCheckResult>;
    alerts: HealthAlert[];
}
export interface HealthAlert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    service?: string;
    details?: Record<string, any>;
}
/**
 * Health Check Manager
 */
export declare class HealthCheckManager {
    private version;
    private healthChecks;
    private lastResults;
    private checkIntervals;
    private alerts;
    private isRunning;
    constructor(version?: string);
    /**
     * Add a health check
     */
    addHealthCheck(check: ServiceHealthCheck): void;
    /**
     * Remove a health check
     */
    removeHealthCheck(name: string): void;
    /**
     * Start health check monitoring
     */
    start(): void;
    /**
     * Stop health check monitoring
     */
    stop(): void;
    /**
     * Run a specific health check
     */
    runHealthCheck(name: string): Promise<HealthCheckResult>;
    /**
     * Run all health checks
     */
    runAllHealthChecks(): Promise<Record<string, HealthCheckResult>>;
    /**
     * Get comprehensive health report
     */
    getHealthReport(): Promise<ComprehensiveHealthReport>;
    /**
     * Get health check router for Express
     */
    getHealthRouter(): Router;
    /**
     * Setup default health checks
     */
    private setupDefaultHealthChecks;
    /**
     * Start periodic check for a health check
     */
    private startPeriodicCheck;
    /**
     * Check for alerts based on health check results
     */
    private checkForAlerts;
    /**
     * Create an alert
     */
    private createAlert;
    /**
     * Get active alerts (last 24 hours)
     */
    private getActiveAlerts;
    /**
     * Check critical services only
     */
    private checkCriticalServices;
    /**
     * Check dependencies
     */
    private checkDependencies;
    /**
     * Determine overall status
     */
    private determineOverallStatus;
}
/**
 * Default health check manager instance
 */
export declare const healthCheckManager: HealthCheckManager;
//# sourceMappingURL=health-check.d.ts.map