/**
 * @fileoverview User Domain Entity
 * @description Represents a user in the authentication system
 * @author Web-Buddy Team
 */

export interface User {
  id: string;
  email: string;
  password: string; // Hashed password
  name?: string;
  extensionId?: string;
  apiKey?: string; // Hashed API key
  roles: string[];
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  loginAttempts: number;
  lockedUntil: Date | null;
}

export type UserWithoutPassword = Omit<User, 'password' | 'apiKey'>;

/**
 * User roles
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  EXTENSION = 'extension'
}

/**
 * User status
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification'
}