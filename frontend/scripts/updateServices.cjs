const fs = require('fs');
const path = require('path');

const servicesPath = path.join(__dirname, '../src/data/services.ts');
let fileContent = fs.readFileSync(servicesPath, 'utf-8');

// 1. Remove the Passport Appointment from Bookings
fileContent = fileContent.replace(
  /\s*\{\s*id:\s*'b6',\s*categoryId:\s*'bookings',\s*categoryName:\s*'Bookings\s*&\s*Reservations',\s*name:\s*'Passport\s*Appointment',\s*description:\s*'Schedule\s*passport\s*office\s*visit',\s*tag:\s*'Services',\s*url:\s*'https:\/\/www\.passportindia\.gov\.in\/'\s*\},/g,
  ''
);

// 2. We'll leave Passport Seva under Central Govt (it's already there)

// 3. Add Job portals to Central Government
const centralGovtInsertString = `
  { id: 'c21', categoryId: 'central', categoryName: 'Central Govt Services', name: 'IBPS Banking Jobs', description: 'Institute of Banking Personnel Selection recruitment', tag: 'Employment', url: 'https://www.ibps.in/' },
  { id: 'c22', categoryId: 'central', categoryName: 'Central Govt Services', name: 'RRB Railway Jobs', description: 'Railway Recruitment Control Board', tag: 'Employment', url: 'https://indianrailways.gov.in/railwayboard/view_section.jsp?lang=0&id=0,4,1244' },`;

fileContent = fileContent.replace(
  /\/\/ State Government \(Karnataka\) \(27 services\)/,
  `${centralGovtInsertString}\n\n  // State Government (Karnataka) (27 services)`
);

// 4. Add KSRTC Jobs to State Government
const stateGovtInsertString = `
  { id: 's28', categoryId: 'state', categoryName: 'State Govt Services (Karnataka)', name: 'KSRTC Recruitment', description: 'Karnataka State Road Transport Corporation jobs', tag: 'Employment', url: 'https://ksrtc.karnataka.gov.in/info-2/Recruitment/en' },`;

fileContent = fileContent.replace(
  /\/\/ Travel & Transport \(8 services\)/,
  `${stateGovtInsertString}\n\n  // Travel & Transport (8 services)`
);

fs.writeFileSync(servicesPath, fileContent);
console.log('Services updated successfully.');
