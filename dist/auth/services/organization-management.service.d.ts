/**
 * @fileoverview Organization management service for multi-tenant enterprise features
 * @description Handles organization creation, management, and multi-tenant operations
 * @author Web-Buddy Team
 */
import { Organization, OrganizationSettings, OrganizationMembership, Invitation } from '../domain/enterprise-entities';
/**
 * Organization management service with multi-tenant support
 */
export declare class OrganizationManagementService {
    private organizations;
    private memberships;
    private invitations;
    /**
     * Create a new organization
     */
    createOrganization(data: {
        name: string;
        displayName: string;
        description?: string;
        domain?: string;
        tier: 'free' | 'premium' | 'enterprise';
        ownerId: string;
        settings?: Partial<OrganizationSettings>;
    }): Promise<Organization>;
    /**
     * Get organization by ID
     */
    getOrganization(organizationId: string): Promise<Organization | null>;
    /**
     * Get organizations for a user
     */
    getUserOrganizations(userId: string): Promise<Organization[]>;
    /**
     * Update organization settings
     */
    updateOrganization(organizationId: string, updates: Partial<Pick<Organization, 'displayName' | 'description' | 'settings'>>): Promise<Organization>;
    /**
     * Add user to organization
     */
    addUserToOrganization(organizationId: string, userId: string, role?: string): Promise<OrganizationMembership>;
    /**
     * Remove user from organization
     */
    removeUserFromOrganization(organizationId: string, userId: string): Promise<void>;
    /**
     * Update user role in organization
     */
    updateUserRole(organizationId: string, userId: string, newRole: string): Promise<OrganizationMembership>;
    /**
     * Create invitation to join organization
     */
    createInvitation(data: {
        organizationId: string;
        invitedEmail: string;
        invitedBy: string;
        role: string;
        expiresInDays?: number;
    }): Promise<Invitation>;
    /**
     * Accept invitation
     */
    acceptInvitation(token: string, userId: string): Promise<OrganizationMembership>;
    /**
     * Get organization members
     */
    getOrganizationMembers(organizationId: string): Promise<OrganizationMembership[]>;
    /**
     * Check if user has permission in organization
     */
    checkOrganizationPermission(organizationId: string, userId: string, permission: string): Promise<boolean>;
    /**
     * Get organization usage statistics
     */
    getOrganizationUsage(organizationId: string): Promise<{
        users: number;
        teams: number;
        apiKeys: number;
        projects: number;
        storageGB: number;
        bandwidthGB: number;
        requestsThisMonth: number;
    }>;
    /**
     * Private helper methods
     */
    private generateOrganizationId;
    private generateMembershipId;
    private generateInvitationId;
    private generateInvitationToken;
    private generateSlug;
    private isDomainTaken;
    private getPlanQuotas;
    private getRolePermissions;
}
//# sourceMappingURL=organization-management.service.d.ts.map