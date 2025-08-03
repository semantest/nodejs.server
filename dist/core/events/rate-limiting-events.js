"use strict";
/**
 * @fileoverview Rate limiting events
 * @description Events for rate limiting, quota management, and throttling
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitCleanupRequestedEvent = exports.RateLimitAnalyticsGeneratedEvent = exports.RateLimitBlacklistUpdatedEvent = exports.RateLimitWhitelistUpdatedEvent = exports.RateLimitAlertTriggeredEvent = exports.RateLimitConfigurationUpdatedEvent = exports.RateLimitMetricsRequestedEvent = exports.RateLimitViolationDetectedEvent = exports.QuotaManagementRequestedEvent = exports.RateLimitExceededEvent = exports.RateLimitCheckRequestedEvent = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Rate limit check requested event
 */
class RateLimitCheckRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(identifier, endpoint, tier, metadata) {
        super();
        this.identifier = identifier;
        this.endpoint = endpoint;
        this.tier = tier;
        this.metadata = metadata;
    }
}
exports.RateLimitCheckRequestedEvent = RateLimitCheckRequestedEvent;
/**
 * Rate limit exceeded event
 */
class RateLimitExceededEvent extends typescript_eda_stubs_1.Event {
    constructor(identifier, endpoint, violationType, limit, actual, resetTime, metadata) {
        super();
        this.identifier = identifier;
        this.endpoint = endpoint;
        this.violationType = violationType;
        this.limit = limit;
        this.actual = actual;
        this.resetTime = resetTime;
        this.metadata = metadata;
    }
}
exports.RateLimitExceededEvent = RateLimitExceededEvent;
/**
 * Quota management requested event
 */
class QuotaManagementRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(operation, identifier, quotaData, metadata) {
        super();
        this.operation = operation;
        this.identifier = identifier;
        this.quotaData = quotaData;
        this.metadata = metadata;
    }
}
exports.QuotaManagementRequestedEvent = QuotaManagementRequestedEvent;
/**
 * Rate limit violation detected event
 */
class RateLimitViolationDetectedEvent extends typescript_eda_stubs_1.Event {
    constructor(identifier, endpoint, violationType, severity, details, metadata) {
        super();
        this.identifier = identifier;
        this.endpoint = endpoint;
        this.violationType = violationType;
        this.severity = severity;
        this.details = details;
        this.metadata = metadata;
    }
}
exports.RateLimitViolationDetectedEvent = RateLimitViolationDetectedEvent;
/**
 * Rate limit metrics requested event
 */
class RateLimitMetricsRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(timeframe, filters, metadata) {
        super();
        this.timeframe = timeframe;
        this.filters = filters;
        this.metadata = metadata;
    }
}
exports.RateLimitMetricsRequestedEvent = RateLimitMetricsRequestedEvent;
/**
 * Rate limit configuration updated event
 */
class RateLimitConfigurationUpdatedEvent extends typescript_eda_stubs_1.Event {
    constructor(configType, configData, metadata) {
        super();
        this.configType = configType;
        this.configData = configData;
        this.metadata = metadata;
    }
}
exports.RateLimitConfigurationUpdatedEvent = RateLimitConfigurationUpdatedEvent;
/**
 * Rate limit alert triggered event
 */
class RateLimitAlertTriggeredEvent extends typescript_eda_stubs_1.Event {
    constructor(alertId, alertName, condition, threshold, actual, affectedIdentifiers, metadata) {
        super();
        this.alertId = alertId;
        this.alertName = alertName;
        this.condition = condition;
        this.threshold = threshold;
        this.actual = actual;
        this.affectedIdentifiers = affectedIdentifiers;
        this.metadata = metadata;
    }
}
exports.RateLimitAlertTriggeredEvent = RateLimitAlertTriggeredEvent;
/**
 * Rate limit whitelist updated event
 */
class RateLimitWhitelistUpdatedEvent extends typescript_eda_stubs_1.Event {
    constructor(operation, identifier, type, reason, expiresAt, metadata) {
        super();
        this.operation = operation;
        this.identifier = identifier;
        this.type = type;
        this.reason = reason;
        this.expiresAt = expiresAt;
        this.metadata = metadata;
    }
}
exports.RateLimitWhitelistUpdatedEvent = RateLimitWhitelistUpdatedEvent;
/**
 * Rate limit blacklist updated event
 */
class RateLimitBlacklistUpdatedEvent extends typescript_eda_stubs_1.Event {
    constructor(operation, identifier, type, reason, severity, expiresAt, metadata) {
        super();
        this.operation = operation;
        this.identifier = identifier;
        this.type = type;
        this.reason = reason;
        this.severity = severity;
        this.expiresAt = expiresAt;
        this.metadata = metadata;
    }
}
exports.RateLimitBlacklistUpdatedEvent = RateLimitBlacklistUpdatedEvent;
/**
 * Rate limit analytics generated event
 */
class RateLimitAnalyticsGeneratedEvent extends typescript_eda_stubs_1.Event {
    constructor(period, analytics, metadata) {
        super();
        this.period = period;
        this.analytics = analytics;
        this.metadata = metadata;
    }
}
exports.RateLimitAnalyticsGeneratedEvent = RateLimitAnalyticsGeneratedEvent;
/**
 * Rate limit cleanup requested event
 */
class RateLimitCleanupRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(cleanupType, olderThan, metadata) {
        super();
        this.cleanupType = cleanupType;
        this.olderThan = olderThan;
        this.metadata = metadata;
    }
}
exports.RateLimitCleanupRequestedEvent = RateLimitCleanupRequestedEvent;
//# sourceMappingURL=rate-limiting-events.js.map