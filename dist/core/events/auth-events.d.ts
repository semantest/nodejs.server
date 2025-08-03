/**
 * @fileoverview Authentication and authorization events
 * @description Events for authentication flows and authorization checks
 * @author Web-Buddy Team
 */
import { Event } from '../../stubs/typescript-eda-stubs';
/**
 * Authentication requested event
 */
export declare class AuthenticationRequestedEvent extends Event {
    readonly credentials: {
        email?: string;
        password?: string;
        apiKey?: string;
        provider?: string;
        code?: string;
        redirectUri?: string;
    };
    readonly authMethod: 'password' | 'apiKey' | 'oauth2';
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        deviceId?: string;
    };
    constructor(credentials: {
        email?: string;
        password?: string;
        apiKey?: string;
        provider?: string;
        code?: string;
        redirectUri?: string;
    }, authMethod: 'password' | 'apiKey' | 'oauth2', metadata: {
        ipAddress: string;
        userAgent: string;
        deviceId?: string;
    });
}
/**
 * Authorization requested event
 */
export declare class AuthorizationRequestedEvent extends Event {
    readonly token: string;
    readonly requiredPermissions: string[];
    readonly resourceId?: string;
    readonly metadata?: {
        ipAddress: string;
        userAgent: string;
        endpoint: string;
    };
    constructor(token: string, requiredPermissions: string[], resourceId?: string, metadata?: {
        ipAddress: string;
        userAgent: string;
        endpoint: string;
    });
}
/**
 * Token refresh requested event
 */
export declare class TokenRefreshRequestedEvent extends Event {
    readonly refreshToken: string;
    readonly metadata?: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(refreshToken: string, metadata?: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * API key validation requested event
 */
export declare class ApiKeyValidationRequestedEvent extends Event {
    readonly apiKey: string;
    readonly endpoint: string;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(apiKey: string, endpoint: string, metadata: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * User registration requested event
 */
export declare class UserRegistrationRequestedEvent extends Event {
    readonly userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        roles?: string[];
    };
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        roles?: string[];
    }, metadata: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * Password reset requested event
 */
export declare class PasswordResetRequestedEvent extends Event {
    readonly email: string;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(email: string, metadata: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * OAuth2 authentication requested event
 */
export declare class OAuth2AuthenticationRequestedEvent extends Event {
    readonly provider: string;
    readonly code: string;
    readonly redirectUri: string;
    readonly state?: string;
    readonly metadata?: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(provider: string, code: string, redirectUri: string, state?: string, metadata?: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * Rate limit exceeded event
 */
export declare class RateLimitExceededEvent extends Event {
    readonly identifier: string;
    readonly endpoint: string;
    readonly currentCount: number;
    readonly limit: number;
    readonly windowSeconds: number;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(identifier: string, // API key or IP address
    endpoint: string, currentCount: number, limit: number, windowSeconds: number, metadata: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * Session expired event
 */
export declare class SessionExpiredEvent extends Event {
    readonly sessionId: string;
    readonly userId: string;
    readonly expiredAt: Date;
    readonly metadata?: {
        ipAddress: string;
        userAgent: string;
    };
    constructor(sessionId: string, userId: string, expiredAt: Date, metadata?: {
        ipAddress: string;
        userAgent: string;
    });
}
/**
 * Suspicious activity detected event
 */
export declare class SuspiciousActivityDetectedEvent extends Event {
    readonly userId: string;
    readonly activityType: string;
    readonly riskScore: number;
    readonly details: Record<string, any>;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    };
    constructor(userId: string, activityType: string, riskScore: number, details: Record<string, any>, metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    });
}
//# sourceMappingURL=auth-events.d.ts.map