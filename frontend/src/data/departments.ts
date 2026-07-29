export interface Department {
  id: string;
  name: string;
  description: string;
  iconName: string;
}

export const DEPARTMENTS: Department[] = [
  { id: 'citizen', name: 'Citizen Services', description: 'Access essential citizen service portals and helpline networks.', iconName: 'Users' },
  { id: 'land', name: 'Land & Property', description: 'Manage property registration, land records, and survey services.', iconName: 'Home' },
  { id: 'rdpr', name: 'RDPR & Gram Panchayat', description: 'Explore rural development, panchayat tax, and local administration.', iconName: 'Landmark' },
  { id: 'revenue', name: 'Revenue & Certificates', description: 'Apply for caste, income, domicile, and other official certificates.', iconName: 'FileText' },
  { id: 'transport', name: 'Transport', description: 'Access driving licence services, vehicle registration, and permits.', iconName: 'Car' },
  { id: 'utilities', name: 'Utilities', description: 'Pay electricity, water, and sewerage bills, and access sanitation services.', iconName: 'Zap' },
  { id: 'welfare', name: 'Welfare Schemes', description: 'Access state welfare programs, direct benefit transfers, and pensions.', iconName: 'Heart' },
  { id: 'agriculture', name: 'Agriculture', description: 'Support systems for crop insurance, subsidies, and farmer welfare.', iconName: 'Tractor' },
  { id: 'education', name: 'Education', description: 'Check results, search school admissions, and access student services.', iconName: 'GraduationCap' },
  { id: 'health', name: 'Health', description: 'Explore health cover schemes, hospital finders, and healthcare resources.', iconName: 'Activity' },
  { id: 'business', name: 'Business & Licenses', description: 'Apply for trade licences, shop licenses, and business registrations.', iconName: 'Briefcase' },
  { id: 'housing', name: 'Housing & Urban', description: 'Check urban housing schemes, housing allotments, and rehabilitation projects.', iconName: 'Building2' },
  { id: 'employment', name: 'Employment & Labour', description: 'Register for labour welfare schemes, job portals, and skill development.', iconName: 'Hammer' },
  { id: 'legal', name: 'Legal & RTI', description: 'Access case status, legal aid, and Right to Information portals.', iconName: 'Gavel' },
  { id: 'other', name: 'Other Services', description: 'Explore other miscellaneous public services and resources.', iconName: 'HelpCircle' }
];
