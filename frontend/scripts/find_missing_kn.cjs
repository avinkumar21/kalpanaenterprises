// Find missing Kannada translations for service names and descriptions
const fs = require('fs');
const path = require('path');

const servicesFile = fs.readFileSync(path.join(__dirname, '../src/data/services.ts'), 'utf8');
const knJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/app/locales/kn.json'), 'utf8'));

// Extract all service name and description strings
const nameMatches = [...servicesFile.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
const descMatches = [...servicesFile.matchAll(/description:\s*'([^']+)'/g)].map(m => m[1]);

const allKeys = [...new Set([...nameMatches, ...descMatches])];
const missing = allKeys.filter(key => !(key in knJson));

console.log(`Total keys: ${allKeys.length}`);
console.log(`Missing from kn.json: ${missing.length}`);
console.log('---');
missing.forEach(k => console.log(k));
