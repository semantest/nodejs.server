/**
 * @fileoverview In-Memory User Repository
 * @description Simple in-memory implementation of UserRepository for development
 * @author Web-Buddy Team
 */

import { User } from '../domain/user';
import { UserRepository } from '../domain/user-repository';

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> userId
  private extensionIndex: Map<string, string> = new Map(); // extensionId -> userId

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async findByExtensionId(extensionId: string): Promise<User | null> {
    const userId = this.extensionIndex.get(extensionId);
    return userId ? this.users.get(userId) || null : null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
    
    // Update indexes
    if (user.email) {
      this.emailIndex.set(user.email.toLowerCase(), user.id);
    }
    if (user.extensionId) {
      this.extensionIndex.set(user.extensionId, user.id);
    }
  }

  async delete(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.delete(id);
      if (user.email) {
        this.emailIndex.delete(user.email.toLowerCase());
      }
      if (user.extensionId) {
        this.extensionIndex.delete(user.extensionId);
      }
    }
  }

  async exists(id: string): Promise<boolean> {
    return this.users.has(id);
  }

  // Development helper methods
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
    this.extensionIndex.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}