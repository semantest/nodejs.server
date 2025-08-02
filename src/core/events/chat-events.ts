/**
 * @fileoverview Chat session lifecycle and management events
 * @description Core events for chat creation, messages, and session management
 * @author Semantest Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Event triggered when a new chat session is requested
 * Issue #23: Creates new chat sessions with an initial prompt payload
 */
export class NewChatRequestedEvent extends Event {
  public readonly type = 'NewChatRequested';
  
  constructor(
    public readonly userId: string,
    public readonly initialPrompt: string,
    public readonly metadata?: ChatSessionMetadata
  ) {
    super();
  }
}

/**
 * Event triggered when a chat session is successfully created
 */
export class ChatSessionCreatedEvent extends Event {
  public readonly type = 'ChatSessionCreated';
  
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly createdAt: Date,
    public readonly initialPrompt?: string
  ) {
    super();
  }
}

/**
 * Event triggered when a chat message is sent
 */
export class ChatMessageSentEvent extends Event {
  public readonly type = 'ChatMessageSent';
  
  constructor(
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly userId: string,
    public readonly content: string,
    public readonly timestamp: Date
  ) {
    super();
  }
}

/**
 * Event triggered when a chat message is received
 */
export class ChatMessageReceivedEvent extends Event {
  public readonly type = 'ChatMessageReceived';
  
  constructor(
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly content: string,
    public readonly role: ChatMessageRole,
    public readonly timestamp: Date
  ) {
    super();
  }
}

/**
 * Event triggered when a chat session is closed
 */
export class ChatSessionClosedEvent extends Event {
  public readonly type = 'ChatSessionClosed';
  
  constructor(
    public readonly sessionId: string,
    public readonly closedAt: Date,
    public readonly reason?: string
  ) {
    super();
  }
}

/**
 * Event triggered when a chat session encounters an error
 */
export class ChatSessionErrorEvent extends Event {
  public readonly type = 'ChatSessionError';
  
  constructor(
    public readonly sessionId: string,
    public readonly error: Error,
    public readonly timestamp: Date
  ) {
    super();
  }
}

// Supporting types

export interface ChatSessionMetadata {
  title?: string;
  tags?: string[];
  context?: Record<string, any>;
  preferences?: ChatPreferences;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatPreferences {
  language?: string;
  responseFormat?: 'text' | 'markdown' | 'json';
  verbosity?: 'concise' | 'normal' | 'detailed';
  tone?: 'formal' | 'casual' | 'technical';
}

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: ChatSessionMetadata;
  messages: ChatMessage[];
  status: ChatSessionStatus;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: ChatMessageRole;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type ChatSessionStatus = 'active' | 'idle' | 'closed' | 'error';