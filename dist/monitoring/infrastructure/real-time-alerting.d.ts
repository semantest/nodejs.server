/**
 * Real-Time Alerting System
 * Provides WebSocket-based real-time alerts for critical events and monitoring
 */
import { EventEmitter } from 'events';
import { LogContext } from './structured-logger';
export declare enum AlertSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum AlertType {
    ERROR = "error",
    PERFORMANCE = "performance",
    SECURITY = "security",
    HEALTH = "health",
    BUSINESS = "business",
    SYSTEM = "system"
}
export interface Alert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    timestamp: Date;
    source: string;
    context?: Record<string, any>;
    correlationId?: string;
    resolved?: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
    acknowledgedBy?: string[];
    tags?: string[];
}
export interface AlertRule {
    id: string;
    name: string;
    description: string;
    type: AlertType;
    severity: AlertSeverity;
    condition: (data: any) => boolean;
    message: (data: any) => string;
    cooldown?: number;
    enabled: boolean;
    tags?: string[];
}
export interface AlertSubscription {
    id: string;
    connectionId: string;
    filters: {
        types?: AlertType[];
        severities?: AlertSeverity[];
        sources?: string[];
        tags?: string[];
    };
    createdAt: Date;
}
/**
 * Real-Time Alerting Manager
 */
export declare class RealTimeAlertingManager extends EventEmitter {
    private alerts;
    private rules;
    private cooldowns;
    private subscriptions;
    private wsConnections;
    private alertHistory;
    private wsServer?;
    private isRunning;
    constructor();
    /**
     * Start alerting system
     */
    start(port?: number): void;
    /**
     * Stop alerting system
     */
    stop(): void;
    /**
     * Create an alert
     */
    createAlert(type: AlertType, severity: AlertSeverity, title: string, message: string, source: string, context?: Record<string, any>, tags?: string[]): Alert;
    /**
     * Add alert rule
     */
    addAlertRule(rule: AlertRule): void;
    /**
     * Remove alert rule
     */
    removeAlertRule(ruleId: string): void;
    /**
     * Evaluate data against all rules
     */
    evaluateRules(data: any, source: string): void;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string, userId: string): boolean;
    /**
     * Resolve alert
     */
    resolveAlert(alertId: string, resolvedBy: string): boolean;
    /**
     * Get active alerts
     */
    getActiveAlerts(filters?: {
        types?: AlertType[];
        severities?: AlertSeverity[];
        sources?: string[];
        tags?: string[];
    }): Alert[];
    /**
     * Get alert statistics
     */
    getAlertStatistics(): {
        total: number;
        active: number;
        resolved: number;
        bySeverity: Record<AlertSeverity, number>;
        byType: Record<AlertType, number>;
        bySource: Record<string, number>;
        averageResolutionTime: number;
    };
    /**
     * Setup default alert rules
     */
    private setupDefaultAlertRules;
    /**
     * Start WebSocket server for real-time alerts
     */
    private startWebSocketServer;
    /**
     * Handle WebSocket message
     */
    private handleWebSocketMessage;
    /**
     * Handle subscription
     */
    private handleSubscribe;
    /**
     * Handle unsubscription
     */
    private handleUnsubscribe;
    /**
     * Send active alerts to connection
     */
    private sendActiveAlerts;
    /**
     * Send alert statistics to connection
     */
    private sendAlertStatistics;
    /**
     * Broadcast alert to subscribed connections
     */
    private broadcastAlert;
    /**
     * Broadcast alert update
     */
    private broadcastAlertUpdate;
    /**
     * Check if alert matches subscription filters
     */
    private alertMatchesFilters;
}
/**
 * Default alerting manager instance
 */
export declare const alertingManager: RealTimeAlertingManager;
/**
 * Integration with Error Handler (Task 031)
 */
export interface ErrorHandlerIntegration {
    /**
     * Send error alert from error handler
     */
    sendErrorAlert(error: Error, context?: LogContext): void;
    /**
     * Register error pattern for automatic alerting
     */
    registerErrorPattern(pattern: RegExp, severity: AlertSeverity): void;
    /**
     * Get error alert statistics
     */
    getErrorAlertStats(): Record<string, any>;
}
/**
 * Error handler integration implementation
 */
export declare class ErrorHandlerAlertIntegration implements ErrorHandlerIntegration {
    private alertManager;
    private errorPatterns;
    constructor(alertManager: RealTimeAlertingManager);
    sendErrorAlert(error: Error, context?: LogContext): void;
    registerErrorPattern(pattern: RegExp, severity: AlertSeverity): void;
    getErrorAlertStats(): Record<string, any>;
    private setupDefaultErrorPatterns;
}
/**
 * Export integration for Task 031
 */
export declare const errorHandlerIntegration: ErrorHandlerAlertIntegration;
//# sourceMappingURL=real-time-alerting.d.ts.map