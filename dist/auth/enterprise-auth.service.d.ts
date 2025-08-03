/**
 * @fileoverview Enterprise authentication service with multi-tenant support
 * @description Main service orchestrating organization, team, and SSO management
 * @author Web-Buddy Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { AuthService } from './auth-service';
import { OrganizationManagementService } from './services/organization-management.service';
import { TeamManagementService } from './services/team-management.service';
import { EnterpriseSSOService } from './services/enterprise-sso.service';
import { Organization, Team, EnterpriseUser, OrganizationMembership, TeamMembership, SSOConfiguration, AuditLogEntry } from './domain/enterprise-entities';
/**
 * Enterprise authentication service with comprehensive multi-tenant support
 */
export declare class EnterpriseAuthService extends Application {
    readonly metadata: Map<string, string>;
    private authService;
    private organizationService;
    private teamService;
    private ssoService;
    private auditLogs;
    constructor(authService?: AuthService, organizationService?: OrganizationManagementService, teamService?: TeamManagementService, ssoService?: EnterpriseSSOService);
    /**
     * Organization Management
     */
    /**
     * Create new organization
     */
    createOrganization(data: {
        name: string;
        displayName: string;
        description?: string;
        domain?: string;
        tier: 'free' | 'premium' | 'enterprise';
        ownerId: string;
        settings?: any;
    }): Promise<Organization>;
    /**
     * Get organization with full context
     */
    getOrganizationWithContext(organizationId: string): Promise<{
        organization: Organization;
        members: OrganizationMembership[];
        teams: Team[];
        ssoConfigurations: SSOConfiguration[];
        usage: any;
    }>;
    /**
     * Team Management
     */
    /**
     * Create team with enterprise features
     */
    createTeam(data: {
        organizationId: string;
        name: string;
        displayName: string;
        description?: string;
        type: 'department' | 'project' | 'custom';
        parentTeamId?: string;
        createdBy: string;
        settings?: any;
        permissions?: any;
    }): Promise<Team>;
    /**
     * Get team with full hierarchy
     */
    getTeamWithHierarchy(teamId: string): Promise<{
        team: Team;
        members: TeamMembership[];
        children: Team[];
        stats: any;
    }>;
    /**
     * User Management
     */
    /**
     * Create enterprise user with organization context
     */
    createEnterpriseUser(data: {
        email: string;
        firstName: string;
        lastName: string;
        password?: string;
        organizationId: string;
        teamIds?: string[];
        roles?: string[];
        ssoEnabled?: boolean;
        createdBy: string;
    }): Promise<EnterpriseUser>;
    /**
     * Get user with enterprise context
     */
    getUserWithEnterpriseContext(userId: string): Promise<{
        user: EnterpriseUser;
        organizations: Organization[];
        teams: Team[];
        permissions: {
            global: string[];
            organizational: Record<string, string[]>;
            team: Record<string, string[]>;
        };
    }>;
    /**
     * SSO Management
     */
    /**
     * Setup SSO for organization
     */
    setupSSO(data: {
        organizationId: string;
        provider: 'saml' | 'oidc' | 'oauth2' | 'ldap';
        name: string;
        displayName: string;
        config: any;
        mappings: any;
        createdBy: string;
    }): Promise<SSOConfiguration>;
    /**
     * Handle SSO login
     */
    handleSSOLogin(configId: string, redirectUrl?: string): Promise<{
        authUrl: string;
        sessionId: string;
    }>;
    /**
     * Audit and Compliance
     */
    /**
     * Create audit log entry
     */
    createAuditLog(data: {
        organizationId: string;
        userId?: string;
        sessionId?: string;
        action: string;
        resource: string;
        resourceId?: string;
        details: Record<string, any>;
        ipAddress: string;
        userAgent: string;
        severity: 'info' | 'warn' | 'error' | 'critical';
        category: 'auth' | 'user' | 'organization' | 'team' | 'api' | 'system';
    }): Promise<AuditLogEntry>;
    /**
     * Get audit logs for organization
     */
    getAuditLogs(organizationId: string, filters?: {
        userId?: string;
        action?: string;
        resource?: string;
        severity?: string;
        category?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<AuditLogEntry[]>;
    /**
     * Permission Management
     */
    /**
     * Check comprehensive permissions
     */
    checkPermission(userId: string, organizationId: string, permission: string, teamId?: string, resourceId?: string): Promise<boolean>;
    /**
     * Helper methods
     */
    private generateAuditId;
    private generateTemporaryPassword;
}
//# sourceMappingURL=enterprise-auth.service.d.ts.map