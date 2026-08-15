import React, { useEffect, useState } from 'react';
import { api, PrinterInfo } from '../../services/client';
import { Printer, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Play, Radio, Info } from 'lucide-react';

export const Printers: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchPrinters = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const data = await api.getPrinters(force);
      setPrinters(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    setTestResult(null);
    try {
      const res = await api.testPrinter(printerName);
      setTestResult(res.message || `Test instruction dispatched to ${printerName}`);
    } catch (e: any) {
      setTestResult(`Test error: ${e.message}`);
    } finally {
      setTestingPrinter(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const setRole = async (printerName: string, role: 'primaryPrinter' | 'secondaryPrinter' | 'fallbackPrinter') => {
    const current = await api.getSettings();
    const next = { ...current, [role]: printerName };
    await api.saveSettings(next);
    fetchPrinters();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Windows Printer Readiness & Role Assignment</h2>
            <p className="text-xs text-slate-400">Zero-configuration real-time hardware detection via native OS spooler interrogation</p>
          </div>
        </div>

        <button
          onClick={() => fetchPrinters(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg hover:scale-105 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Scanning Windows Spooler...' : 'Refresh Hardware List'}
        </button>
      </div>

      {testResult && (
        <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-cyan-400 font-extrabold animate-pulse text-base">
            🔍 Interrogating physical Windows spooler print hardware...
          </div>
        ) : printers
          .filter(p => {
            const l = (p.name || '').toLowerCase();
            return !['onenote', 'print to pdf', 'generic', 'text only', 'fax', 'xps', 'copy 1'].some(kw => l.includes(kw));
          })
          .map((p) => {
          const isReady = p.status === 'Ready';
          const isPaperOut = p.status.includes('Paper Out');
          
          return (
            <div
              key={p.name}
              style={isReady 
                ? { backgroundColor: '#0f172a', background: 'linear-gradient(to bottom right, #0f172a, #1a243b)', border: '2px solid #06b6d4', boxShadow: '0 8px 25px rgba(6, 182, 212, 0.15)' }
                : { backgroundColor: '#31101b', background: 'linear-gradient(to bottom right, #31101b, #1f0a12)', border: '2px solid #e11d48', opacity: 0.95 }
              }
              className="p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div style={isReady ? { backgroundColor: '#065f46', color: '#6ee7b7' } : { backgroundColor: '#881337', color: '#fda4af' }} className="p-3.5 rounded-2xl shadow border border-white/20">
                      <Printer className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-base leading-tight drop-shadow">{p.name}</h3>
                      <span className="text-xs text-cyan-300 block mt-1 font-bold">{p.driverName || 'Standard Driver'}</span>
                    </div>
                  </div>
                  
                  {isReady ? (
                    <span style={{ backgroundColor: '#065f46', color: '#a7f3d0' }} className="px-3 py-1.5 rounded-xl border border-emerald-400 text-xs font-black flex items-center gap-1.5 uppercase tracking-wider shrink-0 shadow-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Online
                    </span>
                  ) : isPaperOut ? (
                    <span style={{ backgroundColor: '#b45309', color: '#fef3c7' }} className="px-3 py-1.5 rounded-xl border border-amber-400 text-xs font-black flex items-center gap-1.5 uppercase tracking-wider shrink-0 animate-pulse shadow-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-300" /> Paper Out
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#881337', color: '#ffe4e6' }} className="px-3 py-1.5 rounded-xl border border-rose-400 text-xs font-black flex items-center gap-1.5 uppercase tracking-wider shrink-0 shadow-lg">
                      <AlertTriangle className="w-4 h-4 text-rose-300" /> Offline
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-3 pt-4 border-t border-slate-700 text-xs font-extrabold">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-cyan-200 font-bold">1️⃣ Primary Output Target:</span>
                    <button
                      onClick={() => setRole(p.name, 'primaryPrinter')}
                      style={p.isPrimary ? { backgroundColor: '#10b981', color: '#000000', border: '1px solid #ffffff', boxShadow: '0 0 10px #10b981' } : { backgroundColor: '#1e293b', color: '#cbd5e1' }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer text-xs uppercase"
                    >
                      <Radio className="w-3.5 h-3.5" /> {p.isPrimary ? '✅ Assigned Primary' : 'Assign'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-blue-200 font-bold">2️⃣ Secondary Backup Device:</span>
                    <button
                      onClick={() => setRole(p.name, 'secondaryPrinter')}
                      style={p.isSecondary ? { backgroundColor: '#3b82f6', color: '#ffffff', border: '1px solid #93c5fd', boxShadow: '0 0 10px #3b82f6' } : { backgroundColor: '#1e293b', color: '#cbd5e1' }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer text-xs uppercase"
                    >
                      <Radio className="w-3.5 h-3.5" /> {p.isSecondary ? '✅ Assigned Backup' : 'Assign'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between">
                {p.isDefault ? (
                  <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd' }} className="px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 uppercase tracking-wider border border-blue-400">
                    <ShieldCheck className="w-4 h-4 text-amber-300" /> Windows Default
                  </span>
                ) : <span />}

                <button
                  onClick={() => handleTestPrint(p.name)}
                  disabled={testingPrinter === p.name}
                  style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: '#ffffff' }}
                  className="px-4 py-2.5 rounded-xl text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg hover:scale-105 disabled:opacity-50 cursor-pointer border border-indigo-300"
                >
                  <Play className={`w-4 h-4 text-amber-300 ${testingPrinter === p.name ? 'animate-spin' : ''}`} />
                  {testingPrinter === p.name ? 'Testing Spooler...' : 'Print Test Page'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

