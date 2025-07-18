# Task 031 Error Handler Integration Guide

## Overview
This document provides the integration interface between Task 032 (Logging and Monitoring Infrastructure) and Task 031 (Error Handling & Testing Infrastructure).

## Integration Points

### 1. Error Logging Integration

The monitoring system provides structured error logging with correlation tracking:

```typescript
import { errorIntegration } from '../monitoring';

// In your error handler
export class SemantestErrorHandler {
  handleError(error: SemantestError, context?: ErrorContext): void {
    // Log error with monitoring system
    errorIntegration.logError(error, {
      component: context?.component || 'unknown',
      correlationId: context?.correlationId,
      userId: context?.userId,
      requestId: context?.requestId,
      metadata: context?.metadata
    });
    
    // Track error metrics
    errorIntegration.trackError(error, context);
    
    // Create alert if critical
    if (error.severity === 'critical') {
      errorIntegration.alertError(error, context);
    }
  }
}
```

### 2. Real-time Error Alerting

The monitoring system provides WebSocket-based real-time error alerts:

```typescript
import { alertingManager, AlertType, AlertSeverity } from '../monitoring';

// Create custom error alert
alertingManager.createAlert(
  AlertType.ERROR,
  AlertSeverity.CRITICAL,
  'Critical Error Detected',
  error.message,
  'error-handler',
  {
    errorType: error.name,
    stack: error.stack,
    correlationId: context?.correlationId
  },
  ['error', 'critical']
);
```

### 3. Error Metrics Tracking

The monitoring system tracks error patterns and statistics:

```typescript
import { performanceMetrics } from '../monitoring';

// Track error metrics
performanceMetrics.increment('errors.total', 1, {
  errorType: error.name,
  component: context?.component || 'unknown',
  severity: error.severity
});

// Track error resolution time
const endTimer = performanceMetrics.startTimer('error.resolution_time');
// ... error handling logic
endTimer();
```

### 4. Health Check Integration

The monitoring system provides health checks that can be used by error handlers:

```typescript
import { healthCheckManager } from '../monitoring';

// Add error handler health check
healthCheckManager.addHealthCheck({
  name: 'error-handler',
  check: async () => {
    const stats = errorIntegration.getErrorStats();
    const errorRate = stats.errorRate;
    
    let status = 'healthy';
    if (errorRate > 0.1) {
      status = 'unhealthy';
    } else if (errorRate > 0.05) {
      status = 'degraded';
    }
    
    return {
      status: status as any,
      timestamp: new Date().toISOString(),
      duration: 0,
      details: {
        errorRate,
        totalErrors: stats.totalErrors,
        criticalErrors: stats.criticalErrors
      }
    };
  },
  timeout: 5000,
  interval: 60000,
  critical: true
});
```

## Available Interfaces

### ErrorHandlerIntegration

```typescript
interface ErrorHandlerIntegration {
  logError(error: Error, context?: any): void;
  alertError(error: Error, context?: any): void;
  trackError(error: Error, context?: any): void;
  getErrorStats(): Record<string, any>;
}
```

### MonitoringErrorIntegration

```typescript
class MonitoringErrorIntegration implements ErrorHandlerIntegration {
  logError(error: Error, context?: any): void;
  alertError(error: Error, context?: any): void;
  trackError(error: Error, context?: any): void;
  getErrorStats(): Record<string, any>;
}
```

## Configuration

### Setup with Express App

```typescript
import { setupMonitoring } from '../monitoring';
import express from 'express';

const app = express();

// Setup monitoring with error integration
await setupMonitoring(app, {
  enableMetrics: true,
  enableHealthChecks: true,
  enableAlerting: true,
  enableDashboard: true,
  alertingPort: 3004,
  logLevel: 'info'
});
```

### Custom Error Patterns

```typescript
import { errorHandlerIntegration } from '../monitoring';

// Register custom error patterns for automatic alerting
errorHandlerIntegration.registerErrorPattern(
  /database connection failed/i,
  AlertSeverity.CRITICAL
);

errorHandlerIntegration.registerErrorPattern(
  /timeout/i,
  AlertSeverity.HIGH
);
```

## Usage Examples

### Basic Error Handling

```typescript
import { errorIntegration } from '../monitoring';

try {
  // Your application logic
} catch (error) {
  // Complete error handling with monitoring
  errorIntegration.logError(error, {
    component: 'user-service',
    correlationId: req.headers['x-correlation-id'],
    userId: req.user?.id,
    requestId: req.id,
    metadata: {
      action: 'user.create',
      input: req.body
    }
  });
  
  // Track metrics
  errorIntegration.trackError(error, {
    component: 'user-service'
  });
  
  // Create alert for critical errors
  if (error instanceof CriticalError) {
    errorIntegration.alertError(error, {
      component: 'user-service'
    });
  }
  
  // Continue with your error handling logic
  throw error;
}
```

### Error Recovery with Monitoring

```typescript
import { logger, performanceMetrics } from '../monitoring';

class ErrorRecoveryManager {
  async attemptRecovery(error: SemantestError, context: ErrorContext): Promise<void> {
    const recoveryTimer = performanceMetrics.startTimer('error.recovery.duration');
    
    try {
      logger.info('Attempting error recovery', {
        correlationId: context.correlationId,
        metadata: {
          errorType: error.name,
          recoveryStrategy: error.recoveryStrategy
        }
      });
      
      // Perform recovery
      await this.executeRecovery(error, context);
      
      // Log successful recovery
      logger.info('Error recovery successful', {
        correlationId: context.correlationId
      });
      
      // Track successful recovery
      performanceMetrics.increment('error.recovery.success', 1);
      
    } catch (recoveryError) {
      logger.error('Error recovery failed', recoveryError, {
        correlationId: context.correlationId,
        metadata: {
          originalError: error.message
        }
      });
      
      // Track failed recovery
      performanceMetrics.increment('error.recovery.failure', 1);
      
      // Create alert for failed recovery
      errorIntegration.alertError(recoveryError, {
        component: 'error-recovery',
        correlationId: context.correlationId
      });
      
      throw recoveryError;
    } finally {
      recoveryTimer();
    }
  }
}
```

## Monitoring Endpoints

The monitoring system provides the following endpoints for error monitoring:

- `GET /api/health` - Overall system health including error rates
- `GET /api/metrics` - Prometheus-format metrics including error metrics
- `GET /monitoring/dashboard` - Web dashboard with error visualization
- `GET /monitoring/dashboard/api/alerts` - Active alerts including error alerts
- `WS ws://localhost:3004` - Real-time error alerts via WebSocket

## Best Practices

1. **Always provide context**: Include correlation IDs, user IDs, and component names
2. **Use appropriate log levels**: ERROR for errors, WARN for recoverable issues, INFO for normal operations
3. **Track metrics consistently**: Use the same error type names and component names
4. **Set up health checks**: Monitor error rates and recovery times
5. **Configure alerts**: Set up alerts for critical errors and high error rates
6. **Monitor performance**: Track error handling and recovery performance

## Testing

The monitoring system includes comprehensive tests that can be used as examples:

```typescript
import { errorIntegration } from '../monitoring';

describe('Error Handler Integration', () => {
  it('should log and track errors', () => {
    const testError = new Error('Test error');
    
    errorIntegration.logError(testError, {
      component: 'test-component',
      correlationId: 'test-correlation'
    });
    
    errorIntegration.trackError(testError, {
      component: 'test-component'
    });
    
    const stats = errorIntegration.getErrorStats();
    expect(stats.totalErrors).toBeGreaterThan(0);
  });
});
```

This integration provides a complete monitoring solution for your error handling system with real-time alerting, comprehensive logging, and performance tracking.