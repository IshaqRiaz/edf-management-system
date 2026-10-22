import { EDF } from '../types.ts';

/**
 * Exports EDF records to CSV format with each material row preserved as a separate row,
 * fully compatible with ExcelImport.tsx recovery/import format.
 * Works 100% offline using client-side Blob generation.
 */
export function exportEDFsToMultiRowCSV(
  edfs: EDF[],
  categoryName: string = 'All'
): { success: boolean; count: number; totalRows: number } {
  if (!edfs || edfs.length === 0) {
    return { success: false, count: 0, totalRows: 0 };
  }

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

  const escapeCSV = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];

  for (const edf of edfs) {
    const rawItems = edf.items || [];
    const issueDateStr = edf.issueDate
      ? new Date(edf.issueDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const requiredDateStr = edf.requiredDate
      ? new Date(edf.requiredDate).toISOString().slice(0, 10)
      : new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const edfStatus = edf.isOverdue && edf.status !== 'Received' ? 'Overdue' : edf.status;

    if (rawItems.length > 0) {
      for (const item of rawItems) {
        const itemStatus = item.status === 'Received' ? 'Received' : 'Pending';
        const row = [
          escapeCSV(edf.edfNumber),
          escapeCSV(edf.requesterName || 'Admin'),
          escapeCSV(edf.category || 'General'),
          escapeCSV(issueDateStr),
          escapeCSV(requiredDateStr),
          escapeCSV(edfStatus),
          escapeCSV(itemStatus),
          escapeCSV(item.itemDescription || edf.materialList || 'Material Item'),
          item.quantity !== undefined && item.quantity !== null ? item.quantity : 1,
          escapeCSV(item.unit || edf.unit || 'pcs'),
          escapeCSV(edf.remarks || ''),
        ];
        rows.push(row.join(','));
      }
    } else {
      // Single material summary row
      const receivingProgress = edf.status === 'Received' ? 'Received' : 'Pending';
      const row = [
        escapeCSV(edf.edfNumber),
        escapeCSV(edf.requesterName || 'Admin'),
        escapeCSV(edf.category || 'General'),
        escapeCSV(issueDateStr),
        escapeCSV(requiredDateStr),
        escapeCSV(edfStatus),
        escapeCSV(receivingProgress),
        escapeCSV(edf.materialList || 'Material Item'),
        edf.quantity !== undefined && edf.quantity !== null ? edf.quantity : 1,
        escapeCSV(edf.unit || 'pcs'),
        escapeCSV(edf.remarks || ''),
      ];
      rows.push(row.join(','));
    }
  }

  // Prepend UTF-8 Byte Order Mark (\uFEFF) for broad Excel/desktop spreadsheet compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanCategory = categoryName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `EDF_Export_${cleanCategory}_${dateStamp}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: edfs.length, totalRows: rows.length };
}
