import React, { useState, useEffect } from 'react';
import { EDF, Category, EDFItem, EDFStatus } from '../types.ts';
import { X, Plus, Trash2, CheckCircle2, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { RequesterDropdown, CATEGORY_REQUESTERS_MAP, normalizeCategoryKey } from './RequesterDropdown.tsx';

interface CreateEditEDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (edfData: any) => Promise<boolean>;
  categories: Category[];
  editingEdf?: EDF | null;
}

export const CreateEditEDFModal: React.FC<CreateEditEDFModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  editingEdf,
}) => {
  const isEditing = Boolean(editingEdf);

  const [edfNumber, setEdfNumber] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [category, setCategory] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [status, setStatus] = useState<EDFStatus>('Pending');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<EDFItem[]>([
    { itemDescription: '', quantity: 1, unit: 'pcs' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEdf) {
      setEdfNumber(editingEdf.edfNumber);
      setRequesterName(editingEdf.requesterName);
      setCategory(editingEdf.category);
      setIssueDate(new Date(editingEdf.issueDate).toISOString().slice(0, 10));
      setRequiredDate(new Date(editingEdf.requiredDate).toISOString().slice(0, 10));
      setStatus(editingEdf.status);
      setRemarks(editingEdf.remarks || '');
      if (editingEdf.items && editingEdf.items.length > 0) {
        setItems(editingEdf.items);
      } else {
        setItems([
          {
            itemDescription: editingEdf.materialList,
            quantity: editingEdf.quantity,
            unit: editingEdf.unit,
          },
        ]);
      }
    } else {
      // Create mode defaults: Category must be selected first
      const now = new Date();
      const inThreeDays = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
      setEdfNumber('');
      setRequesterName('');
      setCategory(''); // Category must be chosen first
      setIssueDate(now.toISOString().slice(0, 10));
      setRequiredDate(inThreeDays.toISOString().slice(0, 10));
      setStatus('Pending');
      setRemarks('');
      setItems([{ itemDescription: '', quantity: 1, unit: 'pcs' }]);
    }
    setError(null);
  }, [editingEdf, isOpen, categories]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    // When category changes, verify if the currently selected requester belongs to the new team
    if (requesterName && newCat) {
      const norm = normalizeCategoryKey(newCat);
      if (norm !== 'general' && CATEGORY_REQUESTERS_MAP[norm]) {
        const allowed = CATEGORY_REQUESTERS_MAP[norm].map((n) => n.toLowerCase());
        if (!allowed.includes(requesterName.toLowerCase())) {
          setRequesterName(''); // Reset selection as name does not belong to new category
        }
      }
    } else if (!newCat) {
      setRequesterName('');
    }
    if (error) setError(null);
  };

  const handleItemChange = (index: number, field: keyof EDFItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { itemDescription: '', quantity: 1, unit: 'pcs' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ itemDescription: '', quantity: 1, unit: 'pcs' }]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category.trim()) {
      setError('Please select a Category first.');
      return;
    }

    if (!requesterName.trim()) {
      setError('Please select a Requester Name from the list.');
      return;
    }

    if (!requiredDate) {
      setError('Please specify the Required Date');
      return;
    }

    const validItems = items.filter((i) => i.itemDescription && i.itemDescription.trim());
    if (validItems.length === 0) {
      setError('Please add at least one material item with a description');
      return;
    }

    // Material list summary
    const materialSummary = validItems
      .map((i) => `${i.itemDescription} (${i.quantity} ${i.unit})`)
      .slice(0, 3)
      .join(', ') + (validItems.length > 3 ? ` + ${validItems.length - 3} more` : '');

    const totalQty = validItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const reqIso = new Date(`${requiredDate}T23:59:59`).toISOString();

    const payload = {
      edfNumber: edfNumber.trim() || undefined,
      requesterName: requesterName.trim(),
      category: category.trim(),
      issueDate: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
      requiredDate: reqIso,
      materialList: materialSummary,
      quantity: totalQty,
      unit: validItems[0]?.unit || 'pcs',
      status,
      remarks: remarks.trim() || null,
      items: validItems,
    };

    setIsSubmitting(true);
    const success = await onSave(payload);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isEditing ? `Edit Demand Form (${editingEdf?.edfNumber})` : 'Create New Demand Form (EDF)'}
              </h3>
              <p className="text-xs text-slate-400">
                Single Office Coordinator Entry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Main Grid: Category (Select First), Requester Name (Filtered), EDF Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Category / Team *</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Step 1</span>
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                  !category
                    ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
                required
              >
                <option value="">-- Select Category / Team First --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Requester Name *</span>
                {category ? (
                  <span className="text-[10px] text-slate-400 font-medium">Team: {category}</span>
                ) : (
                  <span className="text-[10px] text-amber-500 font-bold">Pick Category First</span>
                )}
              </label>
              <RequesterDropdown
                value={requesterName}
                onChange={(val) => {
                  setRequesterName(val);
                  if (val.trim() && error) setError(null);
                }}
                category={category}
                placeholder={category ? `Select ${category} Requester...` : 'Select Category first...'}
                required
                error={error && !requesterName.trim() ? 'Requester name is mandatory' : null}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                EDF Number
              </label>
              <input
                type="text"
                value={edfNumber}
                onChange={(e) => setEdfNumber(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dates & Status Grid (Clean 3-Column Layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Issue Date *
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Required Date *
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Pending">Pending</option>
                <option value="Received">Received</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Material Items List - Order: Material -> Unit -> Quantity */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Material List & Quantities *
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Column Header Guide */}
            <div className="hidden sm:flex items-center gap-2 px-1 pb-1 text-[11px] font-bold text-slate-400">
              <span className="flex-1">Material / Description</span>
              <span className="w-24">Unit</span>
              <span className="w-24">Quantity</span>
              <span className="w-8"></span>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 sm:bg-transparent dark:bg-slate-950/40 sm:dark:bg-transparent border sm:border-0 border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    value={item.itemDescription}
                    onChange={(e) => handleItemChange(index, 'itemDescription', e.target.value)}
                    placeholder="Material description (e.g. Copper Cable 16mm)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                      placeholder="Unit (e.g. pcs)"
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)
                      }
                      placeholder="Qty"
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Remarks & Installation Notes
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Delivered to basement sub-station panel B"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Update Demand Form' : 'Create Demand Form'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
