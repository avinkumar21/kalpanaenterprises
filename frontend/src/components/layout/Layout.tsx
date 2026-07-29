import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from 'react-error-boundary';
import { Menu, X, Bell, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { AIChat } from '../ai/AIChat';
import { useTranslation } from 'react-i18next';
import { useUpdates } from '../../store/useUpdates';


function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-6 text-center border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-lg my-10">
      <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Something went wrong</h2>
      <p className="text-sm text-red-600 dark:text-red-300 mb-4">{error.message}</p>
      <button 
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-[var(--radius-sm)] font-medium text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isScrolled, setIsScrolled] = useState(false);

  // Updates store state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { updates, readUpdateIds, loading, runDeltaSync, markAllAsRead } = useUpdates();

  // Lazy loading updates: only load when drawer is opened
  useEffect(() => {
    if (drawerOpen) {
      runDeltaSync();
      markAllAsRead(); // mark as read once opened
    }
  }, [drawerOpen, runDeltaSync, markAllAsRead]);

  // Compute unread count dynamically
  const unreadCount = useMemo(() => {
    return updates.filter(u => !readUpdateIds.includes(u.id)).length;
  }, [updates, readUpdateIds]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
    localStorage.setItem('gravity-lang', newLang);
  };

  // Drawer Category definition list
  const drawerCategories = [
    { id: 'all', label: 'All' },
    { id: 'central', label: 'Central Govt', catId: 'uc_central' },
    { id: 'state', label: 'State Govt', catId: 'uc_karnataka' },
    { id: 'temple', label: 'Temple', catId: 'uc_temple' },
    { id: 'travel', label: 'Travel Permits', catId: 'uc_travel' },
    { id: 'recruitment', label: 'Recruitment', catId: 'uc_recruitment' },
    { id: 'education', label: 'Education', catId: 'uc_education' },
    { id: 'health', label: 'Health', catId: 'uc_health' },
    { id: 'agriculture', label: 'Agriculture', catId: 'uc_agriculture' },
    { id: 'utilities', label: 'Utilities', catId: 'uc_utility' }
  ];

  // Filter drawer updates list by search and category
  const filteredUpdates = useMemo(() => {
    let list = [...updates];

    // 1. Category Filter
    if (categoryFilter !== 'all') {
      const targetCatId = drawerCategories.find(c => c.id === categoryFilter)?.catId;
      if (targetCatId) {
        list = list.filter(u => u.category === targetCatId);
      }
    }

    // 2. Search query filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(u => 
        u.title.toLowerCase().includes(q) ||
        u.summary.toLowerCase().includes(q) ||
        u.portal_name.toLowerCase().includes(q) ||
        u.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [updates, categoryFilter, searchQuery]);

  // Chronological Grouping
  const groupedUpdates = useMemo(() => {
    const todayStr = '2026-06-18';
    const yesterdayStr = '2026-06-17';

    const today: typeof updates = [];
    const yesterday: typeof updates = [];
    const earlier: typeof updates = [];

    filteredUpdates.forEach(item => {
      if (item.published_date === todayStr) {
        today.push(item);
      } else if (item.published_date === yesterdayStr) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, yesterday, earlier };
  }, [filteredUpdates]);

  const renderCompactCard = (item: any) => {
    const priorityColors: Record<string, string> = {
      Critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      High: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      Medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      Low: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20',
    };

    return (
      <div 
        key={item.id} 
        className="notification-card p-3 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-gray-200/50 dark:border-slate-800/60 hover:bg-white dark:hover:bg-slate-800/80 transition-all flex flex-col gap-2 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide leading-none mb-1">
              {item.portal_name}
            </span>
            <h4 className="text-[11px] font-extrabold text-gray-900 dark:text-white leading-snug">
              {t(item.title)}
            </h4>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wide border shrink-0 ${priorityColors[item.priority] || ''}`}>
            {item.priority}
          </span>
        </div>

        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {t(item.summary)}
        </p>

        <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800/40 pt-2 text-[9px] text-gray-400">
          <span>{item.published_date}</span>
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="view-details-btn font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View Details</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 50);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200 overflow-hidden">
      
      {/* Mobile Menu Toggle overlay */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--bg-primary)] border-b border-[var(--border-default)] z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-2 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Kalpana Enterprise Logo" className="w-6 h-6 object-cover rounded shadow-sm" />
              <span className="font-extrabold text-[15px] tracking-tight text-blue-900 dark:text-blue-100 leading-none">ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್</span>
            </div>
            <span className="font-bold text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent pl-8 leading-none mt-0.5">Kalpana Enterprise</span>
          </div>
        </div>
      </div>

      {/* Sidebar - Hidden on mobile unless toggled */}
      <div className={`
        fixed inset-y-0 left-0 z-[100] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {mobileOpen && (
          <button 
            className="md:hidden absolute top-4 right-4 z-[110] p-1 bg-white dark:bg-gray-800 rounded-full shadow-md"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        )}
        <Sidebar />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main 
        onScroll={handleScroll}
        className="flex-1 h-screen overflow-y-auto w-full relative flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50/60 to-purple-50 dark:from-slate-950 dark:via-indigo-950/35 dark:to-slate-950 transition-colors duration-200"
      >
        {/* Premium Background Visuals - Glassmorphism, Gradients, Waves & Digital Network Nodes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {/* Subtle Technology grid & wave graphics */}
          <svg className="absolute inset-0 w-full h-full opacity-45 dark:opacity-20 stroke-blue-500/10 dark:stroke-indigo-500/5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path d="M0,100 L2000,100 M0,200 L2000,200 M0,300 L2000,300 M0,400 L2000,400 M0,500 L2000,500 M0,600 L2000,600 M0,700 L2000,700 M0,800 L2000,800 M0,900 L2000,900" stroke="url(#grid-grad)" strokeWidth="1" />
            <path d="M100,0 L100,1500 M200,0 L200,1500 M300,0 L300,1500 M400,0 L400,1500 M500,0 L500,1500 M600,0 L600,1500 M700,0 L700,1500 M800,0 L800,1500 M900,0 L900,1500 M1000,0 L1000,1500 M1100,0 L1100,1500 M1200,0 L1200,1500" stroke="url(#grid-grad)" strokeWidth="1" />
            {/* Tech Waves */}
            <path d="M-100,450 C400,150 800,750 1300,350 T2800,550" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeOpacity="0.12" />
            <path d="M-100,500 C400,200 800,800 1300,400 T2800,600" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.12" />
            <path d="M-100,400 C400,100 800,700 1300,300 T2800,500" fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.12" />
            {/* Nodes */}
            <circle cx="200" cy="200" r="3.5" fill="#2563eb" fillOpacity="0.4" />
            <circle cx="500" cy="300" r="4.5" fill="#7c3aed" fillOpacity="0.4" />
            <circle cx="800" cy="500" r="3.5" fill="#06b6d4" fillOpacity="0.4" />
            <circle cx="1100" cy="400" r="4.5" fill="#4f46e5" fillOpacity="0.4" />
          </svg>

          {/* Floating glassmorphic accent blobs */}
          {isDashboard && (
            <>
              <div className="absolute top-[8%] left-[15%] w-[400px] h-[400px] rounded-full bg-blue-500/20 dark:bg-indigo-600/15 blur-[90px] animate-float-slow" />
              <div className="absolute top-[35%] right-[10%] w-[450px] h-[450px] rounded-full bg-purple-500/20 dark:bg-purple-600/15 blur-[100px] animate-float-reverse" />
              <div className="absolute bottom-[5%] left-[25%] w-[350px] h-[350px] rounded-full bg-cyan-500/15 dark:bg-blue-900/20 blur-[80px] animate-float-slow" />
            </>
          )}
        </div>

        {/* Overlay for text readability */}
        {isDashboard ? (
          <div className={`fixed inset-0 z-0 pointer-events-none transition-all duration-500 ${
            isScrolled ? 'bg-[var(--bg-primary)]/50 backdrop-blur-[6px]' : 'bg-[var(--bg-primary)]/10 backdrop-blur-[2px]'
          }`} />
        ) : (
          <div className="fixed inset-0 bg-[var(--bg-primary)]/75 dark:bg-[var(--bg-primary)]/80 backdrop-blur-md z-0 pointer-events-none" />
        )}
        
        {/* Top Header Section */}
        <div className="relative z-10 w-full pt-16 md:pt-4 px-4 lg:px-8 flex justify-end items-center gap-3">
          {/* Date/Time */}
          <div className="hidden sm:block px-4 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-md rounded-full shadow-sm border border-[var(--border-default)] text-xs font-semibold text-[var(--text-primary)]">
            {currentTime.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={i18n.language}
              onChange={handleLanguageChange}
              className="h-9 px-3 bg-[var(--bg-secondary)]/80 backdrop-blur-md border border-[var(--border-default)] rounded-full text-[var(--text-primary)] text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>

          {/* Notification Bell */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 backdrop-blur-md hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all duration-300 relative shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-[var(--bg-primary)] shadow-md animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile Menu (Avatar) */}
          <div className="relative group">
            <button className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 backdrop-blur-md hover:bg-gradient-to-tr hover:from-blue-500 hover:to-purple-500 hover:text-white text-[var(--text-primary)] transition-all duration-300 shadow-sm cursor-pointer font-bold text-xs">
              KE
            </button>
            <div className="absolute right-0 top-11 hidden group-hover:block bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl py-2 px-3 shadow-xl text-[10px] whitespace-nowrap z-50 font-bold">
              Kalpana Enterprises (Citizen)
            </div>
          </div>
        </div>

        <div className={`flex-1 w-full relative z-10 p-4 lg:p-8 max-w-7xl mx-auto ${isDashboard ? 'bg-transparent' : ''}`}>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Outlet />
          </ErrorBoundary>
        </div>

        {/* Footer */}
        <footer className="relative z-10 w-full mt-auto bg-[var(--bg-secondary)]/90 backdrop-blur-md border-t border-[var(--border-default)] py-3 px-4 md:px-8 shadow-inner">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">About:</span> Your unified gateway to digital citizen services.
              <span className="ml-2 font-medium">© {new Date().getFullYear()} Kalpana Enterprises.</span>
            </div>
            
            <div className="flex items-center gap-4">
              <a 
                href="https://maps.google.com/?q=12.56395883950986,76.98083285163653" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                title="View on Maps"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Place: <strong className="font-bold uppercase text-[var(--text-primary)]">HANAKERE</strong>
              </a>
              
              <a 
                href="https://wa.me/919986934111"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-green-600 transition-colors font-medium text-[var(--text-primary)] cursor-pointer"
              >
                <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                WhatsApp +91 9986934111
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Slide-out Notification Drawer */}
      <div className={`fixed inset-0 z-[150] transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop Overlay */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
        
        {/* Drawer Panel */}
        <div className={`absolute top-0 right-0 h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-gray-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-out flex flex-col z-10 w-full sm:w-[380px] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Drawer Header */}
          <div className="p-4 border-b border-gray-200/60 dark:border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">Government Updates</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => runDeltaSync(true)}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-850 text-gray-500 dark:text-gray-400 cursor-pointer disabled:opacity-50"
                title="Force delta check"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-850 text-gray-500 dark:text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Search & Category Filters */}
          <div className="p-4 border-b border-gray-200/40 dark:border-slate-850/40 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search updates, portals, deadlines..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            {/* Horizontal scrollable category filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
              {drawerCategories.map(c => {
                const isActive = categoryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {loading && filteredUpdates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <RefreshCw className="w-6 h-6 text-red-500 animate-spin mb-2" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Checking delta registries...</span>
              </div>
            ) : filteredUpdates.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-600 font-bold text-xs">
                No recent updates available
              </div>
            ) : (
              <>
                {/* Chronological Grouped Sections */}
                {groupedUpdates.today.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Today</h3>
                    <div className="space-y-2">{groupedUpdates.today.map(renderCompactCard)}</div>
                  </div>
                )}
                
                {groupedUpdates.yesterday.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Yesterday</h3>
                    <div className="space-y-2">{groupedUpdates.yesterday.map(renderCompactCard)}</div>
                  </div>
                )}

                {groupedUpdates.earlier.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Earlier</h3>
                    <div className="space-y-2">{groupedUpdates.earlier.map(renderCompactCard)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AIChat />
    </div>
  );
}
