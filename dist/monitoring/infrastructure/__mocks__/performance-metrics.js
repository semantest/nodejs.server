"use strict";
/**
 * Mock for performance-metrics module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMetrics = void 0;
exports.performanceMetrics = {
    getSystemMetrics: jest.fn(),
    getBusinessMetrics: jest.fn(),
    getAllMetrics: jest.fn(),
    exportPrometheusMetrics: jest.fn()
};
//# sourceMappingURL=performance-metrics.js.map