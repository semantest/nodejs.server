/**
 * @fileoverview Rate Limiting Monitoring and Alerting
 * @description Comprehensive monitoring, metrics, and alerting for rate limiting system
 * @author Web-Buddy Team
 */

import { EventEmitter } from 'events';
import { RateLimitResult } from './rate-limiting-service';
import { RateLimitTier } from './rate-limit-config';
import { StoreStats } from './rate-limit-stores';

/**
 * Rate limit violation event
 */
export interface RateLimitViolation {
  identifier: string;
  endpoint: string;
  tier: RateLimitTier;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    userAgent?: string;
    extensionId?: string;
    ipAddress: string;
    userId?: string;
    requestCount: number;
    windowStart: number;
    rateLimitResult: RateLimitResult;
  };
}

/**
 * Rate limiting metrics
 */
export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  byTier: Record<RateLimitTier, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  byEndpoint: Record<string, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  byUser: Record<string, {
    requests: number;
    blocked: number;
    allowed: number;
  }>;
  violations: RateLimitViolation[];
  averageResponseTime: number;
  storeStats?: StoreStats;
  timeWindow: {
    start: number;
    end: number;
    durationMs: number;
  };
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    violationsPerMinute: number;
    blockedRequestsPercentage: number;
    criticalViolationsPerMinute: number;
    storeErrorRate: number;
  };
  notifications: {
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
    email?: {
      to: string[];
      from: string;
      subject: string;
    };
    slack?: {
      webhook: string;
      channel: string;
    };
  };
  cooldownMs: number; // Minimum time between alerts
}

/**
 * Rate limiting monitor
 */
export class RateLimitMonitor extends EventEmitter {
  private metrics: RateLimitMetrics;
  private violations: RateLimitViolation[] = [];
  private lastAlerts = new Map<string, number>();
  private startTime = Date.now();
  private requestTimes: number[] = [];

  constructor(
    private config: AlertConfig = {
      enabled: true,
      thresholds: {
        violationsPerMinute: 10,
        blockedRequestsPercentage: 20,
        criticalViolationsPerMinute: 5,
        storeErrorRate: 5
      },
      notifications: {},
      cooldownMs: 5 * 60 * 1000 // 5 minutes
    }
  ) {
    super();
    this.initializeMetrics();
    this.startPeriodicReporting();
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      byTier: {} as any,
      byEndpoint: {} as any,
      byUser: {} as any,
      violations: [],
      averageResponseTime: 0,
      timeWindow: {
        start: this.startTime,
        end: Date.now(),
        durationMs: 0
      }
    };
  }

  /**
   * Record a rate limit check
   */
  public recordRateLimitCheck(
    identifier: string,
    endpoint: string,
    results: Map<string, RateLimitResult>,
    allowed: boolean,
    responseTimeMs: number,
    context: {
      userAgent?: string;
      extensionId?: string;
      ipAddress: string;
      userId?: string;
    }
  ): void {
    const timestamp = Date.now();
    
    // Update basic metrics
    this.metrics.totalRequests++;
    if (allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.blockedRequests++;
    }

    // Track response times
    this.requestTimes.push(responseTimeMs);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000); // Keep last 1000
    }
    this.metrics.averageResponseTime = 
      this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;

    // Update tier-specific metrics
    for (const [tierName, result] of results) {
      const tier = tierName as RateLimitTier;
      if (!this.metrics.byTier[tier]) {
        this.metrics.byTier[tier] = { requests: 0, blocked: 0, allowed: 0 };
      }
      
      this.metrics.byTier[tier].requests++;
      if (result.allowed) {
        this.metrics.byTier[tier].allowed++;
      } else {
        this.metrics.byTier[tier].blocked++;
      }
    }

    // Update endpoint-specific metrics
    if (!this.metrics.byEndpoint[endpoint]) {
      this.metrics.byEndpoint[endpoint] = { requests: 0, blocked: 0, allowed: 0 };
    }
    this.metrics.byEndpoint[endpoint].requests++;
    if (allowed) {
      this.metrics.byEndpoint[endpoint].allowed++;
    } else {
      this.metrics.byEndpoint[endpoint].blocked++;
    }

    // Update user-specific metrics
    if (context.userId) {
      if (!this.metrics.byUser[context.userId]) {
        this.metrics.byUser[context.userId] = { requests: 0, blocked: 0, allowed: 0 };
      }
      this.metrics.byUser[context.userId].requests++;
      if (allowed) {
        this.metrics.byUser[context.userId].allowed++;
      } else {
        this.metrics.byUser[context.userId].blocked++;
      }
    }

    // Record violation if request was blocked
    if (!allowed) {
      this.recordViolation(identifier, endpoint, results, context, timestamp);
    }

    // Update time window
    this.metrics.timeWindow.end = timestamp;
    this.metrics.timeWindow.durationMs = timestamp - this.metrics.timeWindow.start;

    // Emit event
    this.emit('rateLimitCheck', {
      identifier,
      endpoint,
      allowed,
      results,
      responseTimeMs,
      context,
      timestamp
    });
  }

  /**
   * Record a rate limit violation
   */
  private recordViolation(
    identifier: string,
    endpoint: string,
    results: Map<string, RateLimitResult>,
    context: any,
    timestamp: number
  ): void {
    // Find the most restrictive tier that was violated
    let mostRestrictiveResult: RateLimitResult | undefined;
    let mostRestrictiveTier: RateLimitTier | undefined;
    let highestCount = 0;

    for (const [tierName, result] of results) {
      if (!result.allowed && result.metadata.currentCount > highestCount) {
        highestCount = result.metadata.currentCount;
        mostRestrictiveResult = result;
        mostRestrictiveTier = tierName as RateLimitTier;
      }
    }

    if (!mostRestrictiveResult || !mostRestrictiveTier) return;

    // Determine severity
    const severity = this.determineSeverity(mostRestrictiveResult, context);

    const violation: RateLimitViolation = {
      identifier,
      endpoint,
      tier: mostRestrictiveTier,
      timestamp,
      severity,
      metadata: {
        userAgent: context.userAgent,
        extensionId: context.extensionId,
        ipAddress: context.ipAddress,
        userId: context.userId,
        requestCount: mostRestrictiveResult.metadata.currentCount,
        windowStart: mostRestrictiveResult.metadata.windowStart || timestamp,
        rateLimitResult: mostRestrictiveResult
      }
    };

    this.violations.push(violation);
    this.metrics.violations.push(violation);

    // Keep only recent violations (last hour)
    const oneHourAgo = timestamp - (60 * 60 * 1000);
    this.violations = this.violations.filter(v => v.timestamp > oneHourAgo);
    this.metrics.violations = this.metrics.violations.filter(v => v.timestamp > oneHourAgo);

    // Emit violation event
    this.emit('violation', violation);

    // Check if alerts should be triggered
    this.checkAlerts();

    console.warn('🚫 Rate limit violation recorded', {
      identifier,
      endpoint,
      tier: mostRestrictiveTier,
      severity,
      requestCount: violation.metadata.requestCount
    });
  }

  /**
   * Determine violation severity
   */
  private determineSeverity(
    result: RateLimitResult,
    context: any
  ): RateLimitViolation['severity'] {
    const currentCount = result.metadata.currentCount;
    const retryAfter = result.retryAfter || 0;

    // Critical: Very high request count or long retry period
    if (currentCount > 1000 || retryAfter > 300) {
      return 'critical';
    }

    // High: High request count or significant retry period
    if (currentCount > 500 || retryAfter > 60) {
      return 'high';
    }

    // Medium: Moderate violations
    if (currentCount > 100 || retryAfter > 10) {
      return 'medium';
    }

    // Low: Minor violations
    return 'low';
  }

  /**
   * Check if alerts should be triggered
   */
  private checkAlerts(): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    
    // Count recent violations
    const recentViolations = this.violations.filter(v => v.timestamp > oneMinuteAgo);
    const criticalViolations = recentViolations.filter(v => v.severity === 'critical');
    
    // Calculate blocked requests percentage
    const blockedPercentage = this.metrics.totalRequests > 0 
      ? (this.metrics.blockedRequests / this.metrics.totalRequests) * 100 
      : 0;

    // Check thresholds
    const alerts: string[] = [];

    if (recentViolations.length >= this.config.thresholds.violationsPerMinute) {
      alerts.push(`violations_per_minute:${recentViolations.length}`);
    }

    if (criticalViolations.length >= this.config.thresholds.criticalViolationsPerMinute) {
      alerts.push(`critical_violations:${criticalViolations.length}`);
    }

    if (blockedPercentage >= this.config.thresholds.blockedRequestsPercentage) {
      alerts.push(`blocked_percentage:${blockedPercentage.toFixed(2)}%`);
    }

    // Send alerts (with cooldown)
    for (const alertType of alerts) {
      const lastAlert = this.lastAlerts.get(alertType) || 0;
      if (now - lastAlert > this.config.cooldownMs) {
        this.sendAlert(alertType, {
          recentViolations: recentViolations.length,
          criticalViolations: criticalViolations.length,
          blockedPercentage,
          timestamp: now
        });
        this.lastAlerts.set(alertType, now);
      }
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alertType: string, data: any): Promise<void> {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      data
    };

    console.error('🚨 Rate limiting alert triggered:', alert);

    // Emit alert event
    this.emit('alert', alert);

    // Send notifications
    try {
      if (this.config.notifications.webhook) {
        await this.sendWebhookAlert(alert);
      }
      
      if (this.config.notifications.slack) {
        await this.sendSlackAlert(alert);
      }
      
      // Email notifications would go here
    } catch (error) {
      console.error('❌ Failed to send alert notification:', error);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: any): Promise<void> {
    const webhook = this.config.notifications.webhook!;
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhook.headers
      },
      body: JSON.stringify(alert)
    });

    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: any): Promise<void> {
    const slack = this.config.notifications.slack!;
    
    const message = {
      channel: slack.channel,
      text: `🚨 Rate Limiting Alert: ${alert.type}`,
      attachments: [{
        color: 'danger',
        fields: [
          {
            title: 'Alert Type',
            value: alert.type,
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: true
          },
          {
            title: 'Total Requests',
            value: alert.metrics.totalRequests.toString(),
            short: true
          },
          {
            title: 'Blocked Requests',
            value: alert.metrics.blockedRequests.toString(),
            short: true
          }
        ]
      }]
    };

    const response = await fetch(slack.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack alert failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent violations
   */
  public getRecentViolations(sinceMs: number = 60 * 60 * 1000): RateLimitViolation[] {
    const since = Date.now() - sinceMs;
    return this.violations.filter(v => v.timestamp > since);
  }

  /**
   * Get top violators
   */
  public getTopViolators(limit: number = 10): {
    identifier: string;
    violations: number;
    endpoints: string[];
    severity: RateLimitViolation['severity'];
  }[] {
    const violatorMap = new Map<string, {
      violations: number;
      endpoints: Set<string>;
      maxSeverity: RateLimitViolation['severity'];
    }>();

    for (const violation of this.violations) {
      const existing = violatorMap.get(violation.identifier) || {
        violations: 0,
        endpoints: new Set(),
        maxSeverity: 'low' as const
      };

      existing.violations++;
      existing.endpoints.add(violation.endpoint);
      
      // Update max severity
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severityOrder[violation.severity] > severityOrder[existing.maxSeverity]) {
        existing.maxSeverity = violation.severity;
      }

      violatorMap.set(violation.identifier, existing);
    }

    return Array.from(violatorMap.entries())
      .map(([identifier, data]) => ({
        identifier,
        violations: data.violations,
        endpoints: Array.from(data.endpoints),
        severity: data.maxSeverity
      }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, limit);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.initializeMetrics();
    this.violations = [];
    this.requestTimes = [];
    this.startTime = Date.now();
  }

  /**
   * Update store stats
   */
  public updateStoreStats(stats: StoreStats): void {
    this.metrics.storeStats = stats;
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    setInterval(() => {
      this.emit('periodicReport', this.getMetrics());
      
      // Log summary
      const metrics = this.getMetrics();
      const blockedPercentage = metrics.totalRequests > 0 
        ? ((metrics.blockedRequests / metrics.totalRequests) * 100).toFixed(2)
        : '0.00';

      console.log(`📊 Rate limiting report - Total: ${metrics.totalRequests}, Blocked: ${metrics.blockedRequests} (${blockedPercentage}%), Avg response: ${metrics.averageResponseTime.toFixed(2)}ms`);
    }, 60 * 1000); // Every minute
  }

  /**
   * Health check
   */
  public getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    metrics: RateLimitMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    
    // Check for high block percentage
    const blockedPercentage = metrics.totalRequests > 0 
      ? (metrics.blockedRequests / metrics.totalRequests) * 100 
      : 0;
    
    if (blockedPercentage > 50) {
      issues.push(`High block percentage: ${blockedPercentage.toFixed(2)}%`);
    }

    // Check for recent critical violations
    const recentCritical = this.getRecentViolations(5 * 60 * 1000)
      .filter(v => v.severity === 'critical');
    
    if (recentCritical.length > 0) {
      issues.push(`${recentCritical.length} critical violations in last 5 minutes`);
    }

    // Check store health
    if (metrics.storeStats) {
      const hitRate = metrics.storeStats.hitRate || 0;
      if (hitRate < 50) {
        issues.push(`Low cache hit rate: ${hitRate.toFixed(2)}%`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics
    };
  }
}