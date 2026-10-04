import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types.ts';
import {
  Users as UsersIcon,
  UserPlus,
  KeyRound,
  Shield,
  User as UserIcon,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Sparkles,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface UserManagerProps {
  currentUserId?: number;
  onCurrentUserUpdated?: (updatedUser: User) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  currentUserId,
  onCurrentUserUpdated,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'visitor'>('all');

  // Track which users' passwords are currently revealed (Requirement 1: View Password)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);

  // Update Password Modal State (Requirement 2: Update Password)
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Edit Name Modal / Inline Edit State (Requirement 4: Modify User Name)
  const [editNameUser, setEditNameUser] = useState<User | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Self Demotion Confirmation Warning
  const [selfDemoteConfirm, setSelfDemoteConfirm] = useState<{
    user: User;
    targetRole: UserRole;
  } | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('visitor');
  const [newPassword, setNewPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('edf_auth_token') : null;

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load users');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ---------------------------------------------------------
  // 1. VIEW PASSWORD (Requirement 1)
  // ---------------------------------------------------------
  const toggleViewPassword = (userId: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const copyPasswordToClipboard = (password: string, userId: number) => {
    if (!password) return;
    navigator.clipboard.writeText(password).then(() => {
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    });
  };

  // ---------------------------------------------------------
  // 2. UPDATE PASSWORD (Requirement 2)
  // ---------------------------------------------------------
  const handleOpenPasswordModal = (user: User) => {
    setPasswordModalUser(user);
    setNewPasswordVal('');
    setShowNewPassword(false);
  };

  const handleSubmitUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordVal.trim()) return;

    if (newPasswordVal.trim().length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`/api/users/${passwordModalUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: newPasswordVal.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update password');
        return;
      }

      setSuccessMsg(`Password for ${passwordModalUser.name} updated successfully!`);
      // Update local state immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.id === passwordModalUser.id
            ? { ...u, displayPassword: newPasswordVal.trim() }
            : u
        )
      );
      // Reveal the newly set password
      setRevealedPasswords((prev) => ({
        ...prev,
        [passwordModalUser.id]: true,
      }));

      setPasswordModalUser(null);
      setNewPasswordVal('');
    } catch (err: any) {
      setError(err.message || 'Error updating password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // ---------------------------------------------------------
  // 3. MODIFY USER ROLE (Requirement 3)
  // ---------------------------------------------------------
  const executeRoleChange = async (userId: number, targetRole: UserRole) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: targetRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update user role');
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: targetRole } : u))
      );

      const targetUser = users.find((u) => u.id === userId);
      const userName = targetUser?.name || 'User';
      const roleLabel = targetRole === 'admin' ? 'Admin (Coordinator)' : 'Visitor';
      setSuccessMsg(`Role for ${userName} changed to ${roleLabel}`);

      if (userId === currentUserId && onCurrentUserUpdated) {
        onCurrentUserUpdated({ ...targetUser!, role: targetRole });
      }
    } catch (err: any) {
      setError(err.message || 'Error updating user role');
    }
  };

  const handleRoleChangeSelect = (user: User, newRole: UserRole) => {
    if (user.role === newRole) return;

    // If Admin is demoting their own account, require confirmation
    if (user.id === currentUserId && newRole === 'visitor') {
      setSelfDemoteConfirm({ user, targetRole: newRole });
      return;
    }

    executeRoleChange(user.id, newRole);
  };

  // ---------------------------------------------------------
  // 4. MODIFY USER NAME (Requirement 4)
  // ---------------------------------------------------------
  const handleOpenEditNameModal = (user: User) => {
    setEditNameUser(user);
    setEditNameVal(user.name);
  };

  const handleSubmitEditName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNameUser || !editNameVal.trim()) return;

    const trimmedName = editNameVal.trim();
    if (trimmedName === editNameUser.name) {
      setEditNameUser(null);
      return;
    }

    setIsSavingName(true);
    try {
      const res = await fetch(`/api/users/${editNameUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update user name');
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === editNameUser.id ? { ...u, name: trimmedName } : u))
      );

      setSuccessMsg(`User name updated to "${trimmedName}" successfully`);

      if (editNameUser.id === currentUserId && onCurrentUserUpdated) {
        onCurrentUserUpdated({ ...editNameUser, name: trimmedName });
      }

      setEditNameUser(null);
    } catch (err: any) {
      setError(err.message || 'Error updating user name');
    } finally {
      setIsSavingName(false);
    }
  };

  // ---------------------------------------------------------
  // CREATE NEW USER
  // ---------------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPhone.trim() || !newName.trim() || !newPassword.trim()) {
      setError('Please fill in all user fields');
      return;
    }

    if (newPassword.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: newPhone.trim(),
          name: newName.trim(),
          role: newRole,
          password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }

      setSuccessMsg(`User ${data.name} created successfully!`);
      setShowCreateModal(false);
      setNewPhone('');
      setNewName('');
      setNewPassword('');
      setNewRole('visitor');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error creating user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // ---------------------------------------------------------
  // DELETE USER
  // ---------------------------------------------------------
  const handleDeleteUser = async (userId: number, name: string) => {
    if (userId === currentUserId) {
      setError('You cannot delete your own active administrator account');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSuccessMsg(`User "${name}" deleted`);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting user');
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.phone.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 shadow-xs">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                User Management
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                Admin Control
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              View & update user passwords, modify permissions (Admin ↔ Visitor), edit names, and provision new accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Notifications / Error Feedback */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or phone..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Role:</span>
          {(['all', 'admin', 'visitor'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {r === 'all' ? 'All Roles' : r === 'admin' ? 'Admins' : 'Visitors'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 tracking-wider text-[11px] font-bold">
                <th className="py-3.5 px-4 min-w-[200px]">User Name</th>
                <th className="py-3.5 px-4 min-w-[140px]">Phone (Username)</th>
                <th className="py-3.5 px-4 min-w-[170px]">Role Permission</th>
                <th className="py-3.5 px-4 min-w-[210px]">Password (Secured)</th>
                <th className="py-3.5 px-4 min-w-[110px]">Created</th>
                <th className="py-3.5 px-4 text-right min-w-[200px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="font-semibold text-xs">Loading user registry...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-semibold">No users matching search or filter</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isPasswordRevealed = Boolean(revealedPasswords[u.id]);
                  const currentPassword = u.displayPassword || (u.role === 'admin' ? 'admin123' : 'visitor123');

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 4. USER NAME WITH EDIT NAME BUTTON (Requirement 4) */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center justify-between gap-2 group">
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                              {u.name[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="truncate">
                              <span className="block truncate font-extrabold">{u.name}</span>
                              {isSelf && (
                                <span className="inline-block text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Your Account
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Edit Name Button (Requirement 4) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditNameModal(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            title="Edit user name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Phone (Username) */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {u.phone}
                      </td>

                      {/* 3. ROLE DROPDOWN (Requirement 3: Modify User Role) */}
                      <td className="py-3.5 px-4">
                        <div className="relative inline-block w-full max-w-[160px]">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChangeSelect(u, e.target.value as UserRole)
                            }
                            className={`w-full appearance-none pl-7 pr-8 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              u.role === 'admin'
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:border-indigo-300'
                                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                            title="Change user role immediately"
                            aria-label={`Role for ${u.name}`}
                          >
                            <option value="visitor">Visitor</option>
                            <option value="admin">Admin</option>
                          </select>

                          {/* Role Icon inside dropdown */}
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            {u.role === 'admin' ? (
                              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 1. VIEW PASSWORD COLUMN & BUTTON (Requirement 1: View Password) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs flex items-center gap-2 min-w-[120px] justify-between">
                            <span className="font-bold text-slate-900 dark:text-white select-all">
                              {isPasswordRevealed ? currentPassword : '••••••••'}
                            </span>

                            {/* View / Hide Eye Button */}
                            <button
                              type="button"
                              onClick={() => toggleViewPassword(u.id)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                              title={isPasswordRevealed ? 'Hide Password' : 'View Password'}
                              aria-label={isPasswordRevealed ? 'Hide Password' : 'View Password'}
                            >
                              {isPasswordRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Quick Copy Password Button */}
                          <button
                            type="button"
                            onClick={() => copyPasswordToClipboard(currentPassword, u.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            title="Copy password to clipboard"
                          >
                            {copiedUserId === u.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-400 font-medium text-[11px] whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* ACTIONS: Update Password, Edit Name, Delete */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. View Password Button (Explicit) */}
                          <button
                            type="button"
                            onClick={() => toggleViewPassword(u.id)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              isPasswordRevealed
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                            title="View or hide password"
                          >
                            {isPasswordRevealed ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Password</span>
                              </>
                            )}
                          </button>

                          {/* 2. Update Password Button (Requirement 2) */}
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordModal(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-colors cursor-pointer"
                            title="Set new password for this user"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Update Password</span>
                          </button>

                          {/* 4. Edit Name Button (Requirement 4) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditNameModal(u)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit user name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. UPDATE PASSWORD MODAL (Requirement 2)                                  */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Update Password
                </h3>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Target User:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {passwordModalUser.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone (Username):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {passwordModalUser.phone}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Current Password:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 select-all">
                  {passwordModalUser.displayPassword || (passwordModalUser.role === 'admin' ? 'admin123' : 'visitor123')}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Set New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !newPasswordVal.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EDIT NAME MODAL (Requirement 4)                                        */}
      {/* ========================================================================= */}
      {editNameUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Edit User Name
                </h3>
              </div>
              <button
                onClick={() => setEditNameUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Update the display name for user with phone number{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{editNameUser.phone}</strong>.
            </p>

            <form onSubmit={handleSubmitEditName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editNameVal}
                  onChange={(e) => setEditNameVal(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditNameUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingName || !editNameVal.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  {isSavingName ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SELF DEMOTION CONFIRMATION WARNING MODAL                                   */}
      {/* ========================================================================= */}
      {selfDemoteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Demoting Your Own Account?
                </h3>
                <p className="text-xs text-slate-500">
                  Action requires confirmation
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You are changing your role to <strong>Visitor</strong>. You will lose access to User Management, EDF creation, and administrative edits immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelfDemoteConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { user, targetRole } = selfDemoteConfirm;
                  setSelfDemoteConfirm(null);
                  executeRoleChange(user.id, targetRole);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Confirm Demotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW USER MODAL                                                     */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Create New System User
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone Number (Username) *
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 03005551234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Role Permission *
                </label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="visitor">Visitor (Search & View Only)</option>
                  <option value="admin">Admin Coordinator (Full Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
