/**
 * @fileoverview Role-based access control manager
 * @description Handles roles, permissions, and authorization
 * @author Web-Buddy Team
 */
import { Adapter } from '../../stubs/typescript-eda-stubs';
import { Role, Permission } from '../domain/auth-entities';
/**
 * Role-based access control manager
 */
export declare class RoleBasedAccessControl extends Adapter {
    private readonly systemRoles;
    private readonly permissionCache;
    constructor();
    /**
     * Check if user has required permissions
     */
    checkPermissions(userId: string, requiredPermissions: string[], resourceId?: string): Promise<boolean>;
    /**
     * Get user permissions
     */
    getUserPermissions(userId: string): Promise<Permission[]>;
    /**
     * Update user roles
     */
    updateUserRoles(userId: string, roles: string[]): Promise<void>;
    /**
     * Create custom role
     */
    createRole(roleData: {
        name: string;
        displayName: string;
        description: string;
        permissions: string[];
    }): Promise<Role>;
    /**
     * Update role permissions
     */
    updateRolePermissions(roleName: string, permissions: string[]): Promise<void>;
    /**
     * Delete role
     */
    deleteRole(roleName: string): Promise<void>;
    /**
     * Get all roles
     */
    getAllRoles(): Promise<Role[]>;
    /**
     * Get role by name
     */
    getRole(roleName: string): Promise<Role | null>;
    /**
     * Check if user has specific role
     */
    hasRole(userId: string, roleName: string): Promise<boolean>;
    /**
     * Check if user has any of the specified roles
     */
    hasAnyRole(userId: string, roleNames: string[]): Promise<boolean>;
    /**
     * Check if user has all of the specified roles
     */
    hasAllRoles(userId: string, roleNames: string[]): Promise<boolean>;
    /**
     * Initialize system roles
     */
    private initializeSystemRoles;
    /**
     * Create permissions from permission names
     */
    private createPermissions;
    /**
     * Check if user has specific permission
     */
    private hasPermission;
    /**
     * Deduplicate permissions
     */
    private deduplicatePermissions;
    /**
     * Validate permissions exist
     */
    private validatePermissions;
    /**
     * Generate role ID
     */
    private generateRoleId;
    /**
     * Helper methods (in production, these would use database)
     */
    private getUserRoles;
    private saveUserRoles;
    private saveRole;
    private deleteRoleFromDatabase;
    private getUsersWithRole;
}
//# sourceMappingURL=rbac-manager.d.ts.map