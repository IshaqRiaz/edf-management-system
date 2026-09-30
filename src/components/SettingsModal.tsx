import React, { useState } from 'react';
import { Category } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  KeyRound,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  Lock,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onRefreshCategories: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRefreshCategories,
}) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'password' | 'categories' | 'system'>('password');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Category state (Admin only)
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catMsg, setCatMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const token = localStorage.getItem('edf_auth_token');

  if (!isOpen) return null;

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to update password' });
        return;
      }

      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Error updating password' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatMsg(null);

    if (!newCatName.trim()) {
      setCatMsg({ type: 'error', text: 'Category name is required' });
      return;
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCatMsg({ type: 'error', text: data.error || 'Failed to add category' });
        return;
      }

      setCatMsg({ type: 'success', text: `Category "${data.name}" added successfully!` });
      setNewCatName('');
      setNewCatDesc('');
      onRefreshCategories();
    } catch (err: any) {
      setCatMsg({ type: 'error', text: err.message || 'Error adding category' });
    }
  };

  const handleDeleteCategory = async (catId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setCatMsg({ type: 'success', text: `Category "${name}" deleted.` });
        onRefreshCategories();
      } else {
        const data = await res.json();
        setCatMsg({ type: 'error', text: data.error || 'Failed to delete category' });
      }
    } catch (err: any) {
      setCatMsg({ type: 'error', text: err.message || 'Error deleting category' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40">
          <div>
            <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
              System Settings & Preferences
            </h3>
            <p className="text-xs text-stone-400">
              Account security and office configuration
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-stone-100 dark:border-stone-800 px-6 bg-stone-50/25 dark:bg-stone-950/20">
          <button
            onClick={() => setActiveTab('password')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'password'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            Change Password
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'categories'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              Manage Categories
            </button>
          )}

          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'system'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            Database Info
          </button>
        </div>

        {/* Tab contents */}
        <div className="p-6">
          {/* TAB 1: CHANGE OWN PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangeOwnPassword} className="space-y-4">
              <p className="text-xs text-stone-500">
                Logged in as <strong>{user?.name}</strong> ({user?.phone}). Update your account access password below.
              </p>

              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {passwordMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: MANAGE CATEGORIES (Admin only) */}
          {activeTab === 'categories' && isAdmin && (
            <div className="space-y-5">
              <p className="text-xs text-stone-500">
                Add custom categories or delete obsolete categories used across all Employee Demand Forms.
              </p>

              {catMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    catMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span>{catMsg.text}</span>
                </div>
              )}

              {/* Add form */}
              <form onSubmit={handleAddCategory} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name (e.g. IT Equipment)"
                    className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Description / scope"
                    className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Category</span>
                  </button>
                </div>
              </form>

              {/* Existing categories list */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
                {categories.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between hover:bg-stone-50/50 dark:hover:bg-stone-800/40">
                    <div>
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        {c.name}
                      </span>
                      {c.description && (
                        <p className="text-[11px] text-stone-400 mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DATABASE INFO */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                <Database className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold">
                    Relational Cloud SQL PostgreSQL Active
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Instance: ai-studio-036e3901 • Region: asia-southeast1
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-400">Database Engine</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">Cloud SQL (PostgreSQL 16)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-400">ORM Schema Tool</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">Drizzle ORM</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-400">Connection Pooling</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">pg.Pool (Object Method)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">Live Timer Engine</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">1000ms Real-Time Clock</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
