const fs = require('fs');
const path = require('path');

// We need to extract URLs from services.ts
const content = fs.readFileSync(path.join(__dirname, '../src/data/services.ts'), 'utf8');

const urlRegex = /url:\s*'([^']+)'/g;
const urls = [];
let match;
while ((match = urlRegex.exec(content)) !== null) {
  urls.push(match[1]);
}

const https = require('https');
const http = require('http');

async function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      if (res.statusCode >= 400) {
        console.log(`BROKEN [${res.statusCode}]: ${url}`);
      }
      resolve();
    });
    
    req.on('error', (e) => {
      console.log(`ERROR [${e.code}]: ${url}`);
      resolve();
    });
    
    req.on('timeout', () => {
      req.abort();
      console.log(`TIMEOUT: ${url}`);
      resolve();
    });
    
    req.end();
  });
}

async function main() {
  console.log(`Checking ${urls.length} URLs...`);
  // Process in batches of 10 to avoid overwhelming network
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    await Promise.all(batch.map(checkUrl));
  }
  console.log("URL Verification Complete.");
}

main();
