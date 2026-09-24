import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  FileCheck,
  HardHat,
  ArrowLeft,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { MaterialItem, Category, EDFPriority } from '../types/index.ts';
import { calculateRemainingTime } from '../utils/dateUtils.ts';

interface CreateEdfProps {
  categories: Category[];
  onCancel: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting: boolean;
}

export const CreateEdf: React.FC<CreateEdfProps> = ({
  categories,
  onCancel,
  onSubmit,
  isSubmitting,
}) => {
  // Current date defaults
  const today = new Date().toISOString().split('T')[0];
  const defaultRequired = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [edfNumber, setEdfNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.categoryName || 'HVAC / AC'
  );
  const [requestDescription, setRequestDescription] = useState('');
  const [requestingTeam, setRequestingTeam] = useState('HVAC Maintenance Team');
  const [requestDate, setRequestDate] = useState(today);
  const [requiredDate, setRequiredDate] = useState(defaultRequired);
  const [expectedDate, setExpectedDate] = useState('');
  const [priority, setPriority] = useState<EDFPriority>('Normal');
  const [remarks, setRemarks] = useState('');

  // Materials dynamic rows
  const [materialRows, setMaterialRows] = useState<MaterialItem[]>([
    { materialName: '', quantity: '1', unit: 'Pieces', description: '' },
  ]);

  // When category changes, suggest default team name
  const handleCategoryChange = (catName: string) => {
    setSelectedCategory(catName);
    if (catName.includes('HVAC')) setRequestingTeam('HVAC Maintenance Team');
    else if (catName.includes('Plumb')) setRequestingTeam('Facility Plumbing Crew');
    else if (catName.includes('Generator')) setRequestingTeam('Power Plant & Generator Team');
    else if (catName.includes('Telephone')) setRequestingTeam('IT & Telecom Team');
    else if (catName.includes('Electr')) setRequestingTeam('Electrical Engineering Unit');
    else setRequestingTeam('General Maintenance Crew');
  };

  const handleAddMaterialRow = () => {
    setMaterialRows([
      ...materialRows,
      { materialName: '', quantity: '1', unit: 'Pieces', description: '' },
    ]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    if (materialRows.length <= 1) return;
    setMaterialRows(materialRows.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (
    index: number,
    field: keyof MaterialItem,
    value: string
  ) => {
    const updated = [...materialRows];
    updated[index] = { ...updated[index], [field]: value };
    setMaterialRows(updated);
  };

  // Preview countdown calculation based on requiredDate input
  const countdownPreview = calculateRemainingTime(requiredDate, 'Pending');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate materials
    const validMaterials = materialRows.filter(
      (m) => m.materialName && m.materialName.trim().length > 0
    );
    if (validMaterials.length === 0) {
      alert('Please add at least one material item name.');
      return;
    }

    const categoryObj = categories.find((c) => c.categoryName === selectedCategory);

    const payload = {
      edfNumber: edfNumber.trim() || undefined,
      categoryId: categoryObj?.id,
      categoryName: selectedCategory,
      requestDescription: requestDescription.trim(),
      requestDate,
      requiredDate,
      expectedDate: expectedDate || null,
      requestingTeam: requestingTeam.trim(),
      priority,
      remarks: remarks.trim(),
      materials: validMaterials,
      status: countdownPreview.isOverdue ? 'Overdue' : 'Pending',
    };

    await onSubmit(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create New Employee Demand Form (EDF)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Register technical material requests with automated required-date tracking
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">
              1
            </span>
            Requisition Header & Categorization
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* EDF Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                EDF / Requisition Number
              </label>
              <input
                type="text"
                value={edfNumber}
                onChange={(e) => setEdfNumber(e.target.value)}
                placeholder="Leave blank for auto-number"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Auto assigns next sequence if blank
              </span>
            </div>

            {/* Category / Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Technical Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.categoryName}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
            </div>

            {/* Requesting Team */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Requesting Team / Crew <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={requestingTeam}
                onChange={(e) => setRequestingTeam(e.target.value)}
                placeholder="e.g. HVAC Maintenance Team"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Work Scope / Material Demand Summary
            </label>
            <input
              type="text"
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              placeholder="e.g. Chiller overhaul pre-filters and refrigerant top-up for 3rd floor"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Section 2: Required Date & Live Countdown Tracking */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold">
                2
              </span>
              Target Schedule & Required Date Tracking
            </h2>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Automated Overdue Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Request Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Request Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            {/* Required Date (Critical) */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                Required Date & Time <span className="text-rose-600">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            {/* Expected / Delivery Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected Delivery Date (Optional)
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Live Countdown Preview Card (Green -> Orange -> Red) */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
              countdownPreview.timerPhase === 'red' || countdownPreview.isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                : countdownPreview.timerPhase === 'orange'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
                  countdownPreview.timerPhase === 'red' || countdownPreview.isOverdue
                    ? 'bg-rose-600 animate-pulse'
                    : countdownPreview.timerPhase === 'orange'
                    ? 'bg-amber-500 animate-spin-slow'
                    : 'bg-emerald-600'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Live Countdown Engine Preview
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                      countdownPreview.timerPhase === 'red'
                        ? 'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100'
                        : countdownPreview.timerPhase === 'orange'
                        ? 'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100'
                        : 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100'
                    }`}
                  >
                    {countdownPreview.timerPhase === 'red'
                      ? 'Red Phase (Overdue)'
                      : countdownPreview.timerPhase === 'orange'
                      ? 'Orange Phase (Due in <=24h)'
                      : 'Green Phase (Starting / On Schedule)'}
                  </span>
                </div>
                <span className="text-sm sm:text-base font-bold font-mono">
                  {countdownPreview.formattedText}
                </span>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold block">
                {countdownPreview.isOverdue ? 'Status: OVERDUE (Red)' : 'Status: PENDING'}
              </span>
              <span className="text-[11px] opacity-75">
                Turns orange 24h before & red once crossed
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Material Items (Multiple rows dynamically) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                Requisitioned Material Items ({materialRows.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add or remove multiple item rows for this demand form
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Material Row</span>
            </button>
          </div>

          <div className="space-y-3">
            {materialRows.map((row, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col md:flex-row gap-3 items-start md:items-center"
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </div>

                {/* Material Item Name */}
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    required
                    value={row.materialName}
                    onChange={(e) => handleMaterialChange(idx, 'materialName', e.target.value)}
                    placeholder="Material Item Name (e.g. AC Filter 24x24x2, Copper Pipe 5/8)"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                {/* Quantity */}
                <div className="w-28">
                  <input
                    type="text"
                    required
                    value={row.quantity}
                    onChange={(e) => handleMaterialChange(idx, 'quantity', e.target.value)}
                    placeholder="Quantity"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-center focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                {/* Unit */}
                <div className="w-32">
                  <select
                    value={row.unit}
                    onChange={(e) => handleMaterialChange(idx, 'unit', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    <option value="Pieces">Pieces</option>
                    <option value="Meters">Meters</option>
                    <option value="Units">Units</option>
                    <option value="Sets">Sets</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Cylinders">Cylinders</option>
                    <option value="Liters">Liters</option>
                    <option value="Pairs">Pairs</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Kg">Kg</option>
                    <option value="Feet">Feet</option>
                  </select>
                </div>

                {/* Specification / Description */}
                <div className="w-full md:w-56">
                  <input
                    type="text"
                    value={row.description || ''}
                    onChange={(e) => handleMaterialChange(idx, 'description', e.target.value)}
                    placeholder="Specification / Specs (optional)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  disabled={materialRows.length <= 1}
                  onClick={() => handleRemoveMaterialRow(idx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Remove row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Priority & Remarks */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
              4
            </span>
            Priority & Logistics Remarks
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Requisition Priority
              </label>
              <div className="flex gap-2">
                {(['Low', 'Normal', 'High', 'Urgent'] as EDFPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      priority === p
                        ? p === 'Urgent'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Coordinator Notes & Remarks
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Logistics notes, vendor details, special handling requirements..."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59] hover:from-[#E0484D] hover:to-[#FF5A5F] text-white shadow-md shadow-[#FF5A5F]/30 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FileCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating EDF Record...' : 'Submit & Save EDF'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
