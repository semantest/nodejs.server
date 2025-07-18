/**
 * Real-time Analytics and Reporting Service
 * WebSocket-based real-time updates and monitoring
 */

import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../monitoring/infrastructure/structured-logger';
import { performanceMetrics } from '../monitoring/infrastructure/performance-metrics';
import { analyticsService, AnalyticsEvent, CustomMetric } from './analytics-service';
import { dashboardService, Dashboard } from './dashboard-service';

export interface RealtimeSubscription {
  id: string;
  userId: string;
  organizationId?: string;
  type: 'events' | 'metrics' | 'dashboard' | 'alerts';
  filters: {
    eventTypes?: string[];
    metricNames?: string[];
    dashboardId?: string;
    alertTypes?: string[];
    userIds?: string[];
    organizationIds?: string[];
  };
  options: {
    sampleRate?: number; // 0-1, percentage of events to send
    maxEventsPerSecond?: number;
    aggregationWindow?: number; // in seconds
    includeMetadata?: boolean;
  };
  createdAt: Date;
  lastActivity: Date;
  eventCount: number;
  socketId: string;
}

export interface RealtimeMetrics {
  connectedClients: number;
  activeSubscriptions: number;
  eventsPerSecond: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  subscriptionsByType: Record<string, number>;
  topEventTypes: Array<{ type: string; count: number }>;
}

export interface RealtimeAlert {
  id: string;
  type: 'threshold' | 'anomaly' | 'error' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: any;
  threshold?: number;
  currentValue?: number;
  createdAt: Date;
  resolvedAt?: Date;
  isResolved: boolean;
}

export class RealtimeService extends EventEmitter {
  private io: SocketIOServer;
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private connectedClients: Map<string, { userId: string; organizationId?: string; connectedAt: Date }> = new Map();
  private isInitialized = false;
  private metricsInterval: NodeJS.Timeout;
  private alertRules: Map<string, any> = new Map();
  private eventBuffer: Map<string, any[]> = new Map();
  private lastMetricsSnapshot: any = {};

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Realtime service already initialized');
      return;
    }

    logger.info('Initializing realtime service');

    try {
      // Setup WebSocket event handlers
      this.setupSocketHandlers();
      
      // Setup analytics event listeners
      this.setupAnalyticsListeners();
      
      // Setup dashboard listeners
      this.setupDashboardListeners();
      
      // Setup alert rules
      this.setupAlertRules();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.isInitialized = true;
      logger.info('Realtime service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize realtime service', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  getMetrics(): RealtimeMetrics {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Count events in the last second
    const recentEvents = Array.from(this.eventBuffer.values())
      .flat()
      .filter(event => event.timestamp > oneSecondAgo);
    
    // Count subscriptions by type
    const subscriptionsByType: Record<string, number> = {};
    Array.from(this.subscriptions.values()).forEach(sub => {
      subscriptionsByType[sub.type] = (subscriptionsByType[sub.type] || 0) + 1;
    });

    // Get top event types
    const eventTypeCounts = new Map<string, number>();
    recentEvents.forEach(event => {
      if (event.eventType) {
        eventTypeCounts.set(event.eventType, (eventTypeCounts.get(event.eventType) || 0) + 1);
      }
    });
    
    const topEventTypes = Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      connectedClients: this.connectedClients.size,
      activeSubscriptions: this.subscriptions.size,
      eventsPerSecond: recentEvents.length,
      messagesPerSecond: this.getMessagesPerSecond(),
      averageLatency: this.getAverageLatency(),
      errorRate: this.getErrorRate(),
      subscriptionsByType,
      topEventTypes
    };
  }

  /**
   * Create subscription for real-time updates
   */
  createSubscription(
    userId: string,
    socketId: string,
    type: RealtimeSubscription['type'],
    filters: RealtimeSubscription['filters'],
    options: RealtimeSubscription['options'] = {}
  ): RealtimeSubscription {
    const subscription: RealtimeSubscription = {
      id: this.generateSubscriptionId(),
      userId,
      organizationId: this.getClientOrganizationId(socketId),
      type,
      filters,
      options: {
        sampleRate: 1.0,
        maxEventsPerSecond: 100,
        aggregationWindow: 1,
        includeMetadata: true,
        ...options
      },
      createdAt: new Date(),
      lastActivity: new Date(),
      eventCount: 0,
      socketId
    };

    this.subscriptions.set(subscription.id, subscription);

    // Track subscription
    performanceMetrics.increment('realtime.subscriptions.created', 1, {
      type,
      userId,
      organizationId: subscription.organizationId || 'none'
    });

    logger.info('Real-time subscription created', {
      subscriptionId: subscription.id,
      type,
      userId,
      socketId,
      filters
    });

    this.emit('subscriptionCreated', subscription);
    return subscription;
  }

  /**
   * Remove subscription
   */
  removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    this.subscriptions.delete(subscriptionId);

    // Track removal
    performanceMetrics.increment('realtime.subscriptions.removed', 1, {
      type: subscription.type,
      userId: subscription.userId
    });

    logger.info('Real-time subscription removed', {
      subscriptionId,
      type: subscription.type,
      userId: subscription.userId
    });

    this.emit('subscriptionRemoved', subscription);
  }

  /**
   * Send alert to subscribed clients
   */
  sendAlert(alert: RealtimeAlert): void {
    const alertSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === 'alerts');

    alertSubscriptions.forEach(subscription => {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        socket.emit('alert', {
          subscriptionId: subscription.id,
          alert,
          timestamp: new Date()
        });

        subscription.lastActivity = new Date();
        subscription.eventCount++;
      }
    });

    // Track alert
    performanceMetrics.increment('realtime.alerts.sent', 1, {
      type: alert.type,
      severity: alert.severity
    });

    logger.info('Real-time alert sent', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      recipientCount: alertSubscriptions.length
    });
  }

  /**
   * Broadcast dashboard update
   */
  broadcastDashboardUpdate(dashboardId: string, data: any): void {
    const dashboardSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === 'dashboard' && sub.filters.dashboardId === dashboardId);

    dashboardSubscriptions.forEach(subscription => {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        socket.emit('dashboardUpdate', {
          subscriptionId: subscription.id,
          dashboardId,
          data,
          timestamp: new Date()
        });

        subscription.lastActivity = new Date();
        subscription.eventCount++;
      }
    });

    // Track dashboard update
    performanceMetrics.increment('realtime.dashboard.updates', 1, {
      dashboardId,
      recipientCount: dashboardSubscriptions.length.toString()
    });

    logger.debug('Dashboard update broadcasted', {
      dashboardId,
      recipientCount: dashboardSubscriptions.length
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });
      
      // Handle authentication
      socket.on('authenticate', (data: { userId: string; organizationId?: string; token: string }) => {
        // In production, validate the token
        this.connectedClients.set(socket.id, {
          userId: data.userId,
          organizationId: data.organizationId,
          connectedAt: new Date()
        });

        socket.emit('authenticated', { success: true });
        
        performanceMetrics.increment('realtime.connections.authenticated', 1, {
          userId: data.userId,
          organizationId: data.organizationId || 'none'
        });

        logger.info('Client authenticated', {
          socketId: socket.id,
          userId: data.userId,
          organizationId: data.organizationId
        });
      });

      // Handle subscription requests
      socket.on('subscribe', (data: {
        type: RealtimeSubscription['type'];
        filters: RealtimeSubscription['filters'];
        options?: RealtimeSubscription['options'];
      }) => {
        const client = this.connectedClients.get(socket.id);
        if (!client) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const subscription = this.createSubscription(
          client.userId,
          socket.id,
          data.type,
          data.filters,
          data.options
        );

        socket.emit('subscribed', {
          subscriptionId: subscription.id,
          type: subscription.type,
          filters: subscription.filters
        });
      });

      // Handle unsubscribe requests
      socket.on('unsubscribe', (data: { subscriptionId: string }) => {
        this.removeSubscription(data.subscriptionId);
        socket.emit('unsubscribed', { subscriptionId: data.subscriptionId });
      });

      // Handle dashboard refresh requests
      socket.on('refreshDashboard', async (data: { dashboardId: string }) => {
        const client = this.connectedClients.get(socket.id);
        if (!client) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        try {
          const dashboardData = await dashboardService.refreshDashboardData(data.dashboardId);
          socket.emit('dashboardRefreshed', {
            dashboardId: data.dashboardId,
            data: dashboardData
          });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Remove client
        this.connectedClients.delete(socket.id);
        
        // Remove subscriptions
        const clientSubscriptions = Array.from(this.subscriptions.values())
          .filter(sub => sub.socketId === socket.id);
        
        clientSubscriptions.forEach(sub => {
          this.removeSubscription(sub.id);
        });

        performanceMetrics.increment('realtime.connections.disconnected', 1);
        
        logger.info('Client disconnected', {
          socketId: socket.id,
          removedSubscriptions: clientSubscriptions.length
        });
      });
    });
  }

  private setupAnalyticsListeners(): void {
    // Listen for analytics events
    analyticsService.on('event', (event: AnalyticsEvent) => {
      this.handleAnalyticsEvent(event);
    });

    // Listen for custom metrics
    analyticsService.on('metric', (metric: CustomMetric) => {
      this.handleCustomMetric(metric);
    });
  }

  private setupDashboardListeners(): void {
    // Listen for dashboard updates
    dashboardService.on('dashboardUpdated', (dashboard: Dashboard) => {
      this.broadcastDashboardUpdate(dashboard.id, { dashboard });
    });

    dashboardService.on('dashboardCreated', (dashboard: Dashboard) => {
      this.broadcastDashboardUpdate(dashboard.id, { dashboard, event: 'created' });
    });
  }

  private setupAlertRules(): void {
    // Setup threshold-based alerts
    this.alertRules.set('high-error-rate', {
      type: 'threshold',
      metricName: 'error_rate',
      threshold: 0.05, // 5%
      severity: 'high',
      title: 'High Error Rate',
      description: 'Error rate has exceeded 5%'
    });

    this.alertRules.set('high-response-time', {
      type: 'threshold',
      metricName: 'response_time',
      threshold: 1000, // 1 second
      severity: 'medium',
      title: 'High Response Time',
      description: 'Average response time has exceeded 1 second'
    });

    this.alertRules.set('low-memory', {
      type: 'threshold',
      metricName: 'memory_usage',
      threshold: 0.90, // 90%
      severity: 'critical',
      title: 'Low Memory',
      description: 'Memory usage has exceeded 90%'
    });
  }

  private handleAnalyticsEvent(event: AnalyticsEvent): void {
    // Buffer event for metrics
    const bufferKey = `events-${Math.floor(Date.now() / 1000)}`;
    if (!this.eventBuffer.has(bufferKey)) {
      this.eventBuffer.set(bufferKey, []);
    }
    this.eventBuffer.get(bufferKey)!.push({ ...event, timestamp: Date.now() });

    // Send to subscribed clients
    const eventSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => this.matchesEventSubscription(sub, event));

    eventSubscriptions.forEach(subscription => {
      // Apply sampling
      if (Math.random() > subscription.options.sampleRate!) {
        return;
      }

      // Check rate limiting
      if (subscription.eventCount > subscription.options.maxEventsPerSecond!) {
        return;
      }

      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        const eventData = subscription.options.includeMetadata 
          ? event 
          : { ...event, metadata: undefined };

        socket.emit('analyticsEvent', {
          subscriptionId: subscription.id,
          event: eventData,
          timestamp: new Date()
        });

        subscription.lastActivity = new Date();
        subscription.eventCount++;
      }
    });

    // Check for alerts
    this.checkAlerts('event', event);
  }

  private handleCustomMetric(metric: CustomMetric): void {
    // Buffer metric for metrics
    const bufferKey = `metrics-${Math.floor(Date.now() / 1000)}`;
    if (!this.eventBuffer.has(bufferKey)) {
      this.eventBuffer.set(bufferKey, []);
    }
    this.eventBuffer.get(bufferKey)!.push({ ...metric, timestamp: Date.now() });

    // Send to subscribed clients
    const metricSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => this.matchesMetricSubscription(sub, metric));

    metricSubscriptions.forEach(subscription => {
      // Apply sampling
      if (Math.random() > subscription.options.sampleRate!) {
        return;
      }

      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket) {
        socket.emit('customMetric', {
          subscriptionId: subscription.id,
          metric,
          timestamp: new Date()
        });

        subscription.lastActivity = new Date();
        subscription.eventCount++;
      }
    });

    // Check for alerts
    this.checkAlerts('metric', metric);
  }

  private matchesEventSubscription(subscription: RealtimeSubscription, event: AnalyticsEvent): boolean {
    if (subscription.type !== 'events') {
      return false;
    }

    // Check event type filter
    if (subscription.filters.eventTypes && 
        !subscription.filters.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check user filter
    if (subscription.filters.userIds && event.userId &&
        !subscription.filters.userIds.includes(event.userId)) {
      return false;
    }

    // Check organization filter
    if (subscription.filters.organizationIds && event.organizationId &&
        !subscription.filters.organizationIds.includes(event.organizationId)) {
      return false;
    }

    return true;
  }

  private matchesMetricSubscription(subscription: RealtimeSubscription, metric: CustomMetric): boolean {
    if (subscription.type !== 'metrics') {
      return false;
    }

    // Check metric name filter
    if (subscription.filters.metricNames && 
        !subscription.filters.metricNames.includes(metric.name)) {
      return false;
    }

    return true;
  }

  private checkAlerts(type: 'event' | 'metric', data: any): void {
    if (type === 'metric') {
      // Check threshold alerts
      for (const [ruleId, rule] of this.alertRules) {
        if (rule.type === 'threshold' && rule.metricName === data.name) {
          if (data.value > rule.threshold) {
            const alert: RealtimeAlert = {
              id: this.generateAlertId(),
              type: 'threshold',
              severity: rule.severity,
              title: rule.title,
              description: rule.description,
              data: data,
              threshold: rule.threshold,
              currentValue: data.value,
              createdAt: new Date(),
              isResolved: false
            };

            this.sendAlert(alert);
          }
        }
      }
    }
  }

  private startMetricsCollection(): void {
    // Collect metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);
  }

  private collectMetrics(): void {
    const metrics = this.getMetrics();
    
    // Update performance metrics
    performanceMetrics.gauge('realtime.connected_clients', metrics.connectedClients);
    performanceMetrics.gauge('realtime.active_subscriptions', metrics.activeSubscriptions);
    performanceMetrics.gauge('realtime.events_per_second', metrics.eventsPerSecond);
    performanceMetrics.gauge('realtime.messages_per_second', metrics.messagesPerSecond);
    performanceMetrics.gauge('realtime.average_latency', metrics.averageLatency);
    performanceMetrics.gauge('realtime.error_rate', metrics.errorRate);

    // Clean up old event buffers
    const cutoff = Date.now() - 60000; // 1 minute ago
    for (const [key, events] of this.eventBuffer) {
      if (events.length > 0 && events[0].timestamp < cutoff) {
        this.eventBuffer.delete(key);
      }
    }

    this.lastMetricsSnapshot = metrics;
  }

  private getMessagesPerSecond(): number {
    // Calculate based on subscription activity
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.lastActivity.getTime() > oneSecondAgo)
      .reduce((sum, sub) => sum + sub.eventCount, 0);
  }

  private getAverageLatency(): number {
    // Mock implementation - would measure actual latency in production
    return 50; // 50ms average
  }

  private getErrorRate(): number {
    // Mock implementation - would calculate actual error rate
    return 0.01; // 1% error rate
  }

  private getClientOrganizationId(socketId: string): string | undefined {
    const client = this.connectedClients.get(socketId);
    return client?.organizationId;
  }

  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Clear all subscriptions
    this.subscriptions.clear();
    this.connectedClients.clear();
    this.eventBuffer.clear();

    logger.info('Realtime service shut down');
  }
}

export let realtimeService: RealtimeService;