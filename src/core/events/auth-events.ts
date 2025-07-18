/**
 * @fileoverview Authentication and authorization events
 * @description Events for authentication flows and authorization checks
 * @author Web-Buddy Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Authentication requested event
 */
export class AuthenticationRequestedEvent extends Event {
  constructor(
    public readonly credentials: {
      email?: string;
      password?: string;
      apiKey?: string;
      provider?: string;
      code?: string;
      redirectUri?: string;
    },
    public readonly authMethod: 'password' | 'apiKey' | 'oauth2',
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      deviceId?: string;
    }
  ) {
    super();
  }
}

/**
 * Authorization requested event
 */
export class AuthorizationRequestedEvent extends Event {
  constructor(
    public readonly token: string,
    public readonly requiredPermissions: string[],
    public readonly resourceId?: string,
    public readonly metadata?: {
      ipAddress: string;
      userAgent: string;
      endpoint: string;
    }
  ) {
    super();
  }
}

/**
 * Token refresh requested event
 */
export class TokenRefreshRequestedEvent extends Event {
  constructor(
    public readonly refreshToken: string,
    public readonly metadata?: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * API key validation requested event
 */
export class ApiKeyValidationRequestedEvent extends Event {
  constructor(
    public readonly apiKey: string,
    public readonly endpoint: string,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * User registration requested event
 */
export class UserRegistrationRequestedEvent extends Event {
  constructor(
    public readonly userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      roles?: string[];
    },
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * Password reset requested event
 */
export class PasswordResetRequestedEvent extends Event {
  constructor(
    public readonly email: string,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * OAuth2 authentication requested event
 */
export class OAuth2AuthenticationRequestedEvent extends Event {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    public readonly redirectUri: string,
    public readonly state?: string,
    public readonly metadata?: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * Rate limit exceeded event
 */
export class RateLimitExceededEvent extends Event {
  constructor(
    public readonly identifier: string, // API key or IP address
    public readonly endpoint: string,
    public readonly currentCount: number,
    public readonly limit: number,
    public readonly windowSeconds: number,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * Session expired event
 */
export class SessionExpiredEvent extends Event {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly expiredAt: Date,
    public readonly metadata?: {
      ipAddress: string;
      userAgent: string;
    }
  ) {
    super();
  }
}

/**
 * Suspicious activity detected event
 */
export class SuspiciousActivityDetectedEvent extends Event {
  constructor(
    public readonly userId: string,
    public readonly activityType: string,
    public readonly riskScore: number,
    public readonly details: Record<string, any>,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}