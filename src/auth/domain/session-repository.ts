/**
 * @fileoverview Session Repository Interface
 * @description Defines the contract for session data persistence
 * @author Web-Buddy Team
 */

import { Session, SessionStatus } from './session';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  findActiveByUserId(userId: string): Promise<Session[]>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  updateStatus(id: string, status: SessionStatus): Promise<void>;
}