import React, { useEffect, useState } from 'react';
import { api, HistoryItem } from '../api/client';
import { History as HistoryIcon, Download, RotateCcw, Trash2, FileText, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.getHistory(200);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReprint = async (item: HistoryItem) => {
    setReprintingId(item.id);
    await api.reprint(item.id, item.printerName, item.copies || 1);
    setTimeout(() => {
      setReprintingId(null);
      fetchHistory();
    }, 1000);
  };

  const handleDownload = (type: 'original' | 'processed', id: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.open(api.getDownloadUrl(type, id), '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Print Registry & Document Archive</h2>
            <p className="text-xs text-slate-400">Complete historical audit trail of customer downloads, conversions, and output spooling</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300">
          Total Archived: {history.length} Jobs
        </span>
      </div>

      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3.5 px-4">Date & Time</th>
              <th className="py-3.5 px-4">Customer File</th>
              <th className="py-3.5 px-4">Processed File</th>
              <th className="py-3.5 px-4 text-center">Pages</th>
              <th className="py-3.5 px-4">Printer Output</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Actions (Archive / Reprint)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No print history recorded yet today. Completed jobs will be preserved here permanently.
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const dateObj = item.printTime ? new Date(item.printTime) : new Date();
                const dateStr = dateObj.toLocaleDateString();
                const timeStr = dateObj.toLocaleTimeString();

                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white block text-xs">{dateStr}</span>
                      <span className="text-[10px] font-mono text-slate-400">{timeStr}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-blue-300 block truncate max-w-[180px]" title={item.customerFile}>{item.customerFile}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Original Form</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-200 block truncate max-w-[180px]" title={item.processedPath ? item.processedPath.split(/[\\/]/).pop() : item.customerFile}>
                        {item.processedPath ? item.processedPath.split(/[\\/]/).pop() : `enhanced_${item.customerFile}`}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold">300 DPI A4 Optimized</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {item.pages || 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                        <Printer className="w-3.5 h-3.5 text-blue-400" /> {item.printerName || 'HP Laser'}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.copies || 1} Copy / Minimal Margins</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.status === 'Success' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Failed ({item.retryCount} retries)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleDownload('original', item.id, e)}
                          title="Download Original Unmodified Customer File"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1 hover:scale-105"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-400" /> Original
                        </button>
                        
                        <button
                          onClick={(e) => handleDownload('processed', item.id, e)}
                          title="Download Processed 300 DPI Print Copy"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1 hover:scale-105"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" /> Processed
                        </button>

                        <button
                          onClick={() => handleReprint(item)}
                          disabled={reprintingId === item.id}
                          title="Instant Reprint to default printer"
                          className={`p-1.5 rounded-lg border transition-all hover:scale-110 ${
                            reprintingId === item.id 
                              ? 'bg-amber-500 text-slate-950 border-amber-500 animate-pulse'
                              : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          <RotateCcw className={`w-4 h-4 ${reprintingId === item.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
