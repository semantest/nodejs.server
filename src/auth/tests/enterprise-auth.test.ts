/**
 * @fileoverview Comprehensive tests for enterprise authentication system
 * @description Tests for multi-tenant organizations, teams, SSO, and permissions
 * @author Web-Buddy Team
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnterpriseAuthService } from '../enterprise-auth.service';
import { AuthService } from '../auth-service';
import { OrganizationManagementService } from '../services/organization-management.service';
import { TeamManagementService } from '../services/team-management.service';
import { EnterpriseSSOService } from '../services/enterprise-sso.service';
import {
  Organization,
  Team,
  EnterpriseUser,
  OrganizationMembership,
  TeamMembership,
  SSOConfiguration,
  AuditLogEntry
} from '../domain/enterprise-entities';

describe('EnterpriseAuthService', () => {
  let enterpriseAuthService: EnterpriseAuthService;
  let organizationService: OrganizationManagementService;
  let teamService: TeamManagementService;
  let ssoService: EnterpriseSSOService;

  beforeEach(() => {
    organizationService = new OrganizationManagementService();
    teamService = new TeamManagementService();
    ssoService = new EnterpriseSSOService();
    const authService = new AuthService();
    enterpriseAuthService = new EnterpriseAuthService(
      authService,
      organizationService,
      teamService,
      ssoService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Organization Management', () => {
    it('should create a new organization successfully', async () => {
      const organizationData = {
        name: 'test-org',
        displayName: 'Test Organization',
        description: 'A test organization',
        tier: 'premium' as const,
        ownerId: 'user_123'
      };

      const organization = await organizationService.createOrganization(organizationData);

      expect(organization).toBeDefined();
      expect(organization.name).toBe(organizationData.name);
      expect(organization.displayName).toBe(organizationData.displayName);
      expect(organization.tier).toBe(organizationData.tier);
      expect(organization.ownerId).toBe(organizationData.ownerId);
      expect(organization.status).toBe('active');
      expect(organization.id).toMatch(/^org_/);
    });

    it('should enforce unique domain names', async () => {
      const orgData1 = {
        name: 'org1',
        displayName: 'Organization 1',
        domain: 'example.com',
        tier: 'premium' as const,
        ownerId: 'user_123'
      };

      const orgData2 = {
        name: 'org2',
        displayName: 'Organization 2',
        domain: 'example.com',
        tier: 'premium' as const,
        ownerId: 'user_456'
      };

      await organizationService.createOrganization(orgData1);
      
      await expect(organizationService.createOrganization(orgData2))
        .rejects
        .toThrow('Domain is already taken');
    });

    it('should add user to organization with correct role', async () => {
      const organization = await organizationService.createOrganization({
        name: 'test-org',
        displayName: 'Test Organization',
        tier: 'premium' as const,
        ownerId: 'user_123'
      });

      const membership = await organizationService.addUserToOrganization(
        organization.id,
        'user_456',
        'org_member'
      );

      expect(membership).toBeDefined();
      expect(membership.organizationId).toBe(organization.id);
      expect(membership.userId).toBe('user_456');
      expect(membership.role).toBe('org_member');
      expect(membership.status).toBe('active');
    });

    it('should enforce user limits based on organization tier', async () => {
      const organization = await organizationService.createOrganization({
        name: 'free-org',
        displayName: 'Free Organization',
        tier: 'free' as const,
        ownerId: 'user_123'
      });

      // Add users up to the free tier limit (3 users including owner)
      await organizationService.addUserToOrganization(organization.id, 'user_456');
      await organizationService.addUserToOrganization(organization.id, 'user_789');

      // Try to add a fourth user - should fail
      await expect(
        organizationService.addUserToOrganization(organization.id, 'user_101')
      ).rejects.toThrow('Organization has reached its user limit');
    });

    it('should create and accept organization invitations', async () => {
      const organization = await organizationService.createOrganization({
        name: 'test-org',
        displayName: 'Test Organization',
        tier: 'premium' as const,
        ownerId: 'user_123'
      });

      const invitation = await organizationService.createInvitation({
        organizationId: organization.id,
        invitedEmail: 'newuser@example.com',
        invitedBy: 'user_123',
        role: 'org_member',
        expiresInDays: 7
      });

      expect(invitation).toBeDefined();
      expect(invitation.organizationId).toBe(organization.id);
      expect(invitation.invitedEmail).toBe('newuser@example.com');
      expect(invitation.status).toBe('pending');
      expect(invitation.token).toBeDefined();

      const membership = await organizationService.acceptInvitation(
        invitation.token,
        'user_456'
      );

      expect(membership).toBeDefined();
      expect(membership.organizationId).toBe(organization.id);
      expect(membership.userId).toBe('user_456');
      expect(membership.role).toBe('org_member');
    });
  });

  describe('Team Management', () => {
    let organization: Organization;

    beforeEach(async () => {
      organization = await organizationService.createOrganization({
        name: 'test-org',
        displayName: 'Test Organization',
        tier: 'premium' as const,
        ownerId: 'user_123'
      });
    });

    it('should create a new team successfully', async () => {
      const teamData = {
        organizationId: organization.id,
        name: 'development',
        displayName: 'Development Team',
        description: 'Software development team',
        type: 'department' as const,
        createdBy: 'user_123'
      };

      const team = await teamService.createTeam(teamData);

      expect(team).toBeDefined();
      expect(team.organizationId).toBe(organization.id);
      expect(team.name).toBe(teamData.name);
      expect(team.displayName).toBe(teamData.displayName);
      expect(team.type).toBe(teamData.type);
      expect(team.createdBy).toBe(teamData.createdBy);
      expect(team.id).toMatch(/^team_/);
    });

    it('should enforce unique team names within organization', async () => {
      const teamData1 = {
        organizationId: organization.id,
        name: 'development',
        displayName: 'Development Team',
        type: 'department' as const,
        createdBy: 'user_123'
      };

      const teamData2 = {
        organizationId: organization.id,
        name: 'development',
        displayName: 'Another Development Team',
        type: 'project' as const,
        createdBy: 'user_456'
      };

      await teamService.createTeam(teamData1);
      
      await expect(teamService.createTeam(teamData2))
        .rejects
        .toThrow('Team name is already taken in this organization');
    });

    it('should support hierarchical team structure', async () => {
      const parentTeam = await teamService.createTeam({
        organizationId: organization.id,
        name: 'engineering',
        displayName: 'Engineering',
        type: 'department' as const,
        createdBy: 'user_123'
      });

      const childTeam = await teamService.createTeam({
        organizationId: organization.id,
        name: 'frontend',
        displayName: 'Frontend Team',
        type: 'project' as const,
        parentTeamId: parentTeam.id,
        createdBy: 'user_123'
      });

      expect(childTeam.parentTeamId).toBe(parentTeam.id);
      expect(childTeam.permissions.inheritFromParent).toBe(true);

      const hierarchy = await teamService.getTeamHierarchy(parentTeam.id);
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].id).toBe(childTeam.id);
    });

    it('should add users to teams with correct roles', async () => {
      const team = await teamService.createTeam({
        organizationId: organization.id,
        name: 'development',
        displayName: 'Development Team',
        type: 'department' as const,
        createdBy: 'user_123'
      });

      const membership = await teamService.addUserToTeam(
        team.id,
        'user_456',
        'team_member'
      );

      expect(membership).toBeDefined();
      expect(membership.teamId).toBe(team.id);
      expect(membership.userId).toBe('user_456');
      expect(membership.role).toBe('team_member');
      expect(membership.status).toBe('active');
    });

    it('should prevent removal of the only team lead', async () => {
      const team = await teamService.createTeam({
        organizationId: organization.id,
        name: 'development',
        displayName: 'Development Team',
        type: 'department' as const,
        createdBy: 'user_123'
      });

      // Creator becomes team lead automatically
      await expect(
        teamService.removeUserFromTeam(team.id, 'user_123')
      ).rejects.toThrow('Cannot remove the only team lead');
    });
  });

  describe('SSO Management', () => {
    let organization: Organization;

    beforeEach(async () => {
      organization = await organizationService.createOrganization({
        name: 'enterprise-org',
        displayName: 'Enterprise Organization',
        tier: 'enterprise' as const,
        ownerId: 'user_123'
      });
    });

    it('should create SAML SSO configuration', async () => {
      const ssoData = {
        organizationId: organization.id,
        provider: 'saml' as const,
        name: 'company-saml',
        displayName: 'Company SAML',
        config: {
          entityId: 'https://company.com/saml',
          ssoUrl: 'https://company.com/saml/sso',
          certificate: 'MOCK_CERTIFICATE'
        },
        mappings: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        }
      };

      const ssoConfig = await ssoService.createSSOConfiguration(ssoData);

      expect(ssoConfig).toBeDefined();
      expect(ssoConfig.organizationId).toBe(organization.id);
      expect(ssoConfig.provider).toBe('saml');
      expect(ssoConfig.name).toBe(ssoData.name);
      expect(ssoConfig.isActive).toBe(true);
      expect(ssoConfig.config).toEqual(ssoData.config);
    });

    it('should create OIDC SSO configuration', async () => {
      const ssoData = {
        organizationId: organization.id,
        provider: 'oidc' as const,
        name: 'company-oidc',
        displayName: 'Company OIDC',
        config: {
          clientId: 'client123',
          clientSecret: 'secret456',
          authorizationUrl: 'https://company.com/oauth/authorize',
          tokenUrl: 'https://company.com/oauth/token',
          userInfoUrl: 'https://company.com/oauth/userinfo',
          scopes: ['openid', 'profile', 'email']
        },
        mappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        }
      };

      const ssoConfig = await ssoService.createSSOConfiguration(ssoData);

      expect(ssoConfig).toBeDefined();
      expect(ssoConfig.provider).toBe('oidc');
      expect(ssoConfig.config.clientId).toBe(ssoData.config.clientId);
      expect(ssoConfig.config.scopes).toEqual(ssoData.config.scopes);
    });

    it('should validate SSO configuration requirements', async () => {
      const invalidSamlConfig = {
        organizationId: organization.id,
        provider: 'saml' as const,
        name: 'invalid-saml',
        displayName: 'Invalid SAML',
        config: {
          entityId: 'https://company.com/saml'
          // Missing required ssoUrl and certificate
        },
        mappings: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        }
      };

      await expect(
        ssoService.createSSOConfiguration(invalidSamlConfig)
      ).rejects.toThrow('Missing required SAML configuration');
    });

    it('should initiate SSO login flow', async () => {
      const ssoConfig = await ssoService.createSSOConfiguration({
        organizationId: organization.id,
        provider: 'oidc' as const,
        name: 'company-oidc',
        displayName: 'Company OIDC',
        config: {
          clientId: 'client123',
          clientSecret: 'secret456',
          authorizationUrl: 'https://company.com/oauth/authorize',
          tokenUrl: 'https://company.com/oauth/token',
          userInfoUrl: 'https://company.com/oauth/userinfo'
        },
        mappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        }
      });

      const loginResult = await ssoService.initiateSSOLogin(ssoConfig.id);

      expect(loginResult).toBeDefined();
      expect(loginResult.authUrl).toContain('https://company.com/oauth/authorize');
      expect(loginResult.sessionId).toMatch(/^ssosess_/);
    });
  });

  describe('Permission Management', () => {
    let organization: Organization;
    let team: Team;
    let user: EnterpriseUser;

    beforeEach(async () => {
      organization = await organizationService.createOrganization({
        name: 'test-org',
        displayName: 'Test Organization',
        tier: 'premium' as const,
        ownerId: 'user_123'
      });

      team = await teamService.createTeam({
        organizationId: organization.id,
        name: 'development',
        displayName: 'Development Team',
        type: 'department' as const,
        createdBy: 'user_123'
      });

      user = await enterpriseAuthService.createEnterpriseUser({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
        organizationId: organization.id,
        teamIds: [team.id],
        roles: ['org_member'],
        createdBy: 'user_123'
      });
    });

    it('should check organization permissions correctly', async () => {
      // Organization owner should have all permissions
      const ownerPermission = await organizationService.checkOrganizationPermission(
        organization.id,
        'user_123',
        'create:users'
      );
      expect(ownerPermission).toBe(true);

      // Regular member should not have admin permissions
      const memberPermission = await organizationService.checkOrganizationPermission(
        organization.id,
        user.id,
        'create:users'
      );
      expect(memberPermission).toBe(false);

      // Regular member should have basic permissions
      const basicPermission = await organizationService.checkOrganizationPermission(
        organization.id,
        user.id,
        'read:own-profile'
      );
      expect(basicPermission).toBe(true);
    });

    it('should check team permissions correctly', async () => {
      // Team lead should have team management permissions
      const leadPermission = await teamService.checkTeamPermission(
        team.id,
        'user_123',
        'invite:team-members'
      );
      expect(leadPermission).toBe(true);

      // Team member should have basic team permissions (user already added in beforeEach)
      const memberPermission = await teamService.checkTeamPermission(
        team.id,
        user.id,
        'read:team'
      );
      expect(memberPermission).toBe(true);

      // Team member should not have management permissions
      const managementPermission = await teamService.checkTeamPermission(
        team.id,
        user.id,
        'remove:team-members'
      );
      expect(managementPermission).toBe(false);
    });

    it('should support comprehensive permission checking', async () => {
      // Check combined organizational and team permissions
      const hasPermission = await enterpriseAuthService.checkPermission(
        user.id,
        organization.id,
        'read:team',
        team.id
      );
      
      expect(hasPermission).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    let organization: Organization;

    beforeEach(async () => {
      organization = await organizationService.createOrganization({
        name: 'audit-org',
        displayName: 'Audit Organization',
        tier: 'enterprise' as const,
        ownerId: 'user_123'
      });
    });

    it('should create audit log entries', async () => {
      const auditData = {
        organizationId: organization.id,
        userId: 'user_123',
        action: 'user.created',
        resource: 'user',
        resourceId: 'user_456',
        details: {
          email: 'test@example.com',
          roles: ['org_member']
        },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        severity: 'info' as const,
        category: 'user' as const
      };

      const auditEntry = await enterpriseAuthService.createAuditLog(auditData);

      expect(auditEntry).toBeDefined();
      expect(auditEntry.organizationId).toBe(organization.id);
      expect(auditEntry.userId).toBe('user_123');
      expect(auditEntry.action).toBe('user.created');
      expect(auditEntry.resource).toBe('user');
      expect(auditEntry.severity).toBe('info');
      expect(auditEntry.category).toBe('user');
      expect(auditEntry.id).toMatch(/^audit_/);
    });

    it('should retrieve audit logs with filters', async () => {
      // Create multiple audit entries
      await enterpriseAuthService.createAuditLog({
        organizationId: organization.id,
        userId: 'user_123',
        action: 'user.created',
        resource: 'user',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        severity: 'info',
        category: 'user'
      });

      await enterpriseAuthService.createAuditLog({
        organizationId: organization.id,
        userId: 'user_123',
        action: 'team.created',
        resource: 'team',
        details: {},
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        severity: 'info',
        category: 'team'
      });

      // Get all audit logs
      const allLogs = await enterpriseAuthService.getAuditLogs(organization.id);
      expect(allLogs).toHaveLength(2);

      // Filter by category
      const userLogs = await enterpriseAuthService.getAuditLogs(organization.id, {
        category: 'user'
      });
      expect(userLogs).toHaveLength(1);
      expect(userLogs[0].category).toBe('user');

      // Filter by action
      const teamLogs = await enterpriseAuthService.getAuditLogs(organization.id, {
        action: 'team.created'
      });
      expect(teamLogs).toHaveLength(1);
      expect(teamLogs[0].action).toBe('team.created');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete enterprise user lifecycle', async () => {
      // 1. Create organization
      const organization = await organizationService.createOrganization({
        name: 'lifecycle-org',
        displayName: 'Lifecycle Organization',
        tier: 'enterprise' as const,
        ownerId: 'owner_123'
      });

      // 2. Create team
      const team = await teamService.createTeam({
        organizationId: organization.id,
        name: 'engineering',
        displayName: 'Engineering Team',
        type: 'department' as const,
        createdBy: 'owner_123'
      });

      // 3. Setup SSO
      const ssoConfig = await ssoService.createSSOConfiguration({
        organizationId: organization.id,
        provider: 'oidc',
        name: 'company-sso',
        displayName: 'Company SSO',
        config: {
          clientId: 'client123',
          clientSecret: 'secret456',
          authorizationUrl: 'https://company.com/oauth/authorize',
          tokenUrl: 'https://company.com/oauth/token',
          userInfoUrl: 'https://company.com/oauth/userinfo'
        },
        mappings: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        }
      });

      // 4. Create enterprise user
      const user = await enterpriseAuthService.createEnterpriseUser({
        email: 'engineer@example.com',
        firstName: 'Jane',
        lastName: 'Engineer',
        organizationId: organization.id,
        teamIds: [team.id],
        roles: ['org_member'],
        ssoEnabled: true,
        createdBy: 'owner_123'
      });

      // 5. Verify user has correct permissions
      const canReadTeam = await enterpriseAuthService.checkPermission(
        user.id,
        organization.id,
        'read:team',
        team.id
      );
      expect(canReadTeam).toBe(true);

      // 6. Verify audit logs were created
      const auditLogs = await enterpriseAuthService.getAuditLogs(organization.id);
      expect(auditLogs.length).toBeGreaterThan(0);

      // 7. Get full user context
      const userContext = await enterpriseAuthService.getUserWithEnterpriseContext(user.id);
      expect(userContext.user).toBeDefined();
      expect(userContext.organizations).toHaveLength(1);
      expect(userContext.teams).toHaveLength(1);
    });
  });
});