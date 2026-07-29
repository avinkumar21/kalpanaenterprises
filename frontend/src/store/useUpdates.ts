import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import defaultSources from '../data/update-sources.json';
import defaultNotifications from '../data/notifications.json';

// Matches database table: portal_registry
export interface PortalRegistry {
  id: string;
  portal_name: string;
  category: string;
  official_url: string;
  notification_url: string;
  rss_url: string;
  last_checked: string; // ISO date string or timestamp
  active: boolean;
}

// Matches database table: portal_updates
export interface PortalUpdate {
  id: string;
  portal_name: string;
  title: string;
  summary: string;
  source_url: string;
  published_date: string; // YYYY-MM-DD
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  detected_at: string; // ISO date string or timestamp
}

interface UpdatesState {
  registry: PortalRegistry[];
  updates: PortalUpdate[];
  loading: boolean;
  lastSyncTime: string | null;
  readUpdateIds: string[];
  runDeltaSync: (force?: boolean) => Promise<void>;
  toggleSource: (id: string) => void;
  resetRegistryAndUpdates: () => void;
  markAllAsRead: () => void;
}

// Priority Engine mapping rules
export function determinePriority(title: string, summary: string): 'Critical' | 'High' | 'Medium' | 'Low' {
  const text = `${title} ${summary}`.toLowerCase();
  
  // 1. Critical rules: Application Closing Soon, Registration Deadline, Portal Outage
  if (
    text.includes('closing soon') || 
    text.includes('deadline') || 
    text.includes('last date') ||
    text.includes('outage') || 
    text.includes('offline') || 
    text.includes('downtime') ||
    text.includes('maintenance')
  ) {
    return 'Critical';
  }
  
  // 2. High rules: Recruitment, Scholarship, Exam Registration, Temple Festival Registration, Permit Change
  if (
    text.includes('recruitment') || 
    text.includes('job') || 
    text.includes('vacancy') || 
    text.includes('scholarship') || 
    text.includes('exam') || 
    text.includes('result') || 
    text.includes('darshan tickets') || 
    text.includes('festival registration') || 
    text.includes('permit change') ||
    text.includes('mandatory')
  ) {
    return 'High';
  }
  
  // 3. Medium rules: Scheme Update, Circular, Notice
  if (
    text.includes('scheme update') || 
    text.includes('circular') || 
    text.includes('notice') || 
    text.includes('instalment') ||
    text.includes('upgrade') ||
    text.includes('pooja') ||
    text.includes('opening dates')
  ) {
    return 'Medium';
  }
  
  // 4. Low rules: Information Update, general announcements, advisories, holidays
  return 'Low';
}

// Sync Engine Interval rules (in minutes)
function getSyncIntervalMinutes(category: string): number {
  const cat = category.toLowerCase();
  if (cat.includes('recruitment') || cat.includes('education')) {
    return 15; // Critical sources: 15 mins
  }
  if (cat.includes('travel') || cat.includes('temple')) {
    return 60; // High Priority: 1 hour (60 mins)
  }
  if (cat.includes('utility') || cat.includes('karnataka') || cat.includes('central')) {
    return 360; // Medium Priority: 6 hours (360 mins)
  }
  return 1440; // Low Priority: 24 hours (1440 mins)
}

// Initial registry seed mapping from update-sources.json
const initialRegistry: PortalRegistry[] = defaultSources.map(s => ({
  id: s.id,
  portal_name: s.sourceName,
  category: s.category,
  official_url: s.officialUrl,
  notification_url: s.notificationUrl,
  rss_url: s.rssFeed,
  last_checked: s.lastChecked ? new Date(s.lastChecked).toISOString() : new Date(0).toISOString(),
  active: s.enabled
}));

// Initial updates seed mapping from notifications.json
const initialUpdates: PortalUpdate[] = defaultNotifications.map(n => {
  const sourceName = defaultSources.find(s => s.id === n.source)?.sourceName || 'Government Portal';
  return {
    id: n.id,
    portal_name: sourceName,
    title: n.title,
    summary: n.summary,
    source_url: n.sourceUrl,
    published_date: n.publishedDate,
    priority: n.priority as any || determinePriority(n.title, n.summary),
    category: n.category,
    detected_at: n.detectedDate ? new Date(n.detectedDate).toISOString() : new Date().toISOString()
  };
});

export const useUpdates = create<UpdatesState>()(
  persist(
    (set, get) => ({
      registry: initialRegistry,
      updates: initialUpdates,
      loading: false,
      lastSyncTime: null,
      readUpdateIds: [],

      runDeltaSync: async (force = false) => {
        set({ loading: true });
        
        // Simulate network/database async fetching to avoid blocking UI rendering
        await new Promise((resolve) => setTimeout(resolve, 800));

        const { registry, updates } = get();
        const now = new Date();
        let anyUpdated = false;
        
        const updatedRegistry = registry.map(source => {
          if (!source.active) return source;

          const lastCheckedTime = new Date(source.last_checked).getTime();
          const minutesElapsed = (now.getTime() - lastCheckedTime) / (1000 * 60);
          const interval = getSyncIntervalMinutes(source.category);

          if (force || minutesElapsed >= interval) {
            anyUpdated = true;
            return {
              ...source,
              last_checked: now.toISOString()
            };
          }
          return source;
        });

        // Delta Synchronization: Simulate checking for updates that were created/detected
        // after the last_checked timestamp of the registry portals.
        let newUpdatesAddedCount = 0;
        const currentUpdateIds = new Set(updates.map(u => u.id));
        const updatedUpdatesList = [...updates];

        if (anyUpdated || force) {
          // Check defaultNotifications for any delta updates.
          // (In a production environment, this scans the portal's notification feeds/RSS)
          defaultNotifications.forEach(notif => {
            const matchingSource = registry.find(s => s.id === notif.source);
            if (!matchingSource || !matchingSource.active) return;

            // If we are forcing sync or the update detected timestamp is newer than source's previous last_checked
            const updateDetectedTime = new Date(notif.detectedDate || notif.publishedDate).getTime();
            const sourceLastCheckedTime = new Date(matchingSource.last_checked).getTime();

            // Delta condition: Only add if not already in list, and it matches delta timestamp checks
            if (!currentUpdateIds.has(notif.id)) {
              if (force || updateDetectedTime > sourceLastCheckedTime) {
                const calculatedPriority = determinePriority(notif.title, notif.summary);
                updatedUpdatesList.push({
                  id: notif.id,
                  portal_name: matchingSource.portal_name,
                  title: notif.title,
                  summary: notif.summary,
                  source_url: notif.sourceUrl,
                  published_date: notif.publishedDate,
                  priority: notif.priority as any || calculatedPriority,
                  category: notif.category,
                  detected_at: new Date(notif.detectedDate || now).toISOString()
                });
                newUpdatesAddedCount++;
              }
            }
          });
        }

        // Sort updates by published_date descending (newest first)
        const sortedUpdates = updatedUpdatesList.sort((a, b) => 
          new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
        );

        set({
          registry: updatedRegistry,
          updates: sortedUpdates,
          loading: false,
          lastSyncTime: now.toISOString()
        });

        if (newUpdatesAddedCount > 0) {
          console.log(`[Sync Engine] Delta sync successfully registered ${newUpdatesAddedCount} new updates.`);
        }
      },

      toggleSource: (id: string) => set((state) => ({
        registry: state.registry.map(source => 
          source.id === id ? { ...source, active: !source.active } : source
        )
      })),

      resetRegistryAndUpdates: () => set({
        registry: initialRegistry,
        updates: initialUpdates,
        lastSyncTime: null,
        readUpdateIds: []
      }),

      markAllAsRead: () => set((state) => ({
        readUpdateIds: state.updates.map(u => u.id)
      }))
    }),
    {
      name: 'arka-updates-storage', // key in localStorage (caching requirement)
      version: 2,
    }
  )
);
