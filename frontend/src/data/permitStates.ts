import type { Department } from './departments';

/**
 * Travel Permit States
 * ────────────────────
 * 19 Indian states/territories with official travel permit services.
 * Uses the existing Department interface for consistency with state/central dept cards.
 * Each state's `id` is prefixed with `ps_` (permit-state) to avoid collision.
 */
export const PERMIT_STATES: Department[] = [
  { id: 'ps_karnataka',    name: 'Karnataka',          description: 'Bandipur, Nagarahole, Kabini safaris, and eco-tourism permits.', iconName: 'MapPin' },
  { id: 'ps_kerala',       name: 'Kerala',             description: 'Periyar, Wayanad wildlife sanctuaries, and eco-tourism permits.', iconName: 'MapPin' },
  { id: 'ps_tamilnadu',    name: 'Tamil Nadu',         description: 'Ooty, Kodaikanal e-passes, and Mudumalai safari bookings.',       iconName: 'MapPin' },
  { id: 'ps_andhra',       name: 'Andhra Pradesh',     description: 'Srisailam forest entry and environmental transit permits.',       iconName: 'MapPin' },
  { id: 'ps_telangana',    name: 'Telangana',          description: 'State eco-tourism, tiger reserve permits, and safari passes.',   iconName: 'MapPin' },
  { id: 'ps_goa',          name: 'Goa',                description: 'Goa tourism vehicle entry and sanctuary entry permits.',          iconName: 'MapPin' },
  { id: 'ps_maharashtra',  name: 'Maharashtra',        description: 'Tadoba safari bookings, wildlife zones, and trekking permits.',  iconName: 'MapPin' },
  { id: 'ps_uttarakhand',  name: 'Uttarakhand',        description: 'Char Dham registrations and Valley of Flowers permits.',          iconName: 'MapPin' },
  { id: 'ps_himachal',     name: 'Himachal Pradesh',   description: 'Rohtang Pass permits and Atal Tunnel transit advisories.',       iconName: 'MapPin' },
  { id: 'ps_jk',           name: 'Jammu & Kashmir',    description: 'Gulmarg and Sonamarg local tourism entry registrations.',        iconName: 'MapPin' },
  { id: 'ps_ladakh',       name: 'Ladakh',             description: 'Inner Line Permits for border zones, Pangong, and Nubra.',        iconName: 'MapPin' },
  { id: 'ps_assam',        name: 'Assam',              description: 'Kaziranga National Park safari and Majuli tourism entry.',        iconName: 'MapPin' },
  { id: 'ps_meghalaya',    name: 'Meghalaya',          description: 'Meghalaya eco-tourism and living root bridge entries.',          iconName: 'MapPin' },
  { id: 'ps_arunachal',    name: 'Arunachal Pradesh',  description: 'Arunachal Pradesh Inner Line Permit (ILP) registrations.',        iconName: 'MapPin' },
  { id: 'ps_nagaland',     name: 'Nagaland',           description: 'Nagaland Inner Line Permit (ILP) tourist registrations.',         iconName: 'MapPin' },
  { id: 'ps_manipur',      name: 'Manipur',            description: 'Manipur Inner Line Permit (ILP) and travel permissions.',        iconName: 'MapPin' },
  { id: 'ps_mizoram',      name: 'Mizoram',            description: 'Mizoram Inner Line Permit (ILP) border entry passes.',           iconName: 'MapPin' },
  { id: 'ps_tripura',      name: 'Tripura',            description: 'State eco-tourism and wildlife sanctuary entry permits.',         iconName: 'MapPin' },
  { id: 'ps_sikkim',       name: 'Sikkim',             description: 'Sikkim restricted area permits (RAP) and travel passes.',         iconName: 'MapPin' }
];
