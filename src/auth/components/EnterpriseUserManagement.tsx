/**
 * @fileoverview Enterprise user management React component
 * @description Frontend interface for managing enterprise users, teams, and organizations
 * @author Web-Buddy Team
 */

import React, { useState, useEffect } from 'react';
import { 
  Organization, 
  Team, 
  EnterpriseUser, 
  OrganizationMembership, 
  TeamMembership 
} from '../domain/enterprise-entities';

interface EnterpriseUserManagementProps {
  currentUser: EnterpriseUser;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roles: string[];
  teamIds: string[];
  ssoEnabled: boolean;
}

interface TeamFormData {
  name: string;
  displayName: string;
  description: string;
  type: 'department' | 'project' | 'custom';
  parentTeamId?: string;
}

export const EnterpriseUserManagement: React.FC<EnterpriseUserManagementProps> = ({
  currentUser,
  onError,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'organizations'>('users');
  const [users, setUsers] = useState<EnterpriseUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EnterpriseUser | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [userFormData, setUserFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roles: ['org_member'],
    teamIds: [],
    ssoEnabled: false
  });

  const [teamFormData, setTeamFormData] = useState<TeamFormData>({
    name: '',
    displayName: '',
    description: '',
    type: 'department'
  });

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadTeams(),
        loadOrganizations()
      ]);
    } catch (error) {
      onError?.('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/enterprise/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/enterprise/users/me/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch('/api/enterprise/users/me/organizations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/enterprise/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          ...userFormData,
          organizationId: currentUser.organizationId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUsers([...users, data.data]);
        setShowUserForm(false);
        setUserFormData({
          email: '',
          firstName: '',
          lastName: '',
          password: '',
          roles: ['org_member'],
          teamIds: [],
          ssoEnabled: false
        });
        onSuccess?.('User created successfully');
      } else {
        const error = await response.json();
        onError?.(error.message || 'Failed to create user');
      }
    } catch (error) {
      onError?.('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/enterprise/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          ...teamFormData,
          organizationId: currentUser.organizationId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTeams([...teams, data.data]);
        setShowTeamForm(false);
        setTeamFormData({
          name: '',
          displayName: '',
          description: '',
          type: 'department'
        });
        onSuccess?.('Team created successfully');
      } else {
        const error = await response.json();
        onError?.(error.message || 'Failed to create team');
      }
    } catch (error) {
      onError?.('Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/enterprise/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        await loadUsers();
        onSuccess?.('User role updated successfully');
      } else {
        const error = await response.json();
        onError?.(error.message || 'Failed to update user role');
      }
    } catch (error) {
      onError?.('Failed to update user role');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUserToTeam = async (userId: string, teamId: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/enterprise/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        await loadUsers();
        onSuccess?.('User added to team successfully');
      } else {
        const error = await response.json();
        onError?.(error.message || 'Failed to add user to team');
      }
    } catch (error) {
      onError?.('Failed to add user to team');
    } finally {
      setLoading(false);
    }
  };

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <button
          onClick={() => setShowUserForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add User
        </button>
      </div>

      {showUserForm && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Create New User</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={userFormData.firstName}
                  onChange={(e) => setUserFormData({...userFormData, firstName: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={userFormData.lastName}
                  onChange={(e) => setUserFormData({...userFormData, lastName: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={userFormData.roles[0]}
                  onChange={(e) => setUserFormData({...userFormData, roles: [e.target.value]})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="org_member">Organization Member</option>
                  <option value="org_admin">Organization Admin</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teams</label>
                <select
                  multiple
                  value={userFormData.teamIds}
                  onChange={(e) => setUserFormData({
                    ...userFormData, 
                    teamIds: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="ssoEnabled"
                checked={userFormData.ssoEnabled}
                onChange={(e) => setUserFormData({...userFormData, ssoEnabled: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="ssoEnabled" className="ml-2 block text-sm text-gray-900">
                Enable SSO
              </label>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUserForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teams
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {user.roles[0]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.teamIds.length} team(s)
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleUpdateUserRole(user.id, user.roles[0] === 'org_member' ? 'org_admin' : 'org_member')}
                    className="text-green-600 hover:text-green-900"
                  >
                    Toggle Role
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTeamsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Teams</h2>
        <button
          onClick={() => setShowTeamForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Create Team
        </button>
      </div>

      {showTeamForm && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Team Name</label>
                <input
                  type="text"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData({...teamFormData, name: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={teamFormData.displayName}
                  onChange={(e) => setTeamFormData({...teamFormData, displayName: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={teamFormData.description}
                onChange={(e) => setTeamFormData({...teamFormData, description: e.target.value})}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={teamFormData.type}
                onChange={(e) => setTeamFormData({...teamFormData, type: e.target.value as 'department' | 'project' | 'custom'})}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="department">Department</option>
                <option value="project">Project</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowTeamForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{team.displayName}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                team.type === 'department' 
                  ? 'bg-blue-100 text-blue-800'
                  : team.type === 'project'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {team.type}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{team.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Created: {new Date(team.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => setSelectedTeam(team)}
                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
              >
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderOrganizationsTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {organizations.map((org) => (
          <div key={org.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{org.displayName}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                org.tier === 'enterprise' 
                  ? 'bg-purple-100 text-purple-800'
                  : org.tier === 'premium'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {org.tier}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{org.description}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Domain:</span>
                <span className="text-gray-900">{org.domain || 'Not set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${
                  org.status === 'active' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {org.status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-900">{new Date(org.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Enterprise Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage users, teams, and organizations in your enterprise environment
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'users', label: 'Users', count: users.length },
            { key: 'teams', label: 'Teams', count: teams.length },
            { key: 'organizations', label: 'Organizations', count: organizations.length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'teams' && renderTeamsTab()}
      {activeTab === 'organizations' && renderOrganizationsTab()}
    </div>
  );
};