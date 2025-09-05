/**
 * WebSocket Protocol Types
 * Shared message format for CLI ↔ Server ↔ Extension communication
 * @author Rafa - Systems Architect
 */

export enum MessageType {
  COMMAND = 'command',
  QUERY = 'query',
  EVENT = 'event',
  RESPONSE = 'response'
}

export enum MessageSource {
  CLI = 'cli',
  SERVER = 'server',
  EXTENSION = 'extension'
}

export enum MessageTarget {
  SERVER = 'server',
  EXTENSION = 'extension',
  CLI = 'cli'
}

export interface WebSocketMessage {
  id: string;                    // UUID for tracking
  type: MessageType;              // Message type classification
  source: MessageSource;          // Origin of the message
  target: MessageTarget;          // Destination of the message
  action: string;                 // e.g., 'chatgpt.send', 'chatgpt.read'
  payload: any;                   // Action-specific data
  timestamp: number;              // Message creation time
  correlationId?: string;         // For request/response pairing
}

// Specific message actions
export enum ChatGPTAction {
  SEND = 'chatgpt.send',
  READ = 'chatgpt.read',
  SELECT_PROJECT = 'chatgpt.selectProject',
  GET_STATUS = 'chatgpt.status',
  CLEAR_CONVERSATION = 'chatgpt.clear'
}

export enum ExtensionAction {
  INJECT = 'extension.inject',
  CONNECT = 'extension.connect',
  DISCONNECT = 'extension.disconnect',
  PING = 'extension.ping',
  PONG = 'extension.pong'
}

export enum ServerAction {
  CLIENT_CONNECTED = 'server.clientConnected',
  CLIENT_DISCONNECTED = 'server.clientDisconnected',
  ERROR = 'server.error',
  BROADCAST = 'server.broadcast'
}

// Payload types for specific actions
export interface ChatGPTSendPayload {
  message: string;
  projectId?: string;
}

export interface ChatGPTResponsePayload {
  text: string;
  html?: string;
  timestamp: number;
}

export interface ExtensionInjectPayload {
  script: string;
  target: 'content' | 'background';
}

export interface ServerErrorPayload {
  code: string;
  message: string;
  details?: any;
}

// Connection management
export interface ClientConnection {
  id: string;
  type: 'cli' | 'extension';
  authenticated: boolean;
  connectedAt: number;
  lastActivity: number;
  metadata?: Record<string, any>;
}

// Authentication
export interface AuthPayload {
  token: string;
  clientType: 'cli' | 'extension';
}

// Rate limiting
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  burstLimit: number;
  windowMs: number;
}