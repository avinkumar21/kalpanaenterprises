import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const servicesFilePath = path.join(__dirname, '../src/data/services.ts');
const targetDir = path.join(__dirname, '../src/data');

// Read the typescript services file
let content = fs.readFileSync(servicesFilePath, 'utf-8');

// Find the constant V definition
const vMatch = content.match(/const V\s*=\s*['"]([^'"]+)['"]/);
const V = vMatch ? vMatch[1] : '2026-06-17';

// Find the services array definition
const startIdx = content.indexOf('export const services: Service[] = [');
if (startIdx === -1) {
  console.error('Could not find services array definition in services.ts');
  process.exit(1);
}

const arrayContent = content.substring(startIdx);
const endIdx = arrayContent.lastIndexOf('];');
if (endIdx === -1) {
  console.error('Could not find closing bracket for services array');
  process.exit(1);
}

const rawArrayString = arrayContent.substring('export const services: Service[] ='.length, endIdx + 2);

// Evaluate rawArrayString to get the JS array
// Inject const V so it can be evaluated
const fn = new Function('V', `return ${rawArrayString}`);
const services = fn(V);

console.log(`Successfully parsed ${services.length} services from services.ts`);

// Map to Master Registry Record Model
const masterRegistry = services.map(s => {
  let type = '';
  if (s.categoryId === 'central') type = 'Central Government';
  else if (s.categoryId === 'state') type = 'State Government';
  else if (s.categoryId === 'temple') type = 'Temple';
  else if (s.categoryId === 'permits') type = 'Travel Permit';
  else if (s.categoryId === 'travel') type = 'Travel & Transport';
  else if (s.categoryId === 'bookings') type = 'Booking';
  else if (s.categoryId === 'ca') type = 'CA & Financial Services';
  else if (s.categoryId === 'health') type = 'Health';
  else if (s.categoryId === 'education') type = 'Education';
  else type = s.categoryId;

  let state = '';
  let department = '';
  if (s.categoryId === 'state') {
    department = s.departmentId || '';
    state = 'ps_karnataka'; // Maintain state ID consistency for filters
  } else if (s.categoryId === 'central') {
    department = s.departmentId || '';
  } else if (s.categoryId === 'permits') {
    state = s.departmentId || ''; // e.g. ps_karnataka
    department = '';
  }

  return {
    id: s.id,
    name: s.name,
    type: type,
    category: s.categoryName,
    subcategory: s.permitCategoryId || '',
    state: state,
    department: department,
    description: s.description,
    officialUrl: s.url,
    notificationUrl: '',
    validated: s.validated,
    statusCode: s.statusCode,
    lastValidated: s.lastValidatedDate,
    lastUpdated: s.lastValidatedDate,
    keywords: s.tag ? [s.tag] : [],
    image: s.image || '',
    popularityScore: s.popularityScore || 'Medium'
  };
});

// Create validation-cache.json
const validationCache = {};
services.forEach(s => {
  if (s.url) {
    validationCache[s.url] = {
      statusCode: s.statusCode,
      validated: s.validated,
      lastValidated: s.lastValidatedDate.includes('T') ? s.lastValidatedDate : `${s.lastValidatedDate}T00:00:00Z`
    };
  }
});

// Helper function to generate clean search keywords from service record
function generateKeywords(record) {
  const textToTokenize = [
    record.name,
    record.category,
    record.subcategory,
    record.state,
    record.department,
    record.description,
    ...(record.keywords || [])
  ].join(' ').toLowerCase();

  // Split by non-alphanumeric characters
  const tokens = textToTokenize.split(/[^a-zA-Z0-9\u0C80-\u0CFF]+/)
    .map(t => t.trim())
    .filter(t => t.length > 2);

  return Array.from(new Set(tokens));
}

// Create search-index.json
const searchIndex = {};
masterRegistry.forEach(record => {
  searchIndex[record.id] = generateKeywords(record);
});

// Create default notifications.json matching the model
const defaultNotifications = [
  {
    id: "n1",
    title: "Char Dham Yatra registrations are now open for 2026",
    source: "Uttarakhand Tourism",
    sourceUrl: "https://registrationandtouristcare.uk.gov.in/",
    category: "Pilgrimage",
    publishedDate: "2026-06-17",
    priority: "High"
  }
];

// Write to targets
fs.writeFileSync(path.join(targetDir, 'master-registry.json'), JSON.stringify(masterRegistry, null, 2), 'utf-8');
fs.writeFileSync(path.join(targetDir, 'validation-cache.json'), JSON.stringify(validationCache, null, 2), 'utf-8');
fs.writeFileSync(path.join(targetDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2), 'utf-8');
fs.writeFileSync(path.join(targetDir, 'notifications.json'), JSON.stringify(defaultNotifications, null, 2), 'utf-8');

console.log('Successfully generated JSON registry files in src/data/');
