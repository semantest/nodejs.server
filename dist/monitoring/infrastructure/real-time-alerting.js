"use strict";
/**
 * Real-Time Alerting System
 * Provides WebSocket-based real-time alerts for critical events and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerIntegration = exports.ErrorHandlerAlertIntegration = exports.alertingManager = exports.RealTimeAlertingManager = exports.AlertType = exports.AlertSeverity = void 0;
const events_1 = require("events");
const ws_1 = require("ws");
const structured_logger_1 = require("./structured-logger");
const health_check_1 = require("./health-check");
const uuid_1 = require("uuid");
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["LOW"] = "low";
    AlertSeverity["MEDIUM"] = "medium";
    AlertSeverity["HIGH"] = "high";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertType;
(function (AlertType) {
    AlertType["ERROR"] = "error";
    AlertType["PERFORMANCE"] = "performance";
    AlertType["SECURITY"] = "security";
    AlertType["HEALTH"] = "health";
    AlertType["BUSINESS"] = "business";
    AlertType["SYSTEM"] = "system";
})(AlertType || (exports.AlertType = AlertType = {}));
/**
 * Real-Time Alerting Manager
 */
class RealTimeAlertingManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.alerts = new Map();
        this.rules = new Map();
        this.cooldowns = new Map();
        this.subscriptions = new Map();
        this.wsConnections = new Map();
        this.alertHistory = [];
        this.isRunning = false;
        this.setupDefaultAlertRules();
    }
    /**
     * Start alerting system
     */
    start(port = 3004) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.startWebSocketServer(port);
        structured_logger_1.logger.info('Real-time alerting system started', {
            metadata: { port, rulesCount: this.rules.size }
        });
    }
    /**
     * Stop alerting system
     */
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Close all WebSocket connections
        for (const [id, ws] of this.wsConnections) {
            ws.close(1000, 'Alerting system shutting down');
        }
        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }
        structured_logger_1.logger.info('Real-time alerting system stopped');
    }
    /**
     * Create an alert
     */
    createAlert(type, severity, title, message, source, context, tags) {
        const alert = {
            id: (0, uuid_1.v4)(),
            type,
            severity,
            title,
            message,
            timestamp: new Date(),
            source,
            context,
            correlationId: context?.correlationId,
            resolved: false,
            tags
        };
        this.alerts.set(alert.id, alert);
        this.alertHistory.push(alert);
        // Keep only last 1000 alerts in history
        if (this.alertHistory.length > 1000) {
            this.alertHistory.shift();
        }
        // Log alert
        structured_logger_1.logger.warn(`Alert created: ${title}`, {
            category: structured_logger_1.LogCategory.SYSTEM,
            metadata: {
                alertId: alert.id,
                type,
                severity,
                source
            }
        });
        // Emit alert event
        this.emit('alert', alert);
        // Broadcast to subscribed connections
        this.broadcastAlert(alert);
        return alert;
    }
    /**
     * Add alert rule
     */
    addAlertRule(rule) {
        this.rules.set(rule.id, rule);
        structured_logger_1.logger.info(`Alert rule added: ${rule.name}`, {
            metadata: {
                ruleId: rule.id,
                type: rule.type,
                severity: rule.severity
            }
        });
    }
    /**
     * Remove alert rule
     */
    removeAlertRule(ruleId) {
        this.rules.delete(ruleId);
        this.cooldowns.delete(ruleId);
        structured_logger_1.logger.info(`Alert rule removed: ${ruleId}`);
    }
    /**
     * Evaluate data against all rules
     */
    evaluateRules(data, source) {
        for (const [ruleId, rule] of this.rules) {
            if (!rule.enabled)
                continue;
            // Check cooldown
            const lastTrigger = this.cooldowns.get(ruleId);
            if (lastTrigger && rule.cooldown) {
                const elapsed = Date.now() - lastTrigger;
                if (elapsed < rule.cooldown)
                    continue;
            }
            try {
                if (rule.condition(data)) {
                    // Rule triggered
                    const message = rule.message(data);
                    this.createAlert(rule.type, rule.severity, rule.name, message, source, data, rule.tags);
                    // Set cooldown
                    if (rule.cooldown) {
                        this.cooldowns.set(ruleId, Date.now());
                    }
                }
            }
            catch (error) {
                structured_logger_1.logger.error(`Error evaluating alert rule: ${rule.name}`, error);
            }
        }
    }
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId, userId) {
        const alert = this.alerts.get(alertId);
        if (!alert)
            return false;
        if (!alert.acknowledgedBy) {
            alert.acknowledgedBy = [];
        }
        if (!alert.acknowledgedBy.includes(userId)) {
            alert.acknowledgedBy.push(userId);
            this.broadcastAlertUpdate(alert);
            structured_logger_1.logger.info(`Alert acknowledged: ${alertId}`, {
                metadata: { userId }
            });
        }
        return true;
    }
    /**
     * Resolve alert
     */
    resolveAlert(alertId, resolvedBy) {
        const alert = this.alerts.get(alertId);
        if (!alert || alert.resolved)
            return false;
        alert.resolved = true;
        alert.resolvedAt = new Date();
        alert.resolvedBy = resolvedBy;
        this.broadcastAlertUpdate(alert);
        structured_logger_1.logger.info(`Alert resolved: ${alertId}`, {
            metadata: { resolvedBy }
        });
        return true;
    }
    /**
     * Get active alerts
     */
    getActiveAlerts(filters) {
        const activeAlerts = Array.from(this.alerts.values())
            .filter(alert => !alert.resolved);
        if (!filters)
            return activeAlerts;
        return activeAlerts.filter(alert => {
            if (filters.types && !filters.types.includes(alert.type))
                return false;
            if (filters.severities && !filters.severities.includes(alert.severity))
                return false;
            if (filters.sources && !filters.sources.includes(alert.source))
                return false;
            if (filters.tags && !alert.tags?.some(tag => filters.tags.includes(tag)))
                return false;
            return true;
        });
    }
    /**
     * Get alert statistics
     */
    getAlertStatistics() {
        const stats = {
            total: this.alertHistory.length,
            active: 0,
            resolved: 0,
            bySeverity: {},
            byType: {},
            bySource: {},
            averageResolutionTime: 0
        };
        let totalResolutionTime = 0;
        let resolvedCount = 0;
        for (const alert of this.alertHistory) {
            if (alert.resolved) {
                stats.resolved++;
                if (alert.resolvedAt) {
                    totalResolutionTime += alert.resolvedAt.getTime() - alert.timestamp.getTime();
                    resolvedCount++;
                }
            }
            else {
                stats.active++;
            }
            // Count by severity
            stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
            // Count by type
            stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
            // Count by source
            stats.bySource[alert.source] = (stats.bySource[alert.source] || 0) + 1;
        }
        if (resolvedCount > 0) {
            stats.averageResolutionTime = totalResolutionTime / resolvedCount;
        }
        return stats;
    }
    /**
     * Setup default alert rules
     */
    setupDefaultAlertRules() {
        // High CPU usage alert
        this.addAlertRule({
            id: 'cpu-high',
            name: 'High CPU Usage',
            description: 'Alert when CPU usage exceeds 80%',
            type: AlertType.PERFORMANCE,
            severity: AlertSeverity.HIGH,
            condition: (data) => data.cpu?.usage > 0.8,
            message: (data) => `CPU usage is ${(data.cpu.usage * 100).toFixed(1)}%`,
            cooldown: 300000, // 5 minutes
            enabled: true,
            tags: ['system', 'performance']
        });
        // High memory usage alert
        this.addAlertRule({
            id: 'memory-high',
            name: 'High Memory Usage',
            description: 'Alert when memory usage exceeds 85%',
            type: AlertType.PERFORMANCE,
            severity: AlertSeverity.HIGH,
            condition: (data) => {
                const usage = data.memory?.used / data.memory?.total;
                return usage > 0.85;
            },
            message: (data) => {
                const usage = (data.memory.used / data.memory.total * 100).toFixed(1);
                return `Memory usage is ${usage}%`;
            },
            cooldown: 300000, // 5 minutes
            enabled: true,
            tags: ['system', 'performance']
        });
        // Error rate alert
        this.addAlertRule({
            id: 'error-rate-high',
            name: 'High Error Rate',
            description: 'Alert when error rate exceeds 5%',
            type: AlertType.ERROR,
            severity: AlertSeverity.CRITICAL,
            condition: (data) => {
                const errorRate = data.errors / data.requests;
                return errorRate > 0.05;
            },
            message: (data) => {
                const errorRate = (data.errors / data.requests * 100).toFixed(1);
                return `Error rate is ${errorRate}%`;
            },
            cooldown: 60000, // 1 minute
            enabled: true,
            tags: ['api', 'errors']
        });
        // Service unhealthy alert
        this.addAlertRule({
            id: 'service-unhealthy',
            name: 'Service Unhealthy',
            description: 'Alert when a service becomes unhealthy',
            type: AlertType.HEALTH,
            severity: AlertSeverity.CRITICAL,
            condition: (data) => data.status === health_check_1.HealthStatus.UNHEALTHY,
            message: (data) => `Service ${data.service} is unhealthy: ${data.error || 'Unknown error'}`,
            cooldown: 60000, // 1 minute
            enabled: true,
            tags: ['health', 'service']
        });
        // Security alert
        this.addAlertRule({
            id: 'security-threat',
            name: 'Security Threat Detected',
            description: 'Alert on security threats',
            type: AlertType.SECURITY,
            severity: AlertSeverity.CRITICAL,
            condition: (data) => data.threatLevel === 'high' || data.threatLevel === 'critical',
            message: (data) => `Security threat detected: ${data.threat} from ${data.source}`,
            cooldown: 0, // No cooldown for security alerts
            enabled: true,
            tags: ['security', 'threat']
        });
        // Business metric alert
        this.addAlertRule({
            id: 'low-conversion',
            name: 'Low Conversion Rate',
            description: 'Alert when conversion rate drops below threshold',
            type: AlertType.BUSINESS,
            severity: AlertSeverity.MEDIUM,
            condition: (data) => data.conversionRate < 0.02,
            message: (data) => `Conversion rate dropped to ${(data.conversionRate * 100).toFixed(2)}%`,
            cooldown: 3600000, // 1 hour
            enabled: true,
            tags: ['business', 'conversion']
        });
    }
    /**
     * Start WebSocket server for real-time alerts
     */
    startWebSocketServer(port) {
        this.wsServer = new ws_1.WebSocketServer({ port });
        this.wsServer.on('connection', (ws, req) => {
            const connectionId = (0, uuid_1.v4)();
            this.wsConnections.set(connectionId, ws);
            structured_logger_1.logger.info('Alert WebSocket connection established', {
                metadata: {
                    connectionId,
                    ip: req.socket.remoteAddress
                }
            });
            // Send connection confirmation
            ws.send(JSON.stringify({
                type: 'connected',
                connectionId,
                timestamp: new Date()
            }));
            // Handle messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(connectionId, message);
                }
                catch (error) {
                    structured_logger_1.logger.error('Invalid WebSocket message', error);
                }
            });
            // Handle disconnection
            ws.on('close', () => {
                this.wsConnections.delete(connectionId);
                this.subscriptions.delete(connectionId);
                structured_logger_1.logger.info('Alert WebSocket connection closed', {
                    metadata: { connectionId }
                });
            });
            // Handle errors
            ws.on('error', (error) => {
                structured_logger_1.logger.error('Alert WebSocket error', error, {
                    metadata: { connectionId }
                });
            });
        });
        structured_logger_1.logger.info(`Alert WebSocket server started on port ${port}`);
    }
    /**
     * Handle WebSocket message
     */
    handleWebSocketMessage(connectionId, message) {
        switch (message.type) {
            case 'subscribe':
                this.handleSubscribe(connectionId, message.filters);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(connectionId);
                break;
            case 'acknowledge':
                this.acknowledgeAlert(message.alertId, message.userId || connectionId);
                break;
            case 'resolve':
                this.resolveAlert(message.alertId, message.userId || connectionId);
                break;
            case 'get_active':
                this.sendActiveAlerts(connectionId, message.filters);
                break;
            case 'get_stats':
                this.sendAlertStatistics(connectionId);
                break;
        }
    }
    /**
     * Handle subscription
     */
    handleSubscribe(connectionId, filters) {
        const subscription = {
            id: (0, uuid_1.v4)(),
            connectionId,
            filters: filters || {},
            createdAt: new Date()
        };
        this.subscriptions.set(connectionId, subscription);
        const ws = this.wsConnections.get(connectionId);
        if (ws) {
            ws.send(JSON.stringify({
                type: 'subscribed',
                subscriptionId: subscription.id,
                timestamp: new Date()
            }));
        }
    }
    /**
     * Handle unsubscription
     */
    handleUnsubscribe(connectionId) {
        this.subscriptions.delete(connectionId);
        const ws = this.wsConnections.get(connectionId);
        if (ws) {
            ws.send(JSON.stringify({
                type: 'unsubscribed',
                timestamp: new Date()
            }));
        }
    }
    /**
     * Send active alerts to connection
     */
    sendActiveAlerts(connectionId, filters) {
        const ws = this.wsConnections.get(connectionId);
        if (!ws)
            return;
        const alerts = this.getActiveAlerts(filters);
        ws.send(JSON.stringify({
            type: 'active_alerts',
            alerts,
            timestamp: new Date()
        }));
    }
    /**
     * Send alert statistics to connection
     */
    sendAlertStatistics(connectionId) {
        const ws = this.wsConnections.get(connectionId);
        if (!ws)
            return;
        const stats = this.getAlertStatistics();
        ws.send(JSON.stringify({
            type: 'statistics',
            stats,
            timestamp: new Date()
        }));
    }
    /**
     * Broadcast alert to subscribed connections
     */
    broadcastAlert(alert) {
        for (const [connectionId, subscription] of this.subscriptions) {
            // Check if alert matches subscription filters
            if (!this.alertMatchesFilters(alert, subscription.filters))
                continue;
            const ws = this.wsConnections.get(connectionId);
            if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'alert',
                    alert,
                    timestamp: new Date()
                }));
            }
        }
    }
    /**
     * Broadcast alert update
     */
    broadcastAlertUpdate(alert) {
        for (const [connectionId, subscription] of this.subscriptions) {
            const ws = this.wsConnections.get(connectionId);
            if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'alert_update',
                    alert,
                    timestamp: new Date()
                }));
            }
        }
    }
    /**
     * Check if alert matches subscription filters
     */
    alertMatchesFilters(alert, filters) {
        if (filters.types && !filters.types.includes(alert.type))
            return false;
        if (filters.severities && !filters.severities.includes(alert.severity))
            return false;
        if (filters.sources && !filters.sources.includes(alert.source))
            return false;
        if (filters.tags && !alert.tags?.some(tag => filters.tags.includes(tag)))
            return false;
        return true;
    }
}
exports.RealTimeAlertingManager = RealTimeAlertingManager;
/**
 * Default alerting manager instance
 */
exports.alertingManager = new RealTimeAlertingManager();
/**
 * Error handler integration implementation
 */
class ErrorHandlerAlertIntegration {
    constructor(alertManager) {
        this.alertManager = alertManager;
        this.errorPatterns = new Map();
        this.setupDefaultErrorPatterns();
    }
    sendErrorAlert(error, context) {
        // Determine severity based on error patterns
        let severity = AlertSeverity.MEDIUM;
        for (const [pattern, patternSeverity] of this.errorPatterns) {
            if (pattern.test(error.message) || pattern.test(error.stack || '')) {
                severity = patternSeverity;
                break;
            }
        }
        // Create alert
        this.alertManager.createAlert(AlertType.ERROR, severity, `Error: ${error.name}`, error.message, context?.component || 'unknown', {
            ...context,
            stack: error.stack,
            errorName: error.name
        }, ['error', error.name.toLowerCase()]);
    }
    registerErrorPattern(pattern, severity) {
        this.errorPatterns.set(pattern, severity);
    }
    getErrorAlertStats() {
        const stats = this.alertManager.getAlertStatistics();
        return {
            totalErrors: stats.byType[AlertType.ERROR] || 0,
            criticalErrors: this.alertManager.getActiveAlerts({
                types: [AlertType.ERROR],
                severities: [AlertSeverity.CRITICAL]
            }).length,
            errorRate: stats.total > 0 ? (stats.byType[AlertType.ERROR] || 0) / stats.total : 0
        };
    }
    setupDefaultErrorPatterns() {
        // Critical errors
        this.registerErrorPattern(/out of memory/i, AlertSeverity.CRITICAL);
        this.registerErrorPattern(/database connection failed/i, AlertSeverity.CRITICAL);
        this.registerErrorPattern(/authentication failed/i, AlertSeverity.HIGH);
        this.registerErrorPattern(/permission denied/i, AlertSeverity.HIGH);
        // High severity errors
        this.registerErrorPattern(/timeout/i, AlertSeverity.HIGH);
        this.registerErrorPattern(/network error/i, AlertSeverity.HIGH);
        this.registerErrorPattern(/file not found/i, AlertSeverity.MEDIUM);
        // Medium severity errors
        this.registerErrorPattern(/validation error/i, AlertSeverity.MEDIUM);
        this.registerErrorPattern(/rate limit/i, AlertSeverity.MEDIUM);
    }
}
exports.ErrorHandlerAlertIntegration = ErrorHandlerAlertIntegration;
/**
 * Export integration for Task 031
 */
exports.errorHandlerIntegration = new ErrorHandlerAlertIntegration(exports.alertingManager);
//# sourceMappingURL=real-time-alerting.js.map