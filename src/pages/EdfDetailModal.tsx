import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  HardHat,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
  FileSpreadsheet,
  Edit,
  Trash2,
  Send,
  Plus,
} from 'lucide-react';
import { EDF, EDFStatus, EDFPriority } from '../types/index.ts';
import { CountdownBadge } from '../components/CountdownBadge.tsx';
import { CategoryBadge } from '../components/CategoryBadge.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { downloadEdfPdf } from '../utils/pdfGenerator.ts';
import { exportEdfsToExcel } from '../utils/excelUtils.ts';

interface EdfDetailModalProps {
  edf: EDF;
  onClose: () => void;
  onUpdateStatus: (id: number, status: EDFStatus) => Promise<void>;
  onUpdateEdf: (id: number, data: Partial<EDF>) => Promise<void>;
  onDeleteEdf: (id: number) => Promise<void>;
}

export const EdfDetailModal: React.FC<EdfDetailModalProps> = ({
  edf,
  onClose,
  onUpdateStatus,
  onUpdateEdf,
  onDeleteEdf,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [remarks, setRemarks] = useState(edf.remarks || '');
  const [status, setStatus] = useState<EDFStatus>(edf.status);
  const [requiredDate, setRequiredDate] = useState(
    edf.requiredDate ? new Date(edf.requiredDate).toISOString().slice(0, 16) : ''
  );
  const [priority, setPriority] = useState<EDFPriority>(edf.priority);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      await onUpdateEdf(edf.id, {
        remarks,
        status,
        requiredDate: new Date(requiredDate).toISOString(),
        priority,
      });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="w-full max-w-3xl my-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Accent & Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {edf.edfNumber}
            </span>
            <CategoryBadge category={edf.categoryName} size="sm" />
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            <button
              onClick={() => downloadEdfPdf(edf)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download official PDF voucher"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Download PDF</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Header Info Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Work Scope / Requisition Summary
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {edf.requestDescription || 'Technical Material Requisition'}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                <span>Requested by: <strong className="text-slate-800 dark:text-slate-200">{edf.requestingTeam}</strong></span>
                <span>•</span>
                <span>Created by: {edf.createdBy || 'Office Coordinator'}</span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-start sm:items-end gap-1.5">
              <StatusBadge status={edf.status} size="md" />
              <div className="mt-1">
                <CountdownBadge
                  requiredDate={edf.requiredDate}
                  status={edf.status}
                  receivedDate={edf.receivedDate}
                  completedDate={edf.completedDate}
                />
              </div>
            </div>
          </div>

          {/* Key Dates Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[11px] font-medium">Request Date</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                {new Date(edf.requestDate).toLocaleDateString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-rose-500 block text-[11px] font-bold">Required Date</span>
              <span className="font-bold text-slate-900 dark:text-white mt-1 block">
                {new Date(edf.requiredDate).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[11px] font-medium">Expected Delivery</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                {edf.expectedDate ? new Date(edf.expectedDate).toLocaleDateString() : 'As scheduled'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 block text-[11px] font-medium">Priority</span>
              <span
                className={`font-bold mt-1 block ${
                  edf.priority === 'Urgent'
                    ? 'text-rose-600'
                    : edf.priority === 'High'
                    ? 'text-amber-600'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {edf.priority}
              </span>
            </div>
          </div>

          {/* Material Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Material Items ({edf.materials?.length || 0})
              </h3>
              <button
                onClick={() => exportEdfsToExcel([edf], `${edf.edfNumber}_Materials.xlsx`)}
                className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Items to Excel</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Material Item Name</th>
                    <th className="py-2.5 px-3">Specification / Description</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {edf.materials && edf.materials.length > 0 ? (
                    edf.materials.map((mat, idx) => (
                      <tr key={mat.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {mat.materialName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {mat.description || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white text-right">
                          {mat.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          {mat.unit}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No materials listed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks & Notes */}
          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-1">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
              Coordinator Logistics Remarks:
            </span>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {edf.remarks || 'No special remarks recorded.'}
            </p>
          </div>

          {/* Edit Panel (if toggled) */}
          {isEditing && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Update Requisition Parameters
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EDFStatus)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as EDFPriority)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-rose-600 mb-1">Required Date</label>
                  <input
                    type="datetime-local"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-xs mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveEdits}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Quick Status Buttons */}
            {edf.status !== 'Received' && edf.status !== 'Completed' && (
              <button
                onClick={() => onUpdateStatus(edf.id, 'Received')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-colors"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Mark Received</span>
              </button>
            )}

            {edf.status === 'Received' && (
              <button
                onClick={() => onUpdateStatus(edf.id, 'Completed')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            )}

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Requisition</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDeleteEdf(edf.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
