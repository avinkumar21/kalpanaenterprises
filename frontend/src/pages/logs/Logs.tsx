import React, { useEffect, useState } from 'react';
import { api, type LogEntry } from '../../services/client';
import { Activity, Download, Filter, Search, Info, AlertTriangle, XCircle, CheckCircle2, FileText, Sparkles, Printer, RefreshCw } from 'lucide-react';

const CATEGORIES = ['ALL', 'FOLDER_EVENTS', 'FILE_DETECTION', 'ENHANCEMENT', 'CONVERSION', 'PRINTING', 'RETRIES', 'PRINTER_EVENTS', 'SERVICE_EVENTS'];
const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR'];

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [category, setCategory] = useState('ALL');
  const [level, setLevel] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      // Limit to latest 30 simplified activity events so it is never overwhelming!
      const data = await api.getLogs(category, level, 30);
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [category, level]);

  const filteredLogs = logs.filter(l => 
    l.message.toLowerCase().includes(search.toLowerCase()) || 
    (l.details && l.details.toLowerCase().includes(search.toLowerCase()))
  );

  const downloadCsv = () => {
    const headers = 'ID,Timestamp,Level,Category,Message,Details\n';
    const rows = filteredLogs.map(l => 
      `"${l.id}","${l.timestamp}","${l.level}","${l.category}","${l.message.replace(/"/g, '""')}","${(l.details || '').replace(/"/g, '""')}"`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arka_activity_feed_${Date.now()}.csv`;
    a.click();
  };

  // Helper to turn raw categories into friendly human icons & titles
  const getCategoryInfo = (cat: string) => {
    switch (cat) {
      case 'FOLDER_EVENTS':
      case 'FILE_DETECTION':
        return { label: '📥 Incoming WhatsApp File', bg: '#065f46', text: '#a7f3d0', icon: FileText };
      case 'ENHANCEMENT':
      case 'CONVERSION':
        return { label: '✨ AI Edge Crop / Enhancement', bg: '#4c1d95', text: '#d8b4fe', icon: Sparkles };
      case 'PRINTING':
      case 'PRINTER_EVENTS':
        return { label: '🖨️ Hardware Spooler Dispatch', bg: '#1e3a8a', text: '#bfdbfe', icon: Printer };
      case 'RETRIES':
        return { label: '🔄 Automatic Recovery Attempt', bg: '#9a3412', text: '#fde68a', icon: RefreshCw };
      default:
        return { label: `⚙️ ${cat.replace('_', ' ')}`, bg: '#334155', text: '#e2e8f0', icon: Activity };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Friendly Health & Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div style={{ backgroundColor: '#065f46', color: '#ffffff', border: '2px solid #34d399' }} className="p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 shrink-0 animate-pulse" />
          <div>
            <h4 className="font-black text-sm uppercase">24/7 Watcher Loop Active</h4>
            <p className="text-xs text-emerald-100 font-semibold">Listening on D:\WhatsApp with zero latency drops.</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#1e3a8a', color: '#ffffff', border: '2px solid #60a5fa' }} className="p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-cyan-300 shrink-0" />
          <div>
            <h4 className="font-black text-sm uppercase">AI Edge Cropper Online</h4>
            <p className="text-xs text-blue-100 font-semibold">200x200 contrast scanning active for ID cards & receipts.</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#4c1d95', color: '#ffffff', border: '2px solid #c084fc' }} className="p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <Printer className="w-8 h-8 text-purple-300 shrink-0" />
          <div>
            <h4 className="font-black text-sm uppercase">Direct Tray Spooler Ready</h4>
            <p className="text-xs text-purple-100 font-semibold">One-click silent print routing enabled without dialogs.</p>
          </div>
        </div>
      </div>

      {/* Simplified Filter Toolbar */}
      <div style={{ backgroundColor: '#111827', border: '2px solid #3b82f6' }} className="p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4 text-xs font-black">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-cyan-300 text-sm flex items-center gap-1.5 font-black">
            <Filter className="w-4 h-4 text-amber-400" /> Filter Activity Feed:
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #475569' }}
            className="rounded-xl px-3 py-1.5 font-bold cursor-pointer"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'ALL' ? '🌟 Show All Activities' : c.replace('_', ' ')}</option>)}
          </select>

          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #475569' }}
            className="rounded-xl px-3 py-1.5 font-bold cursor-pointer"
          >
            {LEVELS.map(l => <option key={l} value={l}>{l === 'ALL' ? '🛡️ All Levels' : l}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-[220px] justify-end">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recent document events..."
              style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #475569' }}
              className="w-full rounded-xl pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 font-bold"
            />
          </div>

          <button
            onClick={downloadCsv}
            style={{ backgroundColor: '#10b981', color: '#000000' }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs uppercase shadow-md hover:scale-105 transition cursor-pointer border border-white"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Simplified, Clean Activity Feed List (No messy raw data or huge JSON tables!) */}
      <div style={{ backgroundColor: '#090d16', border: '2px solid #334155' }} className="rounded-2xl shadow-2xl overflow-hidden">
        <div style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #475569' }} className="px-5 py-3 text-cyan-300 flex justify-between items-center text-xs font-black uppercase tracking-wider">
          <span>✨ Recent Print Engine Activity & Document Events ({filteredLogs.length} items)</span>
          <span className="flex items-center gap-1 text-emerald-400">🟢 Live Auto-Updating</span>
        </div>

        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold text-sm">
              No activity records match your current search criteria.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';
              const catInfo = getCategoryInfo(log.category);
              const Icon = isError ? XCircle : isWarn ? AlertTriangle : catInfo.icon;

              return (
                <div 
                  key={log.id || index} 
                  style={isError 
                    ? { backgroundColor: '#4c0519', border: '2px solid #f43f5e', color: '#ffffff' } 
                    : isWarn 
                    ? { backgroundColor: '#451a03', border: '2px solid #f97316', color: '#ffffff' }
                    : { backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }
                  }
                  className="p-3.5 rounded-2xl flex items-center justify-between gap-4 transition hover:brightness-110 shadow"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div style={{ backgroundColor: catInfo.bg, color: catInfo.text }} className="p-3 rounded-xl shrink-0 border border-white/20 shadow">
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{ backgroundColor: catInfo.bg, color: catInfo.text }} className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border border-white/20">
                          {catInfo.label}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          🕒 {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : 'Just now'}
                        </span>
                      </div>
                      <p className="text-white font-black text-sm leading-snug break-words truncate">
                        {log.message}
                      </p>
                    </div>
                  </div>

                  <span style={{ backgroundColor: isError ? '#e11d48' : isWarn ? '#f59e0b' : '#3b82f6', color: '#ffffff' }} className="px-3 py-1 rounded-lg font-black text-xs uppercase shrink-0 shadow">
                    {log.level}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

