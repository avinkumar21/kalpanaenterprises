import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Mic, X, Sun, Moon, Home, Landmark, MapPin, Train, Ticket, Shield, Activity, GraduationCap, Settings, ChevronLeft, ChevronRight, QrCode, Bell, Calculator, Printer } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import QRCode from 'react-qr-code';
import templesData from '../../data/temples.json';
import travelPermitsData from '../../data/travel-permits.json';

const NAV_LINKS = [
  { id: 'home', path: '/', icon: Home, labelKey: 'home' },
  { id: 'prints', path: '/prints', icon: Printer, labelKey: 'WhatsApp Print Engine V2' },
  { id: 'central', path: '/category/central', icon: Landmark, labelKey: 'central' },
  { id: 'state', path: '/category/state', icon: MapPin, labelKey: 'state' },
  { id: 'travel', path: '/category/travel', icon: Train, labelKey: 'travel' },
  { id: 'bookings', path: '/category/bookings', icon: Ticket, labelKey: 'bookings' },
  { id: 'permits', path: '/category/permits', icon: Shield, labelKey: 'permits' },
  { id: 'health', path: '/category/health', icon: Activity, labelKey: 'health' },
  { id: 'education', path: '/category/education', icon: GraduationCap, labelKey: 'education' },
  { id: 'temple', path: '/category/temple', icon: Bell, labelKey: 'temple' },
  { id: 'ca', path: '/category/ca', icon: Calculator, labelKey: 'ca' },
];

const templeStateIdMap: Record<string, string> = {
  "Karnataka": "ts_karnataka",
  "Kerala": "ts_kerala",
  "Tamil Nadu": "ts_tamilnadu",
  "Andhra Pradesh": "ts_andhra",
  "Telangana": "ts_telangana",
  "Odisha": "ts_odisha",
  "Maharashtra": "ts_maharashtra",
  "Uttar Pradesh": "ts_uttarpradesh",
  "Madhya Pradesh": "ts_madhyapradesh",
  "Gujarat": "ts_gujarat",
  "Uttarakhand": "ts_uttarakhand",
  "Jammu & Kashmir": "ts_jk",
  "West Bengal": "ts_westbengal",
  "Assam": "ts_assam"
};

const permitStateIdMap: Record<string, string> = {
  "Karnataka": "ps_karnataka",
  "Kerala": "ps_kerala",
  "Tamil Nadu": "ps_tamilnadu",
  "Andhra Pradesh": "ps_andhra",
  "Telangana": "ps_telangana",
  "Goa": "ps_goa",
  "Maharashtra": "ps_maharashtra",
  "Uttarakhand": "ps_uttarakhand",
  "Himachal Pradesh": "ps_himachal",
  "Jammu & Kashmir": "ps_jk",
  "Ladakh": "ps_ladakh",
  "Assam": "ps_assam",
  "Meghalaya": "ps_meghalaya",
  "Arunachal Pradesh": "ps_arunachal",
  "Nagaland": "ps_nagaland",
  "Manipur": "ps_manipur",
  "Mizoram": "ps_mizoram",
  "Tripura": "ps_tripura",
  "Sikkim": "ps_sikkim"
};

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) return true;
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [showQR, setShowQR] = useState(false);
  
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  // Inactivity tracking (3 minutes = 180,000 ms) for Desktop
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile || isCollapsed) return;

    // Check if the user manually expanded it
    const isManuallyExpanded = localStorage.getItem('sidebar-manually-expanded') === 'true';
    if (isManuallyExpanded) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsCollapsed(true);
      }, 3 * 60 * 1000); // 3 minutes
    };

    // Events to track user activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleEvent = () => resetTimer();
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleEvent);
    });

    // Start timer initially
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleEvent);
      });
    };
  }, [isCollapsed]);

  const handleToggleCollapse = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem('sidebar-collapsed', String(nextCollapsed));
    
    if (!nextCollapsed) {
      localStorage.setItem('sidebar-manually-expanded', 'true');
    } else {
      localStorage.removeItem('sidebar-manually-expanded');
    }
  };

  // Sync search input with URL
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  // Handle debounce search with direct temple and permit navigation support
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        const queryLower = query.toLowerCase().trim();
        
        // 1. Find matching temple
        const matchedTemple = templesData.find(temple => {
          const nameEn = temple.templeName.toLowerCase();
          const nameTranslated = t(temple.templeName).toLowerCase();
          const districtEn = temple.district.toLowerCase();
          const districtTranslated = t(temple.district).toLowerCase();
          const stateEn = temple.state.toLowerCase();
          const stateTranslated = t(temple.state).toLowerCase();

          // Match direct inclusions
          if (nameEn.includes(queryLower) || nameTranslated.includes(queryLower)) return true;
          if (districtEn.includes(queryLower) || districtTranslated.includes(queryLower)) return true;
          if (stateEn.includes(queryLower) || stateTranslated.includes(queryLower)) return true;
          if (temple.services.some(s => s.toLowerCase().includes(queryLower) || t(`service_${s}`).toLowerCase().includes(queryLower))) return true;

          // Check token overlaps for voice queries like "Tirupati Darshan"
          const nameTokens = nameEn.split(/\s+/).filter(w => w.length > 3);
          const transTokens = nameTranslated.split(/\s+/).filter(w => w.length > 2);
          if (nameTokens.some(tok => queryLower.includes(tok)) || transTokens.some(tok => queryLower.includes(tok))) return true;

          return false;
        });

        // 2. Find matching permit
        const matchedPermit = travelPermitsData.find(permit => {
          const nameEn = permit.permitName.toLowerCase();
          const nameTranslated = t(permit.permitName).toLowerCase();
          const stateEn = permit.state.toLowerCase();
          const stateTranslated = t(`ps_${permitStateIdMap[permit.state] || permit.state}_dept_name`, { defaultValue: permit.state }).toLowerCase();

          // Match direct inclusions
          if (nameEn.includes(queryLower) || nameTranslated.includes(queryLower)) return true;
          if (stateEn.includes(queryLower) || stateTranslated.includes(queryLower)) return true;

          // Check token overlaps for voice queries like "Ooty pass" or "Bandipur safari"
          const queryTokens = queryLower.split(/\s+/);
          if (queryTokens.some(tok => tok.length > 3 && (nameEn.includes(tok) || nameTranslated.includes(tok)))) return true;

          return false;
        });

        if (matchedTemple) {
          const stateParam = templeStateIdMap[matchedTemple.state] || '';
          setQuery(''); // Clear search input
          navigate(`/category/temple?state=${stateParam}&temple=${matchedTemple.id}`);
        } else if (matchedPermit) {
          const stateParam = permitStateIdMap[matchedPermit.state] || '';
          setQuery(''); // Clear search input
          navigate(`/category/permits?state=${stateParam}&cat=${matchedPermit.category}`);
        } else {
          // Standard global search
          if (location.pathname !== '/') navigate(`/?q=${encodeURIComponent(query)}`);
          else navigate(`/?q=${encodeURIComponent(query)}`, { replace: true });
        }
      } else if (query.length === 0 && searchParams.has('q')) {
        navigate(location.pathname);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, navigate, searchParams, location.pathname, t]);

  const { isListening, startListening, stopListening } = useVoiceSearch({
    lang: i18n.language,
    onResult: (text) => setQuery(text)
  });

  const handleClear = () => {
    setQuery('');
    navigate(location.pathname);
  };

  return (
    <aside className={`h-screen shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border-default)] flex flex-col sticky top-0 transition-all duration-200 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      
      {/* Collapse Toggle */}
      <button 
        onClick={handleToggleCollapse}
        className="hidden md:block absolute -right-3 top-6 z-50 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-full p-1 shadow-md hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-transform hover:scale-110"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Brand Header - Premium Vibrant */}
      <div 
        className={`relative p-4 flex flex-col gap-2 cursor-pointer border-b border-[var(--border-default)] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 transition-all duration-300 overflow-hidden ${isCollapsed ? 'items-center px-2' : ''}`}
        onClick={() => navigate('/')}
        role="button"
        tabIndex={0}
      >
        {/* Decorative background elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex flex-col items-center w-full">
          <div className={`flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] rounded-2xl mx-auto transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-12 h-12 p-1' : 'w-24 h-24 p-1.5'}`}>
            <img src="/logo.jpg" alt="Kalpana Enterprise Logo" className="w-full h-full object-cover rounded-xl shadow-inner" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col text-center mt-2 w-full">
              <span className="font-extrabold text-[21px] leading-tight tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex-wrap">
                ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್
              </span>
              <span className="font-bold text-[13px] leading-tight tracking-widest text-blue-100 uppercase drop-shadow-md pb-1 flex-wrap mt-0.5">
                Kalpana Enterprise
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search Bars Container */}
      <div className={`flex flex-col border-b border-[var(--border-default)] transition-all ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto p-4 gap-4 bg-gray-50/50 dark:bg-gray-900/50'}`}>
        
        {/* Google Web Search Bar */}
        <form action="https://www.google.com/search" target="_blank" rel="noopener noreferrer" className="relative w-full flex items-center group">
          <div className="absolute left-3 flex items-center pointer-events-none transition-transform group-focus-within:scale-110">
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <input
            type="text"
            name="q"
            placeholder="Google Web Search"
            className="w-full h-10 pl-9 pr-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-[var(--text-primary)] text-sm shadow-sm"
          />
        </form>

        {/* Internal Search Bar */}
        <div>
          <div className="relative w-full flex items-center group">
            <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none transition-transform group-focus-within:scale-110 group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-[var(--text-primary)] text-sm shadow-sm"
            />
            <div className="absolute right-1 flex items-center">
              {query && (
                <button onClick={handleClear} className="p-1.5 text-gray-400 hover:text-gray-700 transition-transform hover:rotate-90">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                onClick={isListening ? stopListening : startListening}
                className={`p-1.5 rounded-xl transition-all ${
                  isListening ? 'text-red-500 bg-red-100 dark:bg-red-900/20 animate-pulse' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>
          {isListening && <div className="mt-1 text-[11px] text-red-500 animate-pulse text-center font-medium">{t('listening')}</div>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 relative no-scrollbar">
        {!isCollapsed && (
          <div className="px-2 pt-3 pb-2 flex items-center gap-2">
            <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
            <span className="text-[12px] font-extrabold text-gray-900 dark:text-white uppercase tracking-[0.15em] drop-shadow-sm">
              {t('services')}
            </span>
          </div>
        )}
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path && !query;
          
          return (
            <button
              key={link.id}
              onClick={() => {
                setQuery('');
                navigate(link.path);
              }}
              title={isCollapsed ? (link.id === 'prints' ? link.labelKey : t(link.labelKey)) : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] transition-all duration-300 text-left group sidebar-nav-item
                ${isCollapsed ? 'justify-center px-0' : ''}
                ${isActive 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold shadow-sm' 
                  : 'text-[var(--text-secondary)] hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-[1.02] hover:translate-x-1 hover:shadow-sm'
              }`}
            >
              <Icon className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
              {!isCollapsed && <span className="text-sm truncate font-medium">{link.id === 'prints' ? link.labelKey : t(link.labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      {/* QR Code Section */}
      {!isCollapsed && (
        <div className="px-4 py-3 flex flex-col items-center justify-center border-t border-[var(--border-default)]">
          <button 
            onClick={() => setShowQR(!showQR)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-blue-600 transition-colors uppercase tracking-wider w-full justify-center py-2"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? 'Hide Mobile Access' : 'Show Mobile Access'}
          </button>
          
          {showQR && (
            <div className="mt-2 flex flex-col items-center p-3 bg-white rounded-xl shadow-inner border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <QRCode 
                value={(() => {
                  const host = window.location.hostname.toLowerCase();
                  if (host === 'localhost' || host === '127.0.0.1' || host === 'kalpanaenterprise') {
                    return 'http://192.168.31.242/';
                  }
                  const origin = window.location.origin;
                  return origin.endsWith('/') ? origin : `${origin}/`;
                })()} 
                size={100} 
                level="M" 
                fgColor="#1e3a8a" 
              />
              <span className="mt-2 text-[10px] font-bold text-gray-800 uppercase tracking-widest">Kalpana Enterprise</span>
            </div>
          )}
        </div>
      )}

      {/* Footer Tools */}
      <div className={`p-4 border-t border-[var(--border-default)] flex gap-3 ${isCollapsed ? 'flex-col items-center' : 'flex-col'}`}>
        <button
          onClick={() => navigate('/admin')}
          title={isCollapsed ? "Admin Settings" : undefined}
          className={`flex items-center justify-center gap-2 w-full h-10 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border-default)] text-[var(--text-primary)] rounded-[var(--radius-sm)] transition-all duration-300 text-xs font-semibold uppercase tracking-wider group hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-sm ${isCollapsed ? 'px-0 rounded-full' : ''}`}
        >
          <Settings className="w-4 h-4 transition-transform duration-500 group-hover:rotate-90" />
          {!isCollapsed && <span>Admin Settings</span>}
        </button>
        
        {!isCollapsed && (
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Theme Mode</span>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-amber-500 dark:hover:text-blue-400 text-[var(--text-primary)] transition-all duration-300 hover:scale-110 cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
