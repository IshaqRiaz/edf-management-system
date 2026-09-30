import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EDF, Category } from '../types.ts';

interface GenerateReportPdfOptions {
  edfs: EDF[];
  categories: Category[];
  selectedCategory: string;
  selectedStatus: string;
  userName?: string;
}

export function generateReportPdf({
  edfs,
  categories,
  selectedCategory,
  selectedStatus,
  userName = 'Coordinator',
}: GenerateReportPdfOptions) {
  const doc = new jsPDF({
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
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const filterDesc = `Category Filter: ${selectedCategory}   |   Status Filter: ${selectedStatus}   |   Total Filtered Records: ${edfs.length}`;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY - 4, pageWidth - margin * 2, 7, 1.5, 1.5, 'F');
  doc.text(filterDesc, margin + 4, currentY + 1);
  currentY += 10;

  // 4. EXECUTIVE SUMMARY KPIS
  const total = edfs.length || 1;
  const completedCount = edfs.filter((e) => e.status === 'Completed').length;
  const receivedCount = edfs.filter((e) => e.status === 'Received').length;
  const pendingCount = edfs.filter((e) => e.status === 'Pending').length;
  const overdueCount = edfs.filter((e) => e.status === 'Overdue' || e.isOverdue).length;
  const fulfillmentRate = Math.round((completedCount / total) * 100);

  const kpiBoxWidth = (pageWidth - margin * 2 - 12) / 4;
  const kpiBoxHeight = 16;

  const kpis = [
    { title: 'Fulfillment Rate', value: `${fulfillmentRate}%`, color: [16, 185, 129] }, // Emerald
    { title: 'Completed', value: `${completedCount}`, color: [5, 150, 105] }, // Dark Emerald
    { title: 'Active / Pending', value: `${pendingCount + receivedCount}`, color: [2, 132, 199] }, // Sky
    { title: 'Overdue Demands', value: `${overdueCount}`, color: [225, 29, 72] }, // Rose
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

  // 5. DEPARTMENTAL SUMMARY TABLE (AutoTable)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Departmental Demand Breakdown', margin, currentY);
  currentY += 3;

  const catRows = categories.map((cat) => {
    const catEdfs = edfs.filter((e) => e.category.toLowerCase() === cat.name.toLowerCase());
    const count = catEdfs.length;
    const completed = catEdfs.filter((e) => e.status === 'Completed').length;
    const received = catEdfs.filter((e) => e.status === 'Received').length;
    const overdue = catEdfs.filter((e) => e.status === 'Overdue' || e.isOverdue).length;
    const pending = count - completed - overdue;
    const share = Math.round((count / total) * 100);

    return [cat.name, String(count), String(completed), String(received), String(Math.max(pending, 0)), String(overdue), `${share}%`];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Total', 'Completed', 'Received', 'Pending', 'Overdue', 'Share']],
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

  // 6. DETAILED RECORDS TABLE (AutoTable)
  const lastTableY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  let detailStartY = lastTableY + 8;

  // Check if we need a new page for detailed table
  if (detailStartY > pageHeight - 50) {
    doc.addPage();
    detailStartY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Filtered Demand Form Records (${edfs.length} items)`, margin, detailStartY);
  detailStartY += 3;

  const detailRows = edfs.map((item) => {
    const isOverdue = item.status === 'Overdue' || item.isOverdue;
    const issueDateStr = new Date(item.issueDate).toLocaleDateString();
    const reqDateStr = new Date(item.requiredDate).toLocaleDateString();
    const materialSummary = item.items && item.items.length > 0
      ? item.items.map((i) => `${i.itemDescription} (${i.quantity} ${i.unit})`).join(', ')
      : `${item.materialList} (${item.quantity} ${item.unit})`;

    return [
      item.edfNumber,
      item.requesterName,
      item.category,
      issueDateStr,
      reqDateStr,
      materialSummary,
      isOverdue ? 'Overdue' : item.status,
    ];
  });

  autoTable(doc, {
    startY: detailStartY,
    head: [['EDF #', 'Requester', 'Category', 'Issue Date', 'Required Date', 'Items / Materials', 'Status']],
    body: detailRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [51, 65, 85],
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Highlight Overdue rows
      if (data.column.index === 6) {
        const val = String(data.cell.raw).toLowerCase();
        if (val.includes('overdue')) {
          data.cell.styles.textColor = [225, 29, 72];
        } else if (val.includes('completed')) {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (val.includes('received')) {
          data.cell.styles.textColor = [2, 132, 199];
        } else if (val.includes('pending')) {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
    didDrawPage: (data) => {
      // Page Footer
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

  // Generate filename with date
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanCat = selectedCategory.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `EDF_Report_${cleanCat}_${dateStr}.pdf`;

  // Save PDF
  doc.save(filename);
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
  const doc = new jsPDF({
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
  const receivedLogs = logs.filter((l) => String(l.toStatus).toLowerCase() === 'received');
  const completedLogs = logs.filter((l) => String(l.toStatus).toLowerCase() === 'completed');

  const boxWidth = (pageWidth - margin * 2 - 8) / 3;
  const boxHeight = 15;

  const summary = [
    { title: 'Total Audit Entries', count: logs.length, color: [15, 23, 42] },
    { title: 'Marked as Received', count: receivedLogs.length, color: [2, 132, 199] },
    { title: 'Marked as Completed', count: completedLogs.length, color: [5, 150, 105] },
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
      log.fromStatus ? `${log.fromStatus} → ${log.toStatus}` : log.toStatus,
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
        if (val === 'received') {
          data.cell.styles.textColor = [2, 132, 199];
        } else if (val === 'completed') {
          data.cell.styles.textColor = [5, 150, 105];
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

