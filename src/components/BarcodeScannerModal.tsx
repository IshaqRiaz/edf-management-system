import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { EDF, EDFItem } from '../types.ts';
import {
  Scan,
  X,
  Camera,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Maximize2,
  Check,
  Package,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  edfs: EDF[];
  onReceiveItems?: (edfId: number, itemIds: number[]) => Promise<void>;
  onViewDetails?: (edf: EDF) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  edfs,
  onReceiveItems,
  onViewDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [matchedEdf, setMatchedEdf] = useState<EDF | null>(null);
  const [matchedItemId, setMatchedItemId] = useState<number | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isProcessingReceive, setIsProcessingReceive] = useState(false);
  const [receiveSuccessMessage, setReceiveSuccessMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'edf-qr-barcode-reader';

  // Find matching EDF and optional item based on decoded string
  const resolveScannedContent = (rawText: string) => {
    const text = rawText.trim();
    setLastScannedCode(text);
    setReceiveSuccessMessage(null);

    // 1. Try parsing JSON format: { edfNumber: "...", itemId: 1 } or { edfId: 2 }
    try {
      const parsed = JSON.parse(text);
      if (parsed.edfNumber || parsed.edfId) {
        const found = edfs.find(
          (e) =>
            (parsed.edfNumber && e.edfNumber.toLowerCase() === String(parsed.edfNumber).toLowerCase()) ||
            (parsed.edfId && e.id === Number(parsed.edfId))
        );
        if (found) {
          setMatchedEdf(found);
          setMatchedItemId(parsed.itemId ? Number(parsed.itemId) : null);
          return;
        }
      }
    } catch {}

    // 2. Try parsing colon/slash format: "EDF-2026-001:2" or "EDF-2026-001/2"
    const splitMatch = text.match(/^(.+?)[:/](\d+)$/);
    if (splitMatch) {
      const edfPart = splitMatch[1].trim().toLowerCase();
      const itemPart = parseInt(splitMatch[2], 10);
      const found = edfs.find((e) => e.edfNumber.toLowerCase() === edfPart);
      if (found) {
        setMatchedEdf(found);
        setMatchedItemId(itemPart);
        return;
      }
    }

    // 3. Exact or Substring match on EDF Number
    const exactEdf = edfs.find((e) => e.edfNumber.toLowerCase() === text.toLowerCase());
    if (exactEdf) {
      setMatchedEdf(exactEdf);
      setMatchedItemId(null);
      return;
    }

    // 4. Match anywhere in EDF number or material list
    const partialEdf = edfs.find(
      (e) =>
        e.edfNumber.toLowerCase().includes(text.toLowerCase()) ||
        (e.materialList && e.materialList.toLowerCase().includes(text.toLowerCase())) ||
        e.items?.some((it) => it.itemDescription.toLowerCase().includes(text.toLowerCase()))
    );

    if (partialEdf) {
      setMatchedEdf(partialEdf);
      // If matches specific item description
      const itemMatch = partialEdf.items?.find((it) =>
        it.itemDescription.toLowerCase().includes(text.toLowerCase())
      );
      setMatchedItemId(itemMatch?.id || null);
      return;
    }

    // No match found
    setMatchedEdf(null);
    setMatchedItemId(null);
  };

  // Start Camera Scanning
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopScanner();
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        setScannerError(null);

        // Get video devices
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setScannerError('No camera found on this device. You can use Manual Code Entry tab.');
          return;
        }

        setCameras(devices);
        const backCamera = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')) || devices[0];
        const activeCamId = selectedCameraId || backCamera.id;
        setSelectedCameraId(activeCamId);

        // Create or reuse scanner
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ],
            verbose: false,
          });
        }

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await scannerRef.current.start(
          activeCamId,
          config,
          (decodedText) => {
            if (isMounted) {
              resolveScannedContent(decodedText);
            }
          },
          () => {
            // Non-critical scan failure per frame, ignored
          }
        );

        if (isMounted) setIsScanning(true);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Camera scanner initialization error:', err);
        setScannerError(
          err?.message?.includes('Permission')
            ? 'Camera access permission was denied. Please allow camera permissions or enter code manually.'
            : 'Unable to start camera stream. You can switch cameras or use manual code entry.'
        );
      }
    };

    const timer = setTimeout(() => {
      startCamera();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, activeTab, selectedCameraId]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    resolveScannedContent(manualCode.trim());
  };

  // Receive single item
  const handleReceiveSingleItem = async (itemId: number) => {
    if (!matchedEdf || !onReceiveItems) return;
    setIsProcessingReceive(true);
    try {
      await onReceiveItems(matchedEdf.id, [itemId]);
      setReceiveSuccessMessage(`Item successfully marked as Received!`);
      // Update local matched EDF state
      setMatchedEdf((prev) => {
        if (!prev) return null;
        const updatedItems = (prev.items || []).map((it) =>
          it.id === itemId ? { ...it, status: 'Received' as const } : it
        );
        const total = prev.totalItemsCount || updatedItems.length;
        const rec = updatedItems.filter((i) => i.status === 'Received').length;
        return {
          ...prev,
          items: updatedItems,
          receivedItemsCount: rec,
          status: rec >= total ? ('Received' as const) : ('Partially Received' as const),
        };
      });
    } catch (err: any) {
      setScannerError('Failed to mark item as received: ' + (err?.message || 'Error'));
    } finally {
      setIsProcessingReceive(false);
    }
  };

  // Receive all pending items on matched EDF
  const handleReceiveAllItems = async () => {
    if (!matchedEdf || !onReceiveItems) return;
    const pendingItems = (matchedEdf.items || []).filter((i) => i.status !== 'Received' && i.id);
    const itemIds = pendingItems.map((i) => i.id!);
    if (itemIds.length === 0) return;

    setIsProcessingReceive(true);
    try {
      await onReceiveItems(matchedEdf.id, itemIds);
      setReceiveSuccessMessage(`All ${itemIds.length} item(s) marked as Received!`);
      setMatchedEdf((prev) => {
        if (!prev) return null;
        const updatedItems = (prev.items || []).map((it) => ({
          ...it,
          status: 'Received' as const,
        }));
        return {
          ...prev,
          items: updatedItems,
          receivedItemsCount: updatedItems.length,
          status: 'Received',
        };
      });
    } catch (err: any) {
      setScannerError('Failed to mark items: ' + (err?.message || 'Error'));
    } finally {
      setIsProcessingReceive(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>QR & Barcode Scanner</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Live Camera
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Scan EDF forms or item labels to instantly mark items as received
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Scan</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Manual Code</span>
            </button>
          </div>

          {activeTab === 'camera' && cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="text-[11px] font-semibold px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              {cameras.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Scanner Viewport or Manual Input */}
        <div className="p-4 sm:p-5 space-y-4">
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black/90 aspect-square max-h-64 sm:max-h-72 mx-auto flex items-center justify-center border-2 border-slate-700 shadow-inner">
                <div id={scannerContainerId} className="w-full h-full object-cover"></div>

                {!isScanning && !scannerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 bg-slate-900/80">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    <span className="text-xs font-semibold">Starting camera...</span>
                  </div>
                )}
              </div>

              {scannerError && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Camera Notice</p>
                    <p className="text-[11px] mt-0.5">{scannerError}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSearch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Barcode / QR Code Value or EDF Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. EDF-2026-001 or Item Code..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Sample QR/Barcode tags helper for quick testing */}
              {edfs.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                    Quick Test Barcodes from Your Data:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {edfs.slice(0, 6).map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => {
                          setManualCode(e.edfNumber);
                          resolveScannedContent(e.edfNumber);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {e.edfNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Success Notification */}
          {receiveSuccessMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{receiveSuccessMessage}</span>
            </div>
          )}

          {/* Matched Record Results */}
          {matchedEdf ? (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/80 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-mono text-xs font-black">
                      {matchedEdf.edfNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        matchedEdf.status === 'Received'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          : matchedEdf.status === 'Partially Received'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                      }`}
                    >
                      {matchedEdf.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    Requester: {matchedEdf.requesterName} • Category: {matchedEdf.category}
                  </h4>
                </div>

                {onViewDetails && (
                  <button
                    onClick={() => {
                      stopScanner();
                      onClose();
                      onViewDetails(matchedEdf);
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Full Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Items List in Scanned EDF */}
              <div className="space-y-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Materials & Items:</span>
                  {matchedEdf.status !== 'Received' && (
                    <button
                      onClick={handleReceiveAllItems}
                      disabled={isProcessingReceive}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingReceive ? 'Receiving...' : 'Receive All Pending'}
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {(matchedEdf.items && matchedEdf.items.length > 0
                    ? matchedEdf.items
                    : [
                        {
                          id: 1,
                          itemDescription: matchedEdf.materialList,
                          quantity: matchedEdf.quantity,
                          unit: matchedEdf.unit,
                          status: matchedEdf.status === 'Received' ? 'Received' : 'Pending',
                        },
                      ]
                  ).map((it, idx) => {
                    const isRec = it.status === 'Received';
                    const isTarget = matchedItemId && it.id === matchedItemId;

                    return (
                      <div
                        key={it.id || idx}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                          isTarget
                            ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 ring-2 ring-amber-400'
                            : isRec
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isRec ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Package className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {it.itemDescription}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1.5 font-mono">
                              ({it.quantity} {it.unit})
                            </span>
                          </div>
                        </div>

                        <div>
                          {isRec ? (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                              Received
                            </span>
                          ) : (
                            <button
                              onClick={() => it.id && handleReceiveSingleItem(it.id)}
                              disabled={isProcessingReceive}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark Received</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : lastScannedCode ? (
            <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-center space-y-1">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                No matching EDF record found for code:
              </p>
              <p className="text-sm font-mono font-black text-amber-800 dark:text-amber-300 break-all">
                "{lastScannedCode}"
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Please verify the barcode matches an active EDF Number or item description.
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {lastScannedCode ? `Last code: ${lastScannedCode}` : 'Ready to scan QR / Barcodes'}
          </span>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
