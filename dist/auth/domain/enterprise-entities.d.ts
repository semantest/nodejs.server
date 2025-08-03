/**
 * @fileoverview Enterprise domain entities for multi-tenant user management
 * @description Type definitions for organizations, teams, and enterprise features
 * @author Web-Buddy Team
 */
/**
 * Organization entity for multi-tenant support
 */
export interface Organization {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    domain?: string;
    slug: string;
    tier: 'free' | 'premium' | 'enterprise';
    status: 'active' | 'suspended' | 'inactive';
    settings: OrganizationSettings;
    billing: BillingInfo;
    quotas: ResourceQuotas;
    createdAt: Date;
    updatedAt: Date;
    ownerId: string;
    metadata?: Record<string, any>;
}
/**
 * Organization settings and configuration
 */
export interface OrganizationSettings {
    ssoEnabled: boolean;
    ssoProvider?: string;
    ssoConfig?: Record<string, any>;
    domainRestrictions: string[];
    userInvitePolicy: 'open' | 'admin-only' | 'restricted';
    sessionTimeoutMinutes: number;
    enforcePasswordPolicy: boolean;
    enforceMfa: boolean;
    allowedAuthMethods: ('password' | 'sso' | 'apiKey')[];
    auditLogRetentionDays: number;
    dataRetentionDays: number;
    customBranding?: CustomBranding;
}
/**
 * Custom branding configuration
 */
export interface CustomBranding {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
    companyName?: string;
    supportEmail?: string;
    termsOfServiceUrl?: string;
    privacyPolicyUrl?: string;
}
/**
 * Billing information
 */
export interface BillingInfo {
    stripeCustomerId?: string;
    subscriptionId?: string;
    planId: string;
    status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd?: Date;
    billingEmail: string;
    billingAddress?: Address;
    paymentMethod?: PaymentMethod;
}
/**
 * Address information
 */
export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
}
/**
 * Payment method information
 */
export interface PaymentMethod {
    type: 'card' | 'bank_account' | 'paypal';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}
/**
 * Resource quotas and limits
 */
export interface ResourceQuotas {
    maxUsers: number;
    maxTeams: number;
    maxApiKeys: number;
    maxProjects: number;
    maxStorageGB: number;
    maxBandwidthGB: number;
    maxRequestsPerMonth: number;
    maxConcurrentSessions: number;
    customQuotas?: Record<string, number>;
}
/**
 * Team entity for organizing users within organizations
 */
export interface Team {
    id: string;
    organizationId: string;
    name: string;
    displayName: string;
    description?: string;
    slug: string;
    type: 'department' | 'project' | 'custom';
    permissions: TeamPermissions;
    settings: TeamSettings;
    parentTeamId?: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    metadata?: Record<string, any>;
}
/**
 * Team permissions configuration
 */
export interface TeamPermissions {
    defaultRole: string;
    inheritFromParent: boolean;
    customPermissions: string[];
    resourceAccess: ResourceAccess[];
}
/**
 * Resource access configuration
 */
export interface ResourceAccess {
    resource: string;
    actions: string[];
    conditions?: string[];
}
/**
 * Team settings
 */
export interface TeamSettings {
    isPrivate: boolean;
    allowMemberInvites: boolean;
    requireApprovalForJoin: boolean;
    maxMembers?: number;
    autoAssignNewUsers: boolean;
    notificationSettings: NotificationSettings;
}
/**
 * Notification settings
 */
export interface NotificationSettings {
    emailEnabled: boolean;
    slackEnabled: boolean;
    slackWebhook?: string;
    customWebhooks: string[];
    notifyOnUserJoin: boolean;
    notifyOnUserLeave: boolean;
    notifyOnPermissionChange: boolean;
}
/**
 * Enhanced user entity with organization and team associations
 */
export interface EnterpriseUser {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    title?: string;
    department?: string;
    location?: string;
    timezone?: string;
    locale?: string;
    phoneNumber?: string;
    organizationId: string;
    teamIds: string[];
    primaryTeamId?: string;
    roles: string[];
    globalPermissions: string[];
    teamPermissions: Record<string, string[]>;
    status: 'active' | 'suspended' | 'pending' | 'inactive';
    isActive: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    twoFactorEnabled: boolean;
    ssoEnabled: boolean;
    ssoProvider?: string;
    ssoUserId?: string;
    lastPasswordChange?: Date;
    mustChangePassword: boolean;
    passwordExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    lastSeenAt?: Date;
    loginAttempts: number;
    lockedUntil?: Date;
    sessionIds: string[];
    consentGiven: boolean;
    consentDate?: Date;
    dataProcessingAgreement: boolean;
    gdprCompliant: boolean;
    metadata?: Record<string, any>;
}
/**
 * Team membership with role and status
 */
export interface TeamMembership {
    id: string;
    teamId: string;
    userId: string;
    role: string;
    permissions: string[];
    status: 'active' | 'pending' | 'suspended';
    joinedAt: Date;
    invitedAt?: Date;
    invitedBy?: string;
    acceptedAt?: Date;
    leftAt?: Date;
    metadata?: Record<string, any>;
}
/**
 * Organization membership with role and billing
 */
export interface OrganizationMembership {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    permissions: string[];
    status: 'active' | 'pending' | 'suspended';
    joinedAt: Date;
    invitedAt?: Date;
    invitedBy?: string;
    acceptedAt?: Date;
    leftAt?: Date;
    isBillingContact: boolean;
    metadata?: Record<string, any>;
}
/**
 * Invitation for joining organization or team
 */
export interface Invitation {
    id: string;
    type: 'organization' | 'team';
    organizationId: string;
    teamId?: string;
    invitedEmail: string;
    invitedBy: string;
    role: string;
    permissions: string[];
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    token: string;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt?: Date;
    declinedAt?: Date;
    metadata?: Record<string, any>;
}
/**
 * SSO configuration for enterprise
 */
export interface SSOConfiguration {
    id: string;
    organizationId: string;
    provider: 'saml' | 'oidc' | 'oauth2' | 'ldap';
    name: string;
    displayName: string;
    isActive: boolean;
    config: SSOProviderConfig;
    mappings: AttributeMappings;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * SSO provider configuration
 */
export interface SSOProviderConfig {
    entityId?: string;
    ssoUrl?: string;
    sloUrl?: string;
    certificate?: string;
    clientId?: string;
    clientSecret?: string;
    discoveryUrl?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    serverUrl?: string;
    baseDN?: string;
    bindDN?: string;
    bindPassword?: string;
    scopes?: string[];
    additionalParams?: Record<string, any>;
}
/**
 * Attribute mappings for SSO
 */
export interface AttributeMappings {
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    groups?: string;
    department?: string;
    title?: string;
    phone?: string;
    customMappings?: Record<string, string>;
}
/**
 * Audit log entry for enterprise compliance
 */
export interface AuditLogEntry {
    id: string;
    organizationId: string;
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    severity: 'info' | 'warn' | 'error' | 'critical';
    category: 'auth' | 'user' | 'organization' | 'team' | 'api' | 'system';
}
/**
 * Enterprise subscription plans
 */
export declare const ENTERPRISE_PLANS: {
    readonly free: {
        readonly name: "Free";
        readonly maxUsers: 3;
        readonly maxTeams: 1;
        readonly maxApiKeys: 5;
        readonly maxProjects: 3;
        readonly maxStorageGB: 1;
        readonly maxBandwidthGB: 10;
        readonly maxRequestsPerMonth: 10000;
        readonly features: readonly ["basic_auth", "basic_rbac"];
    };
    readonly premium: {
        readonly name: "Premium";
        readonly maxUsers: 25;
        readonly maxTeams: 10;
        readonly maxApiKeys: 50;
        readonly maxProjects: 25;
        readonly maxStorageGB: 100;
        readonly maxBandwidthGB: 500;
        readonly maxRequestsPerMonth: 100000;
        readonly features: readonly ["advanced_auth", "team_management", "api_analytics"];
    };
    readonly enterprise: {
        readonly name: "Enterprise";
        readonly maxUsers: -1;
        readonly maxTeams: -1;
        readonly maxApiKeys: -1;
        readonly maxProjects: -1;
        readonly maxStorageGB: 1000;
        readonly maxBandwidthGB: 5000;
        readonly maxRequestsPerMonth: 1000000;
        readonly features: readonly ["sso", "advanced_rbac", "audit_logs", "custom_branding", "priority_support"];
    };
};
/**
 * Enterprise role definitions
 */
export declare const ENTERPRISE_ROLES: {
    readonly org_owner: {
        readonly name: "Organization Owner";
        readonly description: "Full control over organization";
        readonly permissions: readonly ["*"];
    };
    readonly org_admin: {
        readonly name: "Organization Admin";
        readonly description: "Manage users and teams";
        readonly permissions: readonly ["read:organization", "update:organization", "read:users", "create:users", "update:users", "delete:users", "read:teams", "create:teams", "update:teams", "delete:teams", "read:audit-logs", "manage:billing"];
    };
    readonly org_member: {
        readonly name: "Organization Member";
        readonly description: "Basic organization access";
        readonly permissions: readonly ["read:organization", "read:own-profile", "update:own-profile", "read:own-teams"];
    };
    readonly team_lead: {
        readonly name: "Team Lead";
        readonly description: "Manage team members and projects";
        readonly permissions: readonly ["read:team", "update:team", "read:team-members", "invite:team-members", "remove:team-members", "read:team-projects", "create:team-projects", "update:team-projects"];
    };
    readonly team_member: {
        readonly name: "Team Member";
        readonly description: "Basic team access";
        readonly permissions: readonly ["read:team", "read:team-members", "read:team-projects", "contribute:team-projects"];
    };
};
//# sourceMappingURL=enterprise-entities.d.ts.map