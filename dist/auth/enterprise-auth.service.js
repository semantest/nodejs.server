"use strict";
/**
 * @fileoverview Enterprise authentication service with multi-tenant support
 * @description Main service orchestrating organization, team, and SSO management
 * @author Web-Buddy Team
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseAuthService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const auth_service_1 = require("./auth-service");
const organization_management_service_1 = require("./services/organization-management.service");
const team_management_service_1 = require("./services/team-management.service");
const enterprise_sso_service_1 = require("./services/enterprise-sso.service");
/**
 * Enterprise authentication service with comprehensive multi-tenant support
 */
let EnterpriseAuthService = class EnterpriseAuthService extends typescript_eda_stubs_1.Application {
    constructor(authService, organizationService, teamService, ssoService) {
        super();
        this.metadata = new Map([
            ['name', 'Web-Buddy Enterprise Authentication Service'],
            ['version', '1.0.0'],
            ['capabilities', 'multi-tenant,organizations,teams,sso,audit,rbac'],
            ['supportedSSOProviders', 'saml,oidc,oauth2,ldap'],
            ['auditCompliance', 'soc2,gdpr,hipaa']
        ]);
        this.auditLogs = new Map();
        this.authService = authService || new auth_service_1.AuthService();
        this.organizationService = organizationService || new organization_management_service_1.OrganizationManagementService();
        this.teamService = teamService || new team_management_service_1.TeamManagementService();
        this.ssoService = ssoService || new enterprise_sso_service_1.EnterpriseSSOService();
    }
    /**
     * Organization Management
     */
    /**
     * Create new organization
     */
    async createOrganization(data) {
        try {
            const organization = await this.organizationService.createOrganization(data);
            // Log audit entry
            await this.createAuditLog({
                organizationId: organization.id,
                userId: data.ownerId,
                action: 'organization.created',
                resource: 'organization',
                resourceId: organization.id,
                details: {
                    name: data.name,
                    tier: data.tier,
                    domain: data.domain
                },
                ipAddress: '127.0.0.1', // TODO: Get from request
                userAgent: 'Enterprise Auth Service',
                severity: 'info',
                category: 'organization'
            });
            console.log(`✅ Enterprise organization created: ${organization.name}`);
            return organization;
        }
        catch (error) {
            console.error('❌ Failed to create organization:', error);
            throw error;
        }
    }
    /**
     * Get organization with full context
     */
    async getOrganizationWithContext(organizationId) {
        const organization = await this.organizationService.getOrganization(organizationId);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const [members, teams, ssoConfigurations, usage] = await Promise.all([
            this.organizationService.getOrganizationMembers(organizationId),
            this.teamService.getOrganizationTeams(organizationId),
            this.ssoService.getOrganizationSSOConfigurations(organizationId),
            this.organizationService.getOrganizationUsage(organizationId)
        ]);
        return {
            organization,
            members,
            teams,
            ssoConfigurations,
            usage
        };
    }
    /**
     * Team Management
     */
    /**
     * Create team with enterprise features
     */
    async createTeam(data) {
        try {
            const team = await this.teamService.createTeam(data);
            // Log audit entry
            await this.createAuditLog({
                organizationId: data.organizationId,
                userId: data.createdBy,
                action: 'team.created',
                resource: 'team',
                resourceId: team.id,
                details: {
                    name: data.name,
                    type: data.type,
                    parentTeamId: data.parentTeamId
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Enterprise Auth Service',
                severity: 'info',
                category: 'team'
            });
            console.log(`✅ Enterprise team created: ${team.name}`);
            return team;
        }
        catch (error) {
            console.error('❌ Failed to create team:', error);
            throw error;
        }
    }
    /**
     * Get team with full hierarchy
     */
    async getTeamWithHierarchy(teamId) {
        const team = await this.teamService.getTeam(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        const [members, children, stats] = await Promise.all([
            this.teamService.getTeamMembers(teamId),
            this.teamService.getTeamHierarchy(teamId),
            this.teamService.getTeamStats(teamId)
        ]);
        return {
            team,
            members,
            children,
            stats
        };
    }
    /**
     * User Management
     */
    /**
     * Create enterprise user with organization context
     */
    async createEnterpriseUser(data) {
        try {
            // Create base user
            const baseUser = await this.authService.createUser({
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                password: data.password || this.generateTemporaryPassword(),
                roles: data.roles || ['org_member']
            });
            // Add to organization
            await this.organizationService.addUserToOrganization(data.organizationId, baseUser.id, data.roles?.[0] || 'org_member');
            // Add to teams if specified
            if (data.teamIds) {
                for (const teamId of data.teamIds) {
                    await this.teamService.addUserToTeam(teamId, baseUser.id);
                }
            }
            // Create enterprise user profile
            const enterpriseUser = {
                ...baseUser,
                organizationId: data.organizationId,
                teamIds: data.teamIds || [],
                globalPermissions: [],
                teamPermissions: {},
                status: 'active',
                emailVerified: false,
                phoneVerified: false,
                twoFactorEnabled: false,
                ssoEnabled: data.ssoEnabled || false,
                mustChangePassword: !data.password,
                loginAttempts: 0,
                sessionIds: [],
                consentGiven: false,
                dataProcessingAgreement: false,
                gdprCompliant: true
            };
            // Log audit entry
            await this.createAuditLog({
                organizationId: data.organizationId,
                userId: data.createdBy,
                action: 'user.created',
                resource: 'user',
                resourceId: baseUser.id,
                details: {
                    email: data.email,
                    roles: data.roles,
                    teamIds: data.teamIds
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Enterprise Auth Service',
                severity: 'info',
                category: 'user'
            });
            console.log(`✅ Enterprise user created: ${enterpriseUser.email}`);
            return enterpriseUser;
        }
        catch (error) {
            console.error('❌ Failed to create enterprise user:', error);
            throw error;
        }
    }
    /**
     * Get user with enterprise context
     */
    async getUserWithEnterpriseContext(userId) {
        // Mock implementation - in real app, this would query the database
        const user = {
            id: userId,
            email: 'user@example.com',
            passwordHash: '',
            firstName: 'John',
            lastName: 'Doe',
            organizationId: 'org_123',
            teamIds: ['team_123'],
            roles: ['org_member'],
            globalPermissions: [],
            teamPermissions: {},
            status: 'active',
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            twoFactorEnabled: false,
            ssoEnabled: false,
            mustChangePassword: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            loginAttempts: 0,
            sessionIds: [],
            consentGiven: true,
            dataProcessingAgreement: true,
            gdprCompliant: true
        };
        const organizations = await this.organizationService.getUserOrganizations(userId);
        const teams = await this.teamService.getUserTeams(userId);
        const permissions = {
            global: user.globalPermissions,
            organizational: {},
            team: user.teamPermissions
        };
        return {
            user,
            organizations,
            teams,
            permissions
        };
    }
    /**
     * SSO Management
     */
    /**
     * Setup SSO for organization
     */
    async setupSSO(data) {
        try {
            const ssoConfig = await this.ssoService.createSSOConfiguration(data);
            // Update organization settings
            const org = await this.organizationService.getOrganization(data.organizationId);
            await this.organizationService.updateOrganization(data.organizationId, {
                settings: {
                    ...org.settings,
                    ssoEnabled: true,
                    ssoProvider: data.provider
                }
            });
            // Log audit entry
            await this.createAuditLog({
                organizationId: data.organizationId,
                userId: data.createdBy,
                action: 'sso.configured',
                resource: 'sso_configuration',
                resourceId: ssoConfig.id,
                details: {
                    provider: data.provider,
                    name: data.name
                },
                ipAddress: '127.0.0.1',
                userAgent: 'Enterprise Auth Service',
                severity: 'info',
                category: 'auth'
            });
            console.log(`✅ SSO configured for organization: ${data.organizationId}`);
            return ssoConfig;
        }
        catch (error) {
            console.error('❌ Failed to setup SSO:', error);
            throw error;
        }
    }
    /**
     * Handle SSO login
     */
    async handleSSOLogin(configId, redirectUrl) {
        try {
            const result = await this.ssoService.initiateSSOLogin(configId, redirectUrl);
            console.log(`✅ SSO login initiated for config: ${configId}`);
            return result;
        }
        catch (error) {
            console.error('❌ Failed to initiate SSO login:', error);
            throw error;
        }
    }
    /**
     * Audit and Compliance
     */
    /**
     * Create audit log entry
     */
    async createAuditLog(data) {
        const auditEntry = {
            id: this.generateAuditId(),
            organizationId: data.organizationId,
            userId: data.userId,
            sessionId: data.sessionId,
            action: data.action,
            resource: data.resource,
            resourceId: data.resourceId,
            details: data.details,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            timestamp: new Date(),
            severity: data.severity,
            category: data.category
        };
        // Store audit log
        const orgAuditLogs = this.auditLogs.get(data.organizationId) || [];
        orgAuditLogs.push(auditEntry);
        this.auditLogs.set(data.organizationId, orgAuditLogs);
        // Log to console for high severity events
        if (data.severity === 'error' || data.severity === 'critical') {
            console.error(`🚨 Audit: ${data.action} on ${data.resource} by ${data.userId}`);
        }
        return auditEntry;
    }
    /**
     * Get audit logs for organization
     */
    async getAuditLogs(organizationId, filters) {
        let logs = this.auditLogs.get(organizationId) || [];
        // Apply filters
        if (filters) {
            logs = logs.filter(log => {
                if (filters.userId && log.userId !== filters.userId)
                    return false;
                if (filters.action && log.action !== filters.action)
                    return false;
                if (filters.resource && log.resource !== filters.resource)
                    return false;
                if (filters.severity && log.severity !== filters.severity)
                    return false;
                if (filters.category && log.category !== filters.category)
                    return false;
                if (filters.startDate && log.timestamp < filters.startDate)
                    return false;
                if (filters.endDate && log.timestamp > filters.endDate)
                    return false;
                return true;
            });
        }
        // Sort by timestamp (newest first)
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (filters?.limit) {
            logs = logs.slice(0, filters.limit);
        }
        return logs;
    }
    /**
     * Permission Management
     */
    /**
     * Check comprehensive permissions
     */
    async checkPermission(userId, organizationId, permission, teamId, resourceId) {
        try {
            // Check organization permission
            const hasOrgPermission = await this.organizationService.checkOrganizationPermission(organizationId, userId, permission);
            if (hasOrgPermission) {
                return true;
            }
            // Check team permission if specified
            if (teamId) {
                const hasTeamPermission = await this.teamService.checkTeamPermission(teamId, userId, permission);
                if (hasTeamPermission) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.error('❌ Permission check failed:', error);
            return false;
        }
    }
    /**
     * Helper methods
     */
    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTemporaryPassword() {
        return Math.random().toString(36).substr(2, 12);
    }
};
exports.EnterpriseAuthService = EnterpriseAuthService;
exports.EnterpriseAuthService = EnterpriseAuthService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(auth_service_1.AuthService),
    (0, typescript_eda_stubs_1.Enable)(organization_management_service_1.OrganizationManagementService),
    (0, typescript_eda_stubs_1.Enable)(team_management_service_1.TeamManagementService),
    (0, typescript_eda_stubs_1.Enable)(enterprise_sso_service_1.EnterpriseSSOService),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        organization_management_service_1.OrganizationManagementService,
        team_management_service_1.TeamManagementService,
        enterprise_sso_service_1.EnterpriseSSOService])
], EnterpriseAuthService);
//# sourceMappingURL=enterprise-auth.service.js.map