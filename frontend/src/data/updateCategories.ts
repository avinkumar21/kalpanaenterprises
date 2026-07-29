import type { Department } from './departments';

/**
 * Government Update Categories
 * ────────────────────────────
 * 10 categories mapping to types of notifications, alerts and circulars.
 * Uses the existing Department interface for compatibility with card rendering.
 * IDs are prefixed with `uc_` (update-category).
 */
export const UPDATE_CATEGORIES: Department[] = [
  { id: 'uc_central',     name: 'Central Government',      description: 'Notifications from UIDAI, Income Tax, EPFO, Passport, etc.', iconName: 'Landmark' },
  { id: 'uc_karnataka',    name: 'Karnataka Government',     description: 'Circulars, orders, and portal updates from Karnataka departments.', iconName: 'Building2' },
  { id: 'uc_temple',       name: 'Temple Updates',           description: 'Darshan timings, special seva releases, and festival alerts.',    iconName: 'Bell' },
  { id: 'uc_travel',       name: 'Travel Permit Updates',    description: 'Safari booking schedules, hill e-pass updates, and yatra passes.', iconName: 'Compass' },
  { id: 'uc_education',    name: 'Education Updates',        description: 'Scholarship application deadlines, exam board notices, and alerts.', iconName: 'GraduationCap' },
  { id: 'uc_recruitment',  name: 'Recruitment Updates',      description: 'Job advertisements, exam dates, and results from SSC, KPSC, etc.', iconName: 'Briefcase' },
  { id: 'uc_agriculture',  name: 'Agriculture Updates',      description: 'PM Kisan instalments, crop insurance notices, and weather alerts.', iconName: 'Tractor' },
  { id: 'uc_health',       name: 'Health Updates',           description: 'Health schemes, vaccination campaign updates, and safety alerts.', iconName: 'Stethoscope' },
  { id: 'uc_utility',      name: 'Utility Updates',          description: 'Power outages, BESCOM/BWSSB revisions, and services notices.',  iconName: 'Zap' },
  { id: 'uc_general',      name: 'General Announcements',    description: 'Public holidays, advisories, and administration announcements.',   iconName: 'FileText' }
];
