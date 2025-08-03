"use strict";
/**
 * @fileoverview Domain entities for authentication and authorization
 * @description Type definitions for users, tokens, API keys, and roles
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PERMISSIONS = exports.RATE_LIMIT_TIERS = void 0;
/**
 * Rate limiting tiers
 */
exports.RATE_LIMIT_TIERS = {
    free: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10,
        concurrentRequests: 5
    },
    premium: {
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstLimit: 50,
        concurrentRequests: 20
    },
    enterprise: {
        requestsPerMinute: 1000,
        requestsPerHour: 50000,
        requestsPerDay: 1000000,
        burstLimit: 200,
        concurrentRequests: 100
    }
};
/**
 * Default role permissions
 */
exports.DEFAULT_PERMISSIONS = {
    user: [
        'read:profile',
        'update:profile',
        'read:own-api-keys',
        'create:own-api-keys',
        'delete:own-api-keys'
    ],
    admin: [
        'read:users',
        'update:users',
        'delete:users',
        'read:api-keys',
        'create:api-keys',
        'delete:api-keys',
        'read:roles',
        'update:roles',
        'read:system-metrics'
    ],
    super_admin: [
        '*' // All permissions
    ]
};
//# sourceMappingURL=auth-entities.js.map