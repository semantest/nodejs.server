// WebSocket message types and interfaces from protocol v2.0.0

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
  // System
  AUTH = 'AUTH',
  AUTH_SUCCESS = 'AUTH_SUCCESS', 
  AUTH_FAILED = 'AUTH_FAILED',
  SYSTEM_READY = 'SYSTEM_READY',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  
  // Test
  TEST_EXECUTE = 'TEST_EXECUTE',
  TEST_STARTED = 'TEST_STARTED',
  TEST_PROGRESS = 'TEST_PROGRESS',
  TEST_COMPLETED = 'TEST_COMPLETED',
  TEST_FAILED = 'TEST_FAILED',
  
  // Browser
  BROWSER_NAVIGATE = 'BROWSER_NAVIGATE',
  BROWSER_CLICK = 'BROWSER_CLICK',
  BROWSER_TYPE = 'BROWSER_TYPE',
  BROWSER_SCREENSHOT = 'BROWSER_SCREENSHOT',
  BROWSER_CONSOLE = 'BROWSER_CONSOLE',
  
  // Subscription
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE'
}

export interface AuthPayload {
  type: 'token';
  credentials: string;
  clientInfo: {
    name: string;
    version: string;
    capabilities: string[];
  };
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
  suite: string;
  code: string;
  options: {
    timeout: number;
    retries: number;
    browser: string;
    headless: boolean;
  };
  metadata?: {
    tags: string[];
    priority: string;
  };
}