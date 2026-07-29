import type { Department } from './departments';

/**
 * Travel Permit Categories
 * ────────────────────────
 * 8 citizen-friendly categories for grouping permit/entry pass services.
 * Used as Level 2 navigation within each state.
 * Each category's `id` is prefixed with `pc_` (permit-category).
 */
export const PERMIT_CATEGORIES: Department[] = [
  { id: 'pc_hill',       name: 'Hill Stations',            description: 'E-passes and entry permits for hill station visits.',       iconName: 'Mountain' },
  { id: 'pc_forest',     name: 'Forest & Wildlife',        description: 'Safari bookings, jungle permits and wildlife sanctuary entry.', iconName: 'TreePine' },
  { id: 'pc_eco',        name: 'Eco Tourism',              description: 'Eco-tourism packages, nature camps and resort bookings.',   iconName: 'Leaf' },
  { id: 'pc_vehicle',    name: 'Vehicle Entry Permits',    description: 'Tourist vehicle passes and road entry permits.',            iconName: 'Car' },
  { id: 'pc_camping',    name: 'Trekking & Camping',       description: 'Trekking permits, camping ground bookings and trail passes.', iconName: 'Tent' },
  { id: 'pc_tourism',    name: 'Tourism Registrations',    description: 'General tourism registrations, monument tickets and tours.', iconName: 'Camera' },
  { id: 'pc_restricted', name: 'Restricted Area Permits',  description: 'Inner Line Permits and protected area travel permissions.', iconName: 'ShieldAlert' },
  { id: 'pc_special',    name: 'Special Entry Permissions',description: 'Special entry passes, boundary permissions and gate passes.', iconName: 'UserCheck' }
];
