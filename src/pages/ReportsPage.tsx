import React from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { EDF, DashboardStats } from '../types/index.ts';
import { exportEdfsToExcel } from '../utils/excelUtils.ts';

interface ReportsPageProps {
  stats: DashboardStats | null;
  edfs: EDF[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ stats, edfs }) => {
  const total = stats?.total || 0;
  const receivedOrCompleted = stats?.receivedOrCompleted || 0;
  const overdue = stats?.overdue || 0;
  const pending = stats?.pending || 0;

  const fulfillmentRate = total > 0 ? Math.round((receivedOrCompleted / total) * 100) : 0;
  const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

  // Aggregate most requested materials
  const materialFrequencyMap: Record<string, { count: number; totalQty: number; unit: string }> = {};

  edfs.forEach((e) => {
    (e.materials || []).forEach((m) => {
      const name = m.materialName?.trim() || 'Unknown';
      const qty = parseFloat(m.quantity) || 1;
      if (!materialFrequencyMap[name]) {
        materialFrequencyMap[name] = { count: 0, totalQty: 0, unit: m.unit || 'Units' };
      }
      materialFrequencyMap[name].count += 1;
      materialFrequencyMap[name].totalQty += qty;
    });
  });

  const topMaterials = Object.entries(materialFrequencyMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const handleExportFullReport = () => {
    exportEdfsToExcel(edfs, `Complete_EDF_Requisition_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Operational Requisitions & Delivery Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Requisition throughput, material demand velocity, and schedule compliance metrics
          </p>
        </div>

        <button
          onClick={handleExportFullReport}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Master Excel</span>
        </button>
      </div>

      {/* KPI Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Fulfillment Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {fulfillmentRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {receivedOrCompleted} of {total} material requests delivered
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Overdue Exposure Rate</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            {overdueRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {overdue} overdue requisitions past required date
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Material Lines</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
            {stats?.totalMaterials || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Requisitioned line items across all departments
          </div>
        </div>
      </div>

      {/* Top Requisitioned Materials Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Frequently Requisitioned Technical Materials
        </h3>
        <p className="text-xs text-slate-500">
          Identifies high-turnover items for buffer stock planning
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Material Name</th>
                <th className="py-2.5 px-3">Requisition Frequency</th>
                <th className="py-2.5 px-3 text-right">Total Quantity Demanded</th>
                <th className="py-2.5 px-3">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topMaterials.map(([name, data], idx) => (
                <tr key={name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                    {name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium">
                      {data.count} {data.count === 1 ? 'requisition' : 'requisitions'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white text-right">
                    {data.totalQty}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{data.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
