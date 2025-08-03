"use strict";
/**
 * @fileoverview Team management service for organizing users within organizations
 * @description Handles team creation, membership, permissions, and hierarchical structures
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamManagementService = void 0;
/**
 * Team management service with hierarchical support
 */
class TeamManagementService {
    constructor() {
        this.teams = new Map();
        this.memberships = new Map();
        this.invitations = new Map();
    }
    /**
     * Create a new team
     */
    async createTeam(data) {
        const teamId = this.generateTeamId();
        const slug = this.generateSlug(data.name);
        // Validate parent team exists and is in same organization
        if (data.parentTeamId) {
            const parentTeam = this.teams.get(data.parentTeamId);
            if (!parentTeam) {
                throw new Error('Parent team not found');
            }
            if (parentTeam.organizationId !== data.organizationId) {
                throw new Error('Parent team must be in the same organization');
            }
        }
        // Check for duplicate team names within organization
        if (await this.isTeamNameTaken(data.organizationId, data.name)) {
            throw new Error('Team name is already taken in this organization');
        }
        const team = {
            id: teamId,
            organizationId: data.organizationId,
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            slug,
            type: data.type,
            parentTeamId: data.parentTeamId,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: data.createdBy,
            settings: {
                isPrivate: false,
                allowMemberInvites: true,
                requireApprovalForJoin: false,
                autoAssignNewUsers: false,
                notificationSettings: {
                    emailEnabled: true,
                    slackEnabled: false,
                    customWebhooks: [],
                    notifyOnUserJoin: true,
                    notifyOnUserLeave: true,
                    notifyOnPermissionChange: true
                },
                ...data.settings
            },
            permissions: {
                defaultRole: 'team_member',
                inheritFromParent: !!data.parentTeamId,
                customPermissions: [],
                resourceAccess: [],
                ...data.permissions
            }
        };
        // Save team
        this.teams.set(teamId, team);
        // Add creator as team lead
        await this.addUserToTeam(teamId, data.createdBy, 'team_lead');
        console.log(`✅ Team created: ${team.name} (${teamId})`);
        return team;
    }
    /**
     * Get team by ID
     */
    async getTeam(teamId) {
        return this.teams.get(teamId) || null;
    }
    /**
     * Get teams in organization
     */
    async getOrganizationTeams(organizationId) {
        return Array.from(this.teams.values()).filter(team => team.organizationId === organizationId);
    }
    /**
     * Get user's teams
     */
    async getUserTeams(userId) {
        const userTeams = [];
        for (const [teamId, memberships] of this.memberships) {
            const membership = memberships.find(m => m.userId === userId && m.status === 'active');
            if (membership) {
                const team = this.teams.get(teamId);
                if (team) {
                    userTeams.push(team);
                }
            }
        }
        return userTeams;
    }
    /**
     * Get team hierarchy (children teams)
     */
    async getTeamHierarchy(teamId) {
        const team = this.teams.get(teamId);
        if (!team) {
            return [];
        }
        const children = [];
        // Find direct children
        for (const childTeam of this.teams.values()) {
            if (childTeam.parentTeamId === teamId) {
                children.push(childTeam);
                // Recursively get children of children
                const grandChildren = await this.getTeamHierarchy(childTeam.id);
                children.push(...grandChildren);
            }
        }
        return children;
    }
    /**
     * Update team
     */
    async updateTeam(teamId, updates) {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        const updatedTeam = {
            ...team,
            ...updates,
            updatedAt: new Date()
        };
        this.teams.set(teamId, updatedTeam);
        console.log(`✅ Team updated: ${teamId}`);
        return updatedTeam;
    }
    /**
     * Delete team
     */
    async deleteTeam(teamId) {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        // Check if team has children
        const children = await this.getTeamHierarchy(teamId);
        if (children.length > 0) {
            throw new Error('Cannot delete team with child teams');
        }
        // Remove all memberships
        this.memberships.delete(teamId);
        // Remove all invitations
        this.invitations.delete(teamId);
        // Remove team
        this.teams.delete(teamId);
        console.log(`✅ Team deleted: ${teamId}`);
    }
    /**
     * Add user to team
     */
    async addUserToTeam(teamId, userId, role = 'team_member') {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        // Check if user is already a member
        const existingMemberships = this.memberships.get(teamId) || [];
        const existingMembership = existingMemberships.find(m => m.userId === userId);
        if (existingMembership && existingMembership.status === 'active') {
            throw new Error('User is already a member of this team');
        }
        // Check team size limits
        if (team.settings.maxMembers) {
            const activeMembers = existingMemberships.filter(m => m.status === 'active');
            if (activeMembers.length >= team.settings.maxMembers) {
                throw new Error('Team has reached its maximum member limit');
            }
        }
        const membership = {
            id: this.generateMembershipId(),
            teamId,
            userId,
            role,
            permissions: this.getTeamRolePermissions(role),
            status: 'active',
            joinedAt: new Date(),
            acceptedAt: new Date()
        };
        // Add membership
        const memberships = this.memberships.get(teamId) || [];
        memberships.push(membership);
        this.memberships.set(teamId, memberships);
        console.log(`✅ User ${userId} added to team ${teamId} as ${role}`);
        return membership;
    }
    /**
     * Remove user from team
     */
    async removeUserFromTeam(teamId, userId) {
        const memberships = this.memberships.get(teamId) || [];
        const membershipIndex = memberships.findIndex(m => m.userId === userId);
        if (membershipIndex === -1) {
            throw new Error('User is not a member of this team');
        }
        const membership = memberships[membershipIndex];
        // Check if user is the only team lead
        if (membership.role === 'team_lead') {
            const otherLeads = memberships.filter(m => m.role === 'team_lead' && m.userId !== userId && m.status === 'active');
            if (otherLeads.length === 0) {
                throw new Error('Cannot remove the only team lead');
            }
        }
        // Mark membership as inactive
        membership.status = 'suspended';
        membership.leftAt = new Date();
        console.log(`✅ User ${userId} removed from team ${teamId}`);
    }
    /**
     * Update user role in team
     */
    async updateUserTeamRole(teamId, userId, newRole) {
        const memberships = this.memberships.get(teamId) || [];
        const membership = memberships.find(m => m.userId === userId && m.status === 'active');
        if (!membership) {
            throw new Error('User is not an active member of this team');
        }
        membership.role = newRole;
        membership.permissions = this.getTeamRolePermissions(newRole);
        console.log(`✅ User ${userId} role updated to ${newRole} in team ${teamId}`);
        return membership;
    }
    /**
     * Create team invitation
     */
    async createTeamInvitation(data) {
        const team = this.teams.get(data.teamId);
        if (!team) {
            throw new Error('Team not found');
        }
        // Check if team allows member invites
        if (!team.settings.allowMemberInvites) {
            throw new Error('Team does not allow member invitations');
        }
        // Check if user is already invited
        const teamInvitations = this.invitations.get(data.teamId) || [];
        const existingInvitation = teamInvitations.find(inv => inv.invitedEmail === data.invitedEmail && inv.status === 'pending');
        if (existingInvitation) {
            throw new Error('User is already invited to this team');
        }
        const invitation = {
            id: this.generateInvitationId(),
            type: 'team',
            organizationId: team.organizationId,
            teamId: data.teamId,
            invitedEmail: data.invitedEmail,
            invitedBy: data.invitedBy,
            role: data.role,
            permissions: this.getTeamRolePermissions(data.role),
            status: 'pending',
            token: this.generateInvitationToken(),
            expiresAt: new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000),
            createdAt: new Date()
        };
        // Save invitation
        teamInvitations.push(invitation);
        this.invitations.set(data.teamId, teamInvitations);
        console.log(`✅ Team invitation created for ${data.invitedEmail} to join team ${data.teamId}`);
        return invitation;
    }
    /**
     * Accept team invitation
     */
    async acceptTeamInvitation(token, userId) {
        // Find invitation by token
        let invitation = null;
        let teamId = null;
        for (const [tId, invitations] of this.invitations) {
            const inv = invitations.find(i => i.token === token);
            if (inv) {
                invitation = inv;
                teamId = tId;
                break;
            }
        }
        if (!invitation || !teamId) {
            throw new Error('Invalid invitation token');
        }
        if (invitation.status !== 'pending') {
            throw new Error('Invitation is no longer valid');
        }
        if (invitation.expiresAt < new Date()) {
            throw new Error('Invitation has expired');
        }
        // Accept invitation
        invitation.status = 'accepted';
        invitation.acceptedAt = new Date();
        // Add user to team
        const membership = await this.addUserToTeam(teamId, userId, invitation.role);
        console.log(`✅ Team invitation accepted by user ${userId} for team ${teamId}`);
        return membership;
    }
    /**
     * Get team members
     */
    async getTeamMembers(teamId) {
        return this.memberships.get(teamId)?.filter(m => m.status === 'active') || [];
    }
    /**
     * Check if user has permission in team
     */
    async checkTeamPermission(teamId, userId, permission) {
        const memberships = this.memberships.get(teamId) || [];
        const membership = memberships.find(m => m.userId === userId && m.status === 'active');
        if (!membership) {
            return false;
        }
        // Check if user has wildcard permission
        if (membership.permissions.includes('*')) {
            return true;
        }
        // Check specific permission
        return membership.permissions.includes(permission);
    }
    /**
     * Get team statistics
     */
    async getTeamStats(teamId) {
        const memberships = this.memberships.get(teamId) || [];
        const invitations = this.invitations.get(teamId) || [];
        const childTeams = await this.getTeamHierarchy(teamId);
        return {
            totalMembers: memberships.length,
            activeMembers: memberships.filter(m => m.status === 'active').length,
            leads: memberships.filter(m => m.role === 'team_lead' && m.status === 'active').length,
            pendingInvitations: invitations.filter(i => i.status === 'pending').length,
            childTeams: childTeams.length
        };
    }
    /**
     * Private helper methods
     */
    generateTeamId() {
        return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateMembershipId() {
        return `tmem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateInvitationId() {
        return `tinv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateInvitationToken() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 32)}`;
    }
    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    async isTeamNameTaken(organizationId, name) {
        for (const team of this.teams.values()) {
            if (team.organizationId === organizationId && team.name === name) {
                return true;
            }
        }
        return false;
    }
    getTeamRolePermissions(role) {
        const rolePermissions = {
            'team_lead': [
                'read:team',
                'update:team',
                'read:team-members',
                'invite:team-members',
                'remove:team-members',
                'read:team-projects',
                'create:team-projects',
                'update:team-projects'
            ],
            'team_member': [
                'read:team',
                'read:team-members',
                'read:team-projects',
                'contribute:team-projects'
            ]
        };
        return rolePermissions[role] || [];
    }
}
exports.TeamManagementService = TeamManagementService;
//# sourceMappingURL=team-management.service.js.map