"use strict";
/**
 * Tests for enterprise domain entities and interfaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
const enterprise_entities_1 = require("../enterprise-entities");
describe('Enterprise Entities', () => {
    describe('Organization Interface', () => {
        it('should create a valid organization', () => {
            const org = {
                id: 'org-123',
                name: 'acme-corp',
                displayName: 'ACME Corporation',
                description: 'A test organization',
                domain: 'acme.com',
                slug: 'acme',
                tier: 'enterprise',
                status: 'active',
                settings: {
                    ssoEnabled: true,
                    ssoProvider: 'saml',
                    domainRestrictions: ['acme.com'],
                    userInvitePolicy: 'admin-only',
                    sessionTimeoutMinutes: 480,
                    enforcePasswordPolicy: true,
                    enforceMfa: true,
                    allowedAuthMethods: ['password', 'sso'],
                    auditLogRetentionDays: 365,
                    dataRetentionDays: 730
                },
                billing: {
                    planId: 'enterprise-annual',
                    status: 'active',
                    currentPeriodStart: new Date('2024-01-01'),
                    currentPeriodEnd: new Date('2025-01-01'),
                    billingEmail: 'billing@acme.com'
                },
                quotas: {
                    maxUsers: -1,
                    maxTeams: -1,
                    maxApiKeys: -1,
                    maxProjects: -1,
                    maxStorageGB: 1000,
                    maxBandwidthGB: 5000,
                    maxRequestsPerMonth: 1000000,
                    maxConcurrentSessions: 1000
                },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                ownerId: 'user-123'
            };
            expect(org.tier).toBe('enterprise');
            expect(org.settings.ssoEnabled).toBe(true);
            expect(org.quotas.maxUsers).toBe(-1); // Unlimited
        });
        it('should handle different tiers', () => {
            const tiers = ['free', 'premium', 'enterprise'];
            tiers.forEach(tier => {
                const org = { tier };
                expect(org.tier).toBe(tier);
            });
        });
        it('should handle different statuses', () => {
            const statuses = ['active', 'suspended', 'inactive'];
            statuses.forEach(status => {
                const org = { status };
                expect(org.status).toBe(status);
            });
        });
    });
    describe('CustomBranding Interface', () => {
        it('should create custom branding configuration', () => {
            const branding = {
                logoUrl: 'https://acme.com/logo.png',
                primaryColor: '#007BFF',
                secondaryColor: '#6C757D',
                customDomain: 'app.acme.com',
                companyName: 'ACME Corporation',
                supportEmail: 'support@acme.com',
                termsOfServiceUrl: 'https://acme.com/terms',
                privacyPolicyUrl: 'https://acme.com/privacy'
            };
            expect(branding.primaryColor).toBe('#007BFF');
            expect(branding.customDomain).toBe('app.acme.com');
        });
    });
    describe('BillingInfo Interface', () => {
        it('should create billing info with payment method', () => {
            const billing = {
                stripeCustomerId: 'cus_123',
                subscriptionId: 'sub_456',
                planId: 'enterprise-monthly',
                status: 'active',
                currentPeriodStart: new Date('2024-01-01'),
                currentPeriodEnd: new Date('2024-02-01'),
                trialEnd: new Date('2024-01-15'),
                billingEmail: 'finance@acme.com',
                billingAddress: {
                    line1: '123 Main St',
                    line2: 'Suite 100',
                    city: 'San Francisco',
                    state: 'CA',
                    postalCode: '94105',
                    country: 'US'
                },
                paymentMethod: {
                    type: 'card',
                    last4: '4242',
                    brand: 'Visa',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    isDefault: true
                }
            };
            expect(billing.status).toBe('active');
            expect(billing.paymentMethod?.type).toBe('card');
            expect(billing.billingAddress?.city).toBe('San Francisco');
        });
        it('should handle different billing statuses', () => {
            const statuses = ['active', 'cancelled', 'past_due', 'unpaid'];
            statuses.forEach(status => {
                const billing = { status };
                expect(billing.status).toBe(status);
            });
        });
    });
    describe('Team Interface', () => {
        it('should create a valid team with hierarchy', () => {
            const team = {
                id: 'team-123',
                organizationId: 'org-123',
                name: 'engineering',
                displayName: 'Engineering Team',
                description: 'Product engineering team',
                slug: 'eng',
                type: 'department',
                permissions: {
                    defaultRole: 'team_member',
                    inheritFromParent: true,
                    customPermissions: ['deploy:production'],
                    resourceAccess: [{
                            resource: 'projects',
                            actions: ['read', 'write', 'delete'],
                            conditions: ['owned-by-team']
                        }]
                },
                settings: {
                    isPrivate: false,
                    allowMemberInvites: true,
                    requireApprovalForJoin: true,
                    maxMembers: 50,
                    autoAssignNewUsers: false,
                    notificationSettings: {
                        emailEnabled: true,
                        slackEnabled: true,
                        slackWebhook: 'https://hooks.slack.com/...',
                        customWebhooks: [],
                        notifyOnUserJoin: true,
                        notifyOnUserLeave: true,
                        notifyOnPermissionChange: true
                    }
                },
                parentTeamId: 'team-parent',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                createdBy: 'user-123'
            };
            expect(team.type).toBe('department');
            expect(team.permissions.resourceAccess[0].resource).toBe('projects');
            expect(team.settings.notificationSettings.slackEnabled).toBe(true);
        });
        it('should handle different team types', () => {
            const types = ['department', 'project', 'custom'];
            types.forEach(type => {
                const team = { type };
                expect(team.type).toBe(type);
            });
        });
    });
    describe('EnterpriseUser Interface', () => {
        it('should create a comprehensive enterprise user', () => {
            const user = {
                id: 'user-123',
                email: 'john.doe@acme.com',
                passwordHash: 'hashed_password',
                firstName: 'John',
                lastName: 'Doe',
                displayName: 'John Doe',
                avatar: 'https://acme.com/avatars/john.jpg',
                title: 'Senior Engineer',
                department: 'Engineering',
                location: 'San Francisco, CA',
                timezone: 'America/Los_Angeles',
                locale: 'en-US',
                phoneNumber: '+1-415-555-0123',
                organizationId: 'org-123',
                teamIds: ['team-123', 'team-456'],
                primaryTeamId: 'team-123',
                roles: ['org_member', 'team_lead'],
                globalPermissions: ['read:organization'],
                teamPermissions: {
                    'team-123': ['manage:team', 'deploy:production'],
                    'team-456': ['read:team']
                },
                status: 'active',
                isActive: true,
                emailVerified: true,
                phoneVerified: true,
                twoFactorEnabled: true,
                ssoEnabled: true,
                ssoProvider: 'saml',
                ssoUserId: 'saml-user-123',
                lastPasswordChange: new Date('2024-01-01'),
                mustChangePassword: false,
                passwordExpiresAt: new Date('2024-07-01'),
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-15'),
                lastLoginAt: new Date('2024-01-15'),
                lastSeenAt: new Date('2024-01-15'),
                loginAttempts: 0,
                sessionIds: ['session-123', 'session-456'],
                consentGiven: true,
                consentDate: new Date('2024-01-01'),
                dataProcessingAgreement: true,
                gdprCompliant: true,
                metadata: { employeeId: 'EMP123' }
            };
            expect(user.organizationId).toBe('org-123');
            expect(user.teamIds).toHaveLength(2);
            expect(user.ssoEnabled).toBe(true);
            expect(user.teamPermissions['team-123']).toContain('deploy:production');
        });
        it('should handle different user statuses', () => {
            const statuses = ['active', 'suspended', 'pending', 'inactive'];
            statuses.forEach(status => {
                const user = { status };
                expect(user.status).toBe(status);
            });
        });
    });
    describe('TeamMembership Interface', () => {
        it('should create team membership', () => {
            const membership = {
                id: 'membership-123',
                teamId: 'team-123',
                userId: 'user-123',
                role: 'team_lead',
                permissions: ['manage:team', 'deploy:production'],
                status: 'active',
                joinedAt: new Date('2024-01-01'),
                invitedAt: new Date('2023-12-25'),
                invitedBy: 'user-admin',
                acceptedAt: new Date('2024-01-01')
            };
            expect(membership.role).toBe('team_lead');
            expect(membership.permissions).toContain('manage:team');
        });
    });
    describe('Invitation Interface', () => {
        it('should create organization invitation', () => {
            const invitation = {
                id: 'invite-123',
                type: 'organization',
                organizationId: 'org-123',
                invitedEmail: 'newuser@example.com',
                invitedBy: 'user-admin',
                role: 'org_member',
                permissions: ['read:organization'],
                status: 'pending',
                token: 'invite_token_123',
                expiresAt: new Date('2024-02-01'),
                createdAt: new Date('2024-01-01')
            };
            expect(invitation.type).toBe('organization');
            expect(invitation.status).toBe('pending');
        });
        it('should create team invitation', () => {
            const invitation = {
                id: 'invite-456',
                type: 'team',
                organizationId: 'org-123',
                teamId: 'team-123',
                invitedEmail: 'teammate@example.com',
                invitedBy: 'user-lead',
                role: 'team_member',
                permissions: ['read:team'],
                status: 'accepted',
                token: 'invite_token_456',
                expiresAt: new Date('2024-02-01'),
                createdAt: new Date('2024-01-01'),
                acceptedAt: new Date('2024-01-05')
            };
            expect(invitation.type).toBe('team');
            expect(invitation.teamId).toBe('team-123');
        });
    });
    describe('SSOConfiguration Interface', () => {
        it('should create SAML SSO configuration', () => {
            const ssoConfig = {
                id: 'sso-123',
                organizationId: 'org-123',
                provider: 'saml',
                name: 'okta-sso',
                displayName: 'Okta SSO',
                isActive: true,
                config: {
                    entityId: 'https://acme.com/saml',
                    ssoUrl: 'https://acme.okta.com/app/saml/sso',
                    sloUrl: 'https://acme.okta.com/app/saml/slo',
                    certificate: 'MIIDpDCCAoygAwIBAgI...'
                },
                mappings: {
                    email: 'email',
                    firstName: 'given_name',
                    lastName: 'family_name',
                    displayName: 'name',
                    groups: 'groups',
                    department: 'department'
                },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01')
            };
            expect(ssoConfig.provider).toBe('saml');
            expect(ssoConfig.config.entityId).toBe('https://acme.com/saml');
        });
        it('should create OIDC SSO configuration', () => {
            const ssoConfig = {
                id: 'sso-456',
                organizationId: 'org-123',
                provider: 'oidc',
                name: 'auth0-oidc',
                displayName: 'Auth0 OIDC',
                isActive: true,
                config: {
                    clientId: 'client_123',
                    clientSecret: 'secret_456',
                    discoveryUrl: 'https://acme.auth0.com/.well-known/openid-configuration',
                    scopes: ['openid', 'profile', 'email']
                },
                mappings: {
                    email: 'email',
                    firstName: 'given_name',
                    lastName: 'family_name'
                },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01')
            };
            expect(ssoConfig.provider).toBe('oidc');
            expect(ssoConfig.config.scopes).toContain('openid');
        });
    });
    describe('AuditLogEntry Interface', () => {
        it('should create audit log entry', () => {
            const auditLog = {
                id: 'audit-123',
                organizationId: 'org-123',
                userId: 'user-123',
                sessionId: 'session-456',
                action: 'user.login',
                resource: 'authentication',
                resourceId: 'auth-789',
                details: {
                    method: 'sso',
                    provider: 'saml',
                    success: true
                },
                ipAddress: '192.168.1.100',
                userAgent: 'Mozilla/5.0...',
                timestamp: new Date('2024-01-15T10:30:00Z'),
                severity: 'info',
                category: 'auth'
            };
            expect(auditLog.action).toBe('user.login');
            expect(auditLog.category).toBe('auth');
            expect(auditLog.details.success).toBe(true);
        });
        it('should handle different severities and categories', () => {
            const severities = ['info', 'warn', 'error', 'critical'];
            const categories = ['auth', 'user', 'organization', 'team', 'api', 'system'];
            severities.forEach(severity => {
                const log = { severity };
                expect(log.severity).toBe(severity);
            });
            categories.forEach(category => {
                const log = { category };
                expect(log.category).toBe(category);
            });
        });
    });
    describe('Constants', () => {
        describe('ENTERPRISE_PLANS', () => {
            it('should have correct free plan configuration', () => {
                const freePlan = enterprise_entities_1.ENTERPRISE_PLANS.free;
                expect(freePlan.name).toBe('Free');
                expect(freePlan.maxUsers).toBe(3);
                expect(freePlan.maxTeams).toBe(1);
                expect(freePlan.features).toContain('basic_auth');
            });
            it('should have correct premium plan configuration', () => {
                const premiumPlan = enterprise_entities_1.ENTERPRISE_PLANS.premium;
                expect(premiumPlan.name).toBe('Premium');
                expect(premiumPlan.maxUsers).toBe(25);
                expect(premiumPlan.features).toContain('team_management');
            });
            it('should have correct enterprise plan configuration', () => {
                const enterprisePlan = enterprise_entities_1.ENTERPRISE_PLANS.enterprise;
                expect(enterprisePlan.name).toBe('Enterprise');
                expect(enterprisePlan.maxUsers).toBe(-1); // Unlimited
                expect(enterprisePlan.features).toContain('sso');
                expect(enterprisePlan.features).toContain('audit_logs');
            });
        });
        describe('ENTERPRISE_ROLES', () => {
            it('should have organization owner role', () => {
                const orgOwner = enterprise_entities_1.ENTERPRISE_ROLES.org_owner;
                expect(orgOwner.name).toBe('Organization Owner');
                expect(orgOwner.permissions).toContain('*');
            });
            it('should have organization admin role', () => {
                const orgAdmin = enterprise_entities_1.ENTERPRISE_ROLES.org_admin;
                expect(orgAdmin.name).toBe('Organization Admin');
                expect(orgAdmin.permissions).toContain('manage:billing');
                expect(orgAdmin.permissions).toContain('read:audit-logs');
            });
            it('should have team roles', () => {
                const teamLead = enterprise_entities_1.ENTERPRISE_ROLES.team_lead;
                const teamMember = enterprise_entities_1.ENTERPRISE_ROLES.team_member;
                expect(teamLead.permissions).toContain('update:team');
                expect(teamLead.permissions).toContain('invite:team-members');
                expect(teamMember.permissions).toContain('read:team');
                expect(teamMember.permissions).toContain('contribute:team-projects');
            });
        });
    });
});
//# sourceMappingURL=enterprise-entities.test.js.map