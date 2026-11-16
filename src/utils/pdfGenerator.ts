import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EDF } from '../types.ts';
import {
  countUniqueEdfStats,
  deduplicateEdfsByNumber,
  getEdfMaterialRows,
  getEffectiveEdfState,
} from './exportHelpers.ts';

export interface PdfRowSpanTableResult {
  rows: Record<string, any>[];
  uniqueEdfCount: number;
  totalMaterialRows: number;
}

export interface PdfGeneratorOptions {
  userName?: string;
  filterLabel?: string;
  autoSave?: boolean;
}

export interface FlatEDFMaterialRowInput {
  edfId: number | string;
  edfNumber: string;
  requesterName?: string;
  category?: string;
  issueDate?: string;
  requiredDate?: string;
  edfStatus?: string;
  itemDescription: string;
  quantity: number | string;
  unit: string;
  itemStatus?: string;
}

// Safe maximum rows per page-aligned rowSpan block so jspdf-autotable never overflows page height
const MAX_ROWS_PER_PAGE_SPAN = 22;

/**
 * Resolves jsPDF constructor safely across Vite browser ESM and Node ESM runtimes.
 */
export function resolveJsPDFConstructor(): typeof jsPDF {
  return typeof jsPDF === 'function'
    ? jsPDF
    : ((jsPDF as any).jsPDF || (jsPDF as any).default);
}

/**
 * Computes vertical `rowSpan` grouping for flat material rows belonging to the same EDF ID,
 * merging the `'EDF Number'` cell vertically across consecutive/grouped rows instead of repeating it.
 */
export function buildFlatRowsWithEdfNumberRowSpan(
  flatRows: FlatEDFMaterialRowInput[]
): Record<string, any>[] {
  if (!flatRows || flatRows.length === 0) return [];

  // Group rows by EDF ID while preserving first-seen order
  const groups = new Map<string, FlatEDFMaterialRowInput[]>();
  for (const row of flatRows) {
    const key =
      row.edfId !== undefined && row.edfId !== null && String(row.edfId).trim() !== ''
        ? `id:${String(row.edfId).trim()}`
        : `num:${String(row.edfNumber || '').trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const bodyRows: Record<string, any>[] = [];
  let groupIdx = 0;

  for (const items of groups.values()) {
    const groupBg: [number, number, number] =
      groupIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    groupIdx++;

    for (let start = 0; start < items.length; start += MAX_ROWS_PER_PAGE_SPAN) {
      const slice = items.slice(start, start + MAX_ROWS_PER_PAGE_SPAN);
      const spanLen = slice.length;
      const isFirstGroupChunk = start === 0;
      const head = slice[0];

      slice.forEach((mat, localIdx) => {
        const isSpanAnchor = localIdx === 0;
        const itemStatusStr = mat.itemStatus || 'Pending';
        const itemStatusColor: [number, number, number] =
          itemStatusStr === 'Received' ? [5, 150, 105] : [217, 119, 6];

        const rowObj: Record<string, any> = {
          material: {
            content: mat.itemDescription,
            styles: { fillColor: groupBg, valign: 'middle' },
          },
          qtyUnit: {
            content: `${mat.quantity} ${mat.unit}`,
            styles: { fillColor: groupBg, halign: 'center', valign: 'middle' },
          },
          itemStatus: {
            content: itemStatusStr,
            styles: {
              fillColor: groupBg,
              halign: 'center',
              valign: 'middle',
              fontStyle: 'bold',
              textColor: itemStatusColor,
            },
          },
        };

        if (isSpanAnchor) {
          const edfStatusStr = head.edfStatus || 'Pending';
          const edfStatusColor: [number, number, number] =
            edfStatusStr === 'Overdue'
              ? [225, 29, 72]
              : edfStatusStr === 'Partially Received'
              ? [2, 132, 199]
              : edfStatusStr === 'Received'
              ? [5, 150, 105]
              : [217, 119, 6];

          rowObj.edfNumber = {
            content: isFirstGroupChunk ? head.edfNumber : '',
            rowSpan: spanLen,
            styles: {
              fillColor: groupBg,
              fontStyle: 'bold',
              valign: 'middle',
              halign: 'center',
              textColor: [15, 23, 42],
            },
          };
          rowObj.requesterDept = {
            content: isFirstGroupChunk
              ? `${head.requesterName || 'Admin'}\n[${head.category || 'General'}]`
              : '',
            rowSpan: spanLen,
            styles: {
              fillColor: groupBg,
              valign: 'middle',
            },
          };
          rowObj.dates = {
            content: isFirstGroupChunk
              ? `Iss: ${head.issueDate || '-'}\nReq: ${head.requiredDate || '-'}`
              : '',
            rowSpan: spanLen,
            styles: {
              fillColor: groupBg,
              valign: 'middle',
              halign: 'center',
            },
          };
          rowObj.edfStatus = {
            content: isFirstGroupChunk ? edfStatusStr : '',
            rowSpan: spanLen,
            styles: {
              fillColor: groupBg,
              valign: 'middle',
              halign: 'center',
              fontStyle: 'bold',
              textColor: edfStatusColor,
            },
          };
        }

        bodyRows.push(rowObj);
      });
    }
  }

  return bodyRows;
}

/**
 * Generates AutoTable body rows for an `EDF[]` list with vertical `rowSpan` merging
 * applied to the `'EDF Number'` column (and EDF-level columns) across all material rows
 * belonging to the same EDF ID.
 */
export function buildPdfRowsWithEdfRowSpan(edfs: EDF[]): PdfRowSpanTableResult {
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);
  const seenEdfIds = new Set<string>();
  const groupedEdfs: EDF[] = [];

  for (const edf of uniqueEdfs) {
    const idKey =
      edf.id !== undefined && edf.id !== null
        ? `id:${edf.id}`
        : `num:${String(edf.edfNumber).trim().toLowerCase()}`;
    if (seenEdfIds.has(idKey)) continue;
    seenEdfIds.add(idKey);
    groupedEdfs.push(edf);
  }

  const flatRows: FlatEDFMaterialRowInput[] = [];

  for (const edf of groupedEdfs) {
    const materials = getEdfMaterialRows(edf);
    const state = getEffectiveEdfState(edf);
    const issueDateStr = edf.issueDate ? new Date(edf.issueDate).toLocaleDateString() : '-';
    const reqDateStr = edf.requiredDate ? new Date(edf.requiredDate).toLocaleDateString() : '-';

    for (const mat of materials) {
      flatRows.push({
        edfId: edf.id ?? edf.edfNumber,
        edfNumber: edf.edfNumber,
        requesterName: edf.requesterName || 'Admin',
        category: edf.category || 'General',
        issueDate: issueDateStr,
        requiredDate: reqDateStr,
        edfStatus: state.effectiveStatus,
        itemDescription: mat.itemDescription,
        quantity: mat.quantity,
        unit: mat.unit,
        itemStatus: mat.status,
      });
    }
  }

  const rows = buildFlatRowsWithEdfNumberRowSpan(flatRows);

  return {
    rows,
    uniqueEdfCount: groupedEdfs.length,
    totalMaterialRows: flatRows.length,
  };
}

/**
 * Exports EDF records to a formatted PDF document where the `'EDF Number'` cell
 * is merged vertically across all individual material rows sharing the same EDF ID.
 */
export function generateMergedEdfPdf(
  edfs: EDF[],
  filterLabel: string = 'All',
  options: PdfGeneratorOptions = {}
): { success: boolean; count: number; totalRows: number; doc?: jsPDF } {
  const { userName = 'Coordinator', autoSave = true } = options;

  if (!edfs || edfs.length === 0) {
    return { success: false, count: 0, totalRows: 0 };
  }

  const uniqueEdfs = deduplicateEdfsByNumber(edfs);
  const stats = countUniqueEdfStats(uniqueEdfs);
  const { rows: bodyRows, uniqueEdfCount, totalMaterialRows } =
    buildPdfRowsWithEdfRowSpan(uniqueEdfs);

  if (uniqueEdfCount === 0 || totalMaterialRows === 0) {
    return { success: false, count: 0, totalRows: 0 };
  }

  const JsPDFCtor = resolveJsPDFConstructor();
  const doc = new JsPDFCtor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 14;

  // Accent bar
  doc.setFillColor(244, 63, 94);
  doc.rect(margin, currentY, pageWidth - margin * 2, 4, 'F');
  currentY += 10;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(225, 29, 72);
  doc.text('EDF MANAGEMENT SYSTEM', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated: ${new Date().toLocaleString()} by ${userName}`,
    pageWidth - margin,
    currentY,
    { align: 'right' }
  );
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Employee Demand Forms — Grouped Material Export', margin, currentY);
  currentY += 6;

  // Filter summary badge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY - 4, pageWidth - margin * 2, 7, 1.5, 1.5, 'F');
  doc.text(
    `Scope: ${filterLabel.replace(/_/g, ' ')}   |   Unique EDFs: ${uniqueEdfCount}   |   Material Rows: ${totalMaterialRows}   |   Received: ${stats.received}   |   Pending: ${stats.pending}   |   Overdue: ${stats.overdue}`,
    margin + 3.5,
    currentY + 1
  );
  currentY += 9;

  autoTable(doc, {
    startY: currentY,
    columns: [
      { header: 'EDF Number', dataKey: 'edfNumber' },
      { header: 'Requester & Dept', dataKey: 'requesterDept' },
      { header: 'Issue / Req Date', dataKey: 'dates' },
      { header: 'Material Item', dataKey: 'material' },
      { header: 'Qty / Unit', dataKey: 'qtyUnit' },
      { header: 'Item Status', dataKey: 'itemStatus' },
      { header: 'EDF Status', dataKey: 'edfStatus' },
    ],
    body: bodyRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [51, 65, 85],
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      edfNumber: { cellWidth: 23, fontStyle: 'bold', halign: 'center', valign: 'middle' },
      requesterDept: { cellWidth: 27, valign: 'middle' },
      dates: { cellWidth: 23, halign: 'center', valign: 'middle' },
      material: { cellWidth: 'auto', valign: 'middle' },
      qtyUnit: { cellWidth: 18, halign: 'center', valign: 'middle' },
      itemStatus: { cellWidth: 19, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      edfStatus: { cellWidth: 19, halign: 'center', valign: 'middle', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const totalPages = (doc.internal as any).getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'EDF Management System • Grouped PDF Export (Unique EDF Numbers)',
        margin,
        pageHeight - 8
      );
      doc.text(
        `Page ${currentPage} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    },
    margin: { left: margin, right: margin, bottom: 14 },
  });

  if (autoSave) {
    const cleanLabel = filterLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    doc.save(`EDF_Export_${cleanLabel}_${dateStamp}.pdf`);
  }

  return {
    success: true,
    count: uniqueEdfCount,
    totalRows: totalMaterialRows,
    doc,
  };
}
