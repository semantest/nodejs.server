"use strict";
/**
 * @fileoverview Test setup for Jest in Node.js server module
 * @description Global test configuration and setup
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock console methods to reduce test noise
const originalError = console.error;
const originalWarn = console.warn;
beforeEach(() => {
    // Mock console.error to prevent noise during tests
    console.error = jest.fn();
    console.warn = jest.fn();
});
afterEach(() => {
    // Restore original console methods
    console.error = originalError;
    console.warn = originalWarn;
});
// Global test timeout
jest.setTimeout(30000);
// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'test://localhost/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.BASE_URL = 'http://localhost:3000';
// Mock localStorage for frontend components
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
// @ts-ignore
global.localStorage = localStorageMock;
// Mock fetch for API calls
global.fetch = jest.fn();
// Mock React for TSX components
jest.mock('react', () => ({
    ...jest.requireActual('react'),
    useState: jest.fn(),
    useEffect: jest.fn(),
}));
//# sourceMappingURL=test-setup.js.map