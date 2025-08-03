"use strict";
/**
 * @fileoverview Enterprise authentication API routes
 * @description REST API endpoints for enterprise user management
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enterprise_auth_service_1 = require("../enterprise-auth.service");
const auth_middleware_1 = require("../middleware/auth-middleware");
const router = (0, express_1.Router)();
/**
 * Organization Management Routes
 */
/**
 * Create organization
 * POST /api/enterprise/organizations
 */
router.post('/organizations', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { name, displayName, description, domain, tier, settings } = req.body;
        const ownerId = req.user.id; // From auth middleware
        const organization = await enterprise_auth_service_1.EnterpriseAuthService.prototype.createOrganization({
            name,
            displayName,
            description,
            domain,
            tier,
            ownerId,
            settings
        });
        res.status(201).json({
            success: true,
            data: organization,
            message: 'Organization created successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to create organization'
        });
    }
});
/**
 * Get organization with context
 * GET /api/enterprise/organizations/:id
 */
router.get('/organizations/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationContext = await enterprise_auth_service_1.EnterpriseAuthService.prototype.getOrganizationWithContext(id);
        res.json({
            success: true,
            data: organizationContext,
            message: 'Organization retrieved successfully'
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: error.message,
            message: 'Organization not found'
        });
    }
});
/**
 * Update organization
 * PUT /api/enterprise/organizations/:id
 */
router.put('/organizations/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        // Check permission to update organization
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, id, 'update:organization');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to update this organization'
            });
        }
        const organization = await enterprise_auth_service_1.EnterpriseAuthService.prototype.organizationService.updateOrganization(id, updates);
        res.json({
            success: true,
            data: organization,
            message: 'Organization updated successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to update organization'
        });
    }
});
/**
 * Get user organizations
 * GET /api/enterprise/users/me/organizations
 */
router.get('/users/me/organizations', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const organizations = await enterprise_auth_service_1.EnterpriseAuthService.prototype.organizationService.getUserOrganizations(req.user.id);
        res.json({
            success: true,
            data: organizations,
            message: 'User organizations retrieved successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve user organizations'
        });
    }
});
/**
 * Team Management Routes
 */
/**
 * Create team
 * POST /api/enterprise/teams
 */
router.post('/teams', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { organizationId, name, displayName, description, type, parentTeamId, settings, permissions } = req.body;
        // Check permission to create teams
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, organizationId, 'create:teams');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to create teams in this organization'
            });
        }
        const team = await enterprise_auth_service_1.EnterpriseAuthService.prototype.createTeam({
            organizationId,
            name,
            displayName,
            description,
            type,
            parentTeamId,
            createdBy: req.user.id,
            settings,
            permissions
        });
        res.status(201).json({
            success: true,
            data: team,
            message: 'Team created successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to create team'
        });
    }
});
/**
 * Get team with hierarchy
 * GET /api/enterprise/teams/:id
 */
router.get('/teams/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const teamContext = await enterprise_auth_service_1.EnterpriseAuthService.prototype.getTeamWithHierarchy(id);
        // Check permission to read team
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, teamContext.team.organizationId, 'read:team', id);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to view this team'
            });
        }
        res.json({
            success: true,
            data: teamContext,
            message: 'Team retrieved successfully'
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: error.message,
            message: 'Team not found'
        });
    }
});
/**
 * Get user teams
 * GET /api/enterprise/users/me/teams
 */
router.get('/users/me/teams', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const teams = await enterprise_auth_service_1.EnterpriseAuthService.prototype.teamService.getUserTeams(req.user.id);
        res.json({
            success: true,
            data: teams,
            message: 'User teams retrieved successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve user teams'
        });
    }
});
/**
 * Add user to team
 * POST /api/enterprise/teams/:id/members
 */
router.post('/teams/:id/members', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role = 'team_member' } = req.body;
        // Check permission to add team members
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, '', // Will be resolved from team
        'invite:team-members', id);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to add members to this team'
            });
        }
        const membership = await enterprise_auth_service_1.EnterpriseAuthService.prototype.teamService.addUserToTeam(id, userId, role);
        res.status(201).json({
            success: true,
            data: membership,
            message: 'User added to team successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to add user to team'
        });
    }
});
/**
 * User Management Routes
 */
/**
 * Create enterprise user
 * POST /api/enterprise/users
 */
router.post('/users', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { email, firstName, lastName, password, organizationId, teamIds, roles, ssoEnabled } = req.body;
        // Check permission to create users
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, organizationId, 'create:users');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to create users in this organization'
            });
        }
        const user = await enterprise_auth_service_1.EnterpriseAuthService.prototype.createEnterpriseUser({
            email,
            firstName,
            lastName,
            password,
            organizationId,
            teamIds,
            roles,
            ssoEnabled,
            createdBy: req.user.id
        });
        res.status(201).json({
            success: true,
            data: user,
            message: 'Enterprise user created successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to create enterprise user'
        });
    }
});
/**
 * Get user with enterprise context
 * GET /api/enterprise/users/:id
 */
router.get('/users/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userContext = await enterprise_auth_service_1.EnterpriseAuthService.prototype.getUserWithEnterpriseContext(id);
        res.json({
            success: true,
            data: userContext,
            message: 'User retrieved successfully'
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: error.message,
            message: 'User not found'
        });
    }
});
/**
 * Get current user with enterprise context
 * GET /api/enterprise/users/me
 */
router.get('/users/me', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userContext = await enterprise_auth_service_1.EnterpriseAuthService.prototype.getUserWithEnterpriseContext(req.user.id);
        res.json({
            success: true,
            data: userContext,
            message: 'Current user retrieved successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve current user'
        });
    }
});
/**
 * SSO Management Routes
 */
/**
 * Setup SSO configuration
 * POST /api/enterprise/sso/configurations
 */
router.post('/sso/configurations', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { organizationId, provider, name, displayName, config, mappings } = req.body;
        // Check permission to manage SSO
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, organizationId, 'manage:sso');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to manage SSO for this organization'
            });
        }
        const ssoConfig = await enterprise_auth_service_1.EnterpriseAuthService.prototype.setupSSO({
            organizationId,
            provider,
            name,
            displayName,
            config,
            mappings,
            createdBy: req.user.id
        });
        res.status(201).json({
            success: true,
            data: ssoConfig,
            message: 'SSO configuration created successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to setup SSO configuration'
        });
    }
});
/**
 * Initiate SSO login
 * POST /api/enterprise/sso/login
 */
router.post('/sso/login', async (req, res) => {
    try {
        const { configId, redirectUrl } = req.body;
        const ssoLogin = await enterprise_auth_service_1.EnterpriseAuthService.prototype.handleSSOLogin(configId, redirectUrl);
        res.json({
            success: true,
            data: ssoLogin,
            message: 'SSO login initiated successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to initiate SSO login'
        });
    }
});
/**
 * SSO callback handler
 * POST /api/enterprise/sso/callback/:configId
 */
router.post('/sso/callback/:configId', async (req, res) => {
    try {
        const { configId } = req.params;
        const { sessionId, code, samlResponse, state } = req.body;
        const result = await enterprise_auth_service_1.EnterpriseAuthService.prototype.ssoService.handleSSOCallback({
            sessionId,
            code,
            samlResponse,
            state
        });
        res.json({
            success: true,
            data: result,
            message: 'SSO callback handled successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to handle SSO callback'
        });
    }
});
/**
 * Audit and Compliance Routes
 */
/**
 * Get audit logs
 * GET /api/enterprise/audit/logs
 */
router.get('/audit/logs', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { organizationId, userId, action, resource, severity, category, startDate, endDate, limit } = req.query;
        // Check permission to read audit logs
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, organizationId, 'read:audit-logs');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to view audit logs'
            });
        }
        const auditLogs = await enterprise_auth_service_1.EnterpriseAuthService.prototype.getAuditLogs(organizationId, {
            userId: userId,
            action: action,
            resource: resource,
            severity: severity,
            category: category,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: limit ? parseInt(limit) : undefined
        });
        res.json({
            success: true,
            data: auditLogs,
            message: 'Audit logs retrieved successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve audit logs'
        });
    }
});
/**
 * Invitation Management Routes
 */
/**
 * Create organization invitation
 * POST /api/enterprise/invitations/organization
 */
router.post('/invitations/organization', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { organizationId, invitedEmail, role, expiresInDays } = req.body;
        // Check permission to invite users
        const hasPermission = await enterprise_auth_service_1.EnterpriseAuthService.prototype.checkPermission(req.user.id, organizationId, 'invite:users');
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'You do not have permission to invite users to this organization'
            });
        }
        const invitation = await enterprise_auth_service_1.EnterpriseAuthService.prototype.organizationService.createInvitation({
            organizationId,
            invitedEmail,
            invitedBy: req.user.id,
            role,
            expiresInDays
        });
        res.status(201).json({
            success: true,
            data: invitation,
            message: 'Organization invitation created successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to create organization invitation'
        });
    }
});
/**
 * Accept invitation
 * POST /api/enterprise/invitations/:token/accept
 */
router.post('/invitations/:token/accept', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { token } = req.params;
        const membership = await enterprise_auth_service_1.EnterpriseAuthService.prototype.organizationService.acceptInvitation(token, req.user.id);
        res.json({
            success: true,
            data: membership,
            message: 'Invitation accepted successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to accept invitation'
        });
    }
});
exports.default = router;
//# sourceMappingURL=enterprise-auth.routes.js.map