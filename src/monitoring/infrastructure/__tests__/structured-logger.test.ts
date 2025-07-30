/**
 * 🧪 Tests for Structured Logger
 * Testing comprehensive logging infrastructure with correlation tracking
 */

// Mock the actual module to prevent instantiation of the default logger
jest.mock('../structured-logger', () => {
  const actualModule = jest.requireActual('../structured-logger');
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    security: jest.fn(),
    performance: jest.fn(),
    business: jest.fn(),
    audit: jest.fn(),
    auth: jest.fn(),
    child: jest.fn()
  };
  return {
    ...actualModule,
    logger: mockLogger
  };
});

import { 
  StructuredLogger, 
  logger,
  LogLevel, 
  LogCategory,
  requestLoggingMiddleware,
  websocketLoggingMiddleware,
  errorLoggingMiddleware
} from '../structured-logger';
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn()
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
    metadata: jest.fn(() => ({})),
    printf: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    DailyRotateFile: jest.fn()
  }
}));

// Mock async_hooks
jest.mock('async_hooks', () => ({
  AsyncLocalStorage: jest.fn(() => ({
    run: jest.fn((value, callback) => callback()),
    getStore: jest.fn()
  }))
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-correlation-id')
}));

// Mock os
jest.mock('os', () => ({
  hostname: jest.fn(() => 'test-hostname')
}));

// Mock perf_hooks
jest.mock('perf_hooks', () => ({
  performance: {
    now: jest.fn(() => 1000)
  }
}));

describe('StructuredLogger', () => {
  let structuredLogger: StructuredLogger;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      http: jest.fn()
    };

    const winston = require('winston');
    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

    structuredLogger = new StructuredLogger({
      serviceName: 'test-service',
      version: '1.0.0',
      environment: 'test',
      logLevel: LogLevel.INFO
    });
  });

  describe('Constructor', () => {
    it('should create logger with default options', () => {
      const logger = new StructuredLogger({
        serviceName: 'test',
        version: '1.0.0',
        environment: 'test'
      });

      expect(logger).toBeDefined();
    });

    it('should create logger with file logging enabled', () => {
      const logger = new StructuredLogger({
        serviceName: 'test',
        version: '1.0.0',
        environment: 'test',
        logToFile: true,
        logDirectory: '/tmp/logs'
      });

      expect(logger).toBeDefined();
    });
  });

  describe('Logging Methods', () => {
    it('should log info message', () => {
      structuredLogger.info('Test info message', { userId: '123' });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'Test info message',
        category: LogCategory.SYSTEM,
        context: expect.objectContaining({
          userId: '123'
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });

    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      structuredLogger.error('Error occurred', error, { component: 'test' });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.ERROR,
        message: 'Error occurred',
        category: LogCategory.ERROR,
        context: expect.objectContaining({
          component: 'test'
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        stack: expect.stringContaining('Error: Test error'),
        tags: []
      });
    });

    it('should log warning message', () => {
      structuredLogger.warn('Test warning', { metadata: { threshold: 80 } });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.WARN,
        message: 'Test warning',
        category: LogCategory.SYSTEM,
        context: expect.objectContaining({
          threshold: 80
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });

    it('should log debug message', () => {
      structuredLogger.debug('Debug info', { metadata: { details: 'test' } });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.DEBUG,
        message: 'Debug info',
        category: LogCategory.SYSTEM,
        context: expect.objectContaining({
          details: 'test'
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });

    it('should log http message', () => {
      structuredLogger.http('HTTP request', { metadata: { method: 'GET', path: '/api/test' } });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.HTTP,
        message: 'HTTP request',
        category: LogCategory.API,
        context: expect.objectContaining({
          method: 'GET',
          path: '/api/test'
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });

    it('should log with custom category and tags', () => {
      structuredLogger.info('Security event', 
        { userId: '123' }, 
        ['auth', 'login']
      );

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'Security event',
        category: LogCategory.SYSTEM,
        context: expect.objectContaining({
          userId: '123'
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: ['auth', 'login']
      });
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      structuredLogger.performance('API call completed', {
        performance: { duration: 150 },
        metadata: { endpoint: '/api/users' }
      });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'API call completed',
        category: LogCategory.PERFORMANCE,
        context: expect.objectContaining({
          duration: 150,
          endpoint: '/api/users',
          performance: expect.objectContaining({
            duration: 150
          })
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });

    it('should create and end timer', () => {
      const endTimer = structuredLogger.createTimer('test-operation');
      
      // Simulate some delay
      (performance.now as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(1150);
      
      endTimer();

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'test-operation completed',
        category: LogCategory.PERFORMANCE,
        context: expect.objectContaining({
          performance: expect.objectContaining({
            duration: 150,
            startTime: 1000,
            endTime: 1150
          })
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });
  });

  describe('Security Logging', () => {
    it('should log security event', () => {
      structuredLogger.security('Failed login attempt', {
        userId: 'user123',
        security: { ipAddress: '192.168.1.1' },
        metadata: { threat: 'brute_force', severity: 'high' }
      });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.WARN,
        message: 'Failed login attempt',
        category: LogCategory.SECURITY,
        context: expect.objectContaining({
          userId: 'user123',
          security: {
            ipAddress: '192.168.1.1',
            threat: 'brute_force',
            severity: 'high'
          }
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });
  });

  describe('Business Event Logging', () => {
    it('should log business event', () => {
      structuredLogger.business('Order placed', {
        userId: 'user123',
        metadata: { orderId: 'order456', amount: 99.99, currency: 'USD' }
      });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'Order placed',
        category: LogCategory.BUSINESS,
        context: expect.objectContaining({
          userId: 'user123',
          business: {
            entityId: 'order456',
            value: 99.99,
            currency: 'USD'
          }
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log audit event', () => {
      structuredLogger.audit('User permission changed', {
        userId: 'admin123',
        action: 'grant_role',
        metadata: {
          targetUserId: 'user456',
          role: 'moderator'
        }
      });

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'User permission changed',
        category: LogCategory.AUDIT,
        context: expect.objectContaining({
          userId: 'admin123',
          action: 'grant_role',
          metadata: {
            targetUserId: 'user456',
            role: 'moderator'
          }
        }),
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
        hostname: 'test-hostname',
        pid: expect.any(Number),
        timestamp: expect.any(String),
        tags: []
      });
    });
  });
});

describe('Express Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'x-correlation-id': 'existing-correlation-id',
        'user-agent': 'test-agent'
      },
      ip: '127.0.0.1'
    };

    mockRes = {
      statusCode: 200,
      on: jest.fn((event, handler) => {
        if (event === 'finish') {
          handler();
        }
        return mockRes;
      }) as any
    };

    mockNext = jest.fn();
  });

  describe('requestLoggingMiddleware', () => {
    it('should log incoming request and response', () => {
      requestLoggingMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      
      // Should log request
      expect(logger.http).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({
          correlationId: 'existing-correlation-id',
          requestId: 'test-correlation-id',
          metadata: {
            method: 'GET',
            url: '/api/test',
            userAgent: 'test-agent',
            ip: '127.0.0.1',
            headers: {
              'x-correlation-id': 'existing-correlation-id',
              'user-agent': 'test-agent'
            }
          }
        })
      );

      // Trigger response finish
      const finishHandler = (mockRes.on as jest.Mock).mock.calls[0][1];
      finishHandler();

      // Should log response
      expect(logger.http).toHaveBeenCalledWith(
        'HTTP Response',
        expect.objectContaining({
          correlationId: 'existing-correlation-id',
          performance: expect.objectContaining({
            duration: expect.any(Number),
            startTime: expect.any(Number),
            endTime: expect.any(Number)
          }),
          metadata: {
            statusCode: 200,
            contentLength: undefined
          }
        })
      );
    });

    it('should generate correlation ID if not provided', () => {
      delete mockReq.headers!['x-correlation-id'];
      
      requestLoggingMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.http).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({
          correlationId: 'test-correlation-id'
        })
      );
    });
  });

  describe('errorLoggingMiddleware', () => {
    it('should log error and pass to next handler', () => {
      const error = new Error('Test error');
      
      // Add get method to mockReq
      mockReq.get = jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      });
      
      errorLoggingMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Error',
        error,
        expect.objectContaining({
          correlationId: undefined,
          metadata: {
            method: 'GET',
            url: '/api/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent'
          }
        })
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});

describe('WebSocket Middleware', () => {
  it('should log WebSocket events', () => {
    const mockSocket = {
      on: jest.fn()
    };
    
    const mockReq = {
      headers: {
        'x-correlation-id': 'ws-correlation-id',
        'user-agent': 'test-agent',
        'origin': 'http://localhost:3000'
      },
      ip: '127.0.0.1',
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        if (header === 'Origin') return 'http://localhost:3000';
        return undefined;
      })
    };

    const mockNext = jest.fn();

    websocketLoggingMiddleware(mockSocket as any, mockReq as any, mockNext);

    expect(logger.info).toHaveBeenCalledWith(
      'WebSocket Connection',
      expect.objectContaining({
        correlationId: 'ws-correlation-id',
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          origin: 'http://localhost:3000'
        }
      }),
      ['websocket', 'connection']
    );

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Default Logger Instance', () => {
  it('should export default logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(StructuredLogger);
  });
});