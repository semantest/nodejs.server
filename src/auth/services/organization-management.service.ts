/**
 * @fileoverview Organization management service for multi-tenant enterprise features
 * @description Handles organization creation, management, and multi-tenant operations
 * @author Web-Buddy Team
 */

import {
  Organization,
  OrganizationSettings,
  BillingInfo,
  ResourceQuotas,
  EnterpriseUser,
  OrganizationMembership,
  Invitation,
  ENTERPRISE_PLANS
} from '../domain/enterprise-entities';
import { Application, Enable } from '../../stubs/typescript-eda-stubs';

/**
 * Organization management service with multi-tenant support
 */
export class OrganizationManagementService {
  private organizations: Map<string, Organization> = new Map();
  private memberships: Map<string, OrganizationMembership[]> = new Map();
  private invitations: Map<string, Invitation[]> = new Map();

  /**
   * Create a new organization
   */
  async createOrganization(data: {
    name: string;
    displayName: string;
    description?: string;
    domain?: string;
    tier: 'free' | 'premium' | 'enterprise';
    ownerId: string;
    settings?: Partial<OrganizationSettings>;
  }): Promise<Organization> {
    const organizationId = this.generateOrganizationId();
    const slug = this.generateSlug(data.name);
    
    // Validate domain uniqueness
    if (data.domain && await this.isDomainTaken(data.domain)) {
      throw new Error('Domain is already taken');
    }
    
    // Get plan quotas
    const planQuotas = this.getPlanQuotas(data.tier);
    
    const organization: Organization = {
      id: organizationId,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      domain: data.domain,
      slug,
      tier: data.tier,
      status: 'active',
      settings: {
        ssoEnabled: false,
        domainRestrictions: data.domain ? [data.domain] : [],
        userInvitePolicy: 'admin-only',
        sessionTimeoutMinutes: 480, // 8 hours
        enforcePasswordPolicy: data.tier === 'enterprise',
        enforceMfa: data.tier === 'enterprise',
        allowedAuthMethods: ['password', 'sso'],
        auditLogRetentionDays: data.tier === 'enterprise' ? 365 : 90,
        dataRetentionDays: data.tier === 'enterprise' ? 2555 : 365, // 7 years for enterprise
        ...data.settings
      },
      billing: {
        planId: data.tier,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        billingEmail: '', // Will be set later
      },
      quotas: planQuotas,
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: data.ownerId
    };
    
    // Save organization
    this.organizations.set(organizationId, organization);
    
    // Create owner membership
    await this.addUserToOrganization(organizationId, data.ownerId, 'org_owner');
    
    console.log(`✅ Organization created: ${organization.name} (${organizationId})`);
    
    return organization;
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<Organization | null> {
    return this.organizations.get(organizationId) || null;
  }

  /**
   * Get organizations for a user
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const userOrgs: Organization[] = [];
    
    for (const [orgId, memberships] of this.memberships) {
      const membership = memberships.find(m => m.userId === userId && m.status === 'active');
      if (membership) {
        const org = this.organizations.get(orgId);
        if (org) {
          userOrgs.push(org);
        }
      }
    }
    
    return userOrgs;
  }

  /**
   * Update organization settings
   */
  async updateOrganization(
    organizationId: string,
    updates: Partial<Pick<Organization, 'displayName' | 'description' | 'settings'>>
  ): Promise<Organization> {
    const organization = this.organizations.get(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    
    const updatedOrg = {
      ...organization,
      ...updates,
      updatedAt: new Date()
    };
    
    this.organizations.set(organizationId, updatedOrg);
    
    console.log(`✅ Organization updated: ${organizationId}`);
    
    return updatedOrg;
  }

  /**
   * Add user to organization
   */
  async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: string = 'org_member'
  ): Promise<OrganizationMembership> {
    const organization = this.organizations.get(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    
    // Check if user is already a member
    const existingMemberships = this.memberships.get(organizationId) || [];
    const existingMembership = existingMemberships.find(m => m.userId === userId);
    
    if (existingMembership && existingMembership.status === 'active') {
      throw new Error('User is already a member of this organization');
    }
    
    // Check quota limits
    const activeMemberships = existingMemberships.filter(m => m.status === 'active');
    if (organization.quotas.maxUsers !== -1 && activeMemberships.length >= organization.quotas.maxUsers) {
      throw new Error('Organization has reached its user limit');
    }
    
    const membership: OrganizationMembership = {
      id: this.generateMembershipId(),
      organizationId,
      userId,
      role,
      permissions: this.getRolePermissions(role),
      status: 'active',
      joinedAt: new Date(),
      isBillingContact: false
    };
    
    // Add membership
    const memberships = this.memberships.get(organizationId) || [];
    memberships.push(membership);
    this.memberships.set(organizationId, memberships);
    
    console.log(`✅ User ${userId} added to organization ${organizationId} as ${role}`);
    
    return membership;
  }

  /**
   * Remove user from organization
   */
  async removeUserFromOrganization(organizationId: string, userId: string): Promise<void> {
    const memberships = this.memberships.get(organizationId) || [];
    const membershipIndex = memberships.findIndex(m => m.userId === userId);
    
    if (membershipIndex === -1) {
      throw new Error('User is not a member of this organization');
    }
    
    const membership = memberships[membershipIndex];
    
    // Cannot remove organization owner
    if (membership.role === 'org_owner') {
      throw new Error('Cannot remove organization owner');
    }
    
    // Mark membership as inactive
    membership.status = 'suspended';
    membership.leftAt = new Date();
    
    console.log(`✅ User ${userId} removed from organization ${organizationId}`);
  }

  /**
   * Update user role in organization
   */
  async updateUserRole(
    organizationId: string,
    userId: string,
    newRole: string
  ): Promise<OrganizationMembership> {
    const memberships = this.memberships.get(organizationId) || [];
    const membership = memberships.find(m => m.userId === userId && m.status === 'active');
    
    if (!membership) {
      throw new Error('User is not an active member of this organization');
    }
    
    membership.role = newRole;
    membership.permissions = this.getRolePermissions(newRole);
    
    console.log(`✅ User ${userId} role updated to ${newRole} in organization ${organizationId}`);
    
    return membership;
  }

  /**
   * Create invitation to join organization
   */
  async createInvitation(data: {
    organizationId: string;
    invitedEmail: string;
    invitedBy: string;
    role: string;
    expiresInDays?: number;
  }): Promise<Invitation> {
    const organization = this.organizations.get(data.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    
    // Check if user is already invited
    const orgInvitations = this.invitations.get(data.organizationId) || [];
    const existingInvitation = orgInvitations.find(
      inv => inv.invitedEmail === data.invitedEmail && inv.status === 'pending'
    );
    
    if (existingInvitation) {
      throw new Error('User is already invited to this organization');
    }
    
    const invitation: Invitation = {
      id: this.generateInvitationId(),
      type: 'organization',
      organizationId: data.organizationId,
      invitedEmail: data.invitedEmail,
      invitedBy: data.invitedBy,
      role: data.role,
      permissions: this.getRolePermissions(data.role),
      status: 'pending',
      token: this.generateInvitationToken(),
      expiresAt: new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    };
    
    // Save invitation
    orgInvitations.push(invitation);
    this.invitations.set(data.organizationId, orgInvitations);
    
    console.log(`✅ Invitation created for ${data.invitedEmail} to join organization ${data.organizationId}`);
    
    return invitation;
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<OrganizationMembership> {
    // Find invitation by token
    let invitation: Invitation | null = null;
    let organizationId: string | null = null;
    
    for (const [orgId, invitations] of this.invitations) {
      const inv = invitations.find(i => i.token === token);
      if (inv) {
        invitation = inv;
        organizationId = orgId;
        break;
      }
    }
    
    if (!invitation || !organizationId) {
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
    
    // Add user to organization
    const membership = await this.addUserToOrganization(organizationId, userId, invitation.role);
    
    console.log(`✅ Invitation accepted by user ${userId} for organization ${organizationId}`);
    
    return membership;
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMembership[]> {
    return this.memberships.get(organizationId)?.filter(m => m.status === 'active') || [];
  }

  /**
   * Check if user has permission in organization
   */
  async checkOrganizationPermission(
    organizationId: string,
    userId: string,
    permission: string
  ): Promise<boolean> {
    const memberships = this.memberships.get(organizationId) || [];
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
   * Get organization usage statistics
   */
  async getOrganizationUsage(organizationId: string): Promise<{
    users: number;
    teams: number;
    apiKeys: number;
    projects: number;
    storageGB: number;
    bandwidthGB: number;
    requestsThisMonth: number;
  }> {
    const memberships = this.memberships.get(organizationId) || [];
    const activeMembers = memberships.filter(m => m.status === 'active');
    
    // Mock implementation - in real app, this would query actual usage
    return {
      users: activeMembers.length,
      teams: 0, // TODO: Implement team counting
      apiKeys: 0, // TODO: Implement API key counting
      projects: 0, // TODO: Implement project counting
      storageGB: 0, // TODO: Implement storage calculation
      bandwidthGB: 0, // TODO: Implement bandwidth calculation
      requestsThisMonth: 0 // TODO: Implement request counting
    };
  }

  /**
   * Private helper methods
   */
  private generateOrganizationId(): string {
    return `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMembershipId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInvitationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInvitationToken(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 32)}`;
  }

  private generateSlug(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async isDomainTaken(domain: string): Promise<boolean> {
    for (const org of this.organizations.values()) {
      if (org.domain === domain) {
        return true;
      }
    }
    return false;
  }

  private getPlanQuotas(tier: 'free' | 'premium' | 'enterprise'): ResourceQuotas {
    const plan = ENTERPRISE_PLANS[tier];
    return {
      maxUsers: plan.maxUsers,
      maxTeams: plan.maxTeams,
      maxApiKeys: plan.maxApiKeys,
      maxProjects: plan.maxProjects,
      maxStorageGB: plan.maxStorageGB,
      maxBandwidthGB: plan.maxBandwidthGB,
      maxRequestsPerMonth: plan.maxRequestsPerMonth,
      maxConcurrentSessions: tier === 'enterprise' ? 1000 : tier === 'premium' ? 100 : 10
    };
  }

  private getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      'org_owner': ['*'],
      'org_admin': [
        'read:organization',
        'update:organization',
        'read:users',
        'create:users',
        'update:users',
        'delete:users',
        'read:teams',
        'create:teams',
        'update:teams',
        'delete:teams',
        'read:audit-logs',
        'manage:billing'
      ],
      'org_member': [
        'read:organization',
        'read:own-profile',
        'update:own-profile',
        'read:own-teams'
      ]
    };
    
    return rolePermissions[role] || [];
  }
}