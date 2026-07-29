import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Service } from '../../data/services';
import { 
  Banknote, FileBadge, Home, Tractor, Zap, Users, FileText, Globe, 
  Briefcase, BusFront, Gavel, GraduationCap, Train, Plane, Tickets, 
  Stethoscope, Bell
} from 'lucide-react';
import { resolveServiceImage } from '../../utils/imageResolver';

interface ServiceGridProps {
  services: Service[];
  showCategoryBadge?: boolean;
}

// Strictly semantically appropriate icons
const getIconForTag = (tag: string) => {
  const t = tag.toLowerCase();
  if (t.includes('temple') || t.includes('darshan') || t.includes('pooja')) return Bell;
  if (t.includes('transport') || t.includes('bus') || t.includes('car') || t.includes('taxi')) return BusFront;
  if (t.includes('rail') || t.includes('metro')) return Train;
  if (t.includes('air')) return Plane;
  if (t.includes('health') || t.includes('vaccine') || t.includes('blood') || t.includes('consultation')) return Stethoscope;
  if (t.includes('education') || t.includes('scholarship') || t.includes('admissions') || t.includes('e-learning')) return GraduationCap;
  if (t.includes('finance') || t.includes('tax') || t.includes('revenue')) return Banknote;
  if (t.includes('identity') || t.includes('documents') || t.includes('records')) return FileBadge;
  if (t.includes('housing') || t.includes('municipal') || t.includes('real estate')) return Home;
  if (t.includes('agriculture') || t.includes('rural')) return Tractor;
  if (t.includes('legal') || t.includes('security')) return Gavel;
  if (t.includes('utilities') || t.includes('telecom')) return Zap;
  if (t.includes('welfare') || t.includes('democracy') || t.includes('social')) return Users;
  if (t.includes('business') || t.includes('employment') || t.includes('labour')) return Briefcase;
  if (t.includes('portal') || t.includes('services')) return Globe;
  if (t.includes('tourism') || t.includes('entertainment') || t.includes('sports')) return Tickets;
  return FileText;
};

// Map category IDs to their specific sub-colors from the spec
const categoryColors: Record<string, string> = {
  central: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  state: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  travel: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  bookings: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20',
  health: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  education: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  temple: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  ca: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
};

export const ServiceGrid = memo(function ServiceGrid({ services, showCategoryBadge }: ServiceGridProps) {
  const { t } = useTranslation();

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };
  
  // Filter out services that have explicitly failed validation
  const visibleServices = services.filter(s => s.validated !== false);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {visibleServices.map((service) => {
        const Icon = getIconForTag(service.tag);
        const colorClass = categoryColors[service.categoryId] || 'text-gray-600 bg-gray-50';
        const imgUrl = resolveServiceImage(service.tag, service.categoryId, service.image);

        return (
          <a
            key={service.id}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseMove={handleMouseMove}
            className="card-focus-ring service-card flex flex-col bg-white dark:bg-slate-800/95 backdrop-blur-md border border-gray-200 dark:border-slate-700 hover:border-transparent dark:hover:border-transparent hover:bg-gray-50 dark:hover:bg-slate-700 hover:-translate-y-1 hover:shadow-xl rounded-xl transition-all duration-300 group overflow-hidden relative"
            role="button"
            aria-label={`Open ${t(service.name)}`}
          >
            {/* Spotlight Radial Glow Hover Effect */}
            <div 
              className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-0"
              style={{
                background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(var(--glow-color), 0.15), transparent 40%)'
              }}
            />

            {/* Contextual Image Thumbnail Header - Made Smaller */}
            <div className="w-full h-16 relative overflow-hidden bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-center z-10">
              <img 
                src={imgUrl} 
                alt={`${service.tag} category`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                <Icon className={`w-8 h-8 opacity-30 ${categoryColors[service.categoryId]?.split(' ')[0] || 'text-gray-500'}`} />
              </div>
              
              {/* Small Category ID Badge overlayed on image */}
              {showCategoryBadge && (
                <div className={`absolute top-2 right-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded backdrop-blur-md bg-white/90 dark:bg-black/80 ${categoryColors[service.categoryId]?.split(' ')[0]}`}>
                  {service.categoryId}
                </div>
              )}
            </div>
            
            {/* Content Area */}
            <div className="p-4 flex-1 flex flex-col relative z-10 bg-inherit">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/50 dark:to-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="flex items-start gap-3 mb-2 relative z-10">
                <div className={`p-2 rounded-lg ${colorClass} shadow-inner transition-transform duration-500 group-hover:scale-110`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t(service.name)}
                  </h3>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-1 font-medium relative z-10 mb-2">
                {t(service.description)}
              </p>
              
              <div className="mt-auto relative z-10 space-y-2">
                <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50">
                  <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 block mb-0.5">{t('requiredDocs')}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block line-clamp-1">
                    {service.categoryId === 'health' ? t('docs_health') : 
                     service.categoryId === 'travel' ? t('docs_travel') : 
                     service.categoryId === 'education' ? t('docs_education') :
                     service.categoryId === 'temple' ? t('docs_temple') :
                     t('docs_default')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded shadow-sm border border-blue-100 dark:border-blue-800">
                    {t(`tag_${service.tag}`, { defaultValue: service.tag })}
                  </span>
                  {service.validated === true && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm">
                      {t('verifiedGovt')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Linear Gradient Bottom Glow Hover Effect */}
            <div 
              className="absolute bottom-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 glow-line" 
              style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--glow-color), 0.2), rgba(var(--glow-color), 1), rgba(var(--glow-color), 0.2), transparent)' }}
            />
          </a>
        );
      })}
    </div>
  );
});
