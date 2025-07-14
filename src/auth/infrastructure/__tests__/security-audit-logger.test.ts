/**
 * Tests for Security Audit Logger
 */

import fs from 'fs/promises';
import path from 'path';
import { FileSecurityAuditLogger, ConsoleSecurityAuditLogger } from '../security-audit-logger';
import { SecurityEvent, AnomalousActivity } from '../jwt-security-enhancements';

// Mock fs module
jest.mock('fs/promises');

describe('Security Audit Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('FileSecurityAuditLogger', () => {
    let logger: FileSecurityAuditLogger;
    const testLogDir = '/tmp/test-logs/security';

    beforeEach(() => {
      logger = new FileSecurityAuditLogger({
        logDir: testLogDir,
        rotationSize: 1024, // 1KB for testing
        maxFiles: 3
      });
      
      // Mock file system operations
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 0 });
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      (fs.readFile as jest.Mock).mockResolvedValue('');
    });

    describe('logAuthEvent', () => {
      it('should log auth events to file', async () => {
        const event: SecurityEvent = {
          type: 'login',
          userId: 'user123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date('2025-01-14T12:00:00Z'),
          details: { success: true }
        };

        await logger.logAuthEvent(event);

        expect(fs.mkdir).toHaveBeenCalledWith(testLogDir, { recursive: true });
        expect(fs.appendFile).toHaveBeenCalledWith(
          expect.stringContaining('auth-events-'),
          expect.stringContaining('"type":"login"'),
          'utf8'
        );
      });

      it('should include environment info in logs', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const event: SecurityEvent = {
          type: 'logout',
          userId: 'user123',
          ip: '192.168.1.1',
          timestamp: new Date(),
          details: {}
        };

        await logger.logAuthEvent(event);

        const logCall = (fs.appendFile as jest.Mock).mock.calls[0];
        const logContent = logCall[1];
        
        expect(logContent).toContain('"environment":"production"');
        expect(logContent).toContain('"service":"semantest-auth"');
        
        process.env.NODE_ENV = originalEnv;
      });

      it('should handle file write errors gracefully', async () => {
        (fs.appendFile as jest.Mock).mockRejectedValue(new Error('Disk full'));

        const event: SecurityEvent = {
          type: 'access_denied',
          ip: '192.168.1.1',
          timestamp: new Date(),
          details: { reason: 'invalid_token' }
        };

        await logger.logAuthEvent(event);

        expect(console.error).toHaveBeenCalledWith(
          'Failed to write security log:',
          expect.any(Error)
        );
      });
    });

    describe('logAnomalousActivity', () => {
      it('should log high severity anomalies with alert', async () => {
        const activity: AnomalousActivity = {
          type: 'token_reuse',
          userId: 'user123',
          severity: 'high',
          details: { tokenId: 'token123' }
        };

        await logger.logAnomalousActivity(activity);

        expect(fs.appendFile).toHaveBeenCalledWith(
          expect.stringContaining('anomalies-'),
          expect.stringContaining('"alert":true'),
          'utf8'
        );
        expect(console.error).toHaveBeenCalledWith(
          '[SECURITY-ALERT] token_reuse:',
          expect.objectContaining({ severity: 'high' })
        );
      });

      it('should log critical anomalies', async () => {
        const activity: AnomalousActivity = {
          type: 'multiple_ips',
          userId: 'user123',
          severity: 'critical',
          details: { ips: ['192.168.1.1', '10.0.0.1'] }
        };

        await logger.logAnomalousActivity(activity);

        expect(console.error).toHaveBeenCalledWith(
          '[SECURITY-ALERT] multiple_ips:',
          expect.objectContaining({ severity: 'critical' })
        );
      });

      it('should not alert on low severity anomalies', async () => {
        const activity: AnomalousActivity = {
          type: 'unusual_pattern',
          userId: 'user123',
          severity: 'low',
          details: {}
        };

        await logger.logAnomalousActivity(activity);

        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe('Log rotation', () => {
      it('should rotate logs when size exceeds limit', async () => {
        (fs.stat as jest.Mock).mockResolvedValue({ size: 2048 }); // Over 1KB limit
        (fs.rename as jest.Mock).mockResolvedValue(undefined);

        const event: SecurityEvent = {
          type: 'login',
          userId: 'user123',
          ip: '192.168.1.1',
          timestamp: new Date(),
          details: {}
        };

        await logger.logAuthEvent(event);

        expect(fs.rename).toHaveBeenCalled();
      });

      it('should handle rotation with existing rotated files', async () => {
        (fs.stat as jest.Mock).mockResolvedValue({ size: 2048 });
        (fs.access as jest.Mock)
          .mockResolvedValueOnce(undefined) // File exists
          .mockRejectedValue(new Error('Not found')); // Next file doesn't exist
        (fs.rename as jest.Mock).mockResolvedValue(undefined);

        const event: SecurityEvent = {
          type: 'login',
          userId: 'user123',
          ip: '192.168.1.1',
          timestamp: new Date(),
          details: {}
        };

        await logger.logAuthEvent(event);

        expect(fs.rename).toHaveBeenCalled();
      });
    });

    describe('Query logs', () => {
      it('should query logs with filters', async () => {
        const logContent = [
          JSON.stringify({
            type: 'login',
            userId: 'user123',
            timestamp: '2025-01-14T12:00:00Z'
          }),
          JSON.stringify({
            type: 'logout',
            userId: 'user456',
            timestamp: '2025-01-14T13:00:00Z'
          })
        ].join('\n');

        (fs.readdir as jest.Mock).mockResolvedValue(['auth-events-2025-01-14.log']);
        (fs.readFile as jest.Mock).mockResolvedValue(logContent);

        const results = await logger.queryLogs({
          category: 'auth-events',
          userId: 'user123'
        });

        expect(results).toHaveLength(1);
        expect(results[0].userId).toBe('user123');
      });

      it('should apply date filters', async () => {
        const logs = [
          { type: 'login', timestamp: '2025-01-14T10:00:00Z' },
          { type: 'login', timestamp: '2025-01-14T14:00:00Z' },
          { type: 'login', timestamp: '2025-01-14T18:00:00Z' }
        ];

        (fs.readdir as jest.Mock).mockResolvedValue(['auth-events-2025-01-14.log']);
        (fs.readFile as jest.Mock).mockResolvedValue(
          logs.map(l => JSON.stringify(l)).join('\n')
        );

        const results = await logger.queryLogs({
          category: 'auth-events',
          startDate: new Date('2025-01-14T12:00:00Z'),
          endDate: new Date('2025-01-14T16:00:00Z')
        });

        expect(results).toHaveLength(1);
        expect(results[0].timestamp).toBe('2025-01-14T14:00:00Z');
      });

      it('should handle query errors', async () => {
        (fs.readdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        const results = await logger.queryLogs({
          category: 'auth-events'
        });

        expect(results).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
          'Failed to query logs:',
          expect.any(Error)
        );
      });
    });

    describe('Generate security report', () => {
      it('should generate daily security report', async () => {
        const authEvents = [
          { type: 'login', userId: 'user1', ip: '192.168.1.1' },
          { type: 'login', userId: 'user2', ip: '192.168.1.2' },
          { type: 'access_denied', userId: 'user1', ip: '192.168.1.1' },
          { type: 'access_denied', userId: 'user3', ip: '10.0.0.1' }
        ];

        const anomalies = [
          { type: 'multiple_ips', severity: 'high', userId: 'user1' },
          { type: 'rapid_requests', severity: 'medium', userId: 'user2' }
        ];

        (fs.readdir as jest.Mock).mockResolvedValue([
          'auth-events-2025-01-14.log',
          'anomalies-2025-01-14.log'
        ]);
        
        (fs.readFile as jest.Mock)
          .mockResolvedValueOnce(authEvents.map(e => JSON.stringify(e)).join('\n'))
          .mockResolvedValueOnce(anomalies.map(a => JSON.stringify(a)).join('\n'));

        const report = await logger.generateSecurityReport(new Date('2025-01-14'));

        expect(report.summary.totalEvents).toBe(4);
        expect(report.summary.totalAnomalies).toBe(2);
        expect(report.summary.uniqueUsers).toBe(3);
        expect(report.summary.uniqueIPs).toBe(3);
        expect(report.topEvents[0]).toEqual({ type: 'login', count: 2 });
        expect(report.topEvents[1]).toEqual({ type: 'access_denied', count: 2 });
        expect(report.anomalies).toHaveLength(1); // Only high severity
        expect(report.recommendations).toContain(
          'High severity anomalies detected - review and investigate immediately'
        );
      });

      it('should generate recommendations based on activity', async () => {
        const events = Array(150).fill({
          type: 'access_denied',
          ip: '192.168.1.1'
        });

        (fs.readdir as jest.Mock).mockResolvedValue(['auth-events-2025-01-14.log']);
        (fs.readFile as jest.Mock).mockResolvedValue(
          events.map(e => JSON.stringify(e)).join('\n')
        );

        const report = await logger.generateSecurityReport(new Date('2025-01-14'));

        expect(report.recommendations).toContain(
          'High number of failed login attempts - consider implementing stricter rate limiting'
        );
      });
    });
  });

  describe('ConsoleSecurityAuditLogger', () => {
    let logger: ConsoleSecurityAuditLogger;

    beforeEach(() => {
      logger = new ConsoleSecurityAuditLogger();
    });

    it('should log auth events to console with emoji', async () => {
      const event: SecurityEvent = {
        type: 'suspicious_activity',
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Chrome/96.0',
        timestamp: new Date(),
        details: { reason: 'ip_mismatch' }
      };

      await logger.logAuthEvent(event);

      expect(console.log).toHaveBeenCalledWith(
        '🚨 [AUTH-SUSPICIOUS_ACTIVITY]',
        expect.objectContaining({
          userId: 'user123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Chrome/96.0',
          details: { reason: 'ip_mismatch' }
        })
      );
    });

    it('should truncate long user agents', async () => {
      const event: SecurityEvent = {
        type: 'login',
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'A'.repeat(100),
        timestamp: new Date(),
        details: {}
      };

      await logger.logAuthEvent(event);

      const logCall = (console.log as jest.Mock).mock.calls[0];
      const loggedData = logCall[1];
      
      expect(loggedData.userAgent).toHaveLength(50);
    });

    it('should log anomalous activity with severity emoji', async () => {
      const criticalActivity: AnomalousActivity = {
        type: 'token_reuse',
        userId: 'user123',
        severity: 'critical',
        details: { attempts: 5 }
      };

      await logger.logAnomalousActivity(criticalActivity);

      expect(console.log).toHaveBeenCalledWith(
        '🚨🚨🚨 [ANOMALY-TOKEN_REUSE]',
        expect.objectContaining({ severity: 'critical' })
      );

      jest.clearAllMocks();

      const mediumActivity: AnomalousActivity = {
        type: 'unusual_pattern',
        userId: 'user456',
        severity: 'medium',
        details: {}
      };

      await logger.logAnomalousActivity(mediumActivity);

      expect(console.log).toHaveBeenCalledWith(
        '⚠️ [ANOMALY-UNUSUAL_PATTERN]',
        expect.anything()
      );
    });
  });
});