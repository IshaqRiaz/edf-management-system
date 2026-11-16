import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EDF, Category } from '../types.ts';
import {
  countUniqueEdfStats,
  deduplicateEdfsByNumber,
} from './exportHelpers.ts';
import {
  EDF_PDF_TABLE_COLUMNS,
  buildPdfRowsWithEdfRowSpan,
  resolveJsPDFConstructor,
} from './pdfGenerator.ts';

export interface GenerateReportPdfOptions {
  edfs: EDF[];
  categories: Category[];
  selectedCategory: string;
  selectedStatus: string;
  specificEdfNumber?: string;
  filterLabel?: string;
  userName?: string;
  autoSave?: boolean;
}

export function buildPdfDetailRows(uniqueEdfs: EDF[]): {
  rows: Record<string, any>[];
  totalMaterialRows: number;
} {
  const { rows, totalMaterialRows } = buildPdfRowsWithEdfRowSpan(uniqueEdfs);
  return { rows, totalMaterialRows };
}

export function generateReportPdf({
  edfs,
  categories,
  selectedCategory,
  selectedStatus,
  specificEdfNumber = '',
  filterLabel,
  userName = 'Coordinator',
  autoSave = true,
}: GenerateReportPdfOptions) {
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);
  const uniqueCounts = countUniqueEdfStats(uniqueEdfs);
  const { rows: detailRows, totalMaterialRows } = buildPdfDetailRows(uniqueEdfs);

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

  // 1. TOP HEADER ACCENT BAR (Grapefruit theme #f43f5e)
  doc.setFillColor(244, 63, 94);
  doc.rect(margin, currentY, pageWidth - margin * 2, 4, 'F');
  currentY += 10;

  // 2. REPORT HEADER & BRANDING
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(225, 29, 72); // Rose-600
  doc.text('EDF MANAGEMENT SYSTEM', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()} by ${userName}`, pageWidth - margin, currentY, {
    align: 'right',
  });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('Demand Form Status & Performance Summary Report', margin, currentY);
  currentY += 6;

  // 3. FILTER INFORMATION BADGES
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const activeStatusDisplay = filterLabel || selectedStatus || 'Total EDF';
  const specificPart = specificEdfNumber.trim() ? `   |   EDF #: ${specificEdfNumber.trim()}` : '';
  const filterDesc = `Filter: ${activeStatusDisplay}   |   Category: ${selectedCategory}${specificPart}   |   Unique EDFs: ${uniqueCounts.total}   |   Material Rows: ${totalMaterialRows}`;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY - 4, pageWidth - margin * 2, 7, 1.5, 1.5, 'F');
  doc.text(filterDesc, margin + 4, currentY + 1);
  currentY += 10;

  // 4. EXECUTIVE SUMMARY KPIS (Strictly unique EDF-Number based)
  const totalDivisor = uniqueCounts.total || 1;
  const fulfillmentRate = Math.round((uniqueCounts.received / totalDivisor) * 100);

  const kpiBoxWidth = (pageWidth - margin * 2 - 12) / 4;
  const kpiBoxHeight = 16;

  const kpis = [
    { title: 'Fulfillment Rate', value: `${fulfillmentRate}%`, color: [16, 185, 129] },
    { title: 'Received EDF', value: `${uniqueCounts.received}`, color: [5, 150, 105] },
    { title: 'Partially Received EDF', value: `${uniqueCounts.partiallyReceived}`, color: [2, 132, 199] },
    { title: 'Overdue EDF', value: `${uniqueCounts.overdue}`, color: [225, 29, 72] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiBoxWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, kpiBoxWidth, kpiBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3, currentY + 12);
  });

  currentY += kpiBoxHeight + 8;

  // 5. DEPARTMENTAL SUMMARY TABLE (AutoTable, counted by unique EDF Number)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Departmental Demand Breakdown (Unique EDF Count)', margin, currentY);
  currentY += 3;

  const scopedCategories =
    selectedCategory && selectedCategory !== 'All'
      ? categories.filter(
          (cat) => cat.name.toLowerCase() === selectedCategory.toLowerCase()
        )
      : categories;

  const catRows = scopedCategories.map((cat) => {
    const catEdfs = uniqueEdfs.filter(
      (e) => String(e.category || '').toLowerCase() === cat.name.toLowerCase()
    );
    const catStats = countUniqueEdfStats(catEdfs);
    const share = Math.round((catStats.total / totalDivisor) * 100);

    return [
      cat.name,
      String(catStats.total),
      String(catStats.received),
      String(catStats.partiallyReceived),
      String(catStats.pending),
      String(catStats.overdue),
      `${share}%`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Unique EDFs', 'Received', 'Partially Received', 'Pending', 'Overdue', 'Share']],
    body: catRows,
    theme: 'grid',
    headStyles: {
      fillColor: [225, 29, 72], // Rose
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center', textColor: [5, 150, 105] },
      3: { halign: 'center', textColor: [2, 132, 199] },
      4: { halign: 'center', textColor: [217, 119, 6] },
      5: { halign: 'center', textColor: [225, 29, 72], fontStyle: 'bold' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  // 6. DETAILED RECORDS TABLE (Grouped with vertically merged EDF Number cell across material rows)
  const lastTableY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  let detailStartY = lastTableY + 8;

  if (detailStartY > pageHeight - 50) {
    doc.addPage();
    detailStartY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Demand Form Records (${uniqueCounts.total} Unique EDF${uniqueCounts.total === 1 ? '' : 's'} • ${totalMaterialRows} Material Item${totalMaterialRows === 1 ? '' : 's'})`,
    margin,
    detailStartY
  );
  detailStartY += 3;

  autoTable(doc, {
    startY: detailStartY,
    columns: EDF_PDF_TABLE_COLUMNS,
    body: detailRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
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
        'EDF Management Coordinator Control Center • Official Status Report',
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
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanFilter = (filterLabel || selectedStatus || 'Total')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCat = selectedCategory.replace(/[^a-zA-Z0-9_-]/g, '_');
    const specificSuffix = specificEdfNumber.trim()
      ? `_${specificEdfNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : '';
    const filename = `EDF_Report_${cleanFilter}_${cleanCat}${specificSuffix}_${dateStr}.pdf`;
    doc.save(filename);
  }

  return doc;
}

interface GenerateReceiptAuditPdfOptions {
  logs: any[];
  userName?: string;
  filterLabel?: string;
}

export function generateReceiptAuditPdf({
  logs,
  userName = 'Coordinator',
  filterLabel = 'All Logs',
}: GenerateReceiptAuditPdfOptions) {
  const JsPDFCtor: typeof jsPDF =
    typeof jsPDF === 'function' ? jsPDF : ((jsPDF as any).jsPDF || (jsPDF as any).default);
  const doc = new JsPDFCtor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 14;

  // Header accent bar (Grapefruit #f43f5e)
  doc.setFillColor(244, 63, 94);
  doc.rect(margin, currentY, pageWidth - margin * 2, 4, 'F');
  currentY += 10;

  // Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(225, 29, 72);
  doc.text('EDF MANAGEMENT SYSTEM', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()} by ${userName}`, pageWidth - margin, currentY, {
    align: 'right',
  });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('EDF Delivery & Receipt Audit Trail Report', margin, currentY);
  currentY += 6;

  // Metadata badge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY - 4, pageWidth - margin * 2, 7, 1.5, 1.5, 'F');
  doc.text(
    `Scope: ${filterLabel}   |   Total Recorded Audit Events: ${logs.length}   |   Compliance: Verified`,
    margin + 4,
    currentY + 1
  );
  currentY += 10;

  // Summary counts
  const receivedLogs = logs.filter((l) => String(l.toStatus).toLowerCase() === 'received' || String(l.toStatus).toLowerCase() === 'completed');
  const partiallyReceivedLogs = logs.filter((l) => String(l.toStatus).toLowerCase() === 'partially received');

  const boxWidth = (pageWidth - margin * 2 - 8) / 3;
  const boxHeight = 15;

  const summary = [
    { title: 'Total Audit Entries', count: logs.length, color: [15, 23, 42] },
    { title: 'Marked as Received', count: receivedLogs.length, color: [5, 150, 105] },
    { title: 'Partially Received', count: partiallyReceivedLogs.length, color: [2, 132, 199] },
  ];

  summary.forEach((item, idx) => {
    const x = margin + idx * (boxWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.title, x + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(String(item.count), x + 3, currentY + 11.5);
  });

  currentY += boxHeight + 8;

  // Table rows
  const auditRows = logs.map((log) => {
    const dateFormatted = new Date(log.createdAt).toLocaleString();
    return [
      `#${log.id || '-'}`,
      log.edfNumber || 'N/A',
      log.toStatus || 'Unknown',
      log.changedBy || 'System',
      log.fromStatus ? `${log.fromStatus} -> ${log.toStatus}` : log.toStatus,
      dateFormatted,
      log.notes || 'Status updated',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['ID', 'EDF #', 'Action', 'Logged By (Actor & Role)', 'Transition', 'Timestamp', 'Notes']],
    body: auditRows,
    theme: 'striped',
    headStyles: {
      fillColor: [225, 29, 72], // Rose
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 38 },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 32, fontStyle: 'normal' },
      6: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.column.index === 2) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === 'received' || val === 'completed') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (val === 'partially received') {
          data.cell.styles.textColor = [2, 132, 199];
        } else if (val === 'overdue') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
    didDrawPage: (data) => {
      const totalPages = (doc.internal as any).getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'EDF Delivery & Receipt Official Audit Log • Generated for Internal Recordkeeping',
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

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`EDF_Receipt_Audit_Log_${dateStr}.pdf`);
}
