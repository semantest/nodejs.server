"use strict";
/**
 * @fileoverview Role-based access control manager
 * @description Handles roles, permissions, and authorization
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleBasedAccessControl = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
const auth_entities_1 = require("../domain/auth-entities");
/**
 * Role-based access control manager
 */
class RoleBasedAccessControl extends typescript_eda_stubs_1.Adapter {
    constructor() {
        super();
        this.systemRoles = new Map();
        this.permissionCache = new Map();
        this.initializeSystemRoles();
    }
    /**
     * Check if user has required permissions
     */
    async checkPermissions(userId, requiredPermissions, resourceId) {
        try {
            const userPermissions = await this.getUserPermissions(userId);
            for (const required of requiredPermissions) {
                if (!this.hasPermission(userPermissions, required, resourceId)) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error checking permissions:', error);
            return false;
        }
    }
    /**
     * Get user permissions
     */
    async getUserPermissions(userId) {
        try {
            // Check cache first
            const cached = this.permissionCache.get(userId);
            if (cached) {
                return cached;
            }
            // Get user roles
            const userRoles = await this.getUserRoles(userId);
            // Collect all permissions from roles
            const permissions = [];
            for (const roleName of userRoles) {
                const role = this.systemRoles.get(roleName);
                if (role) {
                    permissions.push(...role.permissions);
                }
            }
            // Remove duplicates
            const uniquePermissions = this.deduplicatePermissions(permissions);
            // Cache permissions
            this.permissionCache.set(userId, uniquePermissions);
            return uniquePermissions;
        }
        catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }
    /**
     * Update user roles
     */
    async updateUserRoles(userId, roles) {
        try {
            // Validate roles exist
            for (const role of roles) {
                if (!this.systemRoles.has(role)) {
                    throw new Error(`Role does not exist: ${role}`);
                }
            }
            // Update user roles in database
            await this.saveUserRoles(userId, roles);
            // Clear permission cache
            this.permissionCache.delete(userId);
            console.log(`🔧 Updated roles for user ${userId}: ${roles.join(', ')}`);
        }
        catch (error) {
            console.error('Error updating user roles:', error);
            throw error;
        }
    }
    /**
     * Create custom role
     */
    async createRole(roleData) {
        try {
            // Validate permissions
            const validPermissions = await this.validatePermissions(roleData.permissions);
            const role = {
                id: this.generateRoleId(),
                name: roleData.name,
                displayName: roleData.displayName,
                description: roleData.description,
                permissions: validPermissions,
                isSystemRole: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save role
            await this.saveRole(role);
            this.systemRoles.set(role.name, role);
            console.log(`🎭 Created role: ${role.name}`);
            return role;
        }
        catch (error) {
            console.error('Error creating role:', error);
            throw error;
        }
    }
    /**
     * Update role permissions
     */
    async updateRolePermissions(roleName, permissions) {
        try {
            const role = this.systemRoles.get(roleName);
            if (!role) {
                throw new Error(`Role does not exist: ${roleName}`);
            }
            if (role.isSystemRole) {
                throw new Error('Cannot modify system role');
            }
            // Validate permissions
            const validPermissions = await this.validatePermissions(permissions);
            // Update role
            role.permissions = validPermissions;
            role.updatedAt = new Date();
            await this.saveRole(role);
            // Clear all permission caches
            this.permissionCache.clear();
            console.log(`🔧 Updated permissions for role ${roleName}`);
        }
        catch (error) {
            console.error('Error updating role permissions:', error);
            throw error;
        }
    }
    /**
     * Delete role
     */
    async deleteRole(roleName) {
        try {
            const role = this.systemRoles.get(roleName);
            if (!role) {
                throw new Error(`Role does not exist: ${roleName}`);
            }
            if (role.isSystemRole) {
                throw new Error('Cannot delete system role');
            }
            // Check if role is in use
            const usersWithRole = await this.getUsersWithRole(roleName);
            if (usersWithRole.length > 0) {
                throw new Error(`Cannot delete role: ${usersWithRole.length} users have this role`);
            }
            // Delete role
            await this.deleteRoleFromDatabase(role.id);
            this.systemRoles.delete(roleName);
            console.log(`🗑️ Deleted role: ${roleName}`);
        }
        catch (error) {
            console.error('Error deleting role:', error);
            throw error;
        }
    }
    /**
     * Get all roles
     */
    async getAllRoles() {
        return Array.from(this.systemRoles.values());
    }
    /**
     * Get role by name
     */
    async getRole(roleName) {
        return this.systemRoles.get(roleName) || null;
    }
    /**
     * Check if user has specific role
     */
    async hasRole(userId, roleName) {
        const userRoles = await this.getUserRoles(userId);
        return userRoles.includes(roleName);
    }
    /**
     * Check if user has any of the specified roles
     */
    async hasAnyRole(userId, roleNames) {
        const userRoles = await this.getUserRoles(userId);
        return roleNames.some(role => userRoles.includes(role));
    }
    /**
     * Check if user has all of the specified roles
     */
    async hasAllRoles(userId, roleNames) {
        const userRoles = await this.getUserRoles(userId);
        return roleNames.every(role => userRoles.includes(role));
    }
    /**
     * Initialize system roles
     */
    initializeSystemRoles() {
        // User role
        const userRole = {
            id: 'role_user',
            name: 'user',
            displayName: 'User',
            description: 'Standard user with basic permissions',
            permissions: this.createPermissions(auth_entities_1.DEFAULT_PERMISSIONS.user),
            isSystemRole: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Admin role
        const adminRole = {
            id: 'role_admin',
            name: 'admin',
            displayName: 'Administrator',
            description: 'Administrator with elevated permissions',
            permissions: this.createPermissions(auth_entities_1.DEFAULT_PERMISSIONS.admin),
            isSystemRole: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Super admin role
        const superAdminRole = {
            id: 'role_super_admin',
            name: 'super_admin',
            displayName: 'Super Administrator',
            description: 'Super administrator with all permissions',
            permissions: this.createPermissions(auth_entities_1.DEFAULT_PERMISSIONS.super_admin),
            isSystemRole: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.systemRoles.set('user', userRole);
        this.systemRoles.set('admin', adminRole);
        this.systemRoles.set('super_admin', superAdminRole);
    }
    /**
     * Create permissions from permission names
     */
    createPermissions(permissionNames) {
        return permissionNames.map(name => ({
            id: `perm_${name.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name,
            resource: name.split(':')[1] || 'general',
            action: name.split(':')[0] || 'read',
            description: `Permission to ${name}`
        }));
    }
    /**
     * Check if user has specific permission
     */
    hasPermission(userPermissions, required, resourceId) {
        // Super admin has all permissions
        if (userPermissions.some(p => p.name === '*')) {
            return true;
        }
        // Check for exact permission match
        const hasExactMatch = userPermissions.some(p => p.name === required);
        if (hasExactMatch) {
            return true;
        }
        // Check for wildcard permissions
        const [action, resource] = required.split(':');
        const hasWildcardAction = userPermissions.some(p => p.name === `*:${resource}`);
        const hasWildcardResource = userPermissions.some(p => p.name === `${action}:*`);
        return hasWildcardAction || hasWildcardResource;
    }
    /**
     * Deduplicate permissions
     */
    deduplicatePermissions(permissions) {
        const seen = new Set();
        return permissions.filter(p => {
            if (seen.has(p.name)) {
                return false;
            }
            seen.add(p.name);
            return true;
        });
    }
    /**
     * Validate permissions exist
     */
    async validatePermissions(permissionNames) {
        // In production, validate against available permissions
        return this.createPermissions(permissionNames);
    }
    /**
     * Generate role ID
     */
    generateRoleId() {
        return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Helper methods (in production, these would use database)
     */
    async getUserRoles(userId) {
        // Mock implementation - get from database
        return ['user'];
    }
    async saveUserRoles(userId, roles) {
        // Mock implementation - save to database
        console.log(`💾 Saving roles for user ${userId}: ${roles.join(', ')}`);
    }
    async saveRole(role) {
        // Mock implementation - save to database
        console.log(`💾 Saving role: ${role.name}`);
    }
    async deleteRoleFromDatabase(roleId) {
        // Mock implementation - delete from database
        console.log(`🗑️ Deleting role from database: ${roleId}`);
    }
    async getUsersWithRole(roleName) {
        // Mock implementation - get from database
        return [];
    }
}
exports.RoleBasedAccessControl = RoleBasedAccessControl;
//# sourceMappingURL=rbac-manager.js.map