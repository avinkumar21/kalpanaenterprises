import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../src/data');
const registryPath = path.join(dataDir, 'master-registry.json');
const cachePath = path.join(dataDir, 'validation-cache.json');
const validationRegistryPath = path.join(dataDir, 'validation-registry.json');

// Predefined official replacements for known broken URLs
const OFFICIAL_REPLACEMENTS = {
  "https://www.telanganatourism.gov.in/": "https://tourism.telangana.gov.in/"
};

// Read files
let registry = [];
let cache = {};
let validationRegistry = [];

if (fs.existsSync(registryPath)) {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
} else {
  console.error('master-registry.json not found');
  process.exit(1);
}

if (fs.existsSync(cachePath)) {
  cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
}

if (fs.existsSync(validationRegistryPath)) {
  try {
    validationRegistry = JSON.parse(fs.readFileSync(validationRegistryPath, 'utf-8'));
  } catch (e) {
    validationRegistry = [];
  }
}

// Function to check if a domain is allowed
function isValidGovOrTrustDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();

    // Standard official government domains
    if (hostname.endsWith('.gov.in') || hostname.endsWith('.nic.in')) {
      return true;
    }

    // Specific allowed temple/tourism/utility/authorized domains
    const allowedHosts = [
      'uidai.gov.in',
      'myaadhaar.uidai.gov.in',
      'www.passportindia.gov.in',
      'www.incometax.gov.in',
      'www.epfindia.gov.in',
      'www.ncs.gov.in',
      'pmkisan.gov.in',
      'www.gst.gov.in',
      'www.digilocker.gov.in',
      'voters.eci.gov.in',
      'www.npscra.nsdl.co.in',
      'www.kukke.org',
      'www.shridharmasthala.org',
      'sabarimalaonline.org',
      'shriamarnathjishrine.com',
      'shrimahakaleshwar.com',
      'www.shrikashivishwanath.org',
      'junglelodges.com',
      'www.junglelodges.com',
      'karnatakaecotourism.com',
      'www.karnatakaecotourism.com',
      'keralatourism.org',
      'www.keralatourism.org',
      'periyartigerreserve.org',
      'www.periyartigerreserve.org',
      'greathimalayannationalpark.org',
      'www.greathimalayannationalpark.org',
      'goatourism.gov.in',
      'maharashtratourism.gov.in',
      'asi.payumoney.com',
      'arunachalilp.com',
      'www.arunachalilp.com',
      'ksrtc.in',
      'www.ksrtc.in',
      'ksrtc.karnataka.gov.in',
      'english.bmrc.co.in',
      'www.karnatakatourism.org',
      'lahdclehpermit.in',
      'www.lahdclehpermit.in',
      'irctc.co.in',
      'www.irctc.co.in',
      'fastag.ihmcl.com',
      'eraktkosh.in',
      'www.eraktkosh.in',
      'chamundeshwaritemple.in',
      'www.chamundeshwaritemple.in'
    ];

    if (allowedHosts.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return true;
    }

    // Reject blogs, news, private portals
    const rejectedKeywords = [
      'blogspot', 'wordpress', 'youtube', 'facebook', 'twitter', 'instagram', 'linkedin',
      'medium.com', 'news', 'blog', 'agent', 'franchise', 'spam', 'expired'
    ];
    if (rejectedKeywords.some(kw => hostname.includes(kw))) {
      return false;
    }

    return false;
  } catch (e) {
    return false;
  }
}

function getSourceAuthority(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    if (hostname.endsWith('.gov.in') || hostname.endsWith('.nic.in')) return 'Official Government Authority';
    if (hostname.includes('kukke') || hostname.includes('dharmasthala') || hostname.includes('sabarimala')) return 'Official Temple Trust';
    if (hostname.includes('junglelodges') || hostname.includes('karnatakatourism')) return 'Official Tourism Board';
    return 'Official Public Authority';
  } catch (e) {
    return 'Official Public Authority';
  }
}

// Check cache rules (Delta Check: Validate ONLY new, updated, or broken URLs. Never rescan healthy URLs)
function shouldValidate(url, cacheEntry) {
  if (!cacheEntry || !cacheEntry.lastValidated) {
    return true; // New URL
  }
  
  const isHealthy = cacheEntry.validated && cacheEntry.statusCode > 0 && cacheEntry.statusCode < 400;
  if (isHealthy) {
    return false; // NEVER rescan healthy URLs
  }
  
  return true; // Scan if new, updated, or broken
}

async function validateServices() {
  console.log(`Starting validation for ${registry.length} services...`);
  let updatedCount = 0;
  const timestamp = new Date().toISOString();

  for (let record of registry) {
    let url = record.officialUrl;
    if (!url) {
      console.log(`[SKIP] Empty URL for ID: ${record.id}`);
      continue;
    }

    // Check for predefined replacements first
    let oldUrl = null;
    let newUrl = null;
    let replacedSourceAuthority = null;
    let replacedUpdatedAt = null;

    if (OFFICIAL_REPLACEMENTS[url]) {
      const replacement = OFFICIAL_REPLACEMENTS[url];
      console.log(`[REPLACE] Found official replacement for ${url} -> ${replacement}`);
      oldUrl = url;
      newUrl = replacement;
      replacedUpdatedAt = timestamp;
      replacedSourceAuthority = 'Official Tourism Board';
      
      // Update URL in the local record and in url variable for subsequent cache/fetch checks
      record.officialUrl = replacement;
      url = replacement;
    }

    // Check Cache
    const cachedEntry = cache[url];
    if (cachedEntry && !shouldValidate(url, cachedEntry)) {
      console.log(`[CACHE HIT] Skipping validation for (within frequency limits): ${url}`);
      // Sync registry from cache
      record.validated = cachedEntry.validated;
      record.statusCode = cachedEntry.statusCode;
      record.lastValidated = cachedEntry.lastValidated.split('T')[0];
      
      // Populate cached record in validation registry
      const existingIndex = validationRegistry.findIndex(entry => entry.id === record.id);
      const regEntry = {
        id: record.id,
        serviceName: record.name,
        currentUrl: url,
        statusCode: cachedEntry.statusCode,
        validationStatus: cachedEntry.validated ? 'Valid' : 'Needs Review',
        lastValidatedAt: cachedEntry.lastValidated,
        responseTime: cachedEntry.responseTime || 0,
        sourceAuthority: cachedEntry.sourceAuthority || getSourceAuthority(url)
      };
      
      if (oldUrl && newUrl) {
        regEntry.oldUrl = oldUrl;
        regEntry.newUrl = newUrl;
        regEntry.updatedAt = replacedUpdatedAt;
      }
      
      if (existingIndex > -1) {
        validationRegistry[existingIndex] = {
          ...validationRegistry[existingIndex],
          ...regEntry
        };
      } else {
        validationRegistry.push(regEntry);
      }
      continue;
    }

    // Check domain allowed
    if (!isValidGovOrTrustDomain(url)) {
      console.log(`[REJECT] Invalid Domain: ${url} (ID: ${record.id})`);
      record.validated = false;
      record.statusCode = 403;
      record.lastValidated = timestamp.split('T')[0];
      
      const sourceAuthority = replacedSourceAuthority || getSourceAuthority(url);
      cache[url] = {
        statusCode: 403,
        validated: false,
        lastValidated: timestamp,
        responseTime: 0,
        sourceAuthority
      };
      
      const existingIndex = validationRegistry.findIndex(entry => entry.id === record.id);
      const regEntry = {
        id: record.id,
        serviceName: record.name,
        currentUrl: url,
        statusCode: 403,
        validationStatus: 'Needs Review',
        lastValidatedAt: timestamp,
        responseTime: 0,
        sourceAuthority
      };
      
      if (oldUrl && newUrl) {
        regEntry.oldUrl = oldUrl;
        regEntry.newUrl = newUrl;
        regEntry.updatedAt = replacedUpdatedAt;
      }

      if (existingIndex > -1) {
        validationRegistry[existingIndex] = regEntry;
      } else {
        validationRegistry.push(regEntry);
      }
      
      updatedCount++;
      continue;
    }

    // Live validation
    console.log(`[LIVE CHECK] Validating URL: ${url}`);
    let success = false;
    let finalStatusCode = 500;
    let responseTime = 0;
    
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
      responseTime = Date.now() - startTime;
      const successCodes = [200, 301, 302];
      finalStatusCode = response.status;
      success = successCodes.includes(response.status);

      // Validate redirect destination
      if (success && response.url && response.url !== url) {
        if (!isValidGovOrTrustDomain(response.url)) {
          console.log(`[REJECT] Invalid Redirect target: ${response.url} (from: ${url})`);
          success = false;
          finalStatusCode = 310; // Custom code for invalid redirect
        }
      }
    } catch (error) {
      responseTime = Date.now() - startTime;
      console.log(`[FAIL] ${error.message} | ${url}`);
      success = false;
      finalStatusCode = 500;
    }

    // Update master registry record
    record.validated = success;
    record.statusCode = finalStatusCode;
    record.lastValidated = timestamp.split('T')[0];

    // Update Cache
    const sourceAuthority = replacedSourceAuthority || getSourceAuthority(url);
    cache[url] = {
      statusCode: finalStatusCode,
      validated: success,
      lastValidated: timestamp,
      responseTime,
      sourceAuthority
    };

    // Upsert validation registry entry
    const existingIndex = validationRegistry.findIndex(entry => entry.id === record.id);
    const regEntry = {
      id: record.id,
      serviceName: record.name,
      currentUrl: url,
      statusCode: finalStatusCode,
      validationStatus: success ? 'Valid' : 'Needs Review',
      lastValidatedAt: timestamp,
      responseTime,
      sourceAuthority
    };
    
    if (oldUrl && newUrl) {
      regEntry.oldUrl = oldUrl;
      regEntry.newUrl = newUrl;
      regEntry.updatedAt = replacedUpdatedAt;
    }

    if (existingIndex > -1) {
      validationRegistry[existingIndex] = {
        ...validationRegistry[existingIndex],
        ...regEntry
      };
    } else {
      validationRegistry.push(regEntry);
      console.log(`Inserted validation entry: ${record.name}`);
    }

    updatedCount++;
    // Throttle live requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Save changes
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  fs.writeFileSync(validationRegistryPath, JSON.stringify(validationRegistry, null, 2), 'utf-8');
  console.log(`Validation completed. Local registry populated with ${validationRegistry.length} entries.`);
}

validateServices();
