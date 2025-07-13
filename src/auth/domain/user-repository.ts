/**
 * @fileoverview User Repository Interface
 * @description Defines the contract for user data persistence
 * @author Web-Buddy Team
 */

import { User } from './user';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByExtensionId(extensionId: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}