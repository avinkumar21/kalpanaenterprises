import type { Department } from './departments';

/**
 * Central Government Service Categories
 * ──────────────────────────────────────
 * 15 citizen-facing categories for hierarchical navigation.
 * Uses the same Department interface as State Government departments.
 * departmentId on services uses the `id` field below (prefixed with c_).
 */
export const CENTRAL_DEPARTMENTS: Department[] = [
  { id: 'c_identity',    name: 'Identity & Documents',     description: 'Aadhaar, PAN, Passport, Voter ID and DigiLocker services.',     iconName: 'Fingerprint' },
  { id: 'c_finance',     name: 'Finance & Taxation',       description: 'Income tax filing, savings schemes and financial inclusion.',    iconName: 'IndianRupee' },
  { id: 'c_employment',  name: 'Employment & Labour',      description: 'EPFO, eShram, career services and skill development.',          iconName: 'Hammer' },
  { id: 'c_pension',     name: 'Pension & Retirement',     description: 'NPS, Atal Pension, life certificates and pensioner portals.',    iconName: 'Clock' },
  { id: 'c_agriculture', name: 'Agriculture & Farmers',    description: 'PM Kisan, crop insurance, soil health and farmer registration.', iconName: 'Tractor' },
  { id: 'c_education',   name: 'Education & Scholarships', description: 'National scholarships, online courses and academic services.',   iconName: 'GraduationCap' },
  { id: 'c_health',      name: 'Health & Healthcare',      description: 'Ayushman Bharat, ABHA Health ID, telemedicine and vaccines.',    iconName: 'HeartPulse' },
  { id: 'c_travel',      name: 'Travel & Transport',       description: 'Railways, driving licence, vehicle registration and FASTag.',    iconName: 'Plane' },
  { id: 'c_housing',     name: 'Housing & Property',       description: 'PM Awas Yojana urban and rural housing schemes.',               iconName: 'Home' },
  { id: 'c_women',       name: 'Women & Child Welfare',    description: 'Beti Bachao, maternity benefits, nutrition and child welfare.',  iconName: 'Baby' },
  { id: 'c_social',      name: 'Social Welfare',           description: 'Disability ID, senior citizen services and welfare schemes.',    iconName: 'HandHeart' },
  { id: 'c_business',    name: 'Business & MSME',          description: 'GST, Udyam, Startup India, GeM and MSME registration.',         iconName: 'Briefcase' },
  { id: 'c_legal',       name: 'Legal, RTI & Complaints',  description: 'RTI, public grievances, eCourts and consumer complaints.',       iconName: 'Gavel' },
  { id: 'c_digital',     name: 'Digital India Portals',    description: 'UMANG, MyGov, ServicePlus and open government data.',            iconName: 'Globe' },
  { id: 'c_postal',      name: 'Postal & Communication',   description: 'India Post tracking, postal savings and insurance services.',    iconName: 'Mail' },
];
