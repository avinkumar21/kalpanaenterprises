import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Landmark, MapPin, Train, Ticket, Activity, GraduationCap, Bell, Calculator, ChevronRight, Shield, Mountain, TreePine, Leaf, Car, Tent, Camera, ShieldAlert, UserCheck } from 'lucide-react';
import { useServices } from '../../store/useServices';
import { ServiceGrid } from '../../components/cards/ServiceGrid';
import { useMemo } from 'react';
import searchIndex from '../../data/search-index.json';
import notificationsData from '../../data/notifications.json';
import updateSourcesData from '../../data/update-sources.json';
import travelPermitsData from '../../data/travel-permits.json';
import { resolvePermitImage } from '../../utils/imageResolver';
import UpdatesWidget from '../../components/updates/UpdatesWidget';


const stateIdMap: Record<string, string> = {
  "Karnataka": "karnataka",
  "Kerala": "kerala",
  "Tamil Nadu": "tamilnadu",
  "Andhra Pradesh": "andhra",
  "Telangana": "telangana",
  "Goa": "goa",
  "Maharashtra": "maharashtra",
  "Uttarakhand": "uttarakhand",
  "Himachal Pradesh": "himachal",
  "Jammu & Kashmir": "jk",
  "Ladakh": "ladakh",
  "Assam": "assam",
  "Meghalaya": "meghalaya",
  "Arunachal Pradesh": "arunachal",
  "Nagaland": "nagaland",
  "Manipur": "manipur",
  "Mizoram": "mizoram",
  "Tripura": "tripura",
  "Sikkim": "sikkim"
};

const getIconForCategory = (category: string) => {
  switch (category) {
    case 'pc_hill': return Mountain;
    case 'pc_forest': return TreePine;
    case 'pc_eco': return Leaf;
    case 'pc_vehicle': return Car;
    case 'pc_camping': return Tent;
    case 'pc_tourism': return Camera;
    case 'pc_restricted': return ShieldAlert;
    case 'pc_special': return UserCheck;
    default: return Shield;
  }
};

const CATEGORIES = [
  { id: 'central', icon: Landmark, labelKey: 'central', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', image: '/images/central_gov.png' },
  { id: 'state', icon: MapPin, labelKey: 'state', color: 'text-green-600 bg-green-50 dark:bg-green-900/20', image: '/images/state_gov.png' },
  { id: 'travel', icon: Train, labelKey: 'travel', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600&auto=format&fit=crop' },
  { id: 'bookings', icon: Ticket, labelKey: 'bookings', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=600&auto=format&fit=crop' },
  { id: 'permits', icon: Shield, labelKey: 'permits', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20', image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=600&auto=format&fit=crop' },
  { id: 'health', icon: Activity, labelKey: 'health', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop' },
  { id: 'education', icon: GraduationCap, labelKey: 'education', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', image: '/images/education_banner.png' },
  { id: 'temple', icon: Bell, labelKey: 'temple', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', image: '/images/temple_img.png' },
  { id: 'ca', icon: Calculator, labelKey: 'ca', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=600&auto=format&fit=crop' },
  { id: 'updates', icon: Bell, labelKey: 'updates', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', image: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=600&auto=format&fit=crop' },
];

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const { services } = useServices();

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  // Optimized search reading directly from the registry search-index.json
  const filteredServices = useMemo(() => {
    const queryLower = query.toLowerCase();
    return services.filter(s => {
      if (s.validated === false) return false;
      const keywords = (searchIndex as Record<string, string[]>)[s.id] || [];
      return keywords.some(k => k.includes(queryLower)) || 
             s.name.toLowerCase().includes(queryLower);
    });
  }, [services, query]);

  // Query travel permits registry for matched permits
  const filteredPermits = useMemo(() => {
    if (query.length < 2) return [];
    const queryLower = query.toLowerCase().trim();
    
    const matched = travelPermitsData.filter(p => {
      const nameLower = p.permitName.toLowerCase();
      const descLower = p.description.toLowerCase();
      const stateLower = p.state.toLowerCase();
      const categoryLower = p.category.toLowerCase();
      
      const translatedName = t(p.permitName).toLowerCase();
      const translatedDesc = t(p.description).toLowerCase();
      const translatedState = t(`ps_${stateIdMap[p.state] || p.state}_dept_name`, { defaultValue: p.state }).toLowerCase();
      const translatedCategory = t(`${p.category}_dept_name`, { defaultValue: p.category }).toLowerCase();

      return nameLower.includes(queryLower) ||
             translatedName.includes(queryLower) ||
             descLower.includes(queryLower) ||
             translatedDesc.includes(queryLower) ||
             stateLower.includes(queryLower) ||
             translatedState.includes(queryLower) ||
             categoryLower.includes(queryLower) ||
             translatedCategory.includes(queryLower);
    });

    return matched.filter(p => {
      const storeService = services.find(s => s.id === p.id);
      return storeService ? storeService.validated !== false : p.validated !== false;
    });
  }, [query, t, services]);

  // Query notifications registry for matched updates/circulars
  const filteredNotifications = useMemo(() => {
    if (query.length < 2) return [];
    const queryLower = query.toLowerCase();
    
    return notificationsData.filter(n => {
      const titleLower = n.title.toLowerCase();
      const summaryLower = n.summary.toLowerCase();
      const categoryLower = n.category.toLowerCase();
      const priorityLower = n.priority.toLowerCase();
      
      const sourceObj = (updateSourcesData as any[]).find(s => s.id === n.source);
      const sourceNameLower = sourceObj ? sourceObj.sourceName.toLowerCase() : '';
      
      const translatedTitle = t(n.title).toLowerCase();
      const translatedSummary = t(n.summary).toLowerCase();
      const translatedSourceName = sourceObj ? t(`${sourceObj.id}_dept_name`).toLowerCase() : '';

      return titleLower.includes(queryLower) ||
             translatedTitle.includes(queryLower) ||
             summaryLower.includes(queryLower) ||
             translatedSummary.includes(queryLower) ||
             categoryLower.includes(queryLower) ||
             priorityLower.includes(queryLower) ||
             sourceNameLower.includes(queryLower) ||
             translatedSourceName.includes(queryLower);
    });
  }, [query, t]);

  // If there's a search query, show search results
  if (query.length >= 2) {
    const totalResults = filteredServices.length + filteredNotifications.length + filteredPermits.length;
    return (
      <div className="py-6 animate-in fade-in duration-300 flex flex-col gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-1">Search Results for "{query}"</h2>
          <p className="text-sm text-[var(--text-muted)]">Found {totalResults} matches across portals, permits & updates</p>
        </div>
        
        {/* Services Section */}
        {filteredServices.length > 0 && (
          <div>
            <h3 className="text-md font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
              <span>Digital Services ({filteredServices.length})</span>
            </h3>
            <ServiceGrid services={filteredServices} showCategoryBadge />
          </div>
        )}

        {/* Permits Section */}
        {filteredPermits.length > 0 && (
          <div>
            <h3 className="text-md font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-teal-500 rounded-full" />
              <span>Travel Permits & Passes ({filteredPermits.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPermits.map(permit => {
                const Icon = getIconForCategory(permit.category);
                
                const imgUrl = resolvePermitImage(permit);

                return (
                  <a
                    key={permit.id}
                    href={permit.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseMove={handleMouseMove}
                    className="card-focus-ring permit-card flex flex-col bg-white dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 hover:border-transparent dark:hover:border-transparent hover:bg-gray-50 dark:hover:bg-slate-700 hover:-translate-y-1 hover:shadow-xl rounded-xl transition-all duration-300 group overflow-hidden relative"
                    role="button"
                    aria-label={`Open ${t(permit.permitName)}`}
                  >
                    <div className="w-full h-16 relative overflow-hidden bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-center z-10">
                      <img 
                        src={imgUrl} 
                        alt={permit.permitName} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col relative z-10 bg-inherit">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug">
                            {t(permit.permitName)}
                          </h3>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-2 font-medium">
                        {t(permit.description)}
                      </p>
                      <div className="mt-auto space-y-2">
                        <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50">
                          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 block mb-0.5">{t('requiredDocs')}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block line-clamp-1">{t(permit.requiredDocuments)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded shadow-sm">
                            {t(`${permit.category}_dept_name`, { defaultValue: permit.category })}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                            {t('verifiedGovt')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications / Government Updates Section */}
        {filteredNotifications.length > 0 && (
          <div>
            <h3 className="text-md font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-red-500 rounded-full" />
              <span>Government Updates & Alerts ({filteredNotifications.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredNotifications.map(n => {
                const sourceObj = (updateSourcesData as any[]).find(s => s.id === n.source);
                const sourceName = sourceObj ? t(`${sourceObj.id}_dept_name`) : n.source;
                // Priority color badges
                const priorityColors: Record<string, string> = {
                  "Critical": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800",
                  "High": "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                  "Medium": "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                  "Low": "bg-gray-50 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                };
                
                // Check if NEW (within 3 days)
                const pubDate = new Date(n.publishedDate);
                const diffTime = Math.abs(new Date().getTime() - pubDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isNew = diffDays <= 3;

                return (
                  <div key={n.id} className="notification-card bg-white dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${priorityColors[n.priority] || ''}`}>
                          {t(`priority_${n.priority}`)}
                        </span>
                        <div className="flex gap-1.5 items-center">
                          {isNew && (
                            <span className="bg-red-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">
                              {t('newBadge')}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            {n.publishedDate}
                          </span>
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1 leading-snug">
                        {t(n.title)}
                      </h4>
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-2">
                        {sourceName}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                        {t(n.summary)}
                      </p>
                    </div>

                    <div className="mt-auto pt-2 border-t border-gray-100 dark:border-slate-700/50 flex justify-between items-center">
                      <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {t(n.category)}
                      </span>
                      <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <span>{t('goToOfficial')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredServices.length === 0 && filteredNotifications.length === 0 && filteredPermits.length === 0 && (
          <div className="text-center py-20 border border-[var(--border-default)] border-dashed rounded-[var(--radius-card)]">
            <p className="text-[var(--text-muted)]">{t('noResults')}</p>
          </div>
        )}
      </div>
    );
  }

  // Default Home View
  return (
    <div className="py-6 animate-in fade-in duration-300">
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-white/75 to-white/30 dark:from-slate-900/80 dark:to-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg relative overflow-hidden">
        {/* Abstract glowing accent in the header banner */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-500/20 dark:bg-blue-600/35 blur-3xl pointer-events-none" />
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] drop-shadow-sm mb-2 relative z-10">Digital Service Categories</h1>
        <p className="text-sm text-[var(--text-secondary)] font-medium relative z-10">Select a category below to browse available portals and resources.</p>
        <div className="mt-5 relative z-10">
          <button 
            onClick={() => {
              const grid = document.querySelector('.grid');
              if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="card-focus-ring cursor-pointer px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2 w-fit"
          >
            <span>Explore Services</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <UpdatesWidget />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = cat.id === 'updates' 
            ? notificationsData.length 
            : (cat.id === 'permits' ? travelPermitsData.length : services.filter(s => s.categoryId === cat.id).length);
          
          return (
            <button
              key={cat.id}
              onClick={() => navigate(`/category/${cat.id}`)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
              }}
              className="card-focus-ring category-card text-left bg-white/60 dark:bg-slate-900/50 backdrop-blur-lg border border-white/40 dark:border-white/5 hover:border-white/80 dark:hover:border-white/15 hover:bg-white/85 dark:hover:bg-slate-900/70 shadow-md hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 rounded-2xl flex flex-col justify-between group relative overflow-hidden"
              aria-label={`${t(cat.id)} category with ${count} items`}
            >
              {/* Image Header */}
              <div className="w-full h-28 relative overflow-hidden bg-white/10 dark:bg-black/20 border-b border-white/30 dark:border-white/5 z-10">
                <img 
                  src={cat.image} 
                  alt={cat.id} 
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                  <div className={`p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-md transition-transform duration-500 group-hover:scale-115 group-hover:rotate-3 backdrop-blur-md`}>
                    <Icon className={`w-5 h-5 ${cat.color.split(' ')[0]}`} aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-gray-300 rounded-full shadow-md backdrop-blur-md">
                    {count} {cat.id === 'updates' ? t('totalUpdates') : (cat.id === 'permits' ? t('totalPermits') : t('services'))}
                  </span>
                </div>
              </div>

              {/* Spotlight Radial Glow Hover Effect */}
              <div 
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
                style={{
                  background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(var(--glow-color), 0.2), transparent 40%)'
                }}
              />

              {/* Highlight gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/30 dark:to-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              
              <div className="relative z-10 bg-transparent p-5 w-full flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t(cat.id)}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-medium">{t(`${cat.id}_desc`)}</p>
                </div>
                
                {/* Latest Updated Timestamp for Government Updates category */}
                {cat.id === 'updates' && (
                  <div className="mt-4 text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1.5 relative z-20">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    <span>Updated: {(() => {
                      const dates = notificationsData.map(n => new Date(n.detectedDate).getTime());
                      const latestTime = Math.max(...dates);
                      return new Date(latestTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}</span>
                  </div>
                )}

                {/* State Count, Permit Count, Latest Updated for Travel Permits */}
                {cat.id === 'permits' && (
                  <div className="mt-4 flex flex-col gap-1.5 relative z-20">
                    <div className="text-[10px] text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                      <span>{t('statesCountText')}: {new Set(travelPermitsData.map(p => p.state)).size} | {t('totalPermits')}: {travelPermitsData.length}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold">
                      {t('lastUpdated')}: {(() => {
                        const dates = travelPermitsData.map(p => new Date(p.lastUpdated).getTime());
                        const latestTime = Math.max(...dates);
                        return new Date(latestTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Linear Gradient Bottom Glow Hover Effect */}
              <div 
                className="absolute bottom-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 glow-line" 
                style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--glow-color), 0.2), rgba(var(--glow-color), 1), rgba(var(--glow-color), 0.2), transparent)' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
