/**
 * Enterprise Security Module
 * Comprehensive security services for enterprise deployment
 */

export { 
  AuditService 
} from './audit-service';

export { 
  IncidentResponseService, 
  incidentResponseService,
  SecurityIncident,
  SecurityAction,
  ThreatRule,
  SecurityDashboard
} from './incident-response.service';

export { 
  ComplianceFrameworkService, 
  complianceFrameworkService,
  ComplianceFramework,
  ComplianceRequirement,
  ComplianceFinding,
  ComplianceReport,
  ComplianceMetrics
} from './compliance-framework.service';

export { 
  VulnerabilityScanner, 
  vulnerabilityScanner,
  Vulnerability,
  ScanConfiguration,
  ScanResult,
  SecurityReport
} from './vulnerability-scanner.service';

import { Express } from 'express';
import { incidentResponseService } from './incident-response.service';
import { complianceFrameworkService } from './compliance-framework.service';
import { vulnerabilityScanner } from './vulnerability-scanner.service';
import { logger } from '../monitoring/infrastructure/structured-logger';

/**
 * Initialize enterprise security module
 */
export async function initializeEnterpriseSecurityModule(app: Express): Promise<void> {
  logger.info('Initializing enterprise security module');

  try {
    // Initialize services
    await incidentResponseService.initialize();
    await complianceFrameworkService.initialize();
    await vulnerabilityScanner.initialize();
    
    // Setup REST API routes
    setupSecurityRoutes(app);
    
    logger.info('Enterprise security module initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize enterprise security module', error);
    throw error;
  }
}

/**
 * Setup security REST API routes
 */
function setupSecurityRoutes(app: Express): void {
  // Incident Response routes
  app.get('/api/security/incidents', async (req, res) => {
    try {
      const filters = req.query;
      const incidents = incidentResponseService.listIncidents(filters as any);
      res.json(incidents);
    } catch (error) {
      logger.error('Failed to list incidents', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/incidents/:id', async (req, res) => {
    try {
      const incident = incidentResponseService.getIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      res.json(incident);
    } catch (error) {
      logger.error('Failed to get incident', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/security/incidents/:id', async (req, res) => {
    try {
      const { updatedBy, ...updates } = req.body;
      const incident = await incidentResponseService.updateIncident(
        req.params.id,
        updates,
        updatedBy
      );
      res.json(incident);
    } catch (error) {
      logger.error('Failed to update incident', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/security/incidents/:id/actions', async (req, res) => {
    try {
      const { actionType, parameters, executedBy } = req.body;
      const action = await incidentResponseService.executeAction(
        req.params.id,
        actionType,
        parameters,
        executedBy
      );
      res.json(action);
    } catch (error) {
      logger.error('Failed to execute security action', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/dashboard', (req, res) => {
    try {
      const dashboard = incidentResponseService.getDashboard();
      res.json(dashboard);
    } catch (error) {
      logger.error('Failed to get security dashboard', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Compliance routes
  app.get('/api/compliance/metrics', (req, res) => {
    try {
      const metrics = complianceFrameworkService.getMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get compliance metrics', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/compliance/assessments', async (req, res) => {
    try {
      const { frameworkId, triggeredBy } = req.body;
      const report = await complianceFrameworkService.runAssessment(
        frameworkId,
        triggeredBy
      );
      res.json(report);
    } catch (error) {
      logger.error('Failed to run compliance assessment', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/compliance/reports', async (req, res) => {
    try {
      const filters = req.query;
      const reports = complianceFrameworkService.listReports(filters as any);
      res.json(reports);
    } catch (error) {
      logger.error('Failed to list compliance reports', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/compliance/reports/:id', async (req, res) => {
    try {
      const report = complianceFrameworkService.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.json(report);
    } catch (error) {
      logger.error('Failed to get compliance report', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/compliance/findings', async (req, res) => {
    try {
      const filters = req.query;
      const findings = complianceFrameworkService.getFindings(filters as any);
      res.json(findings);
    } catch (error) {
      logger.error('Failed to list compliance findings', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/compliance/findings/:id', async (req, res) => {
    try {
      const { updatedBy, ...updates } = req.body;
      const finding = await complianceFrameworkService.updateFinding(
        req.params.id,
        updates,
        updatedBy
      );
      res.json(finding);
    } catch (error) {
      logger.error('Failed to update compliance finding', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vulnerability Scanner routes
  app.post('/api/security/scans', async (req, res) => {
    try {
      const { configurationId, triggeredBy } = req.body;
      const scanResult = await vulnerabilityScanner.startScan(
        configurationId,
        triggeredBy
      );
      res.json(scanResult);
    } catch (error) {
      logger.error('Failed to start vulnerability scan', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/scans', async (req, res) => {
    try {
      const filters = req.query;
      const scans = vulnerabilityScanner.listScanResults(filters as any);
      res.json(scans);
    } catch (error) {
      logger.error('Failed to list scans', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/scans/:id', async (req, res) => {
    try {
      const scan = vulnerabilityScanner.getScanResult(req.params.id);
      if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
      }
      res.json(scan);
    } catch (error) {
      logger.error('Failed to get scan result', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/vulnerabilities', async (req, res) => {
    try {
      const filters = req.query;
      const vulnerabilities = vulnerabilityScanner.listVulnerabilities(filters as any);
      res.json(vulnerabilities);
    } catch (error) {
      logger.error('Failed to list vulnerabilities', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/security/vulnerabilities/:id', async (req, res) => {
    try {
      const vulnerability = vulnerabilityScanner.getVulnerability(req.params.id);
      if (!vulnerability) {
        return res.status(404).json({ error: 'Vulnerability not found' });
      }
      res.json(vulnerability);
    } catch (error) {
      logger.error('Failed to get vulnerability', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/security/vulnerabilities/:id', async (req, res) => {
    try {
      const { updatedBy, ...updates } = req.body;
      const vulnerability = await vulnerabilityScanner.updateVulnerability(
        req.params.id,
        updates,
        updatedBy
      );
      res.json(vulnerability);
    } catch (error) {
      logger.error('Failed to update vulnerability', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/security/reports', async (req, res) => {
    try {
      const { type, period, options } = req.body;
      const report = await vulnerabilityScanner.generateSecurityReport(
        type,
        period,
        options
      );
      res.json(report);
    } catch (error) {
      logger.error('Failed to generate security report', error);
      res.status(500).json({ error: error.message });
    }
  });

  logger.info('Enterprise security API routes configured');
}

/**
 * Shutdown enterprise security module
 */
export async function shutdownEnterpriseSecurityModule(): Promise<void> {
  logger.info('Shutting down enterprise security module');
  
  try {
    await incidentResponseService.shutdown();
    await complianceFrameworkService.shutdown();
    await vulnerabilityScanner.shutdown();
    
    logger.info('Enterprise security module shut down successfully');
  } catch (error) {
    logger.error('Error shutting down enterprise security module', error);
  }
}