"use strict";
/**
 * Tests for Enterprise Security Module
 * Testing security initialization and route setup
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock all dependencies first
jest.mock('../audit-service');
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
const index_1 = require("../index");
const incident_response_service_1 = require("../incident-response.service");
const compliance_framework_service_1 = require("../compliance-framework.service");
const vulnerability_scanner_service_1 = require("../vulnerability-scanner.service");
const structured_logger_1 = require("../../monitoring/infrastructure/structured-logger");
describe('Enterprise Security Module', () => {
    let mockApp;
    let routes;
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock Express app
        routes = new Map();
        mockApp = {
            get: jest.fn((path, ...handlers) => {
                routes.set(`GET ${path}`, handlers);
            }),
            post: jest.fn((path, ...handlers) => {
                routes.set(`POST ${path}`, handlers);
            }),
            put: jest.fn((path, ...handlers) => {
                routes.set(`PUT ${path}`, handlers);
            }),
            delete: jest.fn((path, ...handlers) => {
                routes.set(`DELETE ${path}`, handlers);
            })
        };
        // Setup default mock implementations
        incident_response_service_1.incidentResponseService.initialize.mockResolvedValue(undefined);
        compliance_framework_service_1.complianceFrameworkService.initialize.mockResolvedValue(undefined);
        vulnerability_scanner_service_1.vulnerabilityScanner.initialize.mockResolvedValue(undefined);
        incident_response_service_1.incidentResponseService.shutdown.mockResolvedValue(undefined);
        compliance_framework_service_1.complianceFrameworkService.shutdown.mockResolvedValue(undefined);
        vulnerability_scanner_service_1.vulnerabilityScanner.shutdown.mockResolvedValue(undefined);
    });
    describe('initializeEnterpriseSecurityModule', () => {
        it('should initialize all security services', async () => {
            await (0, index_1.initializeEnterpriseSecurityModule)(mockApp);
            expect(incident_response_service_1.incidentResponseService.initialize).toHaveBeenCalled();
            expect(compliance_framework_service_1.complianceFrameworkService.initialize).toHaveBeenCalled();
            expect(vulnerability_scanner_service_1.vulnerabilityScanner.initialize).toHaveBeenCalled();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Initializing enterprise security module');
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Enterprise security module initialized successfully');
        });
        it('should setup security routes', async () => {
            await (0, index_1.initializeEnterpriseSecurityModule)(mockApp);
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
            incident_response_service_1.incidentResponseService.initialize.mockRejectedValue(error);
            await expect((0, index_1.initializeEnterpriseSecurityModule)(mockApp)).rejects.toThrow('Init failed');
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to initialize enterprise security module', error);
        });
    });
    describe('Security Route Handlers', () => {
        let mockReq;
        let mockRes;
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
            await (0, index_1.initializeEnterpriseSecurityModule)(mockApp);
        });
        describe('Incident Response Routes', () => {
            it('should handle GET /api/security/incidents', async () => {
                const mockIncidents = [{ id: '1', name: 'Incident 1' }];
                incident_response_service_1.incidentResponseService.listIncidents.mockReturnValue(mockIncidents);
                const handler = routes.get('GET /api/security/incidents')[0];
                await handler(mockReq, mockRes);
                expect(incident_response_service_1.incidentResponseService.listIncidents).toHaveBeenCalledWith({});
                expect(mockRes.json).toHaveBeenCalledWith(mockIncidents);
            });
            it('should handle GET /api/security/incidents/:id', async () => {
                const mockIncident = { id: '123', name: 'Test Incident' };
                mockReq.params.id = '123';
                incident_response_service_1.incidentResponseService.getIncident.mockReturnValue(mockIncident);
                const handler = routes.get('GET /api/security/incidents/:id')[0];
                await handler(mockReq, mockRes);
                expect(incident_response_service_1.incidentResponseService.getIncident).toHaveBeenCalledWith('123');
                expect(mockRes.json).toHaveBeenCalledWith(mockIncident);
            });
            it('should return 404 for non-existent incident', async () => {
                mockReq.params.id = 'non-existent';
                incident_response_service_1.incidentResponseService.getIncident.mockReturnValue(null);
                const handler = routes.get('GET /api/security/incidents/:id')[0];
                await handler(mockReq, mockRes);
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Incident not found' });
            });
            it('should handle PUT /api/security/incidents/:id', async () => {
                const mockUpdated = { id: '123', status: 'resolved' };
                mockReq.params.id = '123';
                mockReq.body = { status: 'resolved', updatedBy: 'user1' };
                incident_response_service_1.incidentResponseService.updateIncident.mockResolvedValue(mockUpdated);
                const handler = routes.get('PUT /api/security/incidents/:id')[0];
                await handler(mockReq, mockRes);
                expect(incident_response_service_1.incidentResponseService.updateIncident).toHaveBeenCalledWith('123', { status: 'resolved' }, 'user1');
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
                incident_response_service_1.incidentResponseService.executeAction.mockResolvedValue(mockAction);
                const handler = routes.get('POST /api/security/incidents/:id/actions')[0];
                await handler(mockReq, mockRes);
                expect(incident_response_service_1.incidentResponseService.executeAction).toHaveBeenCalledWith('123', 'block_ip', { ip: '1.2.3.4' }, 'user1');
                expect(mockRes.json).toHaveBeenCalledWith(mockAction);
            });
            it('should handle GET /api/security/dashboard', async () => {
                const mockDashboard = { activeIncidents: 5, resolvedToday: 10 };
                incident_response_service_1.incidentResponseService.getDashboard.mockReturnValue(mockDashboard);
                const handler = routes.get('GET /api/security/dashboard')[0];
                await handler(mockReq, mockRes);
                expect(incident_response_service_1.incidentResponseService.getDashboard).toHaveBeenCalled();
                expect(mockRes.json).toHaveBeenCalledWith(mockDashboard);
            });
            it('should handle incident route errors', async () => {
                const error = new Error('Database error');
                incident_response_service_1.incidentResponseService.listIncidents.mockImplementation(() => {
                    throw error;
                });
                const handler = routes.get('GET /api/security/incidents')[0];
                await handler(mockReq, mockRes);
                expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Failed to list incidents', error);
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
            });
        });
        describe('Compliance Routes', () => {
            it('should handle GET /api/compliance/metrics', async () => {
                const mockMetrics = { overallScore: 85, frameworks: 3 };
                compliance_framework_service_1.complianceFrameworkService.getMetrics.mockReturnValue(mockMetrics);
                const handler = routes.get('GET /api/compliance/metrics')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.getMetrics).toHaveBeenCalled();
                expect(mockRes.json).toHaveBeenCalledWith(mockMetrics);
            });
            it('should handle POST /api/compliance/assessments', async () => {
                const mockReport = { id: 'report1', score: 90 };
                mockReq.body = { frameworkId: 'iso27001', triggeredBy: 'user1' };
                compliance_framework_service_1.complianceFrameworkService.runAssessment.mockResolvedValue(mockReport);
                const handler = routes.get('POST /api/compliance/assessments')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.runAssessment).toHaveBeenCalledWith('iso27001', 'user1');
                expect(mockRes.json).toHaveBeenCalledWith(mockReport);
            });
            it('should handle GET /api/compliance/reports', async () => {
                const mockReports = [{ id: 'report1' }, { id: 'report2' }];
                mockReq.query = { framework: 'gdpr' };
                compliance_framework_service_1.complianceFrameworkService.listReports.mockReturnValue(mockReports);
                const handler = routes.get('GET /api/compliance/reports')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.listReports).toHaveBeenCalledWith({ framework: 'gdpr' });
                expect(mockRes.json).toHaveBeenCalledWith(mockReports);
            });
            it('should handle GET /api/compliance/reports/:id', async () => {
                const mockReport = { id: 'report1', framework: 'gdpr' };
                mockReq.params.id = 'report1';
                compliance_framework_service_1.complianceFrameworkService.getReport.mockReturnValue(mockReport);
                const handler = routes.get('GET /api/compliance/reports/:id')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.getReport).toHaveBeenCalledWith('report1');
                expect(mockRes.json).toHaveBeenCalledWith(mockReport);
            });
            it('should return 404 for non-existent report', async () => {
                mockReq.params.id = 'non-existent';
                compliance_framework_service_1.complianceFrameworkService.getReport.mockReturnValue(null);
                const handler = routes.get('GET /api/compliance/reports/:id')[0];
                await handler(mockReq, mockRes);
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Report not found' });
            });
            it('should handle GET /api/compliance/findings', async () => {
                const mockFindings = [{ id: 'finding1', severity: 'high' }];
                mockReq.query = { status: 'open' };
                compliance_framework_service_1.complianceFrameworkService.getFindings.mockReturnValue(mockFindings);
                const handler = routes.get('GET /api/compliance/findings')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.getFindings).toHaveBeenCalledWith({ status: 'open' });
                expect(mockRes.json).toHaveBeenCalledWith(mockFindings);
            });
            it('should handle PUT /api/compliance/findings/:id', async () => {
                const mockUpdated = { id: 'finding1', status: 'resolved' };
                mockReq.params.id = 'finding1';
                mockReq.body = { status: 'resolved', updatedBy: 'user1' };
                compliance_framework_service_1.complianceFrameworkService.updateFinding.mockResolvedValue(mockUpdated);
                const handler = routes.get('PUT /api/compliance/findings/:id')[0];
                await handler(mockReq, mockRes);
                expect(compliance_framework_service_1.complianceFrameworkService.updateFinding).toHaveBeenCalledWith('finding1', { status: 'resolved' }, 'user1');
                expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
            });
        });
        describe('Vulnerability Scanner Routes', () => {
            it('should handle POST /api/security/scans', async () => {
                const mockScan = { id: 'scan1', status: 'running' };
                mockReq.body = { configurationId: 'config1', triggeredBy: 'user1' };
                vulnerability_scanner_service_1.vulnerabilityScanner.startScan.mockResolvedValue(mockScan);
                const handler = routes.get('POST /api/security/scans')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.startScan).toHaveBeenCalledWith('config1', 'user1');
                expect(mockRes.json).toHaveBeenCalledWith(mockScan);
            });
            it('should handle GET /api/security/scans', async () => {
                const mockScans = [{ id: 'scan1' }, { id: 'scan2' }];
                mockReq.query = { status: 'completed' };
                vulnerability_scanner_service_1.vulnerabilityScanner.listScanResults.mockReturnValue(mockScans);
                const handler = routes.get('GET /api/security/scans')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.listScanResults).toHaveBeenCalledWith({ status: 'completed' });
                expect(mockRes.json).toHaveBeenCalledWith(mockScans);
            });
            it('should handle GET /api/security/scans/:id', async () => {
                const mockScan = { id: 'scan1', status: 'completed' };
                mockReq.params.id = 'scan1';
                vulnerability_scanner_service_1.vulnerabilityScanner.getScanResult.mockReturnValue(mockScan);
                const handler = routes.get('GET /api/security/scans/:id')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.getScanResult).toHaveBeenCalledWith('scan1');
                expect(mockRes.json).toHaveBeenCalledWith(mockScan);
            });
            it('should return 404 for non-existent scan', async () => {
                mockReq.params.id = 'non-existent';
                vulnerability_scanner_service_1.vulnerabilityScanner.getScanResult.mockReturnValue(null);
                const handler = routes.get('GET /api/security/scans/:id')[0];
                await handler(mockReq, mockRes);
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Scan not found' });
            });
            it('should handle GET /api/security/vulnerabilities', async () => {
                const mockVulns = [{ id: 'vuln1', severity: 'critical' }];
                mockReq.query = { severity: 'critical' };
                vulnerability_scanner_service_1.vulnerabilityScanner.listVulnerabilities.mockReturnValue(mockVulns);
                const handler = routes.get('GET /api/security/vulnerabilities')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.listVulnerabilities).toHaveBeenCalledWith({ severity: 'critical' });
                expect(mockRes.json).toHaveBeenCalledWith(mockVulns);
            });
            it('should handle GET /api/security/vulnerabilities/:id', async () => {
                const mockVuln = { id: 'vuln1', severity: 'critical' };
                mockReq.params.id = 'vuln1';
                vulnerability_scanner_service_1.vulnerabilityScanner.getVulnerability.mockReturnValue(mockVuln);
                const handler = routes.get('GET /api/security/vulnerabilities/:id')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.getVulnerability).toHaveBeenCalledWith('vuln1');
                expect(mockRes.json).toHaveBeenCalledWith(mockVuln);
            });
            it('should return 404 for non-existent vulnerability', async () => {
                mockReq.params.id = 'non-existent';
                vulnerability_scanner_service_1.vulnerabilityScanner.getVulnerability.mockReturnValue(null);
                const handler = routes.get('GET /api/security/vulnerabilities/:id')[0];
                await handler(mockReq, mockRes);
                expect(mockRes.status).toHaveBeenCalledWith(404);
                expect(mockRes.json).toHaveBeenCalledWith({ error: 'Vulnerability not found' });
            });
            it('should handle PUT /api/security/vulnerabilities/:id', async () => {
                const mockUpdated = { id: 'vuln1', status: 'mitigated' };
                mockReq.params.id = 'vuln1';
                mockReq.body = { status: 'mitigated', updatedBy: 'user1' };
                vulnerability_scanner_service_1.vulnerabilityScanner.updateVulnerability.mockResolvedValue(mockUpdated);
                const handler = routes.get('PUT /api/security/vulnerabilities/:id')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.updateVulnerability).toHaveBeenCalledWith('vuln1', { status: 'mitigated' }, 'user1');
                expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
            });
            it('should handle POST /api/security/reports', async () => {
                const mockReport = { id: 'report1', type: 'executive' };
                mockReq.body = {
                    type: 'executive',
                    period: 'monthly',
                    options: { includeCharts: true }
                };
                vulnerability_scanner_service_1.vulnerabilityScanner.generateSecurityReport.mockResolvedValue(mockReport);
                const handler = routes.get('POST /api/security/reports')[0];
                await handler(mockReq, mockRes);
                expect(vulnerability_scanner_service_1.vulnerabilityScanner.generateSecurityReport).toHaveBeenCalledWith('executive', 'monthly', { includeCharts: true });
                expect(mockRes.json).toHaveBeenCalledWith(mockReport);
            });
        });
    });
    describe('shutdownEnterpriseSecurityModule', () => {
        it('should shutdown all security services', async () => {
            await (0, index_1.shutdownEnterpriseSecurityModule)();
            expect(incident_response_service_1.incidentResponseService.shutdown).toHaveBeenCalled();
            expect(compliance_framework_service_1.complianceFrameworkService.shutdown).toHaveBeenCalled();
            expect(vulnerability_scanner_service_1.vulnerabilityScanner.shutdown).toHaveBeenCalled();
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Shutting down enterprise security module');
            expect(structured_logger_1.logger.info).toHaveBeenCalledWith('Enterprise security module shut down successfully');
        });
        it('should handle shutdown errors gracefully', async () => {
            const error = new Error('Shutdown failed');
            incident_response_service_1.incidentResponseService.shutdown.mockRejectedValue(error);
            await (0, index_1.shutdownEnterpriseSecurityModule)();
            expect(structured_logger_1.logger.error).toHaveBeenCalledWith('Error shutting down enterprise security module', error);
        });
    });
});
//# sourceMappingURL=index.test.js.map