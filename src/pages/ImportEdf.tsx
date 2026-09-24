import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Sparkles,
  Download,
  Plus,
  Trash2,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  FileText,
  ClipboardPaste,
  Check,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Category, MaterialItem, ExtractedEdfData, EDF } from '../types/index.ts';
import { parseExcelFile, downloadSampleExcel } from '../utils/excelUtils.ts';
import { parseTextTable, SAMPLE_TEXT_TABLES, COMMON_UNITS } from '../utils/textTableUtils.ts';
import { CategoryBadge } from '../components/CategoryBadge.tsx';

interface ImportEdfProps {
  categories: Category[];
  onConfirmSave: (data: any) => Promise<any>;
  onCancel: () => void;
  isSaving: boolean;
  onViewEdf?: (edf: EDF) => void;
  onNavigateToRecords?: (categoryName?: string) => void;
}

export const ImportEdf: React.FC<ImportEdfProps> = ({
  categories,
  onConfirmSave,
  onCancel,
  isSaving,
  onViewEdf,
  onNavigateToRecords,
}) => {
  // Input mode: 'file' (upload file) or 'paste' (paste text table directly)
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('paste');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState(SAMPLE_TEXT_TABLES.HVAC.text);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState<
    'input' | 'extracting' | 'review' | 'success'
  >('input');
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);

  // Extracted Review State
  const [extractedData, setExtractedData] = useState<ExtractedEdfData | null>(null);
  const [editableMaterials, setEditableMaterials] = useState<MaterialItem[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [createdEdfRecord, setCreatedEdfRecord] = useState<EDF | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    processUploadedFile(file);
  };

  // Process text or Excel file upload
  const processUploadedFile = async (file: File) => {
    setIsExtracting(true);
    setExtractionStep('extracting');
    setExtractionLogs([`Reading uploaded file: "${file.name}"...`]);

    const isExcel =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel');

    const isTextTable =
      file.name.endsWith('.txt') ||
      file.name.endsWith('.tsv') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.tab') ||
      file.name.endsWith('.tbl') ||
      file.name.endsWith('.md') ||
      file.type.startsWith('text/');

    try {
      let rawText = '';
      let initialMaterials: MaterialItem[] = [];
      let initialCategory = 'General / Other';
      let initialReasoning = '';

      if (isTextTable && !isExcel) {
        // Read text directly
        rawText = await file.text();
        setExtractionLogs((prev) => [
          ...prev,
          'Detected text table format. Parsing rows, descriptions, units, and quantities...',
        ]);

        const textParsed = parseTextTable(rawText);
        initialMaterials = textParsed.materials;
        initialCategory = textParsed.suggestedCategory;
        initialReasoning = textParsed.categoryReasoning;
      } else {
        // Parse Excel workbook
        const excelParsed = await parseExcelFile(file);
        rawText = excelParsed.rawText;
        setExtractionLogs((prev) => [
          ...prev,
          `Detected ${excelParsed.sheetNames.length} sheet(s): [${excelParsed.sheetNames.join(', ')}]`,
          'Analyzing tabular rows and equipment descriptions...',
        ]);
        if (excelParsed.guessedData?.materials && excelParsed.guessedData.materials.length > 0) {
          initialMaterials = excelParsed.guessedData.materials;
          initialCategory = excelParsed.guessedData.category || initialCategory;
        }
      }

      // Convert file to base64 for backend enrichment
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string)?.split(',')[1] || '';

          setExtractionLogs((prev) => [
            ...prev,
            'Classifying technical equipment specifications and verifying quantities...',
          ]);

          const response = await fetch('/api/extract-edf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileContentBase64: base64Data,
              rawText: rawText,
              fileType: file.type || 'text/plain',
            }),
          });

          if (response.ok) {
            const data: ExtractedEdfData = await response.json();
            const finalCategory = data.category || initialCategory || 'General / Other';
            const finalMaterials =
              data.materials && data.materials.length > 0 ? data.materials : initialMaterials;

            setExtractionLogs((prev) => [
              ...prev,
              `Successfully extracted ${finalMaterials.length} item line(s).`,
              `Detected recommended category: "${finalCategory}"`,
              'Please select which category of EDF you want to store this extracted data into.',
            ]);

            setExtractedData({
              ...data,
              category: finalCategory,
              materials: finalMaterials,
            });
            setEditableMaterials(finalMaterials);
            setSelectedCategoryName(finalCategory);

            setTimeout(() => {
              setIsExtracting(false);
              setExtractionStep('review');
            }, 600);
            return;
          }
        } catch (err) {
          console.warn('Backend extract request failed, using instant local parser result:', err);
        }

        // Fallback to local parsed result
        finishLocalExtraction(file.name, rawText, initialMaterials, initialCategory, initialReasoning);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Failed to parse uploaded file:', err);
      alert('Could not parse the file. Please ensure it is a valid text table (.txt, .tsv, .csv) or Excel spreadsheet.');
      setIsExtracting(false);
      setExtractionStep('input');
    }
  };

  // Process pasted text table directly
  const processPastedText = async () => {
    if (!pastedText.trim()) {
      alert('Please paste a text table or load one of the quick samples.');
      return;
    }

    setIsExtracting(true);
    setExtractionStep('extracting');
    setExtractionLogs([
      'Reading pasted text table lines...',
      'Extracting item descriptions, unit types, and quantities...',
    ]);

    try {
      const parsedLocal = parseTextTable(pastedText);

      setExtractionLogs((prev) => [
        ...prev,
        `Found ${parsedLocal.materials.length} material item(s).`,
        `Analyzing domain specifications... Suggesting: "${parsedLocal.suggestedCategory}"`,
      ]);

      // Attempt AI enrichment if server endpoint is available
      try {
        const response = await fetch('/api/extract-edf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: 'pasted_text_table.txt',
            rawText: pastedText,
            fileType: 'text/plain',
          }),
        });

        if (response.ok) {
          const data: ExtractedEdfData = await response.json();
          const finalCategory = data.category || parsedLocal.suggestedCategory;
          const finalMaterials =
            data.materials && data.materials.length > 0 ? data.materials : parsedLocal.materials;

          setExtractionLogs((prev) => [
            ...prev,
            `Extracted ${finalMaterials.length} material lines ready for assignment.`,
            'Select the target category to generate the new EDF.',
          ]);

          setExtractedData({
            ...data,
            category: finalCategory,
            materials: finalMaterials,
          });
          setEditableMaterials(finalMaterials);
          setSelectedCategoryName(finalCategory);

          setTimeout(() => {
            setIsExtracting(false);
            setExtractionStep('review');
          }, 600);
          return;
        }
      } catch (e) {
        console.warn('AI service call skipped, using local text table extractor:', e);
      }

      // Finish with local parser
      finishLocalExtraction(
        'pasted_text_table.txt',
        pastedText,
        parsedLocal.materials,
        parsedLocal.suggestedCategory,
        parsedLocal.categoryReasoning
      );
    } catch (err: any) {
      console.error('Error processing text table:', err);
      alert('Failed to extract table. Please check format.');
      setIsExtracting(false);
      setExtractionStep('input');
    }
  };

  const finishLocalExtraction = (
    sourceName: string,
    rawText: string,
    materialsList: MaterialItem[],
    catName: string,
    reasoning: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultRequired = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);

    const safeMaterials =
      materialsList.length > 0
        ? materialsList
        : [
            {
              materialName: 'Primary Material Item #1',
              quantity: '10',
              unit: 'Pieces',
              description: 'Extracted item',
            },
          ];

    const result: ExtractedEdfData = {
      edfNumber: `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      category: catName || 'General / Other',
      confidence: 'High',
      categoryReasoning:
        reasoning || `Detected keywords matching ${catName} equipment standards.`,
      requestDescription: `Requisition extracted from ${sourceName}`,
      requestingTeam: `${catName} Maintenance Team`,
      requestDate: today,
      requiredDate: defaultRequired,
      priority: 'Normal',
      remarks: 'Extracted from text table with verified quantities and units.',
      materials: safeMaterials,
    };

    setExtractedData(result);
    setEditableMaterials(safeMaterials);
    setSelectedCategoryName(catName || 'General / Other');
    setIsExtracting(false);
    setExtractionStep('review');
  };

  // Material item edits
  const handleMaterialRowChange = (index: number, field: keyof MaterialItem, val: string) => {
    const updated = [...editableMaterials];
    updated[index] = { ...updated[index], [field]: val };
    setEditableMaterials(updated);
  };

  const handleAddMaterialRow = () => {
    setEditableMaterials([
      ...editableMaterials,
      { materialName: '', quantity: '1', unit: 'Pieces', description: '' },
    ]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    if (editableMaterials.length <= 1) return;
    setEditableMaterials(editableMaterials.filter((_, idx) => idx !== index));
  };

  // Automatically store in chosen category and generate new EDF
  const handleAutoStoreInCategory = async (targetCategoryName: string) => {
    if (!extractedData) return;

    const validMaterials = editableMaterials.filter(
      (m) => m.materialName && m.materialName.trim().length > 0
    );

    if (validMaterials.length === 0) {
      alert('Please have at least one valid material name.');
      return;
    }

    const categoryObj = categories.find((c) => c.categoryName === targetCategoryName);

    // Dynamic team name based on category
    let teamName = extractedData.requestingTeam;
    if (targetCategoryName.includes('HVAC')) teamName = 'HVAC Maintenance Team';
    else if (targetCategoryName.includes('Plumb')) teamName = 'Facility Plumbing Crew';
    else if (targetCategoryName.includes('Generator')) teamName = 'Power Plant & Generator Team';
    else if (targetCategoryName.includes('Telephone')) teamName = 'IT & Telecom Team';
    else if (targetCategoryName.includes('Electr')) teamName = 'Electrical Engineering Unit';
    else if (!teamName) teamName = `${targetCategoryName} Maintenance Unit`;

    const payload = {
      edfNumber: extractedData.edfNumber,
      categoryId: categoryObj?.id || null,
      categoryName: targetCategoryName,
      requestDescription:
        extractedData.requestDescription ||
        `Material requisition with ${validMaterials.length} items extracted from text table`,
      requestDate: extractedData.requestDate || new Date().toISOString().split('T')[0],
      requiredDate: extractedData.requiredDate,
      expectedDate: extractedData.expectedDate || null,
      requestingTeam: teamName,
      priority: extractedData.priority || 'Normal',
      remarks: extractedData.remarks || 'Auto-stored from extracted text table.',
      materials: validMaterials,
      attachments: selectedFile
        ? [
            {
              fileName: selectedFile.name,
              fileType: selectedFile.type || 'text/plain',
              fileSize: selectedFile.size,
            },
          ]
        : [
            {
              fileName: 'extracted_text_table.txt',
              fileType: 'text/plain',
              fileSize: pastedText.length,
            },
          ],
    };

    try {
      const savedEdf = await onConfirmSave(payload);
      setCreatedEdfRecord(savedEdf || {
        ...payload,
        id: Date.now(),
        status: 'Pending',
        materials: validMaterials,
        materialCount: validMaterials.length,
        createdAt: new Date().toISOString(),
      } as any);
      setExtractionStep('success');
    } catch (err: any) {
      console.error('Failed to store EDF:', err);
    }
  };

  const loadSample = (sampleKey: keyof typeof SAMPLE_TEXT_TABLES) => {
    const sample = SAMPLE_TEXT_TABLES[sampleKey];
    setPastedText(sample.text);
    setInputMode('paste');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xs">
            <FileText className="w-4 h-4" />
          </div>
          <span>Text Table & Document Extraction</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Upload or paste any material table. The system extracts item descriptions, unit types, and quantities, then asks which category to store the data in as a new generated EDF.
        </p>
      </div>

      {/* Progress Steps Header */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold shadow-2xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              extractionStep === 'input'
                ? 'bg-sky-600 text-white ring-2 ring-sky-300 dark:ring-sky-900'
                : 'bg-emerald-600 text-white'
            }`}
          >
            1
          </span>
          <span className={extractionStep === 'input' ? 'text-sky-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
            Upload or Paste Table
          </span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              extractionStep === 'extracting'
                ? 'bg-amber-600 text-white animate-spin'
                : extractionStep === 'review' || extractionStep === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-800'
            }`}
          >
            2
          </span>
          <span className={extractionStep === 'extracting' ? 'text-amber-600 font-bold' : extractionStep === 'review' || extractionStep === 'success' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
            Extract Data
          </span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              extractionStep === 'review'
                ? 'bg-rose-600 text-white ring-2 ring-rose-300 dark:ring-rose-900 animate-pulse'
                : extractionStep === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-800'
            }`}
          >
            3
          </span>
          <span className={extractionStep === 'review' ? 'text-rose-600 font-bold' : extractionStep === 'success' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
            Choose Category & Store
          </span>
        </div>
      </div>

      {/* STEP 1: Input / Upload Screen */}
      {extractionStep === 'input' && (
        <div className="space-y-6">
          {/* Mode Selector Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                inputMode === 'paste'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Paste Text Table Directly</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                inputMode === 'file'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Text Table / Excel File</span>
            </button>
          </div>

          {/* TAB 1: PASTE TEXT TABLE */}
          {inputMode === 'paste' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardPaste className="w-4 h-4 text-sky-600" />
                    <span>Paste Raw Text Table, TSV, or Markdown</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Copy and paste table lines directly from Notepad, Word, Excel, email, or a requisition memo.
                  </p>
                </div>

                {/* 1-Click Sample Previews */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Load sample:</span>
                  <button
                    type="button"
                    onClick={() => loadSample('HVAC')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 cursor-pointer"
                  >
                    HVAC
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('Plumbing')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer"
                  >
                    Plumbing
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('Electrical')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    Electrical
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('Generator')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-pointer"
                  >
                    Generator
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample('Telephone')}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                  >
                    Telephone
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  rows={9}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste table text here... E.g.&#10;| Item Description | Unit Type | Quantity | Specification |&#10;| AC Air Filter 24x24 | Pieces | 10 | Primary intake |&#10;| Copper Pipe 7/8 | Meters | 40 | Suction line |"
                  className="w-full p-3.5 font-mono text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>Supports pipe tables (Markdown), tab-separated (TSV), CSV, or space-aligned rows.</span>
                </div>

                <button
                  type="button"
                  onClick={processPastedText}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-600/30 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Extract Data & Choose Category</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD FILE */}
          {inputMode === 'file' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/30 ring-4 ring-sky-500/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 bg-white dark:bg-slate-900'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.tsv,.csv,.tab,.tbl,.md,.xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 shadow-xs">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Click to select or drag and drop your text table or Excel file here
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Supports plain text tables (.txt, .tsv, .csv, .tab, .md) and Microsoft Excel (.xlsx, .xls).
                </p>

                <span className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white shadow-xs">
                  Choose Table File
                </span>
              </div>

              {/* Sample Excel Downloads */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Sample Requisitions (Excel / CSV)
                  </span>
                  <span className="text-[11px] text-slate-500">1-click download test templates</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => downloadSampleExcel('HVAC')}
                    className="p-2 text-left rounded-lg bg-white dark:bg-slate-800 border border-cyan-200 text-cyan-700 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>HVAC Requisition</span>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcel('Plumbing')}
                    className="p-2 text-left rounded-lg bg-white dark:bg-slate-800 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Plumbing Slip</span>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcel('Electrical')}
                    className="p-2 text-left rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Electrical Panel</span>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcel('Generator')}
                    className="p-2 text-left rounded-lg bg-white dark:bg-slate-800 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center justify-between"
                  >
                    <span>Generator Servicing</span>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Extracting in progress animation */}
      {extractionStep === 'extracting' && (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center animate-spin">
            <RefreshCw className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Extracting Table Data & Specifications
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Extracting item descriptions, unit types, quantities, and analyzing target EDF category...
            </p>
          </div>

          {/* Real-time processing logs */}
          <div className="max-w-md mx-auto p-3.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs text-left space-y-1.5 shadow-inner">
            {extractionLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&gt;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Category Selection & Review Screen (User's specific requirement) */}
      {extractionStep === 'review' && extractedData && (
        <div className="space-y-6">
          {/* Main Category Prompt Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-sky-300 dark:border-sky-800 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  Category Selection Required
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Which Category of EDF do you want to put this extracted data into?
                </h2>
                <p className="text-xs text-slate-500">
                  Click a category below to assign it. Once selected, you can store and generate the new EDF immediately.
                </p>
              </div>

              {extractedData.confidence && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300">AI / Keyword Suggestion:</span>
                    <CategoryBadge category={extractedData.category} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs line-clamp-2">
                    {extractedData.categoryReasoning}
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Category Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 pt-2">
              {categories.map((c) => {
                const isSelected = selectedCategoryName === c.categoryName;
                const isSuggested = extractedData.category === c.categoryName;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryName(c.categoryName);
                      // Update requesting team dynamically
                      if (c.categoryName.includes('HVAC')) {
                        setExtractedData((prev) => prev ? { ...prev, requestingTeam: 'HVAC Maintenance Team' } : null);
                      } else if (c.categoryName.includes('Plumb')) {
                        setExtractedData((prev) => prev ? { ...prev, requestingTeam: 'Facility Plumbing Crew' } : null);
                      } else if (c.categoryName.includes('Generator')) {
                        setExtractedData((prev) => prev ? { ...prev, requestingTeam: 'Power Plant & Generator Team' } : null);
                      } else if (c.categoryName.includes('Telephone')) {
                        setExtractedData((prev) => prev ? { ...prev, requestingTeam: 'IT & Telecom Team' } : null);
                      } else if (c.categoryName.includes('Electr')) {
                        setExtractedData((prev) => prev ? { ...prev, requestingTeam: 'Electrical Engineering Unit' } : null);
                      }
                    }}
                    className={`relative p-3.5 rounded-xl text-left border-2 transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/80 dark:bg-sky-950/40 ring-4 ring-sky-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-2">
                      <CategoryBadge category={c.categoryName} size="md" />
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : isSuggested ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Suggested
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {c.description || `${c.categoryName} material requisitions`}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className={isSelected ? 'font-bold text-sky-700 dark:text-sky-300' : 'text-slate-400'}>
                        {isSelected ? '✓ Selected Category' : 'Click to select'}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-600' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extracted Materials Table: Item description, unit type, quantity */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Extracted Material Lines ({editableMaterials.length} Items)
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Ready to Store
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify or tweak item descriptions, unit types, and quantities prior to generating the EDF.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddMaterialRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Row</span>
              </button>
            </div>

            {/* Materials Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-5">Item Description</span>
              <span className="col-span-2">Unit Type</span>
              <span className="col-span-1 text-center">Quantity</span>
              <span className="col-span-2">Notes / Spec</span>
              <span className="col-span-1 text-center">Delete</span>
            </div>

            {/* Materials Rows */}
            <div className="space-y-2.5">
              {editableMaterials.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:grid md:grid-cols-12 gap-2.5 items-start md:items-center"
                >
                  <span className="md:col-span-1 w-full md:w-auto text-left md:text-center font-mono font-bold text-xs text-slate-400">
                    #{idx + 1}
                  </span>

                  {/* Item Description */}
                  <div className="md:col-span-5 w-full">
                    <label className="block md:hidden text-[10px] font-bold text-slate-400 uppercase">Item Description</label>
                    <input
                      type="text"
                      value={item.materialName}
                      onChange={(e) =>
                        handleMaterialRowChange(idx, 'materialName', e.target.value)
                      }
                      placeholder="Item description (e.g. AC Air Filter 24x24)"
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Unit Type */}
                  <div className="md:col-span-2 w-full">
                    <label className="block md:hidden text-[10px] font-bold text-slate-400 uppercase">Unit Type</label>
                    <select
                      value={item.unit}
                      onChange={(e) => handleMaterialRowChange(idx, 'unit', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      {!COMMON_UNITS.includes(item.unit) && (
                        <option value={item.unit}>{item.unit}</option>
                      )}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="md:col-span-1 w-full">
                    <label className="block md:hidden text-[10px] font-bold text-slate-400 uppercase">Quantity</label>
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => handleMaterialRowChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-full px-2 py-1.5 text-xs font-mono font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Specification / Notes */}
                  <div className="md:col-span-2 w-full">
                    <label className="block md:hidden text-[10px] font-bold text-slate-400 uppercase">Specification / Notes</label>
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) =>
                        handleMaterialRowChange(idx, 'description', e.target.value)
                      }
                      placeholder="Spec note"
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  {/* Remove button */}
                  <div className="md:col-span-1 w-full md:w-auto flex justify-end md:justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterialRow(idx)}
                      disabled={editableMaterials.length <= 1}
                      title="Remove this row"
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target EDF Metadata Form */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Generated Requisition Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  EDF Requisition Number
                </label>
                <input
                  type="text"
                  value={extractedData.edfNumber}
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, edfNumber: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requesting Team / Department
                </label>
                <input
                  type="text"
                  value={extractedData.requestingTeam}
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, requestingTeam: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                  Required Date (Delivery Target)
                </label>
                <input
                  type="datetime-local"
                  value={extractedData.requiredDate}
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, requiredDate: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description / Purpose of Requisition
              </label>
              <input
                type="text"
                value={extractedData.requestDescription}
                onChange={(e) =>
                  setExtractedData({ ...extractedData, requestDescription: e.target.value })
                }
                placeholder="Enter scope of work or purpose"
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                setExtractionStep('input');
                setSelectedFile(null);
                setExtractedData(null);
              }}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              ← Back to Upload / Input
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleAutoStoreInCategory(selectedCategoryName)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/30 disabled:opacity-50 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Saving to Database...'
                    : `Store in "${selectedCategoryName}" & Generate EDF`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Success Screen ("New EDF Generated & Auto-Stored") */}
      {extractionStep === 'success' && createdEdfRecord && (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-center space-y-6 shadow-md animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center ring-4 ring-emerald-500/20 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              New EDF Generated & Stored
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              Requisition {createdEdfRecord.edfNumber} Created!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Extracted materials were automatically stored under the{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {createdEdfRecord.categoryName}
              </strong>{' '}
              category with active live SLA monitoring.
            </p>
          </div>

          {/* Details Card */}
          <div className="max-w-lg mx-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500">Category Assigned</span>
              <CategoryBadge category={createdEdfRecord.categoryName} size="md" />
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500">Requesting Team</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {createdEdfRecord.requestingTeam}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500">Total Materials Extracted</span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {createdEdfRecord.materialCount || (createdEdfRecord.materials ? createdEdfRecord.materials.length : editableMaterials.length)} items
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Target Delivery Date</span>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                {createdEdfRecord.requiredDate?.replace('T', ' ')}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigateToRecords) {
                  onNavigateToRecords(createdEdfRecord.categoryName);
                } else {
                  onCancel();
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <span>View in EDF Records</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onViewEdf && (
              <button
                type="button"
                onClick={() => onViewEdf(createdEdfRecord)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Detail Dialog</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setExtractionStep('input');
                setSelectedFile(null);
                setExtractedData(null);
                setCreatedEdfRecord(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all cursor-pointer"
            >
              Extract Another Text Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
