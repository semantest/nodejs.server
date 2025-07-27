/**
 * Tests for Enterprise Security Module
 * Testing security initialization and route setup
 */

import { initializeEnterpriseSecurityModule, shutdownEnterpriseSecurityModule } from '../index';
import { Express } from 'express';
import { incidentResponseService } from '../incident-response.service';
import { complianceFrameworkService } from '../compliance-framework.service';
import { vulnerabilityScanner } from '../vulnerability-scanner.service';
import { logger } from '../../monitoring/infrastructure/structured-logger';

// Mock all dependencies
jest.mock('../incident-response.service');
jest.mock('../compliance-framework.service');
jest.mock('../vulnerability-scanner.service');
jest.mock('../../monitoring/infrastructure/structured-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Enterprise Security Module', () => {
  let mockApp: Express;
  let routes: Map<string, any[]>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Express app
    routes = new Map();
    mockApp = {
      get: jest.fn((path: string, ...handlers: any[]) => {
        routes.set(`GET ${path}`, handlers);
      }),
      post: jest.fn((path: string, ...handlers: any[]) => {
        routes.set(`POST ${path}`, handlers);
      }),
      put: jest.fn((path: string, ...handlers: any[]) => {
        routes.set(`PUT ${path}`, handlers);
      }),
      delete: jest.fn((path: string, ...handlers: any[]) => {
        routes.set(`DELETE ${path}`, handlers);
      })
    } as any;

    // Setup default mock implementations
    (incidentResponseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (complianceFrameworkService.initialize as jest.Mock).mockResolvedValue(undefined);
    (vulnerabilityScanner.initialize as jest.Mock).mockResolvedValue(undefined);
    
    (incidentResponseService.shutdown as jest.Mock).mockResolvedValue(undefined);
    (complianceFrameworkService.shutdown as jest.Mock).mockResolvedValue(undefined);
    (vulnerabilityScanner.shutdown as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initializeEnterpriseSecurityModule', () => {
    it('should initialize all security services', async () => {
      await initializeEnterpriseSecurityModule(mockApp);

      expect(incidentResponseService.initialize).toHaveBeenCalled();
      expect(complianceFrameworkService.initialize).toHaveBeenCalled();
      expect(vulnerabilityScanner.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Initializing enterprise security module');
      expect(logger.info).toHaveBeenCalledWith('Enterprise security module initialized successfully');
    });

    it('should setup security routes', async () => {
      await initializeEnterpriseSecurityModule(mockApp);

      // Check incident response routes
      expect(routes.has('GET /api/security/incidents')).toBe(true);
      expect(routes.has('GET /api/security/incidents/:id')).toBe(true);
      expect(routes.has('PUT /api/security/incidents/:id')).toBe(true);
      expect(routes.has('POST /api/security/incidents/:id/actions')).toBe(true);
      expect(routes.has('GET /api/security/dashboard')).toBe(true);

      // Check compliance routes
      expect(routes.has('GET /api/compliance/metrics')).toBe(true);
      expect(routes.has('POST /api/compliance/assessments')).toBe(true);
      expect(routes.has('GET /api/compliance/reports')).toBe(true);
      expect(routes.has('GET /api/compliance/reports/:id')).toBe(true);
      expect(routes.has('GET /api/compliance/findings')).toBe(true);
      expect(routes.has('PUT /api/compliance/findings/:id')).toBe(true);

      // Check vulnerability scanner routes
      expect(routes.has('POST /api/security/scans')).toBe(true);
      expect(routes.has('GET /api/security/scans')).toBe(true);
      expect(routes.has('GET /api/security/scans/:id')).toBe(true);
      expect(routes.has('GET /api/security/vulnerabilities')).toBe(true);
      expect(routes.has('GET /api/security/vulnerabilities/:id')).toBe(true);
      expect(routes.has('PUT /api/security/vulnerabilities/:id')).toBe(true);
      expect(routes.has('POST /api/security/reports')).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      (incidentResponseService.initialize as jest.Mock).mockRejectedValue(error);

      await expect(initializeEnterpriseSecurityModule(mockApp)).rejects.toThrow('Init failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize enterprise security module', error);
    });
  });

  describe('Security Route Handlers', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(async () => {
      mockReq = {
        query: {},
        params: {},
        body: {}
      };
      mockRes = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis()
      };

      await initializeEnterpriseSecurityModule(mockApp);
    });

    describe('Incident Response Routes', () => {
      it('should handle GET /api/security/incidents', async () => {
        const mockIncidents = [{ id: '1', name: 'Incident 1' }];
        (incidentResponseService.listIncidents as jest.Mock).mockReturnValue(mockIncidents);

        const handler = routes.get('GET /api/security/incidents')![0];
        await handler(mockReq, mockRes);

        expect(incidentResponseService.listIncidents).toHaveBeenCalledWith({});
        expect(mockRes.json).toHaveBeenCalledWith(mockIncidents);
      });

      it('should handle GET /api/security/incidents/:id', async () => {
        const mockIncident = { id: '123', name: 'Test Incident' };
        mockReq.params.id = '123';
        (incidentResponseService.getIncident as jest.Mock).mockReturnValue(mockIncident);

        const handler = routes.get('GET /api/security/incidents/:id')![0];
        await handler(mockReq, mockRes);

        expect(incidentResponseService.getIncident).toHaveBeenCalledWith('123');
        expect(mockRes.json).toHaveBeenCalledWith(mockIncident);
      });

      it('should return 404 for non-existent incident', async () => {
        mockReq.params.id = 'non-existent';
        (incidentResponseService.getIncident as jest.Mock).mockReturnValue(null);

        const handler = routes.get('GET /api/security/incidents/:id')![0];
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Incident not found' });
      });

      it('should handle PUT /api/security/incidents/:id', async () => {
        const mockUpdated = { id: '123', status: 'resolved' };
        mockReq.params.id = '123';
        mockReq.body = { status: 'resolved', updatedBy: 'user1' };
        (incidentResponseService.updateIncident as jest.Mock).mockResolvedValue(mockUpdated);

        const handler = routes.get('PUT /api/security/incidents/:id')![0];
        await handler(mockReq, mockRes);

        expect(incidentResponseService.updateIncident).toHaveBeenCalledWith(
          '123',
          { status: 'resolved' },
          'user1'
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
      });

      it('should handle POST /api/security/incidents/:id/actions', async () => {
        const mockAction = { id: 'action1', type: 'block_ip' };
        mockReq.params.id = '123';
        mockReq.body = {
          actionType: 'block_ip',
          parameters: { ip: '1.2.3.4' },
          executedBy: 'user1'
        };
        (incidentResponseService.executeAction as jest.Mock).mockResolvedValue(mockAction);

        const handler = routes.get('POST /api/security/incidents/:id/actions')![0];
        await handler(mockReq, mockRes);

        expect(incidentResponseService.executeAction).toHaveBeenCalledWith(
          '123',
          'block_ip',
          { ip: '1.2.3.4' },
          'user1'
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockAction);
      });

      it('should handle GET /api/security/dashboard', async () => {
        const mockDashboard = { activeIncidents: 5, resolvedToday: 10 };
        (incidentResponseService.getDashboard as jest.Mock).mockReturnValue(mockDashboard);

        const handler = routes.get('GET /api/security/dashboard')![0];
        await handler(mockReq, mockRes);

        expect(incidentResponseService.getDashboard).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(mockDashboard);
      });

      it('should handle incident route errors', async () => {
        const error = new Error('Database error');
        (incidentResponseService.listIncidents as jest.Mock).mockImplementation(() => {
          throw error;
        });

        const handler = routes.get('GET /api/security/incidents')![0];
        await handler(mockReq, mockRes);

        expect(logger.error).toHaveBeenCalledWith('Failed to list incidents', error);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
      });
    });

    describe('Compliance Routes', () => {
      it('should handle GET /api/compliance/metrics', async () => {
        const mockMetrics = { overallScore: 85, frameworks: 3 };
        (complianceFrameworkService.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

        const handler = routes.get('GET /api/compliance/metrics')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.getMetrics).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(mockMetrics);
      });

      it('should handle POST /api/compliance/assessments', async () => {
        const mockReport = { id: 'report1', score: 90 };
        mockReq.body = { frameworkId: 'iso27001', triggeredBy: 'user1' };
        (complianceFrameworkService.runAssessment as jest.Mock).mockResolvedValue(mockReport);

        const handler = routes.get('POST /api/compliance/assessments')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.runAssessment).toHaveBeenCalledWith(
          'iso27001',
          'user1'
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockReport);
      });

      it('should handle GET /api/compliance/reports', async () => {
        const mockReports = [{ id: 'report1' }, { id: 'report2' }];
        mockReq.query = { framework: 'gdpr' };
        (complianceFrameworkService.listReports as jest.Mock).mockReturnValue(mockReports);

        const handler = routes.get('GET /api/compliance/reports')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.listReports).toHaveBeenCalledWith({ framework: 'gdpr' });
        expect(mockRes.json).toHaveBeenCalledWith(mockReports);
      });

      it('should handle GET /api/compliance/reports/:id', async () => {
        const mockReport = { id: 'report1', framework: 'gdpr' };
        mockReq.params.id = 'report1';
        (complianceFrameworkService.getReport as jest.Mock).mockReturnValue(mockReport);

        const handler = routes.get('GET /api/compliance/reports/:id')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.getReport).toHaveBeenCalledWith('report1');
        expect(mockRes.json).toHaveBeenCalledWith(mockReport);
      });

      it('should return 404 for non-existent report', async () => {
        mockReq.params.id = 'non-existent';
        (complianceFrameworkService.getReport as jest.Mock).mockReturnValue(null);

        const handler = routes.get('GET /api/compliance/reports/:id')![0];
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Report not found' });
      });

      it('should handle GET /api/compliance/findings', async () => {
        const mockFindings = [{ id: 'finding1', severity: 'high' }];
        mockReq.query = { status: 'open' };
        (complianceFrameworkService.getFindings as jest.Mock).mockReturnValue(mockFindings);

        const handler = routes.get('GET /api/compliance/findings')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.getFindings).toHaveBeenCalledWith({ status: 'open' });
        expect(mockRes.json).toHaveBeenCalledWith(mockFindings);
      });

      it('should handle PUT /api/compliance/findings/:id', async () => {
        const mockUpdated = { id: 'finding1', status: 'resolved' };
        mockReq.params.id = 'finding1';
        mockReq.body = { status: 'resolved', updatedBy: 'user1' };
        (complianceFrameworkService.updateFinding as jest.Mock).mockResolvedValue(mockUpdated);

        const handler = routes.get('PUT /api/compliance/findings/:id')![0];
        await handler(mockReq, mockRes);

        expect(complianceFrameworkService.updateFinding).toHaveBeenCalledWith(
          'finding1',
          { status: 'resolved' },
          'user1'
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
      });
    });

    describe('Vulnerability Scanner Routes', () => {
      it('should handle POST /api/security/scans', async () => {
        const mockScan = { id: 'scan1', status: 'running' };
        mockReq.body = { configurationId: 'config1', triggeredBy: 'user1' };
        (vulnerabilityScanner.startScan as jest.Mock).mockResolvedValue(mockScan);

        const handler = routes.get('POST /api/security/scans')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.startScan).toHaveBeenCalledWith('config1', 'user1');
        expect(mockRes.json).toHaveBeenCalledWith(mockScan);
      });

      it('should handle GET /api/security/scans', async () => {
        const mockScans = [{ id: 'scan1' }, { id: 'scan2' }];
        mockReq.query = { status: 'completed' };
        (vulnerabilityScanner.listScanResults as jest.Mock).mockReturnValue(mockScans);

        const handler = routes.get('GET /api/security/scans')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.listScanResults).toHaveBeenCalledWith({ status: 'completed' });
        expect(mockRes.json).toHaveBeenCalledWith(mockScans);
      });

      it('should handle GET /api/security/scans/:id', async () => {
        const mockScan = { id: 'scan1', status: 'completed' };
        mockReq.params.id = 'scan1';
        (vulnerabilityScanner.getScanResult as jest.Mock).mockReturnValue(mockScan);

        const handler = routes.get('GET /api/security/scans/:id')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.getScanResult).toHaveBeenCalledWith('scan1');
        expect(mockRes.json).toHaveBeenCalledWith(mockScan);
      });

      it('should return 404 for non-existent scan', async () => {
        mockReq.params.id = 'non-existent';
        (vulnerabilityScanner.getScanResult as jest.Mock).mockReturnValue(null);

        const handler = routes.get('GET /api/security/scans/:id')![0];
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Scan not found' });
      });

      it('should handle GET /api/security/vulnerabilities', async () => {
        const mockVulns = [{ id: 'vuln1', severity: 'critical' }];
        mockReq.query = { severity: 'critical' };
        (vulnerabilityScanner.listVulnerabilities as jest.Mock).mockReturnValue(mockVulns);

        const handler = routes.get('GET /api/security/vulnerabilities')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.listVulnerabilities).toHaveBeenCalledWith({ severity: 'critical' });
        expect(mockRes.json).toHaveBeenCalledWith(mockVulns);
      });

      it('should handle GET /api/security/vulnerabilities/:id', async () => {
        const mockVuln = { id: 'vuln1', severity: 'critical' };
        mockReq.params.id = 'vuln1';
        (vulnerabilityScanner.getVulnerability as jest.Mock).mockReturnValue(mockVuln);

        const handler = routes.get('GET /api/security/vulnerabilities/:id')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.getVulnerability).toHaveBeenCalledWith('vuln1');
        expect(mockRes.json).toHaveBeenCalledWith(mockVuln);
      });

      it('should return 404 for non-existent vulnerability', async () => {
        mockReq.params.id = 'non-existent';
        (vulnerabilityScanner.getVulnerability as jest.Mock).mockReturnValue(null);

        const handler = routes.get('GET /api/security/vulnerabilities/:id')![0];
        await handler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Vulnerability not found' });
      });

      it('should handle PUT /api/security/vulnerabilities/:id', async () => {
        const mockUpdated = { id: 'vuln1', status: 'mitigated' };
        mockReq.params.id = 'vuln1';
        mockReq.body = { status: 'mitigated', updatedBy: 'user1' };
        (vulnerabilityScanner.updateVulnerability as jest.Mock).mockResolvedValue(mockUpdated);

        const handler = routes.get('PUT /api/security/vulnerabilities/:id')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.updateVulnerability).toHaveBeenCalledWith(
          'vuln1',
          { status: 'mitigated' },
          'user1'
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
      });

      it('should handle POST /api/security/reports', async () => {
        const mockReport = { id: 'report1', type: 'executive' };
        mockReq.body = {
          type: 'executive',
          period: 'monthly',
          options: { includeCharts: true }
        };
        (vulnerabilityScanner.generateSecurityReport as jest.Mock).mockResolvedValue(mockReport);

        const handler = routes.get('POST /api/security/reports')![0];
        await handler(mockReq, mockRes);

        expect(vulnerabilityScanner.generateSecurityReport).toHaveBeenCalledWith(
          'executive',
          'monthly',
          { includeCharts: true }
        );
        expect(mockRes.json).toHaveBeenCalledWith(mockReport);
      });
    });
  });

  describe('shutdownEnterpriseSecurityModule', () => {
    it('should shutdown all security services', async () => {
      await shutdownEnterpriseSecurityModule();

      expect(incidentResponseService.shutdown).toHaveBeenCalled();
      expect(complianceFrameworkService.shutdown).toHaveBeenCalled();
      expect(vulnerabilityScanner.shutdown).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Shutting down enterprise security module');
      expect(logger.info).toHaveBeenCalledWith('Enterprise security module shut down successfully');
    });

    it('should handle shutdown errors gracefully', async () => {
      const error = new Error('Shutdown failed');
      (incidentResponseService.shutdown as jest.Mock).mockRejectedValue(error);

      await shutdownEnterpriseSecurityModule();

      expect(logger.error).toHaveBeenCalledWith('Error shutting down enterprise security module', error);
    });
  });
});