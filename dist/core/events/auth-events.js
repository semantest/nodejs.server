"use strict";
/**
 * @fileoverview Authentication and authorization events
 * @description Events for authentication flows and authorization checks
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuspiciousActivityDetectedEvent = exports.SessionExpiredEvent = exports.RateLimitExceededEvent = exports.OAuth2AuthenticationRequestedEvent = exports.PasswordResetRequestedEvent = exports.UserRegistrationRequestedEvent = exports.ApiKeyValidationRequestedEvent = exports.TokenRefreshRequestedEvent = exports.AuthorizationRequestedEvent = exports.AuthenticationRequestedEvent = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Authentication requested event
 */
class AuthenticationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(credentials, authMethod, metadata) {
        super();
        this.credentials = credentials;
        this.authMethod = authMethod;
        this.metadata = metadata;
    }
}
exports.AuthenticationRequestedEvent = AuthenticationRequestedEvent;
/**
 * Authorization requested event
 */
class AuthorizationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(token, requiredPermissions, resourceId, metadata) {
        super();
        this.token = token;
        this.requiredPermissions = requiredPermissions;
        this.resourceId = resourceId;
        this.metadata = metadata;
    }
}
exports.AuthorizationRequestedEvent = AuthorizationRequestedEvent;
/**
 * Token refresh requested event
 */
class TokenRefreshRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(refreshToken, metadata) {
        super();
        this.refreshToken = refreshToken;
        this.metadata = metadata;
    }
}
exports.TokenRefreshRequestedEvent = TokenRefreshRequestedEvent;
/**
 * API key validation requested event
 */
class ApiKeyValidationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(apiKey, endpoint, metadata) {
        super();
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.metadata = metadata;
    }
}
exports.ApiKeyValidationRequestedEvent = ApiKeyValidationRequestedEvent;
/**
 * User registration requested event
 */
class UserRegistrationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(userData, metadata) {
        super();
        this.userData = userData;
        this.metadata = metadata;
    }
}
exports.UserRegistrationRequestedEvent = UserRegistrationRequestedEvent;
/**
 * Password reset requested event
 */
class PasswordResetRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(email, metadata) {
        super();
        this.email = email;
        this.metadata = metadata;
    }
}
exports.PasswordResetRequestedEvent = PasswordResetRequestedEvent;
/**
 * OAuth2 authentication requested event
 */
class OAuth2AuthenticationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(provider, code, redirectUri, state, metadata) {
        super();
        this.provider = provider;
        this.code = code;
        this.redirectUri = redirectUri;
        this.state = state;
        this.metadata = metadata;
    }
}
exports.OAuth2AuthenticationRequestedEvent = OAuth2AuthenticationRequestedEvent;
/**
 * Rate limit exceeded event
 */
class RateLimitExceededEvent extends typescript_eda_stubs_1.Event {
    constructor(identifier, // API key or IP address
    endpoint, currentCount, limit, windowSeconds, metadata) {
        super();
        this.identifier = identifier;
        this.endpoint = endpoint;
        this.currentCount = currentCount;
        this.limit = limit;
        this.windowSeconds = windowSeconds;
        this.metadata = metadata;
    }
}
exports.RateLimitExceededEvent = RateLimitExceededEvent;
/**
 * Session expired event
 */
class SessionExpiredEvent extends typescript_eda_stubs_1.Event {
    constructor(sessionId, userId, expiredAt, metadata) {
        super();
        this.sessionId = sessionId;
        this.userId = userId;
        this.expiredAt = expiredAt;
        this.metadata = metadata;
    }
}
exports.SessionExpiredEvent = SessionExpiredEvent;
/**
 * Suspicious activity detected event
 */
class SuspiciousActivityDetectedEvent extends typescript_eda_stubs_1.Event {
    constructor(userId, activityType, riskScore, details, metadata) {
        super();
        this.userId = userId;
        this.activityType = activityType;
        this.riskScore = riskScore;
        this.details = details;
        this.metadata = metadata;
    }
}
exports.SuspiciousActivityDetectedEvent = SuspiciousActivityDetectedEvent;
//# sourceMappingURL=auth-events.js.map