/**
 * @fileoverview Team management service for organizing users within organizations
 * @description Handles team creation, membership, permissions, and hierarchical structures
 * @author Web-Buddy Team
 */
import { Team, TeamSettings, TeamPermissions, TeamMembership, Invitation } from '../domain/enterprise-entities';
/**
 * Team management service with hierarchical support
 */
export declare class TeamManagementService {
    private teams;
    private memberships;
    private invitations;
    /**
     * Create a new team
     */
    createTeam(data: {
        organizationId: string;
        name: string;
        displayName: string;
        description?: string;
        type: 'department' | 'project' | 'custom';
        parentTeamId?: string;
        createdBy: string;
        settings?: Partial<TeamSettings>;
        permissions?: Partial<TeamPermissions>;
    }): Promise<Team>;
    /**
     * Get team by ID
     */
    getTeam(teamId: string): Promise<Team | null>;
    /**
     * Get teams in organization
     */
    getOrganizationTeams(organizationId: string): Promise<Team[]>;
    /**
     * Get user's teams
     */
    getUserTeams(userId: string): Promise<Team[]>;
    /**
     * Get team hierarchy (children teams)
     */
    getTeamHierarchy(teamId: string): Promise<Team[]>;
    /**
     * Update team
     */
    updateTeam(teamId: string, updates: Partial<Pick<Team, 'displayName' | 'description' | 'settings' | 'permissions'>>): Promise<Team>;
    /**
     * Delete team
     */
    deleteTeam(teamId: string): Promise<void>;
    /**
     * Add user to team
     */
    addUserToTeam(teamId: string, userId: string, role?: string): Promise<TeamMembership>;
    /**
     * Remove user from team
     */
    removeUserFromTeam(teamId: string, userId: string): Promise<void>;
    /**
     * Update user role in team
     */
    updateUserTeamRole(teamId: string, userId: string, newRole: string): Promise<TeamMembership>;
    /**
     * Create team invitation
     */
    createTeamInvitation(data: {
        teamId: string;
        invitedEmail: string;
        invitedBy: string;
        role: string;
        expiresInDays?: number;
    }): Promise<Invitation>;
    /**
     * Accept team invitation
     */
    acceptTeamInvitation(token: string, userId: string): Promise<TeamMembership>;
    /**
     * Get team members
     */
    getTeamMembers(teamId: string): Promise<TeamMembership[]>;
    /**
     * Check if user has permission in team
     */
    checkTeamPermission(teamId: string, userId: string, permission: string): Promise<boolean>;
    /**
     * Get team statistics
     */
    getTeamStats(teamId: string): Promise<{
        totalMembers: number;
        activeMembers: number;
        leads: number;
        pendingInvitations: number;
        childTeams: number;
    }>;
    /**
     * Private helper methods
     */
    private generateTeamId;
    private generateMembershipId;
    private generateInvitationId;
    private generateInvitationToken;
    private generateSlug;
    private isTeamNameTaken;
    private getTeamRolePermissions;
}
//# sourceMappingURL=team-management.service.d.ts.map