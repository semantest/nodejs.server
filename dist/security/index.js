"use strict";
/**
 * Enterprise Security Module
 * Comprehensive security services for enterprise deployment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vulnerabilityScanner = exports.VulnerabilityScanner = exports.complianceFrameworkService = exports.ComplianceFrameworkService = exports.incidentResponseService = exports.IncidentResponseService = exports.AuditService = void 0;
exports.initializeEnterpriseSecurityModule = initializeEnterpriseSecurityModule;
exports.shutdownEnterpriseSecurityModule = shutdownEnterpriseSecurityModule;
var audit_service_1 = require("./audit-service");
Object.defineProperty(exports, "AuditService", { enumerable: true, get: function () { return audit_service_1.AuditService; } });
var incident_response_service_1 = require("./incident-response.service");
Object.defineProperty(exports, "IncidentResponseService", { enumerable: true, get: function () { return incident_response_service_1.IncidentResponseService; } });
Object.defineProperty(exports, "incidentResponseService", { enumerable: true, get: function () { return incident_response_service_1.incidentResponseService; } });
var compliance_framework_service_1 = require("./compliance-framework.service");
Object.defineProperty(exports, "ComplianceFrameworkService", { enumerable: true, get: function () { return compliance_framework_service_1.ComplianceFrameworkService; } });
Object.defineProperty(exports, "complianceFrameworkService", { enumerable: true, get: function () { return compliance_framework_service_1.complianceFrameworkService; } });
var vulnerability_scanner_service_1 = require("./vulnerability-scanner.service");
Object.defineProperty(exports, "VulnerabilityScanner", { enumerable: true, get: function () { return vulnerability_scanner_service_1.VulnerabilityScanner; } });
Object.defineProperty(exports, "vulnerabilityScanner", { enumerable: true, get: function () { return vulnerability_scanner_service_1.vulnerabilityScanner; } });
const incident_response_service_2 = require("./incident-response.service");
const compliance_framework_service_2 = require("./compliance-framework.service");
const vulnerability_scanner_service_2 = require("./vulnerability-scanner.service");
const structured_logger_1 = require("../monitoring/infrastructure/structured-logger");
/**
 * Initialize enterprise security module
 */
async function initializeEnterpriseSecurityModule(app) {
    structured_logger_1.logger.info('Initializing enterprise security module');
    try {
        // Initialize services
        await incident_response_service_2.incidentResponseService.initialize();
        await compliance_framework_service_2.complianceFrameworkService.initialize();
        await vulnerability_scanner_service_2.vulnerabilityScanner.initialize();
        // Setup REST API routes
        setupSecurityRoutes(app);
        structured_logger_1.logger.info('Enterprise security module initialized successfully');
    }
    catch (error) {
        structured_logger_1.logger.error('Failed to initialize enterprise security module', error);
        throw error;
    }
}
/**
 * Setup security REST API routes
 */
function setupSecurityRoutes(app) {
    // Incident Response routes
    app.get('/api/security/incidents', async (req, res) => {
        try {
            const filters = req.query;
            const incidents = incident_response_service_2.incidentResponseService.listIncidents(filters);
            res.json(incidents);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list incidents', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/incidents/:id', async (req, res) => {
        try {
            const incident = incident_response_service_2.incidentResponseService.getIncident(req.params.id);
            if (!incident) {
                return res.status(404).json({ error: 'Incident not found' });
            }
            res.json(incident);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get incident', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/api/security/incidents/:id', async (req, res) => {
        try {
            const { updatedBy, ...updates } = req.body;
            const incident = await incident_response_service_2.incidentResponseService.updateIncident(req.params.id, updates, updatedBy);
            res.json(incident);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to update incident', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/security/incidents/:id/actions', async (req, res) => {
        try {
            const { actionType, parameters, executedBy } = req.body;
            const action = await incident_response_service_2.incidentResponseService.executeAction(req.params.id, actionType, parameters, executedBy);
            res.json(action);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to execute security action', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/dashboard', (req, res) => {
        try {
            const dashboard = incident_response_service_2.incidentResponseService.getDashboard();
            res.json(dashboard);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get security dashboard', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Compliance routes
    app.get('/api/compliance/metrics', (req, res) => {
        try {
            const metrics = compliance_framework_service_2.complianceFrameworkService.getMetrics();
            res.json(metrics);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get compliance metrics', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/compliance/assessments', async (req, res) => {
        try {
            const { frameworkId, triggeredBy } = req.body;
            const report = await compliance_framework_service_2.complianceFrameworkService.runAssessment(frameworkId, triggeredBy);
            res.json(report);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to run compliance assessment', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/compliance/reports', async (req, res) => {
        try {
            const filters = req.query;
            const reports = compliance_framework_service_2.complianceFrameworkService.listReports(filters);
            res.json(reports);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list compliance reports', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/compliance/reports/:id', async (req, res) => {
        try {
            const report = compliance_framework_service_2.complianceFrameworkService.getReport(req.params.id);
            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }
            res.json(report);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get compliance report', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/compliance/findings', async (req, res) => {
        try {
            const filters = req.query;
            const findings = compliance_framework_service_2.complianceFrameworkService.getFindings(filters);
            res.json(findings);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list compliance findings', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/api/compliance/findings/:id', async (req, res) => {
        try {
            const { updatedBy, ...updates } = req.body;
            const finding = await compliance_framework_service_2.complianceFrameworkService.updateFinding(req.params.id, updates, updatedBy);
            res.json(finding);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to update compliance finding', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Vulnerability Scanner routes
    app.post('/api/security/scans', async (req, res) => {
        try {
            const { configurationId, triggeredBy } = req.body;
            const scanResult = await vulnerability_scanner_service_2.vulnerabilityScanner.startScan(configurationId, triggeredBy);
            res.json(scanResult);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to start vulnerability scan', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/scans', async (req, res) => {
        try {
            const filters = req.query;
            const scans = vulnerability_scanner_service_2.vulnerabilityScanner.listScanResults(filters);
            res.json(scans);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list scans', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/scans/:id', async (req, res) => {
        try {
            const scan = vulnerability_scanner_service_2.vulnerabilityScanner.getScanResult(req.params.id);
            if (!scan) {
                return res.status(404).json({ error: 'Scan not found' });
            }
            res.json(scan);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get scan result', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/vulnerabilities', async (req, res) => {
        try {
            const filters = req.query;
            const vulnerabilities = vulnerability_scanner_service_2.vulnerabilityScanner.listVulnerabilities(filters);
            res.json(vulnerabilities);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to list vulnerabilities', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/security/vulnerabilities/:id', async (req, res) => {
        try {
            const vulnerability = vulnerability_scanner_service_2.vulnerabilityScanner.getVulnerability(req.params.id);
            if (!vulnerability) {
                return res.status(404).json({ error: 'Vulnerability not found' });
            }
            res.json(vulnerability);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to get vulnerability', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/api/security/vulnerabilities/:id', async (req, res) => {
        try {
            const { updatedBy, ...updates } = req.body;
            const vulnerability = await vulnerability_scanner_service_2.vulnerabilityScanner.updateVulnerability(req.params.id, updates, updatedBy);
            res.json(vulnerability);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to update vulnerability', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/api/security/reports', async (req, res) => {
        try {
            const { type, period, options } = req.body;
            const report = await vulnerability_scanner_service_2.vulnerabilityScanner.generateSecurityReport(type, period, options);
            res.json(report);
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to generate security report', error);
            res.status(500).json({ error: error.message });
        }
    });
    structured_logger_1.logger.info('Enterprise security API routes configured');
}
/**
 * Shutdown enterprise security module
 */
async function shutdownEnterpriseSecurityModule() {
    structured_logger_1.logger.info('Shutting down enterprise security module');
    try {
        await incident_response_service_2.incidentResponseService.shutdown();
        await compliance_framework_service_2.complianceFrameworkService.shutdown();
        await vulnerability_scanner_service_2.vulnerabilityScanner.shutdown();
        structured_logger_1.logger.info('Enterprise security module shut down successfully');
    }
    catch (error) {
        structured_logger_1.logger.error('Error shutting down enterprise security module', error);
    }
}
//# sourceMappingURL=index.js.map