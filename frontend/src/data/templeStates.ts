import type { Department } from './departments';

/**
 * Temple States
 * ─────────────
 * Indian states with official temple darshan, seva, and accommodation booking resources.
 * Each state's `id` is prefixed with `ts_` (temple-state) to avoid collision.
 */
export const TEMPLE_STATES: Department[] = [
  { id: 'ts_karnataka',     name: 'Karnataka',          description: 'Kukke, Dharmasthala, Chamundeshwari, and other major temple bookings.', iconName: 'Compass' },
  { id: 'ts_kerala',         name: 'Kerala',             description: 'Sabarimala Virtual Q, Guruvayur Devaswom, and other temple resources.',   iconName: 'Compass' },
  { id: 'ts_tamilnadu',      name: 'Tamil Nadu',         description: 'Madurai Meenakshi, Rameshwaram, and HR&CE temple bookings.',              iconName: 'Compass' },
  { id: 'ts_andhra',         name: 'Andhra Pradesh',     description: 'Tirumala Tirupati (TTD), Sri Kalahasti, and Srisailam bookings.',          iconName: 'Compass' },
  { id: 'ts_telangana',      name: 'Telangana',          description: 'Yadadri Lakshmi Narasimha Swamy and state temple registrations.',        iconName: 'Compass' },
  { id: 'ts_odisha',         name: 'Odisha',             description: 'Jagannath Puri darshan, Rath Yatra, and temple trust services.',          iconName: 'Compass' },
  { id: 'ts_maharashtra',    name: 'Maharashtra',        description: 'Shirdi Sai Baba Sansthan, Siddhivinayak, and state temple bookings.',     iconName: 'Compass' },
  { id: 'ts_uttarpradesh',   name: 'Uttar Pradesh',      description: 'Kashi Vishwanath, Ayodhya Ram Mandir, and Char Dham registrations.',      iconName: 'Compass' },
  { id: 'ts_madhyapradesh',  name: 'Madhya Pradesh',     description: 'Ujjain Mahakaleshwar Jyotirlinga and state temple services.',             iconName: 'Compass' },
  { id: 'ts_gujarat',        name: 'Gujarat',            description: 'Somnath Jyotirlinga, Dwarka, and major temple trust services.',           iconName: 'Compass' },
  { id: 'ts_uttarakhand',    name: 'Uttarakhand',        description: 'Kedarnath Dham, Badrinath, and Uttarakhand Char Dham registrations.',     iconName: 'Compass' },
  { id: 'ts_jk',             name: 'Jammu & Kashmir',    description: 'Mata Vaishno Devi Shrine, Amarnath, and J&K temple services.',            iconName: 'Compass' },
  { id: 'ts_westbengal',     name: 'West Bengal',        description: 'Dakshineswar Kali Temple, Kalighat, and heritage temples.',               iconName: 'Compass' },
  { id: 'ts_assam',          name: 'Assam',              description: 'Kamakhya Temple and Assam state temple trust services.',                  iconName: 'Compass' }
];
