/**
 * Mock for structured-logger module
 */

export const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};