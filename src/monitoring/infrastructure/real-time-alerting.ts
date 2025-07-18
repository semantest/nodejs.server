/**
 * Real-Time Alerting System
 * Provides WebSocket-based real-time alerts for critical events and monitoring
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { logger, LogContext, LogLevel, LogCategory } from './structured-logger';
import { HealthStatus, HealthAlert } from './health-check';
import { MetricValue } from './performance-metrics';
import { v4 as uuidv4 } from 'uuid';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  ERROR = 'error',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  HEALTH = 'health',
  BUSINESS = 'business',
  SYSTEM = 'system'
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
  cooldown?: number; // Milliseconds before rule can trigger again
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
export class RealTimeAlertingManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private subscriptions: Map<string, AlertSubscription> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private alertHistory: Alert[] = [];
  private wsServer?: WebSocketServer;
  private isRunning = false;

  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  /**
   * Start alerting system
   */
  start(port: number = 3004): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startWebSocketServer(port);
    
    logger.info('Real-time alerting system started', {
      metadata: { port, rulesCount: this.rules.size }
    });
  }

  /**
   * Stop alerting system
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Close all WebSocket connections
    for (const [id, ws] of this.wsConnections) {
      ws.close(1000, 'Alerting system shutting down');
    }
    
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    logger.info('Real-time alerting system stopped');
  }

  /**
   * Create an alert
   */
  createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string,
    context?: Record<string, any>,
    tags?: string[]
  ): Alert {
    const alert: Alert = {
      id: uuidv4(),
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
    logger.warn(`Alert created: ${title}`, {
      category: LogCategory.SYSTEM,
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
  addAlertRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    
    logger.info(`Alert rule added: ${rule.name}`, {
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
  removeAlertRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.cooldowns.delete(ruleId);
    
    logger.info(`Alert rule removed: ${ruleId}`);
  }

  /**
   * Evaluate data against all rules
   */
  evaluateRules(data: any, source: string): void {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      const lastTrigger = this.cooldowns.get(ruleId);
      if (lastTrigger && rule.cooldown) {
        const elapsed = Date.now() - lastTrigger;
        if (elapsed < rule.cooldown) continue;
      }
      
      try {
        if (rule.condition(data)) {
          // Rule triggered
          const message = rule.message(data);
          this.createAlert(
            rule.type,
            rule.severity,
            rule.name,
            message,
            source,
            data,
            rule.tags
          );
          
          // Set cooldown
          if (rule.cooldown) {
            this.cooldowns.set(ruleId, Date.now());
          }
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule: ${rule.name}`, error);
      }
    }
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    
    if (!alert.acknowledgedBy) {
      alert.acknowledgedBy = [];
    }
    
    if (!alert.acknowledgedBy.includes(userId)) {
      alert.acknowledgedBy.push(userId);
      this.broadcastAlertUpdate(alert);
      
      logger.info(`Alert acknowledged: ${alertId}`, {
        metadata: { userId }
      });
    }
    
    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return false;
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    
    this.broadcastAlertUpdate(alert);
    
    logger.info(`Alert resolved: ${alertId}`, {
      metadata: { resolvedBy }
    });
    
    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(filters?: {
    types?: AlertType[];
    severities?: AlertSeverity[];
    sources?: string[];
    tags?: string[];
  }): Alert[] {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved);
    
    if (!filters) return activeAlerts;
    
    return activeAlerts.filter(alert => {
      if (filters.types && !filters.types.includes(alert.type)) return false;
      if (filters.severities && !filters.severities.includes(alert.severity)) return false;
      if (filters.sources && !filters.sources.includes(alert.source)) return false;
      if (filters.tags && !alert.tags?.some(tag => filters.tags!.includes(tag))) return false;
      return true;
    });
  }

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
  } {
    const stats = {
      total: this.alertHistory.length,
      active: 0,
      resolved: 0,
      bySeverity: {} as Record<AlertSeverity, number>,
      byType: {} as Record<AlertType, number>,
      bySource: {} as Record<string, number>,
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
      } else {
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
  private setupDefaultAlertRules(): void {
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
      condition: (data) => data.status === HealthStatus.UNHEALTHY,
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
  private startWebSocketServer(port: number): void {
    this.wsServer = new WebSocketServer({ port });
    
    this.wsServer.on('connection', (ws, req) => {
      const connectionId = uuidv4();
      this.wsConnections.set(connectionId, ws);
      
      logger.info('Alert WebSocket connection established', {
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
        } catch (error) {
          logger.error('Invalid WebSocket message', error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this.wsConnections.delete(connectionId);
        this.subscriptions.delete(connectionId);
        
        logger.info('Alert WebSocket connection closed', {
          metadata: { connectionId }
        });
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error('Alert WebSocket error', error, {
          metadata: { connectionId }
        });
      });
    });
    
    logger.info(`Alert WebSocket server started on port ${port}`);
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(connectionId: string, message: any): void {
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
  private handleSubscribe(connectionId: string, filters?: any): void {
    const subscription: AlertSubscription = {
      id: uuidv4(),
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
  private handleUnsubscribe(connectionId: string): void {
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
  private sendActiveAlerts(connectionId: string, filters?: any): void {
    const ws = this.wsConnections.get(connectionId);
    if (!ws) return;
    
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
  private sendAlertStatistics(connectionId: string): void {
    const ws = this.wsConnections.get(connectionId);
    if (!ws) return;
    
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
  private broadcastAlert(alert: Alert): void {
    for (const [connectionId, subscription] of this.subscriptions) {
      // Check if alert matches subscription filters
      if (!this.alertMatchesFilters(alert, subscription.filters)) continue;
      
      const ws = this.wsConnections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
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
  private broadcastAlertUpdate(alert: Alert): void {
    for (const [connectionId, subscription] of this.subscriptions) {
      const ws = this.wsConnections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
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
  private alertMatchesFilters(alert: Alert, filters: AlertSubscription['filters']): boolean {
    if (filters.types && !filters.types.includes(alert.type)) return false;
    if (filters.severities && !filters.severities.includes(alert.severity)) return false;
    if (filters.sources && !filters.sources.includes(alert.source)) return false;
    if (filters.tags && !alert.tags?.some(tag => filters.tags!.includes(tag))) return false;
    return true;
  }
}

/**
 * Default alerting manager instance
 */
export const alertingManager = new RealTimeAlertingManager();

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
export class ErrorHandlerAlertIntegration implements ErrorHandlerIntegration {
  private errorPatterns: Map<RegExp, AlertSeverity> = new Map();
  
  constructor(private alertManager: RealTimeAlertingManager) {
    this.setupDefaultErrorPatterns();
  }
  
  sendErrorAlert(error: Error, context?: LogContext): void {
    // Determine severity based on error patterns
    let severity = AlertSeverity.MEDIUM;
    for (const [pattern, patternSeverity] of this.errorPatterns) {
      if (pattern.test(error.message) || pattern.test(error.stack || '')) {
        severity = patternSeverity;
        break;
      }
    }
    
    // Create alert
    this.alertManager.createAlert(
      AlertType.ERROR,
      severity,
      `Error: ${error.name}`,
      error.message,
      context?.component || 'unknown',
      {
        ...context,
        stack: error.stack,
        errorName: error.name
      },
      ['error', error.name.toLowerCase()]
    );
  }
  
  registerErrorPattern(pattern: RegExp, severity: AlertSeverity): void {
    this.errorPatterns.set(pattern, severity);
  }
  
  getErrorAlertStats(): Record<string, any> {
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
  
  private setupDefaultErrorPatterns(): void {
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

/**
 * Export integration for Task 031
 */
export const errorHandlerIntegration = new ErrorHandlerAlertIntegration(alertingManager);