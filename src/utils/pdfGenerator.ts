import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EDF } from '../types/index.ts';
import { formatDateTime, formatDate, calculateRemainingTime } from './dateUtils.ts';

export interface OfficePdfSettings {
  companyName: string;
  departmentName: string;
  officeLocation: string;
  coordinatorName: string;
  contactEmail: string;
}

export const defaultPdfSettings: OfficePdfSettings = {
  companyName: 'FACILITIES & TECHNICAL SERVICES DIVISION',
  departmentName: 'Central Material Logistics & Coordination Office',
  officeLocation: 'Main Office Complex, Technical Wing',
  coordinatorName: 'Office Coordinator',
  contactEmail: 'coordinator@facility-office.internal',
};

export function buildEdfPdfDocument(edf: EDF, settings: OfficePdfSettings = defaultPdfSettings): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Accent Bar
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Decorative Accent line
  doc.setFillColor(14, 165, 233); // Sky-500
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.companyName.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(`${settings.departmentName} | ${settings.officeLocation}`, 14, 18);

  // Document Heading Title Block
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('EMPLOYEE DEMAND FORM (EDF)', 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Official Requisition & Technical Material Demand Voucher', 14, 42);

  // Status Badge in header
  const statusColors: Record<string, [number, number, number]> = {
    Overdue: [225, 29, 72], // Rose-600
    Pending: [217, 119, 6], // Amber-600
    Received: [13, 148, 136], // Teal-600
    Completed: [16, 185, 129], // Emerald-600
    Draft: [100, 116, 139],
    Submitted: [37, 99, 235],
  };

  const badgeColor = statusColors[edf.status] || [71, 85, 105];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(pageWidth - 54, 30, 40, 9, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(edf.status.toUpperCase(), pageWidth - 34, 36, { align: 'center' });

  // Metadata Panel
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(14, 47, pageWidth - 28, 44, 2, 2, 'FD');

  doc.setFontSize(8.5);
  const leftColX = 18;
  const midColX = 75;
  const rightColX = 135;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('EDF NUMBER:', leftColX, 55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(edf.edfNumber, leftColX + 26, 55);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CATEGORY:', midColX, 55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(edf.categoryName, midColX + 22, 55);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('PRIORITY:', rightColX, 55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(edf.priority === 'Urgent' ? 220 : 15, 23, 42);
  doc.text(edf.priority.toUpperCase(), rightColX + 20, 55);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('REQUEST DATE:', leftColX, 64);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDate(edf.requestDate), leftColX + 28, 64);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('REQUIRED DATE:', midColX, 64);
  doc.setFont('helvetica', 'bold');
  const timer = calculateRemainingTime(edf.requiredDate, edf.status, edf.receivedDate, edf.completedDate);
  if (timer.isOverdue) {
    doc.setTextColor(225, 29, 72); // Red for overdue
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(formatDateTime(edf.requiredDate), midColX + 28, 64);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('EXPECTED DATE:', rightColX, 64);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDate(edf.expectedDate) || 'As required', rightColX + 28, 64);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('REQUESTING TEAM:', leftColX, 73);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(edf.requestingTeam, leftColX + 34, 73);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TIMING STATUS:', midColX, 73);
  doc.setFont('helvetica', 'bold');
  if (timer.isOverdue) {
    doc.setTextColor(225, 29, 72);
  } else if (timer.isCompleted) {
    doc.setTextColor(16, 185, 129);
  } else {
    doc.setTextColor(37, 99, 235);
  }
  doc.text(timer.shortText, midColX + 28, 73);

  // Row 4: Description
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('PURPOSE / SCOPE:', leftColX, 82);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const scopeText = doc.splitTextToSize(edf.requestDescription || 'Standard technical material request for maintenance operations.', 140);
  doc.text(scopeText, leftColX + 34, 82);

  // Materials Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('REQUISITIONED MATERIAL ITEMS', 14, 99);

  // Prepare Materials Table data
  const tableData = (edf.materials || []).map((mat, idx) => [
    String(idx + 1).padStart(2, '0'),
    mat.materialName,
    mat.description || '—',
    mat.quantity,
    mat.unit,
    mat.status || edf.status,
  ]);

  if (tableData.length === 0) {
    tableData.push(['01', 'No specific materials listed', '—', '1', 'Lot', edf.status]);
  }

  autoTable(doc, {
    startY: 103,
    head: [['#', 'Material Item Name', 'Technical Specification / Description', 'Qty', 'Unit', 'Item Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 20 },
      5: { cellWidth: 24, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Remarks section
  if (finalY < pageHeight - 65) {
    doc.setFillColor(254, 243, 199); // Amber-50
    doc.setDrawColor(251, 191, 36); // Amber-400
    doc.roundedRect(14, finalY, pageWidth - 28, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14); // Amber-900
    doc.text('COORDINATOR REMARKS / LOGISTICS NOTES:', 18, finalY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    const remarkLines = doc.splitTextToSize(edf.remarks || 'Standard requisition procedure applicable. Materials to be inspected upon arrival.', pageWidth - 36);
    doc.text(remarkLines, 18, finalY + 12);
  }

  // Sign-off / Authorization Boxes at the bottom
  const signY = pageHeight - 38;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);

  // Box 1: Coordinator
  doc.rect(14, signY, 56, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('ISSUED & COORDINATED BY:', 16, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(edf.createdBy || settings.coordinatorName, 16, signY + 12);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Signed: ${formatDate(edf.requestDate)}`, 16, signY + 22);

  // Box 2: Technical Team Lead
  doc.rect(75, signY, 56, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('REQUESTING TEAM VERIFICATION:', 77, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(edf.requestingTeam, 77, signY + 12);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature & Stamp', 77, signY + 22);

  // Box 3: Store / Receiver
  doc.rect(136, signY, 60, 26, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('WAREHOUSE / STORE RECEIPT:', 138, signY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    edf.status === 'Received' || edf.status === 'Completed'
      ? `Received on: ${edf.receivedDate || edf.completedDate || 'Recorded'}`
      : 'Pending Store Dispatch',
    138,
    signY + 12
  );
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Store Keeper Sign-off', 138, signY + 22);

  // Footer text
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `EDF System Generated Document • Requisition ${edf.edfNumber} • Printed ${new Date().toLocaleString()}`,
    14,
    pageHeight - 6
  );

  return doc;
}

export function downloadEdfPdf(edf: EDF, settings?: OfficePdfSettings) {
  const doc = buildEdfPdfDocument(edf, settings);
  doc.save(`${edf.edfNumber}_Material_Request.pdf`);
}

export function previewEdfPdf(edf: EDF, settings?: OfficePdfSettings): string {
  const doc = buildEdfPdfDocument(edf, settings);
  return doc.output('bloburl').toString();
}
