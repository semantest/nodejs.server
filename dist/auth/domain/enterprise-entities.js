"use strict";
/**
 * @fileoverview Enterprise domain entities for multi-tenant user management
 * @description Type definitions for organizations, teams, and enterprise features
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTERPRISE_ROLES = exports.ENTERPRISE_PLANS = void 0;
/**
 * Enterprise subscription plans
 */
exports.ENTERPRISE_PLANS = {
    free: {
        name: 'Free',
        maxUsers: 3,
        maxTeams: 1,
        maxApiKeys: 5,
        maxProjects: 3,
        maxStorageGB: 1,
        maxBandwidthGB: 10,
        maxRequestsPerMonth: 10000,
        features: ['basic_auth', 'basic_rbac']
    },
    premium: {
        name: 'Premium',
        maxUsers: 25,
        maxTeams: 10,
        maxApiKeys: 50,
        maxProjects: 25,
        maxStorageGB: 100,
        maxBandwidthGB: 500,
        maxRequestsPerMonth: 100000,
        features: ['advanced_auth', 'team_management', 'api_analytics']
    },
    enterprise: {
        name: 'Enterprise',
        maxUsers: -1, // Unlimited
        maxTeams: -1,
        maxApiKeys: -1,
        maxProjects: -1,
        maxStorageGB: 1000,
        maxBandwidthGB: 5000,
        maxRequestsPerMonth: 1000000,
        features: ['sso', 'advanced_rbac', 'audit_logs', 'custom_branding', 'priority_support']
    }
};
/**
 * Enterprise role definitions
 */
exports.ENTERPRISE_ROLES = {
    // Organization roles
    org_owner: {
        name: 'Organization Owner',
        description: 'Full control over organization',
        permissions: ['*']
    },
    org_admin: {
        name: 'Organization Admin',
        description: 'Manage users and teams',
        permissions: [
            'read:organization',
            'update:organization',
            'read:users',
            'create:users',
            'update:users',
            'delete:users',
            'read:teams',
            'create:teams',
            'update:teams',
            'delete:teams',
            'read:audit-logs',
            'manage:billing'
        ]
    },
    org_member: {
        name: 'Organization Member',
        description: 'Basic organization access',
        permissions: [
            'read:organization',
            'read:own-profile',
            'update:own-profile',
            'read:own-teams'
        ]
    },
    // Team roles
    team_lead: {
        name: 'Team Lead',
        description: 'Manage team members and projects',
        permissions: [
            'read:team',
            'update:team',
            'read:team-members',
            'invite:team-members',
            'remove:team-members',
            'read:team-projects',
            'create:team-projects',
            'update:team-projects'
        ]
    },
    team_member: {
        name: 'Team Member',
        description: 'Basic team access',
        permissions: [
            'read:team',
            'read:team-members',
            'read:team-projects',
            'contribute:team-projects'
        ]
    }
};
//# sourceMappingURL=enterprise-entities.js.map