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
  const [remarks, setRemarks] = useState<string>('Imported from Excel table');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
          setEdfNumber(data.nextEdfNumber);
        } else {
          setEdfNumber(`EDF-${new Date().getFullYear()}-001`);
        }
      })
      .catch(() => {
        setEdfNumber(`EDF-${new Date().getFullYear()}-001`);
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

  // Helper to extract items from 2D array and preserve individual rows for Table/Excel mode
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

    let headerRowIdx = -1;
    let descColIdx = 0;
    let unitColIdx = 1;
    let qtyColIdx = 2;

    for (let i = 0; i < Math.min(cleanedRows.length, 5); i++) {
      const row = cleanedRows[i].map((cell) => String(cell || '').toLowerCase().trim());
      const hasDesc = row.some(
        (c) => c.includes('desc') || c.includes('item') || c.includes('material') || c.includes('name')
      );
      const hasQty = row.some(
        (c) => c.includes('qty') || c.includes('quant') || c.includes('count') || c.includes('total')
      );

      if (hasDesc && hasQty) {
        headerRowIdx = i;
        row.forEach((cell, idx) => {
          if (cell.includes('desc') || cell.includes('item') || cell.includes('material') || cell.includes('name')) {
            descColIdx = idx;
          } else if (cell.includes('unit') || cell.includes('uom') || cell.includes('measur')) {
            unitColIdx = idx;
          } else if (cell.includes('qty') || cell.includes('quant') || cell.includes('count') || cell.includes('total')) {
            qtyColIdx = idx;
          }
        });
        break;
      }
    }

    const dataRows = headerRowIdx >= 0 ? cleanedRows.slice(headerRowIdx + 1) : cleanedRows;
    const items: EDFItem[] = [];

    dataRows.forEach((row) => {
      let desc = '';
      let unit = 'pcs';
      let qty = 1;

      if (row.length === 1) {
        desc = String(row[0] || '').trim();
      } else {
        desc = String(row[descColIdx] || '').trim();
        if (row[unitColIdx] !== undefined) {
          const rawUnit = String(row[unitColIdx] || '').trim();
          if (rawUnit) unit = rawUnit;
        }
        if (row[qtyColIdx] !== undefined) {
          const rawQty = parseFloat(String(row[qtyColIdx] || '').replace(/[^0-9.]/g, ''));
          if (!isNaN(rawQty) && rawQty > 0) {
            qty = Math.round(rawQty);
          }
        }
      }

      if (desc) {
        items.push({
          itemDescription: desc,
          quantity: qty,
          unit: unit,
          status: 'Pending',
        });
      }
    });

    if (items.length === 0) {
      setFileError('Could not find any material rows. Please verify your data.');
      return;
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

      // Helper to find column value by multiple possible header names
      const findValue = (row: Record<string, any>, candidateKeys: string[]): string => {
        for (const cand of candidateKeys) {
          for (const key of Object.keys(row)) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normKey === normCand || normKey.includes(normCand)) {
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

        let rawEdfNum = findValue(row, ['edfnumber', 'edf#', 'edf', 'edfid', 'demandform#', 'form#', 'number', 'ref']);
        if (!rawEdfNum) {
          rawEdfNum = `EDF-CSV-${String(autoCounter).padStart(3, '0')}`;
          autoCounter++;
        }

        const requester = findValue(row, ['requestername', 'requester', 'requestedby', 'name', 'user']) || 'Admin';
        const category = findValue(row, ['category', 'team', 'department', 'dept']) || 'General';
        const issueDateRaw = findValue(row, ['issuedate', 'requestdate', 'issued', 'requested', 'date']);
        const requiredDateRaw = findValue(row, ['requireddate', 'duedate', 'deadline', 'deliverydate', 'required']);
        const statusRaw = findValue(row, ['status', 'edfstatus', 'state']);
        const progressRaw = findValue(row, ['receivingprogress', 'progress', 'itemstatus', 'itemreceivingstatus', 'receivingstatus']);
        const remarks = findValue(row, ['remarks', 'notes', 'comments', 'remark', 'note']);
        const materialSummary = findValue(row, ['materialsummary', 'materialdetails', 'materiallist', 'itemdescription', 'item', 'material', 'description', 'materials']);
        const quantityRaw = findValue(row, ['quantity', 'qty', 'count', 'amount']);
        const unitRaw = findValue(row, ['unit', 'uom', 'measurement']);

        const parsedIssueDate = parseDateToISO(issueDateRaw, new Date());
        const parsedRequiredDate = parseDateToISO(requiredDateRaw, new Date(Date.now() + 3 * 86400000));

        const isOverdue = new Date(parsedRequiredDate).getTime() < Date.now();
        let calculatedStatus = statusRaw || (isOverdue ? 'Overdue' : 'Pending');
        if (!['Pending', 'Received', 'Completed', 'Overdue'].includes(calculatedStatus)) {
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

        // Check if materialSummary has multiple items in "Item Description (10 pcs), Item 2 (5 unit)" format
        const itemMatches = [...materialSummary.matchAll(/(.+?)\s*\((\d+(?:\.\d+)?)\s*([a-zA-Z]+)\)/g)];

        if (itemMatches.length > 0) {
          for (const m of itemMatches) {
            const itemDesc = m[1].replace(/^[,\s]+/, '').trim();
            const itemQty = parseFloat(m[2]) || 1;
            const itemUnit = m[3].trim();
            const isItemReceived = progressRaw.toLowerCase().includes('received') && !progressRaw.startsWith('0/');

            edfRecord.items.push({
              itemDescription: itemDesc,
              quantity: itemQty,
              unit: itemUnit,
              status: isItemReceived ? 'Received' : 'Pending',
            });
          }
        } else if (materialSummary) {
          const qty = parseFloat(quantityRaw) || 1;
          const unit = unitRaw || 'pcs';
          const isItemReceived = progressRaw.toLowerCase().includes('received') && !progressRaw.startsWith('0/');

          edfRecord.items.push({
            itemDescription: materialSummary,
            quantity: qty,
            unit: unit,
            status: isItemReceived ? 'Received' : 'Pending',
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

  // Create single EDF in Table/Excel mode
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
    setIsSaving(true);

    const summary = validItems
      .map((i) => `${i.itemDescription} (${i.quantity} ${i.unit})`)
      .slice(0, 3)
      .join(', ') + (validItems.length > 3 ? ` + ${validItems.length - 3} more` : '');
    const totalQty = validItems.reduce((acc, i) => acc + (i.quantity || 1), 0);

    const issIso = new Date(issueDate).toISOString();
    const reqIso = new Date(requiredDate).toISOString();

    const payload = {
      edfNumber: edfNumber.trim(),
      requesterName: requesterName.trim(),
      category: selectedCategory.trim(),
      issueDate: issIso,
      requiredDate: reqIso,
      materialList: summary,
      quantity: totalQty,
      unit: validItems[0]?.unit || 'pcs',
      remarks: remarks.trim() || null,
      items: validItems.map((i) => ({
        itemDescription: i.itemDescription.trim(),
        quantity: i.quantity || 1,
        unit: i.unit.trim() || 'pcs',
        status: 'Pending',
      })),
    };

    const success = await onSaveEDF(payload);
    setIsSaving(false);

    if (success) {
      fetch('/api/activity-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
        },
        body: JSON.stringify({
          action: `${payload.edfNumber} Imported from Excel`,
          edfNumber: payload.edfNumber,
        }),
      }).catch(console.error);
    }
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
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>2. EDF Number</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={edfNumber}
                    onChange={(e) => setEdfNumber(e.target.value)}
                    placeholder="e.g. EDF-2026-001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {validationErrors.edfNumber && (
                    <p className="text-[11px] text-rose-500 mt-1 font-semibold">{validationErrors.edfNumber}</p>
                  )}
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
                    onChange={(val) => setRequesterName(val)}
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

                {/* Remarks - Spans full width */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span>Remarks & Notes</span>
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any coordinator remarks or delivery instructions..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* EXTRACTED MATERIAL ITEMS PREVIEW */}
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
                    Each row from your sheet is stored individually for exact partial item receiving.
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

              {/* Items List */}
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                  >
                    <span className="text-xs font-mono font-bold text-slate-400 w-6 shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        placeholder="Material Description"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                      <div className="w-24">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="Unit"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                      <div className="w-20">
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
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={extractedItems.length <= 1}
                      className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer self-end sm:self-auto"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer order-1 sm:order-2"
                >
                  {isSaving ? (
                    <span>Saving Demand Form...</span>
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
    </div>
  );
};
