import { useState, useEffect, useMemo } from 'react';
import { useUpdates } from '../../store/useUpdates';
import { 
  Bell, TrendingUp, AlertTriangle, Clock, Calendar, CheckCircle2, 
  Search, RefreshCw, Landmark, MapPin, Shield, Compass,
  Briefcase, GraduationCap, Stethoscope, Tractor, Zap, Banknote,
  ExternalLink
} from 'lucide-react';

export default function UpdatesWidget() {
  const { updates, loading, lastSyncTime, runDeltaSync } = useUpdates();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [presetFilter, setPresetFilter] = useState<'latest' | 'trending' | 'critical' | '24h' | '7days'>('latest');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lazy loading: Run delta sync ONLY when expanded
  useEffect(() => {
    if (isExpanded) {
      runDeltaSync();
    }
  }, [isExpanded, runDeltaSync]);

  // Handle manual sync refresh click
  const handleRefresh = () => {
    runDeltaSync(true); // force delta synchronization check
  };

  // Categories list definition
  const categories = [
    { id: 'all', labelKey: 'all', icon: Bell },
    { id: 'central', labelKey: 'Central Govt', icon: Landmark, catId: 'uc_central' },
    { id: 'karnataka', labelKey: 'Karnataka Govt', icon: MapPin, catId: 'uc_karnataka' },
    { id: 'temple', labelKey: 'Temple', icon: Compass, catId: 'uc_temple' },
    { id: 'travel', labelKey: 'Travel Permits', icon: Shield, catId: 'uc_travel' },
    { id: 'recruitment', labelKey: 'Recruitment', icon: Briefcase, catId: 'uc_recruitment' },
    { id: 'education', labelKey: 'Education', icon: GraduationCap, catId: 'uc_education' },
    { id: 'health', labelKey: 'Health', icon: Stethoscope, catId: 'uc_health' },
    { id: 'agriculture', labelKey: 'Agriculture', icon: Tractor, catId: 'uc_agriculture' },
    { id: 'utilities', labelKey: 'Utilities', icon: Zap, catId: 'uc_utility' },
    { id: 'finance', labelKey: 'Finance', icon: Banknote, catId: 'uc_central' } // maps contextually to tax/finance keywords
  ];

  // Presets definition
  const presets = [
    { id: 'latest', label: 'Latest Updates', icon: Bell },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'critical', label: 'Critical Alerts', icon: AlertTriangle },
    { id: '24h', label: 'Last 24 Hours', icon: Clock },
    { id: '7days', label: 'Last 7 Days', icon: Calendar }
  ];

  // Simulated base local time for comparison: 2026-06-18
  const baseTime = useMemo(() => new Date('2026-06-18T15:00:00Z'), []);

  // Filter and search computation
  const displayedUpdates = useMemo(() => {
    let list = [...updates];

    // 1. Search Query Filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(u => 
        u.title.toLowerCase().includes(q) ||
        u.summary.toLowerCase().includes(q) ||
        u.portal_name.toLowerCase().includes(q) ||
        u.category.toLowerCase().includes(q) ||
        u.priority.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'finance') {
        // Finance matches specific keywords
        list = list.filter(u => {
          const text = `${u.title} ${u.summary}`.toLowerCase();
          return text.includes('tax') || text.includes('itr') || text.includes('gst') || text.includes('finance') || text.includes('bank') || text.includes('fee');
        });
      } else {
        const catMap = categories.find(c => c.id === categoryFilter);
        if (catMap?.catId) {
          list = list.filter(u => u.category === catMap.catId);
        }
      }
    }

    // 3. Preset Filter
    if (presetFilter === 'critical') {
      list = list.filter(u => u.priority === 'Critical');
    } else if (presetFilter === 'trending') {
      // Trending = Critical or High priority
      list = list.filter(u => u.priority === 'Critical' || u.priority === 'High');
    } else if (presetFilter === '24h') {
      // Within 24 hours of baseTime (2026-06-18)
      list = list.filter(u => {
        const diffMs = baseTime.getTime() - new Date(u.published_date).getTime();
        return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
      });
    } else if (presetFilter === '7days') {
      // Within 7 days of baseTime (2026-06-18)
      list = list.filter(u => {
        const diffMs = baseTime.getTime() - new Date(u.published_date).getTime();
        return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
      });
    }

    // Limit to latest 10 matches for layout neatness and constraints
    return list.slice(0, 10);
  }, [updates, presetFilter, categoryFilter, searchQuery, baseTime]);

  // Priority Badge Styling helper
  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30';
      case 'High':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/30';
      case 'Medium':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 dark:border-gray-500/30';
    }
  };

  // Check if an update is considered NEW (within last 48 hours relative to 2026-06-18)
  const isUpdateNew = (publishedDate: string) => {
    const diffMs = baseTime.getTime() - new Date(publishedDate).getTime();
    return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
  };

  if (!isExpanded) {
    return (
      <div className="mb-6 bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-3xl p-4 shadow-md transition-all duration-300">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between text-left cursor-pointer group px-2 focus:outline-none"
          aria-expanded="false"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] group-hover:text-red-500 transition-colors">
              Latest Updates ▼
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold hidden sm:inline-block">
              (Click to expand and view notices)
            </span>
          </div>
          
          <div className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
            {updates.length} Updates Available
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-10 bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
      {/* Decorative accent background blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 dark:bg-red-600/10 blur-3xl pointer-events-none rounded-full" />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10 pb-4 border-b border-gray-200/50 dark:border-slate-800/50">
        <div>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xl font-extrabold text-[var(--text-primary)] hover:text-red-500 flex items-center gap-2 cursor-pointer transition-colors text-left focus:outline-none"
            aria-expanded="true"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Latest Updates ▲
          </button>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
            Real-time notifications from verified government and public service portals.
          </p>
        </div>
        
        {/* Sync Info and Refresh Button */}
        <div className="flex items-center gap-3 self-end md:self-center">
          {lastSyncTime && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
              Last synced: {new Date(lastSyncTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-xs border border-gray-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
            aria-label="Refresh updates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Preset Filters Grid */}
      <div className="flex flex-wrap gap-2 mb-6 relative z-10">
        {presets.map(p => {
          const Icon = p.icon;
          const isActive = presetFilter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPresetFilter(p.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm ${
                isActive
                  ? 'bg-red-600 text-white shadow-red-500/20'
                  : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Filter & Search Action Bar */}
      <div className="space-y-4 mb-6 relative z-10">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search updates by keyword, portal, or scheme..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/50 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
          />
        </div>

        {/* Category quick selectors */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-6 px-6 xl:mx-0 xl:px-0 no-scrollbar">
          {categories.map(c => {
            const Icon = c.icon;
            const isActive = categoryFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                  isActive
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-white/40 dark:bg-slate-800/40 text-gray-500 dark:text-gray-400 border-gray-200/50 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.labelKey}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Updates Cards Grid */}
      <div className="relative z-10 min-h-[120px]">
        {loading && updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin mb-3" />
            <p className="text-sm text-[var(--text-secondary)] font-bold">Synchronizing registry databases...</p>
          </div>
        ) : displayedUpdates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-gray-50/20 dark:bg-slate-900/10">
            <Bell className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">No recent updates available</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-1">Try resetting filters or adjusting search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedUpdates.map((item) => {
              const showNewBadge = isUpdateNew(item.published_date);
              
              return (
                <div 
                  key={item.id}
                  className="group bg-white/70 dark:bg-slate-800/70 border border-gray-200/60 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700/80 hover:-translate-y-0.5 hover:shadow-lg rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Metadata */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        {showNewBadge && (
                          <span className="bg-red-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                            NEW
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.published_date}
                        </span>
                      </div>
                    </div>

                    {/* Department name */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide">
                        {item.portal_name}
                      </span>
                      <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/30">
                        <CheckCircle2 className="w-2.5 h-2.5 fill-current" />
                        Verified
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-[13px] font-extrabold text-gray-900 dark:text-white leading-snug group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mb-1">
                      {item.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-medium">
                      {item.summary}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/40 flex justify-between items-center">
                    <span className="text-[9px] bg-gray-100 dark:bg-slate-700/60 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">
                      {item.category.replace('uc_', '')}
                    </span>
                    
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
