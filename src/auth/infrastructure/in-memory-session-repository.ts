/**
 * @fileoverview In-Memory Session Repository
 * @description Simple in-memory implementation of SessionRepository for development
 * @author Web-Buddy Team
 */

import { Session, SessionStatus } from '../domain/session';
import { SessionRepository } from '../domain/session-repository';

export class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId);
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    const now = new Date();
    return Array.from(this.sessions.values())
      .filter(session => 
        session.userId === userId && 
        session.status === SessionStatus.ACTIVE &&
        session.expiresAt > now
      );
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let deleted = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
      if (status === SessionStatus.TERMINATED) {
        session.endedAt = new Date();
      }
    }
  }

  // Development helper methods
  clear(): void {
    this.sessions.clear();
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }
}