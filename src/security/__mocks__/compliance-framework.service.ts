/**
 * Mock for compliance-framework.service
 */

export const complianceFrameworkService = {
  initialize: jest.fn(),
  shutdown: jest.fn(),
  getMetrics: jest.fn(),
  runAssessment: jest.fn(),
  listReports: jest.fn(),
  getReport: jest.fn(),
  getFindings: jest.fn(),
  updateFinding: jest.fn()
};