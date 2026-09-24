import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Tag,
  Fan,
  Wrench,
  Zap,
  Phone,
  Activity,
  Package,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Category, EDF } from '../types/index.ts';

interface CategoriesPageProps {
  categories: Category[];
  edfs: EDF[];
  onAddCategory: (categoryName: string, description: string) => Promise<void>;
  onSelectCategoryFilter: (categoryName: string) => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  categories,
  edfs,
  onAddCategory,
  onSelectCategoryFilter,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const getCategoryIcon = (name: string) => {
    const l = name.toLowerCase();
    if (l.includes('hvac') || l.includes('ac')) return Fan;
    if (l.includes('plumb')) return Wrench;
    if (l.includes('generator')) return Zap;
    if (l.includes('phone') || l.includes('telecom')) return Phone;
    if (l.includes('electr')) return Activity;
    return Package;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddCategory(newCatName.trim(), newCatDesc.trim());
      setNewCatName('');
      setNewCatDesc('');
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Technical Categories & Departments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage material classification categories for HVAC, Plumbing, Generator, Electrical, and expand as needed.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Category</span>
        </button>
      </div>

      {/* Add Category Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Register New Technical Category
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Fire Fighting & Safety, Civil Works, Carpentry"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scope / Description
              </label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="e.g. Safety sensors, extinguishers, sprinkler valves"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white"
            >
              {isSubmitting ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.categoryName);
          const categoryEdfs = edfs.filter((e) => e.categoryName === cat.categoryName);
          const activeEdfs = categoryEdfs.filter(
            (e) => e.status !== 'Completed' && e.status !== 'Received'
          );
          const overdueEdfs = categoryEdfs.filter((e) => e.status === 'Overdue');

          return (
            <div
              key={cat.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-sky-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {cat.categoryName}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {cat.description || 'Standard technical material category for maintenance requisitions.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Demands:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {categoryEdfs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Active / Pending:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {activeEdfs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Overdue:</span>
                  <span
                    className={`font-mono font-bold ${
                      overdueEdfs.length > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {overdueEdfs.length}
                  </span>
                </div>

                <button
                  onClick={() => onSelectCategoryFilter(cat.categoryName)}
                  className="w-full mt-2 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  View All {cat.categoryName} EDFs
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
