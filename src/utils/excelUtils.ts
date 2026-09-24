import * as XLSX from 'xlsx';
import { EDF, MaterialItem } from '../types/index.ts';

export interface ParsedExcelResult {
  fileName: string;
  sheetNames: string[];
  rawText: string;
  rows: any[];
  guessedData?: {
    edfNumber?: string;
    category?: string;
    requestingTeam?: string;
    requiredDate?: string;
    requestDescription?: string;
    remarks?: string;
    materials: MaterialItem[];
  };
}

/**
 * Parses an Excel or CSV file from File object.
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const firstSheetName = sheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON rows
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Guess materials from table rows
  const extractedMaterials: MaterialItem[] = [];
  let guessedEdfNumber = '';
  let guessedCategory = '';
  let guessedTeam = '';
  let guessedRequiredDate = '';
  let guessedDesc = '';

  // Look for header row index (row containing "material" or "item" or "description" or "qty")
  let headerRowIdx = -1;
  let nameColIdx = 0;
  let qtyColIdx = 1;
  let unitColIdx = 2;
  let descColIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').toLowerCase().trim();

      // Check for EDF Number in headers/labels
      if (val.includes('edf') || val.includes('req') || val.includes('requisition')) {
        const nextVal = String(row[c + 1] || '').trim();
        if (nextVal && nextVal.length > 3) guessedEdfNumber = nextVal;
      }
      if (val.includes('category') || val.includes('department')) {
        const nextVal = String(row[c + 1] || '').trim();
        if (nextVal) guessedCategory = nextVal;
      }
      if (val.includes('team') || val.includes('requesting') || val.includes('demanded by')) {
        const nextVal = String(row[c + 1] || '').trim();
        if (nextVal) guessedTeam = nextVal;
      }
      if (val.includes('required') || val.includes('due date') || val.includes('need date')) {
        const nextVal = String(row[c + 1] || '').trim();
        if (nextVal) guessedRequiredDate = nextVal;
      }

      // Check for table header row
      if (val.includes('item') || val.includes('material') || val.includes('description')) {
        headerRowIdx = r;
      }
    }

    if (headerRowIdx !== -1) {
      // Find column indices
      const hRow = rows[headerRowIdx];
      for (let c = 0; c < hRow.length; c++) {
        const colHeader = String(hRow[c] || '').toLowerCase().trim();
        if (colHeader.includes('material') || colHeader.includes('item') || colHeader.includes('name')) {
          nameColIdx = c;
        } else if (colHeader.includes('qty') || colHeader.includes('quantity')) {
          qtyColIdx = c;
        } else if (colHeader.includes('unit') || colHeader.includes('uom')) {
          unitColIdx = c;
        } else if (colHeader.includes('desc') || colHeader.includes('spec') || colHeader.includes('remark')) {
          descColIdx = c;
        }
      }
      break;
    }
  }

  // If header found, parse table items
  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawName = row[nameColIdx];
    if (!rawName || String(rawName).trim().length === 0) continue;

    const name = String(rawName).trim();
    // Skip subheadings like "Total", "Notes", etc.
    if (name.toLowerCase().startsWith('total') || name.toLowerCase().startsWith('signature')) continue;

    const qty = row[qtyColIdx] !== undefined ? String(row[qtyColIdx]).trim() : '1';
    const unit = row[unitColIdx] !== undefined ? String(row[unitColIdx]).trim() : 'Pieces';
    const desc = descColIdx !== -1 && row[descColIdx] !== undefined ? String(row[descColIdx]).trim() : '';

    extractedMaterials.push({
      materialName: name,
      quantity: qty || '1',
      unit: unit || 'Pieces',
      description: desc,
    });
  }

  return {
    fileName: file.name,
    sheetNames,
    rawText: csv,
    rows,
    guessedData: {
      edfNumber: guessedEdfNumber,
      category: guessedCategory,
      requestingTeam: guessedTeam,
      requiredDate: guessedRequiredDate,
      requestDescription: guessedDesc,
      materials: extractedMaterials,
    },
  };
}

/**
 * Downloads a sample Excel file ready to be uploaded and tested.
 */
export function downloadSampleExcel(categoryType: 'HVAC' | 'Plumbing' | 'Generator' | 'Electrical' | 'Telephone' | 'Blank') {
  let fileName = `EDF_Sample_Requisition_${categoryType}.xlsx`;
  let data: any[][] = [];

  const today = new Date().toISOString().split('T')[0];
  const reqDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 15:00';

  if (categoryType === 'HVAC') {
    data = [
      ['EMPLOYEE DEMAND FORM (EDF) - MATERIAL REQUISITION'],
      [],
      ['EDF Number:', `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`, 'Category:', 'HVAC / AC'],
      ['Requesting Team:', 'HVAC Chiller Maintenance Unit', 'Priority:', 'High'],
      ['Request Date:', today, 'Required Date:', reqDate],
      ['Work Scope / Description:', 'Emergency replacement parts for 3rd floor AHU and condensing unit'],
      [],
      ['Item #', 'Material Name', 'Quantity', 'Unit', 'Specification / Description'],
      [1, 'AC Air Filter 24x24x2 inch MERV 8', 20, 'Pieces', 'Primary intake filters for AHU-3'],
      [2, 'Copper Pipe 7/8 inch Suction Line', 40, 'Meters', 'Hard drawn seamless refrigeration tubing'],
      [3, 'Refrigerant R-410A Cylinders', 4, 'Cylinders', '11.3 kg net weight cylinders'],
      [4, 'Dual Run Capacitor 50+5 uF 440V', 6, 'Pieces', 'Heavy duty metal case oval capacitor'],
      [5, 'Liquid Line Filter Drier 5/8 Flare', 4, 'Pieces', 'Hermetic copper/steel filter drier'],
      [],
      ['Coordinator Remarks:', 'Vendor confirmed dispatch within 48 hours. Storekeeper to verify pressure seals.'],
    ];
  } else if (categoryType === 'Plumbing') {
    data = [
      ['EMPLOYEE DEMAND FORM (EDF) - MATERIAL REQUISITION'],
      [],
      ['EDF Number:', `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`, 'Category:', 'Plumbing'],
      ['Requesting Team:', 'Facility Plumbing Crew', 'Priority:', 'Urgent'],
      ['Request Date:', today, 'Required Date:', reqDate],
      ['Work Scope / Description:', 'Sanitary line upgrade and booster pump isolation valves'],
      [],
      ['Item #', 'Material Name', 'Quantity', 'Unit', 'Specification / Description'],
      [1, 'Brass Gate Valve 2 Inch PN16', 8, 'Pieces', 'Full bore brass gate valve female thread'],
      [2, 'PVC Drain Pipe 4 Inch Class B', 18, 'Meters', 'Heavy wall PVC drainage pipe with socket'],
      [3, 'Wash Basin Mixer Tap Single Lever', 10, 'Sets', 'Ceramic cartridge chrome finish mixer taps'],
      [4, 'PTFE Teflon Thread Seal Tape', 30, 'Rolls', '19mm x 0.1mm x 15m density tape'],
      [5, 'Flexible Stainless Steel Hose 1/2 inch', 20, 'Pieces', 'Braided flexible connector 450mm length'],
      [],
      ['Coordinator Remarks:', 'Urgent leak remediation in Sector C washrooms.'],
    ];
  } else if (categoryType === 'Generator') {
    data = [
      ['EMPLOYEE DEMAND FORM (EDF) - MATERIAL REQUISITION'],
      [],
      ['EDF Number:', `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`, 'Category:', 'Generator'],
      ['Requesting Team:', 'Power Plant & Generator Team', 'Priority:', 'Normal'],
      ['Request Date:', today, 'Required Date:', reqDate],
      ['Work Scope / Description:', '500-hour preventive servicing kit for 750kVA standby diesel generator'],
      [],
      ['Item #', 'Material Name', 'Quantity', 'Unit', 'Specification / Description'],
      [1, 'Generator Engine Oil Filter LF9009', 6, 'Pieces', 'Fleetguard spin-on lube filter element'],
      [2, 'Diesel Primary Fuel Filter FS1000', 6, 'Pieces', 'Fuel water separator element'],
      [3, '12V 200Ah Heavy Duty Starter Battery', 2, 'Units', 'Sealed lead acid generator cranking battery'],
      [4, 'Alternator Poly-V Fan Belt', 4, 'Sets', 'High temperature cogged belt set'],
      [5, 'Heavy Duty Diesel Engine Oil 15W-40', 80, 'Liters', 'API CI-4 20-liter drums'],
      [],
      ['Coordinator Remarks:', 'Scheduled monthly test run scheduled following oil change.'],
    ];
  } else if (categoryType === 'Electrical') {
    data = [
      ['EMPLOYEE DEMAND FORM (EDF) - MATERIAL REQUISITION'],
      [],
      ['EDF Number:', `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`, 'Category:', 'Electrical'],
      ['Requesting Team:', 'Electrical Engineering Unit', 'Priority:', 'High'],
      ['Request Date:', today, 'Required Date:', reqDate],
      ['Work Scope / Description:', 'Server Room DB panel retrofit and power distribution expansion'],
      [],
      ['Item #', 'Material Name', 'Quantity', 'Unit', 'Specification / Description'],
      [1, 'Schneider 32A 3-Pole MCB 10kA', 12, 'Pieces', 'C-curve DIN-rail miniature circuit breaker'],
      [2, 'Schneider 40A 3-Pole Contactor 220V', 6, 'Pieces', 'TeSys D magnetic contactor'],
      [3, '4-Core 16mm Armored XLPE Copper Cable', 75, 'Meters', 'Heavy duty armored underground power cable'],
      [4, 'Industrial Surface Socket 16A 3-Pin IP67', 16, 'Pieces', 'Waterproof industrial power receptacle'],
      [5, 'Panel Indicator Lamps LED 220V (R/Y/B)', 18, 'Pieces', '22mm pilot LED indicators set'],
      [],
      ['Coordinator Remarks:', 'Requires certified electrician installation.'],
    ];
  } else {
    data = [
      ['EMPLOYEE DEMAND FORM (EDF) - MATERIAL REQUISITION'],
      [],
      ['EDF Number:', `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`, 'Category:', 'General / Other'],
      ['Requesting Team:', 'General Facility Maintenance', 'Priority:', 'Normal'],
      ['Request Date:', today, 'Required Date:', reqDate],
      ['Work Scope / Description:', 'Enter purpose of material request here...'],
      [],
      ['Item #', 'Material Name', 'Quantity', 'Unit', 'Specification / Description'],
      [1, 'Sample Material Item 1', 10, 'Pieces', 'Specification note'],
      [2, 'Sample Material Item 2', 50, 'Meters', 'Specification note'],
      [3, 'Sample Material Item 3', 5, 'Units', 'Specification note'],
      [],
      ['Coordinator Remarks:', 'Enter coordinator logistics remarks here...'],
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 42 },
    { wch: 14 },
    { wch: 16 },
    { wch: 48 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Material Requisition');
  XLSX.writeFile(wb, fileName);
}

/**
 * Export EDF records list to an Excel spreadsheet.
 */
export function exportEdfsToExcel(edfsList: EDF[], title = 'EDF_Material_Requests_Export.xlsx') {
  const exportRows = edfsList.map((e, idx) => ({
    '#': idx + 1,
    'EDF Number': e.edfNumber,
    'Category': e.categoryName,
    'Requesting Team': e.requestingTeam,
    'Status': e.status,
    'Priority': e.priority,
    'Request Date': e.requestDate,
    'Required Date': e.requiredDate,
    'Expected Date': e.expectedDate || '—',
    'Total Items': e.materialCount || (e.materials ? e.materials.length : 0),
    'Materials Summary': (e.materials || []).map((m) => `${m.materialName} (${m.quantity} ${m.unit})`).join('; '),
    'Remarks': e.remarks || '',
    'Created By': e.createdBy || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'EDF Records');
  XLSX.writeFile(wb, title);
}

/**
 * Options for reporting CSV exports
 */
export interface CsvReportOptions {
  filterCategory?: string;
  filterStatus?: string;
  searchTerm?: string;
  exportedBy?: string;
}

/**
 * Calculates human-readable schedule compliance for reporting.
 */
function getScheduleCompliance(item: EDF): string {
  if (item.status === 'Completed') return 'Completed / Fulfilled';
  if (item.status === 'Received') return 'Materials Received';
  const reqTime = new Date(item.requiredDate).getTime();
  if (isNaN(reqTime)) return item.status;
  const diff = reqTime - Date.now();
  if (diff < 0) {
    const overdueDays = Math.max(1, Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24)));
    return `OVERDUE (${overdueDays} day${overdueDays > 1 ? 's' : ''} past due)`;
  }
  if (diff <= 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    return `DUE SOON (~${hours} hr${hours > 1 ? 's' : ''} remaining)`;
  }
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  return `On Schedule (${days} day${days > 1 ? 's' : ''} remaining)`;
}

/**
 * Export EDF records list to a standard CSV file for reporting and external spreadsheet analysis.
 */
export function exportEdfsToCsv(
  edfsList: EDF[],
  filename = 'EDF_Material_Requests_Export.csv',
  reportOptions?: CsvReportOptions
) {
  const headers = [
    '#',
    'EDF Number',
    'Status',
    'Schedule Compliance',
    'Priority',
    'Category / Department',
    'Requesting Team',
    'Requester / Submitted By',
    'Request Date',
    'Required Date',
    'Expected / Delivery Date',
    'Total Material Items',
    'Material Items Detail',
    'Work Scope / Request Description',
    'Remarks / Notes',
    'Export Date',
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const exportDateStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const rows = edfsList.map((e, idx) => {
    const materialsSummary = (e.materials || [])
      .map(
        (m, mIdx) =>
          `${mIdx + 1}. ${m.materialName} (Qty: ${m.quantity} ${m.unit}${
            m.description ? ` | Spec: ${m.description}` : ''
          })`
      )
      .join('; ');

    const compliance = getScheduleCompliance(e);

    return [
      idx + 1,
      e.edfNumber,
      e.status,
      compliance,
      e.priority,
      e.categoryName,
      e.requestingTeam,
      e.createdBy || 'Office Coordinator',
      e.requestDate,
      e.requiredDate,
      e.expectedDate || '—',
      e.materialCount || (e.materials ? e.materials.length : 0),
      materialsSummary,
      e.requestDescription || '',
      e.remarks || '',
      exportDateStr,
    ];
  });

  const csvRows: string[] = [];

  // Add table headers
  csvRows.push(headers.map(escapeCsv).join(','));

  // Add data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCsv).join(','));
  }

  const csvContent = csvRows.join('\r\n');

  // Add UTF-8 BOM (\uFEFF) so Excel, Google Sheets, and standard reporting tools recognize UTF-8 encoding
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

