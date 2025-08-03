/**
 * @fileoverview WebSocket Event Schemas for Extension Integration
 * @description Real-time event definitions for browser extension communication
 * @issue #23 - NewChatRequested event notifications
 * @issue #24 - Image generation restrictions
 * @author Alex - Semantest Team
 * @version 1.0.0
 */

import { z } from 'zod';
import { JobStatus, ImageProvider, ImageSize, ImageGenerationResult, ErrorDetails } from './image-generation-api.schema';

// ===== WebSocket Event Types =====

export enum WSEventType {
  // Connection Events
  CONNECTION_ACK = 'connection.ack',
  CONNECTION_ERROR = 'connection.error',
  AUTH_SUCCESS = 'auth.success',
  AUTH_FAILURE = 'auth.failure',
  
  // Chat Events
  NEW_CHAT_REQUESTED = 'chat.new_requested',
  CHAT_MESSAGE_RECEIVED = 'chat.message_received',
  CHAT_SESSION_CLOSED = 'chat.session_closed',
  
  // Image Generation Events
  IMAGE_JOB_CREATED = 'image.job_created',
  IMAGE_JOB_QUEUED = 'image.job_queued',
  IMAGE_JOB_STARTED = 'image.job_started',
  IMAGE_JOB_PROGRESS = 'image.job_progress',
  IMAGE_JOB_COMPLETED = 'image.job_completed',
  IMAGE_JOB_FAILED = 'image.job_failed',
  IMAGE_JOB_CANCELLED = 'image.job_cancelled',
  
  // Capability Events
  QUOTA_UPDATED = 'capability.quota_updated',
  RESTRICTION_CHANGED = 'capability.restriction_changed',
  FEATURE_TOGGLED = 'capability.feature_toggled',
  
  // System Events
  MAINTENANCE_NOTICE = 'system.maintenance_notice',
  RATE_LIMIT_WARNING = 'system.rate_limit_warning',
  SERVER_NOTIFICATION = 'system.notification'
}

// ===== Base Event Schema =====

export const BaseWSEventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(WSEventType),
  timestamp: z.string().datetime(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type BaseWSEvent = z.infer<typeof BaseWSEventSchema>;

// ===== Connection Events =====

export interface ConnectionAckEvent extends BaseWSEvent {
  type: WSEventType.CONNECTION_ACK;
  data: {
    connectionId: string;
    serverTime: string;
    version: string;
    capabilities: string[];
  };
}

export interface AuthSuccessEvent extends BaseWSEvent {
  type: WSEventType.AUTH_SUCCESS;
  data: {
    userId: string;
    permissions: string[];
    quotaInfo: {
      dailyLimit: number;
      remaining: number;
      resetAt: string;
    };
  };
}

// ===== Chat Events =====

export interface NewChatRequestedEvent extends BaseWSEvent {
  type: WSEventType.NEW_CHAT_REQUESTED;
  data: {
    chatSessionId: string;
    messageId: string;
    prompt: string;
    imageGenerationRequested: boolean;
    imageJobId?: string;
    timestamp: string;
  };
}

export interface ChatMessageReceivedEvent extends BaseWSEvent {
  type: WSEventType.CHAT_MESSAGE_RECEIVED;
  data: {
    chatSessionId: string;
    messageId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: {
      images?: Array<{
        url: string;
        thumbnailUrl: string;
        size: string;
      }>;
    };
  };
}

// ===== Image Generation Events =====

export interface ImageJobCreatedEvent extends BaseWSEvent {
  type: WSEventType.IMAGE_JOB_CREATED;
  data: {
    jobId: string;
    chatSessionId?: string;
    prompt: string;
    provider: ImageProvider;
    size: ImageSize;
    count: number;
    estimatedCompletionTime: string;
    priority: 'low' | 'normal' | 'high';
  };
}

export interface ImageJobProgressEvent extends BaseWSEvent {
  type: WSEventType.IMAGE_JOB_PROGRESS;
  data: {
    jobId: string;
    status: JobStatus;
    progress: number; // 0-100
    message?: string;
  };
}

export interface ImageJobCompletedEvent extends BaseWSEvent {
  type: WSEventType.IMAGE_JOB_COMPLETED;
  data: {
    jobId: string;
    chatSessionId?: string;
    result: ImageGenerationResult;
    processingTime: number;
  };
}

export interface ImageJobFailedEvent extends BaseWSEvent {
  type: WSEventType.IMAGE_JOB_FAILED;
  data: {
    jobId: string;
    error: ErrorDetails;
    canRetry: boolean;
  };
}

// ===== Capability Events =====

export interface QuotaUpdatedEvent extends BaseWSEvent {
  type: WSEventType.QUOTA_UPDATED;
  data: {
    dailyLimit: number;
    remaining: number;
    used: number;
    resetAt: string;
    reason: 'generation' | 'reset' | 'adjustment';
  };
}

export interface RestrictionChangedEvent extends BaseWSEvent {
  type: WSEventType.RESTRICTION_CHANGED;
  data: {
    restrictionType: 'rate_limit' | 'quota' | 'feature' | 'size' | 'provider';
    enabled: boolean;
    details: {
      oldValue: any;
      newValue: any;
      effectiveAt: string;
    };
    message?: string;
  };
}

// ===== Client -> Server Messages =====

export const WSClientMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'auth.login',
    'chat.send_message',
    'image.generate',
    'image.cancel_job',
    'subscription.update',
    'ping'
  ]),
  data: z.any(),
  timestamp: z.string().datetime()
});

export type WSClientMessage = z.infer<typeof WSClientMessageSchema>;

// ===== Subscription Management =====

export interface SubscriptionRequest {
  id: string;
  type: 'subscription.update';
  data: {
    subscribe?: WSEventType[];
    unsubscribe?: WSEventType[];
  };
}

// ===== Type Guards =====

export function isImageEvent(event: BaseWSEvent): boolean {
  return event.type.startsWith('image.');
}

export function isChatEvent(event: BaseWSEvent): boolean {
  return event.type.startsWith('chat.');
}

export function isCapabilityEvent(event: BaseWSEvent): boolean {
  return event.type.startsWith('capability.');
}

// ===== WebSocket Connection Options =====

export interface WSConnectionOptions {
  url: string;
  auth: {
    type: 'jwt' | 'apiKey';
    token: string;
  };
  reconnect: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
  heartbeat: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  subscriptions: WSEventType[];
}

// ===== Export All Event Types =====

export type WSEvent = 
  | ConnectionAckEvent
  | AuthSuccessEvent
  | NewChatRequestedEvent
  | ChatMessageReceivedEvent
  | ImageJobCreatedEvent
  | ImageJobProgressEvent
  | ImageJobCompletedEvent
  | ImageJobFailedEvent
  | QuotaUpdatedEvent
  | RestrictionChangedEvent;