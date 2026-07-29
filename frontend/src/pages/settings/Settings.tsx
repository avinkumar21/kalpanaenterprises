import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Settings as SettingsIcon, Save, CheckCircle2, Shield, Folder, Sliders, RefreshCw, Mail, Check, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [imapTestResult, setImapTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestImap = async () => {
    setTestingImap(true);
    setImapTestResult(null);
    try {
      const res = await api.testEmailWatcherConnection({
        user: settings.emailImapUser,
        password: settings.emailImapPassword,
        host: settings.emailImapHost,
        port: settings.emailImapPort,
        tls: settings.emailImapTls
      });
      setImapTestResult(res);
    } catch (e: any) {
      setImapTestResult({ success: false, message: e.message || 'Connection failed' });
    } finally {
      setTestingImap(false);
    }
  };

  useEffect(() => {
    api.getSettings().then((res) => {
      setSettings(res);
      setLoading(false);
    });
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 animate-pulse">Loading administration configuration...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Print Engine Configuration Suite</h2>
            <p className="text-xs text-slate-400">Configure continuous folder watcher targets, enhancement filters, and automation thresholds</p>
          </div>
        </div>

        {savedSuccess && (
          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" /> Configuration Applied Live!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Folder Paths Card (Sapphire/Teal Theme) */}
        <div style={{ backgroundColor: '#0f172a', border: '2px solid #0891b2' }} className="p-6 rounded-2xl shadow-2xl space-y-4">
          <h3 className="text-lg font-black text-cyan-300 flex items-center gap-2.5 border-b border-cyan-800 pb-3 uppercase tracking-wider">
            <Folder className="w-6 h-6 text-cyan-400 animate-bounce" />
            📁 WhatsApp Download & Storage Directory Targets
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-amber-300 block mb-2">1️⃣ WhatsApp Download Folder (Watched 24/7)</label>
              <input
                type="text"
                value={settings.whatsAppFolder || 'D:\\whatspp'}
                onChange={(e) => handleChange('whatsAppFolder', e.target.value)}
                placeholder="e.g. D:\whatspp or C:\Users\Admin\Downloads"
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #38bdf8' }}
                className="w-full rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-inner"
              />
              <span className="text-xs text-cyan-200 block mt-1.5 font-semibold">⚡ Instant detection listens on this physical Windows folder.</span>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 block mb-2">2️⃣ Polling Backup Interval (Milliseconds)</label>
              <input
                type="number"
                value={settings.pollingIntervalMs || 2000}
                onChange={(e) => handleChange('pollingIntervalMs', Number(e.target.value))}
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #34d399' }}
                className="w-full rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
              />
              <span className="text-xs text-emerald-200 block mt-1.5 font-semibold">🛡️ Recommended: 2000 ms (Checks folder every 2 seconds).</span>
            </div>
          </div>
        </div>

        {/* Enhancement & Automation Card (Indigo/Emerald Theme) */}
        <div style={{ backgroundColor: '#0f172a', border: '2px solid #10b981' }} className="p-6 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-lg font-black text-emerald-300 flex items-center gap-2.5 border-b border-emerald-800 pb-3 uppercase tracking-wider">
            <Sliders className="w-6 h-6 text-emerald-400" />
            🤖 Image Enhancement & AI Auto-Crop Automation Rules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div style={{ backgroundColor: '#064e3b', border: '2px solid #34d399' }} className="flex items-center justify-between p-4 rounded-2xl shadow-lg transition hover:scale-[1.02]">
              <div>
                <span className="text-sm font-black text-white block">🚀 Instant Auto Print</span>
                <span className="text-xs text-emerald-200 font-semibold block mt-0.5">Spool directly without waiting</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableAutoPrint !== false}
                onChange={(e) => handleChange('enableAutoPrint', e.target.checked)}
                className="w-6 h-6 accent-emerald-400 cursor-pointer rounded-lg"
              />
            </div>

            <div style={{ backgroundColor: '#1e3a8a', border: '2px solid #60a5fa' }} className="flex items-center justify-between p-4 rounded-2xl shadow-lg transition hover:scale-[1.02]">
              <div>
                <span className="text-sm font-black text-white block">✂️ AI Edge Auto-Crop</span>
                <span className="text-xs text-blue-200 font-semibold block mt-0.5">Slices table & desk backgrounds</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableEnhancement !== false}
                onChange={(e) => handleChange('enableEnhancement', e.target.checked)}
                className="w-6 h-6 accent-cyan-400 cursor-pointer rounded-lg"
              />
            </div>

            <div style={{ backgroundColor: '#4c1d95', border: '2px solid #c084fc' }} className="flex items-center justify-between p-4 rounded-2xl shadow-lg transition hover:scale-[1.02]">
              <div>
                <span className="text-sm font-black text-white block">🔍 OCR Document Scan</span>
                <span className="text-xs text-purple-200 font-semibold block mt-0.5">Extract searchable PDF words</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableOCR === true}
                onChange={(e) => handleChange('enableOCR', e.target.checked)}
                className="w-6 h-6 accent-purple-400 cursor-pointer rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-amber-300 block mb-2">🎨 Enhancement Cleansing Level</label>
              <select
                value={settings.imageEnhancementLevel || 'Moderate'}
                onChange={(e) => handleChange('imageEnhancementLevel', e.target.value)}
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #f59e0b' }}
                className="w-full rounded-xl px-4 py-3 font-bold text-sm focus:outline-none cursor-pointer"
              >
                <option value="Low">Low (Minimal Alteration)</option>
                <option value="Moderate">Moderate (Contrast & Brightness Boost)</option>
                <option value="High">High (Sharpen + Text Cleansing)</option>
                <option value="Aggressive">Aggressive (Maximum White Background Clean)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-cyan-300 block mb-2">📑 Default Copies Count</label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.copies || 1}
                onChange={(e) => handleChange('copies', Number(e.target.value))}
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #38bdf8' }}
                className="w-full rounded-xl px-4 py-3 font-extrabold text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-purple-300 block mb-2">📄 Paper Margin & Orientation</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled
                  value="300 DPI A4 High-Resolution Canvas"
                  style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '2px solid #a855f7' }}
                  className="w-full rounded-xl px-4 py-3 font-bold text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* EMAIL ATTACHMENT DOWNLOADER SUITE CARD (Purple/Gold Theme) */}
        <div style={{ backgroundColor: '#0f172a', border: '2px solid #8b5cf6' }} className="p-6 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-purple-800 pb-3 flex-wrap gap-4">
            <h3 className="text-lg font-black text-purple-300 flex items-center gap-2.5 uppercase tracking-wider">
              <Mail className="w-6 h-6 text-purple-400 animate-pulse" />
              📧 Automated Email Attachment Downloader Suite
            </h3>
            <div style={{ backgroundColor: '#2e1065', border: '2px solid #a855f7' }} className="flex items-center gap-3 px-4 py-2 rounded-xl shadow-lg">
              <span className="text-xs font-black text-white uppercase tracking-wide">Enable 24/7 IMAP Poller:</span>
              <input
                type="checkbox"
                checked={settings.enableEmailWatcher === true}
                onChange={(e) => handleChange('enableEmailWatcher', e.target.checked)}
                className="w-5 h-5 accent-purple-400 cursor-pointer rounded"
              />
            </div>
          </div>

          <p className="text-xs text-purple-200 font-bold">
            Automatically extracts customer email attachments (PDF, PNG, JPG, DOCX) directly into your watched WhatsApp directory (<strong className="text-white underline">{settings.whatsAppFolder || 'D:\\whatspp'}</strong>) for seamless 100% automated spooling!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-amber-300 block mb-2">Host (IMAP Server Address)</label>
              <input
                type="text"
                value={settings.emailImapHost || 'imap.gmail.com'}
                onChange={(e) => handleChange('emailImapHost', e.target.value)}
                placeholder="e.g. imap.gmail.com or imap.outlook.com"
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #a855f7' }}
                className="w-full rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-cyan-300 block mb-2">Shop Inbox Email Address</label>
              <input
                type="text"
                value={settings.emailImapUser || ''}
                onChange={(e) => handleChange('emailImapUser', e.target.value)}
                placeholder="e.g. print@kalpanaenterprise.com"
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #38bdf8' }}
                className="w-full rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-emerald-300 block mb-2">App Password / Auth Key</label>
              <input
                type="password"
                value={settings.emailImapPassword || ''}
                onChange={(e) => handleChange('emailImapPassword', e.target.value)}
                placeholder="Enter App Password (16 chars for Gmail)"
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #34d399' }}
                className="w-full rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
              />
              <span className="text-[10px] text-emerald-200 block mt-1">🔒 Stored locally in default-settings.json</span>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-300 uppercase">Check interval: every</span>
              <input
                type="number"
                min="10"
                max="300"
                value={settings.emailPollingIntervalSec || 30}
                onChange={(e) => handleChange('emailPollingIntervalSec', Number(e.target.value))}
                style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #64748b' }}
                className="w-20 px-2 py-1.5 rounded-lg text-center font-black text-sm"
              />
              <span className="text-xs font-bold text-slate-300 uppercase">seconds (Unread Only)</span>
            </div>

            <button
              type="button"
              onClick={handleTestImap}
              disabled={testingImap}
              style={{ backgroundColor: '#4c1d95', color: '#ffffff', border: '2px solid #c084fc' }}
              className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition hover:opacity-90 shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testingImap ? 'animate-spin' : ''}`} />
              <span>{testingImap ? 'Testing IMAP Authentication...' : '🔌 Test Live Inbox Connection'}</span>
            </button>
          </div>

          {imapTestResult && (
            <div style={{
              backgroundColor: imapTestResult.success ? '#064e3b' : '#7f1d1d',
              border: `2px solid ${imapTestResult.success ? '#34d399' : '#f87171'}`,
              color: '#ffffff'
            }} className="p-4 rounded-xl font-bold text-sm flex items-center gap-3 shadow-lg">
              {imapTestResult.success ? <Check className="w-5 h-5 text-emerald-300 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />}
              <span>{imapTestResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'linear-gradient(to right, #059669, #10b981)', color: '#000000', border: '2px solid #ffffff' }}
            className="px-10 py-4 rounded-2xl font-black text-base uppercase tracking-wider transition shadow-2xl hover:scale-105 flex items-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving System Rules...' : '💾 Save & Apply Live Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
