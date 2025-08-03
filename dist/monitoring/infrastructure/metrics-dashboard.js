"use strict";
/**
 * Metrics Dashboard
 * Provides a comprehensive dashboard for monitoring system metrics and alerts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsDashboard = exports.MetricsDashboard = void 0;
const express_1 = require("express");
const performance_metrics_1 = require("./performance-metrics");
const health_check_1 = require("./health-check");
const real_time_alerting_1 = require("./real-time-alerting");
const structured_logger_1 = require("./structured-logger");
/**
 * Dashboard data aggregator
 */
class MetricsDashboard {
    constructor() {
        this.lastUpdateTime = new Date();
        this.cachedData = null;
        this.cacheExpiry = 30000; // 30 seconds cache
        this.dashboardHTML = this.generateDashboardHTML();
    }
    /**
     * Get dashboard router
     */
    getDashboardRouter() {
        const router = (0, express_1.Router)();
        // Dashboard page
        router.get('/dashboard', (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.send(this.dashboardHTML);
        });
        // Dashboard API endpoints
        router.get('/dashboard/api/overview', async (req, res) => {
            try {
                const data = await this.getOverviewData();
                res.json(data);
            }
            catch (error) {
                structured_logger_1.logger.error('Failed to get overview data', error);
                res.status(500).json({ error: 'Failed to get overview data' });
            }
        });
        router.get('/dashboard/api/metrics', async (req, res) => {
            try {
                const data = await this.getMetricsData();
                res.json(data);
            }
            catch (error) {
                structured_logger_1.logger.error('Failed to get metrics data', error);
                res.status(500).json({ error: 'Failed to get metrics data' });
            }
        });
        router.get('/dashboard/api/alerts', async (req, res) => {
            try {
                const data = await this.getAlertsData();
                res.json(data);
            }
            catch (error) {
                structured_logger_1.logger.error('Failed to get alerts data', error);
                res.status(500).json({ error: 'Failed to get alerts data' });
            }
        });
        router.get('/dashboard/api/health', async (req, res) => {
            try {
                const data = await health_check_1.healthCheckManager.getHealthReport();
                res.json(data);
            }
            catch (error) {
                structured_logger_1.logger.error('Failed to get health data', error);
                res.status(500).json({ error: 'Failed to get health data' });
            }
        });
        return router;
    }
    /**
     * Get overview data
     */
    async getOverviewData() {
        const now = Date.now();
        // Use cached data if available and not expired
        if (this.cachedData && (now - this.lastUpdateTime.getTime()) < this.cacheExpiry) {
            return this.cachedData;
        }
        const systemMetrics = performance_metrics_1.performanceMetrics.getSystemMetrics();
        const businessMetrics = performance_metrics_1.performanceMetrics.getBusinessMetrics();
        const alertStats = real_time_alerting_1.alertingManager.getAlertStatistics();
        const healthReport = await health_check_1.healthCheckManager.getHealthReport();
        const data = {
            timestamp: new Date(),
            system: {
                uptime: systemMetrics.uptime,
                cpu: systemMetrics.cpu,
                memory: {
                    usage: systemMetrics.memory.used / systemMetrics.memory.total,
                    used: systemMetrics.memory.used,
                    total: systemMetrics.memory.total
                },
                status: healthReport.overall
            },
            business: {
                activeConnections: businessMetrics.websocketConnections.active,
                totalRequests: businessMetrics.apiRequests.total,
                errorRate: businessMetrics.apiRequests.total > 0 ?
                    businessMetrics.apiRequests.errors / businessMetrics.apiRequests.total : 0,
                avgResponseTime: businessMetrics.apiRequests.responseTime.avg
            },
            alerts: {
                active: alertStats.active,
                total: alertStats.total,
                critical: alertStats.bySeverity.critical || 0,
                high: alertStats.bySeverity.high || 0
            },
            services: Object.keys(healthReport.services).length,
            dependencies: Object.keys(healthReport.dependencies).length
        };
        this.cachedData = data;
        this.lastUpdateTime = new Date();
        return data;
    }
    /**
     * Get metrics data
     */
    async getMetricsData() {
        const allMetrics = performance_metrics_1.performanceMetrics.getAllMetrics();
        return {
            timestamp: new Date(),
            system: allMetrics.system,
            business: allMetrics.business,
            counters: allMetrics.counters,
            gauges: allMetrics.gauges,
            histograms: allMetrics.histograms
        };
    }
    /**
     * Get alerts data
     */
    async getAlertsData() {
        const activeAlerts = real_time_alerting_1.alertingManager.getActiveAlerts();
        const stats = real_time_alerting_1.alertingManager.getAlertStatistics();
        return {
            timestamp: new Date(),
            activeAlerts: activeAlerts.slice(0, 50), // Latest 50 alerts
            statistics: stats,
            recentAlerts: activeAlerts
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 10)
        };
    }
    /**
     * Generate dashboard HTML
     */
    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantest Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .header {
            background: #2c3e50;
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header h1 {
            margin: 0;
            font-size: 1.8rem;
        }

        .header .timestamp {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 0.5rem;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #3498db;
        }

        .card.critical {
            border-left-color: #e74c3c;
        }

        .card.warning {
            border-left-color: #f39c12;
        }

        .card.success {
            border-left-color: #27ae60;
        }

        .card h3 {
            margin-bottom: 1rem;
            color: #2c3e50;
            font-size: 1.2rem;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #ecf0f1;
        }

        .metric:last-child {
            border-bottom: none;
        }

        .metric-label {
            font-weight: 500;
            color: #5d6d7e;
        }

        .metric-value {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .metric-value.critical {
            color: #e74c3c;
        }

        .metric-value.warning {
            color: #f39c12;
        }

        .metric-value.success {
            color: #27ae60;
        }

        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }

        .status-healthy {
            background: #27ae60;
        }

        .status-degraded {
            background: #f39c12;
        }

        .status-unhealthy {
            background: #e74c3c;
        }

        .chart-container {
            position: relative;
            height: 200px;
            margin-top: 1rem;
        }

        .alert-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .alert-item {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-radius: 4px;
            border-left: 4px solid;
        }

        .alert-item.critical {
            background: #fdf2f2;
            border-left-color: #e74c3c;
        }

        .alert-item.high {
            background: #fef9e7;
            border-left-color: #f39c12;
        }

        .alert-item.medium {
            background: #f0f9f0;
            border-left-color: #f39c12;
        }

        .alert-item.low {
            background: #f8f9fa;
            border-left-color: #3498db;
        }

        .alert-title {
            font-weight: bold;
            margin-bottom: 0.25rem;
        }

        .alert-time {
            font-size: 0.8rem;
            color: #7f8c8d;
        }

        .refresh-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-left: 1rem;
        }

        .refresh-btn:hover {
            background: #2980b9;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #7f8c8d;
        }

        .error {
            background: #fdf2f2;
            color: #e74c3c;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Semantest Monitoring Dashboard</h1>
        <div class="timestamp">Last updated: <span id="last-update">Loading...</span></div>
        <button class="refresh-btn" onclick="refreshData()">Refresh</button>
    </div>

    <div class="container">
        <div id="loading" class="loading">Loading monitoring data...</div>
        <div id="error" class="error" style="display: none;">Failed to load data. Please try again.</div>
        
        <div id="dashboard" style="display: none;">
            <!-- System Overview -->
            <div class="grid">
                <div class="card" id="system-card">
                    <h3>System Overview</h3>
                    <div id="system-metrics"></div>
                </div>

                <div class="card" id="business-card">
                    <h3>Business Metrics</h3>
                    <div id="business-metrics"></div>
                </div>

                <div class="card" id="alerts-card">
                    <h3>Active Alerts</h3>
                    <div id="alerts-summary"></div>
                </div>

                <div class="card" id="health-card">
                    <h3>Service Health</h3>
                    <div id="health-status"></div>
                </div>
            </div>

            <!-- Detailed Metrics -->
            <div class="grid">
                <div class="card">
                    <h3>Performance Metrics</h3>
                    <div id="performance-metrics"></div>
                </div>

                <div class="card">
                    <h3>Recent Alerts</h3>
                    <div id="recent-alerts" class="alert-list"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let dashboardData = null;
        let alertsData = null;
        let healthData = null;
        let updateInterval = null;

        // Auto-refresh every 30 seconds
        function startAutoRefresh() {
            updateInterval = setInterval(refreshData, 30000);
        }

        function stopAutoRefresh() {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        }

        async function refreshData() {
            try {
                document.getElementById('last-update').textContent = 'Refreshing...';
                
                // Fetch all data
                const [overviewResponse, alertsResponse, healthResponse] = await Promise.all([
                    fetch('/dashboard/api/overview'),
                    fetch('/dashboard/api/alerts'),
                    fetch('/dashboard/api/health')
                ]);

                if (!overviewResponse.ok || !alertsResponse.ok || !healthResponse.ok) {
                    throw new Error('Failed to fetch data');
                }

                dashboardData = await overviewResponse.json();
                alertsData = await alertsResponse.json();
                healthData = await healthResponse.json();

                updateDashboard();
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
                document.getElementById('last-update').textContent = new Date().toLocaleString();
                
            } catch (error) {
                console.error('Error refreshing data:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('last-update').textContent = 'Error';
            }
        }

        function updateDashboard() {
            updateSystemMetrics();
            updateBusinessMetrics();
            updateAlertsCard();
            updateHealthCard();
            updatePerformanceMetrics();
            updateRecentAlerts();
        }

        function updateSystemMetrics() {
            const container = document.getElementById('system-metrics');
            const card = document.getElementById('system-card');
            
            if (!dashboardData || !dashboardData.system) return;
            
            const system = dashboardData.system;
            const memoryUsage = (system.memory.usage * 100).toFixed(1);
            const cpuUsage = (system.cpu.usage * 100).toFixed(1);
            const uptime = formatUptime(system.uptime);

            // Update card color based on status
            card.className = 'card ' + (system.status === 'healthy' ? 'success' : 
                                     system.status === 'degraded' ? 'warning' : 'critical');

            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span class="metric-value">
                        <span class="status-indicator status-\${system.status}"></span>
                        \${system.status}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">\${uptime}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">CPU Usage</span>
                    <span class="metric-value \${cpuUsage > 80 ? 'critical' : cpuUsage > 60 ? 'warning' : 'success'}">\${cpuUsage}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory Usage</span>
                    <span class="metric-value \${memoryUsage > 85 ? 'critical' : memoryUsage > 70 ? 'warning' : 'success'}">\${memoryUsage}%</span>
                </div>
            \`;
        }

        function updateBusinessMetrics() {
            const container = document.getElementById('business-metrics');
            
            if (!dashboardData || !dashboardData.business) return;
            
            const business = dashboardData.business;
            const errorRate = (business.errorRate * 100).toFixed(2);
            const avgResponseTime = business.avgResponseTime.toFixed(0);

            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Active Connections</span>
                    <span class="metric-value">\${business.activeConnections}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value">\${business.totalRequests}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value \${business.errorRate > 0.05 ? 'critical' : business.errorRate > 0.02 ? 'warning' : 'success'}">\${errorRate}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Response Time</span>
                    <span class="metric-value \${avgResponseTime > 1000 ? 'critical' : avgResponseTime > 500 ? 'warning' : 'success'}">\${avgResponseTime}ms</span>
                </div>
            \`;
        }

        function updateAlertsCard() {
            const container = document.getElementById('alerts-summary');
            const card = document.getElementById('alerts-card');
            
            if (!dashboardData || !dashboardData.alerts) return;
            
            const alerts = dashboardData.alerts;
            
            // Update card color based on alerts
            card.className = 'card ' + (alerts.critical > 0 ? 'critical' : 
                                       alerts.high > 0 ? 'warning' : 'success');

            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Active Alerts</span>
                    <span class="metric-value \${alerts.active > 0 ? 'warning' : 'success'}">\${alerts.active}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Critical</span>
                    <span class="metric-value \${alerts.critical > 0 ? 'critical' : 'success'}">\${alerts.critical}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">High</span>
                    <span class="metric-value \${alerts.high > 0 ? 'warning' : 'success'}">\${alerts.high}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total</span>
                    <span class="metric-value">\${alerts.total}</span>
                </div>
            \`;
        }

        function updateHealthCard() {
            const container = document.getElementById('health-status');
            
            if (!healthData) return;
            
            const servicesHealthy = Object.values(healthData.services || {})
                .filter(s => s.status === 'healthy').length;
            const totalServices = Object.keys(healthData.services || {}).length;

            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Overall Status</span>
                    <span class="metric-value">
                        <span class="status-indicator status-\${healthData.overall}"></span>
                        \${healthData.overall}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Services</span>
                    <span class="metric-value">\${servicesHealthy}/\${totalServices}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Version</span>
                    <span class="metric-value">\${healthData.version}</span>
                </div>
            \`;
        }

        function updatePerformanceMetrics() {
            const container = document.getElementById('performance-metrics');
            
            if (!dashboardData) return;
            
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Services</span>
                    <span class="metric-value">\${dashboardData.services}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Dependencies</span>
                    <span class="metric-value">\${dashboardData.dependencies}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Last Updated</span>
                    <span class="metric-value">\${new Date(dashboardData.timestamp).toLocaleTimeString()}</span>
                </div>
            \`;
        }

        function updateRecentAlerts() {
            const container = document.getElementById('recent-alerts');
            
            if (!alertsData || !alertsData.recentAlerts) return;
            
            if (alertsData.recentAlerts.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;">No recent alerts</div>';
                return;
            }
            
            const alertsHtml = alertsData.recentAlerts.map(alert => \`
                <div class="alert-item \${alert.severity}">
                    <div class="alert-title">\${alert.title}</div>
                    <div>\${alert.message}</div>
                    <div class="alert-time">\${new Date(alert.timestamp).toLocaleString()}</div>
                </div>
            \`).join('');
            
            container.innerHTML = alertsHtml;
        }

        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (days > 0) {
                return \`\${days}d \${hours}h \${minutes}m\`;
            } else if (hours > 0) {
                return \`\${hours}h \${minutes}m\`;
            } else {
                return \`\${minutes}m\`;
            }
        }

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            refreshData();
            startAutoRefresh();
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', function() {
            stopAutoRefresh();
        });
    </script>
</body>
</html>
    `;
    }
}
exports.MetricsDashboard = MetricsDashboard;
/**
 * Default dashboard instance
 */
exports.metricsDashboard = new MetricsDashboard();
//# sourceMappingURL=metrics-dashboard.js.map