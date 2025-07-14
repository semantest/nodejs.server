/**
 * Jest Configuration for Semantest Security Testing
 * @description Comprehensive test configuration focused on security components
 * @author Web-Buddy Team
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: './',

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts'
  ],

  // Coverage configuration with focus on security components
  collectCoverage: true,
  collectCoverageFrom: [
    'src/auth/**/*.ts',
    'src/security/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts'
  ],

  // Coverage thresholds - targeting >90% for security components
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Stricter thresholds for critical security components
    'src/auth/infrastructure/token-manager.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/auth/application/auth-service.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/auth/infrastructure/jwt-middleware.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/auth/infrastructure/csrf-service.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/security/rate-limiting-service.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts'
  ],

  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          // Enable decorators for testing
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // Use ES2020 for better async/await support
          target: 'ES2020',
          lib: ['ES2020'],
          // Ensure proper module resolution
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true
        }
      }
    }]
  },

  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Test timeout (longer for security tests that might involve crypto)
  testTimeout: 30000,

  // Verbose output for detailed test results
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Security-focused test environments
  testEnvironmentOptions: {
    // Ensure proper timezone for time-based security tests
    TZ: 'UTC'
  },

  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,

  // Error handling
  errorOnDeprecated: true,
  
  // Parallel test execution (disabled for security tests to avoid race conditions)
  maxWorkers: 1,

  // Force exit after tests complete
  forceExit: true,

  // Test reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results',
      outputName: 'security-tests.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],

  // Additional Jest options for security testing
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],

  // Mock patterns
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ],

  // Custom matchers and utilities
  setupFiles: [
    '<rootDir>/src/__tests__/jest.env.ts'
  ]
};
