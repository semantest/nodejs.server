/**
 * @fileoverview Session Domain Entity
 * @description Represents a user session in the authentication system
 * @author Web-Buddy Team
 */

export interface Session {
  id: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  status: SessionStatus;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
}

export enum SessionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}