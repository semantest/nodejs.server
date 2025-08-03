/**
 * Real-time Analytics and Reporting Service
 * WebSocket-based real-time updates and monitoring
 */
import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
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
        sampleRate?: number;
        maxEventsPerSecond?: number;
        aggregationWindow?: number;
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
    topEventTypes: Array<{
        type: string;
        count: number;
    }>;
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
export declare class RealtimeService extends EventEmitter {
    private io;
    private subscriptions;
    private connectedClients;
    private isInitialized;
    private metricsInterval;
    private alertRules;
    private eventBuffer;
    private lastMetricsSnapshot;
    constructor(io: SocketIOServer);
    initialize(): Promise<void>;
    /**
     * Get real-time metrics
     */
    getMetrics(): RealtimeMetrics;
    /**
     * Create subscription for real-time updates
     */
    createSubscription(userId: string, socketId: string, type: RealtimeSubscription['type'], filters: RealtimeSubscription['filters'], options?: RealtimeSubscription['options']): RealtimeSubscription;
    /**
     * Remove subscription
     */
    removeSubscription(subscriptionId: string): void;
    /**
     * Send alert to subscribed clients
     */
    sendAlert(alert: RealtimeAlert): void;
    /**
     * Broadcast dashboard update
     */
    broadcastDashboardUpdate(dashboardId: string, data: any): void;
    private setupSocketHandlers;
    private setupAnalyticsListeners;
    private setupDashboardListeners;
    private setupAlertRules;
    private handleAnalyticsEvent;
    private handleCustomMetric;
    private matchesEventSubscription;
    private matchesMetricSubscription;
    private checkAlerts;
    private startMetricsCollection;
    private collectMetrics;
    private getMessagesPerSecond;
    private getAverageLatency;
    private getErrorRate;
    private getClientOrganizationId;
    private generateSubscriptionId;
    private generateAlertId;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
export declare let realtimeService: RealtimeService;
//# sourceMappingURL=realtime-service.d.ts.map