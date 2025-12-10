'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  X,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
} from 'lucide-react';

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count?: {
    sessions: number;
  };
};

const ROLES: { value: AdminRole; label: string; description: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full access to all features and settings' },
  { value: 'ADMIN', label: 'Admin', description: 'Can manage content and users' },
  { value: 'EDITOR', label: 'Editor', description: 'Can edit content only' },
];

const emptyUser = {
  email: '',
  name: '',
  password: '',
  role: 'EDITOR' as AdminRole,
  isActive: true,
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState(emptyUser);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/admin/auth/me');
      const data = await response.json();
      if (data.user) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      if (data.ok && data.data) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData(emptyUser);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData(emptyUser);
    setShowPassword(false);
  };

  const handleSave = async () => {
    if (!formData.email.trim() || !formData.name.trim()) {
      setMessage({ type: 'error', text: 'Email and name are required' });
      return;
    }

    if (!editingUser && !formData.password) {
      setMessage({ type: 'error', text: 'Password is required for new users' });
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save user');
      }

      setMessage({
        type: 'success',
        text: editingUser ? 'User updated successfully!' : 'User created successfully!',
      });
      closeModal();
      fetchUsers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save user',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      setMessage({ type: 'success', text: 'User deleted successfully!' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete user',
      });
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: !user.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      setMessage({
        type: 'success',
        text: `User ${user.isActive ? 'deactivated' : 'activated'} successfully!`,
      });
      fetchUsers();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update user',
      });
    }
  };

  const handleResendVerification = async (user: AdminUser) => {
    setResendingVerification(user.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend_verification' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email');
      }

      setMessage({
        type: 'success',
        text: `Verification email sent to ${user.email}`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to resend verification email',
      });
    } finally {
      setResendingVerification(null);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getRoleIcon = (role: AdminRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case 'ADMIN':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 'EDITOR':
        return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleBadgeColor = (role: AdminRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'ADMIN':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'EDITOR':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const canManageUser = (targetUser: AdminUser) => {
    if (!currentUser) return false;
    if (currentUser.id === targetUser.id) return true;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.role === 'ADMIN' && targetUser.role !== 'SUPER_ADMIN') return true;
    return false;
  };

  const canDeleteUser = (targetUser: AdminUser) => {
    if (!currentUser) return false;
    if (currentUser.id === targetUser.id) return false; // Can't delete yourself
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.role === 'ADMIN' && targetUser.role === 'EDITOR') return true;
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 mt-1">
            Manage admin users and their permissions.
          </p>
        </div>
        {currentUser && currentUser.role !== 'EDITOR' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Users List */}
      {users.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">No users found.</p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-medium text-slate-400">User</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Role</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Last Login</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{user.name}</span>
                          {currentUser?.id === user.id && (
                            <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {getRoleIcon(user.role)}
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-green-400">
                          <UserCheck className="w-4 h-4" />
                          <span className="text-sm">Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <UserX className="w-4 h-4" />
                          <span className="text-sm">Inactive</span>
                        </span>
                      )}
                      <div>
                        {user.emailVerified ? (
                          <span className="inline-flex items-center gap-1.5 text-cyan-400">
                            <MailCheck className="w-3.5 h-3.5" />
                            <span className="text-xs">Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-400">
                            <MailX className="w-3.5 h-3.5" />
                            <span className="text-xs">Unverified</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-400 text-sm">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Resend Verification Button - show for unverified users */}
                      {!user.emailVerified && canManageUser(user) && (
                        <button
                          onClick={() => handleResendVerification(user)}
                          disabled={resendingVerification === user.id}
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Resend verification email"
                        >
                          {resendingVerification === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {canManageUser(user) && (
                        <>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {currentUser?.id !== user.id && (
                            <button
                              onClick={() => handleToggleActive(user)}
                              className={`p-2 rounded-lg transition-colors ${
                                user.isActive
                                  ? 'text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                                  : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
                              }`}
                              title={user.isActive ? 'Deactivate user' : 'Activate user'}
                            >
                              {user.isActive ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                      {canDeleteUser(user) && (
                        <>
                          {deleteConfirm === user.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative bg-slate-900 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="John Doe"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="john@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-2 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    placeholder={editingUser ? '••••••••' : 'Min. 8 characters'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role
                </label>
                <div className="space-y-2">
                  {ROLES.map((role) => {
                    const isDisabled =
                      currentUser?.role !== 'SUPER_ADMIN' && role.value === 'SUPER_ADMIN';
                    return (
                      <label
                        key={role.value}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.role === role.value
                            ? 'bg-cyan-500/10 border-cyan-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={formData.role === role.value}
                          onChange={handleChange}
                          disabled={isDisabled}
                          className="mt-1 w-4 h-4 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role.value)}
                            <span className="text-sm font-medium text-white">
                              {role.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {role.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Status */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-300">Active Account</span>
                    <p className="text-xs text-slate-500">
                      Inactive users cannot log in to the admin panel
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
