import { EDF } from '../types.ts';
import {
  deduplicateEdfsByNumber,
  getEdfMaterialRows,
  getEffectiveEdfState,
} from './exportHelpers.ts';

export interface CSVExportBuildResult {
  csvContent: string;
  uniqueEdfCount: number;
  totalRows: number;
}

const escapeCSV = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

const safeIsoDate = (dateVal: string | undefined | null, fallbackDate: Date): string => {
  if (!dateVal) return fallbackDate.toISOString().slice(0, 10);
  const parsed = new Date(dateVal);
  if (Number.isNaN(parsed.getTime())) return fallbackDate.toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

/**
 * Builds grouped CSV content where each unique EDF Number is displayed ONLY ONCE
 * on the first material row, with all associated material items grouped beneath it
 * as individual rows (preserving every material description, qty, unit, and receiving status).
 */
export function buildGroupedCSVContent(edfs: EDF[]): CSVExportBuildResult {
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);

  const headers = [
    'EDF Number',
    'Requester Name',
    'Category',
    'Issue Date',
    'Required Date',
    'Status',
    'Item Receiving Status',
    'Item Description',
    'Quantity',
    'Unit',
    'Remarks',
  ];

  const rows: string[] = [];

  for (const edf of uniqueEdfs) {
    const materials = getEdfMaterialRows(edf);
    const state = getEffectiveEdfState(edf);
    const issueDateStr = safeIsoDate(edf.issueDate, new Date());
    const requiredDateStr = safeIsoDate(
      edf.requiredDate,
      new Date(Date.now() + 3 * 86400000)
    );
    const edfStatus = state.effectiveStatus;

    materials.forEach((item, idx) => {
      const isFirstRow = idx === 0;
      const itemRemarks = isFirstRow
        ? item.remarks || item.justification || edf.remarks || ''
        : item.remarks || item.justification || '';

      const row = [
        escapeCSV(isFirstRow ? edf.edfNumber : ''),
        escapeCSV(isFirstRow ? edf.requesterName || 'Admin' : ''),
        escapeCSV(isFirstRow ? edf.category || 'General' : ''),
        escapeCSV(isFirstRow ? issueDateStr : ''),
        escapeCSV(isFirstRow ? requiredDateStr : ''),
        escapeCSV(isFirstRow ? edfStatus : ''),
        escapeCSV(item.status),
        escapeCSV(item.itemDescription),
        item.quantity,
        escapeCSV(item.unit),
        escapeCSV(itemRemarks),
      ];
      rows.push(row.join(','));
    });
  }

  // Prepend UTF-8 Byte Order Mark (\uFEFF) for broad Excel/desktop spreadsheet compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  return {
    csvContent,
    uniqueEdfCount: uniqueEdfs.length,
    totalRows: rows.length,
  };
}

/**
 * Exports EDF records to CSV format with unique EDF Numbers (displayed once per EDF)
 * and every material item preserved on its own row, fully compatible with ExcelImport.tsx
 * CSV recovery/import format. Works 100% offline using client-side Blob generation.
 */
export function exportEDFsToMultiRowCSV(
  edfs: EDF[],
  filterLabel: string = 'All'
): { success: boolean; count: number; totalRows: number } {
  if (!edfs || edfs.length === 0) {
    return { success: false, count: 0, totalRows: 0 };
  }

  const { csvContent, uniqueEdfCount, totalRows } = buildGroupedCSVContent(edfs);
  if (uniqueEdfCount === 0 || totalRows === 0) {
    return { success: false, count: 0, totalRows: 0 };
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanLabel = filterLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `EDF_Export_${cleanLabel}_${dateStamp}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: uniqueEdfCount, totalRows };
}
