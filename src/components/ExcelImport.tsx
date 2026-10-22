import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Category, EDFItem, EDF } from '../types.ts';
import { getCategoryBadgeClass, getCategoryTheme } from '../utils/categoryColors.ts';
import { RequesterDropdown } from './RequesterDropdown.tsx';
import {
  FileUp,
  FileSpreadsheet,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  Calendar,
  User,
  Hash,
  ShieldCheck,
  Search,
  Database,
  RefreshCw,
  FileText,
  Info,
  X,
  AlertCircle,
  Check,
  HelpCircle,
} from 'lucide-react';

export interface ExtractedCSVEdf {
  edfNumber: string;
  requesterName: string;
  category: string;
  issueDate: string;
  requiredDate: string;
  status: string;
  remarks: string;
  items: Array<{
    itemDescription: string;
    quantity: number;
    unit: string;
    status: 'Pending' | 'Received';
    remarks?: string;
    justification?: string;
  }>;
  isExisting: boolean;
}

interface ExcelImportProps {
  categories: Category[];
  onSaveEDF: (edfData: any) => Promise<boolean>;
  onCancel: () => void;
  existingEdfs?: EDF[];
  onImportSuccess?: () => void;
}

export const ExcelImport: React.FC<ExcelImportProps> = ({
  categories,
  onSaveEDF,
  onCancel,
  existingEdfs = [],
  onImportSuccess,
}) => {
  // Modes: 'table' (Import Table), 'excel' (Import Excel), 'csv' (Import CSV)
  const [activeMode, setActiveMode] = useState<'table' | 'excel' | 'csv'>('table');
  const [fileError, setFileError] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState('');
  const [extractedItems, setExtractedItems] = useState<EDFItem[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Single EDF Form fields for Table / Excel modes
  const [edfNumber, setEdfNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('HVAC');
  const [requesterName, setRequesterName] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [requiredDate, setRequiredDate] = useState<string>(() => {
    const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  // Never insert automatic text such as "Imported from Excel". Leave blank if no justification.
  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // EDF / PDF Number Detection & Overwrite Safety States
  const [edfDetectionSource, setEdfDetectionSource] = useState<'detected' | 'ambiguous' | 'missing' | null>(null);
  const [detectedColumnHeading, setDetectedColumnHeading] = useState<string | null>(null);
  const [ambiguousNumbers, setAmbiguousNumbers] = useState<string[]>([]);
  const [isNumberConfirmed, setIsNumberConfirmed] = useState<boolean>(false);
  const [showNumberConfirmModal, setShowNumberConfirmModal] = useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);

  // Check if current edfNumber matches any existing record to prevent accidental duplicate or overwrite
  const duplicateExistingEdf = useMemo(() => {
    if (!edfNumber.trim() || !existingEdfs || existingEdfs.length === 0) return null;
    const target = edfNumber.trim().toLowerCase();
    return existingEdfs.find((e) => e.edfNumber.trim().toLowerCase() === target) || null;
  }, [edfNumber, existingEdfs]);

  // Generate next safe sequential number when duplicate or missing
  const handleAssignNextUniqueNumber = async () => {
    try {
      const res = await fetch('/api/edfs/next-number', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
        },
      });
      const data = await res.json();
      if (data?.nextEdfNumber) {
        setEdfNumber(data.nextEdfNumber);
        setIsNumberConfirmed(true);
        setEdfDetectionSource('detected');
        setShowDuplicateModal(false);
        setValidationErrors((prev) => ({ ...prev, edfNumber: '' }));
      }
    } catch {
      const fallback = `EDF-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
      setEdfNumber(fallback);
      setIsNumberConfirmed(true);
      setShowDuplicateModal(false);
      setValidationErrors((prev) => ({ ...prev, edfNumber: '' }));
    }
  };

  // Append safe suffix to resolve duplicates
  const handleAppendSuffix = () => {
    let suffixNum = 1;
    let candidate = `${edfNumber.trim()}-${suffixNum}`;
    while (existingEdfs?.some((e) => e.edfNumber.trim().toLowerCase() === candidate.toLowerCase())) {
      suffixNum++;
      candidate = `${edfNumber.trim()}-${suffixNum}`;
    }
    setEdfNumber(candidate);
    setIsNumberConfirmed(true);
    setShowDuplicateModal(false);
    setValidationErrors((prev) => ({ ...prev, edfNumber: '' }));
  };

  // CSV Recovery & Import State
  const [csvStep, setCsvStep] = useState<'upload' | 'review'>('upload');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvPasteText, setCsvPasteText] = useState<string>('');
  const [extractedCSVRecords, setExtractedCSVRecords] = useState<ExtractedCSVEdf[]>([]);
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Fetch next available sequential EDF Number from server for Table/Excel mode
  useEffect(() => {
    fetch('/api/edfs/next-number', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.nextEdfNumber) {
          setEdfNumber((prev) => (prev ? prev : data.nextEdfNumber));
        } else {
          setEdfNumber((prev) => (prev ? prev : `EDF-${new Date().getFullYear()}-001`));
        }
      })
      .catch(() => {
        setEdfNumber((prev) => (prev ? prev : `EDF-${new Date().getFullYear()}-001`));
      });

    if (categories.length > 0) {
      setSelectedCategory(categories[0].name);
    }
  }, [categories]);

  // Excel (.xlsx, .xls) upload parser
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setFileError(
        'Invalid file type. Only Excel (.xlsx and .xls) files are supported in this tab. For CSV files, please switch to the "Import CSV" tab.'
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        parseRawRows(rawJson);
      } catch (err: any) {
        setFileError('Failed to read Excel file: ' + (err.message || 'Unknown error'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Direct table paste parser
  const handlePasteParse = () => {
    setFileError(null);
    if (!pasteContent.trim()) {
      setFileError('Please paste your Excel table rows first.');
      return;
    }

    const lines = pasteContent.trim().split('\n');
    const rawRows: string[][] = lines.map((line) => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(',')) return line.split(',');
      return [line];
    });

    parseRawRows(rawRows);
  };

  // Helper to extract items, PDF/EDF numbers, and justifications from 2D array for Table/Excel modes
  const parseRawRows = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      setFileError('No data found in the spreadsheet or pasted text.');
      return;
    }

    const cleanedRows = rows.filter((r) => r && r.some((c) => String(c || '').trim() !== ''));
    if (cleanedRows.length === 0) {
      setFileError('No non-empty rows found. Please copy and paste valid Excel rows.');
      return;
    }

    // 1. Scan top metadata/title rows (first 8 rows) for top-level PDF/EDF number e.g. "PDF Number: 1042" or "EDF No. 2026-005"
    let metaEdfNumber: string | null = null;
    let metaEdfHeading: string | null = null;
    let metaRequester: string | null = null;
    let metaCategory: string | null = null;

    for (let i = 0; i < Math.min(cleanedRows.length, 8); i++) {
      const row = cleanedRows[i];
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const cellStr = String(row[cIdx] || '').trim();
        if (!cellStr) continue;

        // Check if single cell has "PDF Number: 1042" or "PDF No. 1042" or "EDF# 2026-01"
        const inlineMatch = cellStr.match(/(?:pdf|edf|demand\s*form|form)\s*(?:no\.?|number|#)?[:\s-]+([a-z0-9_/-]+)/i);
        if (inlineMatch && inlineMatch[1] && !metaEdfNumber) {
          metaEdfNumber = inlineMatch[1].trim();
          metaEdfHeading = cellStr.split(/[:\s-]/)[0];
        }

        // Check if cell is a label like "PDF Number" and next cell has the value
        const lower = cellStr.toLowerCase();
        const cleanLabel = lower.replace(/[^a-z0-9]/g, '');
        if (
          (cleanLabel === 'pdfnumber' || cleanLabel === 'pdfno' || cleanLabel === 'pdf' || cleanLabel === 'pdfnum' ||
           cleanLabel === 'edfnumber' || cleanLabel === 'edfno' || cleanLabel === 'edf' || cleanLabel === 'edfnum' ||
           cleanLabel === 'demandformnumber' || cleanLabel === 'demandformno' || cleanLabel === 'formno') &&
          row[cIdx + 1] !== undefined
        ) {
          const nextVal = String(row[cIdx + 1] || '').trim();
          if (nextVal && !metaEdfNumber) {
            metaEdfNumber = nextVal;
            metaEdfHeading = cellStr;
          }
        }

        // Check if cell has category name
        if (!metaCategory) {
          const matchedCat = categories.find((c) => c.name.toLowerCase() === lower);
          if (matchedCat) {
            metaCategory = matchedCat.name;
          }
        }
      }
    }

    // 2. Identify column header row & indices
    let headerRowIdx = -1;
    let edfColIdx = -1;
    let descColIdx = -1;
    let unitColIdx = -1;
    let qtyColIdx = -1;
    let justificationColIdx = -1;
    let requesterColIdx = -1;
    let categoryColIdx = -1;
    let detectedEdfColName: string | null = null;
    let detectedJustColName: string | null = null;

    for (let i = 0; i < Math.min(cleanedRows.length, 10); i++) {
      const row = cleanedRows[i].map((cell) => String(cell || '').toLowerCase().trim());

      let tempEdfCol = -1;
      let tempDescCol = -1;
      let tempUnitCol = -1;
      let tempQtyCol = -1;
      let tempJustCol = -1;
      let tempReqCol = -1;
      let tempCatCol = -1;
      let tempEdfName = '';
      let tempJustName = '';

      row.forEach((cell, idx) => {
        const clean = cell.replace(/[^a-z0-9]/g, '');

        // 1. PDF / EDF Number Column detection
        if (
          cell.includes('pdf number') || cell.includes('pdf no') || cell.includes('pdf #') || cell === 'pdf' ||
          cell.includes('edf number') || cell.includes('edf no') || cell.includes('edf #') || cell === 'edf' ||
          cell.includes('demand form') || cell.includes('demand no') || cell.includes('form no') || cell.includes('form number') ||
          clean === 'pdfnumber' || clean === 'pdfno' || clean === 'pdf' || clean === 'pdfnum' ||
          clean === 'edfnumber' || clean === 'edfno' || clean === 'edf' || clean === 'edfnum' ||
          clean === 'demandformnumber' || clean === 'demandformno' || clean === 'formnumber' || clean === 'formno'
        ) {
          tempEdfCol = idx;
          tempEdfName = String(cleanedRows[i][idx] || 'PDF Number');
        }
        // 2. Justification & Requirements For & Remarks Column detection
        else if (
          cell.includes('justif') || cell.includes('requirement') || cell.includes('requir for') ||
          cell.includes('reason') || cell.includes('purpose') || cell.includes('remark') ||
          cell.includes('note') || cell.includes('comment') ||
          clean.includes('justification') || clean.includes('requirementsfor') || clean.includes('requirementfor') ||
          clean.includes('requiredfor')
        ) {
          tempJustCol = idx;
          tempJustName = String(cleanedRows[i][idx] || 'Justification');
        }
        // 3. Material Description Column detection
        else if (
          cell.includes('desc') || cell.includes('item') || cell.includes('material') ||
          cell.includes('particular') || cell.includes('product') || cell === 'name' ||
          cell === 'items' || cell === 'materials'
        ) {
          tempDescCol = idx;
        }
        // 4. Unit Column detection
        else if (cell.includes('unit') || cell.includes('uom') || cell.includes('measur')) {
          tempUnitCol = idx;
        }
        // 5. Quantity Column detection
        else if (
          cell.includes('qty') || cell.includes('quant') || cell.includes('count') ||
          cell.includes('total') || cell === 'pcs' || cell === 'nos'
        ) {
          tempQtyCol = idx;
        }
        // 6. Requester Name Column
        else if (
          (cell.includes('request') && (cell.includes('by') || cell.includes('name') || cell.includes('person') || cell.includes('user'))) ||
          cell.includes('requester')
        ) {
          tempReqCol = idx;
        }
        // 7. Category / Department Column
        else if (cell.includes('category') || cell.includes('dept') || cell.includes('department') || cell.includes('team')) {
          tempCatCol = idx;
        }
      });

      // Valid header recognized if it has a description column, or has (quantity + unit) or (justification + item)
      if (tempDescCol !== -1 || (tempQtyCol !== -1 && tempUnitCol !== -1) || (tempEdfCol !== -1 && tempJustCol !== -1)) {
        headerRowIdx = i;
        edfColIdx = tempEdfCol;
        descColIdx = tempDescCol !== -1 ? tempDescCol : (tempEdfCol === 0 ? 1 : 0);
        unitColIdx = tempUnitCol;
        qtyColIdx = tempQtyCol;
        justificationColIdx = tempJustCol;
        requesterColIdx = tempReqCol;
        categoryColIdx = tempCatCol;
        detectedEdfColName = tempEdfName;
        detectedJustColName = tempJustName;
        break;
      }
    }

    // Default fallback columns if no header was detected
    if (headerRowIdx === -1) {
      descColIdx = 0;
      unitColIdx = 1;
      qtyColIdx = 2;
    }

    const dataRows = headerRowIdx >= 0 ? cleanedRows.slice(headerRowIdx + 1) : cleanedRows;
    const items: EDFItem[] = [];
    const numbersFound: string[] = [];
    const justificationsFound: string[] = [];

    dataRows.forEach((row) => {
      let desc = '';
      let unit = 'pcs';
      let qty = 1;
      let just = '';

      // Check EDF/PDF Number column
      if (edfColIdx >= 0 && row[edfColIdx] !== undefined) {
        const val = String(row[edfColIdx] || '').trim();
        if (val && !numbersFound.includes(val)) {
          numbersFound.push(val);
        }
      }

      // Check Material Description
      if (descColIdx >= 0 && row[descColIdx] !== undefined) {
        desc = String(row[descColIdx] || '').trim();
      } else if (row.length === 1) {
        desc = String(row[0] || '').trim();
      }

      // Check Unit
      if (unitColIdx >= 0 && row[unitColIdx] !== undefined) {
        const rawUnit = String(row[unitColIdx] || '').trim();
        if (rawUnit) unit = rawUnit;
      }

      // Check Quantity
      if (qtyColIdx >= 0 && row[qtyColIdx] !== undefined) {
        const rawQty = parseFloat(String(row[qtyColIdx] || '').replace(/[^0-9.]/g, ''));
        if (!isNaN(rawQty) && rawQty > 0) {
          qty = Math.round(rawQty);
        }
      }

      // Check Justification / Requirements For / Remarks
      if (justificationColIdx >= 0 && row[justificationColIdx] !== undefined) {
        const rawJust = String(row[justificationColIdx] || '').trim();
        if (rawJust) {
          just = rawJust;
          if (!justificationsFound.includes(rawJust)) {
            justificationsFound.push(rawJust);
          }
        }
      }

      // Check Requester in row if not yet set
      if (requesterColIdx >= 0 && row[requesterColIdx] !== undefined && !metaRequester) {
        const reqVal = String(row[requesterColIdx] || '').trim();
        if (reqVal) metaRequester = reqVal;
      }

      // Check Category in row if not yet set
      if (categoryColIdx >= 0 && row[categoryColIdx] !== undefined && !metaCategory) {
        const catVal = String(row[categoryColIdx] || '').trim().toLowerCase();
        const foundCat = categories.find((c) => c.name.toLowerCase() === catVal);
        if (foundCat) metaCategory = foundCat.name;
      }

      if (desc) {
        items.push({
          itemDescription: desc,
          quantity: qty,
          unit: unit,
          status: 'Pending',
          remarks: just || null,
          justification: just || null,
        });
      }
    });

    if (items.length === 0) {
      setFileError('Could not find any material rows. Please verify your data.');
      return;
    }

    // 3. Resolve EDF/PDF Number
    let finalDetectedNumber: string | null = null;
    let detectedSource: 'detected' | 'ambiguous' | 'missing' = 'missing';

    if (numbersFound.length === 1) {
      finalDetectedNumber = numbersFound[0];
      detectedSource = 'detected';
      setDetectedColumnHeading(detectedEdfColName || 'PDF Number');
      setAmbiguousNumbers([]);
    } else if (numbersFound.length > 1) {
      finalDetectedNumber = numbersFound[0];
      detectedSource = 'ambiguous';
      setDetectedColumnHeading(detectedEdfColName || 'PDF Number');
      setAmbiguousNumbers(numbersFound);
    } else if (metaEdfNumber) {
      finalDetectedNumber = metaEdfNumber;
      detectedSource = 'detected';
      setDetectedColumnHeading(metaEdfHeading || 'Table Heading');
      setAmbiguousNumbers([]);
    } else {
      detectedSource = 'missing';
      setDetectedColumnHeading(null);
      setAmbiguousNumbers([]);
    }

    if (finalDetectedNumber) {
      setEdfNumber(finalDetectedNumber);
    }
    setEdfDetectionSource(detectedSource);
    setIsNumberConfirmed(detectedSource === 'detected');

    // 4. Resolve Remarks & Justification:
    // Extract actual text from Justification / Requirements For and save to Remarks & Notes.
    // NEVER insert automatic text such as "Imported from Excel table".
    // If justification is blank, leave Remarks & Notes blank.
    if (justificationsFound.length > 0) {
      const combinedJustification = justificationsFound.join(' ; ');
      setRemarks(combinedJustification);
    } else {
      setRemarks('');
    }

    // Auto-select category if detected
    if (metaCategory) {
      setSelectedCategory(metaCategory);
    }
    // Auto-fill requester if detected
    if (metaRequester) {
      setRequesterName(metaRequester);
    }

    setExtractedItems(items);
    setStep('review');
  };

  // CSV parsing date helper
  const parseDateToISO = (dateStr: string, defaultDate: Date): string => {
    if (!dateStr || !dateStr.trim()) return defaultDate.toISOString();
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {}
    return defaultDate.toISOString();
  };

  // Full CSV Data Parser & Multi-Record Recovery
  const processCSVData = (csvText: string, fileName: string = 'imported.csv') => {
    setFileError(null);
    setImportSuccessMessage(null);
    if (!csvText || !csvText.trim()) {
      setFileError('CSV content is empty. Please select or paste a valid CSV file.');
      return;
    }

    try {
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet || !workbook.Sheets[firstSheet]) {
        setFileError('Could not find any readable content in the CSV file.');
        return;
      }

      const worksheet = workbook.Sheets[firstSheet];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setFileError('No records detected in CSV file.');
        return;
      }

      // Helper to find column value by multiple possible header names (exact matches prioritized)
      const findValue = (row: Record<string, any>, candidateKeys: string[]): string => {
        // Pass 1: exact matches
        for (const cand of candidateKeys) {
          const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const key of Object.keys(row)) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normKey === normCand) {
              const val = row[key];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
          }
        }
        // Pass 2: substring matches
        for (const cand of candidateKeys) {
          const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const key of Object.keys(row)) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normKey.includes(normCand)) {
              const val = row[key];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
          }
        }
        return '';
      };

      // Group records by EDF Number
      const edfMap = new Map<string, ExtractedCSVEdf>();
      let autoCounter = 1;

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];

        const hasAnyVal = Object.values(row).some((v) => String(v).trim() !== '');
        if (!hasAnyVal) continue;

        let rawEdfNum = findValue(row, [
          'pdfnumber',
          'pdfno',
          'pdf#',
          'pdf',
          'pdfnum',
          'edfnumber',
          'edfno',
          'edf#',
          'edf',
          'edfid',
          'demandform#',
          'demandformno',
          'demandformnumber',
          'form#',
          'formno',
          'formnumber',
          'number',
          'ref',
        ]);
        if (!rawEdfNum) {
          rawEdfNum = `EDF-CSV-${String(autoCounter).padStart(3, '0')}`;
          autoCounter++;
        }

        const requester = findValue(row, ['requestername', 'requester', 'requestedby', 'name', 'user']) || 'Admin';
        const category = findValue(row, ['category', 'team', 'department', 'dept']) || 'General';
        const issueDateRaw = findValue(row, ['issuedate', 'requestdate', 'issued', 'requested', 'date']);
        const requiredDateRaw = findValue(row, ['requireddate', 'duedate', 'deadline', 'deliverydate', 'required']);
        const statusRaw = findValue(row, ['status', 'edfstatus', 'state']);
        const progressRaw = findValue(row, ['itemreceivingstatus', 'receivingstatus', 'itemstatus', 'receivingprogress', 'progress']);
        const remarks = findValue(row, [
          'justification',
          'justifications',
          'requirementsfor',
          'requirementfor',
          'requiredfor',
          'reason',
          'purpose',
          'remarks',
          'notes',
          'comments',
          'remark',
          'note',
        ]);
        const materialSummary = findValue(row, ['itemdescription', 'materialdetails', 'materialsummary', 'materiallist', 'item', 'material', 'description', 'materials']);
        const quantityRaw = findValue(row, ['quantity', 'qty', 'count', 'amount']);
        const unitRaw = findValue(row, ['unit', 'uom', 'measurement']);

        const parsedIssueDate = parseDateToISO(issueDateRaw, new Date());
        const parsedRequiredDate = parseDateToISO(requiredDateRaw, new Date(Date.now() + 3 * 86400000));

        const isOverdue = new Date(parsedRequiredDate).getTime() < Date.now();
        let calculatedStatus = statusRaw || (isOverdue ? 'Overdue' : 'Pending');
        if (calculatedStatus === 'Completed') calculatedStatus = 'Received';
        if (!['Pending', 'Partially Received', 'Received', 'Overdue'].includes(calculatedStatus)) {
          calculatedStatus = isOverdue ? 'Overdue' : 'Pending';
        }

        // Check if EDF Number already exists in the system
        const existingMatch = existingEdfs?.find(
          (e) => e.edfNumber.trim().toLowerCase() === rawEdfNum.trim().toLowerCase()
        );

        if (!edfMap.has(rawEdfNum)) {
          edfMap.set(rawEdfNum, {
            edfNumber: rawEdfNum,
            requesterName: requester,
            category,
            issueDate: parsedIssueDate,
            requiredDate: parsedRequiredDate,
            status: calculatedStatus,
            remarks: remarks || '',
            items: [],
            isExisting: Boolean(existingMatch),
          });
        }

        const edfRecord = edfMap.get(rawEdfNum)!;

        // Check if item was received
        const normProg = progressRaw.toLowerCase();
        const isItemReceived =
          (normProg.includes('received') && !normProg.startsWith('0/')) ||
          normProg === 'yes' ||
          normProg === 'done' ||
          normProg === 'complete' ||
          normProg === 'completed';

        // Check if materialSummary has multiple items in "Item Description (10 pcs), Item 2 (5 unit)" format
        const itemMatches = [...materialSummary.matchAll(/(.+?)\s*\((\d+(?:\.\d+)?)\s*([a-zA-Z]+)\)/g)];

        if (itemMatches.length > 0) {
          for (const m of itemMatches) {
            const itemDesc = m[1].replace(/^[,\s]+/, '').trim();
            const itemQty = parseFloat(m[2]) || 1;
            const itemUnit = m[3].trim();

            edfRecord.items.push({
              itemDescription: itemDesc,
              quantity: itemQty,
              unit: itemUnit,
              status: isItemReceived ? 'Received' : 'Pending',
              remarks: remarks || '',
              justification: remarks || '',
            });
          }
        } else if (materialSummary) {
          const qty = parseFloat(quantityRaw) || 1;
          const unit = unitRaw || 'pcs';

          edfRecord.items.push({
            itemDescription: materialSummary,
            quantity: qty,
            unit: unit,
            status: isItemReceived ? 'Received' : 'Pending',
            remarks: remarks || '',
            justification: remarks || '',
          });
        }
      }

      // Ensure each EDF has at least one material row
      for (const record of edfMap.values()) {
        if (record.items.length === 0) {
          record.items.push({
            itemDescription: 'General Material Request',
            quantity: 1,
            unit: 'pcs',
            status: 'Pending',
          });
        }
      }

      const recordsArray = Array.from(edfMap.values());
      if (recordsArray.length === 0) {
        setFileError('Could not extract any valid EDF records from this CSV file.');
        return;
      }

      setExtractedCSVRecords(recordsArray);
      setCsvStep('review');
      setCsvFileName(fileName);
    } catch (err: any) {
      setFileError(`Failed to parse CSV file: ${err.message || 'Unknown error'}`);
    }
  };

  // CSV file input handler
  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Invalid file type. Please upload a valid CSV file (.csv).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (!text || typeof text !== 'string') {
          setFileError('Failed to read CSV file content.');
          return;
        }
        processCSVData(text, file.name);
      } catch (err: any) {
        setFileError(`CSV reading error: ${err.message || 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // CSV text paste handler
  const handleCSVPasteParse = () => {
    if (!csvPasteText.trim()) {
      setFileError('Please paste your CSV text content first.');
      return;
    }
    processCSVData(csvPasteText, 'Pasted_CSV_Data.csv');
  };

  // Batch Submit for CSV Import
  const handleBatchSubmit = async () => {
    setIsBatchImporting(true);
    setFileError(null);
    try {
      const res = await fetch('/api/edfs/batch-import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
        },
        body: JSON.stringify({ records: extractedCSVRecords }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import CSV records');
      }

      setImportSuccessMessage(
        `Import Complete: ${data.totalProcessed} EDF records processed (${data.createdCount} created, ${data.updatedCount} updated/restored) with ${data.totalItemsImported} individual material rows preserved!`
      );

      if (onImportSuccess) {
        setTimeout(() => {
          onImportSuccess();
        }, 1600);
      }
    } catch (err: any) {
      setFileError(err.message || 'Failed to submit CSV records');
    } finally {
      setIsBatchImporting(false);
    }
  };

  // Item modification in Table/Excel mode
  const handleItemChange = (index: number, field: keyof EDFItem, value: any) => {
    setExtractedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setExtractedItems((prev) => [
      ...prev,
      { itemDescription: '', quantity: 1, unit: 'pcs', status: 'Pending' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (extractedItems.length <= 1) return;
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Execute single EDF submission
  const executeSubmitEDF = async (finalNumber?: string) => {
    const targetEdfNumber = (finalNumber || edfNumber).trim();
    const validItems = extractedItems.filter((i) => i.itemDescription && i.itemDescription.trim());

    setIsSaving(true);
    setValidationErrors({});

    const summary = validItems
      .map((i) => `${i.itemDescription} (${i.quantity} ${i.unit})`)
      .slice(0, 3)
      .join(', ') + (validItems.length > 3 ? ` + ${validItems.length - 3} more` : '');
    const totalQty = validItems.reduce((acc, i) => acc + (i.quantity || 1), 0);

    const issIso = new Date(issueDate).toISOString();
    const reqIso = new Date(requiredDate).toISOString();

    const payload = {
      edfNumber: targetEdfNumber,
      requesterName: requesterName.trim(),
      category: selectedCategory.trim(),
      issueDate: issIso,
      requiredDate: reqIso,
      materialList: summary,
      quantity: totalQty,
      unit: validItems[0]?.unit || 'pcs',
      // If justification was blank, leave remarks & notes blank (never insert "Imported from Excel")
      remarks: remarks.trim() || null,
      items: validItems.map((i) => ({
        itemDescription: i.itemDescription.trim(),
        quantity: i.quantity || 1,
        unit: i.unit.trim() || 'pcs',
        status: 'Pending',
        remarks: i.remarks?.trim() || i.justification?.trim() || null,
        justification: i.justification?.trim() || i.remarks?.trim() || null,
      })),
    };

    const success = await onSaveEDF(payload);
    setIsSaving(false);
    setShowNumberConfirmModal(false);
    setShowDuplicateModal(false);

    if (success) {
      if (onImportSuccess) {
        onImportSuccess();
      }
    }
  };

  // Create single EDF in Table/Excel mode with duplicate prevention & missing number confirmation
  const handleCreateEDF = async () => {
    const errors: Record<string, string> = {};

    if (!edfNumber.trim()) errors.edfNumber = 'EDF Number is required';
    if (!selectedCategory.trim()) errors.category = 'Category is required';
    if (!requesterName.trim()) errors.requesterName = 'Requester Name is required';
    if (!issueDate) errors.issueDate = 'Request / Issue Date is required';
    if (!requiredDate) errors.requiredDate = 'Required Date is required';

    const validItems = extractedItems.filter((i) => i.itemDescription && i.itemDescription.trim());
    if (validItems.length === 0) {
      errors.items = 'At least one valid material row is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    // 1. DUPLICATE SAFETY CHECK: Prevent accidental duplicate EDFs or overwriting existing records
    if (duplicateExistingEdf) {
      setShowDuplicateModal(true);
      return;
    }

    // 2. AMBIGUOUS OR MISSING NUMBER CONFIRMATION: Ask for confirmation before submission
    if (!isNumberConfirmed && (edfDetectionSource === 'missing' || edfDetectionSource === 'ambiguous')) {
      setShowNumberConfirmModal(true);
      return;
    }

    await executeSubmitEDF();
  };

  // Filtered CSV records for review screen
  const filteredCSVRecords = useMemo(() => {
    if (!csvSearchQuery.trim()) return extractedCSVRecords;
    const q = csvSearchQuery.toLowerCase().trim();
    return extractedCSVRecords.filter((rec) => {
      const matchEdf = rec.edfNumber.toLowerCase().includes(q);
      const matchReq = rec.requesterName.toLowerCase().includes(q);
      const matchCat = rec.category.toLowerCase().includes(q);
      const matchRemarks = rec.remarks.toLowerCase().includes(q);
      const matchItems = rec.items.some((i) => i.itemDescription.toLowerCase().includes(q));
      return matchEdf || matchReq || matchCat || matchRemarks || matchItems;
    });
  }, [extractedCSVRecords, csvSearchQuery]);

  const totalCSVMDocs = extractedCSVRecords.length;
  const totalCSVItems = extractedCSVRecords.reduce((acc, r) => acc + r.items.length, 0);
  const totalCSVExisting = extractedCSVRecords.filter((r) => r.isExisting).length;
  const totalCSVNew = totalCSVMDocs - totalCSVExisting;

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Import Excel and CSV
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste tables, upload Excel spreadsheets (.xlsx, .xls), or import/recover EDF records and material rows from CSV.
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 self-start sm:self-auto cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* Notifications / Errors */}
      {fileError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{fileError}</span>
        </div>
      )}

      {importSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span>{importSuccessMessage}</span>
        </div>
      )}

      {/* Mode Switch Tabs: Import Table, Import Excel, Import CSV */}
      <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1">
        <button
          onClick={() => {
            setActiveMode('table');
            setStep('input');
            setFileError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
            activeMode === 'table'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Import Table</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('excel');
            setStep('input');
            setFileError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
            activeMode === 'excel'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Import Excel</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('csv');
            setFileError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
            activeMode === 'csv'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileUp className="w-4 h-4" />
          <span>Import CSV</span>
        </button>
      </div>

      {/* CSV IMPORT MODE (Prompt 9 Requirements) */}
      {activeMode === 'csv' ? (
        csvStep === 'upload' ? (
          /* CSV UPLOAD & EXTRACT INTERFACE */
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  CSV Data Upload & Recovery
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload a previously exported CSV file. The system will read, extract, and display all records for your review before saving.
              </p>
            </div>

            {/* Drag & Drop File Input */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-3xl p-8 sm:p-10 text-center transition-all bg-slate-50/50 dark:bg-slate-950/30">
              <input
                type="file"
                id="csv-file-input"
                accept=".csv, text/csv, application/csv"
                onChange={handleCSVFileUpload}
                className="hidden"
              />
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Click to browse or drop your CSV file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports standard EDF CSV exports and tabular CSV spreadsheets.
                  </p>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Individual material rows are preserved separately. Existing records are updated safely.</span>
                </div>
              </label>
            </div>

            {/* Direct CSV Text Paste Area */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Or paste CSV raw content directly
                </label>
                <span className="text-[11px] text-slate-400">Comma-separated values</span>
              </div>
              <textarea
                rows={5}
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                placeholder={`"EDF Number","Requester Name","Category","Issue Date","Required Date","Status","Receiving Progress","Material Summary","Quantity","Unit","Remarks"\n"EDF-2026-001","Imran","Electrical","10/1/2026","10/5/2026","Pending","0/2 Received","Copper Cable 16mm (10 Meter), Circuit Breaker 32A (5 Piece)","15","pcs","Urgent"`}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCSVPasteParse}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  Extract CSV Data
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CSV REVIEW & PREVIEW SCREEN (Requirement 5) */
          <div className="space-y-6">
            {/* Summary Statistics Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Review Extracted CSV Records
                    </h3>
                    <p className="text-xs text-slate-400">
                      File: <strong className="text-slate-600 dark:text-slate-300">{csvFileName || 'CSV Upload'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCsvStep('upload');
                      setExtractedCSVRecords([]);
                      setFileError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Upload Different File
                  </button>
                </div>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">
                    Total EDF Records
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-200">
                    {totalCSVMDocs}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
                    Material Rows
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-200">
                    {totalCSVItems}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block">
                    New Records to Create
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-200">
                    {totalCSVNew}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                    Existing to Update/Restore
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200">
                    {totalCSVExisting}
                  </span>
                </div>
              </div>

              {/* Data Safety Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Data Safety Guaranteed:</strong> Existing records are matched by <strong>EDF Number</strong>. No records or material rows will be deleted. Missing information will be restored and safe merges will be applied.
                </div>
              </div>

              {/* Search filter for review */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={csvSearchQuery}
                  onChange={(e) => setCsvSearchQuery(e.target.value)}
                  placeholder="Filter extracted records by EDF number, requester, category, or material..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* List of Extracted Records */}
            <div className="space-y-4">
              {filteredCSVRecords.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No records match your search filter.
                </div>
              ) : (
                filteredCSVRecords.map((record, rIdx) => {
                  const catTheme = getCategoryTheme(record.category);
                  return (
                    <div
                      key={record.edfNumber + '-' + rIdx}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                    >
                      {/* Record Top Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                            {record.edfNumber}
                          </span>

                          {record.isExisting ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Existing &bull; Will Update / Restore
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              New Record &bull; Will Create
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(record.category)}`}>
                            {record.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{record.requesterName}</span>
                          </div>
                          <span>&bull;</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Due: {new Date(record.requiredDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Remarks if available */}
                      {record.remarks && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Remarks: "{record.remarks}"
                        </p>
                      )}

                      {/* Individual Material Rows Table (Requirement 4 & 6) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            Preserved Material Items ({record.items.length})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Rows preserved separately
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                              <tr>
                                <th className="py-2 px-3 w-10">#</th>
                                <th className="py-2 px-3">Item Description / Material</th>
                                <th className="py-2 px-3 w-24">Quantity</th>
                                <th className="py-2 px-3 w-24">Unit</th>
                                <th className="py-2 px-3 w-28">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                              {record.items.map((item, iIdx) => (
                                <tr key={iIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{iIdx + 1}</td>
                                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                    {item.itemDescription}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold">{item.quantity}</td>
                                  <td className="py-2 px-3 text-slate-500">{item.unit}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        item.status === 'Received'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                      }`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setCsvStep('upload');
                  setExtractedCSVRecords([]);
                  setFileError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer order-2 sm:order-1"
              >
                Back to Upload
              </button>

              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isBatchImporting || extractedCSVRecords.length === 0}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer order-1 sm:order-2"
              >
                {isBatchImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing & Restoring Records...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit / Import ({totalCSVMDocs} EDF Records, {totalCSVItems} Materials)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )
      ) : (
        /* TABLE OR EXCEL SINGLE EDF IMPORT MODE */
        step === 'input' ? (
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            {activeMode === 'table' ? (
              /* Direct Table Paste Area */
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Paste rows directly from your Excel Sheet
                    </label>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      Ctrl+V / Command+V Supported
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder={`Material / Description\tUnit\tQuantity\nCopper Cable 16mm\tMeter\t10\nCircuit Breaker 32A\tPiece\t5\nInsulation PVC Tape\tRoll\t3`}
                    className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-400">
                    <p>
                      <strong>Workflow:</strong> 1. Copy cells in Excel (Material, Unit, Quantity) &rarr; 2. Paste here &rarr; 3. Click Extract Data &rarr; 4. Enter Mandatory Info &rarr; 5. Submit.
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Individual rows are strictly preserved and never merged.
                    </p>
                  </div>
                  <button
                    onClick={handlePasteParse}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
                  >
                    Extract Data
                  </button>
                </div>
              </div>
            ) : (
              /* Excel File Upload Dropzone */
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-3xl p-8 sm:p-10 text-center transition-all bg-slate-50/50 dark:bg-slate-950/30">
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleExcelFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Click to browse or drop your Excel file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports Microsoft Excel (.xlsx) and Excel 97-2003 (.xls) only.
                    </p>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold border border-indigo-200 dark:border-indigo-800">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>PDF, Word and other formats are automatically ignored</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: Review extracted items & enter Mandatory EDF-level details */
          <div className="space-y-6">
            {/* 1. AUTOMATIC EDF/PDF NUMBER DETECTION STATUS BANNER */}
            {edfDetectionSource === 'detected' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Auto-detected number <strong>&quot;{edfNumber}&quot;</strong> from heading{' '}
                    <strong>&quot;{detectedColumnHeading}&quot;</strong>.
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  Detected from Table
                </span>
              </div>
            )}

            {edfDetectionSource === 'ambiguous' && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-extrabold">
                      Multiple PDF/EDF numbers detected in table rows. Please confirm the number to use:
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    Confirmation Required
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ambiguousNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setEdfNumber(num);
                        setIsNumberConfirmed(true);
                        setValidationErrors((prev) => ({ ...prev, edfNumber: '' }));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        edfNumber === num
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {num} {edfNumber === num && '✓ Active'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {edfDetectionSource === 'missing' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    No explicit PDF/EDF number was detected under headings like <em>&quot;PDF Number&quot;</em> or <em>&quot;EDF No.&quot;</em>. Assigned sequential number <strong>&quot;{edfNumber}&quot;</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNumberConfirmed(true)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer self-start sm:self-auto shrink-0 ${
                    isNumberConfirmed
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                  }`}
                >
                  {isNumberConfirmed ? '✓ Number Confirmed' : 'Confirm this Number'}
                </button>
              </div>
            )}

            {/* 2. PREVENT ACCIDENTAL DUPLICATES OR OVERWRITING EXISTING RECORDS */}
            {duplicateExistingEdf && (
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-3 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-sm block">
                      Duplicate EDF Number Warning: &quot;{edfNumber}&quot; Already Exists!
                    </span>
                    <p className="mt-1 text-rose-700 dark:text-rose-300 leading-relaxed">
                      An existing Demand Form with this number was created for{' '}
                      <strong>{duplicateExistingEdf.requesterName}</strong> ({duplicateExistingEdf.category}) with current status{' '}
                      <strong>{duplicateExistingEdf.status}</strong>.
                      To protect existing records from being overwritten or duplicated accidentally, please use a unique number.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200 dark:border-rose-800">
                  <button
                    type="button"
                    onClick={handleAssignNextUniqueNumber}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Assign Next Unique Number</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAppendSuffix}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-100 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 font-bold text-xs cursor-pointer transition-all"
                  >
                    Append Suffix (-1)
                  </button>
                </div>
              </div>
            )}

            {/* MANDATORY EDF-LEVEL INFORMATION CARD */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      Mandatory EDF Information
                    </h3>
                    <p className="text-xs text-slate-400">
                      All marked fields (*) are strictly required before the Demand Form can be submitted.
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Required Step
                </span>
              </div>

              {/* Category Selection Grid with domain colors */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  1. Team / Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-sm ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                          TEAM
                        </span>
                        <span
                          className={`text-xs font-extrabold truncate mt-0.5 ${
                            isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {validationErrors.category && (
                  <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.category}</p>
                )}
              </div>

              {/* Form Fields: EDF Number, Requester, Issue Date, Required Date, Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* EDF Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span>2. EDF Number</span> <span className="text-rose-500">*</span>
                    </label>
                    {edfDetectionSource === 'detected' && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Auto-detected
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={edfNumber}
                    onChange={(e) => {
                      setEdfNumber(e.target.value);
                      setIsNumberConfirmed(true);
                      if (validationErrors.edfNumber) {
                        setValidationErrors((prev) => ({ ...prev, edfNumber: '' }));
                      }
                    }}
                    placeholder="e.g. EDF-2026-001 or 1042"
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-bold focus:outline-none focus:ring-2 ${
                      duplicateExistingEdf
                        ? 'border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                    }`}
                  />
                  {validationErrors.edfNumber && (
                    <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.edfNumber}</p>
                  )}
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    {duplicateExistingEdf ? (
                      <span className="text-rose-600 font-bold">Duplicate record detected</span>
                    ) : (
                      <span className="text-slate-400">
                        {detectedColumnHeading ? `From: ${detectedColumnHeading}` : 'Unique identifier'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleAssignNextUniqueNumber}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      New Number
                    </button>
                  </div>
                </div>

                {/* Requester Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>3. Requester Name</span> <span className="text-rose-500">*</span>
                  </label>
                  <RequesterDropdown
                    value={requesterName}
                    category={selectedCategory}
                    onChange={(val) => {
                      setRequesterName(val);
                      if (validationErrors.requesterName) {
                        setValidationErrors((prev) => ({ ...prev, requesterName: '' }));
                      }
                    }}
                    placeholder="Select requester name..."
                  />
                  {validationErrors.requesterName && (
                    <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.requesterName}</p>
                  )}
                </div>

                {/* Issue Date */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>4. Request / Issue Date</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {validationErrors.issueDate && (
                    <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.issueDate}</p>
                  )}
                </div>

                {/* Required Date */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    <span>5. Required Date</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {validationErrors.requiredDate && (
                    <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.requiredDate}</p>
                  )}
                </div>

                {/* Remarks & Notes (Never insert "Imported from Excel") */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Remarks & Notes</span>
                      {remarks && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          (Extracted from Justification / Requirements For)
                        </span>
                      )}
                    </label>
                    {remarks && (
                      <button
                        type="button"
                        onClick={() => setRemarks('')}
                        className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold cursor-pointer"
                      >
                        Clear Remarks
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Leave blank if no justification or remarks required..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Exact text from columns like <em>Justification</em> or <em>Requirements For</em> is saved here. If blank in your sheet, this field remains blank.
                  </p>
                </div>
              </div>
            </div>

            {/* EXTRACTED MATERIAL ITEMS PREVIEW - PRESERVE EACH MATERIAL ROW */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Preserved Material Rows</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {extractedItems.length} items
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Every row from your sheet is preserved separately with its individual description, unit, quantity, and row justification.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Material</span>
                </button>
              </div>

              {/* Column Header Guide */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Item Description / Material</span>
                <span className="col-span-3">Row Justification / Requirements For</span>
                <span className="col-span-2">Unit</span>
                <span className="col-span-1">Quantity</span>
                <span className="col-span-1 text-right">Action</span>
              </div>

              {/* Items List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col lg:grid lg:grid-cols-12 gap-3 items-stretch lg:items-center"
                  >
                    <span className="lg:col-span-1 text-xs font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </span>

                    {/* Description */}
                    <div className="lg:col-span-4 min-w-0">
                      <label className="block lg:hidden text-[10px] font-bold text-slate-400 mb-1">
                        Item Description / Material
                      </label>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        placeholder="Material Description"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                      />
                    </div>

                    {/* Row Justification / Requirements For */}
                    <div className="lg:col-span-3 min-w-0">
                      <label className="block lg:hidden text-[10px] font-bold text-slate-400 mb-1">
                        Justification / Requirements For
                      </label>
                      <input
                        type="text"
                        value={item.justification || item.remarks || ''}
                        onChange={(e) => {
                          handleItemChange(idx, 'justification', e.target.value);
                          handleItemChange(idx, 'remarks', e.target.value);
                        }}
                        placeholder="Row justification (optional)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                      />
                    </div>

                    {/* Unit */}
                    <div className="lg:col-span-2">
                      <label className="block lg:hidden text-[10px] font-bold text-slate-400 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        placeholder="Unit"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="lg:col-span-1">
                      <label className="block lg:hidden text-[10px] font-bold text-slate-400 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-bold"
                      />
                    </div>

                    {/* Delete row */}
                    <div className="lg:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={extractedItems.length <= 1}
                        className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer order-2 sm:order-1"
                >
                  Back to Import Source
                </button>

                <button
                  type="button"
                  onClick={handleCreateEDF}
                  disabled={isSaving}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer order-1 sm:order-2 ${
                    duplicateExistingEdf
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 disabled:opacity-50'
                  }`}
                >
                  {isSaving ? (
                    <span>Saving Demand Form...</span>
                  ) : duplicateExistingEdf ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Resolve Duplicate Number</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit EDF ({extractedItems.length} Materials)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* CONFIRMATION MODAL: MISSING OR AMBIGUOUS EDF/PDF NUMBER */}
      {showNumberConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Confirm EDF Number
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {edfDetectionSource === 'missing'
                    ? 'No explicit PDF Number or EDF No. was found in your pasted data.'
                    : `Multiple candidate numbers were detected (${ambiguousNumbers.join(', ')}).`}
                </p>
                <div className="mt-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">Selected EDF Number:</span>
                  <span className="font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                    {edfNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Do you want to submit with this EDF Number or edit it first?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNumberConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Edit Number
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNumberConfirmed(true);
                  executeSubmitEDF(edfNumber);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm &amp; Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERWRITE SAFETY MODAL: DUPLICATE EDF NUMBER PREVENTION */}
      {showDuplicateModal && duplicateExistingEdf && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-rose-900 dark:text-rose-200">
                  Prevent Accidental Overwrite
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  An EDF with number <strong className="font-mono text-slate-900 dark:text-white">&quot;{edfNumber}&quot;</strong> already exists in the system:
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Requester:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{duplicateExistingEdf.requesterName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Team:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{duplicateExistingEdf.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{duplicateExistingEdf.status}</span>
                  </div>
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-2">
                  To protect existing data from accidental overwriting, please choose a unique number.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleAssignNextUniqueNumber}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Assign Next Sequential Number</span>
              </button>
              <button
                type="button"
                onClick={handleAppendSuffix}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Append Suffix (-1)
              </button>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-full px-4 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel &amp; Edit Manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
