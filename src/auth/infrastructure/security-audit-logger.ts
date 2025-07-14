/**
 * Security Audit Logger Implementation
 * Provides comprehensive logging for security events
 */

import fs from 'fs/promises';
import path from 'path';
import { SecurityAuditLogger, SecurityEvent, AnomalousActivity } from './jwt-security-enhancements';

/**
 * File-based security audit logger
 * In production, this should be replaced with a proper logging service
 * like ELK stack, Splunk, or cloud logging services
 */
export class FileSecurityAuditLogger implements SecurityAuditLogger {
  private logDir: string;
  private rotationSize: number;
  private maxFiles: number;

  constructor(options: {
    logDir?: string;
    rotationSize?: number; // bytes
    maxFiles?: number;
  } = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs', 'security');
    this.rotationSize = options.rotationSize || 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles || 10;
    
    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  async logAuthEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: event.timestamp.toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'semantest-auth',
      version: process.env.npm_package_version || '1.0.0'
    };

    await this.writeLog('auth-events', logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH-${event.type.toUpperCase()}]`, logEntry);
    }
  }

  async logAnomalousActivity(activity: AnomalousActivity): Promise<void> {
    const logEntry = {
      ...activity,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      service: 'semantest-auth',
      alert: activity.severity === 'high' || activity.severity === 'critical'
    };

    await this.writeLog('anomalies', logEntry);
    
    // Alert on high/critical anomalies
    if (activity.severity === 'high' || activity.severity === 'critical') {
      console.error(`[SECURITY-ALERT] ${activity.type}:`, logEntry);
      // In production, this would trigger alerts (PagerDuty, email, etc.)
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private async writeLog(category: string, entry: any): Promise<void> {
    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const filename = `${category}-${dateStr}.log`;
      const filepath = path.join(this.logDir, filename);
      
      // Check file size for rotation
      await this.rotateIfNeeded(filepath, category, dateStr);
      
      // Append log entry
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(filepath, logLine, 'utf8');
      
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  private async rotateIfNeeded(filepath: string, category: string, dateStr: string): Promise<void> {
    try {
      const stats = await fs.stat(filepath);
      
      if (stats.size >= this.rotationSize) {
        // Find next available rotation number
        let rotationNum = 1;
        let rotatedPath: string;
        
        do {
          rotatedPath = path.join(this.logDir, `${category}-${dateStr}.${rotationNum}.log`);
          rotationNum++;
        } while (await this.fileExists(rotatedPath) && rotationNum <= this.maxFiles);
        
        if (rotationNum > this.maxFiles) {
          // Delete oldest file
          const oldestPath = path.join(this.logDir, `${category}-${dateStr}.1.log`);
          await fs.unlink(oldestPath).catch(() => {});
          
          // Shift all files down
          for (let i = 2; i < this.maxFiles; i++) {
            const oldPath = path.join(this.logDir, `${category}-${dateStr}.${i}.log`);
            const newPath = path.join(this.logDir, `${category}-${dateStr}.${i-1}.log`);
            await fs.rename(oldPath, newPath).catch(() => {});
          }
          
          rotatedPath = path.join(this.logDir, `${category}-${dateStr}.${this.maxFiles-1}.log`);
        }
        
        // Rotate current file
        await fs.rename(filepath, rotatedPath);
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
    }
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Query logs for analysis
   */
  async queryLogs(options: {
    category: 'auth-events' | 'anomalies';
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<any[]> {
    const results: any[] = [];
    const { category, startDate, endDate, userId, eventType, limit = 1000 } = options;
    
    try {
      const files = await fs.readdir(this.logDir);
      const categoryFiles = files
        .filter(f => f.startsWith(category))
        .sort()
        .reverse(); // Most recent first
      
      for (const file of categoryFiles) {
        if (results.length >= limit) break;
        
        const filepath = path.join(this.logDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (results.length >= limit) break;
          
          try {
            const entry = JSON.parse(line);
            
            // Apply filters
            if (startDate && new Date(entry.timestamp) < startDate) continue;
            if (endDate && new Date(entry.timestamp) > endDate) continue;
            if (userId && entry.userId !== userId) continue;
            if (eventType && entry.type !== eventType) continue;
            
            results.push(entry);
          } catch {
            // Skip malformed lines
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to query logs:', error);
    }
    
    return results;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(date: Date = new Date()): Promise<{
    summary: any;
    topEvents: any[];
    anomalies: any[];
    recommendations: string[];
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Query events for the day
    const authEvents = await this.queryLogs({
      category: 'auth-events',
      startDate: startOfDay,
      endDate: endOfDay
    });
    
    const anomalies = await this.queryLogs({
      category: 'anomalies',
      startDate: startOfDay,
      endDate: endOfDay
    });
    
    // Calculate summary statistics
    const eventCounts: Record<string, number> = {};
    const userActivity: Record<string, number> = {};
    const ipActivity: Record<string, number> = {};
    
    authEvents.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      if (event.userId) {
        userActivity[event.userId] = (userActivity[event.userId] || 0) + 1;
      }
      if (event.ip) {
        ipActivity[event.ip] = (ipActivity[event.ip] || 0) + 1;
      }
    });
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (anomalies.filter(a => a.severity === 'high' || a.severity === 'critical').length > 0) {
      recommendations.push('High severity anomalies detected - review and investigate immediately');
    }
    
    const failedLogins = eventCounts['access_denied'] || 0;
    if (failedLogins > 100) {
      recommendations.push('High number of failed login attempts - consider implementing stricter rate limiting');
    }
    
    const suspiciousActivities = eventCounts['suspicious_activity'] || 0;
    if (suspiciousActivities > 10) {
      recommendations.push('Multiple suspicious activities detected - review security policies');
    }
    
    return {
      summary: {
        date: date.toISOString().split('T')[0],
        totalEvents: authEvents.length,
        totalAnomalies: anomalies.length,
        eventTypes: eventCounts,
        uniqueUsers: Object.keys(userActivity).length,
        uniqueIPs: Object.keys(ipActivity).length
      },
      topEvents: Object.entries(eventCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([type, count]) => ({ type, count })),
      anomalies: anomalies
        .filter(a => a.severity === 'high' || a.severity === 'critical')
        .slice(0, 10),
      recommendations
    };
  }
}

/**
 * Console-based security audit logger for development
 */
export class ConsoleSecurityAuditLogger implements SecurityAuditLogger {
  async logAuthEvent(event: SecurityEvent): Promise<void> {
    const prefix = event.type === 'suspicious_activity' ? '🚨' : '🔒';
    console.log(`${prefix} [AUTH-${event.type.toUpperCase()}]`, {
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent?.substring(0, 50),
      details: event.details
    });
  }

  async logAnomalousActivity(activity: AnomalousActivity): Promise<void> {
    const prefix = activity.severity === 'critical' ? '🚨🚨🚨' : 
                   activity.severity === 'high' ? '🚨🚨' : 
                   activity.severity === 'medium' ? '⚠️' : 'ℹ️';
    
    console.log(`${prefix} [ANOMALY-${activity.type.toUpperCase()}]`, {
      userId: activity.userId,
      severity: activity.severity,
      details: activity.details
    });
  }
}