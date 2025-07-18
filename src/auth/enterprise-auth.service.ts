/**
 * @fileoverview Enterprise authentication service with multi-tenant support
 * @description Main service orchestrating organization, team, and SSO management
 * @author Web-Buddy Team
 */

import { Application, Enable, listen } from '../stubs/typescript-eda-stubs';
import { AuthService } from './auth-service';
import { OrganizationManagementService } from './services/organization-management.service';
import { TeamManagementService } from './services/team-management.service';
import { EnterpriseSSOService } from './services/enterprise-sso.service';
import {
  Organization,
  Team,
  EnterpriseUser,
  OrganizationMembership,
  TeamMembership,
  Invitation,
  SSOConfiguration,
  AuditLogEntry
} from './domain/enterprise-entities';

/**
 * Enterprise authentication service with comprehensive multi-tenant support
 */
@Enable(AuthService)
@Enable(OrganizationManagementService)
@Enable(TeamManagementService)
@Enable(EnterpriseSSOService)
export class EnterpriseAuthService extends Application {
  public readonly metadata = new Map([
    ['name', 'Web-Buddy Enterprise Authentication Service'],
    ['version', '1.0.0'],
    ['capabilities', 'multi-tenant,organizations,teams,sso,audit,rbac'],
    ['supportedSSOProviders', 'saml,oidc,oauth2,ldap'],
    ['auditCompliance', 'soc2,gdpr,hipaa']
  ]);

  private authService!: AuthService;
  private organizationService!: OrganizationManagementService;
  private teamService!: TeamManagementService;
  private ssoService!: EnterpriseSSOService;
  private auditLogs: Map<string, AuditLogEntry[]> = new Map();

  /**
   * Organization Management
   */

  /**
   * Create new organization
   */
  async createOrganization(data: {
    name: string;
    displayName: string;
    description?: string;
    domain?: string;
    tier: 'free' | 'premium' | 'enterprise';
    ownerId: string;
    settings?: any;
  }): Promise<Organization> {
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
    } catch (error) {
      console.error('❌ Failed to create organization:', error);
      throw error;
    }
  }

  /**
   * Get organization with full context
   */
  async getOrganizationWithContext(organizationId: string): Promise<{
    organization: Organization;
    members: OrganizationMembership[];
    teams: Team[];
    ssoConfigurations: SSOConfiguration[];
    usage: any;
  }> {
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
  async createTeam(data: {
    organizationId: string;
    name: string;
    displayName: string;
    description?: string;
    type: 'department' | 'project' | 'custom';
    parentTeamId?: string;
    createdBy: string;
    settings?: any;
    permissions?: any;
  }): Promise<Team> {
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
    } catch (error) {
      console.error('❌ Failed to create team:', error);
      throw error;
    }
  }

  /**
   * Get team with full hierarchy
   */
  async getTeamWithHierarchy(teamId: string): Promise<{
    team: Team;
    members: TeamMembership[];
    children: Team[];
    stats: any;
  }> {
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
  async createEnterpriseUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    organizationId: string;
    teamIds?: string[];
    roles?: string[];
    ssoEnabled?: boolean;
    createdBy: string;
  }): Promise<EnterpriseUser> {
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
      await this.organizationService.addUserToOrganization(
        data.organizationId,
        baseUser.id,
        data.roles?.[0] || 'org_member'
      );
      
      // Add to teams if specified
      if (data.teamIds) {
        for (const teamId of data.teamIds) {
          await this.teamService.addUserToTeam(teamId, baseUser.id);
        }
      }
      
      // Create enterprise user profile
      const enterpriseUser: EnterpriseUser = {
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
    } catch (error) {
      console.error('❌ Failed to create enterprise user:', error);
      throw error;
    }
  }

  /**
   * Get user with enterprise context
   */
  async getUserWithEnterpriseContext(userId: string): Promise<{
    user: EnterpriseUser;
    organizations: Organization[];
    teams: Team[];
    permissions: {
      global: string[];
      organizational: Record<string, string[]>;
      team: Record<string, string[]>;
    };
  }> {
    // Mock implementation - in real app, this would query the database
    const user: EnterpriseUser = {
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
  async setupSSO(data: {
    organizationId: string;
    provider: 'saml' | 'oidc' | 'oauth2' | 'ldap';
    name: string;
    displayName: string;
    config: any;
    mappings: any;
    createdBy: string;
  }): Promise<SSOConfiguration> {
    try {
      const ssoConfig = await this.ssoService.createSSOConfiguration(data);
      
      // Update organization settings
      await this.organizationService.updateOrganization(data.organizationId, {
        settings: {
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
    } catch (error) {
      console.error('❌ Failed to setup SSO:', error);
      throw error;
    }
  }

  /**
   * Handle SSO login
   */
  async handleSSOLogin(configId: string, redirectUrl?: string): Promise<{
    authUrl: string;
    sessionId: string;
  }> {
    try {
      const result = await this.ssoService.initiateSSOLogin(configId, redirectUrl);
      
      console.log(`✅ SSO login initiated for config: ${configId}`);
      
      return result;
    } catch (error) {
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
  async createAuditLog(data: {
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
  }): Promise<AuditLogEntry> {
    const auditEntry: AuditLogEntry = {
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
  async getAuditLogs(organizationId: string, filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    severity?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let logs = this.auditLogs.get(organizationId) || [];
    
    // Apply filters
    if (filters) {
      logs = logs.filter(log => {
        if (filters.userId && log.userId !== filters.userId) return false;
        if (filters.action && log.action !== filters.action) return false;
        if (filters.resource && log.resource !== filters.resource) return false;
        if (filters.severity && log.severity !== filters.severity) return false;
        if (filters.category && log.category !== filters.category) return false;
        if (filters.startDate && log.timestamp < filters.startDate) return false;
        if (filters.endDate && log.timestamp > filters.endDate) return false;
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
  async checkPermission(
    userId: string,
    organizationId: string,
    permission: string,
    teamId?: string,
    resourceId?: string
  ): Promise<boolean> {
    try {
      // Check organization permission
      const hasOrgPermission = await this.organizationService.checkOrganizationPermission(
        organizationId,
        userId,
        permission
      );
      
      if (hasOrgPermission) {
        return true;
      }
      
      // Check team permission if specified
      if (teamId) {
        const hasTeamPermission = await this.teamService.checkTeamPermission(
          teamId,
          userId,
          permission
        );
        
        if (hasTeamPermission) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Permission check failed:', error);
      return false;
    }
  }

  /**
   * Helper methods
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTemporaryPassword(): string {
    return Math.random().toString(36).substr(2, 12);
  }
}