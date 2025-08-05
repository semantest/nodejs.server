// WebSocket message types and interfaces
export interface Message {
  id: string;
  type: string;
  timestamp: number;
  correlationId?: string;
  replyTo?: string;
  payload: any;
  metadata?: {
    clientId?: string;
    sessionId?: string;
    version?: string;
    [key: string]: any;
  };
}

export enum MessageType {
  // System messages
  AUTH = 'AUTH',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILED = 'AUTH_FAILED',
  SYSTEM_READY = 'SYSTEM_READY',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  
  // Test messages
  TEST_EXECUTE = 'TEST_EXECUTE',
  TEST_STARTED = 'TEST_STARTED',
  TEST_PROGRESS = 'TEST_PROGRESS',
  TEST_COMPLETED = 'TEST_COMPLETED',
  TEST_FAILED = 'TEST_FAILED',
  
  // Browser messages
  BROWSER_NAVIGATE = 'BROWSER_NAVIGATE',
  BROWSER_CLICK = 'BROWSER_CLICK',
  BROWSER_TYPE = 'BROWSER_TYPE',
  BROWSER_SCREENSHOT = 'BROWSER_SCREENSHOT',
  BROWSER_CONSOLE = 'BROWSER_CONSOLE',
  
  // Subscription messages
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  SUBSCRIPTION_CONFIRMED = 'SUBSCRIPTION_CONFIRMED',
  UNSUBSCRIBE_CONFIRMED = 'UNSUBSCRIBE_CONFIRMED'
}

export interface AuthPayload {
  type: 'token';
  credentials: string;
  clientInfo?: {
    name: string;
    version: string;
    capabilities: string[];
  };
}

export interface AuthSuccessPayload {
  sessionId: string;
  expiresAt: number;
  permissions: string[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: any;
  fatal?: boolean;
}

export interface TestExecutePayload {
  testId: string;
  name: string;
  suite?: string;
  code: string;
  options?: {
    timeout?: number;
    retries?: number;
    browser?: string;
    headless?: boolean;
  };
  metadata?: {
    tags?: string[];
    priority?: string;
  };
}

export interface TestStatusPayload {
  testId: string;
  executionId: string;
  status?: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    screenshot?: string;
  };
}