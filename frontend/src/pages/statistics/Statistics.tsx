import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { BarChart3, TrendingUp, CheckCircle2, AlertTriangle, FileText, Calendar } from 'lucide-react';

export const Statistics: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStatistics().then((res) => {
      setStats(res);
      setLoading(false);
    });
  }, []);

  const totalReceived = stats.reduce((acc, curr) => acc + (curr.totalReceived || 0), 0);
  const totalPrinted = stats.reduce((acc, curr) => acc + (curr.totalPrinted || 0), 0);
  const totalFailed = stats.reduce((acc, curr) => acc + (curr.totalFailed || 0), 0);
  const successRate = totalReceived > 0 ? Math.round((totalPrinted / totalReceived) * 100) : 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cyber Center Printing Analytics & Throughput</h2>
            <p className="text-xs text-slate-400">Historical performance metrics, volume patterns, and automated enhancement success rates</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Documents Processed</span>
          <span className="text-3xl font-black text-blue-400 block mt-2">{totalReceived}</span>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-bold">
            <TrendingUp className="w-3.5 h-3.5" /> All-time intake volume
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Successfully Printed</span>
          <span className="text-3xl font-black text-emerald-400 block mt-2">{totalPrinted}</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Spooled without human action
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">System Success Rate</span>
          <span className="text-3xl font-black text-amber-400 block mt-2">{successRate}%</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full transition-all duration-1000" style={{ width: `${successRate}%` }} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/40 border border-slate-800 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Max Retry Failures</span>
          <span className="text-3xl font-black text-red-400 block mt-2">{totalFailed}</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Quarantined to /failed
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 font-bold text-sm text-slate-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Daily Operational Breakdown (Last 30 Days)
        </div>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3 px-6">Date</th>
              <th className="py-3 px-6 text-center">Files Received</th>
              <th className="py-3 px-6 text-center">Auto-Enhanced (300 DPI)</th>
              <th className="py-3 px-6 text-center">Successful Output</th>
              <th className="py-3 px-6 text-right">Error Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {stats.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                  No statistics generated yet today. Numbers increment automatically as WhatsApp drops arrive.
                </td>
              </tr>
            ) : (
              stats.map((row) => (
                <tr key={row.date} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-6 font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    {row.date}
                  </td>
                  <td className="py-3 px-6 text-center font-mono text-blue-300">{row.totalReceived || 0}</td>
                  <td className="py-3 px-6 text-center font-mono text-amber-300">{row.totalProcessed || 0}</td>
                  <td className="py-3 px-6 text-center font-mono text-emerald-400 font-bold">{row.totalPrinted || 0}</td>
                  <td className="py-3 px-6 text-right font-mono text-red-400">
                    {row.totalReceived ? Math.round(((row.totalFailed || 0) / row.totalReceived) * 100) : 0}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
