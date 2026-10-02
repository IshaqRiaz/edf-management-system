import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Category, EDFItem, EDFPriority } from '../types.ts';
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
  ArrowRight,
  Sparkles,
  Layers,
  Calendar,
  User,
  Hash,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface ExcelImportProps {
  categories: Category[];
  onSaveEDF: (edfData: any) => Promise<boolean>;
  onCancel: () => void;
}

export const ExcelImport: React.FC<ExcelImportProps> = ({
  categories,
  onSaveEDF,
  onCancel,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('paste'); // Default to direct paste as requested
  const [fileError, setFileError] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState('');
  const [extractedItems, setExtractedItems] = useState<EDFItem[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');

  // Mandatory Form fields for final EDF creation
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
  const [priority, setPriority] = useState<EDFPriority>('Medium');
  const [remarks, setRemarks] = useState<string>('Imported from Excel table');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch next available sequential EDF Number from server
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

  // File upload parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setFileError(
        'Invalid file type. Only Excel (.xlsx and .xls) files are supported. PDF, Word, and other files are strictly ignored.'
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

  // Helper to extract items from 2D array and preserve individual rows
  const parseRawRows = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      setFileError('No data found in the spreadsheet or pasted text.');
      return;
    }

    // Filter out completely empty rows
    const cleanedRows = rows.filter((r) => r && r.some((c) => String(c || '').trim() !== ''));
    if (cleanedRows.length === 0) {
      setFileError('No non-empty rows found. Please copy and paste valid Excel rows.');
      return;
    }

    // Try to detect header row
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
      const hasUnit = row.some((c) => c.includes('unit') || c.includes('uom'));

      if (hasDesc || hasQty) {
        headerRowIdx = i;
        row.forEach((col, idx) => {
          if (col.includes('desc') || col.includes('item') || col.includes('material') || col.includes('name')) {
            descColIdx = idx;
          }
          if (col.includes('unit') || col.includes('uom')) {
            unitColIdx = idx;
          }
          if (col.includes('qty') || col.includes('quant') || col.includes('count')) {
            qtyColIdx = idx;
          }
        });
        break;
      }
    }

    // If no header found, inspect the first data row to determine if column 1 or column 2 is quantity
    if (headerRowIdx === -1) {
      const firstRow = cleanedRows[0];
      if (firstRow && firstRow.length >= 3) {
        const val1 = String(firstRow[1] || '').trim();
        const val2 = String(firstRow[2] || '').trim();
        const val1IsNum = /^\d+$/.test(val1);
        const val2IsNum = /^\d+$/.test(val2);

        if (val1IsNum && !val2IsNum) {
          // Material -> Quantity -> Unit
          descColIdx = 0;
          qtyColIdx = 1;
          unitColIdx = 2;
        } else if (!val1IsNum && val2IsNum) {
          // Material -> Unit -> Quantity
          descColIdx = 0;
          unitColIdx = 1;
          qtyColIdx = 2;
        }
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    const extracted: EDFItem[] = [];

    for (let r = startRow; r < cleanedRows.length; r++) {
      const row = cleanedRows[r];
      if (!row || row.length === 0) continue;

      const desc = String(row[descColIdx] || '').trim();
      if (!desc) continue;

      let qty = parseInt(String(row[qtyColIdx] || '1').replace(/[^0-9]/g, ''), 10);
      if (isNaN(qty) || qty <= 0) qty = 1;

      const unit = String(row[unitColIdx] || 'pcs').trim() || 'pcs';

      // Preserve each row individually
      extracted.push({
        itemDescription: desc,
        unit,
        quantity: qty,
      });
    }

    if (extracted.length === 0) {
      setFileError('Could not automatically extract material rows. Please verify your pasted table format.');
      return;
    }

    setExtractedItems(extracted);
    setValidationErrors({});
    setStep('review');
  };

  // Editable items state mutations
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
      { itemDescription: '', unit: 'pcs', quantity: 1 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (extractedItems.length <= 1) {
      alert('At least one material row must be kept in the Demand Form.');
      return;
    }
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation function for mandatory EDF details before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!edfNumber.trim()) {
      errors.edfNumber = 'EDF Number is mandatory';
    }

    if (!requesterName.trim()) {
      errors.requesterName = 'Requester Name is mandatory';
    }

    if (!issueDate.trim()) {
      errors.issueDate = 'Request / Issue Date is mandatory';
    }

    if (!requiredDate.trim()) {
      errors.requiredDate = 'Required Date is mandatory';
    }

    if (!selectedCategory.trim()) {
      errors.category = 'Category selection is mandatory';
    }

    const validItems = extractedItems.filter(
      (item) => item.itemDescription && item.itemDescription.trim()
    );
    if (validItems.length === 0) {
      errors.items = 'At least one material item with a valid description is mandatory';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Final submit handler
  const handleCreateEDF = async () => {
    if (!validateForm()) {
      return;
    }

    const validItems = extractedItems.filter(
      (item) => item.itemDescription && item.itemDescription.trim()
    );

    setIsSaving(true);

    // Summary representation for list display, while preserving every single row in items array
    const summary = validItems
      .map((item) => `${item.itemDescription} (${item.quantity} ${item.unit})`)
      .slice(0, 3)
      .join(', ') + (validItems.length > 3 ? ` + ${validItems.length - 3} more` : '');

    const totalQty = validItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);

    // Store requiredDate targeting end of that calendar day
    const reqIso = new Date(`${requiredDate}T23:59:59.999Z`).toISOString();
    const issIso = new Date(`${issueDate}T00:00:00.000Z`).toISOString();

    const payload = {
      edfNumber: edfNumber.trim(),
      requesterName: requesterName.trim(),
      category: selectedCategory.trim(),
      issueDate: issIso,
      requiredDate: reqIso,
      materialList: summary,
      quantity: totalQty,
      unit: validItems[0]?.unit || 'pcs',
      priority,
      remarks: remarks.trim() || null,
      items: validItems, // Preserves every individual row!
    };

    const success = await onSaveEDF(payload);
    setIsSaving(false);

    if (success) {
      // Record activity log for Excel import
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
              Excel Import & Direct Table Paste
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste rows directly from Excel or upload a spreadsheet. Material rows are preserved individually.
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

      {fileError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{fileError}</span>
        </div>
      )}

      {step === 'input' ? (
        /* STEP 1: Upload or Direct Table Paste */
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {/* Mode Switch Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveMode('paste')}
              className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeMode === 'paste'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Direct Table Paste (Recommended)</span>
            </button>

            <button
              onClick={() => setActiveMode('upload')}
              className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeMode === 'upload'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Upload Excel File (.xlsx, .xls)</span>
            </button>
          </div>

          {activeMode === 'paste' ? (
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
                  onPaste={(e) => {
                    // Let the paste populate textarea then trigger extractor
                    setTimeout(() => {
                      if (e.clipboardData?.getData('text')) {
                        // User pasted table
                      }
                    }, 50);
                  }}
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
            /* Upload Dropzone */
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-3xl p-8 sm:p-10 text-center transition-all bg-slate-50/50 dark:bg-slate-950/30">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileUpload}
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
                Department Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                  const theme = getCategoryTheme(cat.name);
                  const Icon = theme.icon;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.category;
                          return copy;
                        });
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? `border-indigo-600 bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 scale-[1.02]`
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
              {validationErrors.category && (
                <p className="text-xs font-semibold text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{validationErrors.category}</span>
                </p>
              )}
            </div>

            {/* Form Fields: EDF Number, Requester, Issue Date, Required Date (Date only!), Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {/* EDF Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Edf Number *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={edfNumber}
                    onChange={(e) => {
                      setEdfNumber(e.target.value);
                      if (e.target.value.trim()) {
                        setValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.edfNumber;
                          return copy;
                        });
                      }
                    }}
                    placeholder="e.g. EDF-2026-001"
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono font-bold focus:outline-none focus:ring-2 ${
                      validationErrors.edfNumber
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500'
                    }`}
                    required
                  />
                </div>
                {validationErrors.edfNumber && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{validationErrors.edfNumber}</span>
                  </p>
                )}
              </div>

              {/* Requester Name Dropdown */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Requester Name *
                </label>
                <RequesterDropdown
                  value={requesterName}
                  onChange={(val) => {
                    setRequesterName(val);
                    if (val.trim()) {
                      setValidationErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.requesterName;
                        return copy;
                      });
                    }
                  }}
                  error={validationErrors.requesterName}
                  placeholder="Select or enter requester name..."
                  required
                />
                {validationErrors.requesterName && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{validationErrors.requesterName}</span>
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Priority Level *
                </label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              {/* Request / Issue Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Request / Issue Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      setIssueDate(e.target.value);
                      if (e.target.value) {
                        setValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.issueDate;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full pl-9 pr-3.5 py-2 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 ${
                      validationErrors.issueDate
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500'
                    }`}
                    required
                  />
                </div>
                {validationErrors.issueDate && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{validationErrors.issueDate}</span>
                  </p>
                )}
              </div>

              {/* Required Date - DATE ONLY (No time picker!) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Required Date * (Date Only)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => {
                      setRequiredDate(e.target.value);
                      if (e.target.value) {
                        setValidationErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.requiredDate;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full pl-9 pr-3.5 py-2 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 ${
                      validationErrors.requiredDate
                        ? 'border-red-500 focus:ring-red-400'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-indigo-500'
                    }`}
                    required
                  />
                </div>
                {validationErrors.requiredDate && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{validationErrors.requiredDate}</span>
                  </p>
                )}
              </div>

              {/* Remarks / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Remarks & Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Urgent stock replacement"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* EXTRACTED MATERIALS PREVIEW TABLE */}
          {/* Column Order: Material -> Unit -> Quantity (Unit appears before Quantity!) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Extracted Material Rows ({extractedItems.length} rows)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Individual Rows Preserved
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Column order: Material &rarr; Unit &rarr; Quantity. Edit cells directly or add rows before submitting.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Add Material Row</span>
              </button>
            </div>

            {validationErrors.items && (
              <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{validationErrors.items}</span>
              </p>
            )}

            {/* Desktop Table View */}
            <div className="hidden sm:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 tracking-wider text-[11px] font-bold">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Material / Item Description</th>
                    <th className="py-2.5 px-4 w-32">Unit</th>
                    <th className="py-2.5 px-4 w-28">Quantity</th>
                    <th className="py-2.5 px-4 w-12 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {extractedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={item.itemDescription}
                          onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                          placeholder="Material description"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs"
                          required
                        />
                      </td>
                      {/* Unit appears before Quantity */}
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="e.g. Meter, Piece, Roll"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                          required
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs font-bold"
                          required
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards for Extracted Items */}
            <div className="block sm:hidden space-y-3">
              {extractedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 font-mono">
                      Row #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-red-500 p-1"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      Material
                    </label>
                    <input
                      type="text"
                      value={item.itemDescription}
                      onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                      placeholder="Material description"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
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
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
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
      )}
    </div>
  );
};
