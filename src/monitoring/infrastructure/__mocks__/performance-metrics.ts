/**
 * Mock for performance-metrics module
 */

export const performanceMetrics = {
  getSystemMetrics: jest.fn(),
  getBusinessMetrics: jest.fn(),
  getAllMetrics: jest.fn(),
  exportPrometheusMetrics: jest.fn()
};