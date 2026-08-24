import React, { useState } from 'react';
import { CustomerPrintDashboard } from './CustomerPrintDashboard';
import { Settings } from './settings/Settings';
import { Logs } from './logs/Logs';
import { Printers } from './printers/Printers';
import { CustomerUploadPortal } from './upload/CustomerUploadPortal';
import { Printer, Settings as SettingsIcon, Sparkles, ChevronDown, ChevronUp, Layers, Terminal, Bell, X, CheckCircle2 } from 'lucide-react';
import { api } from '../services/client';

export const PrintsModule: React.FC = () => {
  const checkIsKiosk = () => {
    if (typeof window !== 'undefined') {
      const href = window.location.href.toLowerCase();
      const hostname = window.location.hostname.toLowerCase();
      return hostname.includes('trycloudflare.com') || 
             hostname.includes('loca.lt') || 
             hostname.includes('tunnel') || 
             href.includes('kiosk') || 
             href.includes('mode=customer') || 
             href.includes('customer-scan');
    }
    return false;
  };

  const [isCustomerKiosk, setIsCustomerKiosk] = useState(checkIsKiosk);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && (checkIsKiosk() || window.location.hash.includes('upload') || window.location.pathname.includes('upload'))) {
      return 'upload';
    }
    return 'studio';
  });
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(true);
  const [section3Open, setSection3Open] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState<{ fileName: string; timestamp: string } | null>(null);
  const [lastKnownFile, setLastKnownFile] = useState<string | null>(null);

  React.useEffect(() => {
    if (isCustomerKiosk) return; // Ignore operator notification banners in customer QR scan mode

    let isMounted = true;
    const checkNewFiles = async () => {
      try {
        const status = await api.fetchStatus();
        if (isMounted && status && status.lastFileReceived && status.lastFileReceived !== 'None yet' && status.lastFileReceived !== 'Service offline') {
          setLastKnownFile(prev => {
            if (prev !== null && prev !== status.lastFileReceived) {
              setIncomingAlert({
                fileName: status.lastFileReceived,
                timestamp: new Date().toLocaleTimeString()
              });
            }
            return status.lastFileReceived;
          });
        }
      } catch (e) {}
    };

    checkNewFiles();
    const interval = setInterval(checkNewFiles, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isCustomerKiosk]);

  React.useEffect(() => {
    const handleNavigationChange = () => {
      const isKiosk = checkIsKiosk();
      setIsCustomerKiosk(isKiosk);
      if (isKiosk || window.location.hash.includes('upload')) {
        setActiveTab('upload');
      }
    };
    window.addEventListener('hashchange', handleNavigationChange);
    window.addEventListener('popstate', handleNavigationChange);
    return () => {
      window.removeEventListener('hashchange', handleNavigationChange);
      window.removeEventListener('popstate', handleNavigationChange);
    };
  }, []);

  // STRICT RECEPTION LOCK: Walk-in customers scanning QR code see ONLY the document upload portal!
  if (isCustomerKiosk) {
    return (
      <div className="min-h-screen font-sans py-6 px-3 md:py-10" style={{ backgroundColor: '#070b14', backgroundImage: 'radial-gradient(at 50% 10%, #171c35 0%, #070b14 85%)', color: '#f8fafc' }}>
        <CustomerUploadPortal isCustomerKiosk={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans pb-16" style={{ backgroundColor: '#070b14', backgroundImage: 'radial-gradient(at 20% 10%, #171c35 0%, #070b14 85%)', color: '#f8fafc' }}>
      
      {/* HIGH-CONTRAST VIBRANT SOLID COLOR BANNER HEADER */}
      <header className="shadow-2xl px-6 py-4 sticky top-0 z-50 border-b-4 border-indigo-500/60" style={{ backgroundColor: '#111827', backgroundImage: 'linear-gradient(to right, #111827, #1e1b4b, #111827)', color: '#ffffff' }}>
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          
          {/* Left Brand Banner Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl shadow-lg border border-indigo-400" style={{ backgroundColor: '#4338ca', color: '#ffffff' }}>
              <Printer className="w-7 h-7 animate-pulse text-amber-300" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase drop-shadow-md text-white">
                ⚡ ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್ • KALPANA ENTERPRISES <span className="text-indigo-400">|</span> AUTO WHATSAPP PRINT ENGINE V2
              </h1>
              <span className="px-3.5 py-1 rounded-full font-black text-xs uppercase tracking-wider shadow-md border border-emerald-500" style={{ backgroundColor: '#059669', color: '#ffffff' }}>
                🟢 24/7 SERVER ONLINE (ಸರ್ವರ್ ಆನ್‌ಲೈನ್)
              </span>
            </div>
          </div>

          {/* High-Contrast Navigation Tabs (RESTRICTED WHEN IN CUSTOMER KIOSK MODE) */}
          {isCustomerKiosk ? (
            <div className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-black text-sm border-2 border-emerald-400 shadow-xl" style={{ backgroundColor: '#064e3b', color: '#ffffff' }}>
              <Layers className="w-5 h-5 text-emerald-300 animate-bounce" />
              <span className="font-extrabold tracking-wide uppercase">🛡️ SECURE CUSTOMER INTAKE (ಗ್ರಾಹಕರ ಫೈಲ್ ಡ್ರಾಪ್ ಮಾತ್ರ)</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setActiveTab('studio')}
                style={activeTab === 'studio' 
                  ? { backgroundColor: '#4f46e5', color: '#ffffff', border: '3px solid #6366f1', boxShadow: '0 0 15px rgba(99, 102, 241, 0.6)' }
                  : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }
                }
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition shadow-xl cursor-pointer hover:scale-105"
              >
                <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse flex-shrink-0" />
                <span className="font-extrabold tracking-wide">🖨️ OPERATOR STUDIO (ಆಪರೇಟರ್ ಸ್ಟುಡಿಯೋ)</span>
              </button>

              <button
                onClick={() => { setActiveTab('upload'); if (typeof window !== 'undefined') window.location.hash = 'operator-upload'; }}
                style={activeTab === 'upload' 
                  ? { backgroundColor: '#059669', color: '#ffffff', border: '3px solid #34d399', boxShadow: '0 0 15px rgba(52, 211, 153, 0.6)' }
                  : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }
                }
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition shadow-xl cursor-pointer hover:scale-105"
              >
                <Layers className="w-5 h-5 text-emerald-300 animate-bounce flex-shrink-0" />
                <span className="font-extrabold tracking-wide">📱 CUSTOMER UPLOAD (ಗ್ರಾಹಕರ ಅಪ್‌ಲೋಡ್)</span>
              </button>

              <button
                onClick={() => { setActiveTab('admin'); if (typeof window !== 'undefined') window.location.hash = ''; }}
                style={activeTab === 'admin' 
                  ? { backgroundColor: '#0891b2', color: '#ffffff', border: '3px solid #06b6d4', boxShadow: '0 0 15px rgba(6, 182, 212, 0.6)' }
                  : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }
                }
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition shadow-xl cursor-pointer hover:scale-105"
              >
                <SettingsIcon className="w-5 h-5 text-cyan-300 flex-shrink-0" />
                <span className="font-extrabold tracking-wide">⚙️ ADVANCED SETUP (ಅಡ್ಮಿನ್ ಸೆಟಪ್)</span>
              </button>
            </div>
          )}

        </div>
      </header>

      {/* REAL-TIME LIVE INCOMING FILE MESSAGE BANNER */}
      {incomingAlert && (
        <div className="max-w-[1700px] mx-auto mt-4 px-4 md:px-6">
          <div className="p-5 rounded-2xl shadow-[0_0_45px_rgba(217,70,239,0.65)] border-4 border-yellow-300 flex items-center justify-between flex-wrap gap-4 transition-all z-50 transform hover:scale-[1.01]" style={{ backgroundImage: 'linear-gradient(135deg, #31105c 0%, #701a75 50%, #9d174d 100%)', color: '#ffffff' }}>
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-yellow-300 text-slate-950 rounded-2xl shadow-xl font-black animate-bounce flex items-center justify-center border-2 border-white">
                <Bell className="w-9 h-9 fill-slate-950 stroke-slate-950 text-slate-950 flex-shrink-0" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider bg-yellow-300 text-slate-950 shadow-md flex items-center gap-1">
                    <span>⚡ ತುರ್ತು: ಹೊಸ ಡಾಕ್ಯುಮೆಂಟ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ • URGENT INCOMING FILE</span>
                  </span>
                  <span className="text-xs font-extrabold text-yellow-200 px-2.5 py-0.5 bg-black/40 rounded-lg border border-yellow-400/30">
                    🕒 ಸಮಯ / Received: {incomingAlert.timestamp}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white tracking-wide mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] break-all flex items-center gap-2">
                  <span className="text-yellow-300 font-mono">📁</span>
                  <span>{incomingAlert.fileName}</span>
                </h3>
                <p className="text-xs md:text-sm font-bold text-pink-100 mt-1 drop-shadow flex items-center gap-1.5">
                  <span>✨ ಫೈಲ್ <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-yellow-200 font-black border border-pink-400/30">prints/</span> ಫೋಲ್ಡರ್‌ಗೆ ತಲುಪಿದೆ ಮತ್ತು ಪ್ರಿಂಟ್‌ಗೆ ಸಿದ್ಧವಾಗಿದೆ!</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={() => { setActiveTab('studio'); setIncomingAlert(null); if (typeof window !== 'undefined') window.location.hash = ''; }}
                className="px-6 py-3 rounded-xl font-black text-sm uppercase shadow-[0_4px_20px_rgba(253,224,71,0.5)] hover:scale-105 transition transform active:scale-95 border-2 border-white cursor-pointer flex items-center gap-2"
                style={{ backgroundColor: '#fde047', color: '#0f172a' }}
              >
                <span className="text-lg">🖨️</span>
                <span>Open in Studio (ಸ್ಟುಡಿಯೋದಲ್ಲಿ ತೆರೆಯಿರಿ)</span>
              </button>
              <button
                onClick={() => setIncomingAlert(null)}
                className="p-2.5 rounded-xl hover:bg-black/40 transition cursor-pointer text-pink-200 hover:text-white border border-transparent hover:border-pink-300/50"
                title="Dismiss notification banner"
              >
                <X className="w-7 h-7 font-extrabold" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Render Area */}
      <main className="max-w-[1700px] mx-auto p-4 md:p-6 mt-4">
        {isCustomerKiosk || activeTab === 'upload' ? (
          <CustomerUploadPortal isCustomerKiosk={isCustomerKiosk} />
        ) : activeTab === 'studio' ? (
          <CustomerPrintDashboard />
        ) : (
          <div className="space-y-6 p-6 rounded-3xl shadow-2xl border-2 border-indigo-500/50" style={{ backgroundColor: '#0c1322', color: '#ffffff', backgroundImage: 'radial-gradient(ellipse at 50% 20%, #1a2035 0%, #0c1322 80%)' }}>
            
            {/* Page Header Banner */}
            <div className="border-b-2 border-indigo-900/80 pb-4 flex items-center justify-between flex-wrap gap-4 px-2">
              <div>
                <h2 className="text-3xl font-black text-white flex items-center gap-3 drop-shadow-md">
                  <span className="p-3 rounded-2xl shadow-lg border-2 border-amber-400 text-white" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}>⚙️</span>
                  <span>Admin Diagnostics & Hardware System Configuration</span>
                </h2>
                <p className="text-sm font-bold text-cyan-300 mt-1">Collapsible interactive panels designed with dual-color palettes and clear visual separation.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setSection1Open(true); setSection2Open(true); setSection3Open(true); }}
                  style={{ backgroundColor: '#1e3a8a', color: '#93c5fd' }}
                  className="px-3.5 py-1.5 font-black text-xs rounded-xl uppercase tracking-wider border border-blue-400 hover:bg-blue-800 transition cursor-pointer shadow"
                >
                  Expand All Sections
                </button>
                <button 
                  onClick={() => { setSection1Open(false); setSection2Open(false); setSection3Open(false); }}
                  style={{ backgroundColor: '#334155', color: '#e2e8f0' }}
                  className="px-3.5 py-1.5 font-black text-xs rounded-xl uppercase tracking-wider border border-slate-400 hover:bg-slate-700 transition cursor-pointer shadow"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* SECTION 1: HARDWARE PRINTER ASSIGNMENT ACCORDION (DUAL-COLOR BLUE/CYAN HEADER) */}
            <div className="rounded-2xl border-2 border-cyan-500/60 overflow-hidden shadow-2xl transition-all duration-300" style={{ backgroundColor: '#0f172a' }}>
              <button
                onClick={() => setSection1Open(!section1Open)}
                style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%)' }}
                className="w-full px-6 py-4 flex items-center justify-between cursor-pointer text-left transition hover:brightness-110 shadow-md border-b border-cyan-400/30"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-white text-blue-900 font-black rounded-xl text-lg shadow-inner">🖨️</span>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide">Section 1: Windows Printer Readiness & Role Assignment</h3>
                    <p className="text-xs font-bold text-cyan-100">Zero-configuration physical hardware spooler detection & assignment</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-lg shadow border border-amber-200">
                    {section1Open ? 'Panel Expanded' : 'Click To Expand'}
                  </span>
                  {section1Open ? <ChevronUp className="w-6 h-6 text-white" /> : <ChevronDown className="w-6 h-6 text-white" />}
                </div>
              </button>
              {section1Open && (
                <div className="p-6 bg-slate-900/90 border-t border-slate-800">
                  <Printers />
                </div>
              )}
            </div>

            {/* SECTION 2: PRINT ENGINE & WHATSAPP DIRECTORY SUITE ACCORDION (DUAL-COLOR EMERALD/TEAL HEADER) */}
            <div className="rounded-2xl border-2 border-emerald-500/60 overflow-hidden shadow-2xl transition-all duration-300" style={{ backgroundColor: '#0f172a' }}>
              <button
                onClick={() => setSection2Open(!section2Open)}
                style={{ background: 'linear-gradient(135deg, #065f46 0%, #0d9488 100%)' }}
                className="w-full px-6 py-4 flex items-center justify-between cursor-pointer text-left transition hover:brightness-110 shadow-md border-b border-emerald-400/30"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-white text-emerald-950 font-black rounded-xl text-lg shadow-inner">⚡</span>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide">Section 2: Print Engine Configuration & WhatsApp Folder Suite</h3>
                    <p className="text-xs font-bold text-emerald-100">Manage watched directories, polling rates, AI auto-crop triggers, and default printing rules</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-lg shadow border border-amber-200">
                    {section2Open ? 'Panel Expanded' : 'Click To Expand'}
                  </span>
                  {section2Open ? <ChevronUp className="w-6 h-6 text-white" /> : <ChevronDown className="w-6 h-6 text-white" />}
                </div>
              </button>
              {section2Open && (
                <div className="p-6 bg-slate-900/90 border-t border-slate-800">
                  <Settings />
                </div>
              )}
            </div>

            {/* SECTION 3: SIMPLIFIED SYSTEM TELEMETRY ACCORDION (DUAL-COLOR AMBER/ORANGE HEADER - COLLAPSED BY DEFAULT) */}
            <div className="rounded-2xl border-2 border-amber-500/60 overflow-hidden shadow-2xl transition-all duration-300" style={{ backgroundColor: '#0f172a' }}>
              <button
                onClick={() => setSection3Open(!section3Open)}
                style={{ background: 'linear-gradient(135deg, #9a3412 0%, #d97706 100%)' }}
                className="w-full px-6 py-4 flex items-center justify-between cursor-pointer text-left transition hover:brightness-110 shadow-md border-b border-amber-400/30"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-white text-amber-950 font-black rounded-xl text-lg shadow-inner">📊</span>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide">Section 3: Simplified System Telemetry & Activity Audit Feed</h3>
                    <p className="text-xs font-bold text-amber-100">Clean, easy-to-read real-time summary of incoming files and print operations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-900 text-amber-300 font-black text-xs uppercase rounded-lg shadow border border-amber-400">
                    {section3Open ? 'Panel Expanded' : 'Click To Expand'}
                  </span>
                  {section3Open ? <ChevronUp className="w-6 h-6 text-white" /> : <ChevronDown className="w-6 h-6 text-white" />}
                </div>
              </button>
              {section3Open && (
                <div className="p-6 bg-slate-900/90 border-t border-slate-800">
                  <Logs />
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default PrintsModule;

