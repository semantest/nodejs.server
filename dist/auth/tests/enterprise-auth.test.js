"use strict";
/**
 * @fileoverview Comprehensive tests for enterprise authentication system
 * @description Tests for multi-tenant organizations, teams, SSO, and permissions
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const enterprise_auth_service_1 = require("../enterprise-auth.service");
const auth_service_1 = require("../auth-service");
const organization_management_service_1 = require("../services/organization-management.service");
const team_management_service_1 = require("../services/team-management.service");
const enterprise_sso_service_1 = require("../services/enterprise-sso.service");
(0, globals_1.describe)('EnterpriseAuthService', () => {
    let enterpriseAuthService;
    let organizationService;
    let teamService;
    let ssoService;
    (0, globals_1.beforeEach)(() => {
        organizationService = new organization_management_service_1.OrganizationManagementService();
        teamService = new team_management_service_1.TeamManagementService();
        ssoService = new enterprise_sso_service_1.EnterpriseSSOService();
        const authService = new auth_service_1.AuthService();
        enterpriseAuthService = new enterprise_auth_service_1.EnterpriseAuthService(authService, organizationService, teamService, ssoService);
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.describe)('Organization Management', () => {
        (0, globals_1.it)('should create a new organization successfully', async () => {
            const organizationData = {
                name: 'test-org',
                displayName: 'Test Organization',
                description: 'A test organization',
                tier: 'premium',
                ownerId: 'user_123'
            };
            const organization = await organizationService.createOrganization(organizationData);
            (0, globals_1.expect)(organization).toBeDefined();
            (0, globals_1.expect)(organization.name).toBe(organizationData.name);
            (0, globals_1.expect)(organization.displayName).toBe(organizationData.displayName);
            (0, globals_1.expect)(organization.tier).toBe(organizationData.tier);
            (0, globals_1.expect)(organization.ownerId).toBe(organizationData.ownerId);
            (0, globals_1.expect)(organization.status).toBe('active');
            (0, globals_1.expect)(organization.id).toMatch(/^org_/);
        });
        (0, globals_1.it)('should enforce unique domain names', async () => {
            const orgData1 = {
                name: 'org1',
                displayName: 'Organization 1',
                domain: 'example.com',
                tier: 'premium',
                ownerId: 'user_123'
            };
            const orgData2 = {
                name: 'org2',
                displayName: 'Organization 2',
                domain: 'example.com',
                tier: 'premium',
                ownerId: 'user_456'
            };
            await organizationService.createOrganization(orgData1);
            await (0, globals_1.expect)(organizationService.createOrganization(orgData2))
                .rejects
                .toThrow('Domain is already taken');
        });
        (0, globals_1.it)('should add user to organization with correct role', async () => {
            const organization = await organizationService.createOrganization({
                name: 'test-org',
                displayName: 'Test Organization',
                tier: 'premium',
                ownerId: 'user_123'
            });
            const membership = await organizationService.addUserToOrganization(organization.id, 'user_456', 'org_member');
            (0, globals_1.expect)(membership).toBeDefined();
            (0, globals_1.expect)(membership.organizationId).toBe(organization.id);
            (0, globals_1.expect)(membership.userId).toBe('user_456');
            (0, globals_1.expect)(membership.role).toBe('org_member');
            (0, globals_1.expect)(membership.status).toBe('active');
        });
        (0, globals_1.it)('should enforce user limits based on organization tier', async () => {
            const organization = await organizationService.createOrganization({
                name: 'free-org',
                displayName: 'Free Organization',
                tier: 'free',
                ownerId: 'user_123'
            });
            // Add users up to the free tier limit (3 users including owner)
            await organizationService.addUserToOrganization(organization.id, 'user_456');
            await organizationService.addUserToOrganization(organization.id, 'user_789');
            // Try to add a fourth user - should fail
            await (0, globals_1.expect)(organizationService.addUserToOrganization(organization.id, 'user_101')).rejects.toThrow('Organization has reached its user limit');
        });
        (0, globals_1.it)('should create and accept organization invitations', async () => {
            const organization = await organizationService.createOrganization({
                name: 'test-org',
                displayName: 'Test Organization',
                tier: 'premium',
                ownerId: 'user_123'
            });
            const invitation = await organizationService.createInvitation({
                organizationId: organization.id,
                invitedEmail: 'newuser@example.com',
                invitedBy: 'user_123',
                role: 'org_member',
                expiresInDays: 7
            });
            (0, globals_1.expect)(invitation).toBeDefined();
            (0, globals_1.expect)(invitation.organizationId).toBe(organization.id);
            (0, globals_1.expect)(invitation.invitedEmail).toBe('newuser@example.com');
            (0, globals_1.expect)(invitation.status).toBe('pending');
            (0, globals_1.expect)(invitation.token).toBeDefined();
            const membership = await organizationService.acceptInvitation(invitation.token, 'user_456');
            (0, globals_1.expect)(membership).toBeDefined();
            (0, globals_1.expect)(membership.organizationId).toBe(organization.id);
            (0, globals_1.expect)(membership.userId).toBe('user_456');
            (0, globals_1.expect)(membership.role).toBe('org_member');
        });
    });
    (0, globals_1.describe)('Team Management', () => {
        let organization;
        (0, globals_1.beforeEach)(async () => {
            organization = await organizationService.createOrganization({
                name: 'test-org',
                displayName: 'Test Organization',
                tier: 'premium',
                ownerId: 'user_123'
            });
        });
        (0, globals_1.it)('should create a new team successfully', async () => {
            const teamData = {
                organizationId: organization.id,
                name: 'development',
                displayName: 'Development Team',
                description: 'Software development team',
                type: 'department',
                createdBy: 'user_123'
            };
            const team = await teamService.createTeam(teamData);
            (0, globals_1.expect)(team).toBeDefined();
            (0, globals_1.expect)(team.organizationId).toBe(organization.id);
            (0, globals_1.expect)(team.name).toBe(teamData.name);
            (0, globals_1.expect)(team.displayName).toBe(teamData.displayName);
            (0, globals_1.expect)(team.type).toBe(teamData.type);
            (0, globals_1.expect)(team.createdBy).toBe(teamData.createdBy);
            (0, globals_1.expect)(team.id).toMatch(/^team_/);
        });
        (0, globals_1.it)('should enforce unique team names within organization', async () => {
            const teamData1 = {
                organizationId: organization.id,
                name: 'development',
                displayName: 'Development Team',
                type: 'department',
                createdBy: 'user_123'
            };
            const teamData2 = {
                organizationId: organization.id,
                name: 'development',
                displayName: 'Another Development Team',
                type: 'project',
                createdBy: 'user_456'
            };
            await teamService.createTeam(teamData1);
            await (0, globals_1.expect)(teamService.createTeam(teamData2))
                .rejects
                .toThrow('Team name is already taken in this organization');
        });
        (0, globals_1.it)('should support hierarchical team structure', async () => {
            const parentTeam = await teamService.createTeam({
                organizationId: organization.id,
                name: 'engineering',
                displayName: 'Engineering',
                type: 'department',
                createdBy: 'user_123'
            });
            const childTeam = await teamService.createTeam({
                organizationId: organization.id,
                name: 'frontend',
                displayName: 'Frontend Team',
                type: 'project',
                parentTeamId: parentTeam.id,
                createdBy: 'user_123'
            });
            (0, globals_1.expect)(childTeam.parentTeamId).toBe(parentTeam.id);
            (0, globals_1.expect)(childTeam.permissions.inheritFromParent).toBe(true);
            const hierarchy = await teamService.getTeamHierarchy(parentTeam.id);
            (0, globals_1.expect)(hierarchy).toHaveLength(1);
            (0, globals_1.expect)(hierarchy[0].id).toBe(childTeam.id);
        });
        (0, globals_1.it)('should add users to teams with correct roles', async () => {
            const team = await teamService.createTeam({
                organizationId: organization.id,
                name: 'development',
                displayName: 'Development Team',
                type: 'department',
                createdBy: 'user_123'
            });
            const membership = await teamService.addUserToTeam(team.id, 'user_456', 'team_member');
            (0, globals_1.expect)(membership).toBeDefined();
            (0, globals_1.expect)(membership.teamId).toBe(team.id);
            (0, globals_1.expect)(membership.userId).toBe('user_456');
            (0, globals_1.expect)(membership.role).toBe('team_member');
            (0, globals_1.expect)(membership.status).toBe('active');
        });
        (0, globals_1.it)('should prevent removal of the only team lead', async () => {
            const team = await teamService.createTeam({
                organizationId: organization.id,
                name: 'development',
                displayName: 'Development Team',
                type: 'department',
                createdBy: 'user_123'
            });
            // Creator becomes team lead automatically
            await (0, globals_1.expect)(teamService.removeUserFromTeam(team.id, 'user_123')).rejects.toThrow('Cannot remove the only team lead');
        });
    });
    (0, globals_1.describe)('SSO Management', () => {
        let organization;
        (0, globals_1.beforeEach)(async () => {
            organization = await organizationService.createOrganization({
                name: 'enterprise-org',
                displayName: 'Enterprise Organization',
                tier: 'enterprise',
                ownerId: 'user_123'
            });
        });
        (0, globals_1.it)('should create SAML SSO configuration', async () => {
            const ssoData = {
                organizationId: organization.id,
                provider: 'saml',
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
            (0, globals_1.expect)(ssoConfig).toBeDefined();
            (0, globals_1.expect)(ssoConfig.organizationId).toBe(organization.id);
            (0, globals_1.expect)(ssoConfig.provider).toBe('saml');
            (0, globals_1.expect)(ssoConfig.name).toBe(ssoData.name);
            (0, globals_1.expect)(ssoConfig.isActive).toBe(true);
            (0, globals_1.expect)(ssoConfig.config).toEqual(ssoData.config);
        });
        (0, globals_1.it)('should create OIDC SSO configuration', async () => {
            const ssoData = {
                organizationId: organization.id,
                provider: 'oidc',
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
            (0, globals_1.expect)(ssoConfig).toBeDefined();
            (0, globals_1.expect)(ssoConfig.provider).toBe('oidc');
            (0, globals_1.expect)(ssoConfig.config.clientId).toBe(ssoData.config.clientId);
            (0, globals_1.expect)(ssoConfig.config.scopes).toEqual(ssoData.config.scopes);
        });
        (0, globals_1.it)('should validate SSO configuration requirements', async () => {
            const invalidSamlConfig = {
                organizationId: organization.id,
                provider: 'saml',
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
            await (0, globals_1.expect)(ssoService.createSSOConfiguration(invalidSamlConfig)).rejects.toThrow('Missing required SAML configuration');
        });
        (0, globals_1.it)('should initiate SSO login flow', async () => {
            const ssoConfig = await ssoService.createSSOConfiguration({
                organizationId: organization.id,
                provider: 'oidc',
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
            (0, globals_1.expect)(loginResult).toBeDefined();
            (0, globals_1.expect)(loginResult.authUrl).toContain('https://company.com/oauth/authorize');
            (0, globals_1.expect)(loginResult.sessionId).toMatch(/^ssosess_/);
        });
    });
    (0, globals_1.describe)('Permission Management', () => {
        let organization;
        let team;
        let user;
        (0, globals_1.beforeEach)(async () => {
            organization = await organizationService.createOrganization({
                name: 'test-org',
                displayName: 'Test Organization',
                tier: 'premium',
                ownerId: 'user_123'
            });
            team = await teamService.createTeam({
                organizationId: organization.id,
                name: 'development',
                displayName: 'Development Team',
                type: 'department',
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
        (0, globals_1.it)('should check organization permissions correctly', async () => {
            // Organization owner should have all permissions
            const ownerPermission = await organizationService.checkOrganizationPermission(organization.id, 'user_123', 'create:users');
            (0, globals_1.expect)(ownerPermission).toBe(true);
            // Regular member should not have admin permissions
            const memberPermission = await organizationService.checkOrganizationPermission(organization.id, user.id, 'create:users');
            (0, globals_1.expect)(memberPermission).toBe(false);
            // Regular member should have basic permissions
            const basicPermission = await organizationService.checkOrganizationPermission(organization.id, user.id, 'read:own-profile');
            (0, globals_1.expect)(basicPermission).toBe(true);
        });
        (0, globals_1.it)('should check team permissions correctly', async () => {
            // Team lead should have team management permissions
            const leadPermission = await teamService.checkTeamPermission(team.id, 'user_123', 'invite:team-members');
            (0, globals_1.expect)(leadPermission).toBe(true);
            // Team member should have basic team permissions (user already added in beforeEach)
            const memberPermission = await teamService.checkTeamPermission(team.id, user.id, 'read:team');
            (0, globals_1.expect)(memberPermission).toBe(true);
            // Team member should not have management permissions
            const managementPermission = await teamService.checkTeamPermission(team.id, user.id, 'remove:team-members');
            (0, globals_1.expect)(managementPermission).toBe(false);
        });
        (0, globals_1.it)('should support comprehensive permission checking', async () => {
            // Check combined organizational and team permissions
            const hasPermission = await enterpriseAuthService.checkPermission(user.id, organization.id, 'read:team', team.id);
            (0, globals_1.expect)(hasPermission).toBe(true);
        });
    });
    (0, globals_1.describe)('Audit Logging', () => {
        let organization;
        (0, globals_1.beforeEach)(async () => {
            organization = await organizationService.createOrganization({
                name: 'audit-org',
                displayName: 'Audit Organization',
                tier: 'enterprise',
                ownerId: 'user_123'
            });
        });
        (0, globals_1.it)('should create audit log entries', async () => {
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
                severity: 'info',
                category: 'user'
            };
            const auditEntry = await enterpriseAuthService.createAuditLog(auditData);
            (0, globals_1.expect)(auditEntry).toBeDefined();
            (0, globals_1.expect)(auditEntry.organizationId).toBe(organization.id);
            (0, globals_1.expect)(auditEntry.userId).toBe('user_123');
            (0, globals_1.expect)(auditEntry.action).toBe('user.created');
            (0, globals_1.expect)(auditEntry.resource).toBe('user');
            (0, globals_1.expect)(auditEntry.severity).toBe('info');
            (0, globals_1.expect)(auditEntry.category).toBe('user');
            (0, globals_1.expect)(auditEntry.id).toMatch(/^audit_/);
        });
        (0, globals_1.it)('should retrieve audit logs with filters', async () => {
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
            (0, globals_1.expect)(allLogs).toHaveLength(2);
            // Filter by category
            const userLogs = await enterpriseAuthService.getAuditLogs(organization.id, {
                category: 'user'
            });
            (0, globals_1.expect)(userLogs).toHaveLength(1);
            (0, globals_1.expect)(userLogs[0].category).toBe('user');
            // Filter by action
            const teamLogs = await enterpriseAuthService.getAuditLogs(organization.id, {
                action: 'team.created'
            });
            (0, globals_1.expect)(teamLogs).toHaveLength(1);
            (0, globals_1.expect)(teamLogs[0].action).toBe('team.created');
        });
    });
    (0, globals_1.describe)('Integration Tests', () => {
        (0, globals_1.it)('should handle complete enterprise user lifecycle', async () => {
            // 1. Create organization
            const organization = await organizationService.createOrganization({
                name: 'lifecycle-org',
                displayName: 'Lifecycle Organization',
                tier: 'enterprise',
                ownerId: 'owner_123'
            });
            // 2. Create team
            const team = await teamService.createTeam({
                organizationId: organization.id,
                name: 'engineering',
                displayName: 'Engineering Team',
                type: 'department',
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
            const canReadTeam = await enterpriseAuthService.checkPermission(user.id, organization.id, 'read:team', team.id);
            (0, globals_1.expect)(canReadTeam).toBe(true);
            // 6. Verify audit logs were created
            const auditLogs = await enterpriseAuthService.getAuditLogs(organization.id);
            (0, globals_1.expect)(auditLogs.length).toBeGreaterThan(0);
            // 7. Get full user context
            const userContext = await enterpriseAuthService.getUserWithEnterpriseContext(user.id);
            (0, globals_1.expect)(userContext.user).toBeDefined();
            (0, globals_1.expect)(userContext.organizations).toHaveLength(1);
            (0, globals_1.expect)(userContext.teams).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=enterprise-auth.test.js.map