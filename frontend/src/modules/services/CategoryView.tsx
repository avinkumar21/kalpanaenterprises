import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useServices } from '../../store/useServices';
import { ServiceGrid } from '../../components/cards/ServiceGrid';
import { DEPARTMENTS } from '../../data/departments';
import { CENTRAL_DEPARTMENTS } from '../../data/centralDepartments';
import { PERMIT_STATES } from '../../data/permitStates';
import { PERMIT_CATEGORIES } from '../../data/permitCategories';
import { TEMPLE_STATES } from '../../data/templeStates';
import templesData from '../../data/temples.json';
import { UPDATE_CATEGORIES } from '../../data/updateCategories';
import updateSourcesData from '../../data/update-sources.json';
import notificationsData from '../../data/notifications.json';
import travelPermitsData from '../../data/travel-permits.json';
import { resolvePermitImage } from '../../utils/imageResolver';

const stateIdMap: Record<string, string> = {
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

const stateNameMap: Record<string, string> = {
  "ps_karnataka": "Karnataka",
  "ps_kerala": "Kerala",
  "ps_tamilnadu": "Tamil Nadu",
  "ps_andhra": "Andhra Pradesh",
  "ps_telangana": "Telangana",
  "ps_goa": "Goa",
  "ps_maharashtra": "Maharashtra",
  "ps_uttarakhand": "Uttarakhand",
  "ps_himachal": "Himachal Pradesh",
  "ps_jk": "Jammu & Kashmir",
  "ps_ladakh": "Ladakh",
  "ps_assam": "Assam",
  "ps_meghalaya": "Meghalaya",
  "ps_arunachal": "Arunachal Pradesh",
  "ps_nagaland": "Nagaland",
  "ps_manipur": "Manipur",
  "ps_mizoram": "Mizoram",
  "ps_tripura": "Tripura",
  "ps_sikkim": "Sikkim"
};

const MOST_USED_PERMIT_IDS = [
  "tp_ooty_epass",
  "tp_kodaikanal_epass",
  "tp_chardham_reg",
  "tp_rohtang_permit",
  "tp_bandipur_safari",
  "tp_nagarahole_safari",
  "tp_periyar_safari",
  "tp_arunachal_ilp",
  "tp_ladakh_ilp"
];

const mapTempleServicesToServiceCards = (temple: any) => {
  const serviceDetails: Record<string, { nameKey: string; descKey: string; tag: string; getUrl: (t: any) => string }> = {
    "Darshan": { nameKey: "service_Darshan", descKey: "desc_Darshan", tag: "Darshan", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Special Darshan": { nameKey: "service_Special Darshan", descKey: "desc_Special Darshan", tag: "Darshan", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "VIP Darshan": { nameKey: "service_VIP Darshan", descKey: "desc_VIP Darshan", tag: "Darshan", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Seva Booking": { nameKey: "service_Seva Booking", descKey: "desc_Seva Booking", tag: "Pooja", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Pooja Booking": { nameKey: "service_Pooja Booking", descKey: "desc_Pooja Booking", tag: "Pooja", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Abhisheka": { nameKey: "service_Abhisheka", descKey: "desc_Abhisheka", tag: "Pooja", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Accommodation": { nameKey: "service_Accommodation", descKey: "desc_Accommodation", tag: "Housing", getUrl: (t) => t.accommodationUrl || t.bookingUrl || t.officialUrl },
    "Donation": { nameKey: "service_Donation", descKey: "desc_Donation", tag: "Finance", getUrl: (t) => t.donationUrl || t.officialUrl },
    "Prasadam": { nameKey: "service_Prasadam", descKey: "desc_Prasadam", tag: "Temple", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Festival Booking": { nameKey: "service_Festival Booking", descKey: "desc_Festival Booking", tag: "Tourism", getUrl: (t) => t.festivalUrl || t.bookingUrl || t.officialUrl },
    "Virtual Queue": { nameKey: "service_Virtual Queue", descKey: "desc_Virtual Queue", tag: "Darshan", getUrl: (t) => t.bookingUrl || t.officialUrl },
    "Temple Calendar": { nameKey: "service_Temple Calendar", descKey: "desc_Temple Calendar", tag: "Portal", getUrl: (t) => t.officialUrl },
    "Announcements": { nameKey: "service_Announcements", descKey: "desc_Announcements", tag: "Portal", getUrl: (t) => t.announcementUrl || t.officialUrl }
  };

  return temple.services.map((serviceName: string) => {
    const details = serviceDetails[serviceName] || {
      nameKey: serviceName,
      descKey: "",
      tag: "Portal",
      getUrl: (t: any) => t.officialUrl
    };

    return {
      id: `${temple.id}_${serviceName.replace(/\s+/g, '_')}`,
      categoryId: "temple",
      categoryName: "Temple & Darshan",
      name: details.nameKey,
      description: details.descKey,
      tag: details.tag,
      url: details.getUrl(temple),
      image: temple.image || undefined,
      validated: temple.validated !== false,
      statusCode: 200,
      lastValidatedDate: temple.lastUpdated,
      popularityScore: temple.popularityScore || "Medium"
    };
  });
};

const MOST_USED_TEMPLE_IDS = [
  "t_tirupati",
  "t_sabarimala",
  "t_kukke",
  "t_dharmasthala",
  "t_guruvayur",
  "t_kashi",
  "t_vaishnodevi",
  "t_puri",
  "t_shirdi",
  "t_ujjain",
  "t_somnath",
  "t_kedarnath"
];

export function CategoryView() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { services } = useServices();
  const [searchParams, setSearchParams] = useSearchParams();
  const deptId = searchParams.get('dept');
  const stateId = searchParams.get('state');
  const catId = searchParams.get('cat');
  const templeId = searchParams.get('temple');
  const sourceId = searchParams.get('source');

  const [activeFilter, setActiveFilter] = useState('all');

  const categoryServices = services.filter(s => s.categoryId === categoryId);
  const isTempleCategory = categoryId === 'temple';
  const isUpdatesCategory = categoryId === 'updates';
  const isPermitCategory = categoryId === 'permits';

  // Return not found only if it's not the temple/updates/permits category and category services are empty
  if (!isTempleCategory && !isUpdatesCategory && !isPermitCategory && categoryServices.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-[var(--text-muted)] mb-4">Category not found.</p>
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
          Return Home
        </button>
      </div>
    );
  }

  // Handle card spotlight hover coordinates
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  // ── Navigation Mode Detection ──────────────────────────────────────────────
  const isDeptCategory = categoryId === 'state' || categoryId === 'central';

  // Dept-based (2-level): state/central
  const deptList = categoryId === 'state' ? DEPARTMENTS : (categoryId === 'central' ? CENTRAL_DEPARTMENTS : []);
  const currentDept = isDeptCategory ? deptList.find(d => d.id === deptId) : null;

  // Permit-based (3-level): permits
  const selectedStateName = stateId ? stateNameMap[stateId] : null;
  const currentState = isPermitCategory ? PERMIT_STATES.find(s => s.id === stateId) : null;
  const currentPermitCat = isPermitCategory && currentState ? PERMIT_CATEGORIES.find(c => c.id === catId) : null;

  // Temple-based (3-level): temple
  const currentTempleState = isTempleCategory ? TEMPLE_STATES.find(s => s.id === stateId) : null;
  const currentTemple = isTempleCategory && templeId ? templesData.find(t => t.id === templeId) : null;

  // Updates-based (3-level): updates
  const currentUpdatesCat = isUpdatesCategory ? UPDATE_CATEGORIES.find(c => c.id === catId) : null;
  const currentUpdateSource = isUpdatesCategory && sourceId ? updateSourcesData.find(s => s.id === sourceId) : null;

  // ── Filter Services ─────────────────────────────────────────────────────────
  let displayedServices = categoryServices;
  if (isTempleCategory) {
    if (currentTemple) {
      displayedServices = mapTempleServicesToServiceCards(currentTemple);
    } else {
      displayedServices = [];
    }
  } else if (isDeptCategory && currentDept) {
    displayedServices = categoryServices.filter(s => s.departmentId === deptId);
  }

  // Filter out broken links from production UI (Task 8 & Task 5)
  displayedServices = displayedServices.filter(ds => {
    const storeService = services.find(s => s.id === ds.id);
    return storeService ? storeService.validated !== false : ds.validated !== false;
  });

  // ── Filter Permits ──────────────────────────────────────────────────────────
  const displayedPermits = useMemo(() => {
    if (isPermitCategory && selectedStateName && currentPermitCat) {
      const raw = travelPermitsData.filter(p => p.state === selectedStateName && p.category === currentPermitCat.id);
      return raw.filter(p => {
        const storeService = services.find(s => s.id === p.id);
        return storeService ? storeService.validated !== false : p.validated !== false;
      });
    }
    return [];
  }, [isPermitCategory, selectedStateName, currentPermitCat, services]);

  // ── Filter Updates ──────────────────────────────────────────────────────────
  let filteredNotifications: typeof notificationsData = [];
  if (isUpdatesCategory && currentUpdateSource) {
    const rawNotifs = notificationsData.filter(n => n.source === sourceId);
    
    if (activeFilter === 'today') {
      filteredNotifications = rawNotifs.filter(n => n.detectedDate === '2026-06-18');
    } else if (activeFilter === '7days') {
      filteredNotifications = rawNotifs.filter(n => {
        const diffDays = Math.ceil(Math.abs(new Date('2026-06-18').getTime() - new Date(n.detectedDate).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      });
    } else if (activeFilter === 'recruitment') {
      filteredNotifications = rawNotifs.filter(n => n.category === 'uc_recruitment');
    } else if (activeFilter === 'scholarships') {
      filteredNotifications = rawNotifs.filter(n => n.category === 'uc_education' && n.title.toLowerCase().includes('scholarship'));
    } else if (activeFilter === 'temple') {
      filteredNotifications = rawNotifs.filter(n => n.category === 'uc_temple');
    } else if (activeFilter === 'travel') {
      filteredNotifications = rawNotifs.filter(n => n.category === 'uc_travel');
    } else if (activeFilter === 'critical') {
      filteredNotifications = rawNotifs.filter(n => n.priority === 'Critical');
    } else {
      filteredNotifications = rawNotifs;
    }
  }

  // ── Pinned Lists ─────────────────────────────────────────────────────────
  const mostUsedPermits = useMemo(() => {
    if (isPermitCategory && !currentState) {
      const raw = travelPermitsData.filter(p => MOST_USED_PERMIT_IDS.includes(p.id));
      return raw.filter(p => {
        const storeService = services.find(s => s.id === p.id);
        return storeService ? storeService.validated !== false : p.validated !== false;
      });
    }
    return [];
  }, [isPermitCategory, currentState, services]);

  const mostUsedTemples = useMemo(() => {
    if (isTempleCategory && !currentTempleState) {
      const raw = templesData.filter(t => MOST_USED_TEMPLE_IDS.includes(t.id));
      return raw.filter(t => {
        const storeService = services.find(s => s.id === t.id);
        return storeService ? storeService.validated !== false : t.validated !== false;
      });
    }
    return [];
  }, [isTempleCategory, currentTempleState, services]);

  // ── Back Button Logic ───────────────────────────────────────────────────────
  const handleBack = () => {
    if (isUpdatesCategory) {
      if (sourceId && catId) {
        setSearchParams({ cat: catId });
      } else if (catId) {
        setSearchParams({});
      } else {
        navigate('/');
      }
    } else if (isTempleCategory) {
      if (templeId && stateId) {
        // Level 3 → Level 2
        setSearchParams({ state: stateId });
      } else if (stateId) {
        // Level 2 → Level 1
        setSearchParams({});
      } else {
        navigate('/');
      }
    } else if (isPermitCategory) {
      if (catId && stateId) {
        // Level 3 → Level 2
        setSearchParams({ state: stateId });
      } else if (stateId) {
        // Level 2 → Level 1
        setSearchParams({});
      } else {
        navigate('/');
      }
    } else if (isDeptCategory && deptId) {
      setSearchParams({});
    } else {
      navigate('/');
    }
  };

  // ── Breadcrumb Rendering ────────────────────────────────────────────────────
  const renderBreadcrumb = () => {
    if (isUpdatesCategory) {
      return (
        <>
          {currentUpdatesCat ? (
            <>
              <button onClick={() => setSearchParams({})} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                {t('updates')}
              </button>
              <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
              {currentUpdateSource ? (
                <>
                  <button onClick={() => setSearchParams({ cat: catId! })} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                    {t(`${currentUpdatesCat.id}_dept_name`, { defaultValue: currentUpdatesCat.name })}
                  </button>
                  <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
                  <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                    {t(`${currentUpdateSource.id}_dept_name`, { defaultValue: currentUpdateSource.sourceName })}
                  </span>
                </>
              ) : (
                <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                  {t(`${currentUpdatesCat.id}_dept_name`, { defaultValue: currentUpdatesCat.name })}
                </span>
              )}
            </>
          ) : (
            <span className="font-medium text-[var(--text-primary)]" aria-current="page">
              {t('updates')}
            </span>
          )}
        </>
      );
    }

    if (isTempleCategory) {
      return (
        <>
          {currentTempleState ? (
            <>
              <button onClick={() => setSearchParams({})} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                {t('temple')}
              </button>
              <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
              {currentTemple ? (
                <>
                  <button onClick={() => setSearchParams({ state: stateId! })} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                    {t(`${currentTempleState.id}_dept_name`)}
                  </button>
                  <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
                  <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                    {t(currentTemple.templeName)}
                  </span>
                </>
              ) : (
                <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                  {t(`${currentTempleState.id}_dept_name`)}
                </span>
              )}
            </>
          ) : (
            <span className="font-medium text-[var(--text-primary)]" aria-current="page">
              {t('temple')}
            </span>
          )}
        </>
      );
    }

    if (isPermitCategory) {
      return (
        <>
          {currentState ? (
            <>
              <button onClick={() => setSearchParams({})} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                {t('permits')}
              </button>
              <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
              {currentPermitCat ? (
                <>
                  <button onClick={() => setSearchParams({ state: stateId! })} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
                    {t(`${currentState.id}_dept_name`, { defaultValue: currentState.name })}
                  </button>
                  <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
                  <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                    {t(`${currentPermitCat.id}_dept_name`, { defaultValue: currentPermitCat.name })}
                  </span>
                </>
              ) : (
                <span className="font-medium text-[var(--text-primary)]" aria-current="page">
                  {t(`${currentState.id}_dept_name`, { defaultValue: currentState.name })}
                </span>
              )}
            </>
          ) : (
            <span className="font-medium text-[var(--text-primary)]" aria-current="page">
              {t('permits')}
            </span>
          )}
        </>
      );
    }

    if (isDeptCategory && currentDept) {
      return (
        <>
          <button onClick={() => setSearchParams({})} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus:outline-none">
            {t(categoryId)}
          </button>
          <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
          <span className="font-medium text-[var(--text-primary)]" aria-current="page">
            {t(`${currentDept.id}_dept_name`)}
          </span>
        </>
      );
    }

    return (
      <span className="font-medium text-[var(--text-primary)]" aria-current="page">
        {t(categoryId as string)}
      </span>
    );
  };

  // ── Header Title/Description ────────────────────────────────────────────────
  const getTitle = () => {
    if (isUpdatesCategory) {
      if (currentUpdateSource) return t(`${currentUpdateSource.id}_dept_name`, { defaultValue: currentUpdateSource.sourceName });
      if (currentUpdatesCat) return t(`${currentUpdatesCat.id}_dept_name`, { defaultValue: currentUpdatesCat.name });
      return t('updates');
    }
    if (isTempleCategory) {
      if (currentTemple) return t(currentTemple.templeName);
      if (currentTempleState) return t(`${currentTempleState.id}_dept_name`);
      return t('temple');
    }
    if (isPermitCategory) {
      if (currentPermitCat) return t(`${currentPermitCat.id}_dept_name`, { defaultValue: currentPermitCat.name });
      if (currentState) return t(`${currentState.id}_dept_name`, { defaultValue: currentState.name });
      return t('permits');
    }
    if (isDeptCategory && currentDept) return t(`${currentDept.id}_dept_name`);
    return t(categoryId as string);
  };

  const getDescription = () => {
    if (isUpdatesCategory) {
      if (currentUpdateSource) return t(`${currentUpdateSource.id}_dept_desc`, { defaultValue: `Latest official notices and alerts from ${currentUpdateSource.sourceName}.` });
      if (currentUpdatesCat) return t(`${currentUpdatesCat.id}_dept_desc`, { defaultValue: currentUpdatesCat.description });
      return t('updates_desc');
    }
    if (isTempleCategory) {
      if (currentTemple) return t(currentTemple.description);
      if (currentTempleState) return t(`${currentTempleState.id}_dept_desc`);
      return t('temple_desc');
    }
    if (isPermitCategory) {
      if (currentPermitCat) return t(`${currentPermitCat.id}_dept_desc`, { defaultValue: currentPermitCat.description });
      if (currentState) return t(`${currentState.id}_dept_desc`, { defaultValue: currentState.description });
      return t('permits_desc');
    }
    if (isDeptCategory && currentDept) return t(`${currentDept.id}_dept_desc`);
    return t(`${categoryId}_desc`);
  };

  // ── Card Grid Renderer (reusable for dept/state/category cards) ─────────────
  const renderCardGrid = (items: typeof DEPARTMENTS, getCount: (item: typeof DEPARTMENTS[0]) => number, onClick: (id: string) => void) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {items.map(item => {
        const IconComponent = (LucideIcons as any)[item.iconName] || LucideIcons.HelpCircle;
        const count = getCount(item);
        
        // Don't render cards with 0 services/notifications
        if (count === 0) return null;

        return (
          <button
            key={item.id}
            onClick={() => onClick(item.id)}
            onMouseMove={handleMouseMove}
            className="card-focus-ring subcategory-card text-left bg-white/60 dark:bg-slate-900/50 backdrop-blur-lg border border-white/40 dark:border-white/5 hover:border-white/80 dark:hover:border-white/15 hover:bg-white/85 dark:hover:bg-slate-900/70 shadow-md hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 rounded-2xl flex flex-col justify-between group relative overflow-hidden p-5 cursor-pointer min-h-[160px]"
            aria-label={`${t(`${item.id}_dept_name`, { defaultValue: item.name })} with ${count} items`}
          >
            {/* Spotlight radial glow */}
            <div 
              className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
              style={{
                background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${
                  isUpdatesCategory 
                    ? 'rgba(239, 68, 68, 0.15)' 
                    : (isTempleCategory 
                        ? 'rgba(249, 115, 22, 0.15)' 
                        : (isPermitCategory ? 'rgba(20, 184, 166, 0.15)' : 'rgba(59, 130, 246, 0.15)'))
                }, transparent 40%)`
              }}
            />
            
            <div className="relative z-10 w-full flex flex-col gap-3 h-full">
              <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-xl transition-transform duration-300 shadow-sm ${
                  isUpdatesCategory
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:scale-115'
                    : isTempleCategory 
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 group-hover:scale-115' 
                      : isPermitCategory
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:scale-115'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-115'
                }`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm ${
                  isUpdatesCategory
                    ? 'bg-red-50/80 dark:bg-red-950/80 text-red-700 dark:text-red-300'
                    : isTempleCategory 
                      ? 'bg-orange-50/80 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300'
                      : isPermitCategory
                        ? 'bg-teal-50/80 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                        : 'bg-blue-50/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                }`}>
                  {isUpdatesCategory
                    ? `${count} ${count === 1 ? t('totalUpdates').split(' ')[0] : t('totalUpdates').split(' ')[0]}`
                    : isTempleCategory 
                      ? (count === 1 ? t('temple_count_single', { count }) : t('temple_count_plural', { count })) 
                      : isPermitCategory
                        ? `${count} ${count === 1 ? t('totalPermits').split(' ')[0] : t('totalPermits').split(' ')[0]}`
                        : `${count} ${count === 1 ? t('services').slice(0, -2) : t('services')}`
                  }
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                <h2 className={`text-sm font-bold text-gray-900 dark:text-white mb-1 transition-colors line-clamp-2 leading-tight ${
                  isUpdatesCategory
                    ? 'group-hover:text-red-600 dark:group-hover:text-red-400'
                    : isTempleCategory
                      ? 'group-hover:text-orange-600 dark:group-hover:text-orange-400'
                      : isPermitCategory
                        ? 'group-hover:text-teal-600 dark:group-hover:text-teal-400'
                        : 'group-hover:text-blue-600 dark:group-hover:text-blue-400'
                }`}>
                  {t(`${item.id}_dept_name`, { defaultValue: item.name })}
                </h2>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-normal">
                  {t(`${item.id}_dept_desc`, { defaultValue: item.description })}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Temple Card Grid Renderer (Level 2) ──────────────────────────────────
  const renderTempleGrid = (temples: typeof templesData, onClick: (id: string) => void) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {temples.map(temple => {
        const count = temple.services.length;
        const IconComponent = LucideIcons.Bell;

        return (
          <button
            key={temple.id}
            onClick={() => onClick(temple.id)}
            onMouseMove={handleMouseMove}
            className="card-focus-ring temple-card text-left bg-white/60 dark:bg-slate-900/50 backdrop-blur-lg border border-white/40 dark:border-white/5 hover:border-white/80 dark:hover:border-white/15 hover:bg-white/85 dark:hover:bg-slate-900/70 shadow-md hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 rounded-2xl flex flex-col justify-between group relative overflow-hidden p-5 cursor-pointer min-h-[160px]"
            aria-label={`${t(temple.templeName)} with ${count} services`}
          >
            {/* Spotlight radial glow */}
            <div 
              className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
              style={{
                background: 'radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(249, 115, 22, 0.15), transparent 40%)'
              }}
            />
            
            <div className="relative z-10 w-full flex flex-col gap-3 h-full">
              <div className="flex justify-between items-start">
                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 group-hover:scale-115 transition-transform duration-300 shadow-sm">
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-orange-50/80 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 rounded-full shadow-sm">
                  {count} {count === 1 ? t('services').slice(0, -2) : t('services')}
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-tight">
                  {t(temple.templeName)}
                </h2>
                <div className="flex items-center gap-1 mb-1">
                  <LucideIcons.MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t(temple.district)}</span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-normal">
                  {t(temple.description)}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Update Source Grid Renderer (Level 2 updates) ──────────────────────────
  const renderSourceGrid = (sources: typeof updateSourcesData, onClick: (id: string) => void) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {sources.map(source => {
        const count = notificationsData.filter(n => n.source === source.id).length;
        const IconComponent = LucideIcons.Globe;

        return (
          <button
            key={source.id}
            onClick={() => onClick(source.id)}
            onMouseMove={handleMouseMove}
            className="card-focus-ring subcategory-card text-left bg-white/60 dark:bg-slate-900/50 backdrop-blur-lg border border-white/40 dark:border-white/5 hover:border-white/80 dark:hover:border-white/15 hover:bg-white/85 dark:hover:bg-slate-900/70 shadow-md hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 rounded-2xl flex flex-col justify-between group relative overflow-hidden p-5 cursor-pointer min-h-[160px]"
            aria-label={`${t(`${source.id}_dept_name`, { defaultValue: source.sourceName })} with ${count} notifications`}
          >
            {/* Spotlight radial glow */}
            <div 
              className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
              style={{
                background: 'radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(239, 68, 68, 0.15), transparent 40%)'
              }}
            />
            
            <div className="relative z-10 w-full flex flex-col gap-3 h-full">
              <div className="flex justify-between items-start">
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:scale-115 transition-transform duration-300 shadow-sm">
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-red-50/80 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-full shadow-sm">
                  {count} {count === 1 ? t('totalUpdates').split(' ')[0] : t('totalUpdates').split(' ')[0]}
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2 leading-tight">
                  {t(`${source.id}_dept_name`, { defaultValue: source.sourceName })}
                </h2>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-normal">
                  {t(`${source.id}_dept_desc`, { defaultValue: `Latest official notices from ${source.sourceName}.` })}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Render Notifications List (Level 3 updates) ──────────────────────────
  const renderNotificationsList = (notifs: typeof notificationsData) => {
    if (notifs.length === 0) {
      return (
        <div className="text-center py-20 border border-[var(--border-default)] border-dashed rounded-[var(--radius-card)]">
          <p className="text-[var(--text-muted)]">{t('noResults')}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notifs.map(n => {
          const sourceObj = updateSourcesData.find(s => s.id === n.source);
          const sourceName = sourceObj ? t(`${sourceObj.id}_dept_name`, { defaultValue: sourceObj.sourceName }) : n.source;
          
          const priorityClasses: Record<string, string> = {
            "Critical": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800",
            "High": "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
            "Medium": "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
            "Low": "bg-gray-50 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700"
          };

          const pubDate = new Date(n.publishedDate);
          const todayDate = new Date('2026-06-18');
          const diffTime = Math.abs(todayDate.getTime() - pubDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isNew = diffDays <= 3;

          return (
            <div 
              key={n.id}
              onMouseMove={handleMouseMove}
              className="card-focus-ring notification-card bg-white dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative flex flex-col justify-between group overflow-hidden"
            >
              {/* Spotlight radial glow */}
              <div 
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
                style={{
                  background: 'radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(239, 68, 68, 0.1), transparent 40%)'
                }}
              />

              <div className="relative z-10">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className={`inline-flex px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${priorityClasses[n.priority] || ''}`}>
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

                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 leading-snug group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {t(n.title)}
                </h3>
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-2">
                  {sourceName}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 font-medium">
                  {t(n.summary)}
                </p>
              </div>

              <div className="relative z-10 mt-auto pt-3 border-t border-gray-100 dark:border-slate-700/50 flex justify-between items-center bg-inherit">
                <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                  {t(n.category)}
                </span>
                <a 
                  href={n.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>{t('goToOfficial')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
              
              {/* Linear bottom line glow */}
              <div 
                className="absolute bottom-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 glow-line" 
                style={{ background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 1), rgba(239, 68, 68, 0.2), transparent)' }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render Permits List (Level 3 permits) ──────────────────────────────
  const renderPermitGrid = (permits: typeof travelPermitsData) => {
    if (permits.length === 0) {
      return (
        <div className="text-center py-20 border border-[var(--border-default)] border-dashed rounded-[var(--radius-card)]">
          <p className="text-[var(--text-muted)]">{t('noResults')}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {permits.map(permit => {
          const Icon = (LucideIcons as any)[(PERMIT_CATEGORIES.find(c => c.id === permit.category) as any)?.iconName || 'Shield'] || LucideIcons.Shield;
          
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
              {/* Spotlight Glow */}
              <div 
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
                style={{
                  background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(20, 184, 166, 0.15), transparent 40%)'
                }}
              />
              
              <div className="w-full h-16 relative overflow-hidden bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-center z-10">
                <img 
                  src={imgUrl} 
                  alt={permit.permitName} 
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>

              <div className="p-4 flex-1 flex flex-col relative z-10 bg-inherit">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/50 dark:to-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="flex items-start gap-3 mb-2 relative z-10">
                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 shadow-inner transition-transform duration-500 group-hover:scale-110">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {t(permit.permitName)}
                    </h3>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-1 font-medium relative z-10 mb-2">
                  {t(permit.description)}
                </p>

                <div className="mt-auto relative z-10 space-y-2">
                  <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50">
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 block mb-0.5">{t('requiredDocs')}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block line-clamp-1">{t(permit.requiredDocuments)}</span>
                  </div>
                  
                  <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 text-[10px]">
                    <span className="font-bold text-gray-600 dark:text-gray-300 block mb-0.5">{t('validity')}</span>
                    <span className="text-gray-500 dark:text-gray-400 block">{t(permit.validity)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded shadow-sm border border-teal-100 dark:border-teal-800">
                      {permit.onlineAvailable ? t('online') : t('offline')}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold">
                      Updated: {permit.lastUpdated}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Glow border line on hover */}
              <div 
                className="absolute bottom-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 glow-line" 
                style={{ background: 'linear-gradient(90deg, transparent, rgba(20, 184, 166, 0.2), rgba(20, 184, 166, 1), rgba(20, 184, 166, 0.2), transparent)' }}
              />
            </a>
          );
        })}
      </div>
    );
  };

  const filterTabs = [
    { id: 'all', labelKey: 'allUpdates' },
    { id: 'today', labelKey: 'today' },
    { id: '7days', labelKey: 'last7Days' },
    { id: 'recruitment', labelKey: 'recruitment' },
    { id: 'scholarships', labelKey: 'scholarships' },
    { id: 'temple', labelKey: 'templeUpdates' },
    { id: 'travel', labelKey: 'travelUpdates' },
    { id: 'critical', labelKey: 'criticalAlerts' }
  ];

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="py-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center text-sm flex-wrap gap-y-2">
        <button 
          onClick={handleBack}
          className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('back')}
        </button>
        <span className="mx-2 text-[var(--border-hover)]">|</span>
        <Link to="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          {t('home')}
        </Link>
        <ChevronRight className="w-4 h-4 mx-1 text-[var(--text-muted)]" />
        
        {renderBreadcrumb()}
      </nav>

      {/* Header */}
      <div className="mb-8 border-b border-[var(--border-default)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
          {getTitle()}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {getDescription()}
        </p>
      </div>

      {/* ── GOVERNMENT UPDATES CATEGORY: 3-LEVEL NAVIGATION ───────────────── */}
      {isUpdatesCategory ? (
        <>
          {/* Level 1: Category cards */}
          {!currentUpdatesCat ? (
            renderCardGrid(
              UPDATE_CATEGORIES,
              (cat) => notificationsData.filter(n => n.category === cat.id).length,
              (id) => setSearchParams({ cat: id })
            )
          ) : !currentUpdateSource ? (
            /* Level 2: Update Source Cards for selected category */
            renderSourceGrid(
              updateSourcesData.filter(s => s.category === catId),
              (id) => setSearchParams({ cat: catId!, source: id })
            )
          ) : (
            /* Level 3: Renders notifications list with tabs */
            <>
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                {filterTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-white/60 dark:bg-slate-900/50 text-gray-600 dark:text-gray-400 hover:bg-white/90 dark:hover:bg-slate-900/80 border border-gray-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>
              {renderNotificationsList(filteredNotifications)}
            </>
          )}
        </>
      ) : isTempleCategory ? (
        <>
          {/* Level 1: State Cards + Pinned Most Used */}
          {!currentTempleState ? (
            <>
              {/* Most Used Temples Section */}
              {mostUsedTemples.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('mostUsedTemples')}</h2>
                  </div>
                  {renderTempleGrid(mostUsedTemples, (id) => {
                    const temp = templesData.find(t => t.id === id);
                    if (temp) {
                      const tState = stateIdMap[temp.state] || '';
                      setSearchParams({ state: tState, temple: id });
                    }
                  })}
                </div>
              )}

              {/* State Cards */}
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('selectState')}</h2>
              </div>
              {renderCardGrid(
                TEMPLE_STATES,
                (state) => templesData.filter(t => t.state === state.name).length,
                (id) => setSearchParams({ state: id })
              )}
            </>
          ) : !currentTemple ? (
            /* Level 2: Temple Cards for selected state */
            renderTempleGrid(
              templesData.filter(t => t.state === currentTempleState.name),
              (id) => setSearchParams({ state: stateId!, temple: id })
            )
          ) : (
            /* Level 3: Service cards for selected temple */
            <ServiceGrid services={displayedServices} />
          )}
        </>
      ) : isPermitCategory ? (
        <>
          {/* Level 1: State Cards + Most Used */}
          {!currentState ? (
            <>
              {/* Most Used Permits - Pinned Section */}
              {mostUsedPermits.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-teal-500 fill-teal-500" />
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('mostUsedPermits')}</h2>
                  </div>
                  {renderPermitGrid(mostUsedPermits)}
                </div>
              )}

              {/* State Cards */}
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('selectState')}</h2>
              </div>
              {renderCardGrid(
                PERMIT_STATES,
                (state) => travelPermitsData.filter(p => p.state === state.name).length,
                (id) => setSearchParams({ state: id })
              )}
            </>
          ) : !currentPermitCat ? (
            /* Level 2: Permit Category Cards for selected state */
            renderCardGrid(
              PERMIT_CATEGORIES,
              (cat) => travelPermitsData.filter(p => p.state === selectedStateName && p.category === cat.id).length,
              (id) => setSearchParams({ state: stateId!, cat: id })
            )
          ) : (
            /* Level 3: Service cards for state + category */
            renderPermitGrid(displayedPermits)
          )}
        </>
      ) : isDeptCategory && !currentDept ? (
        /* ── DEPT CATEGORY: Level 1 Department Cards ──────────────────────── */
        renderCardGrid(
          deptList,
          (dept) => categoryServices.filter(s => s.departmentId === dept.id).length,
          (id) => setSearchParams({ dept: id })
        )
      ) : (
        /* ── Level 2 (Selected Dept) or Non-Hierarchical Category ─────────── */
        <ServiceGrid services={displayedServices} />
      )}
    </div>
  );
}
