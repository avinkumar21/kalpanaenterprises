import React, { useEffect, useState } from 'react';
import { api, type SystemStatus } from '../../services/client';
import { Activity, Printer, FolderCheck, CheckCircle2, AlertTriangle, Clock, Play, FileText, Wifi, ShieldCheck } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await api.fetchStatus();
      setStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-semibold text-gray-400 animate-pulse">Connecting to 24x7 ARKA Print Service...</span>
      </div>
    );
  }

  const isOnline = status.status === 'ONLINE';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Status */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        isOnline 
          ? 'bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/80 border-blue-500/30' 
          : 'bg-red-900/20 border-red-500/40'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl shadow-lg ${isOnline ? 'bg-blue-600/30 text-blue-400' : 'bg-red-600/30 text-red-400'}`}>
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white">ARKA PRINT ENGINE 24×7</h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm ${
                isOnline ? 'bg-emerald-500 text-slate-950 animate-bounce' : 'bg-red-500 text-white'
              }`}>
                {status.status}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300 mt-1">
              Autonomous WhatsApp Document Processing & Intelligent Cyber Center Print Spooler
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 px-4 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Watcher: <strong className="text-white">{status.watcher.active ? 'Active (2s Loop)' : 'Paused'}</strong></span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300">Folder: <code className="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded font-mono">{status.watcher.targetFolder}</code></span>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg hover:border-blue-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Files Today</span>
            <FolderCheck className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{status.metrics.filesToday}</p>
          <span className="text-[11px] font-semibold text-emerald-400 mt-1 block">100% Verified Intake</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active & Pending Jobs</span>
            <Clock className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-amber-400 mt-2">{status.metrics.pendingJobs + status.metrics.printingJobs}</p>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Queue Length: {status.metrics.queueLength}</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg hover:border-emerald-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Today</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-emerald-400 mt-2">{status.metrics.completedToday}</p>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Auto-enhanced 300 DPI</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg hover:border-red-500/40 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Failed / Max Retries</span>
            <AlertTriangle className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-red-400 mt-2">{status.metrics.failedToday}</p>
          <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Archived to /failed</span>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Recent Intake Overview
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/60 text-sm">
                <span className="text-slate-400">Last Received Document:</span>
                <span className="font-semibold text-blue-300 truncate max-w-[220px]">{status.lastFileReceived}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/60 text-sm">
                <span className="text-slate-400">Last Successful Output:</span>
                <span className="font-semibold text-emerald-300 truncate max-w-[220px]">{status.lastPrintedFile}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-slate-400">Connected OS Printers:</span>
                <span className="font-bold text-white bg-blue-600/30 px-2.5 py-0.5 rounded-full text-xs">{status.metrics.activePrinters} Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl flex flex-col">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Play className="w-4 h-4 text-emerald-400" />
            Live Activity Stream (Real-Time)
          </h3>
          {status.recentActivity && status.recentActivity.length > 0 ? (
            <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1">
              {status.recentActivity.map((act, i) => (
                <div key={act.id || i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${act.status === 'Success' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-bold text-slate-200 truncate max-w-[160px]">{act.customerFile}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span>{act.printerName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{act.printTime ? act.printTime.substring(11, 19) : 'Just now'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
              <Printer className="w-8 h-8 opacity-40 mb-2" />
              No recent print activations today. Waiting for customer WhatsApp drops...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

