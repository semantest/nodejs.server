/**
 * Mock for incident-response.service
 */

export const incidentResponseService = {
  initialize: jest.fn(),
  shutdown: jest.fn(),
  listIncidents: jest.fn(),
  getIncident: jest.fn(),
  updateIncident: jest.fn(),
  executeAction: jest.fn(),
  getDashboard: jest.fn()
};