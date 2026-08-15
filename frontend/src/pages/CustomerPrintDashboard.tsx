import React, { useEffect, useState, useRef } from 'react';
import { api, QueueJob, PrinterInfo } from '../services/client';
import { Printer, RotateCw, Trash2, CheckCircle2, Upload, FileText, AlertCircle, Wifi, Check, Scissors, Sun, Contrast, RefreshCw, ArrowUpDown, Sparkles } from 'lucide-react';

const EPSON_NAME = 'EPSON L3110 Series';
const HP_NAME = 'HP508140DE1D63(HP Laser MFP 131 133 135-138)';

export const CustomerPrintDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [sortNewest, setSortNewest] = useState(true);
  
  // Ref to protect against React timer stale closure overriding selected image
  const selectedIdRef = useRef<string | null>(null);
  const previousJobsRef = useRef<QueueJob[]>([]);
  const [notification, setNotification] = useState<{ count: number, names: string[], show: boolean }>({ count: 0, names: [], show: false });

  // Ref to suppress loadData from overwriting selectedJob while user is actively dragging crop handles
  const isDraggingRef = useRef(false);
  // Mirror draggingEdge state in a ref so document-level listeners can access current value
  const draggingEdgeRef = useRef<string | null>(null);

  // Controls state
  const [rotate, setRotate] = useState(0);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [copies, setCopies] = useState(1);
  const [activePrinterName, setActivePrinterName] = useState(HP_NAME);
  const [applying, setApplying] = useState(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [testResultMsg, setTestResultMsg] = useState<{ [key: string]: string }>({});
  const [uploading, setUploading] = useState(false);

  // Live printer USB connectivity status (polled every 10 seconds)
  const [printerStatus, setPrinterStatus] = useState<Record<string, string>>({});

  // CamScanner / Doc Scanner interactive visual cropping box state
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [showCropBox, setShowCropBox] = useState(true);
  const [draggingEdge, setDraggingEdge] = useState<string | null>(null);
  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Start dragging: capture the pointer so events are tracked globally
  const startDrag = (e: React.PointerEvent, edge: string) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    draggingEdgeRef.current = edge;
    activePointerIdRef.current = e.pointerId;
    setDraggingEdge(edge);
    // Capture pointer on the target element so we get all move/up events even outside the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Document-level pointermove/pointerup via useEffect for reliable cross-element dragging
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const edge = draggingEdgeRef.current;
      if (!edge || !imgContainerRef.current) return;
      e.preventDefault();
      const rect = imgContainerRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      
      const pctX = Math.round((relX / rect.width) * 100);
      const pctY = Math.round((relY / rect.height) * 100);
      
      if (edge.includes('top')) setCropTop(Math.min(45, Math.max(0, pctY)));
      if (edge.includes('bottom')) setCropBottom(Math.min(45, Math.max(0, 100 - pctY)));
      if (edge.includes('left')) setCropLeft(Math.min(45, Math.max(0, pctX)));
      if (edge.includes('right')) setCropRight(Math.min(45, Math.max(0, 100 - pctX)));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!draggingEdgeRef.current) return;
      isDraggingRef.current = false;
      draggingEdgeRef.current = null;
      activePointerIdRef.current = null;
      setDraggingEdge(null);
    };

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Using globally defined EPSON_NAME and HP_NAME above

  const loadData = async () => {
    try {
      const queueData = await api.getQueue();
      const historyData = await api.getHistory(50);
      const printerData = await api.getPrinters();
      
      const histAsJobs: QueueJob[] = historyData.map((h: any) => ({
        id: h.id,
        fileId: h.fileId || h.id,
        customerName: 'WhatsApp Customer',
        fileName: h.customerFile || 'Customer_Doc',
        processedPath: h.processedPath,
        originalPath: h.originalPath,
        printer: h.printerName || EPSON_NAME,
        copies: h.copies || 1,
        status: h.status || 'Completed',
        priority: 0,
        createdAt: h.printTime || h.createdAt || new Date().toISOString(),
        updatedAt: h.printTime || h.createdAt || new Date().toISOString(),
        attempts: 1
      }));

      const seen = new Set();
      const combined = [...queueData, ...histAsJobs].filter(j => {
        const key = j.fileId || j.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // RELIABLE SORTING: Compare timestamp milliseconds
      combined.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime() || 0;
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime() || 0;
        return sortNewest ? (timeB - timeA) : (timeA - timeB);
      });

      // Show notification if there are new files compared to the previous poll
      const newIncomingJobs = combined.filter(job => 
        !previousJobsRef.current.some(prev => prev.id === job.id || prev.fileId === job.fileId) && 
        (new Date().getTime() - new Date(job.createdAt || job.updatedAt).getTime() < 30000)
      );
      
      if (newIncomingJobs.length > 0 && previousJobsRef.current.length > 0) {
        setNotification({
          count: newIncomingJobs.length,
          names: newIncomingJobs.map(j => j.fileName),
          show: true
        });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 8000);
      }
      previousJobsRef.current = combined;

      setJobs(combined);
      setPrinters(printerData);
      
      const activePrinters = printerData.filter(p => p.status === 'Ready');
      if (activePrinters.length > 0 && !activePrinterName) {
        setActivePrinterName(activePrinters[0].name);
      }
      
      // Keep selected document synced without timer jumping to index 0!
      // CRITICAL: Skip updating selectedJob while user is actively dragging crop handles
      if (isDraggingRef.current) {
        // Don't touch selectedJob or crop state while dragging
      } else if (selectedIdRef.current) {
        const matching = combined.find(j => j.id === selectedIdRef.current || j.fileId === selectedIdRef.current);
        if (matching) {
          setSelectedJob(matching);
        }
      } else if (!selectedJob && combined.length > 0) {
        selectedIdRef.current = combined[0].fileId || combined[0].id;
        setSelectedJob(combined[0]);
      }
    } catch (e) {
      console.error("Dashboard Sync Error:", e);
    }
  };

  const selectJob = (job: QueueJob) => {
    selectedIdRef.current = job.fileId || job.id;
    setSelectedJob(job);
    setRotate(0);
    setBrightness(1.0);
    setContrast(1.0);
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [sortNewest]);

  // Poll both printers every 5 seconds for live ONLINE/OFFLINE hardware status
  useEffect(() => {
    const pollPrinterStatus = async () => {
      try {
        const status = await api.fetchPrinterStatus();
        if (status && typeof status === 'object') {
          setPrinterStatus(status);
          if ((status as any).messages) {
            const msgs = (status as any).messages;
            setTestResultMsg(prev => ({
              ...prev,
              [EPSON_NAME]: msgs[EPSON_NAME] || (status[EPSON_NAME] === 'Online' ? '✅ Printer [EPSON L3110 Series] is Online, powered on, and ready to print!' : '⚠️ Printer [EPSON L3110 Series] is currently powered off or disconnected.'),
              [HP_NAME]: msgs[HP_NAME] || (status[HP_NAME] === 'Online' ? '✅ Printer [HP Laser MFP] is Online, powered on, and ready to print!' : '⚠️ Printer [HP Laser MFP] is currently powered off or disconnected.')
            }));
          } else {
            setTestResultMsg(prev => ({
              ...prev,
              [EPSON_NAME]: status[EPSON_NAME] === 'Online' ? '✅ Printer [EPSON L3110 Series] is Online, powered on, and ready to print!' : '⚠️ Printer [EPSON L3110 Series] is currently powered off or disconnected.',
              [HP_NAME]: status[HP_NAME] === 'Online' ? '✅ Printer [HP Laser MFP] is Online, powered on, and ready to print!' : '⚠️ Printer [HP Laser MFP] is currently powered off or disconnected.'
            }));
          }
          if (status[HP_NAME] === 'Online' && status[EPSON_NAME] !== 'Online') {
            setActivePrinterName(HP_NAME);
          } else if (status[EPSON_NAME] === 'Online' && status[HP_NAME] !== 'Online') {
            setActivePrinterName(EPSON_NAME);
          }
        }
      } catch (e) {
        // Silently continue
      }
    };
    pollPrinterStatus();
    const statusInterval = setInterval(pollPrinterStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const handleTestPrinter = async (pName: string) => {
    setTestResultMsg(prev => ({ ...prev, [pName]: 'Testing Wi-Fi & Power...' }));
    try {
      const res = await api.testPrinter(pName);
      setTestResultMsg(prev => ({ ...prev, [pName]: res.message || (res.success ? '✅ ONLINE & READY!' : '⚠️ OFFLINE / WI-FI CHECK FAILED') }));
    } catch (e: any) {
      setTestResultMsg(prev => ({ ...prev, [pName]: '⚠️ OFFLINE - Check Power or USB Cable' }));
    }
  };

  const handleInstantPrint = async (targetPrinter: string) => {
    if (!selectedJob) return;
    setApplying(true);
    setPrintSuccessMsg(null);
    try {
      if (rotate !== 0 || brightness !== 1.0 || contrast !== 1.0) {
        await api.overrideImage(selectedJob.id, { rotate, brightness, contrast });
      }
      await api.manualPrint(selectedJob.id, targetPrinter, copies);
      setPrintSuccessMsg(`✅ SUCCESS: Spooled [${selectedJob.fileName}] straight to [${targetPrinter}] (${copies} copy) without dialogs!`);
      setTimeout(() => setPrintSuccessMsg(null), 6000);
      loadData();
    } catch (e: any) {
      alert(`Print Dispatch Error: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  // Handle Smart Auto-Crop, Doc Scanner Kit filters, and Manual Cropping borders
  const handleApplyAdjustments = async (options: { autoCrop?: boolean; trimAllPct?: number; trimVerticalPct?: number; trimHorizontalPct?: number; trimTopPct?: number; trimBottomPct?: number; trimLeftPct?: number; trimRightPct?: number; overrideRotate?: number; filterType?: string; reset?: boolean } = {}) => {
    if (!selectedJob) return;
    setApplying(true);
    try {
      const activeRotate = options.overrideRotate !== undefined ? options.overrideRotate : 0;
      const res = await api.overrideImage(selectedJob.id, {
        rotate: activeRotate,
        brightness,
        contrast,
        autoCrop: options.autoCrop,
        trimAllPct: options.trimAllPct,
        trimVerticalPct: options.trimVerticalPct,
        trimHorizontalPct: options.trimHorizontalPct,
        trimTopPct: options.trimTopPct,
        trimBottomPct: options.trimBottomPct,
        trimLeftPct: options.trimLeftPct,
        trimRightPct: options.trimRightPct,
        filterType: options.filterType,
        reset: options.reset
      });
      if (res.success && res.job) {
        setSelectedJob(res.job);
        if (options.overrideRotate !== undefined) setRotate(0);
        let msg = '✨ Applied image adjustments successfully!';
        if (options.reset) {
          msg = '🔄 Reverted image back to original clean scan!';
          setCropTop(0); setCropBottom(0); setCropLeft(0); setCropRight(0);
        }
        else if (options.autoCrop) msg = '✨ doc_scanner_kit AI Edge Detection isolated document paper from background!';
        else if (options.overrideRotate !== undefined) msg = '🔄 Rotated document by 90° cleanly!';
        else if (options.filterType === 'magic_color') msg = '🌟 doc_scanner_kit Magic Color: Whitened background and sharpened text!';
        else if (options.filterType === 'bw_scan') msg = '📄 doc_scanner_kit B&W Scan: Converted to pure high-contrast document!';
        else if (options.filterType === 'clean_noise') msg = '🧹 doc_scanner_kit Cleaned camera sensor noise and desk table texture!';
        else if (options.filterType === 'grayscale') msg = '✨ Applied professional smoothed grayscale scan mode!';
        else if (options.trimTopPct || options.trimBottomPct || options.trimLeftPct || options.trimRightPct || options.trimAllPct) msg = '✂️ Applied precise doc_scanner_kit boundary frame cut!';
        setPrintSuccessMsg(msg);
        setTimeout(() => setPrintSuccessMsg(null), 4500);
      }
      await loadData();
    } catch (e: any) {
      alert(`Image adjustment failed: ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteFile = async (job: QueueJob) => {
    setApplying(true);
    try {
      // Pass id, fileId, and fileName so deletion completely clears database cache and physical files!
      await api.deleteDocument(job.id, job.fileId, job.fileName);
      if (selectedIdRef.current === job.id || selectedJob?.id === job.id || selectedIdRef.current === job.fileId) {
        selectedIdRef.current = null;
        setSelectedJob(null);
      }
      setPrintSuccessMsg(`🗑️ Permanently deleted [${job.fileName}] and cleared all cache.`);
      setTimeout(() => setPrintSuccessMsg(null), 3500);
      await loadData();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete ALL customer files from the workspace list?")) return;
    setApplying(true);
    try {
      await api.deleteAllDocuments();
      selectedIdRef.current = null;
      setSelectedJob(null);
      setJobs([]);
      setPrintSuccessMsg(`🗑️ Successfully cleared all documents and reset workspace!`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } catch (e: any) {
      console.error("Delete all failed:", e);
    } finally {
      setApplying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await api.uploadFile(files[0]);
      setTimeout(loadData, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 text-[#0f172a]" style={{ color: '#0f172a' }}>
      
      {/* NOTIFICATION BAR FOR NEW DOCUMENTS */}
      {notification.show && (
        <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4 animate-bounce">
          <CheckCircle2 className="w-8 h-8 flex-shrink-0 text-white" />
          <div>
            <h3 className="font-black text-lg">✅ {notification.count} New Document(s) Received!</h3>
            <p className="font-bold text-sm text-emerald-100">Files: {notification.names.join(', ')}</p>
          </div>
        </div>
      )}
      {/* SECTION 1: SHOP HARDWARE PRINTER STATION */}
      <div className="rounded-2xl p-5 shadow-xl border-2 border-slate-300" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3 mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase flex items-center gap-2 flex-wrap">
              <Printer className="w-6 h-6 text-blue-700" />
              <span>Shop Hardware Printer Station • ಶಾಪ್ ಪ್ರಿಂಟರ್ ಸ್ಟೇಷನ್ (USB & Wi-Fi Active)</span>
            </h2>
            <p className="text-sm text-slate-700 font-bold">Desktop Station — Truly online active Wi-Fi printer highlighted below (ಸಂಪರ್ಕ ಹೊಂದಿರುವ ಪ್ರಿಂಟರ್ ಕೆಳಗೆ ಗುರುತಿಸಲಾಗಿದೆ).</p>
          </div>
          <div className="text-sm font-black px-4 py-2 rounded-xl border border-emerald-400 shadow-sm" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
            Active Output / ಸಕ್ರಿಯ ಪ್ರಿಂಟರ್: <span className="underline text-black font-extrabold">{activePrinterName}</span>
          </div>
        </div>

        {/* 2 Hardware Printer Control Cards with LIVE Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* PRINTER 1: EPSON L3110 (USB Only) */}
          {(() => {
            const epsonOnline = printerStatus[EPSON_NAME] === 'Online';
            return (
              <div 
                style={epsonOnline
                  ? { backgroundColor: '#f0fdf4', border: '3px solid #16a34a', boxShadow: '0 0 15px rgba(22, 163, 74, 0.25)' }
                  : { backgroundColor: '#fef2f2', border: '3px solid #dc2626', boxShadow: '0 0 15px rgba(220, 38, 38, 0.2)' }
                }
                className="p-5 rounded-2xl transition-all flex flex-col justify-between shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl shadow-lg" style={{ backgroundColor: epsonOnline ? '#15803d' : '#991b1b', color: '#ffffff' }}>
                      <Printer className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-950 text-lg">EPSON L3110 Series</h3>
                      <p className="text-xs font-black text-slate-600">🔌 USB Only — Color Sublimation Inkjet</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-sm border flex items-center gap-1.5 ${
                    epsonOnline 
                      ? 'border-emerald-500 text-emerald-800' 
                      : 'border-red-500 text-red-800 animate-pulse'
                  }`} style={{ backgroundColor: epsonOnline ? '#dcfce7' : '#fee2e2' }}>
                    {epsonOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
                  </span>
                </div>

                <div className="mt-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${epsonOnline ? 'text-emerald-800 bg-emerald-100 border-2 border-emerald-500 shadow-sm font-black' : 'text-red-800 bg-red-100 border border-red-400 font-black'}`}>
                    {epsonOnline ? '🟢 ONLINE USB PRINTER (READY)' : '🔴 OFFLINE (POWERED OFF / CABLE DISCONNECTED)'}
                  </span>
                </div>

                {testResultMsg[EPSON_NAME] && (
                  <div className="mt-4 p-2.5 rounded-lg border-2 border-slate-400 text-xs font-black text-slate-900 shadow-inner" style={{ backgroundColor: '#ffffff' }}>
                    {testResultMsg[EPSON_NAME]}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={() => handleTestPrinter(EPSON_NAME)}
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition hover:opacity-90 shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Test USB Connection</span>
                  </button>
                  
                  <button
                    onClick={() => setActivePrinterName(EPSON_NAME)}
                    style={activePrinterName === EPSON_NAME 
                      ? { backgroundColor: '#15803d', color: '#ffffff', border: '2px solid #166534' } 
                      : { backgroundColor: '#e2e8f0', color: '#0f172a', border: '2px solid #94a3b8' }
                    }
                    className="py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>{activePrinterName === EPSON_NAME ? '✅ Selected Active' : '👉 Use Epson (ಎಪ್ಸನ್)'}</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* PRINTER 2: HP LASER MFP (USB + Wi-Fi) */}
          {(() => {
            const hpOnline = printerStatus[HP_NAME] === 'Online';
            return (
              <div 
                style={hpOnline
                  ? { backgroundColor: '#f0fdf4', border: '3px solid #16a34a', boxShadow: '0 0 15px rgba(22, 163, 74, 0.25)' }
                  : { backgroundColor: '#fef2f2', border: '3px solid #dc2626', boxShadow: '0 0 15px rgba(220, 38, 38, 0.2)' }
                }
                className="p-5 rounded-2xl transition-all flex flex-col justify-between shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl shadow-lg" style={{ backgroundColor: hpOnline ? '#15803d' : '#991b1b', color: '#ffffff' }}>
                      <Printer className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-950 text-lg">HP Laser MFP 131-138</h3>
                      <p className="text-xs font-black text-slate-600">🔌 USB + 📡 Wi-Fi — Fast Monochrome Laser</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-sm border flex items-center gap-1.5 ${
                    hpOnline 
                      ? 'border-emerald-500 text-emerald-800' 
                      : 'border-red-500 text-red-800 animate-pulse'
                  }`} style={{ backgroundColor: hpOnline ? '#dcfce7' : '#fee2e2' }}>
                    {hpOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
                  </span>
                </div>

                <div className="mt-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${hpOnline ? 'text-emerald-800 bg-emerald-100 border-2 border-emerald-500 shadow-sm font-black' : 'text-red-800 bg-red-100 border border-red-400 font-black'}`}>
                    {hpOnline ? '⭐ PRIMARY ACTIVE LASER PRINTER (READY)' : '🔴 OFFLINE (POWERED OFF / CABLE DISCONNECTED)'}
                  </span>
                </div>

                {testResultMsg[HP_NAME] && (
                  <div className="mt-4 p-2.5 rounded-lg border-2 border-slate-400 text-xs font-black text-slate-900 shadow-inner" style={{ backgroundColor: '#ffffff' }}>
                    {testResultMsg[HP_NAME]}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={() => handleTestPrinter(HP_NAME)}
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition hover:opacity-90 shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Wifi className="w-4 h-4 text-blue-400" />
                    <span>Test USB / Wi-Fi</span>
                  </button>
                  
                  <button
                    onClick={() => setActivePrinterName(HP_NAME)}
                    style={activePrinterName === HP_NAME 
                      ? { backgroundColor: '#15803d', color: '#ffffff', border: '2px solid #166534' } 
                      : { backgroundColor: '#e2e8f0', color: '#0f172a', border: '2px solid #94a3b8' }
                    }
                    className="py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>{activePrinterName === HP_NAME ? '✅ Selected Active' : '👉 Use HP Laser (ಲೇಸರ್)'}</span>
                  </button>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {printSuccessMsg && (
        <div className="p-4 rounded-xl font-black shadow-2xl flex items-center justify-between text-base border-2 border-[#15803d] animate-bounce" style={{ backgroundColor: '#16a34a', color: '#ffffff' }}>
          <span className="flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7" />
            {printSuccessMsg}
          </span>
          <span className="px-3 py-1 rounded text-xs font-mono font-bold uppercase" style={{ backgroundColor: '#052e16', color: '#ffffff' }}>
            SERVER CONFIRMED
          </span>
        </div>
      )}

      {/* SECTION 2: SHOP OPERATOR WORKSPACE (Incoming List + Big Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL (4 cols): Incoming Documents, Sorting Toggle & Delete All */}
        <div className="lg:col-span-4 rounded-2xl shadow-2xl p-5 flex flex-col min-h-[660px] border-2 border-slate-300" style={{ backgroundColor: '#ffffff' }}>
          
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3 mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-700" />
              <span>ಬಂದಿರುವ ಫೈಲ್‌ಗಳು • Incoming Files ({jobs.length})</span>
            </h3>
            
            {/* SORTING TOGGLE BUTTON */}
            <button
              onClick={() => setSortNewest(s => !s)}
              style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase border border-indigo-400 shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-indigo-200 transition"
              title="Click to toggle sorting direction between newest and oldest"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortNewest ? 'ಹೊಸ ಫೈಲ್ ಮೊದಲು ⬇️' : 'ಹಳೆಯ ಫೈಲ್ ಮೊದಲು ⬆️'}</span>
            </button>
          </div>

          {/* Action Buttons: Upload & Delete All */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <label 
              style={{ backgroundColor: '#1e3a8a', color: '#ffffff', border: '2px solid #1e40af' }}
              className="w-full flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer hover:opacity-90 transition text-center"
            >
              <Upload className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{uploading ? 'Processing...' : '📤 UPLOAD (ಅಪ್‌ಲೋಡ್)'}</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleDeleteAll}
              disabled={jobs.length === 0}
              style={jobs.length === 0 ? { backgroundColor: '#94a3b8', color: '#ffffff' } : { backgroundColor: '#dc2626', color: '#ffffff', border: '2px solid #991b1b' }}
              className="w-full flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer hover:bg-red-700 transition text-center disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>🗑️ DELETE ALL (ಡಿಲೀಟ್ ಮಾಡಿ)</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[740px]">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600 font-bold text-sm border-2 border-dashed border-slate-300 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
                No customer documents found in list. Any file downloaded into <strong className="text-slate-900 underline">D:\whatspp</strong> will appear right here at the top!
              </div>
            ) : (
              jobs.map((job) => {
                const isSelected = selectedJob?.id === job.id || selectedJob?.fileId === job.fileId;
                return (
                  <div
                    key={job.fileId || job.id}
                    onClick={() => selectJob(job)}
                    style={isSelected
                      ? { backgroundColor: '#eff6ff', border: '3px solid #1d4ed8', color: '#0f172a' }
                      : { backgroundColor: '#ffffff', border: '2px solid #cbd5e1', color: '#334155' }
                    }
                    className="p-4 rounded-xl text-left cursor-pointer transition-all shadow-md hover:border-slate-400"
                  >
                    <div className="flex items-center justify-between text-base mb-2 font-black text-slate-950">
                      <span className="truncate max-w-[180px] text-black font-extrabold" title={job.fileName}>📄 {job.fileName}</span>
                      
                      {/* INLINE QUICK DELETE BUTTON ON EACH ROW */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(job); }}
                        style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                        className="px-3 py-1.5 rounded-lg hover:bg-red-800 font-black text-xs transition shadow-md flex items-center gap-1 cursor-pointer border border-red-900 shrink-0"
                        title="Permanently Delete This File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                      <span className="px-2 py-0.5 rounded uppercase border border-slate-400 font-extrabold" style={{ backgroundColor: '#f1f5f9', color: '#000000' }}>
                        Status: {job.status}
                      </span>
                      <span className="font-black text-indigo-700 text-sm">{job.copies}x Copy</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL (8 cols): PREVIEW & MANUAL/AUTO CROPPING CONTROLS */}
        <div className="lg:col-span-8 rounded-2xl shadow-2xl p-6 flex flex-col items-center border-2 border-slate-300" style={{ backgroundColor: '#ffffff' }}>
          {!selectedJob ? (
            <div className="w-full h-[640px] flex flex-col items-center justify-center text-center text-slate-600 font-extrabold text-base">
              <FileText className="w-14 h-14 text-slate-400 mb-3" />
              Select a document from the left list to inspect its image, perform manual cropping, and spool hardware prints!
            </div>
          ) : (
            <div className="w-full space-y-6">
              
              {/* Top Controls & Manual Crop Toolbar */}
              <div className="flex flex-col gap-4 p-5 rounded-2xl border-2 border-slate-300 shadow-md" style={{ backgroundColor: '#f8fafc' }}>
                
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                      <span>🖼️ Active Document: <span className="underline text-indigo-700">{selectedJob.fileName}</span></span>
                    </h3>
                    <p className="text-xs font-black text-slate-700">Live 300 DPI image rendering ready for physical hardware tray</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApplyAdjustments({ reset: true })}
                      style={{ backgroundColor: '#475569', color: '#ffffff' }}
                      className="px-3.5 py-2 rounded-xl hover:bg-slate-700 font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md border border-slate-800 cursor-pointer"
                      title="Revert back to original uncropped clean photo"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Image</span>
                    </button>

                    <button
                      onClick={() => handleDeleteFile(selectedJob)}
                      style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                      className="px-4 py-2 rounded-xl hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md border border-red-900 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete File</span>
                    </button>
                  </div>
                </div>

                {/* DOC_SCANNER_KIT COMPLETE FEATURE SUITE OR NATIVE PDF CONTROLS BAR */}
                {(() => {
                  const isPdfFile = selectedJob?.fileName?.toLowerCase().endsWith('.pdf') || selectedJob?.customerFile?.toLowerCase().endsWith('.pdf') || selectedJob?.processedPath?.toLowerCase().endsWith('.pdf') || selectedJob?.originalPath?.toLowerCase().endsWith('.pdf');
                  if (isPdfFile) {
                    return (
                      <div className="p-5 rounded-2xl border-4 border-indigo-500 shadow-2xl w-full flex items-center justify-between flex-wrap gap-4 transition-all" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        <div className="flex items-center gap-3.5">
                          <div className="p-3 bg-emerald-400 text-slate-950 rounded-2xl font-black text-2xl shadow-lg flex items-center justify-center border-2 border-white">
                            <span>📄</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider bg-emerald-400 text-slate-950 shadow-md">
                                ⚡ NATIVE PDF VECTOR ENGINE ACTIVE
                              </span>
                              <span className="text-xs font-extrabold text-cyan-300 font-mono">100% Original Vector Scale</span>
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-300 mt-1">
                              Image photo filters and manual crop boundaries are automatically bypassed for PDFs to maintain pristine full-page resolution.
                            </p>
                          </div>
                        </div>

                        {/* Copies Selector for PDF */}
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-indigo-400 shadow-lg ml-auto" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                          <span className="text-sm font-black text-slate-100 uppercase tracking-wider">Copies:</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={copies}
                            onChange={(e) => setCopies(Number(e.target.value))}
                            style={{ backgroundColor: '#0f172a', color: '#10b981', fontWeight: '900' }}
                            className="w-14 font-black text-center text-lg border-2 border-slate-500 rounded-lg py-1 focus:ring-2 focus:ring-emerald-400 cursor-pointer shadow-inner"
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="w-full space-y-4">
                  
                  {/* Row 1: Document Enhancement Filters (Magic Color, B&W, Noise Removal) */}
                  <div className="p-4 rounded-2xl border-2 border-cyan-500/50 shadow-xl w-full flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-300 mr-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>doc_scanner_kit Filters:</span>
                      </span>

                      <button
                        onClick={() => handleApplyAdjustments({ filterType: 'magic_color' })}
                        style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: '2px solid #818cf8' }}
                        className="px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wide hover:opacity-90 shadow-lg cursor-pointer transform active:scale-95 transition"
                        title="Magic Color Boost: Whitens gray backgrounds and makes print text vivid"
                      >
                        <span>✨ Magic Color Boost</span>
                      </button>

                      <button
                        onClick={() => handleApplyAdjustments({ filterType: 'bw_scan' })}
                        style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '2px solid #64748b' }}
                        className="px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wide hover:bg-slate-700 shadow-lg cursor-pointer transform active:scale-95 transition"
                        title="High Contrast B&W: Removes wood desk texture & shadows completely"
                      >
                        <span>📄 High-Contrast B&W</span>
                      </button>

                      <button
                        onClick={() => handleApplyAdjustments({ filterType: 'clean_noise' })}
                        style={{ backgroundColor: '#059669', color: '#ffffff', border: '2px solid #34d399' }}
                        className="px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wide hover:opacity-90 shadow-lg cursor-pointer transform active:scale-95 transition"
                        title="Clean stains, fingerprint shadows, and camera grain"
                      >
                        <span>🧹 Stain & Noise Clean</span>
                      </button>

                      <button
                        onClick={() => handleApplyAdjustments({ filterType: 'grayscale' })}
                        style={{ backgroundColor: '#475569', color: '#ffffff', border: '2px solid #94a3b8' }}
                        className="px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wide hover:opacity-90 shadow-lg cursor-pointer transform active:scale-95 transition"
                      >
                        <span>🌟 Smooth Grayscale</span>
                      </button>
                    </div>

                    {/* Copies Selector */}
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 border-slate-600 shadow-md ml-auto" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                      <span className="text-xs font-black text-slate-200 uppercase">Copies:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={copies}
                        onChange={(e) => setCopies(Number(e.target.value))}
                        style={{ backgroundColor: '#0f172a', color: '#10b981', fontWeight: '900' }}
                        className="w-12 font-black text-center text-base border-2 border-slate-600 rounded-lg py-0.5 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: AI Edge Detection & Crop Controls */}
                  <div className="p-4 rounded-2xl border-2 border-indigo-500/50 shadow-xl w-full flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: '#111827', color: '#ffffff' }}>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-tight text-cyan-400 mr-1 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-cyan-300" />
                        <span>AI Edge Detection & Crop:</span>
                      </span>

                      <button
                        onClick={() => handleApplyAdjustments({ autoCrop: true })}
                        style={{ backgroundColor: '#0284c7', color: '#ffffff', border: '2px solid #38bdf8' }}
                        className="px-4 py-2 rounded-xl font-black text-xs uppercase tracking-tight hover:opacity-95 shadow-lg cursor-pointer flex items-center gap-2 transform active:scale-95 transition"
                        title="AI automatically detect paper edges against table surfaces"
                      >
                        <span>🤖 AI Auto Edge Crop</span>
                      </button>

                      <button
                        onClick={() => setShowCropBox(!showCropBox)}
                        style={showCropBox ? { backgroundColor: '#10b981', color: '#022c22', border: '2px solid #6ee7b7', fontWeight: '900' } : { backgroundColor: '#334155', color: '#cbd5e1', border: '2px solid #475569' }}
                        className="px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-tight shadow-lg cursor-pointer flex items-center gap-1.5 transition"
                      >
                        <span>{showCropBox ? '🟢 Interactive Border Active' : '⚪ Toggle Crop Border'}</span>
                      </button>

                      <button
                        onClick={() => handleApplyAdjustments({ trimAllPct: 5 })}
                        style={{ backgroundColor: '#334155', color: '#ffffff', border: '1px solid #64748b' }}
                        className="px-3 py-2 rounded-xl font-bold text-xs uppercase hover:bg-slate-700 shadow cursor-pointer transition"
                      >
                        <span>✂️ Trim 5% All Sides</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                      <button
                        onClick={() => handleApplyAdjustments({ overrideRotate: 90 })}
                        style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #475569' }}
                        className="px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-700 flex items-center gap-2 shadow-lg cursor-pointer transform active:scale-95 transition"
                      >
                        <RotateCw className="w-4 h-4 text-emerald-400" />
                        <span>Rotate 90°</span>
                      </button>

                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-700 shadow text-xs font-black" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Bright:</span>
                        <button onClick={() => { setBrightness(b => Number((b + 0.1).toFixed(1))); handleApplyAdjustments({}); }} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600 cursor-pointer">+</button>
                        <span className="text-amber-300 font-mono w-7 text-center">{brightness}x</span>
                        <button onClick={() => { setBrightness(b => Math.max(0.3, Number((b - 0.1).toFixed(1)))); handleApplyAdjustments({}); }} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600 cursor-pointer">-</button>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-700 shadow text-xs font-black" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                        <Contrast className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Contrast:</span>
                        <button onClick={() => { setContrast(c => Number((c + 0.1).toFixed(1))); handleApplyAdjustments({}); }} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600 cursor-pointer">+</button>
                        <span className="text-cyan-300 font-mono w-7 text-center">{contrast}x</span>
                        <button onClick={() => { setContrast(c => Math.max(0.3, Number((c - 0.1).toFixed(1)))); handleApplyAdjustments({}); }} className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600 cursor-pointer">-</button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* DOC_SCANNER_KIT INTERACTIVE CROP MARGIN SLIDERS (No screen-freezing shadows!) */}
                {showCropBox && (
                  <div className="w-full p-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/20 shadow-xl space-y-3 mt-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
                        <span>📐 doc_scanner_kit Manual Edge Frame (Adjust sliders to fit exact paper borders):</span>
                      </span>
                      <button
                        onClick={() => handleApplyAdjustments({ trimTopPct: cropTop, trimBottomPct: cropBottom, trimLeftPct: cropLeft, trimRightPct: cropRight })}
                        disabled={cropTop === 0 && cropBottom === 0 && cropLeft === 0 && cropRight === 0}
                        style={cropTop === 0 && cropBottom === 0 && cropLeft === 0 && cropRight === 0 ? { backgroundColor: '#475569', color: '#94a3b8' } : { backgroundColor: '#10b981', color: '#022c22', fontWeight: '900' }}
                        className="px-5 py-2 rounded-xl text-xs uppercase tracking-wider shadow-lg transition transform active:scale-95 cursor-pointer border border-emerald-300 disabled:cursor-not-allowed"
                      >
                        ✂️ APPLY EDGE CROP ({cropTop + cropBottom}% V, {cropLeft + cropRight}% H)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-extrabold text-slate-200">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                        <div className="flex justify-between mb-1"><span>Top Border:</span><span className="text-emerald-400 font-mono">{cropTop}%</span></div>
                        <input type="range" min="0" max="45" value={cropTop} onChange={(e) => setCropTop(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                        <div className="flex justify-between mb-1"><span>Bottom Border:</span><span className="text-emerald-400 font-mono">{cropBottom}%</span></div>
                        <input type="range" min="0" max="45" value={cropBottom} onChange={(e) => setCropBottom(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                        <div className="flex justify-between mb-1"><span>Left Border:</span><span className="text-emerald-400 font-mono">{cropLeft}%</span></div>
                        <input type="range" min="0" max="45" value={cropLeft} onChange={(e) => setCropLeft(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700">
                        <div className="flex justify-between mb-1"><span>Right Border:</span><span className="text-emerald-400 font-mono">{cropRight}%</span></div>
                        <input type="range" min="0" max="45" value={cropRight} onChange={(e) => setCropRight(Number(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}

                    </>
                  );
                })()}
              </div>

              {/* DOCUMENT & IMAGE PREVIEW BOARD (Dedicated High-Viewport Monitor for PDF vs Standard Image Board) */}
              {(() => {
                const isPdfFile = selectedJob?.fileName?.toLowerCase().endsWith('.pdf') || selectedJob?.customerFile?.toLowerCase().endsWith('.pdf') || selectedJob?.processedPath?.toLowerCase().endsWith('.pdf') || selectedJob?.originalPath?.toLowerCase().endsWith('.pdf');
                if (isPdfFile) {
                  return (
                    <div className="w-full rounded-2xl border-4 border-emerald-400 p-4 md:p-6 flex flex-col relative shadow-[0_0_45px_rgba(16,185,129,0.25)] mt-4 block" style={{ backgroundColor: '#0b1329' }}>
                      <div className="w-full border-2 border-emerald-500 rounded-xl px-5 py-4 mb-4 shadow-xl flex items-center justify-between flex-wrap gap-4" style={{ backgroundColor: '#022c22', color: '#ffffff' }}>
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl font-black">📄</span>
                          <div>
                            <h4 className="font-black text-white text-lg md:text-xl tracking-wide flex items-center gap-2.5 flex-wrap">
                              <span>FULL-PAGE INTERACTIVE PDF STUDIO MONITOR</span>
                              <span className="text-xs px-3 py-1 bg-emerald-400 text-slate-950 rounded-md font-extrabold uppercase shadow-sm">100% Native Vector Scale</span>
                            </h4>
                            <p className="text-xs md:text-sm font-bold text-emerald-200 mt-1">Full vertical document page view with built-in reading toolbar & zero vertical compression!</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-black text-xs md:text-sm uppercase shadow-lg tracking-wider flex items-center gap-2 border border-emerald-300">
                            <span>✨ Direct Hardware Spooling Ready</span>
                          </span>
                        </div>
                      </div>

                      {/* Tall Full-Page Viewer Container (960px height ensures full A4 page readability without awkward scrolling) */}
                      <div className="w-full relative rounded-2xl overflow-hidden border-4 border-slate-700 shadow-2xl block" style={{ height: '960px', minHeight: '960px', backgroundColor: '#525659' }}>
                        <iframe
                          src={`${api.getPreviewUrl(selectedJob.id)}#toolbar=1&view=Fit&navpanes=0`}
                          title="Interactive Full-Page PDF Live Viewer"
                          style={{ width: '100%', height: '960px', minHeight: '960px', border: 'none', display: 'block' }}
                          className="w-full border-none block shadow-inner"
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="w-full rounded-2xl border-4 border-indigo-500/50 p-6 flex flex-col items-center justify-center relative min-h-[500px] shadow-2xl mt-4" style={{ backgroundColor: '#090d16', backgroundImage: 'radial-gradient(at 50% 50%, #111827 0%, #090d16 100%)' }}>
                    <span className="absolute top-4 left-4 font-black text-xs uppercase px-4 py-1.5 rounded-full shadow-lg border border-emerald-400 z-20 flex items-center gap-1.5" style={{ backgroundColor: '#059669', color: '#ffffff' }}>
                      <span>✨ doc_scanner_kit Live Studio Preview</span>
                    </span>
                    
                    <div className="w-full flex items-center justify-center overflow-auto max-h-[680px] py-6 relative select-none">
                      <div className="relative inline-block max-w-full select-none" ref={imgContainerRef}>
                        <img
                          src={`${api.getPreviewUrl(selectedJob.id)}?t=${Date.now()}`}
                          alt="Customer File Live Preview"
                          className="max-h-[490px] w-auto object-contain rounded-lg shadow-2xl transition-all duration-200 border-4 border-slate-300 p-1 block select-none pointer-events-none"
                          style={{ backgroundColor: '#ffffff' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2002/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="100%" height="100%" fill="%23ffffff"/><text x="50%" y="50%" fill="%230f172a" font-size="18" font-weight="bold" text-anchor="middle" font-family="sans-serif">Document Ready for Hardware Print</text></svg>';
                          }}
                        />

                        {/* LOCALIZED doc_scanner_kit INTERACTIVE CROP FRAME WITH MOUSE/TOUCH DRAGGABLE CORNER & EDGE HANDLES */}
                        {showCropBox && (
                          <div 
                            className="absolute border-[3px] border-dashed border-cyan-400 select-none shadow-[0_0_15px_rgba(0,240,255,0.5)_inset]"
                            style={{
                              top: `${cropTop}%`,
                              bottom: `${cropBottom}%`,
                              left: `${cropLeft}%`,
                              right: `${cropRight}%`
                            }}
                          >
                            {/* Top-Left Corner Handle */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'top-left')}
                              style={{ touchAction: 'none' }}
                              className="absolute -top-3.5 -left-3.5 w-7 h-7 bg-emerald-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform flex items-center justify-center z-30"
                              title="Drag corner to frame document"
                            >
                              <div className="w-2 h-2 bg-slate-900 rounded-full" />
                            </div>

                            {/* Top-Right Corner Handle */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'top-right')}
                              style={{ touchAction: 'none' }}
                              className="absolute -top-3.5 -right-3.5 w-7 h-7 bg-emerald-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform flex items-center justify-center z-30"
                              title="Drag corner to frame document"
                            >
                              <div className="w-2 h-2 bg-slate-900 rounded-full" />
                            </div>

                            {/* Bottom-Left Corner Handle */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'bottom-left')}
                              style={{ touchAction: 'none' }}
                              className="absolute -bottom-3.5 -left-3.5 w-7 h-7 bg-emerald-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform flex items-center justify-center z-30"
                              title="Drag corner to frame document"
                            >
                              <div className="w-2 h-2 bg-slate-900 rounded-full" />
                            </div>

                            {/* Bottom-Right Corner Handle */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'bottom-right')}
                              style={{ touchAction: 'none' }}
                              className="absolute -bottom-3.5 -right-3.5 w-7 h-7 bg-emerald-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform flex items-center justify-center z-30"
                              title="Drag corner to frame document"
                            >
                              <div className="w-2 h-2 bg-slate-900 rounded-full" />
                            </div>

                            {/* Top Edge Grab Bar */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'top')}
                              style={{ touchAction: 'none' }}
                              className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 bg-cyan-500 border border-white rounded-full shadow-md cursor-ns-resize hover:scale-110 transition flex items-center justify-center z-30"
                              title="Drag vertical top boundary"
                            >
                              <div className="w-6 h-1 bg-white rounded-full" />
                            </div>

                            {/* Bottom Edge Grab Bar */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'bottom')}
                              style={{ touchAction: 'none' }}
                              className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-16 h-5 bg-cyan-500 border border-white rounded-full shadow-md cursor-ns-resize hover:scale-110 transition flex items-center justify-center z-30"
                              title="Drag vertical bottom boundary"
                            >
                              <div className="w-6 h-1 bg-white rounded-full" />
                            </div>

                            {/* Left Edge Grab Bar */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'left')}
                              style={{ touchAction: 'none' }}
                              className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-16 bg-cyan-500 border border-white rounded-full shadow-md cursor-ew-resize hover:scale-110 transition flex items-center justify-center z-30"
                              title="Drag horizontal left boundary"
                            >
                              <div className="w-1 h-6 bg-white rounded-full" />
                            </div>

                            {/* Right Edge Grab Bar */}
                            <div 
                              onPointerDown={(e) => startDrag(e, 'right')}
                              style={{ touchAction: 'none' }}
                              className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-16 bg-cyan-500 border border-white rounded-full shadow-md cursor-ew-resize hover:scale-110 transition flex items-center justify-center z-30"
                              title="Drag horizontal right boundary"
                            >
                              <div className="w-1 h-6 bg-white rounded-full" />
                            </div>

                            <div className="absolute top-2 right-2 bg-slate-900/90 border border-cyan-400 text-cyan-300 font-extrabold text-[11px] px-2.5 py-1 rounded-lg shadow-lg pointer-events-none uppercase tracking-wide">
                              ⚡ Click & Drag Handles over Document
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* DIRECT HARDWARE PRINT STATION (One click prints immediately without dialogs) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 w-full">
                
                <button
                  onClick={() => handleInstantPrint(HP_NAME)}
                  disabled={applying}
                  style={printerStatus[HP_NAME] === 'Online' 
                    ? { backgroundColor: '#15803d', color: '#ffffff', border: '3px solid #22c55e', boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)' }
                    : { backgroundColor: '#1d4ed8', color: '#ffffff', border: '3px solid #1e3a8a' }}
                  className="w-full py-4 px-5 rounded-2xl hover:opacity-95 font-black text-sm md:text-base uppercase tracking-wider shadow-2xl transform active:scale-95 transition flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Wifi className="w-7 h-7 text-amber-300 animate-pulse flex-shrink-0" />
                  <span className="drop-shadow">{applying ? 'Spooling...' : `🖨️ HP LASER ನಲ್ಲಿ ಪ್ರಿಂಟ್ ಮಾಡಿ (${copies}x) ${printerStatus[HP_NAME] === 'Online' ? '🟢 ONLINE WI-FI' : ''}`}</span>
                </button>

                <button
                  onClick={() => handleInstantPrint(EPSON_NAME)}
                  disabled={applying}
                  style={printerStatus[EPSON_NAME] === 'Online'
                    ? { backgroundColor: '#15803d', color: '#ffffff', border: '3px solid #166534' }
                    : { backgroundColor: '#475569', color: '#cbd5e1', border: '2px solid #64748b' }}
                  className="w-full py-4 px-5 rounded-2xl hover:opacity-95 font-black text-sm md:text-base uppercase tracking-wider shadow-2xl transform active:scale-95 transition flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Printer className="w-7 h-7 text-amber-300 flex-shrink-0" />
                  <span className="drop-shadow">{applying ? 'Spooling...' : `🌈 EPSON ನಲ್ಲಿ ಪ್ರಿಂಟ್ ಮಾಡಿ (${copies}x) ${printerStatus[EPSON_NAME] === 'Online' ? '🟢 ONLINE' : '🔴 OFFLINE'}`}</span>
                </button>

              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
};

