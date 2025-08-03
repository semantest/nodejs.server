"use strict";
/**
 * Real-time Analytics and Reporting Service
 * WebSocket-based real-time updates and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeService = exports.RealtimeService = void 0;
const events_1 = require("events");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
const performance_metrics_1 = require("../monitoring/infrastructure/performance-metrics");
const analytics_service_1 = require("./analytics-service");
const dashboard_service_1 = require("./dashboard-service");
class RealtimeService extends events_1.EventEmitter {
    constructor(io) {
        super();
        this.subscriptions = new Map();
        this.connectedClients = new Map();
        this.isInitialized = false;
        this.alertRules = new Map();
        this.eventBuffer = new Map();
        this.lastMetricsSnapshot = {};
        this.io = io;
    }
    async initialize() {
        if (this.isInitialized) {
            structured_logger_1.logger.warn('Realtime service already initialized');
            return;
        }
        structured_logger_1.logger.info('Initializing realtime service');
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
            structured_logger_1.logger.info('Realtime service initialized successfully');
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to initialize realtime service', error);
            throw error;
        }
    }
    /**
     * Get real-time metrics
     */
    getMetrics() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        // Count events in the last second
        const recentEvents = Array.from(this.eventBuffer.values())
            .flat()
            .filter(event => event.timestamp > oneSecondAgo);
        // Count subscriptions by type
        const subscriptionsByType = {};
        Array.from(this.subscriptions.values()).forEach(sub => {
            subscriptionsByType[sub.type] = (subscriptionsByType[sub.type] || 0) + 1;
        });
        // Get top event types
        const eventTypeCounts = new Map();
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
    createSubscription(userId, socketId, type, filters, options = {}) {
        const subscription = {
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
        performance_metrics_1.performanceMetrics.increment('realtime.subscriptions.created', 1, {
            type,
            userId,
            organizationId: subscription.organizationId || 'none'
        });
        structured_logger_1.logger.info('Real-time subscription created', {
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
    removeSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            return;
        }
        this.subscriptions.delete(subscriptionId);
        // Track removal
        performance_metrics_1.performanceMetrics.increment('realtime.subscriptions.removed', 1, {
            type: subscription.type,
            userId: subscription.userId
        });
        structured_logger_1.logger.info('Real-time subscription removed', {
            subscriptionId,
            type: subscription.type,
            userId: subscription.userId
        });
        this.emit('subscriptionRemoved', subscription);
    }
    /**
     * Send alert to subscribed clients
     */
    sendAlert(alert) {
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
        performance_metrics_1.performanceMetrics.increment('realtime.alerts.sent', 1, {
            type: alert.type,
            severity: alert.severity
        });
        structured_logger_1.logger.info('Real-time alert sent', {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            recipientCount: alertSubscriptions.length
        });
    }
    /**
     * Broadcast dashboard update
     */
    broadcastDashboardUpdate(dashboardId, data) {
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
        performance_metrics_1.performanceMetrics.increment('realtime.dashboard.updates', 1, {
            dashboardId,
            recipientCount: dashboardSubscriptions.length.toString()
        });
        structured_logger_1.logger.debug('Dashboard update broadcasted', {
            dashboardId,
            recipientCount: dashboardSubscriptions.length
        });
    }
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            structured_logger_1.logger.info('Client connected', { socketId: socket.id });
            // Handle authentication
            socket.on('authenticate', (data) => {
                // In production, validate the token
                this.connectedClients.set(socket.id, {
                    userId: data.userId,
                    organizationId: data.organizationId,
                    connectedAt: new Date()
                });
                socket.emit('authenticated', { success: true });
                performance_metrics_1.performanceMetrics.increment('realtime.connections.authenticated', 1, {
                    userId: data.userId,
                    organizationId: data.organizationId || 'none'
                });
                structured_logger_1.logger.info('Client authenticated', {
                    socketId: socket.id,
                    userId: data.userId,
                    organizationId: data.organizationId
                });
            });
            // Handle subscription requests
            socket.on('subscribe', (data) => {
                const client = this.connectedClients.get(socket.id);
                if (!client) {
                    socket.emit('error', { message: 'Not authenticated' });
                    return;
                }
                const subscription = this.createSubscription(client.userId, socket.id, data.type, data.filters, data.options);
                socket.emit('subscribed', {
                    subscriptionId: subscription.id,
                    type: subscription.type,
                    filters: subscription.filters
                });
            });
            // Handle unsubscribe requests
            socket.on('unsubscribe', (data) => {
                this.removeSubscription(data.subscriptionId);
                socket.emit('unsubscribed', { subscriptionId: data.subscriptionId });
            });
            // Handle dashboard refresh requests
            socket.on('refreshDashboard', async (data) => {
                const client = this.connectedClients.get(socket.id);
                if (!client) {
                    socket.emit('error', { message: 'Not authenticated' });
                    return;
                }
                try {
                    const dashboardData = await dashboard_service_1.dashboardService.refreshDashboardData(data.dashboardId);
                    socket.emit('dashboardRefreshed', {
                        dashboardId: data.dashboardId,
                        data: dashboardData
                    });
                }
                catch (error) {
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
                performance_metrics_1.performanceMetrics.increment('realtime.connections.disconnected', 1);
                structured_logger_1.logger.info('Client disconnected', {
                    socketId: socket.id,
                    removedSubscriptions: clientSubscriptions.length
                });
            });
        });
    }
    setupAnalyticsListeners() {
        // Listen for analytics events
        analytics_service_1.analyticsService.on('event', (event) => {
            this.handleAnalyticsEvent(event);
        });
        // Listen for custom metrics
        analytics_service_1.analyticsService.on('metric', (metric) => {
            this.handleCustomMetric(metric);
        });
    }
    setupDashboardListeners() {
        // Listen for dashboard updates
        dashboard_service_1.dashboardService.on('dashboardUpdated', (dashboard) => {
            this.broadcastDashboardUpdate(dashboard.id, { dashboard });
        });
        dashboard_service_1.dashboardService.on('dashboardCreated', (dashboard) => {
            this.broadcastDashboardUpdate(dashboard.id, { dashboard, event: 'created' });
        });
    }
    setupAlertRules() {
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
    handleAnalyticsEvent(event) {
        // Buffer event for metrics
        const bufferKey = `events-${Math.floor(Date.now() / 1000)}`;
        if (!this.eventBuffer.has(bufferKey)) {
            this.eventBuffer.set(bufferKey, []);
        }
        this.eventBuffer.get(bufferKey).push({ ...event, timestamp: Date.now() });
        // Send to subscribed clients
        const eventSubscriptions = Array.from(this.subscriptions.values())
            .filter(sub => this.matchesEventSubscription(sub, event));
        eventSubscriptions.forEach(subscription => {
            // Apply sampling
            if (Math.random() > subscription.options.sampleRate) {
                return;
            }
            // Check rate limiting
            if (subscription.eventCount > subscription.options.maxEventsPerSecond) {
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
    handleCustomMetric(metric) {
        // Buffer metric for metrics
        const bufferKey = `metrics-${Math.floor(Date.now() / 1000)}`;
        if (!this.eventBuffer.has(bufferKey)) {
            this.eventBuffer.set(bufferKey, []);
        }
        this.eventBuffer.get(bufferKey).push({ ...metric, timestamp: Date.now() });
        // Send to subscribed clients
        const metricSubscriptions = Array.from(this.subscriptions.values())
            .filter(sub => this.matchesMetricSubscription(sub, metric));
        metricSubscriptions.forEach(subscription => {
            // Apply sampling
            if (Math.random() > subscription.options.sampleRate) {
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
    matchesEventSubscription(subscription, event) {
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
    matchesMetricSubscription(subscription, metric) {
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
    checkAlerts(type, data) {
        if (type === 'metric') {
            // Check threshold alerts
            for (const [ruleId, rule] of this.alertRules) {
                if (rule.type === 'threshold' && rule.metricName === data.name) {
                    if (data.value > rule.threshold) {
                        const alert = {
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
    startMetricsCollection() {
        // Collect metrics every 10 seconds
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 10000);
    }
    collectMetrics() {
        const metrics = this.getMetrics();
        // Update performance metrics
        performance_metrics_1.performanceMetrics.gauge('realtime.connected_clients', metrics.connectedClients);
        performance_metrics_1.performanceMetrics.gauge('realtime.active_subscriptions', metrics.activeSubscriptions);
        performance_metrics_1.performanceMetrics.gauge('realtime.events_per_second', metrics.eventsPerSecond);
        performance_metrics_1.performanceMetrics.gauge('realtime.messages_per_second', metrics.messagesPerSecond);
        performance_metrics_1.performanceMetrics.gauge('realtime.average_latency', metrics.averageLatency);
        performance_metrics_1.performanceMetrics.gauge('realtime.error_rate', metrics.errorRate);
        // Clean up old event buffers
        const cutoff = Date.now() - 60000; // 1 minute ago
        for (const [key, events] of this.eventBuffer) {
            if (events.length > 0 && events[0].timestamp < cutoff) {
                this.eventBuffer.delete(key);
            }
        }
        this.lastMetricsSnapshot = metrics;
    }
    getMessagesPerSecond() {
        // Calculate based on subscription activity
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        return Array.from(this.subscriptions.values())
            .filter(sub => sub.lastActivity.getTime() > oneSecondAgo)
            .reduce((sum, sub) => sum + sub.eventCount, 0);
    }
    getAverageLatency() {
        // Mock implementation - would measure actual latency in production
        return 50; // 50ms average
    }
    getErrorRate() {
        // Mock implementation - would calculate actual error rate
        return 0.01; // 1% error rate
    }
    getClientOrganizationId(socketId) {
        const client = this.connectedClients.get(socketId);
        return client?.organizationId;
    }
    generateSubscriptionId() {
        return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateAlertId() {
        return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        // Clear all subscriptions
        this.subscriptions.clear();
        this.connectedClients.clear();
        this.eventBuffer.clear();
        structured_logger_1.logger.info('Realtime service shut down');
    }
}
exports.RealtimeService = RealtimeService;
//# sourceMappingURL=realtime-service.js.map