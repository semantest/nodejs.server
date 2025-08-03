"use strict";
/**
 * Tests for RoleBasedAccessControl
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rbac_manager_1 = require("../rbac-manager");
const auth_entities_1 = require("../../domain/auth-entities");
describe('RoleBasedAccessControl', () => {
    let rbac;
    beforeEach(() => {
        jest.clearAllMocks();
        rbac = new rbac_manager_1.RoleBasedAccessControl();
    });
    describe('initialization', () => {
        it('should initialize with system roles', async () => {
            const roles = await rbac.getAllRoles();
            expect(roles).toHaveLength(3);
            expect(roles.map(r => r.name)).toContain('user');
            expect(roles.map(r => r.name)).toContain('admin');
            expect(roles.map(r => r.name)).toContain('super_admin');
        });
        it('should mark system roles as not deletable', async () => {
            const userRole = await rbac.getRole('user');
            const adminRole = await rbac.getRole('admin');
            const superAdminRole = await rbac.getRole('super_admin');
            expect(userRole?.isSystemRole).toBe(true);
            expect(adminRole?.isSystemRole).toBe(true);
            expect(superAdminRole?.isSystemRole).toBe(true);
        });
        it('should assign correct permissions to system roles', async () => {
            const userRole = await rbac.getRole('user');
            const adminRole = await rbac.getRole('admin');
            const superAdminRole = await rbac.getRole('super_admin');
            expect(userRole?.permissions.map(p => p.name)).toEqual(auth_entities_1.DEFAULT_PERMISSIONS.user);
            expect(adminRole?.permissions.map(p => p.name)).toEqual(auth_entities_1.DEFAULT_PERMISSIONS.admin);
            expect(superAdminRole?.permissions.map(p => p.name)).toEqual(auth_entities_1.DEFAULT_PERMISSIONS.super_admin);
        });
    });
    describe('checkPermissions', () => {
        it('should return true when user has required permissions', async () => {
            // Mock getUserPermissions to return user permissions
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_1', name: 'read:profile', resource: 'profile', action: 'read', description: 'Permission to read:profile' },
                { id: 'perm_2', name: 'update:profile', resource: 'profile', action: 'update', description: 'Permission to update:profile' }
            ]);
            const hasPermission = await rbac.checkPermissions('user123', ['read:profile']);
            expect(hasPermission).toBe(true);
        });
        it('should return false when user lacks required permissions', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_1', name: 'read:profile', resource: 'profile', action: 'read', description: 'Permission to read:profile' }
            ]);
            const hasPermission = await rbac.checkPermissions('user123', ['delete:users']);
            expect(hasPermission).toBe(false);
        });
        it('should check multiple permissions', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_1', name: 'read:profile', resource: 'profile', action: 'read', description: 'Permission to read:profile' },
                { id: 'perm_2', name: 'update:profile', resource: 'profile', action: 'update', description: 'Permission to update:profile' }
            ]);
            const hasAllPermissions = await rbac.checkPermissions('user123', ['read:profile', 'update:profile']);
            const lacksSomePermissions = await rbac.checkPermissions('user123', ['read:profile', 'delete:users']);
            expect(hasAllPermissions).toBe(true);
            expect(lacksSomePermissions).toBe(false);
        });
        it('should handle super admin with wildcard permissions', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_all', name: '*', resource: 'general', action: '*', description: 'Permission to *' }
            ]);
            const hasPermission = await rbac.checkPermissions('super_admin', ['delete:users', 'update:system', 'read:anything']);
            expect(hasPermission).toBe(true);
        });
        it('should handle wildcard action permissions', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_1', name: '*:users', resource: 'users', action: '*', description: 'Permission to *:users' }
            ]);
            const canRead = await rbac.checkPermissions('user123', ['read:users']);
            const canWrite = await rbac.checkPermissions('user123', ['write:users']);
            const canDelete = await rbac.checkPermissions('user123', ['delete:users']);
            const cannotProfile = await rbac.checkPermissions('user123', ['read:profile']);
            expect(canRead).toBe(true);
            expect(canWrite).toBe(true);
            expect(canDelete).toBe(true);
            expect(cannotProfile).toBe(false);
        });
        it('should handle wildcard resource permissions', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockResolvedValue([
                { id: 'perm_1', name: 'read:*', resource: '*', action: 'read', description: 'Permission to read:*' }
            ]);
            const canReadUsers = await rbac.checkPermissions('user123', ['read:users']);
            const canReadProfile = await rbac.checkPermissions('user123', ['read:profile']);
            const cannotDelete = await rbac.checkPermissions('user123', ['delete:users']);
            expect(canReadUsers).toBe(true);
            expect(canReadProfile).toBe(true);
            expect(cannotDelete).toBe(false);
        });
        it('should handle errors gracefully', async () => {
            jest.spyOn(rbac, 'getUserPermissions').mockRejectedValue(new Error('Database error'));
            const hasPermission = await rbac.checkPermissions('user123', ['read:profile']);
            expect(hasPermission).toBe(false);
        });
    });
    describe('getUserPermissions', () => {
        it('should get permissions from user roles', async () => {
            jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['user']);
            const permissions = await rbac.getUserPermissions('user123');
            expect(permissions).toHaveLength(auth_entities_1.DEFAULT_PERMISSIONS.user.length);
            expect(permissions.map(p => p.name)).toEqual(auth_entities_1.DEFAULT_PERMISSIONS.user);
        });
        it('should combine permissions from multiple roles', async () => {
            jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['user', 'admin']);
            const permissions = await rbac.getUserPermissions('user123');
            // Should have unique permissions from both roles
            const uniquePermissionNames = [...new Set([...auth_entities_1.DEFAULT_PERMISSIONS.user, ...auth_entities_1.DEFAULT_PERMISSIONS.admin])];
            expect(permissions.map(p => p.name).sort()).toEqual(uniquePermissionNames.sort());
        });
        it('should cache permissions', async () => {
            const getUserRolesSpy = jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['user']);
            // First call
            await rbac.getUserPermissions('user123');
            expect(getUserRolesSpy).toHaveBeenCalledTimes(1);
            // Second call should use cache
            await rbac.getUserPermissions('user123');
            expect(getUserRolesSpy).toHaveBeenCalledTimes(1);
        });
        it('should handle errors gracefully', async () => {
            jest.spyOn(rbac, 'getUserRoles').mockRejectedValue(new Error('Database error'));
            const permissions = await rbac.getUserPermissions('user123');
            expect(permissions).toEqual([]);
        });
    });
    describe('updateUserRoles', () => {
        it('should update user roles successfully', async () => {
            const saveUserRolesSpy = jest.spyOn(rbac, 'saveUserRoles').mockResolvedValue(undefined);
            await rbac.updateUserRoles('user123', ['user', 'admin']);
            expect(saveUserRolesSpy).toHaveBeenCalledWith('user123', ['user', 'admin']);
        });
        it('should clear permission cache after role update', async () => {
            jest.spyOn(rbac, 'saveUserRoles').mockResolvedValue(undefined);
            jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['user']);
            // Populate cache
            await rbac.getUserPermissions('user123');
            // Update roles
            await rbac.updateUserRoles('user123', ['admin']);
            // Check cache was cleared by seeing if getUserRoles is called again
            jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['admin']);
            await rbac.getUserPermissions('user123');
            expect(rbac['getUserRoles']).toHaveBeenCalledTimes(2);
        });
        it('should validate roles exist', async () => {
            await expect(rbac.updateUserRoles('user123', ['non_existent_role']))
                .rejects.toThrow('Role does not exist: non_existent_role');
        });
        it('should handle errors', async () => {
            jest.spyOn(rbac, 'saveUserRoles').mockRejectedValue(new Error('Database error'));
            await expect(rbac.updateUserRoles('user123', ['user']))
                .rejects.toThrow('Database error');
        });
    });
    describe('createRole', () => {
        it('should create a new custom role', async () => {
            const saveRoleSpy = jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            const roleData = {
                name: 'moderator',
                displayName: 'Moderator',
                description: 'Content moderator role',
                permissions: ['read:content', 'update:content', 'delete:content']
            };
            const role = await rbac.createRole(roleData);
            expect(role.name).toBe(roleData.name);
            expect(role.displayName).toBe(roleData.displayName);
            expect(role.description).toBe(roleData.description);
            expect(role.permissions).toHaveLength(3);
            expect(role.isSystemRole).toBe(false);
            expect(saveRoleSpy).toHaveBeenCalledWith(role);
        });
        it('should add role to system roles', async () => {
            jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            const roleData = {
                name: 'moderator',
                displayName: 'Moderator',
                description: 'Content moderator role',
                permissions: ['read:content']
            };
            await rbac.createRole(roleData);
            const role = await rbac.getRole('moderator');
            expect(role).toBeDefined();
            expect(role?.name).toBe('moderator');
        });
        it('should handle errors', async () => {
            jest.spyOn(rbac, 'saveRole').mockRejectedValue(new Error('Database error'));
            const roleData = {
                name: 'moderator',
                displayName: 'Moderator',
                description: 'Content moderator role',
                permissions: ['read:content']
            };
            await expect(rbac.createRole(roleData)).rejects.toThrow('Database error');
        });
    });
    describe('updateRolePermissions', () => {
        beforeEach(async () => {
            // Create a custom role for testing
            jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            await rbac.createRole({
                name: 'test_role',
                displayName: 'Test Role',
                description: 'Test role',
                permissions: ['read:test']
            });
        });
        it('should update permissions for custom role', async () => {
            const saveRoleSpy = jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            await rbac.updateRolePermissions('test_role', ['read:test', 'write:test']);
            const role = await rbac.getRole('test_role');
            expect(role?.permissions.map(p => p.name)).toEqual(['read:test', 'write:test']);
            expect(saveRoleSpy).toHaveBeenCalled();
        });
        it('should not allow updating system roles', async () => {
            await expect(rbac.updateRolePermissions('user', ['delete:everything']))
                .rejects.toThrow('Cannot modify system role');
        });
        it('should throw error for non-existent role', async () => {
            await expect(rbac.updateRolePermissions('non_existent', ['read:test']))
                .rejects.toThrow('Role does not exist: non_existent');
        });
        it('should clear all permission caches', async () => {
            const clearSpy = jest.spyOn(rbac['permissionCache'], 'clear');
            jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            await rbac.updateRolePermissions('test_role', ['read:test', 'write:test']);
            expect(clearSpy).toHaveBeenCalled();
        });
    });
    describe('deleteRole', () => {
        beforeEach(async () => {
            // Create a custom role for testing
            jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            await rbac.createRole({
                name: 'deletable_role',
                displayName: 'Deletable Role',
                description: 'Role to be deleted',
                permissions: ['read:test']
            });
        });
        it('should delete custom role', async () => {
            jest.spyOn(rbac, 'getUsersWithRole').mockResolvedValue([]);
            const deleteRoleSpy = jest.spyOn(rbac, 'deleteRoleFromDatabase').mockResolvedValue(undefined);
            await rbac.deleteRole('deletable_role');
            expect(deleteRoleSpy).toHaveBeenCalled();
            const role = await rbac.getRole('deletable_role');
            expect(role).toBeNull();
        });
        it('should not allow deleting system roles', async () => {
            await expect(rbac.deleteRole('user'))
                .rejects.toThrow('Cannot delete system role');
        });
        it('should not delete role if users have it', async () => {
            jest.spyOn(rbac, 'getUsersWithRole').mockResolvedValue(['user1', 'user2']);
            await expect(rbac.deleteRole('deletable_role'))
                .rejects.toThrow('Cannot delete role: 2 users have this role');
        });
        it('should throw error for non-existent role', async () => {
            await expect(rbac.deleteRole('non_existent'))
                .rejects.toThrow('Role does not exist: non_existent');
        });
    });
    describe('role checking methods', () => {
        beforeEach(() => {
            jest.spyOn(rbac, 'getUserRoles').mockResolvedValue(['user', 'admin']);
        });
        describe('hasRole', () => {
            it('should return true if user has role', async () => {
                const hasUserRole = await rbac.hasRole('user123', 'user');
                const hasAdminRole = await rbac.hasRole('user123', 'admin');
                expect(hasUserRole).toBe(true);
                expect(hasAdminRole).toBe(true);
            });
            it('should return false if user lacks role', async () => {
                const hasSuperAdminRole = await rbac.hasRole('user123', 'super_admin');
                expect(hasSuperAdminRole).toBe(false);
            });
        });
        describe('hasAnyRole', () => {
            it('should return true if user has any of the specified roles', async () => {
                const hasAny = await rbac.hasAnyRole('user123', ['super_admin', 'admin']);
                expect(hasAny).toBe(true);
            });
            it('should return false if user has none of the specified roles', async () => {
                const hasAny = await rbac.hasAnyRole('user123', ['super_admin', 'moderator']);
                expect(hasAny).toBe(false);
            });
        });
        describe('hasAllRoles', () => {
            it('should return true if user has all specified roles', async () => {
                const hasAll = await rbac.hasAllRoles('user123', ['user', 'admin']);
                expect(hasAll).toBe(true);
            });
            it('should return false if user lacks any specified role', async () => {
                const hasAll = await rbac.hasAllRoles('user123', ['user', 'admin', 'super_admin']);
                expect(hasAll).toBe(false);
            });
        });
    });
    describe('getAllRoles', () => {
        it('should return all roles including custom ones', async () => {
            jest.spyOn(rbac, 'saveRole').mockResolvedValue(undefined);
            // Create a custom role
            await rbac.createRole({
                name: 'custom_role',
                displayName: 'Custom Role',
                description: 'A custom role',
                permissions: ['read:custom']
            });
            const allRoles = await rbac.getAllRoles();
            expect(allRoles).toHaveLength(4); // 3 system + 1 custom
            expect(allRoles.map(r => r.name)).toContain('custom_role');
        });
    });
    describe('getRole', () => {
        it('should return role by name', async () => {
            const userRole = await rbac.getRole('user');
            expect(userRole).toBeDefined();
            expect(userRole?.name).toBe('user');
            expect(userRole?.isSystemRole).toBe(true);
        });
        it('should return null for non-existent role', async () => {
            const role = await rbac.getRole('non_existent');
            expect(role).toBeNull();
        });
    });
});
//# sourceMappingURL=rbac-manager.test.js.map