import React, { useEffect, useState } from 'react';
import { api, type QueueJob } from '../../services/client';
import { ListOrdered, Play, RotateCcw, XCircle, Trash2, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export const Queue: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const data = await api.getQueue();
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (id: string) => {
    await api.retryJob(id);
    fetchQueue();
  };

  const handleCancel = async (id: string) => {
    await api.cancelJob(id);
    fetchQueue();
  };

  const handlePriorityChange = async (id: string, prio: number) => {
    await api.setPriority(id, prio);
    fetchQueue();
  };

  const handleClearCompleted = async () => {
    await api.clearQueue();
    fetchQueue();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Printing':
      case 'Processing':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 animate-pulse"><Play className="w-3 h-3" /> {status}</span>;
      case 'Completed':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> {status}</span>;
      case 'Failed':
      case 'Retry':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> {status}</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5"><XCircle className="w-3 h-3" /> {status}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 text-xs font-bold flex items-center gap-1.5"><Clock className="w-3 h-3" /> {status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Live Print Queue Manager</h2>
            <p className="text-xs text-slate-400">Non-blocking asynchronous task queue with automatic 3-attempt failure recovery</p>
          </div>
        </div>

        <button
          onClick={handleClearCompleted}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow hover:scale-105"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          Purge Completed & Failed
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 shadow-xl overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3.5 px-4">Document</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Target Printer</th>
              <th className="py-3.5 px-4 text-center">Copies</th>
              <th className="py-3.5 px-4 text-center">Priority</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-center">Attempts</th>
              <th className="py-3.5 px-4 text-right">Queue Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Print queue is currently empty. Incoming WhatsApp files will stage here automatically.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-white block truncate max-w-[200px]" title={job.fileName}>{job.fileName}</span>
                    <span className="text-[10px] font-mono text-slate-500">ID: {job.id.substring(0, 10)}...</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{job.customerName}</td>
                  <td className="py-3.5 px-4 text-blue-300">{job.printer}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold text-xs">{job.copies}x</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <select
                      value={job.priority}
                      onChange={(e) => handlePriorityChange(job.id, Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="1">1 (Normal)</option>
                      <option value="5">5 (High)</option>
                      <option value="10">10 (Urgent)</option>
                      <option value="20">20 (Override)</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-center flex justify-center">
                    {getStatusBadge(job.status)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                    {job.attempts} / 3
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(job.status === 'Failed' || job.status === 'Cancelled' || job.status === 'Completed') && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          title="Retry Job Now"
                          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-all hover:scale-110"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {(job.status === 'Pending' || job.status === 'Retry') && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          title="Cancel Job"
                          className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 transition-all hover:scale-110"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

